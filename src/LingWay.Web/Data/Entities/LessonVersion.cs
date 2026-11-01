using System;
using System.Collections.Generic;

namespace LingWay.Web.Data.Entities;

public partial class LessonVersion
{
    public int LessonId { get; set; }

    public int Version { get; set; }

    public string StepsJson { get; set; } = null!;

    public string MetadataJson { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public virtual ICollection<Attempt> Attempts { get; set; } = new List<Attempt>();

    public virtual Lesson Lesson { get; set; } = null!;
}
