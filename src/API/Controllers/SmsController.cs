using Microsoft.AspNetCore.Authorization;
using System.Globalization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SchoolBehaviorSystem.Application.DTOs.Responses;
using SchoolBehaviorSystem.Application.Interfaces;
using SchoolBehaviorSystem.Infrastructure.Data;

namespace SchoolBehaviorSystem.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class SmsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ISmsService _sms;

    public SmsController(AppDbContext db, ISmsService sms)
    {
        _db = db;
        _sms = sms;
    }

    private async Task<(string token, string sender)> GetSmsConfigAsync()
    {
        var settings = await _db.WhatsAppSettings.FirstOrDefaultAsync();
        return (settings?.SmsApiToken ?? "", settings?.SmsSenderName ?? "School");
    }

    [HttpPost("send")]
    public async Task<ActionResult<ApiResponse<object>>> SendSingle([FromBody] SmsSendRequest request)
    {
        if (string.IsNullOrEmpty(request.Phone))
            return BadRequest(ApiResponse<object>.Fail("\u0631\u0642\u0645 \u0627\u0644\u062c\u0648\u0627\u0644 \u0645\u0637\u0644\u0648\u0628"));
        if (string.IsNullOrEmpty(request.Message))
            return BadRequest(ApiResponse<object>.Fail("\u0646\u0635 \u0627\u0644\u0631\u0633\u0627\u0644\u0629 \u0645\u0637\u0644\u0648\u0628"));

        var (token, sender) = await GetSmsConfigAsync();
        var result = await _sms.SendSingleAsync(token, sender, request.Phone, request.Message);

        return Ok(ApiResponse<object>.Ok(new { result.Success, result.Error }));
    }

    [HttpPost("send-bulk")]
    public async Task<ActionResult<ApiResponse<object>>> SendBulk([FromBody] SmsBulkRequest request)
    {
        if (request.Recipients == null || request.Recipients.Count == 0)
            return BadRequest(ApiResponse<object>.Fail("\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0645\u0633\u062a\u0642\u0628\u0644\u064a\u0646 \u0641\u0627\u0631\u063a\u0629"));
        if (string.IsNullOrEmpty(request.MessageTemplate))
            return BadRequest(ApiResponse<object>.Fail("\u0642\u0627\u0644\u0628 \u0627\u0644\u0631\u0633\u0627\u0644\u0629 \u0645\u0637\u0644\u0648\u0628"));

        var (token, sender) = await GetSmsConfigAsync();
        var recipients = request.Recipients.Select(r => new SmsRecipient { Name = r.Name ?? "", Phone = r.Phone ?? "" }).ToList();
        var result = await _sms.SendBulkAsync(token, sender, recipients, request.MessageTemplate);

        return Ok(ApiResponse<object>.Ok(new
        {
            result.SuccessCount, result.FailedCount, result.Message,
            errors = result.Errors.Select(e => new { e.Name, e.Phone, e.Error })
        }));
    }

    [HttpGet("balance")]
    public async Task<ActionResult<ApiResponse<object>>> CheckBalance()
    {
        var (token, _) = await GetSmsConfigAsync();
        var result = await _sms.CheckBalanceAsync(token);

        return Ok(ApiResponse<object>.Ok(new { result.Success, result.Balance, result.Error }));
    }

    [HttpGet("templates")]
    public async Task<ActionResult<ApiResponse<object>>> GetTemplates()
    {
        var schoolName = "";
        var school = await _db.SchoolSettings.FirstOrDefaultAsync();
        if (school != null) schoolName = school.SchoolName;
        if (string.IsNullOrEmpty(schoolName)) schoolName = "\u0627\u0644\u0645\u062f\u0631\u0633\u0629";

        var templates = new Dictionary<string, string>
        {
            ["تأخر"] = $"المكرم ولي الامر نود إبلاغكم بتأخر ابنكم {{student_name}} عن الحضور إلى المدرسة لهذا اليوم بتاريخ {{date}}\n{schoolName}",
            ["استئذان"] = $"المكرم ولي الامر نود إبلاغكم باستئذان ابنكم {{student_name}} للخروج من المدرسة لهذا اليوم بتاريخ {{date}}\n{schoolName}",
        };

        return Ok(ApiResponse<object>.Ok(templates));
    }

    // createSMSMessage — تركيب رسالة من قالب + اسم الطالب
    [HttpPost("compose")]
    public async Task<ActionResult<ApiResponse<object>>> ComposeMessage([FromBody] SmsComposeRequest request)
    {
        var schoolName = "";
        var school = await _db.SchoolSettings.FirstOrDefaultAsync();
        if (school != null) schoolName = school.SchoolName;
        if (string.IsNullOrEmpty(schoolName)) schoolName = "المدرسة";

        var templates = new Dictionary<string, string>
        {
            ["تأخر"] = $"المكرم ولي الامر نود إبلاغكم بتأخر ابنكم {{student_name}} عن الحضور إلى المدرسة لهذا اليوم بتاريخ {{date}}\n{schoolName}",
            ["استئذان"] = $"المكرم ولي الامر نود إبلاغكم باستئذان ابنكم {{student_name}} للخروج من المدرسة لهذا اليوم بتاريخ {{date}}\n{schoolName}",
        };

        var type = request.Type ?? "تأخر";
        var template = templates.GetValueOrDefault(type, templates["تأخر"]);
        var date = DateTime.Now.ToString("d", new CultureInfo("ar-SA"));

        var message = template
            .Replace("{student_name}", request.StudentName ?? "")
            .Replace("{اسم_الطالب}", request.StudentName ?? "")
            .Replace("{date}", date);

        return Ok(ApiResponse<object>.Ok(new { message }));
    }

    [HttpGet("test-connection")]
    public async Task<ActionResult<ApiResponse<object>>> TestConnection()
    {
        var (token, sender) = await GetSmsConfigAsync();

        if (string.IsNullOrEmpty(token))
            return Ok(ApiResponse<object>.Ok(new { success = false, message = "\u0631\u0645\u0632 SMS API \u063a\u064a\u0631 \u0645\u064f\u0639\u064a\u0651\u0646" }));

        return Ok(ApiResponse<object>.Ok(new
        {
            success = true,
            message = "\u0627\u0644\u0625\u0639\u062f\u0627\u062f\u0627\u062a \u0635\u062d\u064a\u062d\u0629",
            senderName = sender,
        }));
    }
}

// ===== Request DTOs =====

public class SmsSendRequest
{
    public string? Phone { get; set; }
    public string? Message { get; set; }
}

public class SmsBulkRequest
{
    public List<SmsBulkRecipient>? Recipients { get; set; }
    public string? MessageTemplate { get; set; }
}

public class SmsBulkRecipient
{
    public string? Name { get; set; }
    public string? Phone { get; set; }
}

public class SmsComposeRequest
{
    public string? Type { get; set; }
    public string? StudentName { get; set; }
}
