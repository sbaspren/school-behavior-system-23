using Microsoft.AspNetCore.Authorization;
using System.Globalization;
using System.Text;
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
public class PermissionsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IWhatsAppServerService _wa;

    public PermissionsController(AppDbContext db, IWhatsAppServerService wa)
    {
        _db = db;
        _wa = wa;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<object>>>> GetAll(
        [FromQuery] string? stage = null,
        [FromQuery] string? grade = null,
        [FromQuery] string? className = null,
        [FromQuery] int? studentId = null,
        [FromQuery] string? hijriDate = null,
        [FromQuery] string? dateFrom = null,
        [FromQuery] string? dateTo = null,
        [FromQuery] bool? isSent = null,
        [FromQuery] string? search = null)
    {
        var query = _db.PermissionRecords.AsQueryable();

        if (!string.IsNullOrEmpty(stage) && Enum.TryParse<Stage>(stage, true, out var stageEnum))
            query = query.Where(r => r.Stage == stageEnum);
        if (!string.IsNullOrEmpty(grade))
            query = query.Where(r => r.Grade == grade);
        if (!string.IsNullOrEmpty(className))
            query = query.Where(r => r.Class == className);
        if (studentId.HasValue)
            query = query.Where(r => r.StudentId == studentId.Value);
        if (!string.IsNullOrEmpty(hijriDate))
            query = query.Where(r => r.HijriDate == hijriDate);
        if (!string.IsNullOrEmpty(dateFrom))
            query = query.Where(r => string.Compare(r.HijriDate, dateFrom) >= 0);
        if (!string.IsNullOrEmpty(dateTo))
            query = query.Where(r => string.Compare(r.HijriDate, dateTo) <= 0);
        if (isSent.HasValue)
            query = query.Where(r => r.IsSent == isSent.Value);
        if (!string.IsNullOrEmpty(search))
        {
            var q = search.ToLower();
            query = query.Where(r => r.StudentName.ToLower().Contains(q) || r.StudentNumber.Contains(q));
        }

        var records = await query
            .OrderByDescending(r => r.RecordedAt)
            .Select(r => new
            {
                r.Id, r.StudentId, r.StudentNumber, r.StudentName,
                r.Grade, className = r.Class,
                stage = r.Stage.ToString(),
                r.Mobile, r.ExitTime, r.Reason,
                r.Receiver, r.Supervisor, r.HijriDate,
                r.RecordedBy, r.RecordedAt,
                r.ConfirmationTime, r.IsSent
            })
            .ToListAsync();

        return Ok(ApiResponse<List<object>>.Ok(records.Cast<object>().ToList()));
    }

    // إحصائيات اليوم
    [HttpGet("daily-stats")]
    public async Task<ActionResult<ApiResponse<object>>> GetDailyStats([FromQuery] string? stage = null)
    {
        var today = DateTime.UtcNow.Date;
        var query = _db.PermissionRecords.Where(r => r.RecordedAt >= today);

        if (!string.IsNullOrEmpty(stage) && Enum.TryParse<Stage>(stage, true, out var stageEnum))
            query = query.Where(r => r.Stage == stageEnum);

        var todayRecords = await query.ToListAsync();

        return Ok(ApiResponse<object>.Ok(new
        {
            todayCount = todayRecords.Count,
            sentCount = todayRecords.Count(r => r.IsSent),
            unsentCount = todayRecords.Count(r => !r.IsSent),
            confirmedCount = todayRecords.Count(r => !string.IsNullOrEmpty(r.ConfirmationTime)),
            pendingCount = todayRecords.Count(r => string.IsNullOrEmpty(r.ConfirmationTime)),
        }));
    }

    // الاستئذانات المعلقة (للحارس)
    // ← مطابق لـ getPendingPermissions(stage) في Server_Attendance.gs سطر 491
    [HttpGet("pending")]
    public async Task<ActionResult<ApiResponse<List<object>>>> GetPending([FromQuery] string? stage = null)
    {
        var today = DateTime.UtcNow.Date;
        var query = _db.PermissionRecords
            .Where(r => r.RecordedAt >= today && (r.ConfirmationTime == null || r.ConfirmationTime == ""));

        if (!string.IsNullOrEmpty(stage) && Enum.TryParse<Stage>(stage, true, out var stageEnum))
            query = query.Where(r => r.Stage == stageEnum);

        var records = await query
            .OrderByDescending(r => r.RecordedAt)
            .Select(r => new
            {
                r.Id, r.StudentId, r.StudentNumber, r.StudentName,
                r.Grade, className = r.Class,
                stage = r.Stage.ToString(),
                r.Mobile, r.ExitTime, r.Reason,
                r.Receiver, r.Supervisor, r.HijriDate,
                r.RecordedBy, r.RecordedAt
            })
            .ToListAsync();

        return Ok(ApiResponse<List<object>>.Ok(records.Cast<object>().ToList()));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse>> Add([FromBody] PermissionRequest request)
    {
        if (request.StudentId <= 0)
            return Ok(ApiResponse.Fail("الطالب مطلوب"));

        var student = await _db.Students.FindAsync(request.StudentId);
        if (student == null)
            return Ok(ApiResponse.Fail("الطالب غير موجود"));

        var hijriDate = request.HijriDate;
        if (string.IsNullOrEmpty(hijriDate))
        {
            try
            {
                var cal = new UmAlQuraCalendar();
                var now = DateTime.Now;
                hijriDate = $"{cal.GetYear(now)}/{cal.GetMonth(now):D2}/{cal.GetDayOfMonth(now):D2}";
            }
            catch { hijriDate = ""; }
        }

        var record = new PermissionRecord
        {
            StudentId = request.StudentId,
            StudentNumber = student.StudentNumber,
            StudentName = student.Name,
            Grade = student.Grade,
            Class = student.Class,
            Stage = student.Stage,
            Mobile = student.Mobile,
            ExitTime = request.ExitTime ?? DateTime.Now.ToString("HH:mm"),
            Reason = request.Reason ?? "",
            Receiver = request.Receiver ?? "",
            Supervisor = request.Supervisor ?? "",
            HijriDate = hijriDate,
            RecordedBy = request.RecordedBy ?? "",
            RecordedAt = DateTime.UtcNow
        };

        _db.PermissionRecords.Add(record);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { id = record.Id, message = "تم تسجيل الاستئذان بنجاح" }));
    }

    // حفظ جماعي
    [HttpPost("batch")]
    public async Task<ActionResult<ApiResponse<object>>> AddBatch([FromBody] PermissionBatchRequest request)
    {
        if (request.StudentIds == null || request.StudentIds.Count == 0)
            return Ok(ApiResponse<object>.Fail("لا يوجد طلاب محددين"));

        var hijriDate = request.HijriDate;
        if (string.IsNullOrEmpty(hijriDate))
        {
            try
            {
                var cal = new UmAlQuraCalendar();
                var now = DateTime.Now;
                hijriDate = $"{cal.GetYear(now)}/{cal.GetMonth(now):D2}/{cal.GetDayOfMonth(now):D2}";
            }
            catch { hijriDate = ""; }
        }

        var students = await _db.Students.Where(s => request.StudentIds.Contains(s.Id)).ToListAsync();
        var added = 0;

        foreach (var student in students)
        {
            _db.PermissionRecords.Add(new PermissionRecord
            {
                StudentId = student.Id,
                StudentNumber = student.StudentNumber,
                StudentName = student.Name,
                Grade = student.Grade,
                Class = student.Class,
                Stage = student.Stage,
                Mobile = student.Mobile,
                ExitTime = request.ExitTime ?? DateTime.Now.ToString("HH:mm"),
                Reason = request.Reason ?? "",
                Receiver = request.Receiver ?? "",
                Supervisor = request.Supervisor ?? "",
                HijriDate = hijriDate,
                RecordedBy = request.RecordedBy ?? "",
                RecordedAt = DateTime.UtcNow
            });
            added++;
        }

        await _db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(new { addedCount = added, message = $"تم تسجيل {added} حالة استئذان" }));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<ApiResponse>> Update(int id, [FromBody] PermissionUpdateRequest request)
    {
        var record = await _db.PermissionRecords.FindAsync(id);
        if (record == null)
            return Ok(ApiResponse.Fail("السجل غير موجود"));

        if (request.ConfirmationTime != null)
            record.ConfirmationTime = request.ConfirmationTime;
        if (request.Reason != null)
            record.Reason = request.Reason;
        if (request.Receiver != null)
            record.Receiver = request.Receiver;
        if (request.Supervisor != null)
            record.Supervisor = request.Supervisor;

        await _db.SaveChangesAsync();
        return Ok(ApiResponse.Ok("تم تحديث السجل بنجاح"));
    }

    // تأكيد خروج الطالب (الحارس)
    [HttpPut("{id}/confirm")]
    public async Task<ActionResult<ApiResponse>> ConfirmExit(int id)
    {
        var record = await _db.PermissionRecords.FindAsync(id);
        if (record == null)
            return Ok(ApiResponse.Fail("السجل غير موجود"));

        record.ConfirmationTime = DateTime.Now.ToString("HH:mm");
        await _db.SaveChangesAsync();
        return Ok(ApiResponse.Ok("تم تأكيد الخروج"));
    }

    // تحديث حالة الإرسال
    [HttpPut("{id}/sent")]
    public async Task<ActionResult<ApiResponse>> UpdateSentStatus(int id, [FromBody] UpdateSentRequest request)
    {
        var record = await _db.PermissionRecords.FindAsync(id);
        if (record == null) return Ok(ApiResponse.Fail("السجل غير موجود"));
        record.IsSent = request.IsSent;
        await _db.SaveChangesAsync();
        return Ok(ApiResponse.Ok("تم تحديث حالة الإرسال"));
    }

    // تحديث حالة الإرسال - جماعي
    [HttpPut("sent-batch")]
    public async Task<ActionResult<ApiResponse<object>>> UpdateSentStatusBatch([FromBody] BulkIdsRequest request)
    {
        if (request.Ids == null || request.Ids.Count == 0)
            return Ok(ApiResponse<object>.Fail("لا توجد سجلات محددة"));

        var records = await _db.PermissionRecords
            .Where(r => request.Ids.Contains(r.Id))
            .ToListAsync();

        foreach (var r in records) r.IsSent = true;
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { updatedCount = records.Count }));
    }

    // إرسال واتساب
    [HttpPost("{id}/send-whatsapp")]
    public async Task<ActionResult<ApiResponse<object>>> SendWhatsApp(int id, [FromBody] SendPermWhatsAppRequest request)
    {
        var record = await _db.PermissionRecords.FindAsync(id);
        if (record == null) return Ok(ApiResponse<object>.Fail("السجل غير موجود"));

        if (string.IsNullOrEmpty(record.Mobile))
            return Ok(ApiResponse<object>.Fail("لا يوجد رقم جوال"));

        var settings = await _db.WhatsAppSettings.FirstOrDefaultAsync();
        if (settings == null || string.IsNullOrEmpty(settings.ServerUrl))
            return Ok(ApiResponse<object>.Fail("إعدادات الواتساب غير مكتملة"));

        var senderPhone = request.SenderPhone;
        if (string.IsNullOrEmpty(senderPhone))
        {
            var session = await _db.WhatsAppSessions
                .Where(s => s.IsPrimary && s.Stage == record.Stage.ToString())
                .FirstOrDefaultAsync();
            session ??= await _db.WhatsAppSessions.Where(s => s.IsPrimary).FirstOrDefaultAsync();
            senderPhone = session?.PhoneNumber ?? "";
        }

        if (string.IsNullOrEmpty(senderPhone))
            return Ok(ApiResponse<object>.Fail("لا يوجد رقم مرسل"));

        var message = request.Message ?? $"المكرم ولي أمر الطالب / {record.StudentName}\nالسلام عليكم\nنود إبلاغكم باستئذان ابنكم للخروج من المدرسة\nالسبب: {record.Reason}\nوقت الخروج: {record.ExitTime}\nالمستلم: {record.Receiver}\nالتاريخ: {record.HijriDate}\nنأمل التواصل مع المدرسة.";

        var sent = await _wa.SendMessageAsync(settings.ServerUrl, senderPhone, record.Mobile, message);

        if (sent)
        {
            record.IsSent = true;
            _db.CommunicationLogs.Add(new CommunicationLog
            {
                StudentId = record.StudentId, StudentNumber = record.StudentNumber,
                StudentName = record.StudentName, Grade = record.Grade, Class = record.Class,
                Stage = record.Stage, Mobile = record.Mobile,
                MessageType = "استئذان", MessageTitle = "استئذان خروج",
                MessageBody = message, SendStatus = "sent",
                MiladiDate = DateTime.UtcNow.ToString("yyyy-MM-dd"),
                SentBy = request.SentBy ?? ""
            });
            await _db.SaveChangesAsync();
        }

        return Ok(ApiResponse<object>.Ok(new { success = sent }));
    }

    // إرسال جماعي
    [HttpPost("send-whatsapp-bulk")]
    public async Task<ActionResult<ApiResponse<object>>> SendWhatsAppBulk([FromBody] BulkSendWhatsAppRequest request)
    {
        if (request.Ids == null || request.Ids.Count == 0)
            return Ok(ApiResponse<object>.Fail("لا توجد سجلات محددة"));

        var settings = await _db.WhatsAppSettings.FirstOrDefaultAsync();
        if (settings == null || string.IsNullOrEmpty(settings.ServerUrl))
            return Ok(ApiResponse<object>.Fail("إعدادات الواتساب غير مكتملة"));

        var records = await _db.PermissionRecords.Where(r => request.Ids.Contains(r.Id)).ToListAsync();
        int sentCount = 0, failedCount = 0;

        foreach (var record in records)
        {
            if (string.IsNullOrEmpty(record.Mobile)) { failedCount++; continue; }

            var senderPhone = request.SenderPhone;
            if (string.IsNullOrEmpty(senderPhone))
            {
                var session = await _db.WhatsAppSessions
                    .Where(s => s.IsPrimary && s.Stage == record.Stage.ToString())
                    .FirstOrDefaultAsync();
                session ??= await _db.WhatsAppSessions.Where(s => s.IsPrimary).FirstOrDefaultAsync();
                senderPhone = session?.PhoneNumber ?? "";
            }
            if (string.IsNullOrEmpty(senderPhone)) { failedCount++; continue; }

            var message = $"المكرم ولي أمر الطالب / {record.StudentName}\nالسلام عليكم\nنود إبلاغكم باستئذان ابنكم للخروج من المدرسة\nالسبب: {record.Reason}\nوقت الخروج: {record.ExitTime}\nالتاريخ: {record.HijriDate}";

            var sent = await _wa.SendMessageAsync(settings.ServerUrl, senderPhone, record.Mobile, message);
            if (sent)
            {
                record.IsSent = true;
                sentCount++;
                _db.CommunicationLogs.Add(new CommunicationLog
                {
                    StudentId = record.StudentId, StudentNumber = record.StudentNumber,
                    StudentName = record.StudentName, Grade = record.Grade, Class = record.Class,
                    Stage = record.Stage, Mobile = record.Mobile,
                    MessageType = "استئذان", MessageTitle = "استئذان خروج",
                    MessageBody = message, SendStatus = "sent",
                    MiladiDate = DateTime.UtcNow.ToString("yyyy-MM-dd"),
                    SentBy = request.SentBy ?? ""
                });
            }
            else failedCount++;
            await Task.Delay(100);
        }

        await _db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(new { sentCount, failedCount, total = records.Count }));
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiResponse>> Delete(int id)
    {
        var record = await _db.PermissionRecords.FindAsync(id);
        if (record == null) return Ok(ApiResponse.Fail("السجل غير موجود"));
        _db.PermissionRecords.Remove(record);
        await _db.SaveChangesAsync();
        return Ok(ApiResponse.Ok("تم حذف السجل بنجاح"));
    }

    [HttpPost("delete-bulk")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteBulk([FromBody] BulkIdsRequest request)
    {
        if (request.Ids == null || request.Ids.Count == 0)
            return Ok(ApiResponse<object>.Fail("لا توجد سجلات محددة"));
        var records = await _db.PermissionRecords.Where(r => request.Ids.Contains(r.Id)).ToListAsync();
        _db.PermissionRecords.RemoveRange(records);
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(new { deletedCount = records.Count }));
    }

    [HttpGet("student-count/{studentId}")]
    public async Task<ActionResult<ApiResponse<object>>> GetStudentCount(int studentId)
    {
        var count = await _db.PermissionRecords.CountAsync(r => r.StudentId == studentId);
        return Ok(ApiResponse<object>.Ok(new { total = count }));
    }

    // تقرير
    [HttpGet("report")]
    public async Task<ActionResult<ApiResponse<object>>> GetReport([FromQuery] string? stage = null)
    {
        var query = _db.PermissionRecords.AsQueryable();
        if (!string.IsNullOrEmpty(stage) && Enum.TryParse<Stage>(stage, true, out var stageEnum))
            query = query.Where(r => r.Stage == stageEnum);

        var records = await query.ToListAsync();

        var topStudents = records.GroupBy(r => new { r.StudentId, r.StudentName, r.Grade, r.Class })
            .Select(g => new { g.Key.StudentId, g.Key.StudentName, g.Key.Grade, className = g.Key.Class, count = g.Count() })
            .OrderByDescending(x => x.count).Take(10).ToList();

        var byClass = records.GroupBy(r => new { r.Grade, r.Class })
            .Select(g => new { g.Key.Grade, className = g.Key.Class, count = g.Count() })
            .OrderByDescending(x => x.count).ToList();

        var byReason = records.GroupBy(r => string.IsNullOrEmpty(r.Reason) ? "غير محدد" : r.Reason)
            .Select(g => new { reason = g.Key, count = g.Count() })
            .OrderByDescending(x => x.count).ToList();

        return Ok(ApiResponse<object>.Ok(new { total = records.Count, topStudents, byClass, byReason }));
    }

    // تصدير CSV
    [HttpGet("export")]
    public async Task<ActionResult> ExportCsv([FromQuery] string? stage = null)
    {
        var query = _db.PermissionRecords.AsQueryable();
        if (!string.IsNullOrEmpty(stage) && Enum.TryParse<Stage>(stage, true, out var stageEnum))
            query = query.Where(r => r.Stage == stageEnum);

        var records = await query.OrderByDescending(r => r.RecordedAt).ToListAsync();
        var sb = new StringBuilder();
        sb.AppendLine("رقم الطالب,اسم الطالب,الصف,الفصل,وقت الخروج,السبب,المستلم,التاريخ,التأكيد,تم الإرسال");
        foreach (var r in records)
        {
            sb.AppendLine($"\"{r.StudentNumber}\",\"{r.StudentName}\",\"{r.Grade}\",\"{r.Class}\",\"{r.ExitTime}\",\"{r.Reason}\",\"{r.Receiver}\",\"{r.HijriDate}\",\"{r.ConfirmationTime}\",{(r.IsSent ? "نعم" : "لا")}");
        }
        var bytes = Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(sb.ToString())).ToArray();
        return File(bytes, "text/csv; charset=utf-8", "permissions.csv");
    }
}

// ===== Request DTOs =====
public class PermissionRequest
{
    public int StudentId { get; set; }
    public string? ExitTime { get; set; }
    public string? Reason { get; set; }
    public string? Receiver { get; set; }
    public string? Supervisor { get; set; }
    public string? HijriDate { get; set; }
    public string? RecordedBy { get; set; }
}

public class PermissionBatchRequest
{
    public List<int> StudentIds { get; set; } = new();
    public string? ExitTime { get; set; }
    public string? Reason { get; set; }
    public string? Receiver { get; set; }
    public string? Supervisor { get; set; }
    public string? HijriDate { get; set; }
    public string? RecordedBy { get; set; }
}

public class PermissionUpdateRequest
{
    public string? ConfirmationTime { get; set; }
    public string? Reason { get; set; }
    public string? Receiver { get; set; }
    public string? Supervisor { get; set; }
}

public class SendPermWhatsAppRequest
{
    public string? SenderPhone { get; set; }
    public string? Message { get; set; }
    public string? SentBy { get; set; }
}
