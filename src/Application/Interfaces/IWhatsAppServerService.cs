namespace SchoolBehaviorSystem.Application.Interfaces;

public interface IWhatsAppServerService
{
    Task<WhatsAppServerStatus> GetStatusAsync(string serverUrl);
    Task<string?> GetQRCodeAsync(string serverUrl);
    Task<List<string>> GetConnectedSessionsAsync(string serverUrl);
    Task<bool> SendMessageAsync(string serverUrl, string senderPhone, string recipientPhone, string message);
    Task<bool> PingAsync(string serverUrl);
    Task<object> InspectQRAsync(string serverUrl);
}

public class WhatsAppServerStatus
{
    public bool IsOnline { get; set; }
    public List<ConnectedPhone> ConnectedPhones { get; set; } = new();
}

public class ConnectedPhone
{
    public string PhoneNumber { get; set; } = "";
    public bool IsConnected { get; set; }
}
