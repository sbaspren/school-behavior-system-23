using Microsoft.AspNetCore.Authorization;
using System.Globalization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SchoolBehaviorSystem.Application.DTOs.Responses;
using SchoolBehaviorSystem.Domain.Enums;
using SchoolBehaviorSystem.Infrastructure.Data;

namespace SchoolBehaviorSystem.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class DashboardController : ControllerBase
{
    private readonly AppDbContext _db;

    public DashboardController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<object>>> GetDashboard([FromQuery] string? stage = null)
    {
        Stage? stageEnum = null;
        if (!string.IsNullOrEmpty(stage) && Enum.TryParse<Stage>(stage, true, out var parsed))
            stageEnum = parsed;

        var today = DateTime.UtcNow.Date;

        // ── Hijri Date ──
        var cal = new UmAlQuraCalendar();
        var now = DateTime.Now;
        var hijriDate = $"{cal.GetYear(now)}/{cal.GetMonth(now):D2}/{cal.GetDayOfMonth(now):D2}";

        // ── Queries with optional stage filter ──
        var studentsQ = _db.Students.AsQueryable();
        var violationsQ = _db.Violations.AsQueryable();
        var positiveQ = _db.PositiveBehaviors.AsQueryable();
        var tardinessQ = _db.TardinessRecords.AsQueryable();
        var absenceQ = _db.DailyAbsences.AsQueryable();
        var permissionsQ = _db.PermissionRecords.AsQueryable();
        var notesQ = _db.EducationalNotes.AsQueryable();

        if (stageEnum.HasValue)
        {
            studentsQ = studentsQ.Where(s => s.Stage == stageEnum.Value);
            violationsQ = violationsQ.Where(v => v.Stage == stageEnum.Value);
            positiveQ = positiveQ.Where(p => p.Stage == stageEnum.Value);
            tardinessQ = tardinessQ.Where(t => t.Stage == stageEnum.Value);
            absenceQ = absenceQ.Where(a => a.Stage == stageEnum.Value);
            permissionsQ = permissionsQ.Where(p => p.Stage == stageEnum.Value);
            notesQ = notesQ.Where(n => n.Stage == stageEnum.Value);
        }

        // ── 1. Today counts ──
        var todayAbsence = await absenceQ.CountAsync(a => a.RecordedAt >= today);
        var todayTardiness = await tardinessQ.CountAsync(t => t.RecordedAt >= today);
        var todayPermissions = await permissionsQ.CountAsync(p => p.RecordedAt >= today);
        var todayPermissionsOut = await permissionsQ.CountAsync(p => p.RecordedAt >= today && !string.IsNullOrEmpty(p.ConfirmationTime));
        var todayViolations = await violationsQ.CountAsync(v => v.RecordedAt >= today);
        var todayNotes = await notesQ.CountAsync(n => n.RecordedAt >= today);

        // ── 2. Stage stats (both stages) ──
        var stageStatsList = await _db.DailyAbsences
            .GroupBy(a => a.Stage)
            .Select(g => new
            {
                stage = g.Key.ToString(),
                absence = g.Count(a => a.RecordedAt >= today),
                tardiness = 0,
                permissions = 0,
                violations = 0,
                notes = 0
            })
            .ToListAsync();

        // Get tardiness, permissions, violations, notes per stage
        var tardByStage = await _db.TardinessRecords
            .Where(t => t.RecordedAt >= today)
            .GroupBy(t => t.Stage)
            .Select(g => new { stage = g.Key.ToString(), count = g.Count() })
            .ToListAsync();

        var permByStage = await _db.PermissionRecords
            .Where(p => p.RecordedAt >= today)
            .GroupBy(p => p.Stage)
            .Select(g => new { stage = g.Key.ToString(), count = g.Count() })
            .ToListAsync();

        var violByStage = await _db.Violations
            .Where(v => v.RecordedAt >= today)
            .GroupBy(v => v.Stage)
            .Select(g => new { stage = g.Key.ToString(), count = g.Count() })
            .ToListAsync();

        var notesByStage = await _db.EducationalNotes
            .Where(n => n.RecordedAt >= today)
            .GroupBy(n => n.Stage)
            .Select(g => new { stage = g.Key.ToString(), count = g.Count() })
            .ToListAsync();

        // Build combined stage stats
        var allStageNames = new[] { "Intermediate", "Secondary" };
        var stageStats = new Dictionary<string, object>();
        foreach (var sn in allStageNames)
        {
            stageStats[sn] = new
            {
                absence = stageStatsList.FirstOrDefault(s => s.stage == sn)?.absence ?? 0,
                tardiness = tardByStage.FirstOrDefault(s => s.stage == sn)?.count ?? 0,
                permissions = permByStage.FirstOrDefault(s => s.stage == sn)?.count ?? 0,
                violations = violByStage.FirstOrDefault(s => s.stage == sn)?.count ?? 0,
                notes = notesByStage.FirstOrDefault(s => s.stage == sn)?.count ?? 0
            };
        }

        // ── 3. Pending: violations without procedures ──
        var violationsNoAction = await violationsQ
            .Where(v => string.IsNullOrEmpty(v.Procedures))
            .OrderByDescending(v => v.RecordedAt)
            .Take(5)
            .Select(v => new
            {
                name = v.StudentName,
                violation = v.Description,
                grade = v.Grade,
                cls = v.Class,
                degree = (int)v.Degree,
                date = v.HijriDate,
                stage = v.Stage.ToString()
            })
            .ToListAsync();

        // ── 4. Pending: unsent notes ──
        var notesPending = await notesQ
            .Where(n => n.RecordedAt >= today && !n.IsSent)
            .OrderByDescending(n => n.RecordedAt)
            .Take(5)
            .Select(n => new
            {
                name = n.StudentName,
                type = n.NoteType,
                detail = n.Details,
                teacher = n.TeacherName,
                cls = n.Grade + " " + n.Class,
                stage = n.Stage.ToString()
            })
            .ToListAsync();

        // ── 5. Not sent counts (today) ──
        var notSentAbsence = await absenceQ.CountAsync(a => a.RecordedAt >= today && !a.IsSent);
        var notSentTardiness = await tardinessQ.CountAsync(t => t.RecordedAt >= today && !t.IsSent);
        var notSentViolations = await violationsQ.CountAsync(v => v.RecordedAt >= today && !v.IsSent);

        // Not sent by stage
        var notSentByStage = new Dictionary<string, object>();
        foreach (var sn in allStageNames)
        {
            if (!Enum.TryParse<Stage>(sn, true, out var stg)) continue;
            notSentByStage[sn] = new
            {
                absence = await _db.DailyAbsences.CountAsync(a => a.Stage == stg && a.RecordedAt >= today && !a.IsSent),
                tardiness = await _db.TardinessRecords.CountAsync(t => t.Stage == stg && t.RecordedAt >= today && !t.IsSent),
                violations = await _db.Violations.CountAsync(v => v.Stage == stg && v.RecordedAt >= today && !v.IsSent)
            };
        }

        // ── 6. Pending excuses ──
        var pendingExcuses = await _db.DailyAbsences.CountAsync(a =>
            a.Status == AbsenceStatus.Pending &&
            a.ExcuseType == ExcuseType.Excused);
        // Parent excuses pending
        pendingExcuses += await _db.ParentExcuses.CountAsync(pe => pe.Status == "\u0645\u0639\u0644\u0642");

        // ── 7. Absence by class (today) ──
        var absenceByClass = await absenceQ
            .Where(a => a.RecordedAt >= today)
            .GroupBy(a => new { a.Stage, a.Grade, a.Class })
            .Select(g => new
            {
                stage = g.Key.Stage.ToString(),
                grade = g.Key.Grade,
                className = g.Key.Class,
                count = g.Count()
            })
            .ToListAsync();

        // ── 8. Recent activity (today's violations + notes) ──
        var recentViolations = await violationsQ
            .Where(v => v.RecordedAt >= today)
            .OrderByDescending(v => v.RecordedAt)
            .Take(3)
            .Select(v => new
            {
                type = "\u0645\u062e\u0627\u0644\u0641\u0629",
                teacher = v.RecordedBy,
                detail = v.Description,
                student = v.StudentName,
                cls = v.Grade + " " + v.Class,
                v.RecordedAt,
                stage = v.Stage.ToString(),
                section = "violations",
                actionTaken = !string.IsNullOrEmpty(v.Procedures)
            })
            .ToListAsync();

        var recentNotes = await notesQ
            .Where(n => n.RecordedAt >= today)
            .OrderByDescending(n => n.RecordedAt)
            .Take(3)
            .Select(n => new
            {
                type = "\u0645\u0644\u0627\u062d\u0638\u0629",
                teacher = n.TeacherName,
                detail = n.NoteType,
                student = n.StudentName,
                cls = n.Grade + " " + n.Class,
                n.RecordedAt,
                stage = n.Stage.ToString(),
                section = "educational-notes",
                actionTaken = n.IsSent
            })
            .ToListAsync();

        var recentActivity = recentViolations
            .Concat(recentNotes)
            .OrderByDescending(x => x.RecordedAt)
            .Take(6)
            .ToList();

        // ── 9. Semester totals ──
        var semesterViolations = await _db.Violations.CountAsync();
        var semesterAbsence = await _db.DailyAbsences.CountAsync();
        var semesterPermissions = await _db.PermissionRecords.CountAsync();
        var semesterTardiness = await _db.TardinessRecords.CountAsync();

        // ── 10. Needs printing — مطابق لـ Server_Dashboard.gs سطر 157-365 ──
        // ثوابت حدود المخالفات والغياب — مطابق لـ VIOLATION_DEGREE و ABSENCE_THRESHOLD
        const int NEEDS_TAHOOD = 2;    // درجة تعهد سلوكي
        const int NEEDS_ISHAR = 3;     // درجة إشعار ولي أمر
        const int NEEDS_MAHDAR = 4;    // درجة محضر لجنة
        const int ABS_NEEDS_TAHOOD = 3;       // غياب: تعهد حضور
        const int ABS_NEEDS_WARNING = 5;      // غياب: إنذار
        const int ABS_NEEDS_DEPRIVATION = 7;  // غياب: إشعار حرمان

        var needsPrinting = new List<object>();

        var violNeedPrint = await violationsQ
            .Where(v => (int)v.Degree >= NEEDS_TAHOOD && string.IsNullOrEmpty(v.Procedures))
            .OrderByDescending(v => v.RecordedAt)
            .Take(15)
            .ToListAsync();

        foreach (var v in violNeedPrint)
        {
            var deg = (int)v.Degree;
            var neededForms = new List<string>();
            if (deg >= NEEDS_TAHOOD) neededForms.Add("تعهد سلوكي");
            if (deg >= NEEDS_ISHAR) neededForms.Add("إشعار ولي أمر");
            if (deg >= NEEDS_MAHDAR) neededForms.Add("محضر لجنة");

            needsPrinting.Add(new
            {
                type = "مخالفة",
                name = v.StudentName,
                studentId = v.StudentId,
                detail = v.Description,
                degree = deg,
                grade = v.Grade,
                cls = v.Class,
                date = v.HijriDate,
                neededForms,
                stage = v.Stage.ToString(),
                section = "violations"
            });
        }

        // Absence: students with >= 3 unexcused absences
        var absenceCounts = await absenceQ
            .Where(a => a.ExcuseType == ExcuseType.Unexcused || a.Status == AbsenceStatus.Rejected)
            .GroupBy(a => new { a.StudentId, a.StudentName, a.Grade, a.Class, a.Stage })
            .Select(g => new
            {
                g.Key.StudentId,
                g.Key.StudentName,
                g.Key.Grade,
                g.Key.Class,
                stage = g.Key.Stage.ToString(),
                count = g.Count()
            })
            .Where(x => x.count >= ABS_NEEDS_TAHOOD)
            .OrderByDescending(x => x.count)
            .Take(10)
            .ToListAsync();

        foreach (var ac in absenceCounts)
        {
            var neededForms = new List<string> { "تعهد حضور" };
            if (ac.count >= ABS_NEEDS_WARNING) neededForms.Add("إنذار غياب");
            if (ac.count >= ABS_NEEDS_DEPRIVATION) neededForms.Add("إشعار حرمان");

            needsPrinting.Add(new
            {
                type = "غياب",
                name = ac.StudentName,
                studentId = ac.StudentId,
                detail = ac.count + " مرة غياب بدون عذر",
                degree = ac.count,
                grade = ac.Grade,
                cls = ac.Class,
                date = "",
                neededForms,
                stage = ac.stage,
                section = "absence"
            });
        }

        // ── 11. Top violators ──
        var topViolators = await violationsQ
            .GroupBy(v => new { v.StudentId, v.StudentName, v.StudentNumber, v.Grade, v.Class })
            .Select(g => new
            {
                g.Key.StudentId,
                g.Key.StudentName,
                g.Key.StudentNumber,
                g.Key.Grade,
                className = g.Key.Class,
                count = g.Count(),
                totalDeduction = g.Sum(v => v.Deduction)
            })
            .OrderByDescending(x => x.count)
            .Take(5)
            .ToListAsync();

        // ── 12. Total students ──
        var totalStudents = await studentsQ.CountAsync();

        // ── 13. Violations by degree ──
        var violationsByDegree = await violationsQ
            .GroupBy(v => v.Degree)
            .Select(g => new { degree = (int)g.Key, count = g.Count() })
            .ToListAsync();

        return Ok(ApiResponse<object>.Ok(new
        {
            hijriDate,
            today = new
            {
                absence = todayAbsence,
                tardiness = todayTardiness,
                permissions = todayPermissions,
                permissionsOut = todayPermissionsOut,
                permissionsWaiting = todayPermissions - todayPermissionsOut,
                violations = todayViolations,
                notes = todayNotes,
                pendingExcuses
            },
            stageStats,
            pending = new
            {
                violationsNoAction,
                notesPending,
                notSent = new
                {
                    absence = notSentAbsence,
                    tardiness = notSentTardiness,
                    violations = notSentViolations
                },
                notSentByStage
            },
            absenceByClass,
            recentActivity,
            semesterTotals = new
            {
                violations = semesterViolations,
                absence = semesterAbsence,
                permissions = semesterPermissions,
                tardiness = semesterTardiness
            },
            needsPrinting,
            students = new { total = totalStudents },
            violations = new
            {
                total = await violationsQ.CountAsync(),
                totalDeduction = await violationsQ.SumAsync(v => v.Deduction),
                byDegree = violationsByDegree
            },
            topViolators
        }));
    }

