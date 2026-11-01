using System;
using System.Collections.Generic;

namespace LingWay.Web.Data.Entities;

public partial class ApplicationCode
{
    public Guid UserId { get; set; }

    public string Purpose { get; set; } = null!;

    public string CodeHash { get; set; } = null!;

    public DateTime ExpiresAt { get; set; }

    public int Tries { get; set; }

    public virtual AspNetUser User { get; set; } = null!;
}
