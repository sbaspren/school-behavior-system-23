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
public class TeacherInputController : ControllerBase
{
    private readonly AppDbContext _db;
    public TeacherInputController(AppDbContext db) => _db = db;

    // ── 1. Verify teacher token & return page data ──
    [HttpGet("public/verify")]
    public async Task<ActionResult<ApiResponse<object>>> Verify([FromQuery] string token)
    {
        if (string.IsNullOrEmpty(token))
            return BadRequest(ApiResponse<object>.Fail("الرمز مطلوب"));

        var teacher = await _db.Teachers
            .FirstOrDefaultAsync(t => t.TokenLink == token && t.IsActive);

        if (teacher == null)
            return NotFound(ApiResponse<object>.Fail("رابط غير صالح أو المعلم غير فعال"));

        var schoolSettings = await _db.SchoolSettings.FirstOrDefaultAsync();

        // Parse assigned classes → get students per class
        var assignedClasses = (teacher.AssignedClasses ?? "")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToList();

        // Build class list with display name, stage, and subject
        var classesData = new List<object>();
        var studentsMap = new Dictionary<string, List<object>>();

        foreach (var classKey in assignedClasses)
        {
            // classKey format: "الأول_intermediate_أ" or "الأول متوسط أ"
            var parsed = ParseClassKey(classKey);
            if (parsed == null) continue;

            var (grade, stage, section, displayName) = parsed.Value;

            classesData.Add(new
            {
                k = classKey,
                d = displayName,
                s = stage.ToArabic(),
                sub = teacher.Subjects ?? ""
            });

            // Get students for this class
            var students = await _db.Students
                .Where(s => s.Stage == stage && s.Grade == grade && s.Class == section)
                .OrderBy(s => s.Name)
                .Select(s => new { i = s.StudentNumber, n = s.Name, p = s.Mobile })
                .ToListAsync();

            studentsMap[classKey] = students.Cast<object>().ToList();
        }

        return Ok(ApiResponse<object>.Ok(new
        {
            success = true,
            sn = schoolSettings?.SchoolName ?? "",
            t = new
            {
                n = teacher.Name,
                s = teacher.Subjects ?? ""
            },
            cl = classesData,
            st = studentsMap
        }));
    }

