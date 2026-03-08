using System.Globalization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SchoolBehaviorSystem.Application.DTOs.Responses;
using SchoolBehaviorSystem.Domain.Entities;
using SchoolBehaviorSystem.Domain.Enums;
using SchoolBehaviorSystem.Infrastructure.Data;

namespace SchoolBehaviorSystem.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class StaffInputController : ControllerBase
{
    private readonly AppDbContext _db;
    public StaffInputController(AppDbContext db) => _db = db;

    // ── 1. Verify staff token ──
    [HttpGet("public/verify")]
    public async Task<ActionResult<ApiResponse<object>>> Verify([FromQuery] string token)
    {
        if (string.IsNullOrEmpty(token))
            return BadRequest(ApiResponse<object>.Fail("الرمز مطلوب"));

        var user = await _db.Users
            .FirstOrDefaultAsync(u => u.TokenLink == token && u.IsActive);

        if (user == null)
            return NotFound(ApiResponse<object>.Fail("رابط غير صالح أو المستخدم غير فعال"));

        var schoolSettings = await _db.SchoolSettings.FirstOrDefaultAsync();

        // Determine staff permissions based on role
        var role = user.Role.ToString();
        var isGuard = user.Role == UserRole.Guard;
        var permissions = GetStaffPermissions(user.Role);

        // ★ gradeMap: مطابق للأصلي — كل مرحلة → قائمة أسماء الصفوف
        var stageConfigs = await _db.StageConfigs
            .Include(sc => sc.Grades)
            .Where(sc => sc.IsEnabled)
            .ToListAsync();

        var gradeMap = new Dictionary<string, List<string>>();
        var enabledStages = new List<string>();
        foreach (var sc in stageConfigs)
        {
            var stageArabic = sc.Stage.ToArabic();
            enabledStages.Add(stageArabic);
            gradeMap[stageArabic] = sc.Grades
                .Where(g => g.IsEnabled && g.ClassCount > 0)
                .OrderBy(g => g.Id)
                .Select(g => g.GradeName)
                .ToList();
        }

        return Ok(ApiResponse<object>.Ok(new
        {
            success = true,
            sn = schoolSettings?.SchoolName ?? "",
            staff = new
            {
                id = user.Id,
                name = user.Name,
                role,
                permissions,
                isGuard
            },
            gradeMap,
            enabledStages,
            token
        }));
    }

    // ── 2. Get all students grouped by stage → grade → class ──
    [HttpGet("public/students")]
    public async Task<ActionResult<ApiResponse<object>>> GetStudents([FromQuery] string token)
    {
        if (string.IsNullOrEmpty(token))
            return BadRequest(ApiResponse<object>.Fail("الرمز مطلوب"));

        var user = await _db.Users
            .FirstOrDefaultAsync(u => u.TokenLink == token && u.IsActive);

        if (user == null)
            return NotFound(ApiResponse<object>.Fail("رابط غير صالح"));

        // Get enabled stages from config
        var stageConfigs = await _db.StageConfigs
            .Include(sc => sc.Grades)
            .Where(sc => sc.IsEnabled)
            .ToListAsync();

        var result = new Dictionary<string, object>();

        foreach (var sc in stageConfigs)
        {
            var stage = sc.Stage;
            var stageArabic = stage.ToArabic();

            var enabledGrades = new HashSet<string>(
                sc.Grades.Where(g => g.IsEnabled && g.ClassCount > 0).Select(g => g.GradeName));

            // Get students for this stage
            var students = await _db.Students
                .Where(s => s.Stage == stage)
                .OrderBy(s => s.Grade).ThenBy(s => s.Class).ThenBy(s => s.Name)
                .Select(s => new { s.Id, s.StudentNumber, s.Name, s.Grade, s.Class, s.Mobile })
                .ToListAsync();

            // Group by grade → class
            var gradeMap = new Dictionary<string, Dictionary<string, List<object>>>();

            foreach (var student in students)
            {
                if (!enabledGrades.Contains(student.Grade)) continue;

                if (!gradeMap.ContainsKey(student.Grade))
                    gradeMap[student.Grade] = new Dictionary<string, List<object>>();

                if (!gradeMap[student.Grade].ContainsKey(student.Class))
                    gradeMap[student.Grade][student.Class] = new List<object>();

                gradeMap[student.Grade][student.Class].Add(new
                {
                    id = student.Id,
                    num = student.StudentNumber,
                    name = student.Name,
                    phone = student.Mobile
                });
            }

            result[stageArabic] = gradeMap;
        }

        return Ok(ApiResponse<object>.Ok(result));
    }