    [HttpGet("calendar")]
    public ActionResult<ApiResponse<object>> GetCalendar()
    {
        var events = new[]
        {
            new { d = 24, m = 8, label = "\u0628\u062f\u0627\u064a\u0629 \u0627\u0644\u0639\u0627\u0645 \u0627\u0644\u062f\u0631\u0627\u0633\u064a", type = "event", holiday = false },
            new { d = 23, m = 9, label = "\u0625\u062c\u0627\u0632\u0629 \u0627\u0644\u064a\u0648\u0645 \u0627\u0644\u0648\u0637\u0646\u064a", type = "national", holiday = true },
            new { d = 5, m = 10, label = "\u064a\u0648\u0645 \u0627\u0644\u0645\u0639\u0644\u0645 \u0627\u0644\u0639\u0627\u0644\u0645\u064a", type = "event", holiday = false },
            new { d = 12, m = 10, label = "\u0625\u062c\u0627\u0632\u0629 \u0625\u0636\u0627\u0641\u064a\u0629", type = "holiday", holiday = true },
            new { d = 16, m = 10, label = "\u064a\u0648\u0645 \u0627\u0644\u063a\u0630\u0627\u0621 \u0627\u0644\u0639\u0627\u0644\u0645\u064a", type = "event", holiday = false },
            new { d = 16, m = 11, label = "\u0627\u0644\u064a\u0648\u0645 \u0627\u0644\u0639\u0627\u0644\u0645\u064a \u0644\u0644\u062a\u0633\u0627\u0645\u062d", type = "event", holiday = false },
            new { d = 20, m = 11, label = "\u0627\u0644\u064a\u0648\u0645 \u0627\u0644\u0639\u0627\u0644\u0645\u064a \u0644\u0644\u0637\u0641\u0644", type = "event", holiday = false },
            new { d = 21, m = 11, label = "\u0628\u062f\u0627\u064a\u0629 \u0625\u062c\u0627\u0632\u0629 \u0627\u0644\u062e\u0631\u064a\u0641", type = "holiday", holiday = true },
            new { d = 3, m = 12, label = "\u0627\u0644\u064a\u0648\u0645 \u0627\u0644\u0639\u0627\u0644\u0645\u064a \u0644\u0630\u0648\u064a \u0627\u0644\u0625\u0639\u0627\u0642\u0629", type = "event", holiday = false },
            new { d = 11, m = 12, label = "\u0625\u062c\u0627\u0632\u0629 \u0625\u0636\u0627\u0641\u064a\u0629", type = "holiday", holiday = true },
            new { d = 18, m = 12, label = "\u0627\u0644\u064a\u0648\u0645 \u0627\u0644\u0639\u0627\u0644\u0645\u064a \u0644\u0644\u063a\u0629 \u0627\u0644\u0639\u0631\u0628\u064a\u0629", type = "event", holiday = false },
            new { d = 9, m = 1, label = "\u0628\u062f\u0627\u064a\u0629 \u0625\u062c\u0627\u0632\u0629 \u0645\u0646\u062a\u0635\u0641 \u0627\u0644\u0639\u0627\u0645", type = "holiday", holiday = true },
            new { d = 18, m = 1, label = "\u0628\u062f\u0627\u064a\u0629 \u0627\u0644\u0641\u0635\u0644 \u0627\u0644\u062b\u0627\u0646\u064a", type = "event", holiday = false },
            new { d = 24, m = 1, label = "\u0627\u0644\u064a\u0648\u0645 \u0627\u0644\u062f\u0648\u0644\u064a \u0644\u0644\u062a\u0639\u0644\u064a\u0645", type = "event", holiday = false },
            new { d = 22, m = 2, label = "\u064a\u0648\u0645 \u0627\u0644\u062a\u0623\u0633\u064a\u0633 \u0627\u0644\u0633\u0639\u0648\u062f\u064a", type = "national", holiday = true },
            new { d = 6, m = 3, label = "\u0628\u062f\u0627\u064a\u0629 \u0625\u062c\u0627\u0632\u0629 \u0639\u064a\u062f \u0627\u0644\u0641\u0637\u0631", type = "holiday", holiday = true },
            new { d = 28, m = 3, label = "\u0646\u0647\u0627\u064a\u0629 \u0625\u062c\u0627\u0632\u0629 \u0639\u064a\u062f \u0627\u0644\u0641\u0637\u0631", type = "event", holiday = false },
            new { d = 11, m = 3, label = "\u064a\u0648\u0645 \u0627\u0644\u0639\u0644\u0645 \u0627\u0644\u0633\u0639\u0648\u062f\u064a", type = "national", holiday = false },
            new { d = 7, m = 4, label = "\u0627\u0644\u064a\u0648\u0645 \u0627\u0644\u0639\u0627\u0644\u0645\u064a \u0644\u0644\u0635\u062d\u0629", type = "event", holiday = false },
            new { d = 22, m = 5, label = "\u0628\u062f\u0627\u064a\u0629 \u0625\u062c\u0627\u0632\u0629 \u0639\u064a\u062f \u0627\u0644\u0623\u0636\u062d\u0649", type = "holiday", holiday = true },
            new { d = 1, m = 6, label = "\u0646\u0647\u0627\u064a\u0629 \u0625\u062c\u0627\u0632\u0629 \u0639\u064a\u062f \u0627\u0644\u0623\u0636\u062d\u0649", type = "event", holiday = false },
            new { d = 25, m = 6, label = "\u0628\u062f\u0627\u064a\u0629 \u0625\u062c\u0627\u0632\u0629 \u0646\u0647\u0627\u064a\u0629 \u0627\u0644\u0639\u0627\u0645", type = "holiday", holiday = true }
        };

        var semesters = new[]
        {
            new { name = "\u0627\u0644\u0641\u0635\u0644 \u0627\u0644\u0623\u0648\u0644", start = new[] { 2025, 7, 24 }, end = new[] { 2026, 0, 8 }, weeks = 18 },
            new { name = "\u0627\u0644\u0641\u0635\u0644 \u0627\u0644\u062b\u0627\u0646\u064a", start = new[] { 2026, 0, 18 }, end = new[] { 2026, 5, 25 }, weeks = 18 }
        };

        return Ok(ApiResponse<object>.Ok(new { events, semesters }));
    }
}
