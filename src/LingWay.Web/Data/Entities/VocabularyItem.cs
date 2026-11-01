using System;
using System.Collections.Generic;

namespace LingWay.Web.Data.Entities;

public partial class VocabularyItem
{
    public int Id { get; set; }

    public Guid UserId { get; set; }

    public string English { get; set; } = null!;

    public string Translation { get; set; } = null!;

    public string? Transcription { get; set; }

    public int? SourcePhraseId { get; set; }

    public DateTime DueAt { get; set; }

    public int ReviewStreak { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual Phrase? SourcePhrase { get; set; }

    public virtual AspNetUser User { get; set; } = null!;
}
