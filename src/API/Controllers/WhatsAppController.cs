using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SchoolBehaviorSystem.Application.DTOs.Responses;
using SchoolBehaviorSystem.Application.Interfaces;
using SchoolBehaviorSystem.Domain.Entities;
using SchoolBehaviorSystem.Domain.Enums;
using SchoolBehaviorSystem.Infrastructure.Data;

namespace SchoolBehaviorSystem.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class WhatsAppController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IWhatsAppServerService _waServer;

    public WhatsAppController(AppDbContext db, IWhatsAppServerService waServer)
    {
        _db = db;
        _waServer = waServer;
    }

    // ===== Settings =====

    [HttpGet("settings")]
    public async Task<ActionResult<ApiResponse<object>>> GetSettings()
    {
        var settings = await _db.WhatsAppSettings.FirstOrDefaultAsync();
        var schoolSettings = await _db.SchoolSettings.FirstOrDefaultAsync();

        return Ok(ApiResponse<object>.Ok(new
        {
            serverUrl = settings?.ServerUrl ?? "",
            serviceStatus = settings?.ServiceStatus ?? "\u0645\u0641\u0639\u0644",
            smsApiToken = !string.IsNullOrEmpty(settings?.SmsApiToken) ? "***configured***" : "",
            smsSenderName = settings?.SmsSenderName ?? "School",
            whatsAppMode = schoolSettings?.WhatsAppMode.ToString() ?? "PerStage",
        }));
    }

    [HttpPost("settings")]
    public async Task<ActionResult<ApiResponse>> SaveSettings([FromBody] WhatsAppSettingsRequest request)
    {
        var settings = await _db.WhatsAppSettings.FirstOrDefaultAsync();
        if (settings == null)
        {
            settings = new WhatsAppSettings();
            _db.WhatsAppSettings.Add(settings);
        }

        if (request.ServerUrl != null) settings.ServerUrl = request.ServerUrl;
        if (request.ServiceStatus != null) settings.ServiceStatus = request.ServiceStatus;
        if (request.SmsApiToken != null) settings.SmsApiToken = request.SmsApiToken;
        if (request.SmsSenderName != null) settings.SmsSenderName = request.SmsSenderName;

        // Update WhatsAppMode in school settings
        if (!string.IsNullOrEmpty(request.WhatsAppMode))
        {
            var school = await _db.SchoolSettings.FirstOrDefaultAsync();
            if (school != null && Enum.TryParse<WhatsAppMode>(request.WhatsAppMode, true, out var mode))
                school.WhatsAppMode = mode;
        }

        await _db.SaveChangesAsync();
        return Ok(ApiResponse.Ok("\u062a\u0645 \u0627\u0644\u062d\u0641\u0638")); // تم الحفظ
    }

    // ===== Server Status =====

    [HttpGet("status")]
    public async Task<ActionResult<ApiResponse<object>>> GetStatus([FromQuery] string? stage = null)
    {
        var settings = await _db.WhatsAppSettings.FirstOrDefaultAsync();
        var schoolSettings = await _db.SchoolSettings.FirstOrDefaultAsync();
        var serverUrl = settings?.ServerUrl ?? "";

        var needSetup = string.IsNullOrEmpty(settings?.SecurityCode);
        var whatsAppMode = schoolSettings?.WhatsAppMode.ToString() ?? "PerStage";

        // effectiveStage: في وضع Unified، المرحلة لا تؤثر
        var effectiveStage = whatsAppMode == "Unified" ? "" : (stage ?? "");

        if (string.IsNullOrEmpty(serverUrl))
            return Ok(ApiResponse<object>.Ok(new
            {
                isOnline = false, needSetup, whatsAppMode, effectiveStage,
                error = "رابط السيرفر غير مُعيّن"
            }));

        var status = await _waServer.GetStatusAsync(serverUrl);

        // جلب جلسات المرحلة أو الكل
        var sessionsQ = _db.WhatsAppSessions.AsQueryable();
        if (!string.IsNullOrEmpty(effectiveStage))
            sessionsQ = sessionsQ.Where(s => s.Stage == effectiveStage);

        var savedSessions = await sessionsQ.ToListAsync();
        var hasPrimary = savedSessions.Any(s => s.IsPrimary);

        return Ok(ApiResponse<object>.Ok(new
        {
            status.IsOnline, needSetup, whatsAppMode, effectiveStage, hasPrimary,
            connectedPhones = status.ConnectedPhones.Select(p => new { p.PhoneNumber, p.IsConnected }),
            allSessions = savedSessions.Select(s => new
            {
                s.Id, s.PhoneNumber, s.Stage, s.UserType,
                s.ConnectionStatus, s.IsPrimary, s.MessageCount
            }),
        }));
    }

    [HttpPost("ping")]
    public async Task<ActionResult<ApiResponse<object>>> Ping()
    {
        var settings = await _db.WhatsAppSettings.FirstOrDefaultAsync();
        var serverUrl = settings?.ServerUrl ?? "";
        var isOnline = await _waServer.PingAsync(serverUrl);
        return Ok(ApiResponse<object>.Ok(new { isOnline }));
    }

    // ===== QR Code =====

    [HttpGet("qr")]
    public async Task<ActionResult<ApiResponse<object>>> GetQRCode()
    {
        var settings = await _db.WhatsAppSettings.FirstOrDefaultAsync();
        var serverUrl = settings?.ServerUrl ?? "";

        if (string.IsNullOrEmpty(serverUrl))
            return BadRequest(ApiResponse<object>.Fail("\u0631\u0627\u0628\u0637 \u0627\u0644\u0633\u064a\u0631\u0641\u0631 \u063a\u064a\u0631 \u0645\u064f\u0639\u064a\u0651\u0646")); // رابط السيرفر غير مُعيّن

        var qr = await _waServer.GetQRCodeAsync(serverUrl);

        if (qr == null)
            return Ok(ApiResponse<object>.Ok(new { hasQR = false }));

        return Ok(ApiResponse<object>.Ok(new { hasQR = true, qrData = qr }));
    }

    // ===== Connected Sessions from Server =====

    [HttpGet("connected-sessions")]
    public async Task<ActionResult<ApiResponse<object>>> GetConnectedSessions()
    {
        var settings = await _db.WhatsAppSettings.FirstOrDefaultAsync();
        var serverUrl = settings?.ServerUrl ?? "";

        var sessions = await _waServer.GetConnectedSessionsAsync(serverUrl);

        // Cross-reference with saved sessions
        var savedSessions = await _db.WhatsAppSessions.ToListAsync();
        var result = sessions.Select(phone =>
        {
            var saved = savedSessions.FirstOrDefault(s => s.PhoneNumber == phone);
            return new
            {
                phoneNumber = phone,
                isSaved = saved != null,
                stage = saved?.Stage ?? "",
                userType = saved?.UserType ?? "",
                isPrimary = saved?.IsPrimary ?? false,
            };
        }).ToList();

        return Ok(ApiResponse<object>.Ok(new { phones = result }));
    }

    // ===== Send Message =====

    [HttpPost("send")]
    public async Task<ActionResult<ApiResponse<object>>> SendMessage([FromBody] SendWhatsAppRequest request)
    {
        if (string.IsNullOrEmpty(request.RecipientPhone))
            return BadRequest(ApiResponse<object>.Fail("\u0631\u0642\u0645 \u0627\u0644\u0645\u0633\u062a\u0642\u0628\u0644 \u0645\u0637\u0644\u0648\u0628")); // رقم المستقبل مطلوب
        if (string.IsNullOrEmpty(request.Message))
            return BadRequest(ApiResponse<object>.Fail("\u0646\u0635 \u0627\u0644\u0631\u0633\u0627\u0644\u0629 \u0645\u0637\u0644\u0648\u0628")); // نص الرسالة مطلوب

        var settings = await _db.WhatsAppSettings.FirstOrDefaultAsync();
        var serverUrl = settings?.ServerUrl ?? "";

        if (string.IsNullOrEmpty(serverUrl))
            return BadRequest(ApiResponse<object>.Fail("\u0631\u0627\u0628\u0637 \u0627\u0644\u0633\u064a\u0631\u0641\u0631 \u063a\u064a\u0631 \u0645\u064f\u0639\u064a\u0651\u0646")); // رابط السيرفر غير مُعيّن

        // Get sender phone: use specified or primary for stage
        var senderPhone = request.SenderPhone;
        if (string.IsNullOrEmpty(senderPhone) && !string.IsNullOrEmpty(request.Stage))
        {
            var primary = await _db.WhatsAppSessions
                .Where(s => s.Stage == request.Stage && s.IsPrimary)
                .FirstOrDefaultAsync();
            senderPhone = primary?.PhoneNumber;
        }
        if (string.IsNullOrEmpty(senderPhone))
        {
            var anyPrimary = await _db.WhatsAppSessions
                .Where(s => s.IsPrimary)
                .FirstOrDefaultAsync();
            senderPhone = anyPrimary?.PhoneNumber;
        }

        if (string.IsNullOrEmpty(senderPhone))
            return BadRequest(ApiResponse<object>.Fail("\u0644\u0627 \u064a\u0648\u062c\u062f \u0631\u0642\u0645 \u0645\u0631\u0633\u0644 \u0645\u062d\u062f\u062f")); // لا يوجد رقم مرسل محدد

        var success = await _waServer.SendMessageAsync(serverUrl, senderPhone, request.RecipientPhone, request.Message);

        if (success)
        {
            // Increment message count
            var session = await _db.WhatsAppSessions
                .FirstOrDefaultAsync(s => s.PhoneNumber == senderPhone);
            if (session != null)
            {
                session.MessageCount++;
                session.LastUsed = DateTime.Now;
                await _db.SaveChangesAsync();
            }
        }

        return Ok(ApiResponse<object>.Ok(new { success }));
    }

    // ===== Send + Log (sendWhatsAppWithLog equivalent) =====

    [HttpPost("send-with-log")]
    public async Task<ActionResult<ApiResponse<object>>> SendWithLog([FromBody] SendWithLogRequest request)
    {
        if (string.IsNullOrEmpty(request.Phone))
            return BadRequest(ApiResponse<object>.Fail("\u0631\u0642\u0645 \u0627\u0644\u062c\u0648\u0627\u0644 \u0645\u0637\u0644\u0648\u0628")); // رقم الجوال مطلوب

        var settings = await _db.WhatsAppSettings.FirstOrDefaultAsync();
        var serverUrl = settings?.ServerUrl ?? "";

        // Determine stage enum
        Stage? stageEnum = null;
        if (!string.IsNullOrEmpty(request.Stage) && Enum.TryParse<Stage>(request.Stage, true, out var parsed))
            stageEnum = parsed;

        // Get sender phone
        string? senderPhone = null;
        if (!string.IsNullOrEmpty(request.Stage))
        {
            var primary = await _db.WhatsAppSessions
                .Where(s => s.Stage == request.Stage && s.IsPrimary)
                .FirstOrDefaultAsync();
            senderPhone = primary?.PhoneNumber;
        }
        if (string.IsNullOrEmpty(senderPhone))
        {
            var anyPrimary = await _db.WhatsAppSessions.Where(s => s.IsPrimary).FirstOrDefaultAsync();
            senderPhone = anyPrimary?.PhoneNumber;
        }

        // Try to send
        var sendSuccess = false;
        var sendStatus = "\u0641\u0634\u0644"; // فشل
        var notes = "";

        if (!string.IsNullOrEmpty(serverUrl) && !string.IsNullOrEmpty(senderPhone))
        {
            sendSuccess = await _waServer.SendMessageAsync(serverUrl, senderPhone, request.Phone, request.Message ?? "");
            sendStatus = sendSuccess ? "\u062a\u0645" : "\u0641\u0634\u0644"; // تم / فشل

            if (sendSuccess)
            {
                var session = await _db.WhatsAppSessions.FirstOrDefaultAsync(s => s.PhoneNumber == senderPhone);
                if (session != null)
                {
                    session.MessageCount++;
                    session.LastUsed = DateTime.Now;
                }
            }
        }
        else
        {
            notes = string.IsNullOrEmpty(serverUrl) ? "\u0631\u0627\u0628\u0637 \u0627\u0644\u0633\u064a\u0631\u0641\u0631 \u063a\u064a\u0631 \u0645\u064f\u0639\u064a\u0651\u0646" : "\u0644\u0627 \u064a\u0648\u062c\u062f \u0631\u0642\u0645 \u0645\u0631\u0633\u0644";
        }

        // Log to communication
        var now = DateTime.Now;
        var hijriDate = "";
        try
        {
            var hijriCal = new System.Globalization.UmAlQuraCalendar();
            hijriDate = $"{hijriCal.GetYear(now)}/{hijriCal.GetMonth(now):D2}/{hijriCal.GetDayOfMonth(now):D2}";
        }
        catch { /* fallback */ }

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
            Stage = stageEnum ?? Stage.Intermediate,
            Mobile = request.Phone ?? "",
            MessageType = request.MessageType ?? "\u0648\u0627\u062a\u0633\u0627\u0628", // واتساب
            MessageTitle = request.MessageTitle ?? "",
            MessageBody = request.Message ?? "",
            SendStatus = sendStatus,
            SentBy = request.Sender ?? "",
            Notes = notes,
        };

        _db.CommunicationLogs.Add(log);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new
        {
            success = sendSuccess,
            logId = log.Id,
            status = sendStatus,
        }));
    }

    // ===== Sessions Management =====

    [HttpGet("sessions")]
    public async Task<ActionResult<ApiResponse<List<object>>>> GetSessions(
        [FromQuery] string? stage = null, [FromQuery] string? userType = null)
    {
        var query = _db.WhatsAppSessions.AsQueryable();
        if (!string.IsNullOrEmpty(stage))
            query = query.Where(s => s.Stage == stage);
        if (!string.IsNullOrEmpty(userType))
            query = query.Where(s => s.UserType == userType);

        var sessions = await query
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

    [HttpPost("sessions")]
    public async Task<ActionResult<ApiResponse<object>>> AddSession([FromBody] AddSessionRequest request)
    {
        if (string.IsNullOrEmpty(request.PhoneNumber))
            return BadRequest(ApiResponse.Fail("\u0631\u0642\u0645 \u0627\u0644\u0648\u0627\u062a\u0633\u0627\u0628 \u0645\u0637\u0644\u0648\u0628")); // رقم الواتساب مطلوب

        // Check for duplicate
        var exists = await _db.WhatsAppSessions.AnyAsync(s =>
            s.PhoneNumber == request.PhoneNumber && s.Stage == (request.Stage ?? "") && s.UserType == (request.UserType ?? ""));
        if (exists)
            return BadRequest(ApiResponse.Fail("\u0647\u0630\u0627 \u0627\u0644\u0631\u0642\u0645 \u0645\u0633\u062c\u0644 \u0645\u0633\u0628\u0642\u0627\u064b")); // هذا الرقم مسجل مسبقاً

        // Clear primary for this stage if setting as primary
        var sessionsForStage = await _db.WhatsAppSessions
            .Where(s => s.Stage == (request.Stage ?? ""))
            .ToListAsync();
        foreach (var s in sessionsForStage) s.IsPrimary = false;

        var session = new WhatsAppSession
        {
            PhoneNumber = request.PhoneNumber,
            Stage = request.Stage ?? "",
            UserType = request.UserType ?? "",
            ConnectionStatus = "\u063a\u064a\u0631 \u0645\u062a\u0635\u0644", // غير متصل
            LinkedAt = DateTime.Now,
            IsPrimary = true, // New phone is always set as primary (matches old behavior)
        };

        _db.WhatsAppSessions.Add(session);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { id = session.Id }));
    }

    [HttpPut("sessions/{id}/primary")]
    public async Task<ActionResult<ApiResponse>> SetPrimary(int id)
    {
        var session = await _db.WhatsAppSessions.FindAsync(id);
        if (session == null)
            return NotFound(ApiResponse.Fail("\u0627\u0644\u062c\u0644\u0633\u0629 \u063a\u064a\u0631 \u0645\u0648\u062c\u0648\u062f\u0629")); // الجلسة غير موجودة

        // Clear all primary in same stage
        var sameStageSessions = await _db.WhatsAppSessions
            .Where(s => s.Stage == session.Stage)
            .ToListAsync();
        foreach (var s in sameStageSessions) s.IsPrimary = false;
        session.IsPrimary = true;

        await _db.SaveChangesAsync();
        return Ok(ApiResponse.Ok());
    }

    [HttpDelete("sessions/{id}")]
    public async Task<ActionResult<ApiResponse>> DeleteSession(int id)
    {
        var session = await _db.WhatsAppSessions.FindAsync(id);
        if (session == null)
            return NotFound(ApiResponse.Fail("\u0627\u0644\u062c\u0644\u0633\u0629 \u063a\u064a\u0631 \u0645\u0648\u062c\u0648\u062f\u0629")); // الجلسة غير موجودة

        _db.WhatsAppSessions.Remove(session);
        await _db.SaveChangesAsync();
        return Ok(ApiResponse.Ok());
    }

    [HttpGet("stats")]
    public async Task<ActionResult<ApiResponse<object>>> GetStats([FromQuery] string? stage = null)
    {
        var query = _db.WhatsAppSessions.AsQueryable();
        if (!string.IsNullOrEmpty(stage))
            query = query.Where(s => s.Stage == stage);

        var sessions = await query.ToListAsync();
        var total = sessions.Count;
        var connected = sessions.Count(s => s.ConnectionStatus == "متصل");
        var totalMessages = sessions.Sum(s => s.MessageCount);

        return Ok(ApiResponse<object>.Ok(new
        {
            total, connected, totalMessages,
            sessions = sessions.Select(s => new
            {
                s.Id, s.PhoneNumber, s.Stage, s.UserType,
                s.ConnectionStatus, s.IsPrimary, s.MessageCount, s.LastUsed
            })
        }));
    }

    [HttpGet("user-types")]
    public ActionResult<ApiResponse<List<string>>> GetUserTypes()
    {
        return Ok(ApiResponse<List<string>>.Ok(new List<string> { "وكيل", "مدير", "موجه" }));
    }

    // ===== getPrimaryPhoneForStage — الرقم الرئيسي لمرحلة معينة =====
    // مطابق لـ getPrimaryPhoneForStage() في Server_WhatsApp.gs سطر 453–476

    [HttpGet("sessions/primary")]
    public async Task<ActionResult<ApiResponse<object>>> GetPrimaryForStage([FromQuery] string? stage = null)
    {
        var schoolSettings = await _db.SchoolSettings.FirstOrDefaultAsync();
        var whatsAppMode = schoolSettings?.WhatsAppMode.ToString() ?? "PerStage";
        var effectiveStage = whatsAppMode == "Unified" ? "" : (stage ?? "");

        var primary = await _db.WhatsAppSessions
            .Where(s => s.IsPrimary &&
                   (string.IsNullOrEmpty(effectiveStage) || s.Stage == effectiveStage))
            .FirstOrDefaultAsync();

        if (primary == null)
            return Ok(ApiResponse<object>.Ok(new { found = false }));

        return Ok(ApiResponse<object>.Ok(new
        {
            found        = true,
            id           = primary.Id,
            phoneNumber  = primary.PhoneNumber,
            stage        = primary.Stage,
            userType     = primary.UserType,
            connectionStatus = primary.ConnectionStatus,
            isPrimary    = true,
        }));
    }

    // ===== updatePhoneStatus — تحديث حالة جلسة =====
    // مطابق لـ updatePhoneStatus() في Server_WhatsApp.gs سطر 503–519

    [HttpPut("sessions/{id}/status")]
    public async Task<ActionResult<ApiResponse>> UpdateSessionStatus(int id, [FromBody] UpdateStatusRequest request)
    {
        var session = await _db.WhatsAppSessions.FindAsync(id);
        if (session == null)
            return NotFound(ApiResponse.Fail("الجلسة غير موجودة"));

        session.ConnectionStatus = request.Status ?? "غير متصل";
        session.LastUsed = DateTime.Now;
        await _db.SaveChangesAsync();
        return Ok(ApiResponse.Ok("تم تحديث الحالة"));
    }

    // ===== rebuildSessionsSheet — إعادة بناء الجلسات =====
    // مطابق لـ rebuildSessionsSheet() في Server_WhatsApp.gs سطر 136–151

    [HttpPost("sessions/rebuild")]
    public async Task<ActionResult<ApiResponse>> RebuildSessions()
    {
        var all = await _db.WhatsAppSessions.ToListAsync();
        _db.WhatsAppSessions.RemoveRange(all);
        await _db.SaveChangesAsync();
        return Ok(ApiResponse.Ok("تم إعادة بناء الجلسات بنجاح"));
    }

    // ===== checkPhoneStatusInServer — فحص رقم معين في السيرفر =====
    // مطابق لـ checkPhoneStatusInServer() في Server_WhatsApp.gs سطر 671–685

    [HttpGet("sessions/check-server")]
    public async Task<ActionResult<ApiResponse<object>>> CheckPhoneOnServer([FromQuery] string phone)
    {
        if (string.IsNullOrEmpty(phone))
            return BadRequest(ApiResponse<object>.Fail("رقم الجوال مطلوب"));

        var settings = await _db.WhatsAppSettings.FirstOrDefaultAsync();
        var serverUrl = settings?.ServerUrl ?? "";
        if (string.IsNullOrEmpty(serverUrl))
            return Ok(ApiResponse<object>.Ok(new { connected = false, error = "رابط السيرفر غير مُعيّن" }));

        var serverPhones = await _waServer.GetConnectedSessionsAsync(serverUrl);
        var cleanPhone   = CleanPhoneNumber(phone);
        var found        = serverPhones.FirstOrDefault(p =>
            CleanPhoneNumber(p) == cleanPhone || p.Contains(cleanPhone));

        return Ok(ApiResponse<object>.Ok(new { connected = found != null, phoneNumber = found }));
    }

    // ===== getConnectedSessionsByStage — الأرقام المتصلة حسب المرحلة =====
    // مطابق لـ getConnectedSessionsByStage() في Server_WhatsApp.gs سطر 705–745

    [HttpGet("connected-sessions/by-stage")]
    public async Task<ActionResult<ApiResponse<object>>> GetConnectedByStage([FromQuery] string? stage = null)
    {
        var settings      = await _db.WhatsAppSettings.FirstOrDefaultAsync();
        var serverUrl     = settings?.ServerUrl ?? "";
        var schoolSettings = await _db.SchoolSettings.FirstOrDefaultAsync();
        var whatsAppMode  = schoolSettings?.WhatsAppMode.ToString() ?? "PerStage";
        var effectiveStage = whatsAppMode == "Unified" ? "" : (stage ?? "");

        // جلب الأرقام المتصلة من السيرفر
        var serverPhones = new List<string>();
        if (!string.IsNullOrEmpty(serverUrl))
            serverPhones = await _waServer.GetConnectedSessionsAsync(serverUrl);

        // جلب الجلسات المحفوظة للمرحلة
        var query = _db.WhatsAppSessions.AsQueryable();
        if (!string.IsNullOrEmpty(effectiveStage))
            query = query.Where(s => s.Stage == effectiveStage);
        var saved = await query.ToListAsync();

        var allSessions = saved.Select(s => new
        {
            s.Id, s.PhoneNumber, s.Stage, s.UserType,
            s.IsPrimary, s.MessageCount,
            isConnected      = serverPhones.Contains(s.PhoneNumber),
            connectionStatus = serverPhones.Contains(s.PhoneNumber) ? "متصل" : "غير متصل",
        }).ToList();

        var connectedSessions = allSessions.Where(s => s.isConnected).ToList<object>();

        return Ok(ApiResponse<object>.Ok(new
        {
            allSessions      = allSessions.Cast<object>().ToList(),
            connectedSessions,
            stage            = effectiveStage,
            whatsAppMode,
        }));
    }

    // ===== inspectQREndpoint — تشخيص صفحة QR من السيرفر =====
    // مطابق لـ inspectQREndpoint() في Server_WhatsApp.gs سطر 601–663

    [HttpGet("qr/inspect")]
    public async Task<ActionResult<ApiResponse<object>>> InspectQR()
    {
        var settings  = await _db.WhatsAppSettings.FirstOrDefaultAsync();
        var serverUrl = settings?.ServerUrl ?? "";
        if (string.IsNullOrEmpty(serverUrl))
            return Ok(ApiResponse<object>.Ok(new { success = false, error = "رابط السيرفر غير مُعيّن" }));

        var result = await _waServer.InspectQRAsync(serverUrl);
        return Ok(ApiResponse<object>.Ok(result));
    }

    // ===== syncAndSavePhone — مزامنة رقم من السيرفر وحفظه =====
    // مطابق لـ syncAndSavePhone() في Server_WhatsApp.gs سطر 894–910
    // + منطق saveWhatsAppPhone() في Server_WhatsApp.gs سطر 370–420

    [HttpPost("sessions/sync")]
    public async Task<ActionResult<ApiResponse<object>>> SyncAndSave([FromBody] SyncSaveRequest request)
    {
        if (string.IsNullOrEmpty(request.PhoneNumber))
            return BadRequest(ApiResponse<object>.Fail("رقم الواتساب مطلوب"));

        var settings       = await _db.WhatsAppSettings.FirstOrDefaultAsync();
        var serverUrl      = settings?.ServerUrl ?? "";
        var schoolSettings = await _db.SchoolSettings.FirstOrDefaultAsync();
        var whatsAppMode   = schoolSettings?.WhatsAppMode.ToString() ?? "PerStage";
        var effectiveStage = whatsAppMode == "Unified" ? "" : (request.Stage ?? "");
        var cleanPhone     = CleanPhoneNumber(request.PhoneNumber);

        // التحقق من أن الرقم متصل في السيرفر
        if (!string.IsNullOrEmpty(serverUrl))
        {
            var serverPhones = await _waServer.GetConnectedSessionsAsync(serverUrl);
            var foundOnServer = serverPhones.Any(p => CleanPhoneNumber(p) == cleanPhone);
            if (!foundOnServer)
                return Ok(ApiResponse<object>.Ok(new
                {
                    success = false,
                    error   = "الرقم غير متصل في السيرفر"
                }));
        }

        // إزالة علامة رئيسي من جميع أرقام المرحلة
        var stageSessions = await _db.WhatsAppSessions
            .Where(s => s.Stage == effectiveStage)
            .ToListAsync();
        foreach (var s in stageSessions) s.IsPrimary = false;

        // هل الرقم موجود مسبقاً؟
        var existing = stageSessions.FirstOrDefault(s =>
            s.PhoneNumber == cleanPhone &&
            s.UserType    == (request.UserType ?? "وكيل"));

        if (existing != null)
        {
            existing.ConnectionStatus = "متصل";
            existing.IsPrimary        = true;
            existing.LastUsed         = DateTime.Now;
        }
        else
        {
            _db.WhatsAppSessions.Add(new WhatsAppSession
            {
                PhoneNumber      = cleanPhone,
                Stage            = effectiveStage,
                UserType         = request.UserType ?? "وكيل",
                ConnectionStatus = "متصل",
                LinkedAt         = DateTime.Now,
                LastUsed         = DateTime.Now,
                IsPrimary        = true,
            });
        }

        await _db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(new
        {
            success     = true,
            message     = "تم حفظ الرقم كرقم رئيسي",
            phoneNumber = cleanPhone,
            isPrimary   = true,
        }));
    }

    // ===== مساعد: تنظيف رقم الجوال =====
    // مطابق لـ cleanPhoneNumber() في Server_WhatsApp.gs سطر 1063–1073
    private static string CleanPhoneNumber(string phone)
    {
        var clean = new string(phone.Where(char.IsDigit).ToArray());
        if (clean.StartsWith("05"))               clean = "966" + clean[1..];
        else if (clean.StartsWith("5") && clean.Length == 9) clean = "966" + clean;
        else if (!clean.StartsWith("966") && clean.Length == 9) clean = "966" + clean;
        return clean;
    }

    private static string? MaskPhone(string? phone)
    public async Task<ActionResult<ApiResponse<object>>> GetSecurityStatus()
    {
        var settings = await _db.WhatsAppSettings.FirstOrDefaultAsync();
        return Ok(ApiResponse<object>.Ok(new
        {
            hasSecurityCode = !string.IsNullOrEmpty(settings?.SecurityCode),
            hasRecoveryPhone1 = !string.IsNullOrEmpty(settings?.RecoveryPhone1),
            hasRecoveryPhone2 = !string.IsNullOrEmpty(settings?.RecoveryPhone2),
            recoveryPhone1Masked = MaskPhone(settings?.RecoveryPhone1),
            recoveryPhone2Masked = MaskPhone(settings?.RecoveryPhone2),
        }));
    }

    [HttpPost("security/setup")]
    public async Task<ActionResult<ApiResponse>> SetupSecurityCode([FromBody] SecuritySetupRequest request)
    {
        if (string.IsNullOrEmpty(request.Code) || request.Code.Length < 6)
            return Ok(ApiResponse.Fail("رمز الأمان يجب أن يكون 6 أرقام على الأقل"));
        if (string.IsNullOrEmpty(request.RecoveryPhone1))
            return Ok(ApiResponse.Fail("جوال الاسترجاع الأول مطلوب"));

        var settings = await _db.WhatsAppSettings.FirstOrDefaultAsync();
        if (settings == null)
        {
            settings = new WhatsAppSettings();
            _db.WhatsAppSettings.Add(settings);
        }

        settings.SecurityCode = BCrypt.Net.BCrypt.HashPassword(request.Code);
        settings.RecoveryPhone1 = request.RecoveryPhone1;
        settings.RecoveryPhone2 = request.RecoveryPhone2 ?? "";

        await _db.SaveChangesAsync();
        return Ok(ApiResponse.Ok("تم تعيين رمز الأمان بنجاح"));
    }

    [HttpPost("security/verify")]
    public async Task<ActionResult<ApiResponse<object>>> VerifySecurityCode([FromBody] SecurityVerifyRequest request)
    {
        var settings = await _db.WhatsAppSettings.FirstOrDefaultAsync();
        if (settings == null || string.IsNullOrEmpty(settings.SecurityCode))
            return Ok(ApiResponse<object>.Ok(new { valid = true })); // No code set = open

        var valid = BCrypt.Net.BCrypt.Verify(request.Code ?? "", settings.SecurityCode);
        return Ok(ApiResponse<object>.Ok(new { valid }));
    }

    [HttpPost("security/request-recovery")]
    public async Task<ActionResult<ApiResponse<object>>> RequestRecoveryCode([FromBody] RecoveryRequest request)
    {
        var settings = await _db.WhatsAppSettings.FirstOrDefaultAsync();
        if (settings == null || string.IsNullOrEmpty(settings.SecurityCode))
            return Ok(ApiResponse.Fail("لا يوجد رمز أمان محدد"));

        var targetPhone = request.PhoneIndex == 2 ? settings.RecoveryPhone2 : settings.RecoveryPhone1;
        if (string.IsNullOrEmpty(targetPhone))
            return Ok(ApiResponse.Fail("جوال الاسترجاع غير محدد"));

        // Generate 4-digit code
        var code = new Random().Next(1000, 9999).ToString();
        settings.TempRecoveryCode = code;
        settings.RecoveryCodeExpiry = DateTime.UtcNow.AddMinutes(5);
        await _db.SaveChangesAsync();

        // Send via WhatsApp
        var serverUrl = settings.ServerUrl ?? "";
        if (!string.IsNullOrEmpty(serverUrl))
        {
            var senderPhone = (await _db.WhatsAppSessions.FirstOrDefaultAsync(s => s.IsPrimary))?.PhoneNumber;
            if (!string.IsNullOrEmpty(senderPhone))
            {
                await _waServer.SendMessageAsync(serverUrl, senderPhone, targetPhone,
                    $"رمز استرجاع الأمان الخاص بنظام شؤون الطلاب: {code}\n\nصالح لمدة 5 دقائق فقط.");
            }
        }

        return Ok(ApiResponse<object>.Ok(new { sent = true, phoneMasked = MaskPhone(targetPhone) }));
    }

    [HttpPost("security/verify-recovery")]
    public async Task<ActionResult<ApiResponse<object>>> VerifyRecoveryCode([FromBody] SecurityVerifyRequest request)
    {
        var settings = await _db.WhatsAppSettings.FirstOrDefaultAsync();
        if (settings == null)
            return Ok(ApiResponse<object>.Ok(new { valid = false }));

        var valid = settings.TempRecoveryCode == request.Code
                    && settings.RecoveryCodeExpiry.HasValue
                    && settings.RecoveryCodeExpiry.Value > DateTime.UtcNow;

        if (valid)
        {
            // Clear temp code after successful use
            settings.TempRecoveryCode = "";
            settings.RecoveryCodeExpiry = null;
            await _db.SaveChangesAsync();
        }

        return Ok(ApiResponse<object>.Ok(new { valid }));
    }

    [HttpPost("security/change-code")]
    public async Task<ActionResult<ApiResponse>> ChangeSecurityCode([FromBody] SecurityChangeRequest request)
    {
        var settings = await _db.WhatsAppSettings.FirstOrDefaultAsync();
        if (settings == null)
            return Ok(ApiResponse.Fail("لا توجد إعدادات"));

        // Must verify old code first (unless using recovery bypass)
        if (!request.BypassOldCode)
        {
            if (string.IsNullOrEmpty(settings.SecurityCode))
                return Ok(ApiResponse.Fail("لا يوجد رمز أمان قديم"));
            if (!BCrypt.Net.BCrypt.Verify(request.OldCode ?? "", settings.SecurityCode))
                return Ok(ApiResponse.Fail("رمز الأمان القديم غير صحيح"));
        }

        if (string.IsNullOrEmpty(request.NewCode) || request.NewCode.Length < 6)
            return Ok(ApiResponse.Fail("رمز الأمان الجديد يجب أن يكون 6 أرقام على الأقل"));

        settings.SecurityCode = BCrypt.Net.BCrypt.HashPassword(request.NewCode);
        if (!string.IsNullOrEmpty(request.RecoveryPhone1))
            settings.RecoveryPhone1 = request.RecoveryPhone1;
        if (request.RecoveryPhone2 != null)
            settings.RecoveryPhone2 = request.RecoveryPhone2;

        await _db.SaveChangesAsync();
        return Ok(ApiResponse.Ok("تم تغيير رمز الأمان بنجاح"));
    }

    private static string? MaskPhone(string? phone)
    {
        if (string.IsNullOrEmpty(phone) || phone.Length < 4) return null;
        return phone[..3] + new string('*', phone.Length - 5) + phone[^2..];
    }
}

