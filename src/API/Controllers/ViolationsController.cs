using Microsoft.AspNetCore.Authorization;
using System.Globalization;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SchoolBehaviorSystem.Application.DTOs.Responses;
using SchoolBehaviorSystem.Application.Interfaces;
using SchoolBehaviorSystem.Domain.Entities;
using SchoolBehaviorSystem.Domain.Enums;
using SchoolBehaviorSystem.Domain.Rules;
using SchoolBehaviorSystem.Infrastructure.Data;

namespace SchoolBehaviorSystem.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class ViolationsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IWhatsAppServerService _wa;

    public ViolationsController(AppDbContext db, IWhatsAppServerService wa)
    {
        _db = db;
        _wa = wa;
    }

    // قائمة المخالفات مع فلترة
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<object>>>> GetViolations(
        [FromQuery] string? stage = null,
        [FromQuery] string? grade = null,
        [FromQuery] string? className = null,
        [FromQuery] int? studentId = null,
        [FromQuery] int? degree = null,
        [FromQuery] string? dateFrom = null,
        [FromQuery] string? dateTo = null,
        [FromQuery] string? search = null,
        [FromQuery] bool? isSent = null)
    {
        var query = _db.Violations.AsQueryable();

        if (!string.IsNullOrEmpty(stage) && Enum.TryParse<Stage>(stage, true, out var stageEnum))
            query = query.Where(v => v.Stage == stageEnum);
        if (!string.IsNullOrEmpty(grade))
            query = query.Where(v => v.Grade == grade);
        if (!string.IsNullOrEmpty(className))
            query = query.Where(v => v.Class == className);
        if (studentId.HasValue)
            query = query.Where(v => v.StudentId == studentId.Value);
        if (degree.HasValue)
            query = query.Where(v => (int)v.Degree == degree.Value);
        if (!string.IsNullOrEmpty(dateFrom))
            query = query.Where(v => string.Compare(v.HijriDate, dateFrom) >= 0);
        if (!string.IsNullOrEmpty(dateTo))
            query = query.Where(v => string.Compare(v.HijriDate, dateTo) <= 0);
        if (isSent.HasValue)
            query = query.Where(v => v.IsSent == isSent.Value);
        if (!string.IsNullOrEmpty(search))
        {
            var q = search.ToLower();
            query = query.Where(v =>
                v.StudentName.ToLower().Contains(q) ||
                v.StudentNumber.Contains(q) ||
                v.Description.ToLower().Contains(q));
        }

        var violations = await query
            .OrderByDescending(v => v.RecordedAt)
            .Select(v => new
            {
                v.Id, v.StudentId, v.StudentNumber, v.StudentName,
                v.Grade, className = v.Class,
                stage = v.Stage.ToString(),
                v.ViolationCode, v.Description,
                type = v.Type.ToString(),
                degree = (int)v.Degree,
                v.HijriDate, v.MiladiDate,
                v.Deduction, v.Procedures, v.Forms, v.DayName,
                v.RecordedBy, v.RecordedAt, v.IsSent, v.Notes
            })
            .ToListAsync();

        return Ok(ApiResponse<List<object>>.Ok(violations.Cast<object>().ToList()));
    }

    // إحصائيات اليوم — مطابق لـ getTodayViolationRecords: { today[], allCount, criticalCount }
    [HttpGet("daily-stats")]
    public async Task<ActionResult<ApiResponse<object>>> GetDailyStats([FromQuery] string? stage = null)
    {
        var baseQuery = _db.Violations.AsQueryable();

        if (!string.IsNullOrEmpty(stage) && Enum.TryParse<Stage>(stage, true, out var stageEnum))
            baseQuery = baseQuery.Where(v => v.Stage == stageEnum);

        // إجمالي الكل + المخالفات الخطيرة (درجة >= 4)
        var allCount = await baseQuery.CountAsync();
        var criticalCount = await baseQuery.CountAsync(v => (int)v.Degree >= 4);

        // مخالفات اليوم
        var today = DateTime.UtcNow.Date;
        var todayViolations = await baseQuery
            .Where(v => v.RecordedAt >= today)
            .OrderByDescending(v => v.RecordedAt)
            .Select(v => new
            {
                v.Id, v.StudentId, v.StudentNumber, v.StudentName,
                v.Grade, className = v.Class,
                stage = v.Stage.ToString(),
                v.ViolationCode, v.Description,
                type = v.Type.ToString(),
                degree = (int)v.Degree,
                v.HijriDate, v.MiladiDate,
                v.Deduction, v.Procedures, v.Forms, v.DayName,
                v.RecordedBy, v.RecordedAt, v.IsSent, v.Notes
            })
            .ToListAsync();

        return Ok(ApiResponse<object>.Ok(new
        {
            today = todayViolations,
            allCount,
            criticalCount,
            todayCount = todayViolations.Count,
            todayDeduction = todayViolations.Sum(v => v.Deduction),
            sentCount = todayViolations.Count(v => v.IsSent),
            unsentCount = todayViolations.Count(v => !v.IsSent),
            byDegree = Enumerable.Range(1, 5).Select(d => new
            {
                degree = d,
                count = todayViolations.Count(v => v.degree == d)
            }).Where(x => x.count > 0).ToList()
        }));
    }

    // عدد التكرارات لطالب معين بدرجة معينة (أو برمز المخالفة)
    [HttpGet("repetition")]
    public async Task<ActionResult<ApiResponse<object>>> GetRepetition(
        [FromQuery] int studentId, [FromQuery] int degree, [FromQuery] string? violationCode = null)
    {
        // الأصلي يحسب التكرار حسب رمز المخالفة (violationId)
        IQueryable<Violation> query;
        if (!string.IsNullOrEmpty(violationCode))
            query = _db.Violations.Where(v => v.StudentId == studentId && v.ViolationCode == violationCode);
        else
            query = _db.Violations.Where(v => v.StudentId == studentId && (int)v.Degree == degree);

        var previous = await query.OrderBy(v => v.RecordedAt).ToListAsync();
        var count = previous.Count;
        var nextRep = count + 1;
        var violationDegree = (ViolationDegree)degree;
        var deduction = DeductionRules.GetDeduction(violationDegree, nextRep);
        var procedures = ProcedureRules.GetProcedures(violationDegree, nextRep);

        // إجراءات آخر مخالفة سابقة (مطابق للأصلي)
        var previousProcedures = previous.Count > 0
            ? previous.Last().Procedures.Split(new[] { '\n', '،' }, StringSplitOptions.RemoveEmptyEntries)
            : Array.Empty<string>();

        return Ok(ApiResponse<object>.Ok(new
        {
            currentCount = count,
            nextRepetition = nextRep,
            deduction,
            procedures,
            previousProcedures
        }));
    }

    // تسجيل مخالفة جديدة
    [HttpPost]
    public async Task<ActionResult<ApiResponse>> AddViolation([FromBody] ViolationRequest request)
    {
        if (request.StudentId <= 0)
            return Ok(ApiResponse.Fail("الطالب مطلوب"));
        if (request.Degree < 1 || request.Degree > 5)
            return Ok(ApiResponse.Fail("الدرجة غير صالحة"));

        var student = await _db.Students.FindAsync(request.StudentId);
        if (student == null)
            return Ok(ApiResponse.Fail("الطالب غير موجود"));

        var degree = (ViolationDegree)request.Degree;

        // getEffectiveDegree: مرحلة ابتدائي قد تستخدم درجة مختلفة
        if (student.Stage == Stage.Primary && !string.IsNullOrEmpty(request.ViolationCode))
        {
            var violDef = await _db.ViolationTypeDefs
                .FirstOrDefaultAsync(v => v.Code == request.ViolationCode);
            if (violDef?.DegreeForPrimary != null)
                degree = violDef.DegreeForPrimary.Value;
        }

        // حساب التكرار حسب رمز المخالفة (مطابق للأصلي)
        var currentCount = !string.IsNullOrEmpty(request.ViolationCode)
            ? await _db.Violations.CountAsync(v => v.StudentId == request.StudentId && v.ViolationCode == request.ViolationCode)
            : await _db.Violations.CountAsync(v => v.StudentId == request.StudentId && v.Degree == degree);
        var repetition = currentCount + 1;

        // حساب الحسم والإجراءات تلقائياً
        var deduction = DeductionRules.GetDeduction(degree, repetition);
        var procedures = ProcedureRules.GetProcedures(degree, repetition);

        if (!Enum.TryParse<ViolationType>(request.Type, true, out var violationType))
            violationType = ViolationType.InPerson;

        // توليد التاريخ الهجري واسم اليوم تلقائياً
        var now = DateTime.Now;
        var hijriDate = request.HijriDate;
        if (string.IsNullOrEmpty(hijriDate))
        {
            try
            {
                var cal = new UmAlQuraCalendar();
                hijriDate = $"{cal.GetYear(now)}/{cal.GetMonth(now):D2}/{cal.GetDayOfMonth(now):D2}";
            }
            catch { hijriDate = ""; }
        }

        var dayName = now.ToString("dddd", new CultureInfo("ar-SA"));

        var violation = new Violation
        {
            StudentId = request.StudentId,
            StudentNumber = student.StudentNumber,
            StudentName = student.Name,
            Grade = student.Grade,
            Class = student.Class,
            Stage = student.Stage,
            ViolationCode = request.ViolationCode ?? "",
            Description = request.Description ?? "",
            Type = violationType,
            Degree = degree,
            HijriDate = hijriDate,
            MiladiDate = request.MiladiDate ?? DateTime.UtcNow.ToString("yyyy-MM-dd"),
            Deduction = deduction,
            Procedures = string.Join("،", procedures),
            Forms = request.Forms ?? "",
            DayName = dayName,
            RecordedBy = request.RecordedBy ?? "الوكيل",
            RecordedAt = DateTime.UtcNow,
            Notes = request.Notes ?? ""
        };

        _db.Violations.Add(violation);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new
        {
            id = violation.Id,
            repetition,
            deduction,
            procedures,
            message = "تم تسجيل المخالفة بنجاح"
        }));
    }

    // تسجيل مخالفة لعدة طلاب (saveViolationsBatch)
    [HttpPost("batch")]
    public async Task<ActionResult<ApiResponse<object>>> AddViolationsBatch([FromBody] ViolationBatchRequest request)
    {
        if (request.StudentIds == null || request.StudentIds.Count == 0)
            return Ok(ApiResponse<object>.Fail("الطلاب مطلوبين"));
        if (string.IsNullOrEmpty(request.ViolationCode))
            return Ok(ApiResponse<object>.Fail("رمز المخالفة مطلوب"));

        // البحث عن تعريف المخالفة
        var violDef = await _db.ViolationTypeDefs
            .FirstOrDefaultAsync(v => v.Code == request.ViolationCode);
        if (violDef == null)
            return Ok(ApiResponse<object>.Fail("المخالفة غير موجودة: " + request.ViolationCode));

        var degree = violDef.Degree;
        var now = DateTime.Now;
        var dayName = now.ToString("dddd", new CultureInfo("ar-SA"));

        // جلب الطلاب
        var students = await _db.Students
            .Where(s => request.StudentIds.Contains(s.Id))
            .ToListAsync();

        if (students.Count == 0)
            return Ok(ApiResponse<object>.Fail("لم يتم العثور على أي طالب"));

        // جلب مخالفات سابقة لنفس الرمز لحساب التكرار
        var existingCounts = await _db.Violations
            .Where(v => request.StudentIds.Contains(v.StudentId) && v.ViolationCode == request.ViolationCode)
            .GroupBy(v => v.StudentId)
            .Select(g => new { StudentId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.StudentId, x => x.Count);

        // التاريخ الهجري
        var hijriDate = "";
        try
        {
            var cal = new UmAlQuraCalendar();
            hijriDate = $"{cal.GetYear(now)}/{cal.GetMonth(now):D2}/{cal.GetDayOfMonth(now):D2}";
        }
        catch { /* ignore */ }

        var proceduresText = request.Procedures != null
            ? string.Join("\n", request.Procedures)
            : "";
        var formsText = request.Forms != null
            ? string.Join("\n", request.Forms)
            : "";

        // تتبع التكرار داخل الدفعة
        var batchRepeatAdded = new Dictionary<int, int>();
        var violations = new List<Violation>();

        foreach (var student in students)
        {
            // getEffectiveDegree: مرحلة ابتدائي قد تستخدم درجة مختلفة
            var effectiveDegree = (student.Stage == Stage.Primary && violDef.DegreeForPrimary != null)
                ? violDef.DegreeForPrimary.Value
                : degree;

            var existingCount = existingCounts.GetValueOrDefault(student.Id, 0);
            var batchCount = batchRepeatAdded.GetValueOrDefault(student.Id, 0);
            var repetition = existingCount + batchCount + 1;
            var deduction = DeductionRules.GetDeduction(effectiveDegree, repetition);
            var procs = proceduresText != ""
                ? proceduresText
                : string.Join("،", ProcedureRules.GetProcedures(effectiveDegree, repetition));

            if (!Enum.TryParse<ViolationType>(request.Type, true, out var violationType))
                violationType = ViolationType.InPerson;

            violations.Add(new Violation
            {
                StudentId = student.Id,
                StudentNumber = student.StudentNumber,
                StudentName = student.Name,
                Grade = student.Grade,
                Class = student.Class,
                Stage = student.Stage,
                ViolationCode = violDef.Code,
                Description = violDef.Description,
                Type = violationType,
                Degree = effectiveDegree,
                HijriDate = hijriDate,
                MiladiDate = DateTime.UtcNow.ToString("yyyy-MM-dd"),
                Deduction = deduction,
                Procedures = procs,
                Forms = formsText,
                DayName = dayName,
                RecordedBy = request.RecordedBy ?? "الوكيل",
                RecordedAt = DateTime.UtcNow,
                Notes = request.Notes ?? ""
            });

            batchRepeatAdded[student.Id] = batchCount + 1;
        }

        _db.Violations.AddRange(violations);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new
        {
            message = $"تم حفظ {violations.Count} مخالفة بنجاح",
            count = violations.Count
        }));
    }

    // مخالفات مؤهلة للتعويض (getCompensationEligibleRecords)
    [HttpGet("compensation-eligible")]
    public async Task<ActionResult<ApiResponse<object>>> GetCompensationEligible(
        [FromQuery] string? stage = null)
    {
        var query = _db.Violations.Where(v => v.Deduction > 0);

        if (!string.IsNullOrEmpty(stage) && Enum.TryParse<Stage>(stage, true, out var stageEnum))
            query = query.Where(v => v.Stage == stageEnum);

        var violations = await query
            .OrderBy(v => v.Grade).ThenBy(v => v.Class).ThenBy(v => v.StudentName)
            .ToListAsync();

        // جلب سجلات التعويض المرتبطة
        var violationIds = violations.Select(v => v.Id).ToList();
        var compensatedIdsList = await _db.PositiveBehaviors
            .Where(p => p.LinkedViolationId != null && violationIds.Contains(p.LinkedViolationId.Value))
            .Select(p => p.LinkedViolationId!.Value)
            .ToListAsync();
        var compensatedIds = new HashSet<int>(compensatedIdsList);

        // احتياطي: التعويض بالعدد (للسجلات القديمة بدون ربط مباشر)
        var compensationCountsByStudent = await _db.PositiveBehaviors
            .Where(p => p.LinkedViolationId == null
                && (p.BehaviorType.Contains("تعويض") || p.Degree == "تعويض"))
            .GroupBy(p => p.StudentId)
            .Select(g => new { StudentId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.StudentId, x => x.Count);

        var markedPerStudent = new Dictionary<int, int>();
        var records = new List<object>();
        int total = 0, compensated = 0, pending = 0;
        double totalPoints = 0;

        foreach (var v in violations)
        {
            var isCompensated = compensatedIds.Contains(v.Id);

            if (!isCompensated)
            {
                // احتياطي بالعدد
                var maxComp = compensationCountsByStudent.GetValueOrDefault(v.StudentId, 0);
                var alreadyMarked = markedPerStudent.GetValueOrDefault(v.StudentId, 0);
                if (alreadyMarked < maxComp)
                {
                    isCompensated = true;
                    markedPerStudent[v.StudentId] = alreadyMarked + 1;
                }
            }

            total++;
            totalPoints += v.Deduction;
            if (isCompensated) compensated++;
            else pending++;

            records.Add(new
            {
                id = v.Id,
                studentId = v.StudentId,
                studentName = v.StudentName,
                grade = v.Grade,
                section = v.Class,
                violationId = v.ViolationCode,
                violationText = v.Description,
                violationType = v.Type.ToString(),
                degree = (int)v.Degree,
                points = v.Deduction,
                dateHijri = v.HijriDate,
                dateMiladi = v.MiladiDate,
                repeatLevel = "1",
                compensated = isCompensated
            });
        }

        return Ok(ApiResponse<object>.Ok(new
        {
            records,
            stats = new { total, compensated, pending, totalPoints }
        }));
    }

    // تعديل مخالفة
    [HttpPut("{id}")]
    public async Task<ActionResult<ApiResponse>> UpdateViolation(int id, [FromBody] ViolationRequest request)
    {
        var violation = await _db.Violations.FindAsync(id);
        if (violation == null)
            return Ok(ApiResponse.Fail("المخالفة غير موجودة"));

        if (!string.IsNullOrEmpty(request.Description))
            violation.Description = request.Description;
        if (!string.IsNullOrEmpty(request.ViolationCode))
            violation.ViolationCode = request.ViolationCode;
        if (request.Notes != null)
            violation.Notes = request.Notes;
        if (!string.IsNullOrEmpty(request.Type) && Enum.TryParse<ViolationType>(request.Type, true, out var vt))
            violation.Type = vt;

        await _db.SaveChangesAsync();

        return Ok(ApiResponse.Ok("تم تحديث المخالفة بنجاح"));
    }

    // تحديث حالة الإرسال
    [HttpPut("{id}/sent")]
    public async Task<ActionResult<ApiResponse>> UpdateSentStatus(int id, [FromBody] UpdateSentRequest request)
    {
        var violation = await _db.Violations.FindAsync(id);
        if (violation == null)
            return Ok(ApiResponse.Fail("المخالفة غير موجودة"));

        violation.IsSent = request.IsSent;
        await _db.SaveChangesAsync();

        return Ok(ApiResponse.Ok("تم تحديث حالة الإرسال"));
    }

    // تحديث حالة الإرسال جماعي (updateViolationSentStatus)
    [HttpPut("sent-batch")]
    public async Task<ActionResult<ApiResponse>> UpdateSentBatch([FromBody] BulkIdsRequest request)
    {
        if (request.Ids == null || request.Ids.Count == 0)
            return Ok(ApiResponse.Fail("لا توجد مخالفات محددة"));

        var violations = await _db.Violations
            .Where(v => request.Ids.Contains(v.Id))
            .ToListAsync();

        foreach (var v in violations)
            v.IsSent = true;

        await _db.SaveChangesAsync();

        return Ok(ApiResponse.Ok($"تم تحديث {violations.Count} مخالفة"));
    }

    // إرسال واتساب لمخالفة
    [HttpPost("{id}/send-whatsapp")]
    public async Task<ActionResult<ApiResponse<object>>> SendWhatsApp(int id, [FromBody] SendViolationWhatsAppRequest request)
    {
        var violation = await _db.Violations.Include(v => v.Student).FirstOrDefaultAsync(v => v.Id == id);
        if (violation == null)
            return Ok(ApiResponse<object>.Fail("المخالفة غير موجودة"));

        var student = violation.Student;
        var phone = student?.Mobile ?? "";
        if (string.IsNullOrEmpty(phone))
            return Ok(ApiResponse<object>.Fail("لا يوجد رقم جوال لولي الأمر"));

        var settings = await _db.WhatsAppSettings.FirstOrDefaultAsync();
        if (settings == null || string.IsNullOrEmpty(settings.ServerUrl))
            return Ok(ApiResponse<object>.Fail("إعدادات الواتساب غير مكتملة"));

        // تحديد رقم المرسل
        var senderPhone = request.SenderPhone;
        if (string.IsNullOrEmpty(senderPhone))
        {
            var session = await _db.WhatsAppSessions
                .Where(s => s.IsPrimary && s.Stage == violation.Stage.ToString())
                .FirstOrDefaultAsync();
            session ??= await _db.WhatsAppSessions.Where(s => s.IsPrimary).FirstOrDefaultAsync();
            senderPhone = session?.PhoneNumber ?? "";
        }

        if (string.IsNullOrEmpty(senderPhone))
            return Ok(ApiResponse<object>.Fail("لا يوجد رقم مرسل متاح"));

        var message = request.Message ?? BuildDefaultMessage(violation);

        var sent = await _wa.SendMessageAsync(settings.ServerUrl, senderPhone, phone, message);

        if (sent)
        {
            violation.IsSent = true;
            await _db.SaveChangesAsync();

            // تسجيل في سجل التواصل
            _db.CommunicationLogs.Add(new CommunicationLog
            {
                StudentId = violation.StudentId,
                StudentNumber = violation.StudentNumber,
                StudentName = violation.StudentName,
                Grade = violation.Grade,
                Class = violation.Class,
                Stage = violation.Stage,
                Mobile = phone,
                MessageType = "مخالفة سلوكية",
                MessageTitle = $"مخالفة درجة {(int)violation.Degree}",
                MessageBody = message,
                SendStatus = "sent",
                MiladiDate = DateTime.UtcNow.ToString("yyyy-MM-dd"),
                SentBy = request.SentBy ?? ""
            });
            await _db.SaveChangesAsync();
        }

        return Ok(ApiResponse<object>.Ok(new { success = sent }));
    }

    // إرسال واتساب لعدة مخالفات (جماعي)
    [HttpPost("send-whatsapp-bulk")]
    public async Task<ActionResult<ApiResponse<object>>> SendWhatsAppBulk([FromBody] BulkSendWhatsAppRequest request)
    {
        if (request.Ids == null || request.Ids.Count == 0)
            return Ok(ApiResponse<object>.Fail("لا توجد مخالفات محددة"));

        var settings = await _db.WhatsAppSettings.FirstOrDefaultAsync();
        if (settings == null || string.IsNullOrEmpty(settings.ServerUrl))
            return Ok(ApiResponse<object>.Fail("إعدادات الواتساب غير مكتملة"));

        var violations = await _db.Violations
            .Include(v => v.Student)
            .Where(v => request.Ids.Contains(v.Id))
            .ToListAsync();

        int sentCount = 0, failedCount = 0;

        foreach (var violation in violations)
        {
            var phone = violation.Student?.Mobile ?? "";
            if (string.IsNullOrEmpty(phone)) { failedCount++; continue; }

            var senderPhone = request.SenderPhone;
            if (string.IsNullOrEmpty(senderPhone))
            {
                var session = await _db.WhatsAppSessions
                    .Where(s => s.IsPrimary && s.Stage == violation.Stage.ToString())
                    .FirstOrDefaultAsync();
                session ??= await _db.WhatsAppSessions.Where(s => s.IsPrimary).FirstOrDefaultAsync();
                senderPhone = session?.PhoneNumber ?? "";
            }

            if (string.IsNullOrEmpty(senderPhone)) { failedCount++; continue; }

            var message = BuildDefaultMessage(violation);
            var sent = await _wa.SendMessageAsync(settings.ServerUrl, senderPhone, phone, message);

            if (sent)
            {
                violation.IsSent = true;
                sentCount++;

                _db.CommunicationLogs.Add(new CommunicationLog
                {
                    StudentId = violation.StudentId,
                    StudentNumber = violation.StudentNumber,
                    StudentName = violation.StudentName,
                    Grade = violation.Grade,
                    Class = violation.Class,
                    Stage = violation.Stage,
                    Mobile = phone,
                    MessageType = "مخالفة سلوكية",
                    MessageTitle = $"مخالفة درجة {(int)violation.Degree}",
                    MessageBody = message,
                    SendStatus = "sent",
                    MiladiDate = DateTime.UtcNow.ToString("yyyy-MM-dd"),
                    SentBy = request.SentBy ?? ""
                });
            }
            else failedCount++;

            await Task.Delay(100); // تأخير بسيط بين الرسائل
        }

        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { sentCount, failedCount, total = violations.Count }));
    }

    // حذف مخالفة
    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiResponse>> DeleteViolation(int id)
    {
        var violation = await _db.Violations.FindAsync(id);
        if (violation == null)
            return Ok(ApiResponse.Fail("المخالفة غير موجودة"));

        _db.Violations.Remove(violation);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse.Ok("تم حذف المخالفة بنجاح"));
    }

    // حذف جماعي
    [HttpPost("delete-bulk")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteBulk([FromBody] BulkIdsRequest request)
    {
        if (request.Ids == null || request.Ids.Count == 0)
            return Ok(ApiResponse<object>.Fail("لا توجد مخالفات محددة"));

        var violations = await _db.Violations.Where(v => request.Ids.Contains(v.Id)).ToListAsync();
        _db.Violations.RemoveRange(violations);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { deletedCount = violations.Count }));
    }

    // قائمة أنواع المخالفات المعرّفة
    [HttpGet("types")]
    public async Task<ActionResult<ApiResponse<List<object>>>> GetViolationTypes()
    {
        var types = await _db.ViolationTypeDefs
            .OrderBy(t => t.Code)
            .Select(t => new
            {
                t.Id, t.Code, t.Description, t.Category,
                degree = (int)t.Degree
            })
            .ToListAsync();

        return Ok(ApiResponse<List<object>>.Ok(types.Cast<object>().ToList()));
    }

    // ملخص مخالفات طالب
    [HttpGet("student-summary/{studentId}")]
    public async Task<ActionResult<ApiResponse<object>>> GetStudentSummary(int studentId)
    {
        var violations = await _db.Violations
            .Where(v => v.StudentId == studentId)
            .ToListAsync();

        var summary = new
        {
            total = violations.Count,
            totalDeduction = violations.Sum(v => v.Deduction),
            behaviorScore = Math.Max(0, 100 - violations.Sum(v => v.Deduction)),
            byDegree = Enumerable.Range(1, 5).Select(d => new
            {
                degree = d,
                count = violations.Count(v => (int)v.Degree == d),
                deduction = violations.Where(v => (int)v.Degree == d).Sum(v => v.Deduction)
            }).Where(x => x.count > 0).ToList(),
            recent = violations.OrderByDescending(v => v.RecordedAt).Take(5).Select(v => new
            {
                v.Id, v.Description, degree = (int)v.Degree,
                v.Deduction, v.HijriDate, v.RecordedAt
            }).ToList()
        };

        return Ok(ApiResponse<object>.Ok(summary));
    }

    // تقرير إحصائي
    [HttpGet("report")]
    public async Task<ActionResult<ApiResponse<object>>> GetReport(
        [FromQuery] string? stage = null,
        [FromQuery] string? grade = null,
        [FromQuery] string? className = null,
        [FromQuery] string? dateFrom = null,
        [FromQuery] string? dateTo = null)
    {
        var query = _db.Violations.AsQueryable();

        if (!string.IsNullOrEmpty(stage) && Enum.TryParse<Stage>(stage, true, out var stageEnum))
            query = query.Where(v => v.Stage == stageEnum);
        if (!string.IsNullOrEmpty(grade))
            query = query.Where(v => v.Grade == grade);
        if (!string.IsNullOrEmpty(className))
            query = query.Where(v => v.Class == className);
        if (!string.IsNullOrEmpty(dateFrom) && DateTime.TryParse(dateFrom, out var from))
            query = query.Where(v => v.RecordedAt >= from);
        if (!string.IsNullOrEmpty(dateTo) && DateTime.TryParse(dateTo, out var to))
            query = query.Where(v => v.RecordedAt < to.AddDays(1));

        var violations = await query.ToListAsync();

        // أكثر الطلاب مخالفات
        var topStudents = violations
            .GroupBy(v => new { v.StudentId, v.StudentName, v.Grade, v.Class })
            .Select(g => new
            {
                g.Key.StudentId, g.Key.StudentName, g.Key.Grade, className = g.Key.Class,
                count = g.Count(),
                totalDeduction = g.Sum(v => v.Deduction),
                behaviorScore = Math.Max(0, 100 - g.Sum(v => v.Deduction))
            })
            .OrderByDescending(x => x.count)
            .Take(10)
            .ToList();

        // مخالفات حسب الفصل
        var byClass = violations
            .GroupBy(v => new { v.Grade, v.Class })
            .Select(g => new { g.Key.Grade, className = g.Key.Class, count = g.Count() })
            .OrderByDescending(x => x.count)
            .ToList();

        // مخالفات حسب الدرجة
        var byDegree = Enumerable.Range(1, 5).Select(d => new
        {
            degree = d,
            count = violations.Count(v => (int)v.Degree == d),
            deduction = violations.Where(v => (int)v.Degree == d).Sum(v => v.Deduction)
        }).ToList();

        // مخالفات حسب التاريخ (آخر 30 يوم)
        var last30 = violations
            .Where(v => v.RecordedAt >= DateTime.UtcNow.AddDays(-30))
            .GroupBy(v => v.MiladiDate)
            .Select(g => new { date = g.Key, count = g.Count() })
            .OrderBy(x => x.date)
            .ToList();

        // أكثر المخالفات شيوعاً
        var byDescription = violations
            .GroupBy(v => v.Description)
            .Select(g => new { description = g.Key, count = g.Count() })
            .OrderByDescending(x => x.count)
            .Take(5)
            .ToList();

        return Ok(ApiResponse<object>.Ok(new
        {
            total = violations.Count,
            totalDeduction = violations.Sum(v => v.Deduction),
            topStudents, byClass, byDegree, byDate = last30, byDescription
        }));
    }

    // تصدير CSV
    [HttpGet("export")]
    public async Task<ActionResult> ExportCsv([FromQuery] string? stage = null)
    {
        var query = _db.Violations.AsQueryable();

        if (!string.IsNullOrEmpty(stage) && Enum.TryParse<Stage>(stage, true, out var stageEnum))
            query = query.Where(v => v.Stage == stageEnum);

        var violations = await query.OrderByDescending(v => v.RecordedAt).ToListAsync();

        var sb = new StringBuilder();
        sb.AppendLine("رقم الطالب,اسم الطالب,الصف,الفصل,المخالفة,الدرجة,الحسم,الإجراءات,التاريخ,تم الإرسال");

        foreach (var v in violations)
        {
            sb.AppendLine($"\"{v.StudentNumber}\",\"{v.StudentName}\",\"{v.Grade}\",\"{v.Class}\",\"{v.Description}\",{(int)v.Degree},{v.Deduction},\"{v.Procedures}\",\"{v.HijriDate}\",{(v.IsSent ? "نعم" : "لا")}");
        }

        var bytes = Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(sb.ToString())).ToArray();
        return File(bytes, "text/csv; charset=utf-8", "violations.csv");
    }

    // ===== Helpers =====

    private static string BuildDefaultMessage(Violation v)
    {
        return $"المكرم ولي أمر الطالب / {v.StudentName}\n" +
               $"السلام عليكم ورحمة الله وبركاته\n" +
               $"نود إبلاغكم بتسجيل مخالفة سلوكية بحق ابنكم:\n" +
               $"المخالفة: {v.Description}\n" +
               $"الدرجة: {(int)v.Degree}\n" +
               $"الحسم: {v.Deduction} درجة\n" +
               $"التاريخ: {v.HijriDate}\n" +
               $"نأمل التواصل مع المدرسة لمتابعة الموضوع.";
    }
}

