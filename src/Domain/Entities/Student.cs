using SchoolBehaviorSystem.Domain.Enums;

namespace SchoolBehaviorSystem.Domain.Entities;

public class Student
{
    public int Id { get; set; }
    public string StudentNumber { get; set; } = "";     // رقم الطالب
    public string Name { get; set; } = "";              // اسم الطالب
    public Stage Stage { get; set; }                    // المرحلة
    public string Grade { get; set; } = "";             // الصف
    public string Class { get; set; } = "";             // الفصل
    public string Mobile { get; set; } = "";            // رقم الجوال (ولي الأمر)
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
