using SchoolBehaviorSystem.Domain.Enums;

namespace SchoolBehaviorSystem.Domain.Entities;

public class TardinessRecord
{
    public int Id { get; set; }
    public int StudentId { get; set; }
    public string StudentNumber { get; set; } = "";
    public string StudentName { get; set; } = "";
    public string Grade { get; set; } = "";
    public string Class { get; set; } = "";
    public Stage Stage { get; set; }
    public string Mobile { get; set; } = "";
    public TardinessType TardinessType { get; set; }
    public string Period { get; set; } = "";             // الحصة
    public string HijriDate { get; set; } = "";
    public string RecordedBy { get; set; } = "";
    public DateTime RecordedAt { get; set; } = DateTime.UtcNow;
    public bool IsSent { get; set; }
    public string NoorStatus { get; set; } = "";         // حالة نور

    public Student Student { get; set; } = null!;
}
