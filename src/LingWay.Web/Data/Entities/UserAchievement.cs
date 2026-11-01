using System;
using System.Collections.Generic;

namespace LingWay.Web.Data.Entities;

public partial class UserAchievement
{
    public Guid UserId { get; set; }

    public string AchievementCode { get; set; } = null!;

    public DateTime EarnedAt { get; set; }

    public virtual Achievement AchievementCodeNavigation { get; set; } = null!;

    public virtual AspNetUser User { get; set; } = null!;
}
