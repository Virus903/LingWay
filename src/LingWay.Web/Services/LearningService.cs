using System.Text.Json.Nodes;
using LingWay.Web.Data;
using LingWay.Web.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace LingWay.Web.Services;
public sealed class LearningService(LingWayDbContext db)
{
    public static string SubmissionHash(JsonObject body)
    {
        var answers=new JsonArray();
        foreach(var a in body["answers"]?.AsArray()??[]) {
            var answer=new JsonObject { ["step_index"]=a.Int("step_index",answers.Count),["value"]=a.Text("value"),["hint"]=a.Bool("hint"),["hint_level"]=Math.Clamp(a.Int("hint_level"),0,3) };
            if(a.Int("tries",1)!=1)answer["tries"]=a.Int("tries",1);
            answers.Add(answer);
        }
        var normalized=new JsonObject { ["lesson_id"]=body.Int("lesson_id"),["version"]=body.Int("version"),["duration"]=Math.Clamp(body.Int("duration"),0,7200),["answers"]=answers };
        return Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(normalized.ToJsonString())));
    }
    public static string Iso(DateTime dt)=>DateTime.SpecifyKind(dt,DateTimeKind.Utc).ToString("O");
    public static double Unix(DateTime dt)=>new DateTimeOffset(DateTime.SpecifyKind(dt,DateTimeKind.Utc)).ToUnixTimeSeconds();
    public static object ModuleDto(Module m)=>new{id=m.Id,title=m.Title,description=m.Description??"",position=m.SortOrder,emergency=m.IsEmergency?1:0};
    public static object LessonDto(Lesson l,LessonVersion v)=>new{id=l.Id,module_id=l.ModuleId,title=l.Title,description=l.Description??"",level=l.EnglishLevel,published=l.IsPublished?1:0,version=v.Version,steps=JsonNode.Parse(v.StepsJson),meta=JsonNode.Parse(v.MetadataJson)};
    public static object PhraseDto(Phrase p)=>new{id=p.Id,en=p.English,ru=p.Translation,ipa=p.Transcription??"",category=p.Category};
    public static object AttemptDto(Attempt a,int? uid)=>new{id=a.Id,user_id=uid,lesson_id=a.LessonId,version=a.LessonVersion,score=a.Score,stars=a.Stars,passed=a.IsPassed,answers=a.LegacyAnswersJson??"[]",created=Iso(a.CompletedAt),duration=a.DurationSeconds};
    public async Task<(List<Lesson>,Dictionary<int,LessonVersion>)> Lessons(bool staff=false)
    {
        var lessons=await db.Lessons.AsNoTracking().Where(l=>staff||l.IsPublished).OrderBy(l=>l.Module.SortOrder).ThenBy(l=>l.SortOrder).ToListAsync();
        var versions=await db.LessonVersions.AsNoTracking().Where(v=>!db.LessonVersions.Any(n=>n.LessonId==v.LessonId&&n.Version>v.Version)).ToDictionaryAsync(v=>v.LessonId);
        return(lessons,versions);
    }
    public async Task<JsonObject> Content()
    {
        var (lessons,versions)=await Lessons();
        return System.Text.Json.JsonSerializer.SerializeToNode(new { modules=(await db.Modules.AsNoTracking().OrderBy(m=>m.SortOrder).ToListAsync()).Select(ModuleDto),lessons=lessons.Select(l=>LessonDto(l,versions[l.Id])),phrases=(await db.Phrases.AsNoTracking().ToListAsync()).Select(PhraseDto) })!.AsObject();
    }
    public async Task<bool> Unlocked(Guid user,int moduleId)
    {
        var module=await db.Modules.FindAsync(moduleId);if(module==null)return false;if(module.IsEmergency)return true;
        var previous=await db.Modules.Where(m=>m.SortOrder<module.SortOrder&&!m.IsEmergency).OrderByDescending(m=>m.SortOrder).FirstOrDefaultAsync();
        if(previous==null)return true;
        var (lessons,versions)=await Lessons();var required=lessons.Where(l=>l.ModuleId==previous.Id).ToArray();
        var attempts=await db.Attempts.AsNoTracking().Where(a=>a.UserId==user).ToListAsync();
        return required.Length>0&&required.All(l=>attempts.Any(a=>a.LessonId==l.Id&&a.IsPassed));
    }
    public async Task<LessonVersion> Version(int lessonId,int version)
    {
        if(!await db.Lessons.AnyAsync(l=>l.Id==lessonId&&l.IsPublished)) throw new ArgumentException("Опубликованный урок не найден");
        return await db.LessonVersions.AsNoTracking().SingleOrDefaultAsync(v=>v.LessonId==lessonId&&v.Version==version)??throw new ArgumentException("Версия урока не найдена. Обновите пакет");
    }
    public async Task<Attempt> Submit(ApplicationUser user,bool staff,JsonObject body)
    {
        var id=Guid.Parse(body.Text("id"));
        if(body["answers"] is not JsonArray answerList||answerList.Count>100)throw new ArgumentException("Недопустимое число ответов");
        var requestHash=SubmissionHash(body);
        await using var tx=await db.Database.BeginTransactionAsync();
        var resource="LingWay:attempt:"+user.Id;
        await db.Database.ExecuteSqlInterpolatedAsync($"DECLARE @r int; EXEC @r=sys.sp_getapplock @Resource={resource}, @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=10000; IF @r<0 THROW 50001, 'Attempt is busy; retry', 1;");
        var existing=await db.Attempts.FindAsync(id);
        if(existing!=null) {
            if(existing.UserId!=user.Id)throw new UnauthorizedAccessException("Попытка другого пользователя");
            if(existing.RequestHash!=null&&existing.RequestHash!=requestHash)throw new SubmissionConflictException();
            if(existing.RequestHash==null&&(existing.LessonId!=body.Int("lesson_id")||existing.LessonVersion!=body.Int("version")))throw new SubmissionConflictException();
            return existing;
        }
        if(!user.EmailConfirmed)throw new UnauthorizedAccessException("Сначала подтвердите почту");
        var version=await Version(body.Int("lesson_id"),body.Int("version"));
        var lesson=await db.Lessons.FindAsync(version.LessonId)??throw new ArgumentException("Урок не найден");
        if(!staff&&!await Unlocked(user.Id,lesson.ModuleId))throw new UnauthorizedAccessException("Сначала завершите предыдущий модуль");
        var meta=JsonFields.Object(version.MetadataJson);
        var (score,stars,results)=Assessment.Score(JsonNode.Parse(version.StepsJson)!.AsArray(),body["answers"]?.AsArray()??[],meta);
        var attempt=new Attempt{Id=id,UserId=user.Id,LessonId=lesson.Id,LessonVersion=version.Version,Score=score,Stars=(byte)stars,IsPassed=score>=meta["criteria"].Number("pass_score",80),DurationSeconds=Math.Clamp(body.Int("duration"),0,7200),CompletedAt=DateTime.UtcNow,ReceivedAt=DateTime.UtcNow,LegacyAnswersJson=results.ToJsonString()};
        int seq=0;
        foreach(var r in results) attempt.AttemptAnswers.Add(new AttemptAnswer{SequenceNumber=seq++,StepIndex=r.Int("step_index"),Prompt=r.Text("prompt"),ExpectedAnswer=r.Text("expected"),UserAnswer=r.Text("value"),Status=r.Text("status"),HintLevel=(byte)r.Int("hint_level"),ExerciseType=r.Text("type"),LegacyAnswerJson=r!.ToJsonString()});
        attempt.RequestHash=requestHash;
        db.Attempts.Add(attempt);await db.SaveChangesAsync();
        await db.Database.ExecuteSqlInterpolatedAsync($"DELETE dbo.LessonProgress WHERE UserId={user.Id} AND AttemptId={attempt.Id}");
        await Reward(user.Id,meta);await tx.CommitAsync();return attempt;
    }
    public async Task Reward(Guid user,JsonObject? meta=null)
    {
        await using var rewardTransaction=db.Database.CurrentTransaction==null?await db.Database.BeginTransactionAsync():null;
        if(rewardTransaction!=null){var resource="LingWay:attempt:"+user;await db.Database.ExecuteSqlInterpolatedAsync($"DECLARE @r int; EXEC @r=sys.sp_getapplock @Resource={resource}, @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=10000; IF @r<0 THROW 50001, 'Rewards are busy; retry', 1;");}
        var attempts=await db.Attempts.AsNoTracking().Where(a=>a.UserId==user).ToListAsync();
        var earned=await db.UserAchievements.Where(a=>a.UserId==user).Select(a=>a.AchievementCode).ToListAsync();
        foreach(var code in new[]{attempts.Count>0?"first-lesson":"",attempts.Count>=10?"ten-lessons":"",attempts.Any(a=>a.Score==100)?"perfect":""}.Where(s=>s!=""&&!earned.Contains(s)))
            db.UserAchievements.Add(new UserAchievement{UserId=user,AchievementCode=code,EarnedAt=DateTime.UtcNow});
        var stamps=await db.PassportStamps.Where(s=>s.UserId==user).Select(s=>s.ModuleId).ToListAsync();
        var (lessons,versions)=await Lessons();
        foreach(var group in lessons.GroupBy(l=>l.ModuleId)) if(!stamps.Contains(group.Key)&&group.All(l=>attempts.Any(a=>a.LessonId==l.Id&&a.IsPassed))) db.PassportStamps.Add(new PassportStamp{UserId=user,ModuleId=group.Key,EarnedAt=DateTime.UtcNow});
        if(meta?["vocabulary"] is JsonArray words) {
            var stored=(await db.VocabularyItems.Where(v=>v.UserId==user).Select(v=>v.English).ToListAsync()).ToHashSet(StringComparer.OrdinalIgnoreCase);
            foreach(var w in words) if(stored.Add(w.Text("en"))) db.VocabularyItems.Add(new VocabularyItem{UserId=user,English=w.Text("en"),Translation=w.Text("ru"),Transcription=w.Text("ipa"),DueAt=DateTime.UtcNow,CreatedAt=DateTime.UtcNow});
        }
        await db.SaveChangesAsync();
        if(rewardTransaction!=null)await rewardTransaction.CommitAsync();
    }
}
