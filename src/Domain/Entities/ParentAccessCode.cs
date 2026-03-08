using SchoolBehaviorSystem.Domain.Enums;

namespace SchoolBehaviorSystem.Domain.Entities;

public class ParentAccessCode
{
    public int Id { get; set; }
    public string Code { get; set; } = "";
    public string StudentNumber { get; set; } = "";
    public Stage Stage { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }
    public bool IsUsed { get; set; }
}
