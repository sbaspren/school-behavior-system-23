namespace SchoolBehaviorSystem.Domain.Entities;

public class Teacher
{
    public int Id { get; set; }
    public string CivilId { get; set; } = "";           // السجل المدني
    public string Name { get; set; } = "";
    public string Mobile { get; set; } = "";
    public string Subjects { get; set; } = "";           // المواد (comma-separated)
    public string AssignedClasses { get; set; } = "";    // الفصول المسندة
    public string Permissions { get; set; } = "";
    public bool IsActive { get; set; } = true;
    public string TokenLink { get; set; } = "";
    public string LinkUrl { get; set; } = "";
    public DateTime? ActivationDate { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
