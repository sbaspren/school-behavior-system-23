using SchoolBehaviorSystem.Domain.Enums;

namespace SchoolBehaviorSystem.Domain.Entities;

public class AcademicGrade
{
    public int Id { get; set; }
    public string IdentityNo { get; set; } = "";
    public string StudentName { get; set; } = "";
    public string Grade { get; set; } = "";
    public string ClassNum { get; set; } = "";
    public Stage Stage { get; set; }
    public string Semester { get; set; } = "";
    public string Period { get; set; } = "";
    public string Subject { get; set; } = "";
    public double Total { get; set; }
    public double FinalExam { get; set; }
    public double EvalTools { get; set; }
    public double ShortTests { get; set; }
    public string GradeLabel { get; set; } = "";
    public DateTime ImportedAt { get; set; } = DateTime.UtcNow;
}
