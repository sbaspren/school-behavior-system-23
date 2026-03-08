using SchoolBehaviorSystem.Domain.Enums;

namespace SchoolBehaviorSystem.Domain.Entities;

public class CumulativeAbsence
{
    public int Id { get; set; }
    public int StudentId { get; set; }
    public string StudentNumber { get; set; } = "";
    public string StudentName { get; set; } = "";
    public string Grade { get; set; } = "";
    public string Class { get; set; } = "";
    public Stage Stage { get; set; }
    public int ExcusedDays { get; set; }                 // غياب بعذر
    public int UnexcusedDays { get; set; }               // غياب بدون عذر
    public int LateDays { get; set; }                    // تأخير
    public DateTime LastUpdated { get; set; } = DateTime.UtcNow;

    public Student Student { get; set; } = null!;
}
