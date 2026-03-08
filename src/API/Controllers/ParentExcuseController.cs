using Microsoft.AspNetCore.Authorization;
using System.Globalization;
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
public class ParentExcuseController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IWhatsAppServerService _wa;
    public ParentExcuseController(AppDbContext db, IWhatsAppServerService wa) { _db = db; _wa = wa; }

    // ── 1. Get all excuses (admin view) ──
    [HttpGet]
    public async Task<ActionResult<ApiResponse<object>>> GetAll(
        [FromQuery] string? stage = null, [FromQuery] string? status = null)
    {
        var q = _db.ParentExcuses.AsQueryable();

        if (!string.IsNullOrEmpty(stage) && Enum.TryParse<Stage>(stage, true, out var stageEnum))
            q = q.Where(e => e.Stage == stageEnum);
        if (!string.IsNullOrEmpty(status))
            q = q.Where(e => e.Status == status);

        var records = await q.OrderByDescending(e => e.SubmittedAt).ToListAsync();
        return Ok(ApiResponse<object>.Ok(records));
    }

    // ── 2. Get pending count ──
    [HttpGet("pending-count")]
    public async Task<ActionResult<ApiResponse<object>>> GetPendingCount([FromQuery] string? stage = null)
    {
        var q = _db.ParentExcuses.Where(e => e.Status == "معلق");
        if (!string.IsNullOrEmpty(stage) && Enum.TryParse<Stage>(stage, true, out var stageEnum))
            q = q.Where(e => e.Stage == stageEnum);

        var count = await q.CountAsync();
        return Ok(ApiResponse<object>.Ok(new { count }));
    }

    // ── 3. Update excuse status (accept/reject) ──
    [HttpPut("{id}/status")]
    public async Task<ActionResult<ApiResponse<object>>> UpdateStatus(int id, [FromBody] UpdateExcuseStatusRequest request)
    {
        var excuse = await _db.ParentExcuses.FindAsync(id);
        if (excuse == null)
            return NotFound(ApiResponse<object>.Fail("العذر غير موجود"));

        excuse.Status = request.Status;
        excuse.SchoolNotes = request.Notes ?? "";
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { message = "تم تحديث حالة العذر" }));
    }

    // ── 4. Delete excuse ──
    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiResponse<object>>> Delete(int id)
    {
        var excuse = await _db.ParentExcuses.FindAsync(id);
        if (excuse == null)
            return NotFound(ApiResponse<object>.Fail("العذر غير موجود"));

        _db.ParentExcuses.Remove(excuse);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { message = "تم حذف العذر" }));
    }

    // ════════════════════════════════════════════════════════
    // Public endpoints (no auth required — for parent form)
    // ════════════════════════════════════════════════════════

    // ── 5. Validate token and get student data (parent form) ──
    [AllowAnonymous]
    [HttpGet("public/verify")]
    public async Task<ActionResult<ApiResponse<object>>> VerifyToken([FromQuery] string token)
    {
        if (string.IsNullOrEmpty(token))
            return BadRequest(ApiResponse<object>.Fail("الرمز مطلوب"));

        var accessCode = await _db.ParentAccessCodes
            .FirstOrDefaultAsync(c => c.Code == token);

        if (accessCode == null)
            return NotFound(ApiResponse<object>.Fail("رابط غير صالح"));

        if (DateTime.UtcNow > accessCode.ExpiresAt)
            return BadRequest(ApiResponse<object>.Fail("انتهت صلاحية هذا الرابط (24 ساعة). سيتم إنشاء رابط جديد مع إشعار الغياب القادم."));

        if (accessCode.IsUsed)
            return BadRequest(ApiResponse<object>.Fail("تم تقديم العذر مسبقا عبر هذا الرابط. شكرا لتعاونكم."));

        // Get student info
        var student = await _db.Students
            .FirstOrDefaultAsync(s => s.StudentNumber == accessCode.StudentNumber && s.Stage == accessCode.Stage);

        if (student == null)
            return NotFound(ApiResponse<object>.Fail("لم يتم العثور على بيانات الطالب"));

        // Get absence stats from cumulative
        var cumAbsence = await _db.CumulativeAbsences
            .FirstOrDefaultAsync(a => a.StudentId == student.Id && a.Stage == accessCode.Stage);

        // Get school name
        var schoolSettings = await _db.SchoolSettings.FirstOrDefaultAsync();

        // مطابق لـ getParentExcusePageData_ في Server_ParentExcuse.gs سطر 102-137
        var dayNames = new[] { "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت" };
        var now = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow,
            TimeZoneInfo.FindSystemTimeZoneById("Arab Standard Time"));
        var hijriDate = now.ToString("yyyy/MM/dd", new CultureInfo("ar-SA"));
        var dayName = dayNames[(int)now.DayOfWeek];

        return Ok(ApiResponse<object>.Ok(new
        {
            schoolName = schoolSettings?.SchoolName ?? "",
            student = new
            {
                id = student.Id,
                name = student.Name,
                grade = student.Grade,
                section = student.Class,
                stage = accessCode.Stage.ToString()
            },
            absence = new
            {
                excused = cumAbsence?.ExcusedDays ?? 0,
                unexcused = cumAbsence?.UnexcusedDays ?? 0,
                late = cumAbsence?.LateDays ?? 0
            },
            today = new
            {
                date = hijriDate,
                day = dayName
            }
        }));
    }

    // ── 6. Submit excuse (parent form) ──
    [AllowAnonymous]
    [HttpPost("public/submit")]
    public async Task<ActionResult<ApiResponse<object>>> SubmitExcuse([FromBody] SubmitExcuseRequest request)
    {
        if (string.IsNullOrEmpty(request.Token) || string.IsNullOrEmpty(request.Reason))
            return BadRequest(ApiResponse<object>.Fail("البيانات غير مكتملة"));

        if (request.Reason.Length < 5)
            return BadRequest(ApiResponse<object>.Fail("يرجى كتابة سبب الغياب (5 أحرف على الأقل)"));

        if (request.Reason.Length > 500)
            return BadRequest(ApiResponse<object>.Fail("سبب الغياب يجب أن لا يتجاوز 500 حرف"));

        var accessCode = await _db.ParentAccessCodes
            .FirstOrDefaultAsync(c => c.Code == request.Token);

        if (accessCode == null)
            return NotFound(ApiResponse<object>.Fail("رابط غير صالح"));

        if (DateTime.UtcNow > accessCode.ExpiresAt)
            return BadRequest(ApiResponse<object>.Fail("انتهت صلاحية الرابط (24 ساعة). سيتم إنشاء رابط جديد مع إشعار الغياب القادم."));

        if (accessCode.IsUsed)
            return BadRequest(ApiResponse<object>.Fail("تم تقديم العذر مسبقا عبر هذا الرابط. لا يمكن إرساله مرة أخرى."));

        // Get student
        var student = await _db.Students
            .FirstOrDefaultAsync(s => s.StudentNumber == accessCode.StudentNumber && s.Stage == accessCode.Stage);

        if (student == null)
            return NotFound(ApiResponse<object>.Fail("لم يتم العثور على الطالب"));

        var now = DateTime.UtcNow;

        _db.ParentExcuses.Add(new ParentExcuse
        {
            StudentId = student.Id,
            StudentNumber = student.StudentNumber,
            StudentName = student.Name,
            Grade = student.Grade,
            Class = student.Class,
            Stage = accessCode.Stage,
            ExcuseText = request.Reason.Trim(),
            Attachments = request.HasAttachment ? "نعم - تسلم مع الطالب" : "لا",
            AbsenceDate = request.AbsenceDate ?? "",
            SubmittedAt = now,
            SubmittedTime = now.ToString("HH:mm:ss"),
            Status = "معلق",
            AccessCode = request.Token
        });

        // Mark token as used
        accessCode.IsUsed = true;
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new
        {
            message = "تم إرسال العذر بنجاح. سيتم مراجعته من قبل إدارة المدرسة."
        }));
    }

    // ── 7. Generate access code (called internally when sending absence notification) ──
    [HttpPost("generate-code")]
    public async Task<ActionResult<ApiResponse<object>>> GenerateCode([FromBody] GenerateCodeRequest request)
    {
        if (string.IsNullOrEmpty(request.StudentNumber))
            return BadRequest(ApiResponse<object>.Fail("رقم الطالب مطلوب"));

        if (!Enum.TryParse<Stage>(request.Stage, true, out var stageEnum))
            return BadRequest(ApiResponse<object>.Fail("مرحلة غير صحيحة"));

        var code = Guid.NewGuid().ToString("N")[..16];
        var now = DateTime.UtcNow;

        _db.ParentAccessCodes.Add(new ParentAccessCode
        {
            Code = code,
            StudentNumber = request.StudentNumber,
            Stage = stageEnum,
            CreatedAt = now,
            ExpiresAt = now.AddHours(24),
            IsUsed = false
        });

        // Cleanup: remove expired codes (older than 48h)
        var cutoff = now.AddHours(-48);
        var expired = await _db.ParentAccessCodes
            .Where(c => c.CreatedAt < cutoff)
            .Take(50)
            .ToListAsync();
        _db.ParentAccessCodes.RemoveRange(expired);

        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { code }));
    }

    /// <summary>إرسال رسالة مخصصة لولي الأمر عن العذر — مطابق لـ sendExcuseCustomMessage في Server_Absence_Daily.gs سطر 1152-1231</summary>
    [HttpPost("{id}/send-message")]
    public async Task<ActionResult<ApiResponse<object>>> SendExcuseCustomMessage(int id, [FromBody] ExcuseCustomMessageRequest request)
    {
        if (string.IsNullOrEmpty(request.Message))
            return BadRequest(ApiResponse<object>.Fail("الرسالة مطلوبة"));

        var excuse = await _db.ParentExcuses.FindAsync(id);
        if (excuse == null)
            return NotFound(ApiResponse<object>.Fail("العذر غير موجود"));

        // جلب رقم جوال ولي الأمر من بيانات الطالب — مطابق لـ getStudentPhone_ سطر 1234
        var student = await _db.Students.FirstOrDefaultAsync(s => s.Id == excuse.StudentId);
        if (student == null || string.IsNullOrEmpty(student.Mobile))
            return Ok(ApiResponse<object>.Fail("لا يوجد رقم جوال لهذا الطالب"));

        var settings = await _db.WhatsAppSettings.FirstOrDefaultAsync();
        if (settings == null || string.IsNullOrEmpty(settings.ServerUrl))
            return Ok(ApiResponse<object>.Fail("إعدادات الواتساب غير مكتملة"));

        // جلب رقم المرسل
        var session = await _db.WhatsAppSessions
            .Where(s => s.IsPrimary && s.Stage == excuse.Stage.ToString())
            .FirstOrDefaultAsync();
        session ??= await _db.WhatsAppSessions.Where(s => s.IsPrimary).FirstOrDefaultAsync();
        var senderPhone = session?.PhoneNumber ?? "";

        if (string.IsNullOrEmpty(senderPhone))
            return Ok(ApiResponse<object>.Fail("لا يوجد رقم مرسل"));

        var sent = await _wa.SendMessageAsync(settings.ServerUrl, senderPhone, student.Mobile, request.Message);

        if (sent)
        {
            _db.CommunicationLogs.Add(new CommunicationLog
            {
                StudentId = excuse.StudentId,
                StudentNumber = excuse.StudentNumber,
                StudentName = excuse.StudentName,
                Grade = excuse.Grade,
                Class = excuse.Class,
                Stage = excuse.Stage,
                Mobile = student.Mobile,
                MessageType = "عذر",
                MessageTitle = "رد على عذر غياب",
                MessageBody = request.Message,
                SendStatus = "sent",
                MiladiDate = DateTime.UtcNow.ToString("yyyy-MM-dd"),
                SentBy = request.SentBy ?? ""
            });
            await _db.SaveChangesAsync();
        }

        return Ok(ApiResponse<object>.Ok(new { success = sent }));
    }
}

// ── DTOs ──
public class UpdateExcuseStatusRequest
{
    public string Status { get; set; } = "";     // مقبول / مرفوض
    public string? Notes { get; set; }
}

public class SubmitExcuseRequest
{
    public string Token { get; set; } = "";
    public string Reason { get; set; } = "";
    public bool HasAttachment { get; set; }
    public string? AbsenceDate { get; set; }
}

public class GenerateCodeRequest
{
    public string StudentNumber { get; set; } = "";
    public string Stage { get; set; } = "";
}

public class ExcuseCustomMessageRequest
{
    public string Message { get; set; } = "";
    public string? SentBy { get; set; }
}
