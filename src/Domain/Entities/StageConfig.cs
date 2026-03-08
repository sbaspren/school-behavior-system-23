using SchoolBehaviorSystem.Domain.Enums;

namespace SchoolBehaviorSystem.Domain.Entities;

public class StageConfig
{
    public int Id { get; set; }
    public Stage Stage { get; set; }
    public bool IsEnabled { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<GradeConfig> Grades { get; set; } = new List<GradeConfig>();
}

public class GradeConfig
{
    public int Id { get; set; }
    public int StageConfigId { get; set; }
    public string GradeName { get; set; } = "";      // مثل: الأول، الثاني، الثالث
    public bool IsEnabled { get; set; }
    public int ClassCount { get; set; }               // عدد الفصول (1-15)
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public StageConfig StageConfig { get; set; } = null!;
}
