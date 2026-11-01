using System;
using System.Collections.Generic;

namespace LingWay.Web.Data.Entities;

public partial class PassportStamp
{
    public Guid UserId { get; set; }

    public int ModuleId { get; set; }

    public DateTime EarnedAt { get; set; }

    public virtual Module Module { get; set; } = null!;

    public virtual AspNetUser User { get; set; } = null!;
}
