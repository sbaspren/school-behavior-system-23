using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SchoolBehaviorSystem.Application.DTOs.Responses;
using SchoolBehaviorSystem.Domain.Entities;
using SchoolBehaviorSystem.Domain.Enums;
using SchoolBehaviorSystem.Infrastructure.Data;

namespace SchoolBehaviorSystem.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class CommunicationController : ControllerBase
{
    private readonly AppDbContext _db;

    public CommunicationController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<object>>>> GetAll(
        [FromQuery] string? stage = null,
        [FromQuery] string? messageType = null,
        [FromQuery] string? status = null,
        [FromQuery] string? dateFrom = null,
        [FromQuery] string? dateTo = null,
        [FromQuery] string? search = null,
        [FromQuery] int? studentId = null)
    {
        var query = _db.CommunicationLogs.AsQueryable();

        if (!string.IsNullOrEmpty(stage) && Enum.TryParse<Stage>(stage, true, out var stageEnum))
            query = query.Where(r => r.Stage == stageEnum);
        if (!string.IsNullOrEmpty(messageType))
            query = query.Where(r => r.MessageType == messageType);
        if (!string.IsNullOrEmpty(status))
            query = query.Where(r => r.SendStatus == status);
        if (studentId.HasValue)
            query = query.Where(r => r.StudentId == studentId.Value);
        if (!string.IsNullOrEmpty(dateFrom))
            query = query.Where(r => string.Compare(r.MiladiDate, dateFrom) >= 0);
        if (!string.IsNullOrEmpty(dateTo))
            query = query.Where(r => string.Compare(r.MiladiDate, dateTo) <= 0);
        if (!string.IsNullOrEmpty(search))
            query = query.Where(r => r.StudentName.Contains(search) || r.StudentNumber.Contains(search) || r.Mobile.Contains(search));

        var records = await query
            .OrderByDescending(r => r.Id)
            .Take(500)
            .Select(r => new
            {
                r.Id, r.StudentId, r.StudentNumber, r.StudentName,
                r.Grade, className = r.Class,
                stage = r.Stage.ToString(),
                r.Mobile, r.MessageType, r.MessageTitle, r.MessageBody,
                r.SendStatus, r.SentBy, r.HijriDate, r.MiladiDate, r.Time, r.Notes
            })
            .ToListAsync();

        return Ok(ApiResponse<List<object>>.Ok(records.Cast<object>().ToList()));
    }

