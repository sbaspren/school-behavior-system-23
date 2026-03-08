using SchoolBehaviorSystem.Domain.Enums;

namespace SchoolBehaviorSystem.Domain.Entities;

public class AcademicSummary
{
    public int Id { get; set; }
    public string IdentityNo { get; set; } = "";
    public string StudentName { get; set; } = "";
    public string Grade { get; set; } = "";
    public string ClassNum { get; set; } = "";
    public Stage Stage { get; set; }
    public string Semester { get; set; } = "";
    public string Period { get; set; } = "";
    public double? Average { get; set; }
    public string GeneralGrade { get; set; } = "";
    public string RankGrade { get; set; } = "";
    public string RankClass { get; set; } = "";
    public int Absence { get; set; }
    public int Tardiness { get; set; }
    public string BehaviorExcellent { get; set; } = "";
    public string BehaviorPositive { get; set; } = "";
    public DateTime ImportedAt { get; set; } = DateTime.UtcNow;
}
