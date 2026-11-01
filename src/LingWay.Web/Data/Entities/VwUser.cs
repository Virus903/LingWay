using System;
using System.Collections.Generic;

namespace LingWay.Web.Data.Entities;

public partial class VwUser
{
    public int? PrototypeUserId { get; set; }

    public Guid Id { get; set; }

    public string? DisplayName { get; set; }

    public string FirstName { get; set; } = null!;

    public string LastName { get; set; } = null!;

    public string? Email { get; set; }

    public string? Role { get; set; }

    public bool EmailConfirmed { get; set; }

    public string? EnglishLevel { get; set; }

    public int DailyMinutes { get; set; }

    public string? Destination { get; set; }

    public DateOnly? TripDate { get; set; }

    public bool? HasAvatar { get; set; }
}
