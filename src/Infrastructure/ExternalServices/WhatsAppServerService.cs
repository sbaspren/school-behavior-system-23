using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using SchoolBehaviorSystem.Application.Interfaces;

namespace SchoolBehaviorSystem.Infrastructure.ExternalServices;

public class WhatsAppServerService : IWhatsAppServerService
{
    private readonly HttpClient _http;

    public WhatsAppServerService(HttpClient http)
    {
        _http = http;
        _http.Timeout = TimeSpan.FromSeconds(15);
    }

    public async Task<WhatsAppServerStatus> GetStatusAsync(string serverUrl)
    {
        var status = new WhatsAppServerStatus();
        if (string.IsNullOrEmpty(serverUrl)) return status;

        try
        {
            var response = await _http.GetAsync($"{serverUrl.TrimEnd('/')}/sessions");
            if (!response.IsSuccessStatusCode)
            {
                status.IsOnline = false;
                return status;
            }

            status.IsOnline = true;
            var content = await response.Content.ReadAsStringAsync();

            // Try JSON first
            try
            {
                var sessions = JsonSerializer.Deserialize<List<JsonElement>>(content);
                if (sessions != null)
                {
                    foreach (var s in sessions)
                    {
                        var phone = s.TryGetProperty("phone", out var p) ? p.GetString() ?? "" :
                                    s.TryGetProperty("id", out var id) ? id.GetString() ?? "" : "";
                        if (!string.IsNullOrEmpty(phone))
                        {
                            status.ConnectedPhones.Add(new ConnectedPhone
                            {
                                PhoneNumber = CleanPhone(phone),
                                IsConnected = true
                            });
                        }
                    }
                }
            }
            catch
            {
                // Fallback: parse HTML for phone numbers
                var matches = Regex.Matches(content, @"(\d{10,15})");
                foreach (Match m in matches)
                {
                    status.ConnectedPhones.Add(new ConnectedPhone
                    {
                        PhoneNumber = CleanPhone(m.Value),
                        IsConnected = true
                    });
                }
            }
        }
        catch
        {
            status.IsOnline = false;
        }

        return status;
    }

    public async Task<string?> GetQRCodeAsync(string serverUrl)
    {
        if (string.IsNullOrEmpty(serverUrl)) return null;

        try
        {
            var response = await _http.GetAsync($"{serverUrl.TrimEnd('/')}/qr");
            if (!response.IsSuccessStatusCode) return null;

            var contentType = response.Content.Headers.ContentType?.MediaType ?? "";

            // If image, return as base64
            if (contentType.StartsWith("image/"))
            {
                var bytes = await response.Content.ReadAsByteArrayAsync();
                return $"data:{contentType};base64,{Convert.ToBase64String(bytes)}";
            }

            // If JSON with base64
            var text = await response.Content.ReadAsStringAsync();
            try
            {
                var json = JsonSerializer.Deserialize<JsonElement>(text);
                if (json.TryGetProperty("qr", out var qr))
                    return qr.GetString();
                if (json.TryGetProperty("data", out var data))
                    return data.GetString();
            }
            catch
            {
                // If raw base64 or data URL
                if (text.StartsWith("data:image") || text.Length > 100)
                    return text.Trim();
            }
        }
        catch { /* server unreachable */ }

        return null;
    }

    public async Task<List<string>> GetConnectedSessionsAsync(string serverUrl)
    {
        if (string.IsNullOrEmpty(serverUrl)) return new();

        try
        {
            var status = await GetStatusAsync(serverUrl);
            return status.ConnectedPhones.Select(p => p.PhoneNumber).ToList();
        }
        catch
        {
            return new();
        }
    }

    public async Task<bool> SendMessageAsync(string serverUrl, string senderPhone, string recipientPhone, string message)
    {
        if (string.IsNullOrEmpty(serverUrl)) return false;

        try
        {
            var payload = new
            {
                sender = CleanPhone(senderPhone),
                phone = CleanPhone(recipientPhone),
                message
            };

            var json = JsonSerializer.Serialize(payload);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await _http.PostAsync($"{serverUrl.TrimEnd('/')}/send-message", content);
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    public async Task<bool> PingAsync(string serverUrl)
    {
        if (string.IsNullOrEmpty(serverUrl)) return false;

        try
        {
            var response = await _http.GetAsync(serverUrl.TrimEnd('/'));
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    // مطابق لـ cleanPhoneNumber في Server_WhatsApp.gs سطر 1063-1073
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
