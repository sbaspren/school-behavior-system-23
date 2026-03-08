using SchoolBehaviorSystem.Domain.Enums;

namespace SchoolBehaviorSystem.Domain.Entities;

public class ViolationTypeDef
{
    public int Id { get; set; }
    public string Code { get; set; } = "";               // رقم المخالفة (101, 201, 301...)
    public string Description { get; set; } = "";        // وصف المخالفة
    public string Category { get; set; } = "";           // سلوكية / تعليمية
    public ViolationDegree Degree { get; set; }
    public ViolationDegree? DegreeForPrimary { get; set; }  // درجة مختلفة لمرحلة ابتدائي
}
