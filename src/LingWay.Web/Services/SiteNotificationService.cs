using LingWay.Web.Data;
using Microsoft.EntityFrameworkCore;

namespace LingWay.Web.Services;

public sealed class SiteNotificationService(LingWayDbContext db)
{
    public sealed class Item
    {
        public Guid Id { get; set; }
        public string Title { get; set; } = "";
        public string Body { get; set; } = "";
        public string Href { get; set; } = "";
        public DateTime CreatedAt { get; set; }
        public DateTime? ReadAt { get; set; }
    }

    public async Task Add(Guid userId, string key, string title, string body, string href)
    {
        await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT dbo.SiteNotifications(Id,UserId,EventKey,Title,Body,Href)
            SELECT {Guid.NewGuid()},{userId},{key},{title},{body},{href}
            WHERE NOT EXISTS(SELECT 1 FROM dbo.SiteNotifications WITH(UPDLOCK,HOLDLOCK)
                WHERE UserId={userId} AND EventKey={key})
            """);
    }

    public async Task<List<Item>> Inbox(Guid userId)
    {
        var user = await db.AspNetUsers.AsNoTracking().SingleAsync(u => u.Id == userId);
        var profile = await db.UserProfiles.AsNoTracking().SingleAsync(p => p.UserId == userId);
        if (!user.EmailConfirmed && !profile.IsGuest)
            await Add(userId, "verify", "Подтвердите почту", "Подтвердите адрес электронной почты в настройках аккаунта.", "#verify");
        if (profile.NotificationsEnabled)
        {
            TimeZoneInfo zone;
            try { zone = TimeZoneInfo.FindSystemTimeZoneById(profile.TimeZoneId); }
            catch { zone = TimeZoneInfo.Utc; }
            var local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, zone);
            if (PushService.IsDue(TimeOnly.FromDateTime(local), profile.ReminderTime, profile.QuietStart, profile.QuietEnd, true, false)
                && await db.PhraseReviews.AnyAsync(r => r.UserId == userId && r.DueAt <= DateTime.UtcNow))
                await Add(userId, "review:" + local.ToString("yyyy-MM-dd"), "Пора повторить фразы", "Сохранённые фразы готовы к повторению. Уделите им несколько минут.", "#mistakes");
            var assignments = await db.Assignments.AsNoTracking()
                .Where(a => (a.StudentId==null||a.StudentId==userId)&&db.GroupMembers.Any(m => m.GroupId == a.GroupId && m.UserId == userId))
                .Select(a => new { a.Id, a.ModuleId }).ToListAsync();
            foreach (var assignment in assignments)
                await Add(userId, "assignment:" + assignment.Id, "Назначен учебный модуль", "Преподаватель назначил вам учебный модуль.", "#module?id=" + assignment.ModuleId);
        }
        return await db.Database.SqlQuery<Item>($"SELECT Id,Title,Body,Href,CreatedAt,ReadAt FROM dbo.SiteNotifications WHERE UserId={userId}")
            .OrderByDescending(n => n.CreatedAt).ToListAsync();
    }
}
