using System;
using System.Collections.Generic;

namespace LingWay.Web.Data.Entities;

public partial class Notification
{
    public long Id { get; set; }

    public Guid UserId { get; set; }

    public string Title { get; set; } = null!;

    public string Body { get; set; } = null!;

    public string? TargetUrl { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? ReadAt { get; set; }

    public virtual AspNetUser User { get; set; } = null!;
}
