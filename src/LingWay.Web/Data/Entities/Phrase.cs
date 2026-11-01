using System;
using System.Collections.Generic;

namespace LingWay.Web.Data.Entities;

public partial class Phrase
{
    public int Id { get; set; }

    public string English { get; set; } = null!;

    public string Translation { get; set; } = null!;

    public string? Transcription { get; set; }

    public string Category { get; set; } = null!;

    public string? AudioPath { get; set; }

    public virtual ICollection<FavoritePhrase> FavoritePhrases { get; set; } = new List<FavoritePhrase>();

    public virtual ICollection<PhraseReview> PhraseReviews { get; set; } = new List<PhraseReview>();

    public virtual ICollection<RecentPhrase> RecentPhrases { get; set; } = new List<RecentPhrase>();

    public virtual ICollection<VocabularyItem> VocabularyItems { get; set; } = new List<VocabularyItem>();
}
