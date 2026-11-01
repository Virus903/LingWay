using System;
using System.Collections.Generic;

namespace LingWay.Web.Data.Entities;

public partial class AuditEvent
{
    public long Id { get; set; }

    public Guid? UserId { get; set; }

    public string Action { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public int? LegacyId { get; set; }

    public virtual AspNetUser? User { get; set; }
}
