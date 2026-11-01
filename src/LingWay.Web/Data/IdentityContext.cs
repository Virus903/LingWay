using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace LingWay.Web.Data;
public sealed class ApplicationUser : IdentityUser<Guid>
{
    public int? LegacyId { get; set; }
    public string? LegacyDisplayName { get; set; }
}
public sealed class IdentityContext(DbContextOptions<IdentityContext> options) : IdentityDbContext<ApplicationUser,IdentityRole<Guid>,Guid>(options)
{
    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.Entity<ApplicationUser>().Property(x=>x.LegacyDisplayName).HasMaxLength(200);
        builder.Entity<IdentityUserLogin<Guid>>().Property(x=>x.LoginProvider).HasMaxLength(128);
        builder.Entity<IdentityUserLogin<Guid>>().Property(x=>x.ProviderKey).HasMaxLength(128);
        builder.Entity<IdentityUserToken<Guid>>().Property(x=>x.LoginProvider).HasMaxLength(128);
        builder.Entity<IdentityUserToken<Guid>>().Property(x=>x.Name).HasMaxLength(128);
    }
}
