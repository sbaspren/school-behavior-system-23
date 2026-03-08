namespace SchoolBehaviorSystem.Domain.Entities;

public class WhatsAppSettings
{
    public int Id { get; set; }
    public string ServerUrl { get; set; } = "";
    public string ServiceStatus { get; set; } = "مفعل"; // مفعل / معطل
    public string SmsApiToken { get; set; } = "";
    public string SmsSenderName { get; set; } = "School";

    // Security
    public string SecurityCode { get; set; } = "";           // 6+ digit PIN (hashed)
    public string RecoveryPhone1 { get; set; } = "";         // جوال الاسترجاع 1
    public string RecoveryPhone2 { get; set; } = "";         // جوال الاسترجاع 2
    public string TempRecoveryCode { get; set; } = "";       // 4-digit temp code
    public DateTime? RecoveryCodeExpiry { get; set; }        // Expiry (5 min)
}
