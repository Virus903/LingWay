using System.Security.Cryptography;
using System.Text.Json.Nodes;
using LingWay.Web.Data;
using LingWay.Web.Data.Entities;
using LingWay.Web.Services;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LingWay.Web.Controllers;
[ApiController,Route("api"),RequestSizeLimit(8_000_000)]
public partial class ApiController(LingWayDbContext db,UserManager<ApplicationUser> users,SignInManager<ApplicationUser> signIn,AccountService accounts,LearningService learning,TransferService transfer,TableService tables,IAntiforgery antiforgery) : ControllerBase
{
    bool Staff=>User.IsInRole("Admin")||User.IsInRole("Teacher");
    bool Admin=>User.IsInRole("Admin");
    async Task<ApplicationUser> Current()=>await users.GetUserAsync(User)??throw new UnauthorizedAccessException("Войдите в аккаунт");
    void RequireStaff(){if(!Staff)throw new UnauthorizedAccessException("Недостаточно прав");}
    void RequireAdmin(){if(!Admin)throw new UnauthorizedAccessException("Только для администратора");}
    async Task RequireLearningAccess(Guid userId,int lessonId)
    {
        if(Staff)return;
        var lesson=await db.Lessons.AsNoTracking().SingleOrDefaultAsync(l=>l.Id==lessonId&&l.IsPublished);
        if(lesson==null||!await learning.Unlocked(userId,lesson.ModuleId))
            throw new UnauthorizedAccessException("Урок недоступен для этого аккаунта");
    }
    async Task<ApplicationUser> Write(){await antiforgery.ValidateRequestAsync(HttpContext);return await Current();}
    async Task Origin(){await antiforgery.ValidateRequestAsync(HttpContext);}
    async Task Audit(Guid id,string action){db.AuditEvents.Add(new AuditEvent{UserId=id,Action=action,CreatedAt=DateTime.UtcNow});await db.SaveChangesAsync();}
    async Task<StudyGroup> Scope(int id)
    {
        var u=await Current();var g=await db.StudyGroups.FindAsync(id)??throw new ArgumentException("Группа не найдена");
        if(!Admin&&(!Staff||g.TeacherId!=u.Id)) throw new UnauthorizedAccessException("Нет доступа к группе");return g;
    }
    static string Text(JsonObject body,string field,int max,bool required=true)
    {
        var s=body.Text(field).Trim();if((required&&s.Length==0)||s.Length>max)throw new ArgumentException("Проверьте поле: "+field);return s;
    }
    [HttpGet("bootstrap")]
    public async Task<IActionResult> Bootstrap()
    {
        var u=await users.GetUserAsync(User);var (lessons,versions)=await learning.Lessons(Staff);
        var result=new Dictionary<string,object?> { ["user"]=u==null?null:await accounts.Public(u),["csrf"]=antiforgery.GetAndStoreTokens(HttpContext).RequestToken,
            ["modules"]=(await db.Modules.AsNoTracking().OrderBy(x=>x.SortOrder).ToListAsync()).Select(LearningService.ModuleDto),
            ["lessons"]=lessons.Select(l=>LearningService.LessonDto(l,versions[l.Id])),["phrases"]=(await db.Phrases.AsNoTracking().ToListAsync()).Select(LearningService.PhraseDto) };
        foreach(var key in new[]{"attempts","favorites","reviews","groups","members","assignments","users","audit","vocabulary","awards"})result[key]=Array.Empty<object>();
        result["durations"]=new Dictionary<string,int>();
        result["packages"]=(await db.ContentPackages.AsNoTracking().OrderByDescending(p=>p.Id).Take(10).Select(p=>new{p.Id,p.PublishedAt,p.SizeBytes}).ToListAsync()).Select(p=>new{id=p.Id,created=LearningService.Iso(p.PublishedAt),bytes=p.SizeBytes});
        if(u!=null) {
            var groups=await db.StudyGroups.AsNoTracking().Where(g=>Admin||(Staff?g.TeacherId==u.Id:g.GroupMembers.Any(m=>m.UserId==u.Id))).ToListAsync();var gids=groups.Select(g=>g.Id).ToArray();
            var members=await db.GroupMembers.AsNoTracking().Include(m=>m.User).Where(m=>gids.Contains(m.GroupId)).ToListAsync();var memberIds=members.Select(m=>m.UserId).Distinct().ToArray();
            var people=await db.AspNetUsers.AsNoTracking().Include(p=>p.Roles).Where(p=>Admin||memberIds.Contains(p.Id)||p.Id==u.Id||groups.Select(g=>g.TeacherId).Contains(p.Id)).ToListAsync();
            var ids=people.ToDictionary(p=>p.Id,p=>p.LegacyId);
            var progress=await db.Database.SqlQueryRaw<ProgressSummary>("SELECT p.UserId,p.LessonId FROM dbo.LessonProgress p WHERE NOT EXISTS(SELECT 1 FROM dbo.Attempts a WHERE a.Id=p.AttemptId AND a.UserId=p.UserId)")
                .Where(p=>Staff?(Admin||memberIds.Contains(p.UserId)):p.UserId==u.Id).ToListAsync();
            result["lesson_progress"]=progress.Select(p=>new{user_id=ids.GetValueOrDefault(p.UserId),lesson_id=p.LessonId});
            result["groups"]=groups.Select(g=>new{id=g.Id,name=g.Name,code=g.JoinCode,owner_id=ids.GetValueOrDefault(g.TeacherId)});
            result["members"]=members.Where(m=>Staff||m.UserId==u.Id).Select(m=>new{group_id=m.GroupId,user_id=m.User.LegacyId,name=m.User.LegacyDisplayName,email=m.User.Email});
            result["assignments"]=(await db.Assignments.AsNoTracking().Where(a=>gids.Contains(a.GroupId)&&(Staff||a.StudentId==null||a.StudentId==u.Id)).ToListAsync()).Select(a=>new{id=a.Id,group_id=a.GroupId,module_id=a.ModuleId,student_id=a.StudentId.HasValue?ids.GetValueOrDefault(a.StudentId.Value):(int?)null,due=a.DueDate?.ToString("yyyy-MM-dd")??""});
            if(Staff) result["users"]=people.Where(p=>Admin||memberIds.Contains(p.Id)).Select(p=>new{id=p.LegacyId,name=p.LegacyDisplayName,email=p.Email,role=p.Roles.FirstOrDefault()?.Name?.ToLowerInvariant()??"student",verified=p.EmailConfirmed?1:0});
            var attempts=await db.Attempts.AsNoTracking().Where(a=>Admin||(Staff?memberIds.Contains(a.UserId)||a.UserId==u.Id:a.UserId==u.Id)).ToListAsync();
            result["attempts"]=attempts.Select(a=>LearningService.AttemptDto(a,ids.GetValueOrDefault(a.UserId)));result["durations"]=attempts.ToDictionary(a=>a.Id.ToString(),a=>a.DurationSeconds);
            result["favorites"]=await db.FavoritePhrases.Where(f=>f.UserId==u.Id).Select(f=>f.PhraseId).ToListAsync();
            result["reviews"]=(await db.PhraseReviews.AsNoTracking().Where(r=>r.UserId==u.Id).ToListAsync()).Select(r=>new{user_id=u.LegacyId,phrase_id=r.PhraseId,streak=r.ReviewStreak,due=LearningService.Unix(r.DueAt)});
            result["vocabulary"]=(await db.VocabularyItems.AsNoTracking().Where(v=>v.UserId==u.Id).ToListAsync()).Select(v=>new{id=v.Id,user_id=u.LegacyId,en=v.English,ru=v.Translation,ipa=v.Transcription??"",streak=v.ReviewStreak,due=LearningService.Unix(v.DueAt)});
            var awards=new List<object>();
            awards.AddRange((await db.UserAchievements.AsNoTracking().Where(a=>a.UserId==u.Id).ToListAsync()).Select(a=>new{user_id=u.LegacyId,kind="achievement",key=a.AchievementCode,earned=LearningService.Iso(a.EarnedAt)}));
            awards.AddRange((await db.PassportStamps.AsNoTracking().Where(a=>a.UserId==u.Id).ToListAsync()).Select(a=>new{user_id=u.LegacyId,kind="stamp",key=a.ModuleId.ToString(),earned=LearningService.Iso(a.EarnedAt)}));result["awards"]=awards;
            if(Staff)result["audit"]=(await db.AuditEvents.AsNoTracking().Include(a=>a.User).Where(a=>Admin||a.UserId==u.Id).OrderByDescending(a=>a.Id).Take(100).ToListAsync()).Select(a=>new{id=a.Id,user_id=a.User?.LegacyId,action=a.Action,created=LearningService.Iso(a.CreatedAt),name=a.User?.LegacyDisplayName});
        }
        return Ok(result);
    }
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] JsonObject body)
    {
        await Origin();var u=await users.FindByEmailAsync(body.Text("email").Trim());
        if(u==null||await users.IsLockedOutAsync(u))return Unauthorized(new{error="Неверная почта или пароль, либо вход временно заблокирован"});
        if(!await accounts.Password(u,body.Text("password"))) {await users.AccessFailedAsync(u);return Unauthorized(new{error="Неверная почта или пароль"});}
        await users.ResetAccessFailedCountAsync(u);
        if(body.Bool("transfer_guest"))await transfer.Merge(await users.GetUserAsync(User),u);
        await learning.Reward(u.Id);
        await signIn.SignInAsync(u,true);await Audit(u.Id,"Вход в систему");return Ok(new{user=await accounts.Public(u)});
    }
    [HttpPost("guest")]
    public async Task<IActionResult> Guest()
    {
        await Origin();if(User.Identity?.IsAuthenticated==true)return Ok(new{ok=true});
        var u=await accounts.Create("guest-"+Guid.NewGuid().ToString("N")+"@lingway.local",Convert.ToHexString(RandomNumberGenerator.GetBytes(32)),"Гость","",true);
        await signIn.SignInAsync(u,true);return Ok(new{ok=true});
    }
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] JsonObject body)
    {
        HttpContext.RequestServices.GetRequiredService<MailService>().EnsureConfigured();
        await Origin();StudyGroup? group=null;
        if(body.Text("group_code")!="")group=await db.StudyGroups.SingleOrDefaultAsync(g=>g.JoinCode==body.Text("group_code").Trim().ToUpper())??throw new ArgumentException("Неверный код группы");
        var u=await accounts.Create(Text(body,"email",200).ToLowerInvariant(),body.Text("password"),Text(body,"first_name",40),Text(body,"last_name",60));
        if(group!=null){db.GroupMembers.Add(new GroupMember{GroupId=group.Id,UserId=u.Id,JoinedAt=DateTime.UtcNow});await db.SaveChangesAsync();}
        if(body.Bool("transfer_guest"))await transfer.Merge(await users.GetUserAsync(User),u);
        await signIn.SignInAsync(u,true);await Audit(u.Id,"Регистрация");
        try { await accounts.SendCode(u,"verify");return Ok(new{ok=true}); }
        catch(ArgumentException) { return Ok(new{ok=true,mail_pending=true,message="Аккаунт создан, но письмо не отправлено. Запросите код повторно."}); }
    }
    [HttpPost("code")]
    public async Task<IActionResult> Code([FromBody]JsonObject body)
    {
        await Origin();var purpose=body.Text("purpose","reset");
        if(purpose is not ("verify" or "reset"))throw new ArgumentException("Неверный тип кода");
        HttpContext.RequestServices.GetRequiredService<MailService>().EnsureConfigured();
        var u=await users.FindByEmailAsync(Text(body,"email",200));
        if(u!=null)try { await accounts.SendCode(u,purpose); } catch(ArgumentException) { /* Generic response prevents account enumeration. */ }
        return Ok(new{ok=true,message="Если аккаунт существует и отправка доступна, письмо с кодом придёт на указанную почту. Повторная отправка доступна через минуту."});
    }
    [HttpPost("verify")]
    public async Task<IActionResult> Verify([FromBody]JsonObject body)
    {
        var u=await Write();await accounts.CheckCode(u,"verify",body.Text("code"));u.EmailConfirmed=true;AccountService.Require(await users.UpdateAsync(u));await signIn.RefreshSignInAsync(u);return Ok(new{ok=true});
    }
    [HttpPost("reset")]
    public async Task<IActionResult> Reset([FromBody]JsonObject body)
    {
        await Origin();var u=await users.FindByEmailAsync(Text(body,"email",200))??throw new ArgumentException("Неверный код");
        if(body.Text("password").Length is <8 or >200)throw new ArgumentException("Пароль: 8–200 символов");
        await accounts.CheckCode(u,"reset",body.Text("code"));AccountService.Require(await users.ResetPasswordAsync(u,await users.GeneratePasswordResetTokenAsync(u),body.Text("password")));return Ok(new{ok=true});
    }
    [HttpPost("profile")]
    public async Task<IActionResult> Profile([FromBody]JsonObject body){var u=await Write();await accounts.SaveProfile(u,body);return Ok(new{ok=true});}
    [HttpPost("password")]
    public async Task<IActionResult> Password([FromBody]JsonObject body)
    {
        var u=await Write();if(!await accounts.Password(u,body.Text("old")))throw new ArgumentException("Неверный текущий пароль");
        if(body.Text("password").Length>200)throw new ArgumentException("Слишком длинный пароль");
        AccountService.Require(await users.ChangePasswordAsync(u,body.Text("old"),body.Text("password")));await signIn.RefreshSignInAsync(u);return Ok(new{ok=true});
    }
    [HttpPost("logout"),HttpPost("logout-all")]
    public async Task<IActionResult> Logout()
    {
        var u=await Write();if(Request.Path.Value!.EndsWith("logout-all"))await users.UpdateSecurityStampAsync(u);await signIn.SignOutAsync();return Ok(new{ok=true});
    }
    [HttpGet("export-account")]
    public async Task<IActionResult> ExportAccount()
    {
        var u=await Current();return Ok(new{account=await accounts.Public(u),attempts=(await db.Attempts.AsNoTracking().Where(a=>a.UserId==u.Id).ToListAsync()).Select(a=>LearningService.AttemptDto(a,u.LegacyId)),favorites=await db.FavoritePhrases.Where(f=>f.UserId==u.Id).Select(f=>f.PhraseId).ToListAsync(),vocabulary=await db.VocabularyItems.Where(v=>v.UserId==u.Id).Select(v=>new{v.English,v.Translation,v.Transcription,v.ReviewStreak,v.DueAt}).ToListAsync()});
    }
    [HttpPost("delete-account")]
    public async Task<IActionResult> Delete([FromBody]JsonObject body)
    {
        var u=await Write();if(Staff)throw new UnauthorizedAccessException("Самостоятельное удаление сотрудников отключено");if(!await accounts.Password(u,body.Text("password")))throw new ArgumentException("Неверный пароль");
        await transfer.DeleteStudent(u);await signIn.SignOutAsync();return Ok(new{ok=true});
    }
}
