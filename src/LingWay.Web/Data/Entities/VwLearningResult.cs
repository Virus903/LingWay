using System;
using System.Collections.Generic;

namespace LingWay.Web.Data.Entities;

public partial class VwLearningResult
{
    public Guid Id { get; set; }

    public string? StudentName { get; set; }

    public string? Email { get; set; }

    public string Lesson { get; set; } = null!;

    public string Module { get; set; } = null!;

    public int LessonVersion { get; set; }

    public decimal Score { get; set; }

    public byte Stars { get; set; }

    public bool IsPassed { get; set; }

    public int DurationSeconds { get; set; }

    public DateTime CompletedAt { get; set; }
}
