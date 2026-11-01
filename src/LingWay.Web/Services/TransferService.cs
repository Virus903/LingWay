using LingWay.Web.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace LingWay.Web.Services;
public sealed class TransferService(LingWayDbContext db,UserManager<ApplicationUser> users,IWebHostEnvironment env,ILogger<TransferService> logger)
{
    public async Task Merge(ApplicationUser? guest,ApplicationUser target)
    {
        if(guest==null||guest.Id==target.Id||!await db.UserProfiles.AnyAsync(p=>p.UserId==guest.Id&&p.IsGuest))return;
        await using var tx=await db.Database.BeginTransactionAsync();
        var source=guest.Id;var dest=target.Id;
        await db.Database.ExecuteSqlInterpolatedAsync($"INSERT dbo.FavoritePhrases(UserId,PhraseId,CreatedAt) SELECT {dest},PhraseId,CreatedAt FROM dbo.FavoritePhrases s WHERE UserId={source} AND NOT EXISTS(SELECT 1 FROM dbo.FavoritePhrases d WHERE d.UserId={dest} AND d.PhraseId=s.PhraseId)");
        await db.Database.ExecuteSqlInterpolatedAsync($"INSERT dbo.PhraseReviews(UserId,PhraseId,ReviewStreak,DueAt) SELECT {dest},PhraseId,ReviewStreak,DueAt FROM dbo.PhraseReviews s WHERE UserId={source} AND NOT EXISTS(SELECT 1 FROM dbo.PhraseReviews d WHERE d.UserId={dest} AND d.PhraseId=s.PhraseId)");
        await db.Database.ExecuteSqlInterpolatedAsync($"INSERT dbo.VocabularyItems(UserId,English,Translation,Transcription,DueAt,ReviewStreak,CreatedAt) SELECT {dest},English,Translation,Transcription,DueAt,ReviewStreak,CreatedAt FROM dbo.VocabularyItems s WHERE UserId={source} AND NOT EXISTS(SELECT 1 FROM dbo.VocabularyItems d WHERE d.UserId={dest} AND d.English=s.English)");
        await db.Database.ExecuteSqlInterpolatedAsync($"INSERT dbo.UserAchievements(UserId,AchievementCode,EarnedAt) SELECT {dest},AchievementCode,EarnedAt FROM dbo.UserAchievements s WHERE UserId={source} AND NOT EXISTS(SELECT 1 FROM dbo.UserAchievements d WHERE d.UserId={dest} AND d.AchievementCode=s.AchievementCode)");
        await db.Database.ExecuteSqlInterpolatedAsync($"INSERT dbo.PassportStamps(UserId,ModuleId,EarnedAt) SELECT {dest},ModuleId,EarnedAt FROM dbo.PassportStamps s WHERE UserId={source} AND NOT EXISTS(SELECT 1 FROM dbo.PassportStamps d WHERE d.UserId={dest} AND d.ModuleId=s.ModuleId)");
        await db.Attempts.Where(a=>a.UserId==source).ExecuteUpdateAsync(s=>s.SetProperty(a=>a.UserId,dest));
        await db.AuditEvents.Where(a=>a.UserId==source).ExecuteUpdateAsync(s=>s.SetProperty(a=>a.UserId,dest));
        // Delete through the same SQL transaction, including the disposable guest's Identity rows.
        await db.AspNetUsers.Where(u=>u.Id==source).ExecuteDeleteAsync();await tx.CommitAsync();
    }
    public async Task DeleteStudent(ApplicationUser u)
    {
        if(!await users.IsInRoleAsync(u,"Student"))throw new UnauthorizedAccessException("Удаление сотрудника запрещено");
        await using var tx=await db.Database.BeginTransactionAsync();
        await db.Attempts.Where(a=>a.UserId==u.Id).ExecuteDeleteAsync();
        await db.Assignments.Where(a=>a.StudentId==u.Id).ExecuteDeleteAsync();
        await db.GroupMembers.Where(m=>m.UserId==u.Id).ExecuteDeleteAsync();
        await db.AuditEvents.Where(a=>a.UserId==u.Id).ExecuteUpdateAsync(s=>s.SetProperty(a=>a.UserId,(Guid?)null).SetProperty(a=>a.Action,"Действие удалённого аккаунта"));
        await db.MediaFiles.Where(m=>m.UploadedBy==u.Id).ExecuteUpdateAsync(s=>s.SetProperty(m=>m.UploadedBy,(Guid?)null));
        await db.ImportBatches.Where(i=>i.UserId==u.Id).ExecuteUpdateAsync(s=>s.SetProperty(i=>i.UserId,(Guid?)null).SetProperty(i=>i.ErrorsJson,"[]"));
        var legacy=u.LegacyId.ToString();
        await db.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM migration.SourceRows WHERE JSON_VALUE(RowJson,'$.user_id')={legacy} OR (SourceTable='users' AND JSON_VALUE(RowJson,'$.id')={legacy}); DELETE FROM migration.EntityMap WHERE EntityType='users' AND (SourceId={legacy} OR TargetId={u.Id.ToString()});");
        await db.Database.ExecuteSqlInterpolatedAsync($"IF NOT EXISTS(SELECT 1 FROM dbo.AccountDeletions WHERE UserId={u.Id}) INSERT dbo.AccountDeletions(UserId,LegacyId) VALUES({u.Id},{u.LegacyId});");
        await db.AspNetUsers.Where(x=>x.Id==u.Id).ExecuteDeleteAsync();await tx.CommitAsync();
        try {
            var folder=Path.Combine(env.ContentRootPath,"App_Data","operations","deletions");Directory.CreateDirectory(folder);
            await File.WriteAllTextAsync(Path.Combine(folder,u.Id+".json"),System.Text.Json.JsonSerializer.Serialize(new{UserId=u.Id,LegacyId=u.LegacyId,DeletedAt=DateTime.UtcNow}));
        } catch(Exception ex) when(ex is IOException or UnauthorizedAccessException) {
            logger.LogCritical("Deletion ledger mirror failed. Database ledger remains authoritative; export it before any restore.");
        }
    }
}