    // ── 2. Submit teacher form (routes to appropriate entity) ──
    [HttpPost("public/submit")]
    public async Task<ActionResult<ApiResponse<object>>> Submit([FromBody] TeacherFormSubmission request)
    {
        if (string.IsNullOrEmpty(request.Token))
            return BadRequest(ApiResponse<object>.Fail("الرمز مطلوب"));

        var teacher = await _db.Teachers
            .FirstOrDefaultAsync(t => t.TokenLink == request.Token && t.IsActive);

        if (teacher == null)
            return NotFound(ApiResponse<object>.Fail("رابط غير صالح"));

        // Detect stage from className
        var stage = DetectStage(request.ClassName);
        if (stage == null)
            return BadRequest(ApiResponse<object>.Fail("لم يتم تحديد المرحلة"));

        var now = DateTime.UtcNow;
        var hijriDate = request.HijriDate ?? "";
        var dayName = request.DayName ?? "";

        // Parse grade/section from className
        var parsed = ParseClassKey(request.ClassName);
        var gradeName = parsed?.grade ?? "";
        var sectionNum = parsed?.section ?? "";

        // Handle "no absence" case
        if (request.NoAbsence && request.InputType == "absence")
        {
            return Ok(ApiResponse<object>.Ok(new
            {
                success = true,
                message = "تم تسجيل عدم وجود غائبين - شكراً لك"
            }));
        }

        if (request.Students == null || request.Students.Count == 0)
            return BadRequest(ApiResponse<object>.Fail("لم يتم اختيار طلاب"));

        int saved = 0;

        foreach (var student in request.Students)
        {
            // Look up the student to get their Id
            var dbStudent = await _db.Students
                .FirstOrDefaultAsync(s => s.StudentNumber == student.Id && s.Stage == stage.Value);

            var studentId = dbStudent?.Id ?? 0;
            var studentPhone = student.Phone ?? dbStudent?.Mobile ?? "";

            switch (request.InputType)
            {
                case "absence":
                    _db.DailyAbsences.Add(new DailyAbsence
                    {
                        StudentId = studentId,
                        StudentNumber = student.Id,
                        StudentName = student.Name,
                        Grade = gradeName,
                        Class = sectionNum,
                        Stage = stage.Value,
                        Mobile = studentPhone,
                        AbsenceType = request.AbsenceType == "حصة" ? AbsenceType.Period : AbsenceType.FullDay,
                        Period = request.TeacherSubject ?? "",
                        HijriDate = hijriDate,
                        DayName = dayName,
                        RecordedBy = request.TeacherName,
                        RecordedAt = now,
                        Status = AbsenceStatus.Pending,
                        ExcuseType = ExcuseType.Unexcused,
                        IsSent = false,
                        Notes = ""
                    });
                    break;

                case "violation":
                    if (!Enum.TryParse<ViolationType>(MapViolationType(request.ViolationType), true, out var violType))
                        violType = ViolationType.InPerson;
                    if (!int.TryParse(request.ItemDegree, out var degreeInt))
                        degreeInt = 1;
                    var violDegree = (ViolationDegree)Math.Clamp(degreeInt, 1, 5);

                    // Effective degree for primary school
                    if (stage.Value == Stage.Primary && !string.IsNullOrEmpty(request.ItemId))
                    {
                        var violDef = await _db.ViolationTypeDefs
                            .FirstOrDefaultAsync(v => v.Code == request.ItemId);
                        if (violDef?.DegreeForPrimary != null)
                            violDegree = violDef.DegreeForPrimary.Value;
                    }

                    _db.Violations.Add(new Violation
                    {
                        StudentId = studentId,
                        StudentNumber = student.Id,
                        StudentName = student.Name,
                        Grade = gradeName,
                        Class = sectionNum,
                        Stage = stage.Value,
                        ViolationCode = request.ItemId ?? "",
                        Description = request.ItemText ?? "",
                        Type = violType,
                        Degree = violDegree,
                        HijriDate = hijriDate,
                        MiladiDate = now.ToString("yyyy-MM-dd"),
                        DayName = dayName,
                        Deduction = 0,
                        Procedures = "",
                        RecordedBy = request.TeacherName,
                        RecordedAt = now,
                        IsSent = false,
                        Notes = ""
                    });
                    break;

                case "note":
                    var noteDetails = request.Details ?? "";
                    var noteClass = request.NoteClassification ?? "سلبي";
                    if (!string.IsNullOrEmpty(noteClass))
                        noteDetails = $"[{noteClass}] {noteDetails}";

                    _db.EducationalNotes.Add(new EducationalNote
                    {
                        StudentId = studentId,
                        StudentNumber = student.Id,
                        StudentName = student.Name,
                        Grade = gradeName,
                        Class = sectionNum,
                        Stage = stage.Value,
                        Mobile = studentPhone,
                        NoteType = request.ItemText ?? "",
                        Details = noteDetails,
                        TeacherName = request.TeacherName,
                        HijriDate = hijriDate,
                        RecordedAt = now,
                        IsSent = false
                    });
                    break;

                case "positive":
                    _db.PositiveBehaviors.Add(new PositiveBehavior
                    {
                        StudentId = studentId,
                        StudentNumber = student.Id,
                        StudentName = student.Name,
                        Grade = gradeName,
                        Class = sectionNum,
                        Stage = stage.Value,
                        BehaviorType = request.ItemText ?? "",
                        Degree = request.ItemDegree ?? "",
                        Details = request.Details ?? "",
                        HijriDate = hijriDate,
                        RecordedBy = request.TeacherName,
                        RecordedAt = now,
                        IsSent = false
                    });
                    break;

                case "custom":
                    // ملاحظة خاصة → تُحفظ كملاحظة تربوية
                    _db.EducationalNotes.Add(new EducationalNote
                    {
                        StudentId = studentId,
                        StudentNumber = student.Id,
                        StudentName = student.Name,
                        Grade = gradeName,
                        Class = sectionNum,
                        Stage = stage.Value,
                        Mobile = studentPhone,
                        NoteType = "ملاحظة خاصة",
                        Details = request.Details ?? "",
                        TeacherName = request.TeacherName,
                        HijriDate = hijriDate,
                        RecordedAt = now,
                        IsSent = false
                    });
                    break;

                default:
                    return BadRequest(ApiResponse<object>.Fail("نوع إدخال غير صالح"));
            }

            saved++;
        }

        await _db.SaveChangesAsync();

        var typeLabels = new Dictionary<string, string>
        {
            ["absence"] = "غياب",
            ["violation"] = "مخالفة سلوكية",
            ["note"] = "ملاحظة تربوية",
            ["positive"] = "سلوك متمايز",
            ["custom"] = "ملاحظة خاصة"
        };
        var typeLabel = typeLabels.GetValueOrDefault(request.InputType, request.InputType);

        return Ok(ApiResponse<object>.Ok(new
        {
            success = true,
            message = $"تم تسجيل {saved} طالب - {typeLabel}",
            count = saved
        }));
    }

