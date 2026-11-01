using System.Text.Json.Nodes;
using LingWay.Web.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LingWay.Web.Controllers;
public partial class ApiController
{
    [HttpGet("learning-quality")]
    public async Task<IActionResult> LearningQuality()
    {
        await Current();RequireAdmin();
        var (lessons,versions)=await learning.Lessons(true);
        var times=await db.Attempts.AsNoTracking().Select(a=>new{a.LessonId,a.LessonVersion,a.DurationSeconds}).ToListAsync();
        var rows=new List<object>();
        foreach(var lesson in lessons) {
            var version=versions[lesson.Id];var steps=JsonNode.Parse(version.StepsJson)!.AsArray();var meta=JsonFields.Object(version.MetadataJson);
            string? issue=null;
            try { Assessment.ValidatePublication(steps,meta); } catch(ArgumentException ex) { issue=ex.Message; }
            var durations=times.Where(a=>a.LessonId==lesson.Id&&a.LessonVersion==version.Version&&a.DurationSeconds>0).Select(a=>a.DurationSeconds).Order().ToArray();
            var median=durations.Length==0?(double?)null:durations.Length%2==1?durations[durations.Length/2]:(durations[durations.Length/2-1]+durations[durations.Length/2])/2.0;
            rows.Add(new{id=lesson.Id,title=lesson.Title,version=version.Version,steps=steps.Count,validation=issue??"OK",samples=durations.Length,
                median_minutes=median/60,within_target=durations.Count(d=>d>=600&&d<=900),fast=durations.Count(d=>d<60),
                note="Техническая статистика, включая тестовые прохождения. Не заменяет пилот с учениками."});
        }
        return Ok(new{lessons=rows,audio="Сохранённый синтез Microsoft Zira; не запись диктора",pronunciation="Azure Speech: требуется отдельная настройка и проверка с согласия пользователя"});
    }
}
