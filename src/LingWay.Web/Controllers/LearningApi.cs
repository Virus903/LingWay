using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using LingWay.Web.Data.Entities;
using LingWay.Web.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LingWay.Web.Controllers;
public partial class ApiController
{
    [HttpPost("assess")]
    public async Task<IActionResult> Assess([FromBody]JsonObject body)
    {
        var actor=await Write();
        await RequireLearningAccess(actor.Id,body.Int("lesson_id"));
        var v=await learning.Version(body.Int("lesson_id"),body.Int("version"));var steps=JsonNode.Parse(v.StepsJson)!.AsArray();var index=body.Int("index",-1);
        if(index<0||index>=steps.Count)throw new ArgumentException("Задание не найдено");
        if(body.Text("value").Length>2000)throw new ArgumentException("Слишком длинный ответ");
        return Ok(Assessment.Check(steps[index]!,body.Text("value"),JsonFields.Object(v.MetadataJson)["criteria"].Number("near_threshold",.82)));
    }
    [HttpPost("attempt")]
    public async Task<IActionResult> Attempt([FromBody]JsonObject body)
    {
        var u=await Write();if(body.ContainsKey("owner_id")&&body.Int("owner_id")!=u.LegacyId)throw new UnauthorizedAccessException("Попытка другого аккаунта");var attempt=await learning.Submit(u,Staff,body);await Audit(u.Id,$"Урок {attempt.LessonId} завершён: {attempt.Score}%");return Ok(LearningService.AttemptDto(attempt,u.LegacyId));
    }
    [HttpPost("attempts/batch")]
    public async Task<IActionResult> AttemptBatch([FromBody]JsonObject body)
    {
        var u=await Write();
        if(body.Int("owner_id",-1)!=u.LegacyId)throw new UnauthorizedAccessException("Очередь принадлежит другому аккаунту. Войдите в исходный аккаунт.");
        if(body["attempts"] is not JsonArray batch||batch.Count is <1 or >50)throw new ArgumentException("Допустимо от 1 до 50 попыток");
        var result=new List<object>();
        foreach(var item in batch)
        {
            var id=item.Text("id");
            try
            {
                if(item is not JsonObject attempt)throw new ArgumentException("Повреждённая попытка");
                var saved=await learning.Submit(u,Staff,attempt);
                result.Add(new{id,status=200,result=LearningService.AttemptDto(saved,u.LegacyId),error=""});
            }
            catch(Exception ex) when(ex is ArgumentException or FormatException or UnauthorizedAccessException or SubmissionConflictException)
            {
                result.Add(new{id,status=ex is UnauthorizedAccessException?403:ex is SubmissionConflictException?409:422,result=(object?)null,error=ex.Message});
            }
            finally { db.ChangeTracker.Clear(); }
        }
        return Ok(new{owner_id=u.LegacyId,results=result});
    }
    [HttpPost("favorite")]
    public async Task<IActionResult> Favorite([FromBody]JsonObject body)
    {
        var u=await Write();var pid=body.Int("id");if(!await db.Phrases.AnyAsync(p=>p.Id==pid))throw new ArgumentException("Фраза не найдена");
        var f=await db.FavoritePhrases.FindAsync(u.Id,pid);
        if(body.Bool("enabled")) {
            if(f==null)db.FavoritePhrases.Add(new FavoritePhrase{UserId=u.Id,PhraseId=pid,CreatedAt=DateTime.UtcNow});
            if(!await db.PhraseReviews.AnyAsync(r=>r.UserId==u.Id&&r.PhraseId==pid))db.PhraseReviews.Add(new PhraseReview{UserId=u.Id,PhraseId=pid,DueAt=DateTime.UtcNow});
        } else if(f!=null) db.FavoritePhrases.Remove(f);
        await db.SaveChangesAsync();return Ok(new{ok=true});
    }
    static DateTime Due(int streak)=>DateTime.UtcNow.AddSeconds(streak==0?600:86400*Math.Min(Math.Pow(2,streak),60));
    [HttpPost("review")]
    public async Task<IActionResult> Review([FromBody]JsonObject body)
    {
        var u=await Write();var r=await db.PhraseReviews.FindAsync(u.Id,body.Int("id"))??throw new ArgumentException("Добавьте фразу в словарь");
        r.ReviewStreak=body.Bool("known")?Math.Min(r.ReviewStreak+1,10):0;r.DueAt=Due(r.ReviewStreak);await db.SaveChangesAsync();return Ok(new{ok=true});
    }
    [HttpPost("vocabulary")]
    public async Task<IActionResult> Vocabulary([FromBody]JsonObject body)
    {
        var u=await Write();
        if(body.Bool("remove"))await db.VocabularyItems.Where(v=>v.Id==body.Int("id")&&v.UserId==u.Id).ExecuteDeleteAsync();
        else {
            var en=Text(body,"en",400);var ru=Text(body,"ru",500);var ipa=Text(body,"ipa",500,false);
            var v=await db.VocabularyItems.SingleOrDefaultAsync(v=>v.UserId==u.Id&&v.English==en);
            if(v==null){v=new VocabularyItem{UserId=u.Id,English=en,DueAt=DateTime.UtcNow,CreatedAt=DateTime.UtcNow};db.VocabularyItems.Add(v);}
            v.Translation=ru;v.Transcription=ipa;await db.SaveChangesAsync();
        }
        return Ok(new{ok=true});
    }
    [HttpPost("vocabulary-review")]
    public async Task<IActionResult> VocabularyReview([FromBody]JsonObject body)
    {
        var u=await Write();var v=await db.VocabularyItems.SingleOrDefaultAsync(v=>v.Id==body.Int("id")&&v.UserId==u.Id)??throw new ArgumentException("Фраза не найдена");
        v.ReviewStreak=body.Bool("known")?Math.Min(v.ReviewStreak+1,8):0;v.DueAt=Due(v.ReviewStreak);await db.SaveChangesAsync();return Ok(new{ok=true});
    }
    [HttpGet("package")]
    public async Task<IActionResult> Package()
    {
        await Current();var p=await db.ContentPackages.AsNoTracking().OrderByDescending(p=>p.Id).FirstOrDefaultAsync()??throw new ArgumentException("Пакет ещё не опубликован");
        return Ok(new{id=p.Id,created=LearningService.Iso(p.PublishedAt),content=JsonNode.Parse(p.ContentJson)});
    }
    [HttpPost("package-publish")]
    public async Task<IActionResult> Publish()
    {
        var u=await Write();RequireAdmin();
        var contentNode=await learning.Content();
        foreach(var lesson in contentNode["lessons"]!.AsArray())Assessment.ValidatePublication(lesson!["steps"]!.AsArray(),lesson["meta"]!.AsObject());
        var content=contentNode.ToJsonString();var bytes=Encoding.UTF8.GetBytes(content);
        var p=new ContentPackage{ContentJson=content,SizeBytes=bytes.Length,Sha256=Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant(),PublishedAt=DateTime.UtcNow};
        db.ContentPackages.Add(p);await db.SaveChangesAsync();await Audit(u.Id,$"Опубликован пакет {p.Id}");return Ok(new{id=p.Id});
    }
    [HttpPost("lessons")]
    public async Task<IActionResult> SaveLesson([FromBody]JsonObject body)
    {
        var u=await Write();RequireAdmin();var steps=body["steps"]?.AsArray()??[];var meta=body["meta"]?.AsObject()??new();Assessment.Validate(steps,meta);
        if(body.Bool("published"))Assessment.ValidatePublication(steps,meta);
        var title=Text(body,"title",200);var description=Text(body,"description",2000,false);var level=body.Text("level","A1");
        if(!new[]{"A1","A2","B1"}.Contains(level))throw new ArgumentException("Неизвестный уровень");
        var module=body.Int("module_id");if(!await db.Modules.AnyAsync(m=>m.Id==module))throw new ArgumentException("Модуль не найден");
        await using var tx=await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
        var l=body.Int("id")>0?await db.Lessons.FindAsync(body.Int("id")):null;
        if(body.Int("id")>0&&l==null)throw new ArgumentException("Урок не найден");
        if(l==null){l=new Lesson{ModuleId=module,SortOrder=(await db.Lessons.Where(x=>x.ModuleId==module).Select(x=>(int?)x.SortOrder).MaxAsync()??0)+1};db.Lessons.Add(l);}
        else if(l.ModuleId!=module)l.SortOrder=(await db.Lessons.Where(x=>x.ModuleId==module).Select(x=>(int?)x.SortOrder).MaxAsync()??0)+1;
        l.ModuleId=module;l.Title=title;l.Description=description;l.EnglishLevel=level;l.IsPublished=body.Bool("published");await db.SaveChangesAsync();
        var latest=await db.LessonVersions.Where(v=>v.LessonId==l.Id).Select(v=>(int?)v.Version).MaxAsync()??0;
        if(body.Int("version")>0&&body.Int("version")!=latest)throw new ArgumentException("Урок уже изменён. Обновите редактор");
        db.LessonVersions.Add(new LessonVersion{LessonId=l.Id,Version=latest+1,StepsJson=steps.ToJsonString(),MetadataJson=meta.ToJsonString(),CreatedAt=DateTime.UtcNow});
        await db.SaveChangesAsync();await tx.CommitAsync();await Audit(u.Id,$"Сохранён урок {l.Id}, версия {latest+1}");return Ok(new{id=l.Id});
    }
    [HttpPost("phrases")]
    public async Task<IActionResult> SavePhrase([FromBody]JsonObject body)
    {
        var u=await Write();RequireAdmin();var p=body.Int("id")>0?await db.Phrases.FindAsync(body.Int("id")):new Phrase();
        if(p==null)throw new ArgumentException("Фраза не найдена");if(p.Id==0)db.Phrases.Add(p);
        p.English=Text(body,"en",400);p.Translation=Text(body,"ru",500);p.Category=Text(body,"category",100);p.Transcription=Text(body,"ipa",500,false);
        await db.SaveChangesAsync();await Audit(u.Id,"Сохранена фраза");return Ok(new{ok=true});
    }
}
