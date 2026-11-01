extern alias ModernCrypto;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using LingWay.Web.Data;
using LingWay.Web.Data.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using SCrypt = ModernCrypto::Org.BouncyCastle.Crypto.Generators.SCrypt;

namespace LingWay.Web.Services;
public sealed class AccountService(LingWayDbContext db,UserManager<ApplicationUser> users,MailService mail,IdentityContext identity)
{
    public async Task<bool> Password(ApplicationUser user,string password)
    {
        if(password.Length>200) return false;
        if(user.PasswordHash!=null) return await users.CheckPasswordAsync(user,password);
        var old=await db.LegacyPasswordCredentials.FindAsync(user.Id);
        if(old==null||old.Algorithm!="scrypt") return false;
        var expected=Convert.FromHexString(old.HashHex);
        var actual=SCrypt.Generate(Encoding.UTF8.GetBytes(password),Convert.FromHexString(old.SaltHex),old.WorkFactor,old.BlockSize,old.Parallelism,expected.Length);
        if(!CryptographicOperations.FixedTimeEquals(actual,expected)) return false;
        Require(await users.AddPasswordAsync(user,password));
        // Once Identity has a password hash, do not retain a second credential.
        db.LegacyPasswordCredentials.Remove(old);
        await db.SaveChangesAsync();
        return true;
    }
    public static void Require(IdentityResult result)
    {
        if(!result.Succeeded) throw new ArgumentException(string.Join("; ",result.Errors.Select(e=>e.Description)));
    }
    public async Task<ApplicationUser> Create(string email,string password,string first,string last,bool guest=false)
    {
        if(!guest && (!System.Net.Mail.MailAddress.TryCreate(email,out var parsed)||parsed.Address!=email||password.Length is <8 or >200||first.Length is <1 or >40||last.Length is <1 or >60))
            throw new ArgumentException("Проверьте имя, фамилию, почту и пароль (8–200 символов)");
        await using var ownTransaction=db.Database.CurrentTransaction==null?await db.Database.BeginTransactionAsync():null;
        identity.Database.SetDbConnection(db.Database.GetDbConnection());
        await using var identityTransaction=await identity.Database.UseTransactionAsync(db.Database.CurrentTransaction!.GetDbTransaction());
        var id=await db.Database.SqlQueryRaw<int>("SELECT NEXT VALUE FOR dbo.UserPublicId AS Value").ToListAsync();
        var user=new ApplicationUser { Id=Guid.NewGuid(),LegacyId=id[0],LegacyDisplayName=guest?"Гость":first+" "+last,UserName=email,Email=email,EmailConfirmed=guest,LockoutEnabled=true };
        Require(await users.CreateAsync(user,password));
        Require(await users.AddToRoleAsync(user,"Student"));
        db.UserProfiles.Add(new UserProfile { UserId=user.Id,FirstName=first,LastName=last,IsGuest=guest,OnboardingCompleted=guest,DailyMinutes=15,Theme="system",Language="ru",SpeechRate=1,TimeZoneId="Russian Standard Time",ReminderTime=new(19,0),QuietStart=new(22,0),QuietEnd=new(8,0),CreatedAt=DateTime.UtcNow,LegacyProfileJson="{}" });
        await db.SaveChangesAsync();
        if(ownTransaction!=null)await ownTransaction.CommitAsync();
        return user;
    }
    public static JsonObject Profile(UserProfile p) => new() {
        ["first_name"]=p.FirstName,["last_name"]=p.LastName,["avatar"]=p.AvatarDataUri??p.AvatarPath??"",
        ["about"]=p.About??"",["level"]=p.EnglishLevel??"",["goal"]=p.LearningGoal??"",["destination"]=p.Destination??"",
        ["trip_date"]=p.TripDate?.ToString("yyyy-MM-dd")??"",["minutes"]=p.DailyMinutes,["theme"]=p.Theme,["language"]=p.Language,
        ["speech_rate"]=p.SpeechRate,["onboarded"]=p.OnboardingCompleted,["notifications"]=p.NotificationsEnabled,["guest"]=p.IsGuest,
        ["reminder_time"]=p.ReminderTime.ToString("HH:mm"),["quiet_start"]=p.QuietStart.ToString("HH:mm"),["quiet_end"]=p.QuietEnd.ToString("HH:mm")
    };
    public async Task<object> Public(ApplicationUser u,bool includeProfile=true)
    {
        var roles=await users.GetRolesAsync(u);
        var p=includeProfile? await db.UserProfiles.AsNoTracking().SingleAsync(x=>x.UserId==u.Id):null;
        return new { id=u.LegacyId,name=u.LegacyDisplayName??u.UserName,email=u.Email,role=roles.FirstOrDefault()?.ToLowerInvariant()??"student",verified=u.EmailConfirmed?1:0,profile=p==null?null:Profile(p).ToJsonString() };
    }
    public async Task SaveProfile(ApplicationUser u,JsonObject body)
    {
        var p=await db.UserProfiles.SingleAsync(x=>x.UserId==u.Id);var incoming=body["profile"]?.AsObject()??new();
        var current=Profile(p);
        foreach(var kv in incoming) if(current.ContainsKey(kv.Key)&&kv.Key!="guest") current[kv.Key]=kv.Value?.DeepClone();
        foreach(var (key,max) in new[]{("first_name",40),("last_name",60),("about",1000),("goal",200),("destination",100),("avatar",1400000)}) if(current.Text(key).Length>max) throw new ArgumentException("Слишком длинное поле: "+key);
        if(!new[]{"light","dark","system"}.Contains(current.Text("theme"))||!new[]{"ru","en"}.Contains(current.Text("language"))||current.Int("minutes") is <5 or >60||current.Number("speech_rate",1) is <.5 or >2) throw new ArgumentException("Проверьте настройки профиля");
        var level=current.Text("level");if(level!=""&&!new[]{"A1","A2","B1","B2","C1","C2"}.Contains(level)) throw new ArgumentException("Неизвестный уровень");
        var avatar=current.Text("avatar");
        if(avatar!="" && !new[]{"data:image/png;base64,","data:image/jpeg;base64,","data:image/webp;base64,"}.Any(avatar.StartsWith)) throw new ArgumentException("Выберите PNG, JPEG или WebP");
        if(avatar!="") MediaValidation.Validate(avatar,true);
        p.FirstName=current.Text("first_name");p.LastName=current.Text("last_name");p.AvatarDataUri=avatar;p.About=current.Text("about");p.EnglishLevel=level==""?null:level;
        p.LearningGoal=current.Text("goal");p.Destination=current.Text("destination");p.TripDate=current.Text("trip_date")==""?null:DateOnly.ParseExact(current.Text("trip_date"),"yyyy-MM-dd");
        p.DailyMinutes=current.Int("minutes");p.Theme=current.Text("theme");p.Language=current.Text("language");p.SpeechRate=(decimal)current.Number("speech_rate",1);p.OnboardingCompleted=current.Bool("onboarded");p.NotificationsEnabled=current.Bool("notifications");
        p.ReminderTime=TimeOnly.ParseExact(current.Text("reminder_time"),"HH:mm");p.QuietStart=TimeOnly.ParseExact(current.Text("quiet_start"),"HH:mm");p.QuietEnd=TimeOnly.ParseExact(current.Text("quiet_end"),"HH:mm");
        p.LegacyProfileJson=current.ToJsonString();
        u.LegacyDisplayName=body.Text("name",(p.FirstName+" "+p.LastName).Trim());
        if(u.LegacyDisplayName.Length is <1 or >101) throw new ArgumentException("Укажите имя и фамилию");
        Require(await users.UpdateAsync(u));await db.SaveChangesAsync();
    }
    public async Task SendCode(ApplicationUser u,string purpose)
    {
        mail.EnsureConfigured();
        if(purpose is not ("reset" or "verify")) throw new ArgumentException("Неверный тип кода");
        await using var transaction = await db.Database.BeginTransactionAsync();
        var resource = "LingWay:code:" + u.Id + ":" + purpose;
        await db.Database.ExecuteSqlInterpolatedAsync($"DECLARE @r int; EXEC @r=sys.sp_getapplock @Resource={resource}, @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=10000; IF @r<0 THROW 50001, 'Code is busy', 1;");
        var code=RandomNumberGenerator.GetInt32(1000000).ToString("D6");
        var row=await db.ApplicationCodes.FindAsync(u.Id,purpose);
        if(row!=null&&row.ExpiresAt>DateTime.UtcNow.AddMinutes(14)) throw new ArgumentException("Новый код можно запросить через минуту");
        if(row==null){row=new ApplicationCode{UserId=u.Id,Purpose=purpose};db.ApplicationCodes.Add(row);}
        row.CodeHash=Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(code)));row.ExpiresAt=DateTime.UtcNow.AddMinutes(15);row.Tries=0;await db.SaveChangesAsync();
        await mail.SendCode(u.Email!,purpose,code);
        await transaction.CommitAsync();
    }
    public async Task CheckCode(ApplicationUser u,string purpose,string code)
    {
        if(code.Length!=6||!code.All(char.IsAsciiDigit))throw new ArgumentException("Введите шестизначный код");
        await using var transaction = await db.Database.BeginTransactionAsync();
        var resource = "LingWay:code:" + u.Id + ":" + purpose;
        await db.Database.ExecuteSqlInterpolatedAsync($"DECLARE @r int; EXEC @r=sys.sp_getapplock @Resource={resource}, @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=10000; IF @r<0 THROW 50001, 'Code is busy', 1;");
        var row=await db.ApplicationCodes.FindAsync(u.Id,purpose);
        if(row==null||row.ExpiresAt<DateTime.UtcNow||row.Tries>=5) throw new ArgumentException("Код истёк. Запросите новый");
        row.Tries++;await db.SaveChangesAsync();
        if(!CryptographicOperations.FixedTimeEquals(Convert.FromHexString(row.CodeHash),SHA256.HashData(Encoding.UTF8.GetBytes(code)))) {await transaction.CommitAsync();throw new ArgumentException("Неверный код");}
        db.ApplicationCodes.Remove(row);await db.SaveChangesAsync();await transaction.CommitAsync();
    }
}
