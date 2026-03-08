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
public class EducationalNotesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IWhatsAppServerService _whatsApp;

    public EducationalNotesController(AppDbContext db, IWhatsAppServerService whatsApp)
    {
        _db = db;
        _whatsApp = whatsApp;
    }

    // ─── GET ALL with filters ───
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<object>>>> GetAll(
        [FromQuery] string? stage = null,
        [FromQuery] string? grade = null,
        [FromQuery] string? className = null,
        [FromQuery] int? studentId = null,
        [FromQuery] string? noteType = null,
        [FromQuery] string? hijriDate = null,
        [FromQuery] bool? isSent = null,
        [FromQuery] string? search = null)
    {
        var query = _db.EducationalNotes.AsQueryable();

        if (!string.IsNullOrEmpty(stage) && Enum.TryParse<Stage>(stage, true, out var stageEnum))
            query = query.Where(r => r.Stage == stageEnum);
        if (!string.IsNullOrEmpty(grade))
            query = query.Where(r => r.Grade == grade);
        if (!string.IsNullOrEmpty(className))
            query = query.Where(r => r.Class == className);
        if (studentId.HasValue)
            query = query.Where(r => r.StudentId == studentId.Value);
        if (!string.IsNullOrEmpty(noteType))
            query = query.Where(r => r.NoteType == noteType);
        if (!string.IsNullOrEmpty(hijriDate))
            query = query.Where(r => r.HijriDate == hijriDate);
        if (isSent.HasValue)
            query = query.Where(r => r.IsSent == isSent.Value);
        if (!string.IsNullOrEmpty(search))
            query = query.Where(r => r.StudentName.Contains(search) || r.StudentNumber.Contains(search) || r.TeacherName.Contains(search));

        var records = await query
            .OrderByDescending(r => r.RecordedAt)
            .Select(r => new
            {
                r.Id, r.StudentId, r.StudentNumber, r.StudentName,
                r.Grade, className = r.Class,
                stage = r.Stage.ToString(),
                r.Mobile, r.NoteType, r.Details,
                r.TeacherName, r.HijriDate,
                r.RecordedAt, r.IsSent
            })
            .ToListAsync();

        return Ok(ApiResponse<List<object>>.Ok(records.Cast<object>().ToList()));
    }

    // ─── DAILY STATS — مطابق لـ getEducationalNotesStats + getTodayEducationalNotesRecords ───
    [HttpGet("daily-stats")]
    public async Task<ActionResult<ApiResponse<object>>> GetDailyStats([FromQuery] string? stage = null)
    {
        var baseQuery = _db.EducationalNotes.AsQueryable();
        if (!string.IsNullOrEmpty(stage) && Enum.TryParse<Stage>(stage, true, out var stageEnum))
            baseQuery = baseQuery.Where(r => r.Stage == stageEnum);

        var allRecords = await baseQuery.ToListAsync();

        var total = allRecords.Count;
        var sent = allRecords.Count(r => r.IsSent);
        var notSent = total - sent;

        // byType
        var byType = allRecords
            .GroupBy(r => string.IsNullOrEmpty(r.NoteType) ? "غير محدد" : r.NoteType)
            .ToDictionary(g => g.Key, g => g.Count());

        // byGrade
        var byGrade = allRecords
            .GroupBy(r => string.IsNullOrEmpty(r.Grade) ? "غير محدد" : r.Grade)
            .ToDictionary(g => g.Key, g => g.Count());

        // سجلات اليوم
        var today = DateTime.UtcNow.Date;
        var todayRecords = allRecords.Where(r => r.RecordedAt >= today).ToList();

        var todayList = todayRecords
            .OrderByDescending(r => r.RecordedAt)
            .Select(r => new
            {
                r.Id, r.StudentId, r.StudentNumber, r.StudentName,
                r.Grade, className = r.Class,
                stage = r.Stage.ToString(),
                r.Mobile, r.NoteType, r.Details,
                r.TeacherName, r.HijriDate,
                r.RecordedAt, r.IsSent
            }).ToList();

        return Ok(ApiResponse<object>.Ok(new
        {
            total,
            sent,
            notSent,
            byType,
            byGrade,
            todayCount = todayRecords.Count,
            today = todayList,
            totalCount = total,
            unsentCount = notSent,
            sentCount = sent
        }));
    }

    // ─── ADD (single) ───
    [HttpPost]
    public async Task<ActionResult<ApiResponse<object>>> Add([FromBody] EducationalNoteRequest request)
    {
        if (request.StudentId <= 0)
            return Ok(ApiResponse.Fail("الطالب مطلوب"));
        if (string.IsNullOrEmpty(request.NoteType))
            return Ok(ApiResponse.Fail("نوع الملاحظة مطلوب"));

        var student = await _db.Students.FindAsync(request.StudentId);
        if (student == null)
            return Ok(ApiResponse.Fail("الطالب غير موجود"));

        var hijriDate = request.HijriDate;
        if (string.IsNullOrEmpty(hijriDate))
        {
            var cal = new UmAlQuraCalendar();
            var now = DateTime.Now;
            hijriDate = $"{cal.GetYear(now)}/{cal.GetMonth(now):D2}/{cal.GetDayOfMonth(now):D2}";
        }

        var record = new EducationalNote
        {
            StudentId = request.StudentId,
            StudentNumber = student.StudentNumber,
            StudentName = student.Name,
            Grade = student.Grade,
            Class = student.Class,
            Stage = student.Stage,
            Mobile = student.Mobile,
            NoteType = request.NoteType,
            Details = request.Details ?? "",
            TeacherName = request.TeacherName ?? "الوكيل",
            HijriDate = hijriDate,
            RecordedAt = DateTime.UtcNow
        };

        _db.EducationalNotes.Add(record);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { id = record.Id, message = "تم تسجيل الملاحظة بنجاح" }));
    }

    // ─── BATCH ADD (multiple students) ───
    [HttpPost("batch")]
    public async Task<ActionResult<ApiResponse<object>>> AddBatch([FromBody] EduNoteBatchRequest request)
    {
        if (request.StudentIds == null || request.StudentIds.Count == 0)
            return Ok(ApiResponse.Fail("لم يتم اختيار طلاب"));
        if (string.IsNullOrEmpty(request.NoteType))
            return Ok(ApiResponse.Fail("نوع الملاحظة مطلوب"));

        var students = await _db.Students
            .Where(s => request.StudentIds.Contains(s.Id))
            .ToListAsync();

        var cal = new UmAlQuraCalendar();
        var now = DateTime.Now;
        var hijriDate = request.HijriDate ?? $"{cal.GetYear(now)}/{cal.GetMonth(now):D2}/{cal.GetDayOfMonth(now):D2}";

        var records = students.Select(s => new EducationalNote
        {
            StudentId = s.Id,
            StudentNumber = s.StudentNumber,
            StudentName = s.Name,
            Grade = s.Grade,
            Class = s.Class,
            Stage = s.Stage,
            Mobile = s.Mobile,
            NoteType = request.NoteType,
            Details = request.Details ?? "",
            TeacherName = request.TeacherName ?? "الوكيل",
            HijriDate = hijriDate,
            RecordedAt = DateTime.UtcNow
        }).ToList();

        _db.EducationalNotes.AddRange(records);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { message = $"تم حفظ {records.Count} ملاحظة بنجاح", count = records.Count }));
    }

    // ─── UPDATE ───
    [HttpPut("{id}")]
    public async Task<ActionResult<ApiResponse>> Update(int id, [FromBody] EducationalNoteRequest request)
    {
        var record = await _db.EducationalNotes.FindAsync(id);
        if (record == null)
            return Ok(ApiResponse.Fail("السجل غير موجود"));

        if (!string.IsNullOrEmpty(request.NoteType))
            record.NoteType = request.NoteType;
        if (!string.IsNullOrEmpty(request.Details))
            record.Details = request.Details;
        if (!string.IsNullOrEmpty(request.TeacherName))
            record.TeacherName = request.TeacherName;
        if (request.HijriDate != null)
            record.HijriDate = request.HijriDate;

        await _db.SaveChangesAsync();
        return Ok(ApiResponse.Ok("تم تحديث الملاحظة بنجاح"));
    }

    // ─── UPDATE SENT STATUS ───
    [HttpPut("{id}/sent")]
    public async Task<ActionResult<ApiResponse>> UpdateSentStatus(int id, [FromBody] UpdateSentRequest request)
    {
        var record = await _db.EducationalNotes.FindAsync(id);
        if (record == null)
            return Ok(ApiResponse.Fail("السجل غير موجود"));

        record.IsSent = request.IsSent;
        await _db.SaveChangesAsync();
        return Ok(ApiResponse.Ok("تم تحديث حالة الإرسال"));
    }

    // ─── BATCH UPDATE SENT STATUS ───
    [HttpPut("sent-batch")]
    public async Task<ActionResult<ApiResponse<object>>> UpdateSentStatusBatch([FromBody] BulkIdsRequest request)
    {
        if (request.Ids == null || request.Ids.Count == 0)
            return Ok(ApiResponse<object>.Fail("لا توجد سجلات محددة"));

        var records = await _db.EducationalNotes
            .Where(r => request.Ids.Contains(r.Id))
            .ToListAsync();

        foreach (var r in records) r.IsSent = true;
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { updatedCount = records.Count }));
    }

    // ─── MARK ALL STUDENT NOTES AS SENT (مطابق للأصلي: updateEduNoteSentStatus بمعرف الطالب) ───
    [HttpPut("sent-by-student/{studentId}")]
    public async Task<ActionResult<ApiResponse>> UpdateSentByStudent(int studentId)
    {
        var records = await _db.EducationalNotes
            .Where(r => r.StudentId == studentId && !r.IsSent)
            .ToListAsync();

        foreach (var r in records) r.IsSent = true;
        await _db.SaveChangesAsync();

        return Ok(ApiResponse.Ok($"تم تحديث {records.Count} ملاحظة للطالب"));
    }

    // ─── SEND WHATSAPP (individual) ───
    [HttpPost("{id}/send-whatsapp")]
    public async Task<ActionResult<ApiResponse<object>>> SendWhatsApp(int id,
        [FromBody] SendEduWhatsAppRequest? request = null)
    {
        var record = await _db.EducationalNotes.FindAsync(id);
        if (record == null)
            return Ok(ApiResponse.Fail("السجل غير موجود"));

        var phone = record.Mobile;
        if (string.IsNullOrEmpty(phone))
            return Ok(ApiResponse.Fail("لا يوجد رقم جوال لولي أمر الطالب"));

        var settings = await _db.WhatsAppSettings.FirstOrDefaultAsync();
        if (settings == null || string.IsNullOrEmpty(settings.ServerUrl))
            return Ok(ApiResponse<object>.Fail("إعدادات الواتساب غير مكتملة"));

        var senderPhone = request?.SenderPhone;
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

        var message = request?.Message ?? BuildEduWhatsAppMessage(record);

        var sent = await _whatsApp.SendMessageAsync(settings.ServerUrl, senderPhone, phone, message);

        if (sent)
        {
            record.IsSent = true;
            _db.CommunicationLogs.Add(new CommunicationLog
            {
                StudentId = record.StudentId, StudentNumber = record.StudentNumber,
                StudentName = record.StudentName, Grade = record.Grade, Class = record.Class,
                Stage = record.Stage, Mobile = phone,
                MessageType = "ملاحظة تربوية", MessageTitle = "إشعار ملاحظة تربوية",
                MessageBody = message, SendStatus = "sent",
                MiladiDate = DateTime.UtcNow.ToString("yyyy-MM-dd"),
                SentBy = request?.SentBy ?? "الوكيل"
            });
            await _db.SaveChangesAsync();
        }

        return Ok(ApiResponse<object>.Ok(new { success = sent }));
    }

    // ─── SEND WHATSAPP BULK ───
    [HttpPost("send-whatsapp-bulk")]
    public async Task<ActionResult<ApiResponse<object>>> SendWhatsAppBulk([FromBody] BulkSendWhatsAppRequest request)
    {
        var settings = await _db.WhatsAppSettings.FirstOrDefaultAsync();
        if (settings == null || string.IsNullOrEmpty(settings.ServerUrl))
            return Ok(ApiResponse<object>.Fail("إعدادات الواتساب غير مكتملة"));

        var records = await _db.EducationalNotes
            .Where(r => request.Ids.Contains(r.Id))
            .ToListAsync();

        var senderPhone = request.SenderPhone;
        if (string.IsNullOrEmpty(senderPhone))
        {
            var session = await _db.WhatsAppSessions.Where(s => s.IsPrimary).FirstOrDefaultAsync();
            senderPhone = session?.PhoneNumber ?? "";
        }

        int successCount = 0, failCount = 0;
        foreach (var record in records)
        {
            if (string.IsNullOrEmpty(record.Mobile)) { failCount++; continue; }

            var message = BuildEduWhatsAppMessage(record);
            var sent = await _whatsApp.SendMessageAsync(settings.ServerUrl, senderPhone, record.Mobile, message);

            if (sent)
            {
                record.IsSent = true;
                _db.CommunicationLogs.Add(new CommunicationLog
                {
                    StudentId = record.StudentId, StudentNumber = record.StudentNumber,
                    StudentName = record.StudentName, Grade = record.Grade, Class = record.Class,
                    Stage = record.Stage, Mobile = record.Mobile,
                    MessageType = "ملاحظة تربوية", MessageTitle = "إشعار ملاحظة تربوية",
                    MessageBody = message, SendStatus = "sent",
                    MiladiDate = DateTime.UtcNow.ToString("yyyy-MM-dd"),
                    SentBy = request.SentBy ?? "الوكيل"
                });
                successCount++;
            }
            else { failCount++; }
            await Task.Delay(100);
        }

        await _db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(new { success = successCount, fail = failCount, total = records.Count }));
    }

    // ─── DELETE ───
    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiResponse>> Delete(int id)
    {
        var record = await _db.EducationalNotes.FindAsync(id);
        if (record == null)
            return Ok(ApiResponse.Fail("السجل غير موجود"));

        _db.EducationalNotes.Remove(record);
        await _db.SaveChangesAsync();
        return Ok(ApiResponse.Ok("تم حذف الملاحظة بنجاح"));
    }

    // ─── BULK DELETE ───
    [HttpPost("delete-bulk")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteBulk([FromBody] BulkIdsRequest request)
    {
        var records = await _db.EducationalNotes
            .Where(r => request.Ids.Contains(r.Id))
            .ToListAsync();

        _db.EducationalNotes.RemoveRange(records);
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(new { deleted = records.Count }));
    }

    // ─── STUDENT SUMMARY ───
    [HttpGet("student-summary/{studentId}")]
    public async Task<ActionResult<ApiResponse<object>>> GetStudentSummary(int studentId)
    {
        var records = await _db.EducationalNotes
            .Where(r => r.StudentId == studentId)
            .OrderByDescending(r => r.RecordedAt)
            .ToListAsync();

        var summary = new
        {
            total = records.Count,
            sent = records.Count(r => r.IsSent),
            notSent = records.Count(r => !r.IsSent),
            byType = records.GroupBy(r => r.NoteType)
                .Select(g => new { type = g.Key, count = g.Count() })
                .ToList(),
            recent = records.Take(10)
                .Select(r => new { r.Id, r.NoteType, r.Details, r.TeacherName, r.HijriDate, r.RecordedAt, r.IsSent })
                .ToList()
        };

        return Ok(ApiResponse<object>.Ok(summary));
    }

    // ─── STUDENT COUNT ───
    [HttpGet("student-count/{studentId}")]
    public async Task<ActionResult<ApiResponse<object>>> GetStudentCount(int studentId)
    {
        var count = await _db.EducationalNotes.CountAsync(r => r.StudentId == studentId);
        return Ok(ApiResponse<object>.Ok(new { studentId, count }));
    }

    // ─── REPORT ───
    [HttpGet("report")]
    public async Task<ActionResult<ApiResponse<object>>> GetReport([FromQuery] string? stage = null)
    {
        var query = _db.EducationalNotes.AsQueryable();
        if (!string.IsNullOrEmpty(stage) && Enum.TryParse<Stage>(stage, true, out var stageEnum))
            query = query.Where(r => r.Stage == stageEnum);

        var records = await query.ToListAsync();

        var topStudents = records
            .GroupBy(r => new { r.StudentId, r.StudentName, r.Grade, r.Class })
            .Select(g => new { g.Key.StudentId, g.Key.StudentName, grade = g.Key.Grade, className = g.Key.Class, count = g.Count() })
            .OrderByDescending(x => x.count)
            .Take(10)
            .ToList();

        var byClass = records
            .GroupBy(r => r.Grade + " " + r.Class)
            .Select(g => new { className = g.Key, count = g.Count() })
            .OrderByDescending(x => x.count)
            .ToList();

        var byType = records
            .GroupBy(r => r.NoteType)
            .Select(g => new { type = g.Key, count = g.Count() })
            .OrderByDescending(x => x.count)
            .ToList();

        var byGrade = records
            .GroupBy(r => r.Grade)
            .Select(g => new { grade = g.Key, count = g.Count() })
            .OrderByDescending(x => x.count)
            .ToList();

        return Ok(ApiResponse<object>.Ok(new
        {
            total = records.Count,
            uniqueStudents = records.Select(r => r.StudentId).Distinct().Count(),
            sent = records.Count(r => r.IsSent),
            unsent = records.Count(r => !r.IsSent),
            topStudents,
            byClass,
            byGrade,
            byType
        }));
    }

    // ─── NOTE TYPES (CRUD) ───
    [HttpGet("types")]
    public async Task<ActionResult<ApiResponse<List<string>>>> GetTypes([FromQuery] string? stage = null)
    {
        var query = _db.NoteTypeDefs.AsQueryable();
        if (!string.IsNullOrEmpty(stage) && Enum.TryParse<Stage>(stage, true, out var stageEnum))
            query = query.Where(t => t.Stage == stageEnum);

        var types = await query.Select(t => t.NoteType).ToListAsync();

        if (types.Count == 0)
        {
            types = GetDefaultNoteTypes();
        }

        return Ok(ApiResponse<List<string>>.Ok(types));
    }

    [HttpPost("types")]
    public async Task<ActionResult<ApiResponse>> SaveTypes([FromBody] SaveNoteTypesRequest request)
    {
        if (string.IsNullOrEmpty(request.Stage) || !Enum.TryParse<Stage>(request.Stage, true, out var stageEnum))
            return Ok(ApiResponse.Fail("المرحلة مطلوبة"));

        var existing = await _db.NoteTypeDefs.Where(t => t.Stage == stageEnum).ToListAsync();
        _db.NoteTypeDefs.RemoveRange(existing);

        foreach (var type in request.Types ?? new List<string>())
        {
            _db.NoteTypeDefs.Add(new NoteTypeDef
            {
                Stage = stageEnum,
                NoteType = type,
                CreatedAt = DateTime.UtcNow
            });
        }

        await _db.SaveChangesAsync();
        return Ok(ApiResponse.Ok("تم حفظ الأنواع بنجاح"));
    }

    // ─── EXPORT CSV ───
    [HttpGet("export")]
    public async Task<IActionResult> ExportCsv([FromQuery] string? stage = null)
    {
        var query = _db.EducationalNotes.AsQueryable();
        if (!string.IsNullOrEmpty(stage) && Enum.TryParse<Stage>(stage, true, out var stageEnum))
            query = query.Where(r => r.Stage == stageEnum);

        var records = await query.OrderByDescending(r => r.RecordedAt).ToListAsync();

        var sb = new StringBuilder();
        sb.AppendLine("رقم الطالب,اسم الطالب,الصف,الفصل,نوع الملاحظة,التفاصيل,المسجل,التاريخ الهجري,تم الإرسال");

        foreach (var r in records)
        {
            sb.AppendLine($"\"{r.StudentNumber}\",\"{r.StudentName}\",\"{r.Grade}\",\"{r.Class}\",\"{r.NoteType}\",\"{r.Details}\",\"{r.TeacherName}\",\"{r.HijriDate}\",\"{(r.IsSent ? "نعم" : "لا")}\"");
        }

        var bytes = Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(sb.ToString())).ToArray();
        return File(bytes, "text/csv; charset=utf-8", "educational_notes.csv");
    }

    // ─── Helper ───
    private string BuildEduWhatsAppMessage(EducationalNote record)
    {
        return $"*إشعار ملاحظة تربوية*\n\nالسلام عليكم ورحمة الله وبركاته\nولي أمر الطالب: *{record.StudentName}*\nالصف: {record.Grade} - الفصل: {record.Class}\n\nنود إبلاغكم بتسجيل ملاحظة تربوية على ابنكم:\n*نوع الملاحظة:* {record.NoteType}{(string.IsNullOrEmpty(record.Details) ? "" : $"\n*التفاصيل:* {record.Details}")}\n\n*التاريخ:* {record.HijriDate}\n\nنأمل متابعة الطالب والتواصل مع المدرسة.";
    }

    private static List<string> GetDefaultNoteTypes() => new()
    {
        "عدم حل الواجب",
        "عدم الحفظ",
        "عدم المشاركة والتفاعل",
        "عدم إحضار الكتاب الدراسي",
        "عدم إحضار الدفتر",
        "كثرة السرحان داخل الفصل",
        "عدم إحضار أدوات الرسم",
        "عدم إحضار الأدوات الهندسية",
        "عدم إحضار الملابس الرياضية",
        "النوم داخل الفصل",
        "عدم تدوين الملاحظات مع المعلم",
        "إهمال تسليم البحوث والمشاريع",
        "عدم المذاكرة للاختبارات القصيرة",
        "الانشغال بمادة أخرى أثناء الحصة",
        "عدم تصحيح الأخطاء في الدفتر",
        "عدم إحضار ملف الإنجاز"
    };
}

// ─── DTOs ───
public class EducationalNoteRequest
{
    public int StudentId { get; set; }
    public string? NoteType { get; set; }
    public string? Details { get; set; }
    public string? TeacherName { get; set; }
    public string? HijriDate { get; set; }
}

public class EduNoteBatchRequest
{
    public List<int> StudentIds { get; set; } = new();
    public string? NoteType { get; set; }
    public string? Details { get; set; }
    public string? TeacherName { get; set; }
    public string? HijriDate { get; set; }
}

public class SendEduWhatsAppRequest
{
    public string? SenderPhone { get; set; }
    public string? Message { get; set; }
    public string? SentBy { get; set; }
}

public class SaveNoteTypesRequest
{
    public string? Stage { get; set; }
    public List<string>? Types { get; set; }
}
