using System;
using System.Collections.Generic;

namespace LingWay.Web.Data.Entities;

public partial class LegacyPasswordCredential
{
    public Guid UserId { get; set; }

    public string Algorithm { get; set; } = null!;

    public string SaltHex { get; set; } = null!;

    public string HashHex { get; set; } = null!;

    public int WorkFactor { get; set; }

    public int BlockSize { get; set; }

    public int Parallelism { get; set; }

    public DateTime? MigratedToIdentityAt { get; set; }

    public virtual AspNetUser User { get; set; } = null!;
}
