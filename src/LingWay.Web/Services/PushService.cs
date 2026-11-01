using System.Collections.Concurrent;
using System.Text.Json;
using LingWay.Web.Data;
using Microsoft.EntityFrameworkCore;
using WebPush;

namespace LingWay.Web.Services;
public sealed class PushService(IServiceScopeFactory scopes,IWebHostEnvironment environment,IConfiguration config,ILogger<PushService> logger) : BackgroundService
{
    readonly ConcurrentDictionary<Guid,(DateTime due,string status)> tests=new();
    readonly ConcurrentDictionary<string,DateTime> retryAfter=new();
    readonly Lazy<VapidDetails> keys=new(()=>{
        var folder=Path.Combine(environment.ContentRootPath,"App_Data");Directory.CreateDirectory(folder);var file=Path.Combine(folder,"vapid.json");
        if(File.Exists(file)){var saved=JsonSerializer.Deserialize<Dictionary<string,string>>(File.ReadAllText(file))!;return new VapidDetails("mailto:"+(config["Mail:From"]??"admin@lingway.local"),saved["public"],saved["private"]);}
        var generated=VapidHelper.GenerateVapidKeys();File.WriteAllText(file,JsonSerializer.Serialize(new Dictionary<string,string>{{"public",generated.PublicKey},{"private",generated.PrivateKey}}));
        return new VapidDetails("mailto:"+(config["Mail:From"]??"admin@lingway.local"),generated.PublicKey,generated.PrivateKey);
    });
    public string PublicKey=>keys.Value.PublicKey;
    public static bool IsDue(TimeOnly time,TimeOnly reminder,TimeOnly quietStart,TimeOnly quietEnd,bool enabled,bool alreadySent)
    {
        var quiet=quietStart==quietEnd?false:quietStart<quietEnd?time>=quietStart&&time<quietEnd:time>=quietStart||time<quietEnd;
        // A reminder that falls in evening quiet hours is delivered after quiet hours the next morning.
        var delivery=reminder;
        var reminderQuiet=quietStart!=quietEnd&&(quietStart<quietEnd?reminder>=quietStart&&reminder<quietEnd:reminder>=quietStart||reminder<quietEnd);
        if(reminderQuiet)delivery=quietEnd;
        return enabled&&!alreadySent&&!quiet&&time>=delivery;
    }
    public static bool Allowed(string endpoint)
    {
        if(!Uri.TryCreate(endpoint,UriKind.Absolute,out var uri)||uri.Scheme!="https"||!uri.IsDefaultPort||uri.UserInfo!="")return false;
        return new[]{"fcm.googleapis.com","updates.push.services.mozilla.com","web.push.apple.com"}.Contains(uri.Host)||uri.Host.EndsWith(".notify.windows.com",StringComparison.OrdinalIgnoreCase)||uri.Host.EndsWith(".push.apple.com",StringComparison.OrdinalIgnoreCase);
    }
    public string Status(Guid u)=>tests.TryGetValue(u,out var item)?item.status:"Тест ещё не запускался";
    public string Schedule(Guid u)
    {
        if(tests.TryGetValue(u,out var old)&&old.due>DateTime.UtcNow.AddSeconds(-50))throw new ArgumentException("Повторите через минуту");
        tests[u]=(DateTime.UtcNow.AddSeconds(10),"Тест запланирован через 10 секунд. Сервер должен оставаться запущенным.");return Status(u);
    }
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer=new PeriodicTimer(TimeSpan.FromSeconds(10));
        while(await timer.WaitForNextTickAsync(stoppingToken))try{
            using var scope=scopes.CreateScope();var db=scope.ServiceProvider.GetRequiredService<LingWayDbContext>();
            var subscriptions=await db.PushSubscriptions.Include(s=>s.User).ThenInclude(u=>u.UserProfile).ToListAsync(stoppingToken);
            var now=DateTime.UtcNow;
            foreach(var group in subscriptions.GroupBy(s=>s.UserId)){
                var testing=tests.TryGetValue(group.Key,out var test)&&test.due<=now&&test.status.StartsWith("Тест запланирован");
                var p=group.First().User.UserProfile;if(p==null)continue;
                TimeZoneInfo zone;try{zone=TimeZoneInfo.FindSystemTimeZoneById(p.TimeZoneId);}catch{zone=TimeZoneInfo.Utc;}
                var local=TimeZoneInfo.ConvertTimeFromUtc(now,zone);var time=TimeOnly.FromDateTime(local);
                if(!p.NotificationsEnabled)continue;
                if(!testing&&!IsDue(time,p.ReminderTime,p.QuietStart,p.QuietEnd,true,false))continue;
                int sent=0;string? failure=null;
                foreach(var sub in group){
                    if(!testing&&sub.LastSentAt is DateTime last&&TimeZoneInfo.ConvertTimeFromUtc(last,zone).Date==local.Date)continue;
                    if(!Allowed(sub.Endpoint))continue;
                    if(!testing&&retryAfter.TryGetValue(sub.Endpoint,out var retry)&&retry>now)continue;
                    try{
                        using var client=new WebPushClient();await client.SendNotificationAsync(new WebPush.PushSubscription(sub.Endpoint,sub.P256dh,sub.Auth),JsonSerializer.Serialize(new{title="LingWay",body=testing?"Проверка: фоновая доставка работает":"Время для короткого урока и повторения слов"}),keys.Value,cancellationToken:stoppingToken);
                        sub.LastSentAt=now;sent++;retryAfter.TryRemove(sub.Endpoint,out _);
                    }catch(WebPushException ex){if(ex.StatusCode is System.Net.HttpStatusCode.Gone or System.Net.HttpStatusCode.NotFound){db.PushSubscriptions.Remove(sub);retryAfter.TryRemove(sub.Endpoint,out _);}else retryAfter[sub.Endpoint]=now.AddMinutes(5);failure="Push-служба отклонила доставку. Переподключите уведомления.";}
                    catch(Exception ex) when(ex is not OperationCanceledException){retryAfter[sub.Endpoint]=now.AddMinutes(5);failure="Push-служба недоступна. Повторите позже.";logger.LogWarning("Push delivery failed: {Type}",ex.GetType().Name);}
                }
                if(testing)tests[group.Key]=(test.due,sent>0?"Push-служба приняла уведомление. Появление зависит от настроек браузера.":failure??"Нет активных подписок");
            }
            await db.SaveChangesAsync(stoppingToken);
        }catch(Exception ex) when(ex is not OperationCanceledException){logger.LogWarning(ex,"Reminder iteration failed");}
    }
}
