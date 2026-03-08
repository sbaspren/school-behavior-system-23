using SchoolBehaviorSystem.Domain.Enums;

namespace SchoolBehaviorSystem.Domain.Entities;

public class CommunicationLog
{
    public int Id { get; set; }
    public string HijriDate { get; set; } = "";
    public string MiladiDate { get; set; } = "";
    public string Time { get; set; } = "";
    public int StudentId { get; set; }
    public string StudentNumber { get; set; } = "";
    public string StudentName { get; set; } = "";
    public string Grade { get; set; } = "";
    public string Class { get; set; } = "";
    public Stage Stage { get; set; }
    public string Mobile { get; set; } = "";
    public string MessageType { get; set; } = "";        // واتساب / SMS / إيميل
    public string MessageTitle { get; set; } = "";
    public string MessageBody { get; set; } = "";
    public string SendStatus { get; set; } = "";         // تم / فشل
    public string SentBy { get; set; } = "";
    public string Notes { get; set; } = "";

    public Student Student { get; set; } = null!;
}
