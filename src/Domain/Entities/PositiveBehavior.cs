using SchoolBehaviorSystem.Domain.Enums;

namespace SchoolBehaviorSystem.Domain.Entities;

public class PositiveBehavior
{
    public int Id { get; set; }
    public int StudentId { get; set; }
    public string StudentNumber { get; set; } = "";
    public string StudentName { get; set; } = "";
    public string Grade { get; set; } = "";
    public string Class { get; set; } = "";
    public Stage Stage { get; set; }
    public string BehaviorType { get; set; } = "";
    public string Degree { get; set; } = "";
    public string Details { get; set; } = "";
    public string HijriDate { get; set; } = "";
    public string RecordedBy { get; set; } = "";
    public DateTime RecordedAt { get; set; } = DateTime.UtcNow;
    public bool IsSent { get; set; }
    public string NoorStatus { get; set; } = "";         // حالة نور
    public int? LinkedViolationId { get; set; }           // ربط بمخالفة (للتعويض)

    public Student Student { get; set; } = null!;
    public Violation? LinkedViolation { get; set; }
}
