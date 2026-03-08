using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using SchoolBehaviorSystem.Application.Interfaces;

namespace SchoolBehaviorSystem.Infrastructure.ExternalServices;

public class SmsService : ISmsService
{
    private readonly HttpClient _http;
    private const string MadarSendEndpoint = "https://app.mobile.net.sa/api/v1/send";
    private const string MadarBalanceEndpoint = "https://app.mobile.net.sa/api/v1/account/balance";

    public SmsService(HttpClient http)
    {
        _http = http;
        _http.Timeout = TimeSpan.FromSeconds(30);
    }

    public async Task<SmsResult> SendSingleAsync(string apiToken, string senderName, string phone, string message)
    {
        if (string.IsNullOrEmpty(apiToken))
            return new SmsResult { Success = false, Error = "رمز SMS API غير مُعيّن" };

        var cleanPhone = CleanPhone(phone);
        if (string.IsNullOrEmpty(cleanPhone) || cleanPhone.Length < 9)
            return new SmsResult { Success = false, Error = "رقم الجوال غير صالح" };

        try
        {
            var payload = new
            {
                number = cleanPhone,
                senderName = senderName ?? "School",
                sendAtOption = "NOW",
                messageBody = message,
                allow_duplicate = false
            };

            var request = new HttpRequestMessage(HttpMethod.Post, MadarSendEndpoint)
            {
                Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
            };
            request.Headers.Add("Authorization", $"Bearer {apiToken}");
            request.Headers.Add("Accept", "application/json");

            var response = await _http.SendAsync(request);

            if (response.IsSuccessStatusCode)
                return new SmsResult { Success = true };

            var responseText = await response.Content.ReadAsStringAsync();
            return new SmsResult { Success = false, Error = $"خطأ API: {(int)response.StatusCode} - {responseText}" };
        }
        catch (Exception ex)
        {
            return new SmsResult { Success = false, Error = ex.Message };
        }
    }

    public async Task<SmsBulkResult> SendBulkAsync(string apiToken, string senderName, List<SmsRecipient> recipients, string messageTemplate)
    {
        var result = new SmsBulkResult();
        var date = DateTime.Now.ToString("d", new CultureInfo("ar-SA"));

        foreach (var recipient in recipients)
        {
            var message = messageTemplate
                .Replace("{student_name}", recipient.Name)
                .Replace("{اسم_الطالب}", recipient.Name)
                .Replace("{date}", date);

            var sendResult = await SendSingleAsync(apiToken, senderName, recipient.Phone, message);

            if (sendResult.Success)
                result.SuccessCount++;
            else
            {
                result.FailedCount++;
                result.Errors.Add(new SmsError { Name = recipient.Name, Phone = recipient.Phone, Error = sendResult.Error ?? "" });
            }

            // Delay between messages to avoid throttling
            await Task.Delay(100);
        }

        result.Message = $"تم إرسال {result.SuccessCount} رسالة بنجاح، فشل {result.FailedCount}";
        return result;
    }

    public async Task<SmsBalanceResult> CheckBalanceAsync(string apiToken)
    {
        if (string.IsNullOrEmpty(apiToken))
            return new SmsBalanceResult { Success = false, Error = "رمز SMS API غير مُعيّن" };

        try
        {
            var request = new HttpRequestMessage(HttpMethod.Get, MadarBalanceEndpoint);
            request.Headers.Add("Authorization", $"Bearer {apiToken}");
            request.Headers.Add("Accept", "application/json");

            var response = await _http.SendAsync(request);

            if (response.IsSuccessStatusCode)
            {
                var text = await response.Content.ReadAsStringAsync();
                var data = JsonSerializer.Deserialize<JsonElement>(text);
                return new SmsBalanceResult { Success = true, Balance = data };
            }

            return new SmsBalanceResult { Success = false, Error = "فشل جلب الرصيد" };
        }
        catch (Exception ex)
        {
            return new SmsBalanceResult { Success = false, Error = ex.Message };
        }
    }

    private static string CleanPhone(string phone)
    {
        var clean = Regex.Replace(phone ?? "", @"\D", "");
        if (clean.StartsWith("05"))
            clean = "966" + clean[1..];
        else if (clean.StartsWith("5") && clean.Length == 9)
            clean = "966" + clean;
        else if (!clean.StartsWith("966") && clean.Length == 9)
            clean = "966" + clean;
        return clean;
    }
}