// ===== Request DTOs =====

public class WhatsAppSettingsRequest
{
    public string? ServerUrl { get; set; }
    public string? ServiceStatus { get; set; }
    public string? SmsApiToken { get; set; }
    public string? SmsSenderName { get; set; }
    public string? WhatsAppMode { get; set; }
}

public class SendWhatsAppRequest
{
    public string? SenderPhone { get; set; }
    public string? RecipientPhone { get; set; }
    public string? Message { get; set; }
    public string? Stage { get; set; }
}

public class SendWithLogRequest
{
    public int StudentId { get; set; }
    public string? StudentNumber { get; set; }
    public string? StudentName { get; set; }
    public string? Grade { get; set; }
    public string? ClassName { get; set; }
    public string? Phone { get; set; }
    public string? MessageType { get; set; }
    public string? MessageTitle { get; set; }
    public string? Message { get; set; }
    public string? Stage { get; set; }
    public string? Sender { get; set; }
}

public class SecuritySetupRequest
{
    public string? Code { get; set; }
    public string? RecoveryPhone1 { get; set; }
    public string? RecoveryPhone2 { get; set; }
}

public class SecurityVerifyRequest
{
    public string? Code { get; set; }
}

public class RecoveryRequest
{
    public int PhoneIndex { get; set; } = 1; // 1 or 2
}

public class SecurityChangeRequest
{
    public string? OldCode { get; set; }
    public string? NewCode { get; set; }
    public string? RecoveryPhone1 { get; set; }
    public string? RecoveryPhone2 { get; set; }
    public bool BypassOldCode { get; set; } // Used after recovery verification
}

// ===== DTOs الجديدة — مطابق للدوال الجديدة =====

public class UpdateStatusRequest
{
    public string? Status { get; set; }  // "متصل" | "غير متصل"
}

public class SyncSaveRequest
{
    public string? PhoneNumber { get; set; }
    public string? Stage       { get; set; }
    public string? UserType    { get; set; }
}
