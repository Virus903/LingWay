using System;
using System.Collections.Generic;

namespace LingWay.Web.Data.Entities;

public partial class AspNetUser
{
    public Guid Id { get; set; }

    public string? UserName { get; set; }

    public string? NormalizedUserName { get; set; }

    public string? Email { get; set; }

    public string? NormalizedEmail { get; set; }

    public bool EmailConfirmed { get; set; }

    public string? PasswordHash { get; set; }

    public string? SecurityStamp { get; set; }

    public string? ConcurrencyStamp { get; set; }

    public string? PhoneNumber { get; set; }

    public bool PhoneNumberConfirmed { get; set; }

    public bool TwoFactorEnabled { get; set; }

    public DateTimeOffset? LockoutEnd { get; set; }

    public bool LockoutEnabled { get; set; }

    public int AccessFailedCount { get; set; }

    public int? LegacyId { get; set; }

    public string? LegacyDisplayName { get; set; }

    public virtual ICollection<ApplicationCode> ApplicationCodes { get; set; } = new List<ApplicationCode>();

    public virtual ICollection<AspNetUserClaim> AspNetUserClaims { get; set; } = new List<AspNetUserClaim>();

    public virtual ICollection<AspNetUserLogin> AspNetUserLogins { get; set; } = new List<AspNetUserLogin>();

    public virtual ICollection<AspNetUserToken> AspNetUserTokens { get; set; } = new List<AspNetUserToken>();

    public virtual ICollection<Attempt> Attempts { get; set; } = new List<Attempt>();

    public virtual ICollection<AuditEvent> AuditEvents { get; set; } = new List<AuditEvent>();

    public virtual ICollection<FavoritePhrase> FavoritePhrases { get; set; } = new List<FavoritePhrase>();

    public virtual ICollection<GroupMember> GroupMembers { get; set; } = new List<GroupMember>();

    public virtual ICollection<ImportBatch> ImportBatches { get; set; } = new List<ImportBatch>();

    public virtual LegacyPasswordCredential? LegacyPasswordCredential { get; set; }

    public virtual ICollection<MediaFile> MediaFiles { get; set; } = new List<MediaFile>();

    public virtual ICollection<Notification> Notifications { get; set; } = new List<Notification>();

    public virtual ICollection<PassportStamp> PassportStamps { get; set; } = new List<PassportStamp>();

    public virtual ICollection<PhraseReview> PhraseReviews { get; set; } = new List<PhraseReview>();

    public virtual ICollection<PushSubscription> PushSubscriptions { get; set; } = new List<PushSubscription>();

    public virtual ICollection<RecentPhrase> RecentPhrases { get; set; } = new List<RecentPhrase>();

    public virtual ICollection<StudyGroup> StudyGroups { get; set; } = new List<StudyGroup>();

    public virtual ICollection<UserAchievement> UserAchievements { get; set; } = new List<UserAchievement>();

    public virtual UserProfile? UserProfile { get; set; }

    public virtual ICollection<VocabularyItem> VocabularyItems { get; set; } = new List<VocabularyItem>();

    public virtual ICollection<AspNetRole> Roles { get; set; } = new List<AspNetRole>();
}
