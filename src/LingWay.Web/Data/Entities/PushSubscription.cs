using System;
using System.Collections.Generic;

namespace LingWay.Web.Data.Entities;

public partial class PushSubscription
{
    public long Id { get; set; }

    public Guid UserId { get; set; }

    public string Endpoint { get; set; } = null!;

    public byte[] EndpointHash { get; set; } = null!;

    public string P256dh { get; set; } = null!;

    public string Auth { get; set; } = null!;

    public DateTime? LastSentAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual AspNetUser User { get; set; } = null!;
}
