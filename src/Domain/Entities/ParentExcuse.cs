using SchoolBehaviorSystem.Domain.Enums;

namespace SchoolBehaviorSystem.Domain.Entities;

public class ParentExcuse
{
    public int Id { get; set; }
    public int StudentId { get; set; }
    public string StudentNumber { get; set; } = "";
    public string StudentName { get; set; } = "";
    public string Grade { get; set; } = "";
    public string Class { get; set; } = "";
    public Stage Stage { get; set; }
    public string ExcuseText { get; set; } = "";
    public string Attachments { get; set; } = "";
    public string AbsenceDate { get; set; } = "";
    public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;
    public string SubmittedTime { get; set; } = "";
    public string Status { get; set; } = "معلق";         // معلق / مقبول / مرفوض
    public string SchoolNotes { get; set; } = "";
    public string AccessCode { get; set; } = "";

    public Student Student { get; set; } = null!;
}
