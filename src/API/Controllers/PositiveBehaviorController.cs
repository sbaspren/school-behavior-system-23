using Microsoft.AspNetCore.Authorization;
using System.Globalization;
using System.Text;
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
public class PositiveBehaviorController : ControllerBase
{
    private readonly AppDbContext _db;

    public PositiveBehaviorController(AppDbContext db)
    {
        _db = db;
    }

    // ─── GET ALL with filters ───
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<object>>>> GetAll(
        [FromQuery] string? stage = null,
        [FromQuery] string? grade = null,
        [FromQuery] string? className = null,
        [FromQuery] int? studentId = null,
        [FromQuery] string? search = null)
    {
        var query = _db.PositiveBehaviors.AsQueryable();

        if (!string.IsNullOrEmpty(stage) && Enum.TryParse<Stage>(stage, true, out var stageEnum))
            query = query.Where(r => r.Stage == stageEnum);
        if (!string.IsNullOrEmpty(grade))
            query = query.Where(r => r.Grade == grade);
        if (!string.IsNullOrEmpty(className))
            query = query.Where(r => r.Class == className);
        if (studentId.HasValue)
            query = query.Where(r => r.StudentId == studentId.Value);
        if (!string.IsNullOrEmpty(search))
            query = query.Where(r => r.StudentName.Contains(search) || r.StudentNumber.Contains(search));

        var records = await query
            .OrderByDescending(r => r.RecordedAt)
            .Select(r => new
            {
                r.Id, r.StudentId, r.StudentNumber, r.StudentName,
                r.Grade, className = r.Class,
                stage = r.Stage.ToString(),
                r.BehaviorType, r.Degree, r.Details, r.HijriDate,
                r.RecordedBy, r.RecordedAt, r.IsSent
            })
            .ToListAsync();

        return Ok(ApiResponse<List<object>>.Ok(records.Cast<object>().ToList()));
    }

    // ─── DAILY STATS ───
    [HttpGet("daily-stats")]
    public async Task<ActionResult<ApiResponse<object>>> GetDailyStats([FromQuery] string? stage = null)
    {
        var query = _db.PositiveBehaviors.AsQueryable();
        if (!string.IsNullOrEmpty(stage) && Enum.TryParse<Stage>(stage, true, out var stageEnum))
            query = query.Where(r => r.Stage == stageEnum);

        var all = await query.ToListAsync();
        var today = DateTime.UtcNow.Date;
        var todayCount = all.Count(r => r.RecordedAt >= today);
        var uniqueStudents = all.Select(r => r.StudentId).Distinct().Count();

        double totalDegrees = 0;
        foreach (var r in all)
        {
            if (double.TryParse(r.Degree, out var deg))
                totalDegrees += deg;
        }

        return Ok(ApiResponse<object>.Ok(new
        {
            totalRecords = all.Count,
            todayCount,
            uniqueStudents,
            totalDegrees
        }));
    }

