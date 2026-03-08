using SchoolBehaviorSystem.Domain.Enums;

namespace SchoolBehaviorSystem.Domain.Entities;

public class DailyAbsence
{
    public int Id { get; set; }
    public int StudentId { get; set; }
    public string StudentNumber { get; set; } = "";
    public string StudentName { get; set; } = "";
    public string Grade { get; set; } = "";
    public string Class { get; set; } = "";
    public Stage Stage { get; set; }
    public string Mobile { get; set; } = "";
    public AbsenceType AbsenceType { get; set; }        // يوم كامل / حصة
    public string Period { get; set; } = "";             // الحصة (إن كان غياب حصة)
    public string HijriDate { get; set; } = "";
    public string DayName { get; set; } = "";            // اسم اليوم
    public string RecordedBy { get; set; } = "";
    public DateTime RecordedAt { get; set; } = DateTime.UtcNow;
    public AbsenceStatus Status { get; set; } = AbsenceStatus.Pending;
    public ExcuseType ExcuseType { get; set; }
    public bool IsSent { get; set; }
    public string TardinessStatus { get; set; } = "";    // حالة التأخر
    public string ArrivalTime { get; set; } = "";        // وقت الحضور
    public string Notes { get; set; } = "";
    public string NoorStatus { get; set; } = "";         // حالة نور

    public Student Student { get; set; } = null!;
}
