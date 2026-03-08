using SchoolBehaviorSystem.Domain.Enums;

namespace SchoolBehaviorSystem.Domain.Entities;

public class PermissionRecord
{
    public int Id { get; set; }
    public int StudentId { get; set; }
    public string StudentNumber { get; set; } = "";
    public string StudentName { get; set; } = "";
    public string Grade { get; set; } = "";
    public string Class { get; set; } = "";
    public Stage Stage { get; set; }
    public string Mobile { get; set; } = "";
    public string ExitTime { get; set; } = "";           // وقت الخروج
    public string Reason { get; set; } = "";             // السبب
    public string Receiver { get; set; } = "";           // المستلم
    public string Supervisor { get; set; } = "";         // المسؤول
    public string HijriDate { get; set; } = "";
    public string RecordedBy { get; set; } = "";
    public DateTime RecordedAt { get; set; } = DateTime.UtcNow;
    public string ConfirmationTime { get; set; } = "";   // وقت التأكيد
    public bool IsSent { get; set; }

    public Student Student { get; set; } = null!;
}
