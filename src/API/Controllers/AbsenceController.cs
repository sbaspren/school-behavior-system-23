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
public class AbsenceController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IWhatsAppServerService _wa;

    public AbsenceController(AppDbContext db, IWhatsAppServerService wa)
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
        [FromQuery] string? excuseType = null,
        [FromQuery] bool? isSent = null,
        [FromQuery] string? search = null)
    {
        var query = _db.DailyAbsences.AsQueryable();

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
        if (!string.IsNullOrEmpty(excuseType) && Enum.TryParse<ExcuseType>(excuseType, true, out var et))
            query = query.Where(r => r.ExcuseType == et);
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
                absenceType = r.AbsenceType.ToString(),
                r.Period, r.HijriDate, r.DayName,
                r.RecordedBy, r.RecordedAt,
                status = r.Status.ToString(),
                excuseType = r.ExcuseType.ToString(),
                r.IsSent, r.TardinessStatus, r.ArrivalTime,
                r.Notes, r.NoorStatus
            })
            .ToListAsync();

        return Ok(ApiResponse<List<object>>.Ok(records.Cast<object>().ToList()));
    }

    // إحصائيات اليوم
    [HttpGet("daily-stats")]
    public async Task<ActionResult<ApiResponse<object>>> GetDailyStats([FromQuery] string? stage = null)
    {
        var today = DateTime.UtcNow.Date;
        var query = _db.DailyAbsences.Where(r => r.RecordedAt >= today);

        if (!string.IsNullOrEmpty(stage) && Enum.TryParse<Stage>(stage, true, out var stageEnum))
            query = query.Where(r => r.Stage == stageEnum);

        var todayRecords = await query.ToListAsync();

        return Ok(ApiResponse<object>.Ok(new
        {
            todayCount = todayRecords.Count,
            sentCount = todayRecords.Count(r => r.IsSent),
            unsentCount = todayRecords.Count(r => !r.IsSent),
            excusedCount = todayRecords.Count(r => r.ExcuseType == ExcuseType.Excused),
            unexcusedCount = todayRecords.Count(r => r.ExcuseType == ExcuseType.Unexcused),
            lateCount = todayRecords.Count(r => r.TardinessStatus == "متأخر"),
        }));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse>> Add([FromBody] AbsenceRequest request)
    {
        if (request.StudentId <= 0)
            return Ok(ApiResponse.Fail("الطالب مطلوب"));

        var student = await _db.Students.FindAsync(request.StudentId);
        if (student == null)
            return Ok(ApiResponse.Fail("الطالب غير موجود"));

        if (!Enum.TryParse<AbsenceType>(request.AbsenceType, true, out var absenceType))
            absenceType = AbsenceType.FullDay;

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

        var record = new DailyAbsence
        {
            StudentId = request.StudentId,
            StudentNumber = student.StudentNumber,
            StudentName = student.Name,
            Grade = student.Grade,
            Class = student.Class,
            Stage = student.Stage,
            Mobile = student.Mobile,
            AbsenceType = absenceType,
            Period = request.Period ?? "",
            HijriDate = hijriDate,
            DayName = request.DayName ?? "",
            RecordedBy = request.RecordedBy ?? "",
            RecordedAt = DateTime.UtcNow,
            Notes = request.Notes ?? ""
        };

        _db.DailyAbsences.Add(record);
        await _db.SaveChangesAsync();

        await UpdateCumulativeAbsence(request.StudentId, student);

        return Ok(ApiResponse<object>.Ok(new { id = record.Id, message = "تم تسجيل الغياب بنجاح" }));
    }

    // حفظ جماعي
    [HttpPost("batch")]
    public async Task<ActionResult<ApiResponse<object>>> AddBatch([FromBody] AbsenceBatchRequest request)
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

        if (!Enum.TryParse<AbsenceType>(request.AbsenceType, true, out var absenceType))
            absenceType = AbsenceType.FullDay;

        var students = await _db.Students.Where(s => request.StudentIds.Contains(s.Id)).ToListAsync();
        var added = 0;

        foreach (var student in students)
        {
            _db.DailyAbsences.Add(new DailyAbsence
            {
                StudentId = student.Id,
                StudentNumber = student.StudentNumber,
                StudentName = student.Name,
                Grade = student.Grade,
                Class = student.Class,
                Stage = student.Stage,
                Mobile = student.Mobile,
                AbsenceType = absenceType,
                Period = request.Period ?? "",
                HijriDate = hijriDate,
                DayName = request.DayName ?? "",
                RecordedBy = request.RecordedBy ?? "",
                RecordedAt = DateTime.UtcNow,
                Notes = request.Notes ?? ""
            });
            added++;
        }

        await _db.SaveChangesAsync();

        foreach (var student in students)
            await UpdateCumulativeAbsence(student.Id, student);

        return Ok(ApiResponse<object>.Ok(new { addedCount = added, message = $"تم تسجيل {added} حالة غياب" }));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<ApiResponse>> Update(int id, [FromBody] AbsenceUpdateRequest request)
    {
        var record = await _db.DailyAbsences.FindAsync(id);
        if (record == null)
            return Ok(ApiResponse.Fail("السجل غير موجود"));

        if (request.Status != null && Enum.TryParse<AbsenceStatus>(request.Status, true, out var status))
            record.Status = status;
        if (request.ExcuseType != null && Enum.TryParse<ExcuseType>(request.ExcuseType, true, out var excuse))
            record.ExcuseType = excuse;
        if (request.Notes != null)
            record.Notes = request.Notes;
        if (request.TardinessStatus != null)
            record.TardinessStatus = request.TardinessStatus;
        if (request.ArrivalTime != null)
            record.ArrivalTime = request.ArrivalTime;
        if (request.NoorStatus != null)
            record.NoorStatus = request.NoorStatus;

        await _db.SaveChangesAsync();

        var student = await _db.Students.FindAsync(record.StudentId);
        if (student != null)
            await UpdateCumulativeAbsence(record.StudentId, student);

        return Ok(ApiResponse.Ok("تم تحديث السجل بنجاح"));
    }

    // تحديث حالة التأخر
    [HttpPut("{id}/late-status")]
    public async Task<ActionResult<ApiResponse>> UpdateLateStatus(int id, [FromBody] LateStatusRequest request)
    {
        var record = await _db.DailyAbsences.FindAsync(id);
        if (record == null) return Ok(ApiResponse.Fail("السجل غير موجود"));

        record.TardinessStatus = request.Status ?? "";
        record.ArrivalTime = request.ArrivalTime ?? "";
        await _db.SaveChangesAsync();
        return Ok(ApiResponse.Ok("تم تحديث حالة التأخر"));
    }

    // تبديل نوع العذر
    [HttpPut("{id}/excuse-type")]
    public async Task<ActionResult<ApiResponse>> UpdateExcuseType(int id, [FromBody] ExcuseTypeRequest request)
    {
        var record = await _db.DailyAbsences.FindAsync(id);
        if (record == null) return Ok(ApiResponse.Fail("السجل غير موجود"));

        if (Enum.TryParse<ExcuseType>(request.ExcuseType, true, out var et))
            record.ExcuseType = et;
        await _db.SaveChangesAsync();

        var student = await _db.Students.FindAsync(record.StudentId);
        if (student != null) await UpdateCumulativeAbsence(record.StudentId, student);

        return Ok(ApiResponse.Ok("تم تحديث نوع العذر"));
    }

    // تحديث حالة الإرسال
    [HttpPut("{id}/sent")]
    public async Task<ActionResult<ApiResponse>> UpdateSentStatus(int id, [FromBody] UpdateSentRequest request)
    {
        var record = await _db.DailyAbsences.FindAsync(id);
        if (record == null) return Ok(ApiResponse.Fail("السجل غير موجود"));
        record.IsSent = request.IsSent;
        await _db.SaveChangesAsync();
        return Ok(ApiResponse.Ok("تم تحديث حالة الإرسال"));
    }

    // إرسال واتساب
    [HttpPost("{id}/send-whatsapp")]
    public async Task<ActionResult<ApiResponse<object>>> SendWhatsApp(int id, [FromBody] SendAbsWhatsAppRequest request)
    {
        var record = await _db.DailyAbsences.FindAsync(id);
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

        // مطابق لـ sendSingleAbsenceWithLink في Server_Absence_Daily.gs سطر 753-829
        var message = request.Message;
        if (string.IsNullOrEmpty(message))
        {
            message = await BuildAbsenceWhatsAppMessage(record, request.IncludeLink);
        }

        var sent = await _wa.SendMessageAsync(settings.ServerUrl, senderPhone, record.Mobile, message);

        if (sent)
        {
            record.IsSent = true;
            _db.CommunicationLogs.Add(new CommunicationLog
            {
                StudentId = record.StudentId, StudentNumber = record.StudentNumber,
                StudentName = record.StudentName, Grade = record.Grade, Class = record.Class,
                Stage = record.Stage, Mobile = record.Mobile,
                MessageType = "غياب", MessageTitle = "إشعار غياب",
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

        var records = await _db.DailyAbsences.Where(r => request.Ids.Contains(r.Id)).ToListAsync();
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

            // مطابق لـ sendAbsenceNotifications في Server_Absence_Daily.gs سطر 630-733
            var message = await BuildAbsenceWhatsAppMessage(record, true);

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
                    MessageType = "غياب", MessageTitle = "إشعار غياب",
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
        var record = await _db.DailyAbsences.FindAsync(id);
        if (record == null) return Ok(ApiResponse.Fail("السجل غير موجود"));

        var sid = record.StudentId;
        _db.DailyAbsences.Remove(record);
        await _db.SaveChangesAsync();

        var student = await _db.Students.FindAsync(sid);
        if (student != null) await UpdateCumulativeAbsence(sid, student);

        return Ok(ApiResponse.Ok("تم حذف السجل بنجاح"));
    }

    [HttpPost("delete-bulk")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteBulk([FromBody] BulkIdsRequest request)
    {
        if (request.Ids == null || request.Ids.Count == 0)
            return Ok(ApiResponse<object>.Fail("لا توجد سجلات محددة"));
        var records = await _db.DailyAbsences.Where(r => request.Ids.Contains(r.Id)).ToListAsync();
        var studentIds = records.Select(r => r.StudentId).Distinct().ToList();
        _db.DailyAbsences.RemoveRange(records);
        await _db.SaveChangesAsync();

        foreach (var sid in studentIds)
        {
            var student = await _db.Students.FindAsync(sid);
            if (student != null) await UpdateCumulativeAbsence(sid, student);
        }

        return Ok(ApiResponse<object>.Ok(new { deletedCount = records.Count }));
    }

    [HttpGet("cumulative/{studentId}")]
    public async Task<ActionResult<ApiResponse<object>>> GetCumulative(int studentId)
    {
        var cumulative = await _db.CumulativeAbsences
            .Where(c => c.StudentId == studentId)
            .Select(c => new
            {
                c.ExcusedDays, c.UnexcusedDays, c.LateDays, c.LastUpdated
            })
            .FirstOrDefaultAsync();

        if (cumulative == null)
            return Ok(ApiResponse<object>.Ok(new { excusedDays = 0, unexcusedDays = 0, lateDays = 0 }));

        return Ok(ApiResponse<object>.Ok(cumulative));
    }

    // السجل التراكمي (جميع الطلاب)
    [HttpGet("cumulative")]
    public async Task<ActionResult<ApiResponse<List<object>>>> GetAllCumulative([FromQuery] string? stage = null)
    {
        var query = _db.CumulativeAbsences.AsQueryable();
        if (!string.IsNullOrEmpty(stage) && Enum.TryParse<Stage>(stage, true, out var stageEnum))
            query = query.Where(c => c.Stage == stageEnum);

        var records = await query
            .OrderByDescending(c => c.UnexcusedDays + c.ExcusedDays)
            .Select(c => new
            {
                c.StudentId, c.StudentNumber, c.StudentName,
                c.Grade, className = c.Class,
                stage = c.Stage.ToString(),
                c.ExcusedDays, c.UnexcusedDays, c.LateDays,
                totalDays = c.ExcusedDays + c.UnexcusedDays,
                c.LastUpdated
            })
            .ToListAsync();

        return Ok(ApiResponse<List<object>>.Ok(records.Cast<object>().ToList()));
    }

    [HttpGet("student-count/{studentId}")]
    public async Task<ActionResult<ApiResponse<object>>> GetStudentCount(int studentId)
    {
        var count = await _db.DailyAbsences.CountAsync(r => r.StudentId == studentId);
        var cumulative = await _db.CumulativeAbsences.FirstOrDefaultAsync(c => c.StudentId == studentId);
        return Ok(ApiResponse<object>.Ok(new
        {
            total = count,
            excused = cumulative?.ExcusedDays ?? 0,
            unexcused = cumulative?.UnexcusedDays ?? 0,
            late = cumulative?.LateDays ?? 0
        }));
    }

    // تقرير
    [HttpGet("report")]
    public async Task<ActionResult<ApiResponse<object>>> GetReport([FromQuery] string? stage = null)
    {
        var query = _db.DailyAbsences.AsQueryable();
        if (!string.IsNullOrEmpty(stage) && Enum.TryParse<Stage>(stage, true, out var stageEnum))
            query = query.Where(r => r.Stage == stageEnum);

        var records = await query.ToListAsync();

        var topStudents = records.GroupBy(r => new { r.StudentId, r.StudentName, r.Grade, r.Class })
            .Select(g => new
            {
                g.Key.StudentId, g.Key.StudentName, g.Key.Grade, className = g.Key.Class,
                count = g.Count(),
                excused = g.Count(r => r.ExcuseType == ExcuseType.Excused),
                unexcused = g.Count(r => r.ExcuseType == ExcuseType.Unexcused)
            })
            .OrderByDescending(x => x.count).Take(10).ToList();

        var byClass = records.GroupBy(r => new { r.Grade, r.Class })
            .Select(g => new { g.Key.Grade, className = g.Key.Class, count = g.Count() })
            .OrderByDescending(x => x.count).ToList();

        var byDay = records.GroupBy(r => string.IsNullOrEmpty(r.DayName) ? "غير محدد" : r.DayName)
            .Select(g => new { day = g.Key, count = g.Count() })
            .OrderByDescending(x => x.count).ToList();

        var byExcuse = records.GroupBy(r => r.ExcuseType)
            .Select(g => new { type = g.Key.ToString(), count = g.Count() })
            .ToList();

        return Ok(ApiResponse<object>.Ok(new
        {
            total = records.Count,
            excused = records.Count(r => r.ExcuseType == ExcuseType.Excused),
            unexcused = records.Count(r => r.ExcuseType == ExcuseType.Unexcused),
            topStudents, byClass, byDay, byExcuse
        }));
    }

    // تصدير CSV
    [HttpGet("export")]
    public async Task<ActionResult> ExportCsv([FromQuery] string? stage = null)
    {
        var query = _db.DailyAbsences.AsQueryable();
        if (!string.IsNullOrEmpty(stage) && Enum.TryParse<Stage>(stage, true, out var stageEnum))
            query = query.Where(r => r.Stage == stageEnum);

        var records = await query.OrderByDescending(r => r.RecordedAt).ToListAsync();
        var sb = new StringBuilder();
        sb.AppendLine("رقم الطالب,اسم الطالب,الصف,الفصل,النوع,العذر,الحالة,التاريخ,اليوم,تم الإرسال");
        foreach (var r in records)
        {
            sb.AppendLine($"\"{r.StudentNumber}\",\"{r.StudentName}\",\"{r.Grade}\",\"{r.Class}\",\"{r.AbsenceType}\",\"{r.ExcuseType}\",\"{r.Status}\",\"{r.HijriDate}\",\"{r.DayName}\",{(r.IsSent ? "نعم" : "لا")}");
        }
        var bytes = Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(sb.ToString())).ToArray();
        return File(bytes, "text/csv; charset=utf-8", "absence.csv");
    }

    // استيراد من نور (بيانات محللة من Excel)
    [HttpPost("import")]
    public async Task<ActionResult<ApiResponse<object>>> ImportFromExcel([FromBody] AbsenceImportRequest request)
    {
        if (request.Students == null || request.Students.Count == 0)
            return Ok(ApiResponse<object>.Fail("لا يوجد طلاب للاستيراد"));

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

        var dayName = request.DayName ?? "";
        var recorderLabel = request.Source == "platform" ? "استيراد منصة" : "مستورد من نظام نور";
        var notes = request.Source == "platform" ? "منصة" : "مستورد من نظام نور";
        int saved = 0, skipped = 0;

        foreach (var s in request.Students)
        {
            // Match by studentNumber first, then by name
            Student? student = null;
            if (!string.IsNullOrEmpty(s.StudentNumber))
                student = await _db.Students.FirstOrDefaultAsync(st => st.StudentNumber == s.StudentNumber);

            if (student == null && !string.IsNullOrEmpty(s.Name))
            {
                var normalName = NormalizeArabicName(s.Name);
                var firstName = s.Name.Split(' ')[0];
                var candidates = await _db.Students
                    .Where(st => st.Name.Contains(firstName))
                    .ToListAsync();
                student = candidates.FirstOrDefault(c => NormalizeArabicName(c.Name) == normalName);
            }

            if (student == null) { skipped++; continue; }

            if (!Enum.TryParse<AbsenceType>(s.AbsenceType, true, out var absType))
                absType = AbsenceType.FullDay;

            _db.DailyAbsences.Add(new DailyAbsence
            {
                StudentId = student.Id,
                StudentNumber = student.StudentNumber,
                StudentName = student.Name,
                Grade = student.Grade,
                Class = student.Class,
                Stage = student.Stage,
                Mobile = student.Mobile,
                AbsenceType = absType,
                Period = "",
                HijriDate = hijriDate,
                DayName = dayName,
                RecordedBy = recorderLabel,
                RecordedAt = DateTime.UtcNow,
                Notes = notes
            });
            saved++;
        }

        await _db.SaveChangesAsync();

        // Update cumulative for saved students
        var savedStudentIds = await _db.DailyAbsences
            .Where(a => a.Notes == notes && a.RecordedBy == recorderLabel)
            .OrderByDescending(a => a.RecordedAt)
            .Take(saved)
            .Select(a => a.StudentId)
            .Distinct()
            .ToListAsync();

        foreach (var sid in savedStudentIds)
        {
            var st = await _db.Students.FindAsync(sid);
            if (st != null) await UpdateCumulativeAbsence(sid, st);
        }

        return Ok(ApiResponse<object>.Ok(new
        {
            savedCount = saved,
            skippedCount = skipped,
            message = $"تم استيراد {saved} طالب ({skipped} لم يتم مطابقتهم)"
        }));
    }

    // تحديث السجل التراكمي يدوياً
    [HttpPut("cumulative/{studentId}")]
    public async Task<ActionResult<ApiResponse>> UpdateCumulativeManual(int studentId, [FromBody] CumulativeUpdateRequest request)
    {
        var student = await _db.Students.FindAsync(studentId);
        if (student == null) return Ok(ApiResponse.Fail("الطالب غير موجود"));

        var cumulative = await _db.CumulativeAbsences
            .FirstOrDefaultAsync(c => c.StudentId == studentId);

        if (cumulative == null)
        {
            cumulative = new CumulativeAbsence
            {
                StudentId = studentId,
                StudentNumber = student.StudentNumber,
                StudentName = student.Name,
                Grade = student.Grade,
                Class = student.Class,
                Stage = student.Stage
            };
            _db.CumulativeAbsences.Add(cumulative);
        }

        if (request.ExcusedDays.HasValue) cumulative.ExcusedDays = request.ExcusedDays.Value;
        if (request.UnexcusedDays.HasValue) cumulative.UnexcusedDays = request.UnexcusedDays.Value;
        if (request.LateDays.HasValue) cumulative.LateDays = request.LateDays.Value;
        cumulative.LastUpdated = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return Ok(ApiResponse.Ok("تم تحديث السجل التراكمي"));
    }

    // إحصائيات متقدمة مع فلترة الصف والفصل
    [HttpGet("statistics")]
    public async Task<ActionResult<ApiResponse<object>>> GetStatistics(
        [FromQuery] string? stage = null,
        [FromQuery] string? grade = null,
        [FromQuery] string? className = null,
        [FromQuery] string? dateFrom = null,
        [FromQuery] string? dateTo = null)
    {
        var query = _db.DailyAbsences.AsQueryable();

        if (!string.IsNullOrEmpty(stage) && Enum.TryParse<Stage>(stage, true, out var stageEnum))
            query = query.Where(r => r.Stage == stageEnum);
        if (!string.IsNullOrEmpty(grade))
            query = query.Where(r => r.Grade == grade);
        if (!string.IsNullOrEmpty(className))
            query = query.Where(r => r.Class == className);
        if (!string.IsNullOrEmpty(dateFrom))
            query = query.Where(r => string.Compare(r.HijriDate, dateFrom) >= 0);
        if (!string.IsNullOrEmpty(dateTo))
            query = query.Where(r => string.Compare(r.HijriDate, dateTo) <= 0);

        var records = await query.ToListAsync();

        var stats = new
        {
            total = records.Count,
            fullDay = records.Count(r => r.AbsenceType == AbsenceType.FullDay),
            period = records.Count(r => r.AbsenceType == AbsenceType.Period),
            excused = records.Count(r => r.ExcuseType == ExcuseType.Excused),
            unexcused = records.Count(r => r.ExcuseType == ExcuseType.Unexcused),
            approved = records.Count(r => r.Status == AbsenceStatus.Approved),
            pending = records.Count(r => r.Status == AbsenceStatus.Pending),
            byGrade = records.GroupBy(r => r.Grade)
                .Select(g => new { grade = g.Key, count = g.Count() })
                .OrderByDescending(x => x.count).ToList(),
            byClass = records.GroupBy(r => new { r.Grade, r.Class })
                .Select(g => new { g.Key.Grade, className = g.Key.Class, count = g.Count() })
                .OrderByDescending(x => x.count).ToList(),
            byDay = records.GroupBy(r => string.IsNullOrEmpty(r.DayName) ? "غير محدد" : r.DayName)
                .Select(g => new { day = g.Key, count = g.Count() })
                .OrderByDescending(x => x.count).ToList(),
            topStudents = records.GroupBy(r => new { r.StudentId, r.StudentName, r.Grade, r.Class })
                .Select(g => new { g.Key.StudentId, g.Key.StudentName, g.Key.Grade, className = g.Key.Class, count = g.Count() })
                .OrderByDescending(x => x.count).Take(10).ToList()
        };

        return Ok(ApiResponse<object>.Ok(stats));
    }

    [HttpGet("summary")]
    public async Task<ActionResult<ApiResponse<object>>> GetSummary(
        [FromQuery] string? stage = null,
        [FromQuery] string? hijriDate = null)
    {
        var query = _db.DailyAbsences.AsQueryable();

        if (!string.IsNullOrEmpty(stage) && Enum.TryParse<Stage>(stage, true, out var stageEnum))
            query = query.Where(r => r.Stage == stageEnum);
        if (!string.IsNullOrEmpty(hijriDate))
            query = query.Where(r => r.HijriDate == hijriDate);

        var total = await query.CountAsync();
        var byType = await query.GroupBy(r => r.AbsenceType)
            .Select(g => new { type = g.Key.ToString(), count = g.Count() })
            .ToListAsync();
        var byStatus = await query.GroupBy(r => r.Status)
            .Select(g => new { status = g.Key.ToString(), count = g.Count() })
            .ToListAsync();

        return Ok(ApiResponse<object>.Ok(new { total, byType, byStatus }));
    }

    private static string NormalizeArabicName(string name)
    {
        if (string.IsNullOrEmpty(name)) return "";
        return name
            .Replace("أ", "ا").Replace("إ", "ا").Replace("آ", "ا")
            .Replace("ى", "ي").Replace("ة", "ه")
            .Replace(" بن ", " ").Replace(" ابن ", " ")
            .Trim();
    }

    private async Task UpdateCumulativeAbsence(int studentId, Student student)
    {
        var absences = await _db.DailyAbsences
            .Where(a => a.StudentId == studentId && a.AbsenceType == AbsenceType.FullDay)
            .ToListAsync();

        var excused = absences.Count(a => a.ExcuseType == ExcuseType.Excused);
        var unexcused = absences.Count(a => a.ExcuseType == ExcuseType.Unexcused);
        var lateDays = await _db.TardinessRecords.CountAsync(t => t.StudentId == studentId);

        var cumulative = await _db.CumulativeAbsences
            .FirstOrDefaultAsync(c => c.StudentId == studentId);

        if (cumulative == null)
        {
            cumulative = new CumulativeAbsence
            {
                StudentId = studentId,
                StudentNumber = student.StudentNumber,
                StudentName = student.Name,
                Grade = student.Grade,
                Class = student.Class,
                Stage = student.Stage
            };
            _db.CumulativeAbsences.Add(cumulative);
        }

        cumulative.ExcusedDays = excused;
        cumulative.UnexcusedDays = unexcused;
        cumulative.LateDays = lateDays;
        cumulative.LastUpdated = DateTime.UtcNow;

        await _db.SaveChangesAsync();
    }

    // ════════════════════════════════════════════════════════════════
    // مطابق لبناء رسالة الواتساب في sendSingleAbsenceWithLink / sendAbsenceNotifications
    // Server_Absence_Daily.gs سطر 688-696 و 805-814
    // ════════════════════════════════════════════════════════════════
    private async Task<string> BuildAbsenceWhatsAppMessage(DailyAbsence record, bool includeLink)
    {
        var dayNames = new[] { "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت" };
        var now = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow,
            TimeZoneInfo.FindSystemTimeZoneById("Arab Standard Time"));
        var dayName = dayNames[(int)now.DayOfWeek];
        var hijriDate = record.HijriDate ?? now.ToString("yyyy/MM/dd");

        var sb = new StringBuilder();
        sb.AppendLine("📋 *إشعار غياب*");
        sb.AppendLine();
        sb.AppendLine("السلام عليكم ورحمة الله وبركاته");
        sb.AppendLine($"ولي أمر الطالب: *{record.StudentName}*");
        sb.AppendLine();
        sb.AppendLine($"نفيدكم بأن ابنكم *{record.StudentName}* غائب اليوم");
        sb.AppendLine($"📅 {dayName} - {hijriDate}");
        sb.Append($"الصف: {record.Grade} - الفصل: {record.Class}");

        // ★ توليد رابط تقديم العذر لولي الأمر — مطابق لـ getParentExcuseLink_ سطر 382
        if (includeLink && !string.IsNullOrEmpty(record.StudentNumber))
        {
            var code = Guid.NewGuid().ToString("N")[..16];
            var utcNow = DateTime.UtcNow;
            _db.ParentAccessCodes.Add(new ParentAccessCode
            {
                Code = code,
                StudentNumber = record.StudentNumber,
                Stage = record.Stage,
                CreatedAt = utcNow,
                ExpiresAt = utcNow.AddHours(24),
                IsUsed = false
            });
            await _db.SaveChangesAsync();

            // Build excuse link — frontend route for parent form
            var baseUrl = $"{Request.Scheme}://{Request.Host}";
            var excuseLink = $"{baseUrl}/parent-excuse?token={code}";

            sb.AppendLine();
            sb.AppendLine();
            sb.AppendLine("📝 *لتقديم عذر الغياب:*");
            sb.AppendLine("اضغط على الرابط التالي لكتابة عذر الغياب:");
            sb.AppendLine(excuseLink);
            sb.Append("⏳ الرابط صالح لمدة ٢٤ ساعة فقط");
        }

        // ★ اسم المدرسة — مطابق لـ getSchoolNameForLinks_
        var schoolSettings = await _db.SchoolSettings.FirstOrDefaultAsync();
        var schoolName = schoolSettings?.SchoolName ?? "المدرسة";
        sb.AppendLine();
        sb.AppendLine();
        sb.Append($"مع تحيات إدارة مدرسة {schoolName}");

        return sb.ToString();
    }
}

// ===== Request DTOs =====
public class AbsenceRequest
{
    public int StudentId { get; set; }
    public string? AbsenceType { get; set; }
    public string? Period { get; set; }
    public string? HijriDate { get; set; }
    public string? DayName { get; set; }
    public string? RecordedBy { get; set; }
    public string? Notes { get; set; }
}

public class AbsenceBatchRequest
{
    public List<int> StudentIds { get; set; } = new();
    public string? AbsenceType { get; set; }
    public string? Period { get; set; }
    public string? HijriDate { get; set; }
    public string? DayName { get; set; }
    public string? RecordedBy { get; set; }
    public string? Notes { get; set; }
}

public class AbsenceUpdateRequest
{
    public string? Status { get; set; }
    public string? ExcuseType { get; set; }
    public string? Notes { get; set; }
    public string? TardinessStatus { get; set; }
    public string? ArrivalTime { get; set; }
    public string? NoorStatus { get; set; }
}

public class LateStatusRequest
{
    public string? Status { get; set; }
    public string? ArrivalTime { get; set; }
}

public class ExcuseTypeRequest
{
    public string? ExcuseType { get; set; }
}

public class SendAbsWhatsAppRequest
{
    public string? SenderPhone { get; set; }
    public string? Message { get; set; }
    public string? SentBy { get; set; }
    public bool IncludeLink { get; set; } = true; // مطابق لـ sendSingleAbsenceWithLink: includeLink
}

public class AbsenceImportStudent
{
    public string? StudentNumber { get; set; }
    public string? Name { get; set; }
    public string? AbsenceType { get; set; }
}

public class AbsenceImportRequest
{
    public List<AbsenceImportStudent> Students { get; set; } = new();
    public string? HijriDate { get; set; }
    public string? DayName { get; set; }
    public string? Source { get; set; }    // "noor" or "platform"
}

public class CumulativeUpdateRequest
{
    public int? ExcusedDays { get; set; }
    public int? UnexcusedDays { get; set; }
    public int? LateDays { get; set; }
}
