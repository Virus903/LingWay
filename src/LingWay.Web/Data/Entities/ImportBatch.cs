using System;
using System.Collections.Generic;

namespace LingWay.Web.Data.Entities;

public partial class ImportBatch
{
    public Guid Id { get; set; }

    public Guid? UserId { get; set; }

    public string Kind { get; set; } = null!;

    public int AddedCount { get; set; }

    public int ErrorCount { get; set; }

    public string ErrorsJson { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public virtual AspNetUser? User { get; set; }
}
