using System.Text.Json.Nodes;
using LingWay.Web.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LingWay.Web.Controllers;
public partial class ApiController
{
    public sealed class ProgressRow { public string StateJson { get; set; } = ""; }
    public sealed class ProgressSummary { public Guid UserId { get; set; } public int LessonId { get; set; } }

    [HttpGet("lesson-progress")]
    public async Task<IActionResult> LessonProgress()
    {
        var u = await Current();
        var rows = await db.Database.SqlQuery<ProgressRow>($"SELECT StateJson FROM dbo.LessonProgress WHERE UserId={u.Id} AND AttemptId NOT IN (SELECT Id FROM dbo.Attempts WHERE UserId={u.Id})").ToListAsync();
        return Ok(rows.Select(r => JsonNode.Parse(r.StateJson)));
    }

    [HttpPost("lesson-progress")]
    public async Task<IActionResult> SaveLessonProgress([FromBody] JsonObject body)
    {
        var u = await Write();
        if (body.Int("owner_id") != u.LegacyId) return Forbid();
        var state = body["state"] as JsonObject;
        if (state == null || state.ToJsonString().Length > 100000 || !Guid.TryParse(state.Text("id"), out var attemptId))
            return BadRequest(new { error = "Некорректный прогресс урока" });
        var lessonId = state.Int("lesson_id");
        await RequireLearningAccess(u.Id,lessonId);
        var version = await learning.Version(lessonId, state.Int("version"));
        var steps = JsonNode.Parse(version.StepsJson)!.AsArray();
        if (state.Int("index", -1) < 0 || state.Int("index") >= steps.Count || state["answers"] is not JsonArray answers || answers.Count > 100)
            return BadRequest(new { error = "Некорректный шаг урока" });
        if (await db.Attempts.AnyAsync(a => a.Id == attemptId && a.UserId == u.Id)) return Ok(new { completed = true });
        var updated = Math.Min(state["savedAt"]?.GetValue<long>() ?? 0, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
        var json = state.ToJsonString();
        await db.Database.ExecuteSqlInterpolatedAsync($"""
            MERGE dbo.LessonProgress WITH(HOLDLOCK) AS target
            USING (SELECT {u.Id} AS UserId,{lessonId} AS LessonId) AS source
            ON target.UserId=source.UserId AND target.LessonId=source.LessonId
            WHEN MATCHED AND target.UpdatedAt <= {updated} THEN
              UPDATE SET AttemptId={attemptId},StateJson={json},UpdatedAt={updated}
            WHEN NOT MATCHED THEN INSERT(UserId,LessonId,AttemptId,StateJson,UpdatedAt)
              VALUES({u.Id},{lessonId},{attemptId},{json},{updated});
            """);
        return Ok(new { ok = true });
    }
}
