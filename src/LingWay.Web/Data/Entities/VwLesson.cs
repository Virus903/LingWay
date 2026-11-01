using System;
using System.Collections.Generic;

namespace LingWay.Web.Data.Entities;

public partial class VwLesson
{
    public int Id { get; set; }

    public string Title { get; set; } = null!;

    public string Module { get; set; } = null!;

    public int ModuleId { get; set; }

    public string EnglishLevel { get; set; } = null!;

    public bool IsPublished { get; set; }

    public int CurrentVersion { get; set; }

    public int? TotalStepNodes { get; set; }

    public int? DialoguePaths { get; set; }

    public int? PassScore { get; set; }
}
