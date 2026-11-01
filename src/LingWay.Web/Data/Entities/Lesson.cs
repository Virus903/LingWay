using System;
using System.Collections.Generic;

namespace LingWay.Web.Data.Entities;

public partial class Lesson
{
    public int Id { get; set; }

    public int ModuleId { get; set; }

    public string Title { get; set; } = null!;

    public string Description { get; set; } = null!;

    public string EnglishLevel { get; set; } = null!;

    public int SortOrder { get; set; }

    public bool IsPublished { get; set; }

    public byte[] RowVersion { get; set; } = null!;

    public virtual ICollection<LessonVersion> LessonVersions { get; set; } = new List<LessonVersion>();

    public virtual Module Module { get; set; } = null!;
}
