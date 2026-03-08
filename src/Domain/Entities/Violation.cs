using SchoolBehaviorSystem.Domain.Enums;

namespace SchoolBehaviorSystem.Domain.Entities;

public class Violation
{
    public int Id { get; set; }
    public int StudentId { get; set; }
    public string StudentNumber { get; set; } = "";
    public string StudentName { get; set; } = "";
    public string Grade { get; set; } = "";
    public string Class { get; set; } = "";
    public Stage Stage { get; set; }
    public string ViolationCode { get; set; } = "";     // رقم المخالفة
    public string Description { get; set; } = "";       // وصف المخالفة
    public ViolationType Type { get; set; }              // حضوري/رقمي/هيئة
    public ViolationDegree Degree { get; set; }
    public string HijriDate { get; set; } = "";
    public string MiladiDate { get; set; } = "";
    public int Deduction { get; set; }                   // الحسم
    public string Procedures { get; set; } = "";         // الإجراءات
    public string RecordedBy { get; set; } = "";         // المسجل
    public DateTime RecordedAt { get; set; } = DateTime.UtcNow;
    public bool IsSent { get; set; }                     // تم الإرسال
    public string Forms { get; set; } = "";                // النماذج المحفوظة
    public string DayName { get; set; } = "";              // اليوم (الأحد، الاثنين...)
    public string Notes { get; set; } = "";
    public string NoorStatus { get; set; } = "";           // حالة نور

    public Student Student { get; set; } = null!;
}
