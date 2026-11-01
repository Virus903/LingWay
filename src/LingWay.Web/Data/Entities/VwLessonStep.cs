using System;
using System.Collections.Generic;

namespace LingWay.Web.Data.Entities;

public partial class VwLessonStep
{
    public int LessonId { get; set; }

    public string Title { get; set; } = null!;

    public int Version { get; set; }

    public int? StepIndex { get; set; }

    public string? ExerciseType { get; set; }

    public string? Prompt { get; set; }

    public string? Translation { get; set; }

    public string? AcceptedAnswersJson { get; set; }

    public string? OptionsJson { get; set; }

    public string? HintsJson { get; set; }

    public string? RoutesJson { get; set; }

    public int? NextStepIndex { get; set; }
}
