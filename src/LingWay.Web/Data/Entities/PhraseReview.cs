using System;
using System.Collections.Generic;

namespace LingWay.Web.Data.Entities;

public partial class PhraseReview
{
    public Guid UserId { get; set; }

    public int PhraseId { get; set; }

    public int ReviewStreak { get; set; }

    public DateTime DueAt { get; set; }

    public virtual Phrase Phrase { get; set; } = null!;

    public virtual AspNetUser User { get; set; } = null!;
}
