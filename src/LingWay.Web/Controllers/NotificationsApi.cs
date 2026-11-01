using System.Text.Json.Nodes;
using LingWay.Web.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LingWay.Web.Controllers;

public partial class ApiController
{
    SiteNotificationService Inbox => new(db);

    [HttpGet("notifications")]
    public async Task<IActionResult> Notifications()
    {
        var user = await Current();
        return Ok(await Inbox.Inbox(user.Id));
    }

    [HttpPost("notifications/test")]
    public async Task<IActionResult> TestSiteNotification()
    {
        var user = await Write();
        await Inbox.Add(user.Id, "test:" + Guid.NewGuid(), "Тестовое уведомление",
            "Всё работает! Уведомления сохраняются здесь, в колокольчике LingWay.", "#settings");
        return Ok(new { ok = true });
    }

    [HttpPost("notifications/read")]
    public async Task<IActionResult> ReadSiteNotification([FromBody] JsonObject body)
    {
        var user = await Write();
        if (!Guid.TryParse(body["id"]?.ToString(), out var id))
            return BadRequest(new { error = "Некорректное уведомление" });
        var count = await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE dbo.SiteNotifications SET ReadAt=COALESCE(ReadAt,SYSUTCDATETIME()) WHERE Id={id} AND UserId={user.Id}");
        return count == 0 ? NotFound(new { error = "Уведомление не найдено" }) : Ok(new { ok = true });
    }
}
