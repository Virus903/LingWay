using System;
using System.Collections.Generic;

namespace LingWay.Web.Data.Entities;

public partial class StudyGroup
{
    public int Id { get; set; }

    public string Name { get; set; } = null!;

    public string JoinCode { get; set; } = null!;

    public Guid TeacherId { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual ICollection<Assignment> Assignments { get; set; } = new List<Assignment>();

    public virtual ICollection<GroupMember> GroupMembers { get; set; } = new List<GroupMember>();

    public virtual AspNetUser Teacher { get; set; } = null!;
}
