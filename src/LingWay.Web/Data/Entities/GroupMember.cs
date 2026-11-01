using System;
using System.Collections.Generic;

namespace LingWay.Web.Data.Entities;

public partial class GroupMember
{
    public int GroupId { get; set; }

    public Guid UserId { get; set; }

    public DateTime JoinedAt { get; set; }

    public virtual StudyGroup Group { get; set; } = null!;

    public virtual AspNetUser User { get; set; } = null!;
}
