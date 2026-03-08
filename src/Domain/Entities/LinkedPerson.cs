namespace SchoolBehaviorSystem.Domain.Entities;

/// <summary>
/// بيانات الأشخاص المربوطين بالنظام — مطابق لشيت "روابط_المعلمين" في GAS
/// المصدر: Server_TeacherInput.gs saveLinkedPerson_() سطر 1865-1913
/// </summary>
public class LinkedPerson
{
    public int Id { get; set; }
    public string Phone { get; set; } = "";          // الجوال
    public string Name { get; set; } = "";           // الاسم
    public string Type { get; set; } = "teacher";    // النوع: teacher / admin
    public string Stage { get; set; } = "";          // المرحلة
    public string Classes { get; set; } = "";        // الفصول
    public string LinkedBy { get; set; } = "";       // تم الربط بواسطة
    public DateTime LinkedAt { get; set; } = DateTime.UtcNow;  // تاريخ الربط
}
