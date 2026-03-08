using SchoolBehaviorSystem.Domain.Enums;

namespace SchoolBehaviorSystem.Domain.Entities;

public class User
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public UserRole Role { get; set; }
    public string Mobile { get; set; } = "";
    public string Email { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string Permissions { get; set; } = "";
    public string ScopeType { get; set; } = "all";     // all, stage, grade, class
    public string ScopeValue { get; set; } = "";
    public bool IsActive { get; set; } = true;
    public string TokenLink { get; set; } = "";
    public string LinkUrl { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
