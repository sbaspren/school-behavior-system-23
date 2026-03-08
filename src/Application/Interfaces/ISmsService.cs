namespace SchoolBehaviorSystem.Application.Interfaces;

public interface ISmsService
{
    Task<SmsResult> SendSingleAsync(string apiToken, string senderName, string phone, string message);
    Task<SmsBulkResult> SendBulkAsync(string apiToken, string senderName, List<SmsRecipient> recipients, string messageTemplate);
    Task<SmsBalanceResult> CheckBalanceAsync(string apiToken);
}

public class SmsResult
{
    public bool Success { get; set; }
    public string? Error { get; set; }
}

public class SmsBulkResult
{
    public int SuccessCount { get; set; }
    public int FailedCount { get; set; }
    public List<SmsError> Errors { get; set; } = new();
    public string Message { get; set; } = "";
}

public class SmsError
{
    public string Name { get; set; } = "";
    public string Phone { get; set; } = "";
    public string Error { get; set; } = "";
}

public class SmsRecipient
{
    public string Name { get; set; } = "";
    public string Phone { get; set; } = "";
}

public class SmsBalanceResult
{
    public bool Success { get; set; }
    public object? Balance { get; set; }
    public string? Error { get; set; }
}
