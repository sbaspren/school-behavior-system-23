using SchoolBehaviorSystem.Domain.Enums;

namespace SchoolBehaviorSystem.Domain.Entities;

public class EducationalNote
{
    public int Id { get; set; }
    public int StudentId { get; set; }
    public string StudentNumber { get; set; } = "";
    public string StudentName { get; set; } = "";
    public string Grade { get; set; } = "";
    public string Class { get; set; } = "";
    public Stage Stage { get; set; }
    public string Mobile { get; set; } = "";
    public string NoteType { get; set; } = "";           // إيجابية / سلبية / ملاحظة عامة
    public string Details { get; set; } = "";
    public string TeacherName { get; set; } = "";
    public string HijriDate { get; set; } = "";
    public DateTime RecordedAt { get; set; } = DateTime.UtcNow;
    public bool IsSent { get; set; }

    public Student Student { get; set; } = null!;
}
