using System;
using System.Collections.Generic;

namespace LingWay.Web.Data.Entities;

public partial class FavoritePhrase
{
    public Guid UserId { get; set; }

    public int PhraseId { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual Phrase Phrase { get; set; } = null!;

    public virtual AspNetUser User { get; set; } = null!;
}
