using System.Security.Cryptography;
using System.Text.Json.Nodes;
using LingWay.Web.Data.Entities;
using LingWay.Web.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LingWay.Web.Controllers;
public partial class ApiController
{
    [HttpPost("groups")]
    public async Task<IActionResult> CreateGroup([FromBody]JsonObject body)
    {
        var u=await Write();RequireStaff();var g=new StudyGroup{Name=Text(body,"name",100),JoinCode=Convert.ToHexString(RandomNumberGenerator.GetBytes(4)),TeacherId=u.Id,CreatedAt=DateTime.UtcNow};
        db.StudyGroups.Add(g);await db.SaveChangesAsync();await Audit(u.Id,$"Создана группа {g.Id}");return Ok(new{id=g.Id});
    }
    [HttpPost("join")]
    public async Task<IActionResult> Join([FromBody]JsonObject body)
    {
        var u=await Write();if(!u.EmailConfirmed)throw new UnauthorizedAccessException("Сначала подтвердите почту");
        var g=await db.StudyGroups.SingleOrDefaultAsync(g=>g.JoinCode==body.Text("code").Trim().ToUpper())??throw new ArgumentException("Группа не найдена");
        if(!await db.GroupMembers.AnyAsync(m=>m.GroupId==g.Id&&m.UserId==u.Id)){db.GroupMembers.Add(new GroupMember{GroupId=g.Id,UserId=u.Id,JoinedAt=DateTime.UtcNow});await db.SaveChangesAsync();}return Ok(new{ok=true});
    }
    [HttpPost("members")]
    public async Task<IActionResult> Members([FromBody]JsonObject body)
    {
        var u=await Write();var g=await Scope(body.Int("group_id"));var person=await users.FindByEmailAsync(body.Text("email").Trim());
        if(person==null||!await users.IsInRoleAsync(person,"Student"))throw new ArgumentException("Зарегистрированный ученик не найден");
        var member=await db.GroupMembers.FindAsync(g.Id,person.Id);
        if(body.Bool("remove")){if(member!=null){await db.Assignments.Where(a=>a.GroupId==g.Id&&a.StudentId==person.Id).ExecuteDeleteAsync();db.GroupMembers.Remove(member);}}
        else if(member==null)db.GroupMembers.Add(new GroupMember{GroupId=g.Id,UserId=person.Id,JoinedAt=DateTime.UtcNow});
        await db.SaveChangesAsync();await Audit(u.Id,"Изменён состав группы");return Ok(new{ok=true});
    }
    [HttpPost("assignments")]
    public async Task<IActionResult> Assign([FromBody]JsonObject body)
    {
        var u=await Write();var g=await Scope(body.Int("group_id"));var module=body.Int("module_id");
        if(!await db.Modules.AnyAsync(m=>m.Id==module))throw new ArgumentException("Модуль не найден");
        var due=body.Text("due")==""?(DateOnly?)null:DateOnly.ParseExact(body.Text("due"),"yyyy-MM-dd");
        Guid? studentId=null;
        if(body.Int("student_id")>0) {
            studentId=await db.GroupMembers.Where(m=>m.GroupId==g.Id&&m.User.LegacyId==body.Int("student_id")).Select(m=>(Guid?)m.UserId).SingleOrDefaultAsync();
            if(studentId==null)throw new UnauthorizedAccessException("Ученик не состоит в вашей группе");
        }
        var a=await db.Assignments.SingleOrDefaultAsync(a=>a.GroupId==g.Id&&a.ModuleId==module&&a.StudentId==studentId);
        if(a==null){a=new Assignment{GroupId=g.Id,ModuleId=module,StudentId=studentId,CreatedAt=DateTime.UtcNow};db.Assignments.Add(a);}a.DueDate=due;
        await db.SaveChangesAsync();await Audit(u.Id,"Назначен учебный модуль");return Ok(new{ok=true});
    }
    [HttpPost("role")]
    public async Task<IActionResult> Role([FromBody]JsonObject body)
    {
        var u=await Write();RequireAdmin();var target=await users.Users.SingleOrDefaultAsync(p=>p.LegacyId==body.Int("id"))??throw new ArgumentException("Пользователь не найден");
        if(u.Id==target.Id)throw new ArgumentException("Нельзя изменить собственную роль");
        var role=body.Text("role") switch{"student"=>"Student","teacher"=>"Teacher","admin"=>"Admin",_=>throw new ArgumentException("Неизвестная роль")};
        if(role=="Student"&&await db.StudyGroups.AnyAsync(g=>g.TeacherId==target.Id))throw new ArgumentException("Сначала передайте группы другому преподавателю");
        AccountService.Require(await users.RemoveFromRolesAsync(target,await users.GetRolesAsync(target)));AccountService.Require(await users.AddToRoleAsync(target,role));
        await users.UpdateSecurityStampAsync(target);await Audit(u.Id,$"Роль пользователя {target.LegacyId}: {role}");return Ok(new{ok=true});
    }
    [HttpPost("table-preview"),HttpPost("import-preview")]
    public async Task<IActionResult> Preview([FromBody]JsonObject body)
    {
        await Write();RequireStaff();return Ok(TableService.Parse(body));
    }
    [HttpPost("import-check"),HttpPost("import-commit"),HttpPost("import")]
    public async Task<IActionResult> Import([FromBody]JsonObject body)
    {
        var u=await Write();RequireStaff();var kind=body.Text("kind","phrases");
        if(kind=="phrases")RequireAdmin();else if(kind=="students")await Scope(body.Int("group_id"));else throw new ArgumentException("Неизвестный тип импорта");
        var commit=!Request.Path.Value!.EndsWith("import-check");return Ok(await tables.Import(u,body,commit));
    }
    [HttpGet("report")]
    public async Task<IActionResult> Report()
    {
        var u=await Current();RequireStaff();var groups=await db.StudyGroups.Where(g=>Admin||g.TeacherId==u.Id).Select(g=>g.Id).ToListAsync();
        var groupSelected=int.TryParse(Request.Query["group"],out var gid);
        if(groupSelected){await Scope(gid);groups=[gid];}
        var members=await db.GroupMembers.Where(m=>groups.Contains(m.GroupId)).Select(m=>m.UserId).Distinct().ToListAsync();
        var query=db.Attempts.AsNoTracking().Include(a=>a.User).Include(a=>a.LessonVersionNavigation).ThenInclude(v=>v.Lesson).Where(a=>(Admin&&!groupSelected)||members.Contains(a.UserId));
        var q=Request.Query;
        if(!string.IsNullOrWhiteSpace(q["level"]))query=query.Where(a=>a.LessonVersionNavigation.Lesson.EnglishLevel==q["level"].ToString());
        if(int.TryParse(q["student"],out var sid))query=query.Where(a=>a.User.LegacyId==sid);
        if(int.TryParse(q["module"],out var mid))query=query.Where(a=>a.LessonVersionNavigation.Lesson.ModuleId==mid);
        if(!string.IsNullOrEmpty(q["from"])){var date=DateTime.ParseExact(q["from"]!,"yyyy-MM-dd",null);query=query.Where(a=>a.CompletedAt>=date);}
        if(!string.IsNullOrEmpty(q["to"])){var date=DateTime.ParseExact(q["to"]!,"yyyy-MM-dd",null).AddDays(1);query=query.Where(a=>a.CompletedAt<date);}
        if(!string.IsNullOrEmpty(q["due"])){
            var date=DateOnly.ParseExact(q["due"]!,"yyyy-MM-dd");
            query=query.Where(a=>db.Assignments.Any(x=>groups.Contains(x.GroupId)&&(x.StudentId==null||x.StudentId==a.UserId)&&x.ModuleId==a.LessonVersionNavigation.Lesson.ModuleId&&x.DueDate!=null&&x.DueDate<=date&&db.GroupMembers.Any(m=>m.GroupId==x.GroupId&&m.UserId==a.UserId)));
        }
        var records=await query.OrderByDescending(a=>a.CompletedAt).ToListAsync();
        var rows=new List<string[]>{new[]{"Имя","Почта","Урок","Уровень","Результат","Звёзды","Дата","Секунд","Трудные фразы"}};
        foreach(var a in records)rows.Add([a.User.LegacyDisplayName??"",a.User.Email??"",a.LessonVersionNavigation.Lesson.Title,a.LessonVersionNavigation.Lesson.EnglishLevel,a.Score.ToString(),a.Stars.ToString(),LearningService.Iso(a.CompletedAt),a.DurationSeconds.ToString(),string.Join("; ",(JsonNode.Parse(a.LegacyAnswersJson??"[]")!.AsArray()).Where(r=>r.Text("type")!="vocabulary"&&(!r.Bool("correct")||r.Int("tries",1)>1||r.Bool("hint"))).Select(r=>r.Text("expected")))]);
        await Audit(u.Id,"Экспорт учебного отчёта");
        return q["format"]=="xlsx"?File(TableService.Xlsx(rows),"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","report.xlsx"):File(TableService.Csv(rows),"text/csv; charset=utf-8","report.csv");
    }
}