    // ─── ADD (single) ───
    [HttpPost]
    public async Task<ActionResult<ApiResponse<object>>> Add([FromBody] PositiveBehaviorRequest request)
    {
        if (request.StudentId <= 0)
            return Ok(ApiResponse.Fail("الطالب مطلوب"));
        if (string.IsNullOrEmpty(request.BehaviorType))
            return Ok(ApiResponse.Fail("نوع السلوك مطلوب"));

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

        var record = new PositiveBehavior
        {
            StudentId = request.StudentId,
            StudentNumber = student.StudentNumber,
            StudentName = student.Name,
            Grade = student.Grade,
            Class = student.Class,
            Stage = student.Stage,
            BehaviorType = request.BehaviorType,
            Degree = request.Degree ?? "",
            Details = request.Details ?? "",
            HijriDate = hijriDate,
            RecordedBy = request.RecordedBy ?? "الوكيل",
            RecordedAt = DateTime.UtcNow
        };

        _db.PositiveBehaviors.Add(record);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { id = record.Id, message = "تم تسجيل السلوك الإيجابي بنجاح" }));
    }

    // ─── BATCH ADD ───
    [HttpPost("batch")]
    public async Task<ActionResult<ApiResponse<object>>> AddBatch([FromBody] PosBehaviorBatchRequest request)
    {
        if (request.StudentIds == null || request.StudentIds.Count == 0)
            return Ok(ApiResponse.Fail("لم يتم اختيار طلاب"));
        if (string.IsNullOrEmpty(request.BehaviorType))
            return Ok(ApiResponse.Fail("نوع السلوك مطلوب"));

        var students = await _db.Students
            .Where(s => request.StudentIds.Contains(s.Id))
            .ToListAsync();

        var cal = new UmAlQuraCalendar();
        var now = DateTime.Now;
        var hijriDate = request.HijriDate ?? $"{cal.GetYear(now)}/{cal.GetMonth(now):D2}/{cal.GetDayOfMonth(now):D2}";

        var records = students.Select(s => new PositiveBehavior
        {
            StudentId = s.Id,
            StudentNumber = s.StudentNumber,
            StudentName = s.Name,
            Grade = s.Grade,
            Class = s.Class,
            Stage = s.Stage,
            BehaviorType = request.BehaviorType,
            Degree = request.Degree ?? "",
            Details = request.Details ?? "",
            HijriDate = hijriDate,
            RecordedBy = request.RecordedBy ?? "الوكيل",
            RecordedAt = DateTime.UtcNow
        }).ToList();

        _db.PositiveBehaviors.AddRange(records);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { message = $"تم حفظ {records.Count} سجل بنجاح", count = records.Count }));
    }

    // ─── UPDATE ───
    [HttpPut("{id}")]
    public async Task<ActionResult<ApiResponse>> Update(int id, [FromBody] PositiveBehaviorRequest request)
    {
        var record = await _db.PositiveBehaviors.FindAsync(id);
        if (record == null)
            return Ok(ApiResponse.Fail("السجل غير موجود"));

        if (!string.IsNullOrEmpty(request.BehaviorType))
            record.BehaviorType = request.BehaviorType;
        if (request.Degree != null)
            record.Degree = request.Degree;
        if (!string.IsNullOrEmpty(request.Details))
            record.Details = request.Details;
        if (request.HijriDate != null)
            record.HijriDate = request.HijriDate;

        await _db.SaveChangesAsync();
        return Ok(ApiResponse.Ok("تم تحديث السجل بنجاح"));
    }

    // ─── DELETE ───
    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiResponse>> Delete(int id)
    {
        var record = await _db.PositiveBehaviors.FindAsync(id);
        if (record == null)
            return Ok(ApiResponse.Fail("السجل غير موجود"));

        _db.PositiveBehaviors.Remove(record);
        await _db.SaveChangesAsync();
        return Ok(ApiResponse.Ok("تم حذف السجل بنجاح"));
    }

    // ─── BULK DELETE ───
    [HttpPost("delete-bulk")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteBulk([FromBody] BulkIdsRequest request)
    {
        var records = await _db.PositiveBehaviors
            .Where(r => request.Ids.Contains(r.Id))
            .ToListAsync();

        _db.PositiveBehaviors.RemoveRange(records);
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(new { deleted = records.Count }));
    }

    // ─── STUDENT SUMMARY ───
    [HttpGet("student-summary/{studentId}")]
    public async Task<ActionResult<ApiResponse<object>>> GetStudentSummary(int studentId)
    {
        var records = await _db.PositiveBehaviors
            .Where(r => r.StudentId == studentId)
            .OrderByDescending(r => r.RecordedAt)
            .ToListAsync();

        var summary = new
        {
            total = records.Count,
            byType = records.GroupBy(r => r.BehaviorType)
                .Select(g => new { type = g.Key, count = g.Count() })
                .OrderByDescending(x => x.count)
                .ToList(),
            recent = records.Take(10)
                .Select(r => new { r.Id, r.BehaviorType, r.Details, r.HijriDate, r.RecordedAt, r.RecordedBy })
                .ToList()
        };

        return Ok(ApiResponse<object>.Ok(summary));
    }

    // ─── REPORT ───
    [HttpGet("report")]
    public async Task<ActionResult<ApiResponse<object>>> GetReport([FromQuery] string? stage = null)
    {
        var query = _db.PositiveBehaviors.AsQueryable();
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
            .GroupBy(r => r.BehaviorType)
            .Select(g => new { type = g.Key, count = g.Count() })
            .OrderByDescending(x => x.count)
            .ToList();

        return Ok(ApiResponse<object>.Ok(new
        {
            total = records.Count,
            uniqueStudents = records.Select(r => r.StudentId).Distinct().Count(),
            topStudents,
            byClass,
            byType
        }));
    }

    // ─── COMPENSATION (saveCompensationRecord) ───
    [HttpPost("compensation")]
    public async Task<ActionResult<ApiResponse<object>>> SaveCompensation([FromBody] CompensationRequest request)
    {
        if (request.StudentId <= 0)
            return Ok(ApiResponse.Fail("الطالب مطلوب"));
        if (string.IsNullOrEmpty(request.BehaviorText))
            return Ok(ApiResponse.Fail("نص السلوك التعويضي مطلوب"));

        var student = await _db.Students.FindAsync(request.StudentId);
        if (student == null)
            return Ok(ApiResponse.Fail("الطالب غير موجود"));

        // التحقق من المخالفة المرتبطة
        if (request.ViolationId.HasValue)
        {
            var violation = await _db.Violations.FindAsync(request.ViolationId.Value);
            if (violation == null)
                return Ok(ApiResponse.Fail("المخالفة المرتبطة غير موجودة"));
        }

        var hijriDate = "";
        try
        {
            var cal = new UmAlQuraCalendar();
            var now = DateTime.Now;
            hijriDate = $"{cal.GetYear(now)}/{cal.GetMonth(now):D2}/{cal.GetDayOfMonth(now):D2}";
        }
        catch { /* ignore */ }

        // بناء نص السلوك مع ربط المخالفة
        var behaviorNote = request.BehaviorText + " (فرص تعويض)";
        if (!string.IsNullOrEmpty(request.ViolationCode))
            behaviorNote += $" [مخالفة:{request.ViolationCode}]";

        var record = new PositiveBehavior
        {
            StudentId = student.Id,
            StudentNumber = student.StudentNumber,
            StudentName = student.Name,
            Grade = student.Grade,
            Class = student.Class,
            Stage = student.Stage,
            BehaviorType = behaviorNote,
            Degree = "تعويض",
            Details = request.NoorValue ?? "",
            HijriDate = hijriDate,
            RecordedBy = "الوكيل",
            RecordedAt = DateTime.UtcNow,
            LinkedViolationId = request.ViolationId
        };

        _db.PositiveBehaviors.Add(record);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new
        {
            message = "تم حفظ التعويض بنجاح",
            studentName = student.Name,
            behavior = request.BehaviorText
        }));
    }

    // ─── EXPORT CSV ───
    [HttpGet("export")]
    public async Task<IActionResult> ExportCsv([FromQuery] string? stage = null)
    {
        var query = _db.PositiveBehaviors.AsQueryable();
        if (!string.IsNullOrEmpty(stage) && Enum.TryParse<Stage>(stage, true, out var stageEnum))
            query = query.Where(r => r.Stage == stageEnum);

        var records = await query.OrderByDescending(r => r.RecordedAt).ToListAsync();

        var sb = new StringBuilder();
        sb.AppendLine("رقم الطالب,اسم الطالب,الصف,الفصل,السلوك المتمايز,الدرجة,التفاصيل,المعلم,التاريخ الهجري");

        foreach (var r in records)
        {
            sb.AppendLine($"\"{r.StudentNumber}\",\"{r.StudentName}\",\"{r.Grade}\",\"{r.Class}\",\"{r.BehaviorType}\",\"{r.Degree}\",\"{r.Details}\",\"{r.RecordedBy}\",\"{r.HijriDate}\"");
        }

        var bytes = Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(sb.ToString())).ToArray();
        return File(bytes, "text/csv; charset=utf-8", "positive_behavior.csv");
    }
}

// ─── DTOs ───
public class PositiveBehaviorRequest
{
    public int StudentId { get; set; }
    public string? BehaviorType { get; set; }
    public string? Degree { get; set; }
    public string? Details { get; set; }
    public string? HijriDate { get; set; }
    public string? RecordedBy { get; set; }
}

public class PosBehaviorBatchRequest
{
    public List<int> StudentIds { get; set; } = new();
    public string? BehaviorType { get; set; }
    public string? Degree { get; set; }
    public string? Details { get; set; }
    public string? HijriDate { get; set; }
    public string? RecordedBy { get; set; }
}

public class CompensationRequest
{
    public int StudentId { get; set; }
    public string? BehaviorText { get; set; }
    public string? NoorValue { get; set; }
    public int? ViolationId { get; set; }
    public string? ViolationCode { get; set; }
}
