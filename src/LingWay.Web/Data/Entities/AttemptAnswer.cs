using System;
using System.Collections.Generic;

namespace LingWay.Web.Data.Entities;

public partial class AttemptAnswer
{
    public Guid AttemptId { get; set; }

    public int SequenceNumber { get; set; }

    public int StepIndex { get; set; }

    public string Prompt { get; set; } = null!;

    public string ExpectedAnswer { get; set; } = null!;

    public string UserAnswer { get; set; } = null!;

    public string Status { get; set; } = null!;

    public byte HintLevel { get; set; }

    public string? ExerciseType { get; set; }

    public int? Tries { get; set; }

    public string? LegacyAnswerJson { get; set; }

    public virtual Attempt Attempt { get; set; } = null!;
}