    // ── Helpers ──

    private static Stage? DetectStage(string? className)
    {
        if (string.IsNullOrEmpty(className)) return null;

        if (className.Contains("ثانوي") || className.Contains("secondary", StringComparison.OrdinalIgnoreCase))
            return Stage.Secondary;
        if (className.Contains("متوسط") || className.Contains("intermediate", StringComparison.OrdinalIgnoreCase))
            return Stage.Intermediate;
        if (className.Contains("ابتدائي") || className.Contains("primary", StringComparison.OrdinalIgnoreCase))
            return Stage.Primary;
        if (className.Contains("طفولة") || className.Contains("روضة") || className.Contains("kindergarten", StringComparison.OrdinalIgnoreCase))
            return Stage.Kindergarten;

        return null;
    }

    /// <summary>
    /// Parse class key like "الأول_intermediate_أ" → (grade, stage, section, displayName)
    /// Also supports plain format "الأول متوسط أ"
    /// </summary>
    private static (string grade, Stage stage, string section, string displayName)? ParseClassKey(string classKey)
    {
        if (string.IsNullOrEmpty(classKey)) return null;

        // Try underscore format: "الأول_intermediate_أ"
        var parts = classKey.Split('_');
        if (parts.Length >= 3)
        {
            var grade = parts[0];
            var stageStr = parts[1];
            var section = parts[2];

            Stage? stage = stageStr.ToLowerInvariant() switch
            {
                "intermediate" or "متوسط" => Stage.Intermediate,
                "secondary" or "ثانوي" => Stage.Secondary,
                "primary" or "ابتدائي" => Stage.Primary,
                "kindergarten" or "طفولة مبكرة" => Stage.Kindergarten,
                _ => null
            };

            if (stage != null)
            {
                var stageArabic = stage.Value.ToArabic();
                return (grade, stage.Value, section, $"{grade} {stageArabic} {section}");
            }
        }

        // Try plain format: "الأول متوسط أ"
        var detectedStage = DetectStage(classKey);
        if (detectedStage != null)
        {
            var stageAr = detectedStage.Value.ToArabic();
            // Remove stage word to extract grade and section
            var cleaned = classKey
                .Replace("متوسط", "").Replace("ثانوي", "")
                .Replace("ابتدائي", "").Replace("طفولة مبكرة", "")
                .Trim();
            var words = cleaned.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            var grade = words.Length > 0 ? words[0] : classKey;
            var section = words.Length > 1 ? words[^1] : "";

            return (grade, detectedStage.Value, section, classKey);
        }

        return null;
    }

    private static string MapViolationType(string? arabicType) => arabicType switch
    {
        "حضوري" => "InPerson",
        "رقمي" => "Digital",
        "هيئة تعليمية" => "Educational",
        _ => "InPerson"
    };
}

// ── DTOs ──
public class TeacherFormSubmission
{
    public string Token { get; set; } = "";
    public string TeacherName { get; set; } = "";
    public string ClassName { get; set; } = "";
    public string InputType { get; set; } = "";        // absence, violation, note, positive
    public string? ItemId { get; set; }
    public string? ItemText { get; set; }
    public string? ItemDegree { get; set; }
    public string? ViolationType { get; set; }          // حضوري / رقمي / هيئة تعليمية
    public string? AbsenceType { get; set; }            // يوم كامل / حصة
    public string? TeacherSubject { get; set; }
    public string? Details { get; set; }
    public string? NoteClassification { get; set; }     // سلبي / إشادة
    public string? HijriDate { get; set; }
    public string? DayName { get; set; }
    public bool NoAbsence { get; set; }
    public bool NotifyDeputy { get; set; }
    public List<TeacherFormStudent> Students { get; set; } = new();
}

public class TeacherFormStudent
{
    public string Id { get; set; } = "";               // StudentNumber
    public string Name { get; set; } = "";
    public string? Phone { get; set; }
}
