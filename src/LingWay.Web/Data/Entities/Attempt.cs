using System;
using System.Collections.Generic;

namespace LingWay.Web.Data.Entities;

public partial class Attempt
{
    public Guid Id { get; set; }
    public string? RequestHash { get; set; }

    public Guid UserId { get; set; }

    public int LessonId { get; set; }

    public int LessonVersion { get; set; }

    public decimal Score { get; set; }

    public byte Stars { get; set; }

    public bool IsPassed { get; set; }

    public int DurationSeconds { get; set; }

    public DateTime CompletedAt { get; set; }

    public DateTime ReceivedAt { get; set; }

    public string? LegacyAnswersJson { get; set; }

    public virtual ICollection<AttemptAnswer> AttemptAnswers { get; set; } = new List<AttemptAnswer>();

    public virtual LessonVersion LessonVersionNavigation { get; set; } = null!;

    public virtual AspNetUser User { get; set; } = null!;
}
