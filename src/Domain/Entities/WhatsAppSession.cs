namespace SchoolBehaviorSystem.Domain.Entities;

public class WhatsAppSession
{
    public int Id { get; set; }
    public string PhoneNumber { get; set; } = "";
    public string Stage { get; set; } = "";
    public string UserType { get; set; } = "";
    public string ConnectionStatus { get; set; } = "";
    public DateTime? LinkedAt { get; set; }
    public DateTime? LastUsed { get; set; }
    public int MessageCount { get; set; }
    public bool IsPrimary { get; set; }
}
