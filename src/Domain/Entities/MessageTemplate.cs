namespace SchoolBehaviorSystem.Domain.Entities;

/// <summary>
/// قالب رسالة — مطابق لـ msg_template_{type} في PropertiesService (Server_Templates.gs)
/// </summary>
public class MessageTemplate
{
    public int Id { get; set; }
    public string Type { get; set; } = "";       // نوع: مخالفة، تأخر، غياب، استئذان، ملاحظة
    public string Content { get; set; } = "";     // نص القالب
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
