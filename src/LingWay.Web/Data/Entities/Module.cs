using System;
using System.Collections.Generic;

namespace LingWay.Web.Data.Entities;

public partial class Module
{
    public int Id { get; set; }

    public string Title { get; set; } = null!;

    public string Description { get; set; } = null!;

    public int SortOrder { get; set; }

    public bool IsEmergency { get; set; }

    public bool IsPublished { get; set; }

    public virtual ICollection<Assignment> Assignments { get; set; } = new List<Assignment>();

    public virtual ICollection<Lesson> Lessons { get; set; } = new List<Lesson>();

    public virtual ICollection<PassportStamp> PassportStamps { get; set; } = new List<PassportStamp>();
}
