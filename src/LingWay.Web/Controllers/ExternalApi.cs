using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using LingWay.Web.Data.Entities;
using LingWay.Web.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LingWay.Web.Controllers;
public partial class ApiController
{
    static readonly System.Collections.Concurrent.ConcurrentDictionary<Guid,List<DateTime>> speechRequests=new();
    PushService Push=>HttpContext.RequestServices.GetRequiredService<PushService>();
    IConfiguration Config=>HttpContext.RequestServices.GetRequiredService<IConfiguration>();
    [HttpGet("push-key")]
    public async Task<IActionResult> PushKey(){await Current();return Ok(new{publicKey=Push.PublicKey});}
    [HttpGet("push-test")]
    public async Task<IActionResult> PushStatus(){var u=await Current();return Ok(new{status=Push.Status(u.Id)});}
    [HttpPost("push-test")]
    public async Task<IActionResult> PushTest()
    {
        var u=await Write();
        if(!await db.UserProfiles.AnyAsync(p=>p.UserId==u.Id&&p.NotificationsEnabled))
            return BadRequest(new{error="Уведомления выключены. Нажмите «Разрешить уведомления» в настройках."});
        if(!await db.PushSubscriptions.AnyAsync(s=>s.UserId==u.Id))
            return BadRequest(new{error="Браузер ещё не подключён. Нажмите «Разрешить уведомления» и подтвердите запрос браузера."});
        return StatusCode(410,new{error="Системные push отключены. Используйте проверку уведомлений в колокольчике сайта."});
    }
    [HttpPost("push-subscribe")]
    public async Task<IActionResult> Subscribe([FromBody]JsonObject body)
    {
        var u=await Write();var sub=body["subscription"]??throw new ArgumentException("Нет подписки");var endpoint=sub.Text("endpoint");var key=sub["keys"].Text("p256dh");var auth=sub["keys"].Text("auth");
        if(endpoint.Length>2000||!PushService.Allowed(endpoint)||key.Length is <20 or >200||auth.Length is <10 or >200)throw new ArgumentException("Недопустимая push-подписка");
        var hash=SHA256.HashData(Encoding.Unicode.GetBytes(endpoint));var stored=await db.PushSubscriptions.SingleOrDefaultAsync(s=>s.EndpointHash==hash);
        if(stored==null){stored=new PushSubscription{Endpoint=endpoint,EndpointHash=hash,CreatedAt=DateTime.UtcNow};db.PushSubscriptions.Add(stored);}stored.UserId=u.Id;stored.P256dh=key;stored.Auth=auth;
        var profile=await db.UserProfiles.SingleAsync(p=>p.UserId==u.Id);
        profile.NotificationsEnabled=true;
        await db.SaveChangesAsync();return Ok(new{ok=true});
    }
    [HttpPost("push-unsubscribe")]
    public async Task<IActionResult> Unsubscribe([FromBody]JsonObject body){var u=await Write();var endpoint=body.Text("endpoint");await db.PushSubscriptions.Where(s=>s.UserId==u.Id&&s.Endpoint==endpoint).ExecuteDeleteAsync();return Ok(new{ok=true});}
    string SpeechKey=>Config["Speech:Key"]??Environment.GetEnvironmentVariable("LINGWAY_SPEECH_KEY")??"";
    string SpeechRegion=>Config["Speech:Region"]??Environment.GetEnvironmentVariable("LINGWAY_SPEECH_REGION")??"";
    [HttpGet("speech-capabilities")]
    public async Task<IActionResult> SpeechCapabilities(){await Current();return Ok(new{assessment=SpeechKey.Length>0&&Regex.IsMatch(SpeechRegion,"^[a-z0-9-]{2,40}$"),provider="Microsoft Azure Speech"});}
    [HttpPost("pronunciation")]
    public async Task<IActionResult> Pronunciation([FromBody]JsonObject body)
    {
        var u=await Write();if(!body.Bool("consent")||await db.UserProfiles.AnyAsync(p=>p.UserId==u.Id&&p.IsGuest))throw new UnauthorizedAccessException("Нужен постоянный аккаунт и согласие на передачу записи");
        if(SpeechKey.Length==0||!Regex.IsMatch(SpeechRegion,"^[a-z0-9-]{2,40}$"))throw new ArgumentException("Акустическая оценка не подключена. Доступна запись для самопроверки");
        await RequireLearningAccess(u.Id,body.Int("lesson_id"));
        var v=await learning.Version(body.Int("lesson_id"),body.Int("version"));var steps=JsonNode.Parse(v.StepsJson)!.AsArray();var i=body.Int("index",-1);
        if(i<0||i>=steps.Count||steps[i].Text("type")!="repeat")throw new ArgumentException("Оценка доступна только для повтора за диктором");
        var audio=Convert.FromBase64String(body.Text("audio"));
        if(audio.Length is <3244 or >960044||Encoding.ASCII.GetString(audio,0,4)!="RIFF"||Encoding.ASCII.GetString(audio,8,4)!="WAVE"||BitConverter.ToInt16(audio,20)!=1||BitConverter.ToInt16(audio,22)!=1||BitConverter.ToInt32(audio,24)!=16000||BitConverter.ToInt16(audio,34)!=16||BitConverter.ToInt32(audio,40)!=audio.Length-44)throw new ArgumentException("Нужен WAV mono PCM16 16 kHz, до 30 секунд");
        var reference=steps[i]!["accepted"]![0]!.ToString();if(reference.Length>500)throw new ArgumentException("Слишком длинный образец");
        var recent=speechRequests.GetOrAdd(u.Id,_=>[]);
        lock(recent){var now=DateTime.UtcNow;recent.RemoveAll(t=>t<now.AddHours(-1));if(recent.Count>=30||(recent.Count>0&&recent[^1]>now.AddSeconds(-5)))throw new ArgumentException("Лимит: один запрос в 5 секунд, 30 запросов в час");recent.Add(now);}
        var parameters=new{ReferenceText=reference,GradingSystem="HundredMark",Granularity="Word",Dimension="Comprehensive",EnableMiscue=true};
        using var client=new HttpClient{Timeout=TimeSpan.FromSeconds(20)};
        using var request=new HttpRequestMessage(HttpMethod.Post,$"https://{SpeechRegion}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=detailed");
        request.Headers.Add("Ocp-Apim-Subscription-Key",SpeechKey);request.Headers.Add("Pronunciation-Assessment",Convert.ToBase64String(Encoding.UTF8.GetBytes(System.Text.Json.JsonSerializer.Serialize(parameters))));
        request.Content=new ByteArrayContent(audio);request.Content.Headers.ContentType=System.Net.Http.Headers.MediaTypeHeaderValue.Parse("audio/wav; codecs=audio/pcm; samplerate=16000");
        using var response=await client.SendAsync(request);if(!response.IsSuccessStatusCode)throw new ArgumentException("Сервис оценки недоступен. Проверьте настройки или повторите позже");
        var result=JsonNode.Parse(await response.Content.ReadAsStringAsync());var best=result?["NBest"]?[0];
        if(result.Text("RecognitionStatus")!="Success"||best==null)throw new ArgumentException("Не удалось распознать речь. Запишите фразу ещё раз");
        var scores=best["PronunciationAssessment"]??best;if(scores["PronScore"]==null)throw new ArgumentException("Сервис не вернул оценку произношения");
        return Ok(new{provider="Microsoft Azure Speech",text=best.Text("Display"),scores=new[]{"AccuracyScore","FluencyScore","CompletenessScore","PronScore"}.ToDictionary(k=>k,k=>Math.Round(Math.Clamp(scores.Number(k,0),0,100),1)),words=(best["Words"]?.AsArray()??[]).Take(150).Select(w=>new{word=w.Text("Word"),accuracy=(w?["PronunciationAssessment"]??w).Number("AccuracyScore",0),error=(w?["PronunciationAssessment"]??w).Text("ErrorType")})});
    }
}
