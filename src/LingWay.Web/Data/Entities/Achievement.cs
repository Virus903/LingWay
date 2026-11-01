using System;
using System.Collections.Generic;

namespace LingWay.Web.Data.Entities;

public partial class Achievement
{
    public string Code { get; set; } = null!;

    public string Title { get; set; } = null!;

    public string Description { get; set; } = null!;

    public virtual ICollection<UserAchievement> UserAchievements { get; set; } = new List<UserAchievement>();
}