    [HttpGet("summary")]
    public async Task<ActionResult<ApiResponse<object>>> GetSummary(
        [FromQuery] string? stage = null)
    {
        var query = _db.CommunicationLogs.AsQueryable();
        if (!string.IsNullOrEmpty(stage) && Enum.TryParse<Stage>(stage, true, out var stageEnum))
            query = query.Where(r => r.Stage == stageEnum);

        var total = await query.CountAsync();
        var sent = await query.CountAsync(r => r.SendStatus == "\u062a\u0645"); // تم
        var failed = await query.CountAsync(r => r.SendStatus == "\u0641\u0634\u0644"); // فشل

        var todayStr = DateTime.Now.ToString("yyyy/MM/dd");
        var weekAgoStr = DateTime.Now.AddDays(-7).ToString("yyyy/MM/dd");
        var todayCount = await query.CountAsync(r => r.MiladiDate == todayStr);
        var weekCount = await query.CountAsync(r => string.Compare(r.MiladiDate, weekAgoStr) >= 0);

        var byType = await query
            .GroupBy(r => r.MessageType)
            .Select(g => new { type = g.Key, count = g.Count() })
            .ToListAsync();

        return Ok(ApiResponse<object>.Ok(new { total, sent, failed, todayCount, weekCount, byType }));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<object>>> LogCommunication([FromBody] LogCommunicationRequest request)
    {
        if (string.IsNullOrEmpty(request.Stage))
            return BadRequest(ApiResponse.Fail("\u0627\u0644\u0645\u0631\u062d\u0644\u0629 \u0627\u0644\u062f\u0631\u0627\u0633\u064a\u0629 \u0645\u0637\u0644\u0648\u0628\u0629")); // المرحلة الدراسية مطلوبة

        if (!Enum.TryParse<Stage>(request.Stage, true, out var stageEnum))
            return BadRequest(ApiResponse.Fail("\u0645\u0631\u062d\u0644\u0629 \u063a\u064a\u0631 \u0635\u0627\u0644\u062d\u0629")); // مرحلة غير صالحة

        var now = DateTime.Now;
        var hijriDate = "";
        try
        {
            var hijriCal = new System.Globalization.UmAlQuraCalendar();
            hijriDate = $"{hijriCal.GetYear(now)}/{hijriCal.GetMonth(now):D2}/{hijriCal.GetDayOfMonth(now):D2}";
        }
        catch { /* fallback empty */ }

        var log = new CommunicationLog
        {
            HijriDate = hijriDate,
            MiladiDate = now.ToString("yyyy/MM/dd"),
            Time = now.ToString("HH:mm"),
            StudentId = request.StudentId,
            StudentNumber = request.StudentNumber ?? "",
            StudentName = request.StudentName ?? "",
            Grade = request.Grade ?? "",
            Class = request.ClassName ?? "",
            Stage = stageEnum,
            Mobile = request.Phone ?? "",
            MessageType = request.MessageType ?? "",
            MessageTitle = request.MessageTitle ?? "",
            MessageBody = request.MessageContent ?? "",
            SendStatus = request.Status ?? "\u062c\u0627\u0631\u064a \u0627\u0644\u0625\u0631\u0633\u0627\u0644", // جاري الإرسال
            SentBy = request.Sender ?? "",
            Notes = request.Notes ?? "",
        };

        _db.CommunicationLogs.Add(log);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { logId = log.Id }));
    }

    [HttpPut("{id}/status")]
    public async Task<ActionResult<ApiResponse>> UpdateStatus(int id, [FromBody] UpdateStatusRequest request)
    {
        var record = await _db.CommunicationLogs.FindAsync(id);
        if (record == null)
            return NotFound(ApiResponse.Fail("\u0644\u0645 \u064a\u062a\u0645 \u0627\u0644\u0639\u062b\u0648\u0631 \u0639\u0644\u0649 \u0627\u0644\u0633\u062c\u0644")); // لم يتم العثور على السجل

        record.SendStatus = request.Status ?? record.SendStatus;
        if (!string.IsNullOrEmpty(request.Notes))
            record.Notes = request.Notes;

        await _db.SaveChangesAsync();
        return Ok(ApiResponse.Ok());
    }

    [HttpPut("{id}/mark-original-sent")]
    public async Task<ActionResult<ApiResponse>> MarkOriginalRecordSent(int id, [FromBody] MarkOriginalSentRequest request)
    {
        // تحديث حالة الإرسال في السجل الأصلي (مخالفة/غياب/تأخر)
        try
        {
            switch (request.Section?.ToLower())
            {
                case "violations":
                    var viol = await _db.Violations.FindAsync(request.OriginalRecordId);
                    if (viol != null) { viol.IsSent = true; await _db.SaveChangesAsync(); }
                    break;
                case "absence":
                    var abs = await _db.DailyAbsences.FindAsync(request.OriginalRecordId);
                    if (abs != null) { abs.IsSent = true; await _db.SaveChangesAsync(); }
                    break;
                case "tardiness":
                    var tard = await _db.TardinessRecords.FindAsync(request.OriginalRecordId);
                    if (tard != null) { tard.IsSent = true; await _db.SaveChangesAsync(); }
                    break;
                case "educational-notes":
                    var note = await _db.EducationalNotes.FindAsync(request.OriginalRecordId);
                    if (note != null) { note.IsSent = true; await _db.SaveChangesAsync(); }
                    break;
            }
            return Ok(ApiResponse.Ok());
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiResponse>> Delete(int id)
    {
        var record = await _db.CommunicationLogs.FindAsync(id);
        if (record == null)
            return NotFound(ApiResponse.Fail("\u0644\u0645 \u064a\u062a\u0645 \u0627\u0644\u0639\u062b\u0648\u0631 \u0639\u0644\u0649 \u0627\u0644\u0633\u062c\u0644")); // لم يتم العثور على السجل

        _db.CommunicationLogs.Remove(record);
        await _db.SaveChangesAsync();
        return Ok(ApiResponse.Ok());
    }

    [HttpGet("export")]
    public async Task<ActionResult<ApiResponse<List<object>>>> Export(
        [FromQuery] string? stage = null,
        [FromQuery] string? messageType = null,
        [FromQuery] string? status = null,
        [FromQuery] string? dateFrom = null,
        [FromQuery] string? dateTo = null)
    {
        var query = _db.CommunicationLogs.AsQueryable();
        if (!string.IsNullOrEmpty(stage) && Enum.TryParse<Stage>(stage, true, out var stageEnum))
            query = query.Where(r => r.Stage == stageEnum);
        if (!string.IsNullOrEmpty(messageType))
            query = query.Where(r => r.MessageType == messageType);
        if (!string.IsNullOrEmpty(status))
            query = query.Where(r => r.SendStatus == status);
        if (!string.IsNullOrEmpty(dateFrom))
            query = query.Where(r => string.Compare(r.MiladiDate, dateFrom) >= 0);
        if (!string.IsNullOrEmpty(dateTo))
            query = query.Where(r => string.Compare(r.MiladiDate, dateTo) <= 0);

        var records = await query
            .OrderByDescending(r => r.Id)
            .Select(r => new
            {
                r.HijriDate, r.Time, r.StudentName,
                gradeClass = r.Grade + "/" + r.Class,
                r.Mobile, r.MessageType, r.MessageTitle, r.MessageBody,
                r.SendStatus, r.SentBy
            })
            .ToListAsync();

        return Ok(ApiResponse<List<object>>.Ok(records.Cast<object>().ToList()));
    }

    // ===== WhatsApp Sessions =====

    [HttpGet("whatsapp/sessions")]
    public async Task<ActionResult<ApiResponse<List<object>>>> GetWhatsAppSessions()
    {
        var sessions = await _db.WhatsAppSessions
            .OrderByDescending(s => s.IsPrimary)
            .ThenByDescending(s => s.LastUsed)
            .Select(s => new
            {
                s.Id, s.PhoneNumber, s.Stage, s.UserType,
                s.ConnectionStatus, s.LinkedAt, s.LastUsed,
                s.MessageCount, s.IsPrimary
            })
            .ToListAsync();

        return Ok(ApiResponse<List<object>>.Ok(sessions.Cast<object>().ToList()));
    }

    [HttpPost("whatsapp/sessions")]
    public async Task<ActionResult<ApiResponse<object>>> AddWhatsAppSession([FromBody] AddSessionRequest request)
    {
        if (string.IsNullOrEmpty(request.PhoneNumber))
            return BadRequest(ApiResponse.Fail("\u0631\u0642\u0645 \u0627\u0644\u0648\u0627\u062a\u0633\u0627\u0628 \u0645\u0637\u0644\u0648\u0628")); // رقم الواتساب مطلوب

        var session = new WhatsAppSession
        {
            PhoneNumber = request.PhoneNumber,
            Stage = request.Stage ?? "",
            UserType = request.UserType ?? "",
            ConnectionStatus = "\u063a\u064a\u0631 \u0645\u062a\u0635\u0644", // غير متصل
            LinkedAt = DateTime.Now,
            IsPrimary = !await _db.WhatsAppSessions.AnyAsync(),
        };

        _db.WhatsAppSessions.Add(session);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { id = session.Id }));
    }

    [HttpPut("whatsapp/sessions/{id}/primary")]
    public async Task<ActionResult<ApiResponse>> SetPrimarySession(int id)
    {
        var session = await _db.WhatsAppSessions.FindAsync(id);
        if (session == null)
            return NotFound(ApiResponse.Fail("\u0627\u0644\u062c\u0644\u0633\u0629 \u063a\u064a\u0631 \u0645\u0648\u062c\u0648\u062f\u0629")); // الجلسة غير موجودة

        // Unset all primary flags
        var allSessions = await _db.WhatsAppSessions.ToListAsync();
        foreach (var s in allSessions) s.IsPrimary = false;
        session.IsPrimary = true;

        await _db.SaveChangesAsync();
        return Ok(ApiResponse.Ok());
    }

    [HttpDelete("whatsapp/sessions/{id}")]
    public async Task<ActionResult<ApiResponse>> DeleteWhatsAppSession(int id)
    {
        var session = await _db.WhatsAppSessions.FindAsync(id);
        if (session == null)
            return NotFound(ApiResponse.Fail("\u0627\u0644\u062c\u0644\u0633\u0629 \u063a\u064a\u0631 \u0645\u0648\u062c\u0648\u062f\u0629")); // الجلسة غير موجودة

        _db.WhatsAppSessions.Remove(session);
        await _db.SaveChangesAsync();
        return Ok(ApiResponse.Ok());
    }

    [HttpGet("whatsapp/stats")]
    public async Task<ActionResult<ApiResponse<object>>> GetWhatsAppStats()
    {
        var totalSessions = await _db.WhatsAppSessions.CountAsync();
        var connectedSessions = await _db.WhatsAppSessions.CountAsync(s => s.ConnectionStatus == "\u0645\u062a\u0635\u0644"); // متصل
        var totalMessages = await _db.WhatsAppSessions.SumAsync(s => s.MessageCount);

        return Ok(ApiResponse<object>.Ok(new { totalSessions, connectedSessions, totalMessages }));
    }
}

// ===== Request DTOs =====

public class LogCommunicationRequest
{
    public string? Stage { get; set; }
    public int StudentId { get; set; }
    public string? StudentNumber { get; set; }
    public string? StudentName { get; set; }
    public string? Grade { get; set; }
    public string? ClassName { get; set; }
    public string? Phone { get; set; }
    public string? MessageType { get; set; }
    public string? MessageTitle { get; set; }
    public string? MessageContent { get; set; }
    public string? Status { get; set; }
    public string? Sender { get; set; }
    public string? Notes { get; set; }
}

public class UpdateStatusRequest
{
    public string? Status { get; set; }
    public string? Notes { get; set; }
}

public class AddSessionRequest
{
    public string? PhoneNumber { get; set; }
    public string? Stage { get; set; }
    public string? UserType { get; set; }
}

public class MarkOriginalSentRequest
{
    public int OriginalRecordId { get; set; }
    public string? Section { get; set; } // violations, absence, tardiness, educational-notes
}
