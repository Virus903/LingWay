using System;
using System.Collections.Generic;

namespace LingWay.Web.Data.Entities;

public partial class ContentPackage
{
    public int Id { get; set; }

    public string ContentJson { get; set; } = null!;

    public long SizeBytes { get; set; }

    public string Sha256 { get; set; } = null!;

    public DateTime PublishedAt { get; set; }

    public string? LegacyPayloadJson { get; set; }
}
