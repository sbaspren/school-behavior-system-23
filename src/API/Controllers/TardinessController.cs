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
public class TardinessController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IWhatsAppServerService _wa;

    public TardinessController(AppDbContext db, IWhatsAppServerService wa)
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
        [FromQuery] string? tardinessType = null,
        [FromQuery] bool? isSent = null,
        [FromQuery] string? search = null)
    {
        var query = _db.TardinessRecords.AsQueryable();

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
        if (!string.IsNullOrEmpty(tardinessType) && Enum.TryParse<TardinessType>(tardinessType, true, out var tt))
            query = query.Where(r => r.TardinessType == tt);
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
                r.Mobile,
                tardinessType = r.TardinessType.ToString(),
                r.Period, r.HijriDate,
                r.RecordedBy, r.RecordedAt, r.IsSent
            })
            .ToListAsync();

        return Ok(ApiResponse<List<object>>.Ok(records.Cast<object>().ToList()));
    }

    // إحصائيات اليوم
    [HttpGet("daily-stats")]
    public async Task<ActionResult<ApiResponse<object>>> GetDailyStats([FromQuery] string? stage = null)
    {
        var today = DateTime.UtcNow.Date;
        var query = _db.TardinessRecords.Where(r => r.RecordedAt >= today);

        if (!string.IsNullOrEmpty(stage) && Enum.TryParse<Stage>(stage, true, out var stageEnum))
            query = query.Where(r => r.Stage == stageEnum);

        var todayRecords = await query.ToListAsync();

        return Ok(ApiResponse<object>.Ok(new
        {
            todayCount = todayRecords.Count,
            sentCount = todayRecords.Count(r => r.IsSent),
            unsentCount = todayRecords.Count(r => !r.IsSent),
            morningCount = todayRecords.Count(r => r.TardinessType == TardinessType.Morning),
            periodCount = todayRecords.Count(r => r.TardinessType == TardinessType.Period),
        }));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse>> Add([FromBody] TardinessRequest request)
    {
        if (request.StudentId <= 0)
            return Ok(ApiResponse.Fail("الطالب مطلوب"));

        var student = await _db.Students.FindAsync(request.StudentId);
        if (student == null)
            return Ok(ApiResponse.Fail("الطالب غير موجود"));

        if (!Enum.TryParse<TardinessType>(request.TardinessType, true, out var tardinessType))
            tardinessType = TardinessType.Morning;

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

        var record = new TardinessRecord
        {
            StudentId = request.StudentId,
            StudentNumber = student.StudentNumber,
            StudentName = student.Name,
            Grade = student.Grade,
            Class = student.Class,
            Stage = student.Stage,
            Mobile = student.Mobile,
            TardinessType = tardinessType,
            Period = request.Period ?? "",
            HijriDate = hijriDate,
            RecordedBy = request.RecordedBy ?? "",
            RecordedAt = DateTime.UtcNow
        };

        _db.TardinessRecords.Add(record);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { id = record.Id, message = "تم تسجيل التأخر بنجاح" }));
    }

    // حفظ جماعي (عدة طلاب دفعة واحدة)
    [HttpPost("batch")]
    public async Task<ActionResult<ApiResponse<object>>> AddBatch([FromBody] TardinessBatchRequest request)
    {
        if (request.StudentIds == null || request.StudentIds.Count == 0)
            return Ok(ApiResponse<object>.Fail("لا يوجد طلاب محددين"));

        if (!Enum.TryParse<TardinessType>(request.TardinessType, true, out var tardinessType))
            tardinessType = TardinessType.Morning;

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
            _db.TardinessRecords.Add(new TardinessRecord
            {
                StudentId = student.Id,
                StudentNumber = student.StudentNumber,
                StudentName = student.Name,
                Grade = student.Grade,
                Class = student.Class,
                Stage = student.Stage,
                Mobile = student.Mobile,
                TardinessType = tardinessType,
                Period = request.Period ?? "",
                HijriDate = hijriDate,
                RecordedBy = request.RecordedBy ?? "",
                RecordedAt = DateTime.UtcNow
            });
            added++;
        }

        await _db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(new { addedCount = added, message = $"تم تسجيل {added} حالة تأخر" }));
    }

    // تحديث حالة الإرسال
    [HttpPut("{id}/sent")]
    public async Task<ActionResult<ApiResponse>> UpdateSentStatus(int id, [FromBody] UpdateSentRequest request)
    {
        var record = await _db.TardinessRecords.FindAsync(id);
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

        var records = await _db.TardinessRecords
            .Where(r => request.Ids.Contains(r.Id))
            .ToListAsync();

        foreach (var r in records) r.IsSent = true;
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { updatedCount = records.Count }));
    }

    // إرسال واتساب
    [HttpPost("{id}/send-whatsapp")]
    public async Task<ActionResult<ApiResponse<object>>> SendWhatsApp(int id, [FromBody] SendTardinessWhatsAppRequest request)
    {
        var record = await _db.TardinessRecords.FindAsync(id);
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

        var typeLabel = record.TardinessType == TardinessType.Morning ? "تأخر صباحي" : "تأخر عن الحصة";
        var message = request.Message ?? $"المكرم ولي أمر الطالب / {record.StudentName}\nالسلام عليكم\nنود إبلاغكم بتسجيل {typeLabel} على ابنكم بتاريخ {record.HijriDate}\nنأمل التواصل مع المدرسة.";

        var sent = await _wa.SendMessageAsync(settings.ServerUrl, senderPhone, record.Mobile, message);

        if (sent)
        {
            record.IsSent = true;
            _db.CommunicationLogs.Add(new CommunicationLog
            {
                StudentId = record.StudentId,
                StudentNumber = record.StudentNumber,
                StudentName = record.StudentName,
                Grade = record.Grade,
                Class = record.Class,
                Stage = record.Stage,
                Mobile = record.Mobile,
                MessageType = "تأخر",
                MessageTitle = typeLabel,
                MessageBody = message,
                SendStatus = "sent",
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

        var records = await _db.TardinessRecords.Where(r => request.Ids.Contains(r.Id)).ToListAsync();
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

            var typeLabel = record.TardinessType == TardinessType.Morning ? "تأخر صباحي" : "تأخر عن الحصة";
            var message = $"المكرم ولي أمر الطالب / {record.StudentName}\nالسلام عليكم\nنود إبلاغكم بتسجيل {typeLabel} على ابنكم بتاريخ {record.HijriDate}\nنأمل التواصل مع المدرسة.";

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
                    MessageType = "تأخر", MessageTitle = typeLabel, MessageBody = message,
                    SendStatus = "sent", MiladiDate = DateTime.UtcNow.ToString("yyyy-MM-dd"),
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
        var record = await _db.TardinessRecords.FindAsync(id);
        if (record == null) return Ok(ApiResponse.Fail("السجل غير موجود"));
        _db.TardinessRecords.Remove(record);
        await _db.SaveChangesAsync();
        return Ok(ApiResponse.Ok("تم حذف السجل بنجاح"));
    }

    // حذف جماعي
    [HttpPost("delete-bulk")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteBulk([FromBody] BulkIdsRequest request)
    {
        if (request.Ids == null || request.Ids.Count == 0)
            return Ok(ApiResponse<object>.Fail("لا توجد سجلات محددة"));
        var records = await _db.TardinessRecords.Where(r => request.Ids.Contains(r.Id)).ToListAsync();
        _db.TardinessRecords.RemoveRange(records);
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(new { deletedCount = records.Count }));
    }

    [HttpGet("student-count/{studentId}")]
    public async Task<ActionResult<ApiResponse<object>>> GetStudentCount(int studentId)
    {
        var counts = await _db.TardinessRecords
            .Where(r => r.StudentId == studentId)
            .GroupBy(r => r.TardinessType)
            .Select(g => new { type = g.Key.ToString(), count = g.Count() })
            .ToListAsync();
        var total = counts.Sum(c => c.count);
        return Ok(ApiResponse<object>.Ok(new { total, byType = counts }));
    }

    // تقرير إحصائي
    [HttpGet("report")]
    public async Task<ActionResult<ApiResponse<object>>> GetReport([FromQuery] string? stage = null)
    {
        var query = _db.TardinessRecords.AsQueryable();
        if (!string.IsNullOrEmpty(stage) && Enum.TryParse<Stage>(stage, true, out var stageEnum))
            query = query.Where(r => r.Stage == stageEnum);

        var records = await query.ToListAsync();

        var topStudents = records.GroupBy(r => new { r.StudentId, r.StudentName, r.Grade, r.Class })
            .Select(g => new { g.Key.StudentId, g.Key.StudentName, g.Key.Grade, className = g.Key.Class, count = g.Count() })
            .OrderByDescending(x => x.count).Take(10).ToList();

        var byClass = records.GroupBy(r => new { r.Grade, r.Class })
            .Select(g => new { g.Key.Grade, className = g.Key.Class, count = g.Count() })
            .OrderByDescending(x => x.count).ToList();

        var byType = new
        {
            morning = records.Count(r => r.TardinessType == TardinessType.Morning),
            period = records.Count(r => r.TardinessType == TardinessType.Period),
            assembly = records.Count(r => r.TardinessType == TardinessType.Assembly),
        };

        return Ok(ApiResponse<object>.Ok(new { total = records.Count, topStudents, byClass, byType }));
    }

    // تصدير CSV
    [HttpGet("export")]
    public async Task<ActionResult> ExportCsv([FromQuery] string? stage = null)
    {
        var query = _db.TardinessRecords.AsQueryable();
        if (!string.IsNullOrEmpty(stage) && Enum.TryParse<Stage>(stage, true, out var stageEnum))
            query = query.Where(r => r.Stage == stageEnum);

        var records = await query.OrderByDescending(r => r.RecordedAt).ToListAsync();
        var sb = new StringBuilder();
        sb.AppendLine("رقم الطالب,اسم الطالب,الصف,الفصل,نوع التأخر,الحصة,التاريخ,تم الإرسال");
        foreach (var r in records)
        {
            var typeLabel = r.TardinessType == TardinessType.Morning ? "صباحي" : r.TardinessType == TardinessType.Period ? "حصة" : "اصطفاف";
            sb.AppendLine($"\"{r.StudentNumber}\",\"{r.StudentName}\",\"{r.Grade}\",\"{r.Class}\",\"{typeLabel}\",\"{r.Period}\",\"{r.HijriDate}\",{(r.IsSent ? "نعم" : "لا")}");
        }
        var bytes = Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(sb.ToString())).ToArray();
        return File(bytes, "text/csv; charset=utf-8", "tardiness.csv");
    }
}

// ===== Request DTOs =====
public class TardinessRequest
{
    public int StudentId { get; set; }
    public string? TardinessType { get; set; }
    public string? Period { get; set; }
    public string? HijriDate { get; set; }
    public string? RecordedBy { get; set; }
}

public class TardinessBatchRequest
{
    public List<int> StudentIds { get; set; } = new();
    public string? TardinessType { get; set; }
    public string? Period { get; set; }
    public string? HijriDate { get; set; }
    public string? RecordedBy { get; set; }
}

public class SendTardinessWhatsAppRequest
{
    public string? SenderPhone { get; set; }
    public string? Message { get; set; }
    public string? SentBy { get; set; }
}
