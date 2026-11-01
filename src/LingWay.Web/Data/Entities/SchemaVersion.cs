using System;
using System.Collections.Generic;

namespace LingWay.Web.Data.Entities;

public partial class SchemaVersion
{
    public int Version { get; set; }

    public DateTime AppliedAt { get; set; }

    public string Description { get; set; } = null!;
}
