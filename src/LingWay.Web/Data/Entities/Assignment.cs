using System;
using System.Collections.Generic;

namespace LingWay.Web.Data.Entities;

public partial class Assignment
{
    public int Id { get; set; }

    public int GroupId { get; set; }

    public int ModuleId { get; set; }

    public Guid? StudentId { get; set; }

    public DateOnly? DueDate { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual StudyGroup Group { get; set; } = null!;

    public virtual Module Module { get; set; } = null!;
}
