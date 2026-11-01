using LingWay.Web.Data;
using LingWay.Web.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using System.Threading.RateLimiting;

var builder=WebApplication.CreateBuilder(args);
builder.WebHost.ConfigureKestrel(options=>options.AddServerHeader=false);
// Local application sessions end when the server is restarted.
var sessionGeneration=Guid.NewGuid().ToString("N");
builder.Configuration.AddJsonFile("appsettings.Local.json",optional:true,reloadOnChange:true);
builder.Configuration.AddUserSecrets<Program>(optional:true);
builder.Configuration.AddEnvironmentVariables();
var connection=builder.Configuration.GetConnectionString("LingWay")??throw new InvalidOperationException("ConnectionStrings:LingWay is missing");
builder.Services.AddDbContext<LingWayDbContext>(o=>o.UseSqlServer(connection));
builder.Services.AddDbContext<IdentityContext>(o=>o.UseSqlServer(connection));
builder.Services.AddIdentity<ApplicationUser,IdentityRole<Guid>>(o=>{
    o.Password.RequiredLength=8;o.Password.RequireDigit=false;o.Password.RequireLowercase=false;o.Password.RequireUppercase=false;o.Password.RequireNonAlphanumeric=false;
    o.User.RequireUniqueEmail=true;o.Lockout.MaxFailedAccessAttempts=5;o.Lockout.DefaultLockoutTimeSpan=TimeSpan.FromMinutes(5);
}).AddEntityFrameworkStores<IdentityContext>().AddDefaultTokenProviders();
builder.Services.ConfigureApplicationCookie(o=>{
    o.Cookie.Name="LingWay.Identity";o.Cookie.HttpOnly=true;o.Cookie.SameSite=SameSiteMode.Strict;
    o.Cookie.SecurePolicy=builder.Environment.IsDevelopment()?CookieSecurePolicy.SameAsRequest:CookieSecurePolicy.Always;
    o.ExpireTimeSpan=TimeSpan.FromDays(7);o.SlidingExpiration=true;
    o.Events.OnSigningIn=c=>{c.Properties.Items["server-generation"]=sessionGeneration;return Task.CompletedTask;};
    o.Events.OnValidatePrincipal=async c=>{
        if(!c.Properties.Items.TryGetValue("server-generation",out var generation)||generation!=sessionGeneration){
            c.RejectPrincipal();
            await c.HttpContext.SignOutAsync(IdentityConstants.ApplicationScheme);
            return;
        }
        await SecurityStampValidator.ValidatePrincipalAsync(c);
    };
    o.Events.OnRedirectToLogin=c=>{c.Response.StatusCode=401;return c.Response.WriteAsJsonAsync(new{error="Войдите в аккаунт"});};
    o.Events.OnRedirectToAccessDenied=c=>{c.Response.StatusCode=403;return c.Response.WriteAsJsonAsync(new{error="Недостаточно прав"});};
});
builder.Services.Configure<SecurityStampValidatorOptions>(o=>o.ValidationInterval=TimeSpan.Zero);
builder.Services.AddAntiforgery(o=>o.HeaderName="X-CSRF-Token");
builder.Services.AddControllersWithViews();
builder.Services.AddScoped<AccountService>();
builder.Services.AddScoped<MailService>();
builder.Services.AddSingleton<OfflinePackageService>();
builder.Services.AddScoped<LearningService>();
builder.Services.AddScoped<TransferService>();
builder.Services.AddScoped<TableService>();
builder.Services.AddSingleton<PushService>();
// Notifications are delivered to the site's inbox, not to the operating system.
builder.Services.AddRateLimiter(options=>{
    options.RejectionStatusCode=429;
    options.GlobalLimiter=PartitionedRateLimiter.Create<HttpContext,string>(context=>RateLimitPartition.GetFixedWindowLimiter(
        (context.Connection.RemoteIpAddress?.ToString()??"local")+(context.Request.Path.StartsWithSegments("/offline-assets")?":assets":new[]{"/api/login","/api/register","/api/code","/api/reset","/api/verify","/api/guest","/api/password","/api/delete-account"}.Contains(context.Request.Path.Value)?":auth":":other"),
        key=>new FixedWindowRateLimiterOptions { PermitLimit=key.EndsWith(":auth")?12:key.EndsWith(":assets")?2000:300,Window=TimeSpan.FromMinutes(1),QueueLimit=0 }));
    options.OnRejected=async(c,t)=>await c.HttpContext.Response.WriteAsJsonAsync(new{error="Слишком много запросов. Подождите минуту"},t);
});
var app=builder.Build();
if(!app.Environment.IsDevelopment()){app.UseHsts();app.UseHttpsRedirection();}
app.Use(async(context,next)=>{
    context.Response.Headers.XContentTypeOptions="nosniff";
    context.Response.Headers["X-Frame-Options"]="DENY";
    context.Response.Headers["Content-Security-Policy"]="frame-ancestors 'none'; object-src 'none'; base-uri 'self'";
    context.Response.Headers["Referrer-Policy"]="same-origin";
    context.Response.Headers["Permissions-Policy"]="camera=(), geolocation=(), microphone=(self)";
    if(context.Request.Path.StartsWithSegments("/api")) context.Response.Headers.CacheControl="no-store";
    try { await next(); }
    catch(SubmissionConflictException ex) {
        context.Response.StatusCode=409;await context.Response.WriteAsJsonAsync(new{error=ex.Message});
    }
    catch(Exception ex) when(ex is ArgumentException or FormatException or System.Text.Json.JsonException or InvalidOperationException or DbUpdateException or UnauthorizedAccessException or AntiforgeryValidationException) {
        if(context.Response.HasStarted) throw;
        context.Response.StatusCode=ex is UnauthorizedAccessException or AntiforgeryValidationException?403:400;
        var message=ex is DbUpdateException?"Не удалось сохранить: проверьте связанные данные и дубликаты":ex is AntiforgeryValidationException?"Обновите страницу и повторите запрос":ex is InvalidOperationException?"Операция недоступна. Обновите страницу и повторите":ex.Message;
        if(ex is DbUpdateException) app.Logger.LogWarning(ex,"Database write failed");
        await context.Response.WriteAsJsonAsync(new{error=message});
    }
    catch(Exception ex) {
        app.Logger.LogError(ex,"Unhandled request error");if(context.Response.HasStarted) throw;
        context.Response.StatusCode=500;await context.Response.WriteAsJsonAsync(new{error="Ошибка сервера. Подробности в журнале приложения"});
    }
});
app.UseStaticFiles();app.UseRouting();app.UseRateLimiter();app.UseAuthentication();app.UseAuthorization();
app.MapControllers();
app.MapControllerRoute("default","{controller=Home}/{action=Index}/{id?}");
app.MapControllerRoute("shell","index.html",new{controller="Home",action="Index"});
app.Run();
public partial class Program;
