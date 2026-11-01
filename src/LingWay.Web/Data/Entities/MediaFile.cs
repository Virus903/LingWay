using System;
using System.Collections.Generic;

namespace LingWay.Web.Data.Entities;

public partial class MediaFile
{
    public Guid Id { get; set; }

    public Guid? UploadedBy { get; set; }

    public string StoragePath { get; set; } = null!;

    public string OriginalName { get; set; } = null!;

    public string ContentType { get; set; } = null!;

    public long SizeBytes { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual AspNetUser? UploadedByNavigation { get; set; }
}