    // ── 3. Save permission records (staff) ──
    [HttpPost("public/permission")]
    public async Task<ActionResult<ApiResponse<object>>> SavePermission([FromBody] StaffPermissionRequest request)
    {
        if (string.IsNullOrEmpty(request.Token))
            return BadRequest(ApiResponse<object>.Fail("الرمز مطلوب"));

        var user = await _db.Users
            .FirstOrDefaultAsync(u => u.TokenLink == request.Token && u.IsActive);

        if (user == null)
            return NotFound(ApiResponse<object>.Fail("رابط غير صالح"));

        if (request.StudentIds == null || request.StudentIds.Count == 0)
            return BadRequest(ApiResponse<object>.Fail("لم يتم اختيار طلاب"));

        var hijriDate = GetHijriDate();
        var students = await _db.Students
            .Where(s => request.StudentIds.Contains(s.Id))
            .ToListAsync();

        int saved = 0;

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
                ExitTime = DateTime.Now.ToString("HH:mm"),
                Reason = request.Reason ?? "",
                Receiver = request.Guardian ?? "",
                Supervisor = user.Name,
                HijriDate = hijriDate,
                RecordedBy = user.Name,
                RecordedAt = DateTime.UtcNow
            });
            saved++;
        }

        await _db.SaveChangesAsync();

        // ★ تسجيل النشاط — مطابق لـ logStaffActivity_ الأصلي
        await LogStaffActivity(user.Name, "استئذان",
            string.Join(", ", students.Select(s => $"{s.Grade} {s.Class}").Distinct()),
            saved, students.FirstOrDefault()?.Stage.ToArabic() ?? "");

        return Ok(ApiResponse<object>.Ok(new
        {
            success = true,
            message = $"تم تسجيل {saved} حالة استئذان",
            count = saved
        }));
    }

    // ── 4. Save tardiness records (staff) ──
    [HttpPost("public/tardiness")]
    public async Task<ActionResult<ApiResponse<object>>> SaveTardiness([FromBody] StaffTardinessRequest request)
    {
        if (string.IsNullOrEmpty(request.Token))
            return BadRequest(ApiResponse<object>.Fail("الرمز مطلوب"));

        var user = await _db.Users
            .FirstOrDefaultAsync(u => u.TokenLink == request.Token && u.IsActive);

        if (user == null)
            return NotFound(ApiResponse<object>.Fail("رابط غير صالح"));

        if (request.StudentIds == null || request.StudentIds.Count == 0)
            return BadRequest(ApiResponse<object>.Fail("لم يتم اختيار طلاب"));

        var hijriDate = GetHijriDate();
        var students = await _db.Students
            .Where(s => request.StudentIds.Contains(s.Id))
            .ToListAsync();

        int saved = 0;

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
                TardinessType = TardinessType.Morning,
                Period = "",
                HijriDate = hijriDate,
                RecordedBy = user.Name,
                RecordedAt = DateTime.UtcNow
            });
            saved++;
        }

        await _db.SaveChangesAsync();

        // ★ تسجيل النشاط
        await LogStaffActivity(user.Name, "تأخر",
            string.Join(", ", students.Select(s => $"{s.Grade} {s.Class}").Distinct()),
            saved, students.FirstOrDefault()?.Stage.ToArabic() ?? "");

        return Ok(ApiResponse<object>.Ok(new
        {
            success = true,
            message = $"تم تسجيل {saved} حالة تأخر",
            count = saved
        }));
    }

    // ── 5. Guard: get today's permissions ──
    [HttpGet("public/guard-permissions")]
    public async Task<ActionResult<ApiResponse<object>>> GetGuardPermissions(
        [FromQuery] string token, [FromQuery] string? stage = null)
    {
        if (string.IsNullOrEmpty(token))
            return BadRequest(ApiResponse<object>.Fail("الرمز مطلوب"));

        var user = await _db.Users
            .FirstOrDefaultAsync(u => u.TokenLink == token && u.IsActive && u.Role == UserRole.Guard);

        if (user == null)
            return NotFound(ApiResponse<object>.Fail("رابط غير صالح أو ليس حارساً"));

        var today = DateTime.UtcNow.Date;
        var query = _db.PermissionRecords.Where(r => r.RecordedAt >= today);

        if (!string.IsNullOrEmpty(stage) && Enum.TryParse<Stage>(stage, true, out var stageEnum))
            query = query.Where(r => r.Stage == stageEnum);

        var records = await query
            .OrderByDescending(r => r.RecordedAt)
            .Select(r => new
            {
                r.Id,
                r.StudentName,
                r.Grade,
                className = r.Class,
                stage = r.Stage.ToString(),
                r.Reason,
                r.Receiver,
                r.ExitTime,
                r.ConfirmationTime,
                confirmed = !string.IsNullOrEmpty(r.ConfirmationTime)
            })
            .ToListAsync();

        return Ok(ApiResponse<object>.Ok(records));
    }

    // ── 6. Guard: confirm student exit ──
    [HttpPut("public/confirm-exit/{id}")]
    public async Task<ActionResult<ApiResponse<object>>> ConfirmExit(int id, [FromQuery] string token)
    {
        if (string.IsNullOrEmpty(token))
            return BadRequest(ApiResponse<object>.Fail("الرمز مطلوب"));

        var user = await _db.Users
            .FirstOrDefaultAsync(u => u.TokenLink == token && u.IsActive && u.Role == UserRole.Guard);

        if (user == null)
            return NotFound(ApiResponse<object>.Fail("رابط غير صالح أو ليس حارساً"));

        var record = await _db.PermissionRecords.FindAsync(id);
        if (record == null)
            return NotFound(ApiResponse<object>.Fail("السجل غير موجود"));

        record.ConfirmationTime = DateTime.Now.ToString("HH:mm");
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new
        {
            success = true,
            message = "تم تأكيد الخروج",
            confirmationTime = record.ConfirmationTime
        }));
    }

    // ── 7. Get today's staff entries (for daily log modal) — مجمّع حسب المرحلة مطابق للأصلي ──
    [HttpGet("public/today-entries")]
    public async Task<ActionResult<ApiResponse<object>>> GetTodayEntries([FromQuery] string token)
    {
        if (string.IsNullOrEmpty(token))
            return BadRequest(ApiResponse<object>.Fail("الرمز مطلوب"));

        var user = await _db.Users
            .FirstOrDefaultAsync(u => u.TokenLink == token && u.IsActive);

        if (user == null)
            return NotFound(ApiResponse<object>.Fail("رابط غير صالح"));

        var today = DateTime.UtcNow.Date;

        // ★ تجميع حسب المرحلة — مطابق للأصلي
        var grouped = new Dictionary<string, List<object>>();

        var permissions = await _db.PermissionRecords
            .Where(r => r.RecordedAt >= today)
            .OrderByDescending(r => r.RecordedAt)
            .Select(r => new { r.StudentName, r.ExitTime, r.Stage })
            .ToListAsync();

        foreach (var r in permissions)
        {
            var stageArabic = r.Stage.ToArabic();
            if (!grouped.ContainsKey(stageArabic)) grouped[stageArabic] = new List<object>();
            grouped[stageArabic].Add(new { name = r.StudentName, type = "استئذان", time = r.ExitTime ?? "" });
        }

        var tardiness = await _db.TardinessRecords
            .Where(r => r.RecordedAt >= today)
            .OrderByDescending(r => r.RecordedAt)
            .Select(r => new { r.StudentName, r.Stage })
            .ToListAsync();

        foreach (var r in tardiness)
        {
            var stageArabic = r.Stage.ToArabic();
            if (!grouped.ContainsKey(stageArabic)) grouped[stageArabic] = new List<object>();
            grouped[stageArabic].Add(new { name = r.StudentName, type = "تأخر", time = "" });
        }

        return Ok(ApiResponse<object>.Ok(new { entries = grouped }));
    }

    // ── Helpers ──

    private static string[] GetStaffPermissions(UserRole role) => role switch
    {
        UserRole.Admin or UserRole.Deputy => new[] { "permission", "tardiness" },
        UserRole.Counselor => new[] { "permission" },
        UserRole.Guard => new[] { "guard" },
        UserRole.Staff => new[] { "tardiness" },
        _ => Array.Empty<string>()
    };

    private static string GetHijriDate()
    {
        try
        {
            var cal = new UmAlQuraCalendar();
            var now = DateTime.Now;
            return $"{cal.GetYear(now)}/{cal.GetMonth(now):D2}/{cal.GetDayOfMonth(now):D2}";
        }
        catch { return ""; }
    }

    // ★ تسجيل نشاط الموظف — مطابق لـ logStaffActivity_ سطر 535-558
    private async Task LogStaffActivity(string staffName, string type, string className, int count, string stage)
    {
        try
        {
            _db.AuditLogs.Add(new AuditLog
            {
                Date = DateTime.Now.ToString("yyyy/MM/dd"),
                Time = DateTime.Now.ToString("HH:mm"),
                UserName = staffName,
                ActionType = type,
                Details = "الفصل: " + className,
                Count = count,
                Stage = stage,
                CreatedAt = DateTime.UtcNow
            });
            await _db.SaveChangesAsync();
        }
        catch { /* silent — same as original */ }
    }

}

// ── Request DTOs ──
public class StaffPermissionRequest
{
    public string Token { get; set; } = "";
    public List<int> StudentIds { get; set; } = new();
    public string? Reason { get; set; }
    public string? Guardian { get; set; }
}

public class StaffTardinessRequest
{
    public string Token { get; set; } = "";
    public List<int> StudentIds { get; set; } = new();
}