// ===== Request DTOs =====

public class ViolationRequest
{
    public int StudentId { get; set; }
    public string? ViolationCode { get; set; }
    public string? Description { get; set; }
    public string? Type { get; set; }
    public int Degree { get; set; }
    public string? HijriDate { get; set; }
    public string? MiladiDate { get; set; }
    public string? RecordedBy { get; set; }
    public string? Notes { get; set; }
    public string? Forms { get; set; }
}

public class UpdateSentRequest
{
    public bool IsSent { get; set; }
}

public class SendViolationWhatsAppRequest
{
    public string? SenderPhone { get; set; }
    public string? Message { get; set; }
    public string? SentBy { get; set; }
}

public class BulkSendWhatsAppRequest
{
    public List<int> Ids { get; set; } = new();
    public string? SenderPhone { get; set; }
    public string? SentBy { get; set; }
}

public class BulkIdsRequest
{
    public List<int> Ids { get; set; } = new();
}

public class ViolationBatchRequest
{
    public List<int> StudentIds { get; set; } = new();
    public string? ViolationCode { get; set; }
    public string? Type { get; set; }
    public List<string>? Procedures { get; set; }
    public List<string>? Forms { get; set; }
    public string? RecordedBy { get; set; }
    public string? Notes { get; set; }
}
