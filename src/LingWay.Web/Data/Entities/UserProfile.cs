using System;
using System.Collections.Generic;

namespace LingWay.Web.Data.Entities;

public partial class UserProfile
{
    public Guid UserId { get; set; }

    public string FirstName { get; set; } = null!;

    public string LastName { get; set; } = null!;

    public string? AvatarPath { get; set; }

    public string? About { get; set; }

    public string? EnglishLevel { get; set; }

    public string? LearningGoal { get; set; }

    public string? Destination { get; set; }

    public DateOnly? TripDate { get; set; }

    public int DailyMinutes { get; set; }

    public string Theme { get; set; } = null!;

    public string Language { get; set; } = null!;

    public decimal SpeechRate { get; set; }

    public bool OnboardingCompleted { get; set; }

    public bool NotificationsEnabled { get; set; }

    public TimeOnly ReminderTime { get; set; }

    public TimeOnly QuietStart { get; set; }

    public TimeOnly QuietEnd { get; set; }

    public string TimeZoneId { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public byte[] RowVersion { get; set; } = null!;

    public string? LegacyProfileJson { get; set; }

    public string? AvatarDataUri { get; set; }

    public bool IsGuest { get; set; }

    public virtual AspNetUser User { get; set; } = null!;
}
