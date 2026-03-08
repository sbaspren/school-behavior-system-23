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
        var settings       = await _db.WhatsAppSettings.FirstOrDefaultAsync();
        var schoolSettings = await _db.SchoolSettings.FirstOrDefaultAsync();
        var serverUrl      = settings?.ServerUrl ?? "";

        // ★ 1. التحقق من إعداد رمز الأمان — مطابق GAS سطر 982
        var needSetup    = string.IsNullOrEmpty(settings?.SecurityCode);
        var whatsAppMode = schoolSettings?.WhatsAppMode.ToString() ?? "PerStage";

        // ★ 2. النمط الموحد: effectiveStage = "" — مطابق GAS سطر 994
        var effectiveStage = whatsAppMode == "Unified" ? "" : (stage ?? "");

        if (string.IsNullOrEmpty(serverUrl))
            return Ok(ApiResponse<object>.Ok(new
            {
                connected = false, phone = (string?)null, needSetup,
                whatsappMode = whatsAppMode, stage = stage ?? "", effectiveStage,
                sessions = Array.Empty<object>(),
                error = "رابط سيرفر الواتساب غير مُعيّن — عيّنه في إعدادات الواتساب"
            }));

        // ★ 3. جلب الأرقام المتصلة من السيرفر — مطابق GAS سطر 997 (getConnectedSessionsByStage)
        var serverStatus   = await _waServer.GetStatusAsync(serverUrl);
        var serverPhones   = serverStatus.ConnectedPhones.Select(p => p.PhoneNumber).ToList();

        // جلب الجلسات المحفوظة للمرحلة
        var savedQ = _db.WhatsAppSessions.AsQueryable();
        if (!string.IsNullOrEmpty(effectiveStage))
            savedQ = savedQ.Where(s => s.Stage == effectiveStage);
        var savedSessions = await savedQ.ToListAsync();

        // بناء allSessions (كل المحفوظة مع حالة الاتصال) — مطابق GAS allSessions
        var allSessions = savedSessions.Select(s => new
        {
            phone       = s.PhoneNumber,
            stage       = s.Stage,
            userType    = s.UserType,
            status      = serverPhones.Contains(s.PhoneNumber) ? "متصل" : "غير متصل",
            linkedDate  = s.LinkedAt?.ToString("yyyy/MM/dd HH:mm") ?? "",
            lastUsed    = s.LastUsed?.ToString("yyyy/MM/dd HH:mm") ?? "",
            messageCount = s.MessageCount,
            isPrimary   = s.IsPrimary,
        }).ToList();

        // sessions = المتصلون فقط — مطابق GAS sessions
        var connectedSessions = allSessions.Where(s => s.status == "متصل").Cast<object>().ToList();

        // ★ 4. جلب الرقم الرئيسي — مطابق GAS سطر 1001 (getPrimaryPhoneForStage)
        var primaryRow = savedSessions.FirstOrDefault(s => s.IsPrimary);
        var primaryPhone = primaryRow?.PhoneNumber;
        var hasPrimary   = primaryPhone != null;

        if (connectedSessions.Count > 0)
        {
            // ★ مطابق GAS سطر 1005: connected = true
            return Ok(ApiResponse<object>.Ok(new
            {
                connected    = true,
                phone        = primaryPhone ?? connectedSessions.Cast<dynamic>().First().phone,
                primaryPhone,
                hasPrimary,
                needSetup,
                sessions     = connectedSessions,
                allSessions  = allSessions.Cast<object>().ToList(),
                stage        = stage ?? "",
                effectiveStage,
                whatsappMode = whatsAppMode,
                connectedPhones = serverStatus.ConnectedPhones.Select(p => new { p.PhoneNumber, p.IsConnected }),
            }));
        }

        // ★ مطابق GAS سطر 1023: لا أرقام متصلة
        return Ok(ApiResponse<object>.Ok(new
        {
            connected    = false,
            phone        = (string?)null,
            primaryPhone,
            hasPrimary,
            needSetup,
            sessions     = Array.Empty<object>(),
            allSessions  = allSessions.Cast<object>().ToList(),
            stage        = stage ?? "",
            effectiveStage,
            whatsappMode = whatsAppMode,
            connectedPhones = serverStatus.ConnectedPhones.Select(p => new { p.PhoneNumber, p.IsConnected }),
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
    // ★ مطابق لـ sendWhatsAppMessage + sendWhatsAppMessageFrom في GAS

    [HttpPost("send")]
    public async Task<ActionResult<ApiResponse<object>>> SendMessage([FromBody] SendWhatsAppRequest request)
    {
        if (string.IsNullOrEmpty(request.RecipientPhone))
            return BadRequest(ApiResponse<object>.Fail("رقم المستقبل مطلوب"));
        if (string.IsNullOrEmpty(request.Message))
            return BadRequest(ApiResponse<object>.Fail("نص الرسالة مطلوب"));

        var settings  = await _db.WhatsAppSettings.FirstOrDefaultAsync();
        var serverUrl = settings?.ServerUrl ?? "";

        if (string.IsNullOrEmpty(serverUrl))
            return BadRequest(ApiResponse<object>.Fail("رابط سيرفر الواتساب غير مُعيّن"));

        // ★ جلب الرقم المرسل: المحدد → الرئيسي للمرحلة → أول متصل في المرحلة (مطابق GAS)
        var senderPhone  = request.SenderPhone;
        var senderUserType = "وكيل";

        if (string.IsNullOrEmpty(senderPhone) && !string.IsNullOrEmpty(request.Stage))
        {
            var primary = await _db.WhatsAppSessions
                .Where(s => s.Stage == request.Stage && s.IsPrimary)
                .FirstOrDefaultAsync();
            senderPhone    = primary?.PhoneNumber;
            senderUserType = primary?.UserType ?? "وكيل";
        }

        // ★ Fallback: أول رقم متصل في المرحلة — مطابق GAS سطر 1120 (getConnectedSessionsByStage)
        if (string.IsNullOrEmpty(senderPhone) && !string.IsNullOrEmpty(request.Stage))
        {
            var serverPhones = await _waServer.GetConnectedSessionsAsync(serverUrl);
            var stageSessions = await _db.WhatsAppSessions
                .Where(s => s.Stage == request.Stage)
                .ToListAsync();
            var firstConnected = stageSessions.FirstOrDefault(s => serverPhones.Contains(s.PhoneNumber));
            senderPhone    = firstConnected?.PhoneNumber;
            senderUserType = firstConnected?.UserType ?? "وكيل";
        }

        if (string.IsNullOrEmpty(senderPhone))
            return BadRequest(ApiResponse<object>.Fail(
                $"لا يوجد رقم رئيسي متصل لمرحلة {request.Stage}. يرجى ربط رقم رئيسي من أدوات واتساب."));

        var success = await _waServer.SendMessageAsync(serverUrl, senderPhone, request.RecipientPhone, request.Message);

        if (success)
        {
            var session = await _db.WhatsAppSessions
                .Where(s => s.PhoneNumber == senderPhone &&
                       (string.IsNullOrEmpty(request.Stage) || s.Stage == request.Stage))
                .FirstOrDefaultAsync();
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
    // ★ ترتيب العمليات مطابق GAS سطر 1146: سجّل → أرسل → حدّث الحالة

    [HttpPost("send-with-log")]
    public async Task<ActionResult<ApiResponse<object>>> SendWithLog([FromBody] SendWithLogRequest request)
    {
        if (string.IsNullOrEmpty(request.Phone))
            return BadRequest(ApiResponse<object>.Fail("رقم الجوال مطلوب"));

        var settings  = await _db.WhatsAppSettings.FirstOrDefaultAsync();
        var serverUrl = settings?.ServerUrl ?? "";

        Stage? stageEnum = null;
        if (!string.IsNullOrEmpty(request.Stage) && Enum.TryParse<Stage>(request.Stage, true, out var parsed))
            stageEnum = parsed;

        // ★ 1. جلب الرقم الرئيسي للمرحلة — مطابق GAS سطر 1149
        WhatsAppSession? senderSession = null;
        if (!string.IsNullOrEmpty(request.Stage))
            senderSession = await _db.WhatsAppSessions
                .Where(s => s.Stage == request.Stage && s.IsPrimary)
                .FirstOrDefaultAsync();

        // بديل: أي رقم متصل في المرحلة — مطابق GAS سطر 1155
        if (senderSession == null && !string.IsNullOrEmpty(request.Stage))
        {
            var serverPhones = await _waServer.GetConnectedSessionsAsync(serverUrl);
            var stageSession = await _db.WhatsAppSessions
                .Where(s => s.Stage == request.Stage)
                .ToListAsync();
            senderSession = stageSession.FirstOrDefault(s => serverPhones.Contains(s.PhoneNumber));
        }

        if (senderSession == null)
            return Ok(ApiResponse<object>.Fail(
                $"لا يوجد رقم رئيسي متصل لمرحلة {request.Stage}. يرجى ربط رقم رئيسي من أدوات واتساب."));

        var senderPhone   = senderSession.PhoneNumber;
        var senderUserType = senderSession.UserType;

        // ★ 2. تسجيل الرسالة أولاً بحالة "جاري الإرسال" — مطابق GAS سطر 1163 (logCommunication)
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
            HijriDate     = hijriDate,
            MiladiDate    = now.ToString("yyyy/MM/dd"),
            Time          = now.ToString("HH:mm"),
            StudentId     = request.StudentId,
            StudentNumber = request.StudentNumber ?? "",
            StudentName   = request.StudentName ?? "",
            Grade         = request.Grade ?? "",
            Class         = request.ClassName ?? "",
            Stage         = stageEnum ?? Stage.Intermediate,
            Mobile        = request.Phone ?? "",
            MessageType   = request.MessageType ?? "واتساب",
            MessageTitle  = request.MessageTitle ?? "",
            MessageBody   = request.Message ?? "",
            SendStatus    = "جاري الإرسال",
            SentBy        = request.Sender ?? "الوكيل",
            Notes         = "",
        };

        _db.CommunicationLogs.Add(log);
        await _db.SaveChangesAsync();

        // ★ 3. إرسال الرسالة — مطابق GAS سطر 1184 (sendWhatsAppMessageFrom)
        var sendSuccess = await _waServer.SendMessageAsync(serverUrl, senderPhone, request.Phone!, request.Message ?? "");

        // ★ 4. تحديث حالة التسجيل + عداد الرسائل — مطابق GAS سطر 1188
        if (sendSuccess)
        {
            log.SendStatus = "✅ تم الإرسال";
            senderSession.MessageCount++;
            senderSession.LastUsed = DateTime.Now;
        }
        else
        {
            log.SendStatus = "❌ فشل";
            log.Notes      = "فشل الإرسال";
        }
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new
        {
            success = sendSuccess,
            logId   = log.Id,
            status  = log.SendStatus,
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
            return BadRequest(ApiResponse.Fail("رقم الواتساب مطلوب"));

        var schoolSettings = await _db.SchoolSettings.FirstOrDefaultAsync();
        var whatsAppMode   = schoolSettings?.WhatsAppMode.ToString() ?? "PerStage";
        // ★ في النمط الموحد: المرحلة تكون "" (الكل) — مطابق GAS سطر 511
        var effectiveStage = whatsAppMode == "Unified" ? "" : (request.Stage ?? "");
        var cleanPhone     = CleanPhoneNumber(request.PhoneNumber);

        // ★ جلب جميع جلسات المرحلة لإزالة الرئيسي القديم لاحقاً
        var stageSessions = await _db.WhatsAppSessions
            .Where(s => s.Stage == effectiveStage)
            .ToListAsync();

        // ★ التحقق من وجود الرقم مسبقاً — إذا موجود نُحدّثه (مطابق GAS سطر 517-527)
        var existing = stageSessions.FirstOrDefault(s =>
            CleanPhoneNumber(s.PhoneNumber) == cleanPhone &&
            s.UserType == (request.UserType ?? ""));

        if (existing != null)
        {
            // تحديث الرقم الموجود وجعله رئيسياً
            foreach (var s in stageSessions) s.IsPrimary = false;
            existing.ConnectionStatus = "متصل";
            existing.LastUsed         = DateTime.Now;
            existing.IsPrimary        = true;
            await _db.SaveChangesAsync();
            return Ok(ApiResponse<object>.Ok(new
            {
                id        = existing.Id,
                message   = "تم تحديث الرقم وتعيينه كرئيسي",
                isPrimary = true,
            }));
        }

        // ★ إزالة الرئيسي القديم للمرحلة — مطابق GAS سطر 531
        foreach (var s in stageSessions) s.IsPrimary = false;

        // إضافة رقم جديد كرئيسي
        var session = new WhatsAppSession
        {
            PhoneNumber      = cleanPhone,
            Stage            = effectiveStage,
            UserType         = request.UserType ?? "",
            ConnectionStatus = "متصل",
            LinkedAt         = DateTime.Now,
            LastUsed         = DateTime.Now,
            IsPrimary        = true,
        };

        _db.WhatsAppSessions.Add(session);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new
        {
            id        = session.Id,
            message   = "تم حفظ الرقم كرقم رئيسي",
            isPrimary = true,
        }));
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
        var settings  = await _db.WhatsAppSettings.FirstOrDefaultAsync();
        var serverUrl = settings?.ServerUrl ?? "";

        // جلب الأرقام المحفوظة للمرحلة — مطابق savedSessions في GAS
        var savedQ = _db.WhatsAppSessions.AsQueryable();
        if (!string.IsNullOrEmpty(stage))
            savedQ = savedQ.Where(s => s.Stage == stage);
        var savedSessions = await savedQ.ToListAsync();

        // جلب الأرقام المتصلة من السيرفر — مطابق connectedPhones في GAS
        var serverPhones = new List<string>();
        if (!string.IsNullOrEmpty(serverUrl))
        {
            var connected = await _waServer.GetConnectedSessionsAsync(serverUrl);
            serverPhones = connected;
        }

        if (!string.IsNullOrEmpty(stage))
        {
            // ★ getWhatsAppStats(stage) — مطابق GAS سطر 1211
            var allSessWithStatus = savedSessions.Select(s => new
            {
                phone        = s.PhoneNumber,
                stage        = s.Stage,
                userType     = s.UserType,
                status       = serverPhones.Contains(s.PhoneNumber) ? "متصل" : "غير متصل",
                linkedDate   = s.LinkedAt?.ToString("yyyy/MM/dd HH:mm") ?? "",
                lastUsed     = s.LastUsed?.ToString("yyyy/MM/dd HH:mm") ?? "",
                messageCount = s.MessageCount,
                isPrimary    = s.IsPrimary,
            }).ToList();

            var connectedSess = allSessWithStatus.Where(s => s.status == "متصل").Cast<object>().ToList();
            var totalMessages = savedSessions.Sum(s => s.MessageCount);

            return Ok(ApiResponse<object>.Ok(new
            {
                success = true,
                stats = new
                {
                    connectedPhones = connectedSess.Count,
                    savedPhones     = savedSessions.Count,
                    totalMessages,
                    sessions    = connectedSess,
                    allSessions = allSessWithStatus.Cast<object>().ToList(),
                },
                stage,
            }));
        }
        else
        {
            // ★ getAllPhonesStats() — مطابق GAS سطر 1244
            var phones = savedSessions.Select(s =>
            {
                var isConnected = serverPhones.Contains(s.PhoneNumber);
                return new
                {
                    phone        = s.PhoneNumber,
                    stage        = s.Stage,
                    userType     = s.UserType,
                    status       = isConnected ? "متصل" : "غير متصل",
                    linkedDate   = s.LinkedAt?.ToString("yyyy/MM/dd HH:mm") ?? "",
                    lastUsed     = s.LastUsed?.ToString("yyyy/MM/dd HH:mm") ?? "",
                    messageCount = s.MessageCount,
                };
            }).ToList();

            var totalMessages  = phones.Sum(p => p.messageCount);
            var connectedCount = phones.Count(p => p.status == "متصل");

            return Ok(ApiResponse<object>.Ok(new
            {
                success = true,
                stats = new
                {
                    totalPhones      = phones.Count,
                    connectedPhones  = connectedCount,
                    totalMessages,
                    phones           = phones.Cast<object>().ToList(),
                },
            }));
        }
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

    // ===== مساعد: إخفاء رقم الجوال =====
    // مطابق لـ maskPhone() في Server_WhatsApp.gs: substring(0,6) + '****' + substring(length-2)
    private static string? MaskPhone(string? phone)
    {
        if (string.IsNullOrEmpty(phone) || phone.Length < 8) return null;
        return phone[..6] + "****" + phone[^2..];
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

    // ===== Security Code =====

    [HttpGet("security/status")]
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

        // Generate 4-digit code — مطابق GAS: Math.floor(1000 + Math.random() * 9000) → 1000-9999
        var code = new Random().Next(1000, 10000).ToString();
        settings.TempRecoveryCode = code;
        settings.RecoveryCodeExpiry = DateTime.UtcNow.AddMinutes(5);
        await _db.SaveChangesAsync();

        // Send via WhatsApp — نص الرسالة مطابق لـ GAS سطر 283
        var serverUrl = settings.ServerUrl ?? "";
        if (!string.IsNullOrEmpty(serverUrl))
        {
            var senderPhone = (await _db.WhatsAppSessions.FirstOrDefaultAsync(s => s.IsPrimary))?.PhoneNumber;
            if (!string.IsNullOrEmpty(senderPhone))
            {
                await _waServer.SendMessageAsync(serverUrl, senderPhone, targetPhone,
                    $"🔐 رمز استرجاع رمز الأمان الخاص بنظام التوجيه الطلابي:\n\n{code}\n\nصالح لمدة 5 دقائق فقط.");
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
