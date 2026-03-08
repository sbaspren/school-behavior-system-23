using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using SchoolBehaviorSystem.Application.DTOs.Responses;
using SchoolBehaviorSystem.Application.Interfaces;
using SchoolBehaviorSystem.Domain.Entities;
using SchoolBehaviorSystem.Domain.Enums;
using SchoolBehaviorSystem.Infrastructure.Data;

namespace SchoolBehaviorSystem.API.Controllers;

/// <summary>
/// نموذج المعلم — منقول بالكامل من Server_TeacherInput.gs (2,040 سطر، 44 دالة)
/// المصدر: github.com/sbaspren/school-behavior-system-22
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class TeacherInputController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IAuditService _audit;
    private readonly IWhatsAppServerService _whatsApp;
    private readonly IHijriDateService _hijri;
    private readonly IMemoryCache _cache;
    private readonly IConfiguration _config;

    public TeacherInputController(
        AppDbContext db,
        IAuditService audit,
        IWhatsAppServerService whatsApp,
        IHijriDateService hijri,
        IMemoryCache cache,
        IConfiguration config)
    {
        _db = db;
        _audit = audit;
        _whatsApp = whatsApp;
        _hijri = hijri;
        _cache = cache;
        _config = config;
    }

    // ════════════════════════════════════════════════════════════════
    // 1. Verify — مطابق لـ buildTeacherPageData_ سطر 12-141 + getTeacherPageData_ سطر 208-222
    // ════════════════════════════════════════════════════════════════
    [HttpGet("public/verify")]
    public async Task<ActionResult<ApiResponse<object>>> Verify([FromQuery] string token)
    {
        if (string.IsNullOrEmpty(token))
            return BadRequest(ApiResponse<object>.Fail("الرمز مطلوب"));

        // ★ كاش أولاً (مطابق لـ getTeacherPageData_ سطر 208-222)
        var cacheKey = $"tpd_{token}";
        if (_cache.TryGetValue(cacheKey, out object? cached) && cached != null)
            return Ok(ApiResponse<object>.Ok(cached));

        var teacher = await _db.Teachers
            .FirstOrDefaultAsync(t => t.TokenLink == token && t.IsActive);

        if (teacher == null)
            return NotFound(ApiResponse<object>.Fail("رابط غير صالح أو منتهي الصلاحية"));

        var schoolSettings = await _db.SchoolSettings.FirstOrDefaultAsync();

        // ★ تحليل فصول المعلم مع دعم التنسيق الجديد "classKey:مادة"
        // مطابق لـ buildTeacherPageData_ سطر 44-59
        var rawClassesRaw = (teacher.AssignedClasses ?? "")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToList();

        var classSubjectMap = new Dictionary<string, string>();
        var rawClasses = new List<string>();
        foreach (var entry in rawClassesRaw)
        {
            var colonIdx = entry.IndexOf(':');
            if (colonIdx > -1)
            {
                var ck = entry[..colonIdx];
                classSubjectMap[ck] = entry[(colonIdx + 1)..];
                rawClasses.Add(ck);
            }
            else
            {
                rawClasses.Add(entry);
            }
        }

        // ★ خريطة تحويل الحرف لرقم (مطابق لسطر 61)
        var letterToNum = new Dictionary<string, string>
        {
            ["أ"] = "1", ["ب"] = "2", ["ج"] = "3", ["د"] = "4",
            ["ه"] = "5", ["هـ"] = "5", ["و"] = "6", ["ز"] = "7",
            ["ح"] = "8", ["ط"] = "9"
        };

        var classesData = new List<object>();
        var studentsMap = new Dictionary<string, List<object>>();

        foreach (var classKey in rawClasses)
        {
            var parsed = ParseClassKey(classKey);
            if (parsed == null) continue;

            var (grade, stage, section, displayName) = parsed.Value;

            // ★ تحويل الحرف لرقم (مطابق لسطر 100)
            var classNum = letterToNum.GetValueOrDefault(section, section);

            var stageArabic = stage.ToArabic();
            var gradeWithStage = $"{grade} {stageArabic}".Trim();
            var display = $"{gradeWithStage} {classNum}";

            // ★ المادة المرتبطة بالفصل (مطابق لسطر 110)
            var classSubject = classSubjectMap.GetValueOrDefault(classKey, teacher.Subjects ?? "");

            classesData.Add(new
            {
                d = display,
                g = gradeWithStage,
                c = classNum,
                s = stageArabic,
                sub = classSubject
            });

            // ★ جلب طلاب الفصل (مطابق لسطر 120-122)
            var students = await _db.Students
                .Where(s => s.Stage == stage && s.Grade == grade && s.Class == classNum)
                .OrderBy(s => s.Name)
                .Select(s => new { i = s.StudentNumber, n = s.Name, p = s.Mobile })
                .ToListAsync();

            studentsMap[display] = students.Cast<object>().ToList();
        }

        var result = new
        {
            success = true,
            sn = schoolSettings?.SchoolName ?? "",
            t = new { n = teacher.Name, s = teacher.Subjects ?? "" },
            cl = classesData,
            st = studentsMap
        };

        // ★ حفظ في الكاش 6 ساعات (مطابق لسطر 168)
        _cache.Set(cacheKey, result, TimeSpan.FromHours(6));

        return Ok(ApiResponse<object>.Ok(result));
    }

    // ════════════════════════════════════════════════════════════════
    // 2. Submit — مطابق لـ submitTeacherForm() سطر 665-787
    // ★ مع إصلاح: noAbsence يكتب سجل + notifyDeputy + logActivity
    // ════════════════════════════════════════════════════════════════
    [HttpPost("public/submit")]
    public async Task<ActionResult<ApiResponse<object>>> Submit([FromBody] TeacherFormSubmission request)
    {
        if (string.IsNullOrEmpty(request.Token))
            return BadRequest(ApiResponse<object>.Fail("الرمز مطلوب"));

        var teacher = await _db.Teachers
            .FirstOrDefaultAsync(t => t.TokenLink == request.Token && t.IsActive);

        if (teacher == null)
            return NotFound(ApiResponse<object>.Fail("رابط غير صالح"));

        var stage = DetectStage(request.ClassName);
        if (stage == null)
            return BadRequest(ApiResponse<object>.Fail("لم يتم تحديد المرحلة"));

        var now = DateTime.UtcNow;
        var hijriDate = !string.IsNullOrEmpty(request.HijriDate)
            ? request.HijriDate
            : _hijri.GetHijriDate(now);
        var dayName = !string.IsNullOrEmpty(request.DayName)
            ? request.DayName
            : _hijri.GetHijriDateFull(now).WeekdayAr;

        // ★ تحليل الصف والفصل من اسم الفصل (مطابق لسطر 714-721)
        var classNameParts = (request.ClassName ?? "").Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var gradeName = classNameParts.Length > 1
            ? string.Join(" ", classNameParts[..^1])
            : request.ClassName ?? "";
        var sectionNum = classNameParts.Length > 1
            ? classNameParts[^1]
            : "";

        // ★ حالة "لا يوجد غائب" — تسجيل صف NO_ABSENCE (مطابق لسطر 673-710)
        if (request.NoAbsence && request.InputType == "absence")
        {
            _db.DailyAbsences.Add(new DailyAbsence
            {
                StudentId = 0,
                StudentNumber = "NO_ABSENCE",               // ★ علامة خاصة
                StudentName = "لا يوجد غائب",
                Grade = gradeName,
                Class = sectionNum,
                Stage = stage.Value,
                Mobile = "",
                AbsenceType = AbsenceType.FullDay,
                Period = "",
                HijriDate = hijriDate,
                DayName = dayName,
                RecordedBy = request.TeacherName,
                RecordedAt = now,
                Status = AbsenceStatus.Approved,             // مؤكد
                ExcuseType = ExcuseType.Excused,
                IsSent = true,                                // تم_الإرسال: نعم
                TardinessStatus = "حاضر",
                ArrivalTime = "",
                Notes = "",
                NoorStatus = ""
            });
            await _db.SaveChangesAsync();

            // ★ تسجيل النشاط (مطابق لسطر 702)
            await LogActivity(request, 0, stage.Value);

            return Ok(ApiResponse<object>.Ok(new
            {
                success = true,
                message = $"تم تأكيد حضور جميع طلاب {request.ClassName} ✅",
                count = 0,
                stage = stage.Value.ToArabic()
            }));
        }

        if (request.Students == null || request.Students.Count == 0)
            return BadRequest(ApiResponse<object>.Fail("لم يتم اختيار طلاب"));

        int saved = 0;
        var savedRecords = new List<SavedRecord>();

        foreach (var student in request.Students)
        {
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
            savedRecords.Add(new SavedRecord { StudentName = student.Name, StudentId = student.Id });
        }

        await _db.SaveChangesAsync();

        // ★ تسجيل النشاط (مطابق لـ logActivity_ سطر 1136-1167)
        await LogActivity(request, saved, stage.Value);

        // ★ إشعار الوكيل عبر واتساب (مطابق لسطر 771-773)
        if (request.NotifyDeputy)
        {
            await NotifyDeputyWhatsApp(request, savedRecords, stage.Value);
        }

        return Ok(ApiResponse<object>.Ok(new
        {
            success = true,
            message = $"تم إرسال {saved} سجل بنجاح إلى وكيل {stage.Value.ToArabic()}",
            count = saved,
            records = savedRecords,
            stage = stage.Value.ToArabic()
        }));
    }

    // ════════════════════════════════════════════════════════════════
    // 3. جلب طلاب فصل — مطابق لـ getClassStudents() سطر 558-660
    // ════════════════════════════════════════════════════════════════
    [HttpGet("public/class-students")]
    public async Task<ActionResult<ApiResponse<object>>> GetClassStudents([FromQuery] string className)
    {
        if (string.IsNullOrEmpty(className))
            return BadRequest(ApiResponse<object>.Fail("اسم الفصل مطلوب"));

        var stage = DetectStage(className);
        var classNameParts = className.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var targetGrade = classNameParts.Length > 1
            ? string.Join(" ", classNameParts[..^1])
            : className;
        var targetSection = classNameParts.Length > 1
            ? classNameParts[^1]
            : "";

        var query = _db.Students.AsQueryable();

        if (stage != null)
            query = query.Where(s => s.Stage == stage.Value);

        // ★ مطابقة: الصف يحتوي على اسم الصف + رقم الفصل يطابق
        var students = await query
            .Where(s => s.Grade.Contains(targetGrade) && s.Class == targetSection)
            .OrderBy(s => s.Name)
            .Select(s => new
            {
                id = s.StudentNumber,
                name = s.Name,
                grade = s.Grade,
                @class = s.Class,
                phone = s.Mobile
            })
            .ToListAsync();

        return Ok(ApiResponse<object>.Ok(new { success = true, students }));
    }

    // ════════════════════════════════════════════════════════════════
    // 4. التحقق من الرمز — مطابق لـ getTeacherByToken() سطر 478-540
    // ════════════════════════════════════════════════════════════════
    [HttpGet("public/teacher-by-token")]
    public async Task<ActionResult<ApiResponse<object>>> GetTeacherByToken([FromQuery] string token)
    {
        if (string.IsNullOrEmpty(token))
            return BadRequest(ApiResponse<object>.Fail("الرمز غير موجود"));

        var teacher = await _db.Teachers
            .FirstOrDefaultAsync(t => t.TokenLink == token && t.IsActive);

        if (teacher == null)
            return NotFound(ApiResponse<object>.Fail("رابط غير صالح أو منتهي الصلاحية"));

        // ★ تحويل مفاتيح الفصول إلى أسماء عربية (مطابق لسطر 510-517)
        var rawClasses = (teacher.AssignedClasses ?? "")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        var displayClasses = rawClasses
            .Select(c =>
            {
                var colonIdx = c.IndexOf(':');
                var key = colonIdx > -1 ? c[..colonIdx] : c;
                var p = ParseClassKey(key);
                return p?.displayName ?? key;
            })
            .ToList();

        var subjects = (teacher.Subjects ?? "")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        return Ok(ApiResponse<object>.Ok(new
        {
            success = true,
            teacher = new
            {
                id = teacher.CivilId,
                name = teacher.Name,
                subject = string.Join("، ", subjects),
                classes = displayClasses
            }
        }));
    }

    // ════════════════════════════════════════════════════════════════
    // 5. الفصول المتاحة — مطابق لـ getAvailableClasses() سطر 1343-1372
    // ════════════════════════════════════════════════════════════════
    [HttpGet("classes/available")]
    public async Task<ActionResult<ApiResponse<List<string>>>> GetAvailableClasses()
    {
        var classes = await _db.Students
            .Select(s => new { s.Grade, s.Class })
            .Distinct()
            .OrderBy(s => s.Grade).ThenBy(s => s.Class)
            .ToListAsync();

        var result = classes
            .Select(c => $"{c.Grade} {c.Class}".Trim())
            .Where(c => !string.IsNullOrEmpty(c))
            .Distinct()
            .ToList();

        return Ok(ApiResponse<List<string>>.Ok(result));
    }

    // ════════════════════════════════════════════════════════════════
    // 6. إنشاء رابط معلم — مطابق لـ createTeacherLink() سطر 239-313
    // ════════════════════════════════════════════════════════════════
    [HttpPost("links/teacher/{teacherId}")]
    public async Task<ActionResult<ApiResponse<object>>> CreateTeacherLink(int teacherId)
    {
        var teacher = await _db.Teachers.FindAsync(teacherId);
        if (teacher == null)
            return NotFound(ApiResponse<object>.Fail("المعلم غير موجود"));

        // ★ مسح كاش الرابط القديم (مطابق لسطر 282-284)
        if (!string.IsNullOrEmpty(teacher.TokenLink))
            _cache.Remove($"tpd_{teacher.TokenLink}");

        var newToken = GenerateToken();
        var baseUrl = _config["App:BaseUrl"] ?? "https://school.alareen.sa";
        var newLink = $"{baseUrl}?page=teacher&token={newToken}";

        teacher.TokenLink = newToken;
        teacher.LinkUrl = newLink;
        teacher.ActivationDate = DateTime.UtcNow;
        teacher.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new
        {
            success = true,
            teacherName = teacher.Name,
            teacherPhone = teacher.Mobile,
            token = newToken,
            link = newLink,
            message = "تم إنشاء رابط جديد للمعلم"
        }));
    }

    // ════════════════════════════════════════════════════════════════
    // 7. إنشاء رابط بالجوال — مطابق لـ createTeacherLinkByPhone_() سطر 318-371
    // ════════════════════════════════════════════════════════════════
    [HttpPost("links/teacher/by-phone")]
    public async Task<ActionResult<ApiResponse<object>>> CreateTeacherLinkByPhone([FromBody] PhoneLinkRequest request)
    {
        var cleanPhone = FormatPhone(request.Phone ?? "");

        // ★ الجوال أولوية مطلقة (مطابق لسطر 344)
        var teacher = await _db.Teachers
            .FirstOrDefaultAsync(t => t.Mobile == cleanPhone);

        // ★ البحث بالاسم كبديل — فقط إذا فريد (مطابق لسطر 349-358)
        if (teacher == null && !string.IsNullOrEmpty(request.Name))
        {
            var nameMatches = await _db.Teachers
                .Where(t => t.Name == request.Name)
                .ToListAsync();
            if (nameMatches.Count == 1)
                teacher = nameMatches[0];
            else if (nameMatches.Count > 1)
                return BadRequest(ApiResponse<object>.Fail($"يوجد أكثر من معلم بنفس الاسم: {request.Name}"));
        }

        if (teacher == null)
            return NotFound(ApiResponse<object>.Fail($"المعلم غير موجود: {request.Name}"));

        return await CreateTeacherLink(teacher.Id);
    }

    // ════════════════════════════════════════════════════════════════
    // 8. إنشاء رابط مستخدم — مطابق لـ createUserLink() سطر 1220-1302
    // ════════════════════════════════════════════════════════════════
    [HttpPost("links/user/{userId}")]
    public async Task<ActionResult<ApiResponse<object>>> CreateUserLink(int userId)
    {
        var user = await _db.Users.FindAsync(userId);
        if (user == null)
            return NotFound(ApiResponse<object>.Fail("المستخدم غير موجود"));

        var newToken = GenerateToken();

        // ★ خريطة الدور → نوع الصفحة (مطابق لسطر 1272-1281)
        var pageType = user.Role switch
        {
            UserRole.Admin => "wakeel",
            UserRole.Deputy => "wakeel",
            UserRole.Counselor => "counselor",
            UserRole.Staff => "admin",
            UserRole.Guard => "guard",
            _ => "admin"
        };

        var baseUrl = _config["App:BaseUrl"] ?? "https://school.alareen.sa";
        var link = $"{baseUrl}?page={pageType}&token={newToken}";

        user.TokenLink = newToken;
        user.LinkUrl = link;
        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new
        {
            success = true,
            link,
            token = newToken,
            userName = user.Name,
            userPhone = user.Mobile,
            role = user.Role.ToString(),
            pageType
        }));
    }

    // ════════════════════════════════════════════════════════════════
    // 9. إنشاء رابط مستخدم بالجوال — مطابق لـ createUserLinkByPhone_() سطر 373-425
    // ════════════════════════════════════════════════════════════════
    [HttpPost("links/user/by-phone")]
    public async Task<ActionResult<ApiResponse<object>>> CreateUserLinkByPhone([FromBody] PhoneLinkRequest request)
    {
        var cleanPhone = FormatPhone(request.Phone ?? "");

        var user = await _db.Users
            .FirstOrDefaultAsync(u => u.Mobile == cleanPhone);

        if (user == null && !string.IsNullOrEmpty(request.Name))
        {
            var nameMatches = await _db.Users
                .Where(u => u.Name == request.Name)
                .ToListAsync();
            if (nameMatches.Count == 1)
                user = nameMatches[0];
            else if (nameMatches.Count > 1)
                return BadRequest(ApiResponse<object>.Fail($"يوجد أكثر من مستخدم بنفس الاسم: {request.Name}"));
        }

        if (user == null)
            return NotFound(ApiResponse<object>.Fail($"المستخدم غير موجود: {request.Name}"));

        return await CreateUserLink(user.Id);
    }

    // ════════════════════════════════════════════════════════════════
    // 10. إنشاء روابط لجميع المعلمين — مطابق لـ createAllTeachersLinks() سطر 1176-1209
    // ════════════════════════════════════════════════════════════════
    [HttpPost("links/teachers/all")]
    public async Task<ActionResult<ApiResponse<object>>> CreateAllTeachersLinks()
    {
        var teachers = await _db.Teachers.Where(t => t.IsActive).ToListAsync();
        var baseUrl = _config["App:BaseUrl"] ?? "https://school.alareen.sa";
        int created = 0;

        foreach (var teacher in teachers)
        {
            if (!string.IsNullOrEmpty(teacher.TokenLink))
                _cache.Remove($"tpd_{teacher.TokenLink}");

            var newToken = GenerateToken();
            teacher.TokenLink = newToken;
            teacher.LinkUrl = $"{baseUrl}?page=teacher&token={newToken}";
            teacher.ActivationDate = DateTime.UtcNow;
            teacher.UpdatedAt = DateTime.UtcNow;
            created++;
        }

        await _db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(new { success = true, created }));
    }

    // ════════════════════════════════════════════════════════════════
    // 11. إنشاء روابط لجميع المستخدمين — مطابق لـ createAllUsersLinks() سطر 1304-1337
    // ════════════════════════════════════════════════════════════════
    [HttpPost("links/users/all")]
    public async Task<ActionResult<ApiResponse<object>>> CreateAllUsersLinks()
    {
        var users = await _db.Users.Where(u => u.IsActive).ToListAsync();
        var baseUrl = _config["App:BaseUrl"] ?? "https://school.alareen.sa";
        int created = 0;

        foreach (var user in users)
        {
            var pageType = user.Role switch
            {
                UserRole.Admin => "wakeel",
                UserRole.Deputy => "wakeel",
                UserRole.Counselor => "counselor",
                UserRole.Staff => "admin",
                UserRole.Guard => "guard",
                _ => "admin"
            };

            var newToken = GenerateToken();
            user.TokenLink = newToken;
            user.LinkUrl = $"{baseUrl}?page={pageType}&token={newToken}";
            user.UpdatedAt = DateTime.UtcNow;
            created++;
        }

        await _db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(new { success = true, created }));
    }

    // ════════════════════════════════════════════════════════════════
    // 12. إلغاء ربط شخص — مطابق لـ removeLinkForPerson() سطر 1667-1765
    // ════════════════════════════════════════════════════════════════
    [HttpDelete("links/person")]
    public async Task<ActionResult<ApiResponse<object>>> RemoveLinkForPerson([FromBody] RemoveLinkRequest request)
    {
        var cleanPhone = FormatPhone(request.Phone ?? "");
        bool removed = false;

        // ★ 1. حذف من جدول LinkedPersons (مطابق لسطر 1678-1694)
        var linkedRecords = await _db.LinkedPersons
            .Where(lp => lp.Phone == cleanPhone && lp.Type == request.Type)
            .ToListAsync();
        if (linkedRecords.Any())
        {
            _db.LinkedPersons.RemoveRange(linkedRecords);
            removed = true;
        }

        // ★ 2. مسح التوكن والرابط من جدول المصدر (مطابق لسطر 1696-1741)
        if (request.Type == "teacher")
        {
            var teacher = await FindTeacherByPhoneOrName(cleanPhone, request.Name);
            if (teacher != null)
            {
                // ★ مسح الكاش (مطابق لسطر 1744-1751)
                if (!string.IsNullOrEmpty(teacher.TokenLink))
                    _cache.Remove($"tpd_{teacher.TokenLink}");

                teacher.TokenLink = "";
                teacher.LinkUrl = "";
                teacher.UpdatedAt = DateTime.UtcNow;
                removed = true;
            }
        }
        else
        {
            var user = await FindUserByPhoneOrName(cleanPhone, request.Name);
            if (user != null)
            {
                user.TokenLink = "";
                user.LinkUrl = "";
                user.UpdatedAt = DateTime.UtcNow;
                removed = true;
            }
        }

        if (removed)
        {
            await _db.SaveChangesAsync();
            return Ok(ApiResponse<object>.Ok(new { success = true, message = "تم إلغاء الربط بنجاح" }));
        }

        return NotFound(ApiResponse<object>.Fail("لم يتم العثور على الشخص"));
    }

    // ════════════════════════════════════════════════════════════════
    // 13. بيانات تبويب الروابط — مطابق لـ getLinksTabData() سطر 1382-1526
    // ════════════════════════════════════════════════════════════════
    [HttpGet("links/data")]
    public async Task<ActionResult<ApiResponse<object>>> GetLinksTabData()
    {
        // ★ جلب المعلمين (مطابق لسطر 1386-1413)
        var teachers = await _db.Teachers
            .Where(t => t.IsActive)
            .Select(t => new
            {
                id = t.Id,
                name = t.Name,
                phone = t.Mobile,
                subject = t.Subjects,
                classes = t.AssignedClasses,
                hasToken = !string.IsNullOrEmpty(t.TokenLink),
                hasLink = !string.IsNullOrEmpty(t.LinkUrl),
                link = t.LinkUrl
            })
            .ToListAsync();

        // ★ جلب الإداريين (مطابق لسطر 1416-1448)
        var admins = await _db.Users
            .Where(u => u.IsActive)
            .Select(u => new
            {
                id = u.Id,
                name = u.Name,
                phone = u.Mobile,
                role = u.Role.ToString(),
                scope = u.ScopeValue,
                classes = u.ScopeType == "classes" ? u.ScopeValue : "",
                hasToken = !string.IsNullOrEmpty(u.TokenLink),
                hasLink = !string.IsNullOrEmpty(u.LinkUrl),
                link = u.LinkUrl
            })
            .ToListAsync();

        // ★ جلب المربوطين (مطابق لسطر 1450-1502)
        var linkedFromTeachers = teachers
            .Where(t => t.hasToken)
            .Select(t => new { identifier = !string.IsNullOrEmpty(t.phone) ? t.phone : t.id.ToString(), type = "teacher", linkedBy = "", stage = "", linkedDate = "" });

        var linkedFromAdmins = admins
            .Where(a => a.hasToken)
            .Select(a => new { identifier = !string.IsNullOrEmpty(a.phone) ? a.phone : a.id.ToString(), type = "admin", linkedBy = "", stage = "", linkedDate = "" });

        var linkedFromDb = await _db.LinkedPersons
            .Select(lp => new { identifier = lp.Phone, type = lp.Type, linkedBy = lp.LinkedBy, stage = lp.Stage, linkedDate = lp.LinkedAt.ToString("yyyy-MM-dd") })
            .ToListAsync();

        // ★ تجميع بدون تكرار (مطابق لسطر 1489-1490)
        var allLinked = linkedFromTeachers
            .Concat(linkedFromAdmins)
            .Concat(linkedFromDb)
            .GroupBy(x => x.identifier)
            .Select(g => g.First())
            .ToList();

        // ★ المراحل المتاحة
        var stages = await _db.Students
            .Select(s => s.Stage)
            .Distinct()
            .ToListAsync();
        var availableStages = stages.Select(s => s.ToArabic()).ToList();

        return Ok(ApiResponse<object>.Ok(new
        {
            success = true,
            teachers,
            admins,
            linkedPersons = allLinked,
            availableStages
        }));
    }

    // ════════════════════════════════════════════════════════════════
    // 14. إرسال رابط مع المرحلة — مطابق لـ sendLinkToPersonWithStage() سطر 1533-1619
    // ════════════════════════════════════════════════════════════════
    [HttpPost("links/send")]
    public async Task<ActionResult<ApiResponse<object>>> SendLinkToPersonWithStage([FromBody] SendLinkRequest request)
    {
        var phone = FormatPhone(request.Phone ?? "");
        if (string.IsNullOrEmpty(phone))
            return BadRequest(ApiResponse<object>.Fail("رقم الجوال غير صحيح"));

        // ★ الخطوة 1: إنشاء الرابط (مطابق لسطر 1546-1556)
        string link = "";
        bool linkCreated = false;

        if (request.Type == "teacher")
        {
            var teacher = await FindTeacherByPhoneOrName(phone, request.Name);
            if (teacher == null)
                return NotFound(ApiResponse<object>.Fail("المعلم غير موجود"));

            if (!string.IsNullOrEmpty(teacher.TokenLink))
                _cache.Remove($"tpd_{teacher.TokenLink}");

            var newToken = GenerateToken();
            var baseUrl = _config["App:BaseUrl"] ?? "https://school.alareen.sa";
            link = $"{baseUrl}?page=teacher&token={newToken}";
            teacher.TokenLink = newToken;
            teacher.LinkUrl = link;
            teacher.ActivationDate = DateTime.UtcNow;
            teacher.UpdatedAt = DateTime.UtcNow;
            linkCreated = true;
        }
        else
        {
            var user = await FindUserByPhoneOrName(phone, request.Name);
            if (user == null)
                return NotFound(ApiResponse<object>.Fail("المستخدم غير موجود"));

            var newToken = GenerateToken();
            var pageType = user.Role switch
            {
                UserRole.Admin or UserRole.Deputy => "wakeel",
                UserRole.Counselor => "counselor",
                UserRole.Guard => "guard",
                _ => "admin"
            };
            var baseUrl = _config["App:BaseUrl"] ?? "https://school.alareen.sa";
            link = $"{baseUrl}?page={pageType}&token={newToken}";
            user.TokenLink = newToken;
            user.LinkUrl = link;
            user.UpdatedAt = DateTime.UtcNow;
            linkCreated = true;
        }

        if (!linkCreated)
            return BadRequest(ApiResponse<object>.Fail("فشل إنشاء الرابط"));

        await _db.SaveChangesAsync();

        // ★ الخطوة 2: إرسال عبر واتساب (مطابق لسطر 1562-1580)
        bool whatsappSent = false;
        string whatsappMessage = "";

        try
        {
            var wakilPhone = await GetWakilPhoneByStage(request.Stage ?? "");
            if (!string.IsNullOrEmpty(wakilPhone))
            {
                var schoolName = (await _db.SchoolSettings.FirstOrDefaultAsync())?.SchoolName ?? "المدرسة";
                var message = BuildLinkMessage(request.Name ?? "", request.Type, link, schoolName);
                whatsappSent = await SendWhatsAppFromStage(phone, message, wakilPhone);
                if (!whatsappSent)
                    whatsappMessage = "تم إنشاء الرابط لكن فشل إرسال الواتساب. يمكنك نسخ الرابط وإرساله يدوياً.";
            }
            else
            {
                whatsappMessage = $"تم إنشاء الرابط بنجاح. لا يوجد واتساب متصل لمرحلة {request.Stage} - يمكنك نسخ الرابط وإرساله يدوياً.";
            }
        }
        catch
        {
            whatsappMessage = "تم إنشاء الرابط لكن فشل إرسال الواتساب.";
        }

        // ★ الخطوة 3: تسجيل الربط (مطابق لسطر 1583-1590)
        await SaveLinkedPerson(phone, request.Name ?? "", request.Type, request.Stage ?? "", request.Classes ?? "", request.Stage ?? "");

        // ★ الخطوة 4: إشعار الوكلاء الآخرين (مطابق لسطر 1593-1604)
        var otherStages = GetOtherStagesForPerson(request.Classes ?? "", request.Stage ?? "");
        bool notifiedOthers = false;
        string otherStageStr = "";

        if (otherStages.Any())
        {
            await NotifyOtherWakils(request.Name ?? "", phone, request.Type, request.Stage ?? "", otherStages);
            notifiedOthers = true;
            otherStageStr = string.Join(" - ", otherStages);
        }

        return Ok(ApiResponse<object>.Ok(new
        {
            success = true,
            message = whatsappSent ? "تم إرسال الرابط عبر واتساب بنجاح ✅" : whatsappMessage,
            link,
            whatsappSent,
            notifyOtherWakil = notifiedOthers,
            otherStage = otherStageStr
        }));
    }

    // ════════════════════════════════════════════════════════════════
    // 15. إرسال جماعي — مطابق لـ bulkSendLinks() سطر 1626-1660
    // ════════════════════════════════════════════════════════════════
    [HttpPost("links/send-bulk")]
    public async Task<ActionResult<ApiResponse<object>>> BulkSendLinks([FromBody] List<SendLinkRequest> persons)
    {
        int sentCount = 0, failedCount = 0;
        var errors = new List<string>();

        for (int i = 0; i < persons.Count; i++)
        {
            // ★ تأخير 2 ثانية بين كل إرسال (مطابق لسطر 1636)
            if (i > 0)
                await Task.Delay(2000);

            try
            {
                var result = await SendLinkToPersonWithStage(persons[i]);
                if (result.Result is OkObjectResult)
                    sentCount++;
                else
                {
                    failedCount++;
                    errors.Add($"{persons[i].Name}: فشل الإرسال");
                }
            }
            catch (Exception ex)
            {
                failedCount++;
                errors.Add($"{persons[i].Name}: {ex.Message}");
            }
        }

        return Ok(ApiResponse<object>.Ok(new { success = true, sentCount, failedCount, errors }));
    }

    // ════════════════════════════════════════════════════════════════
    // الدوال المساعدة الخاصة (Private Helpers)
    // ════════════════════════════════════════════════════════════════

    /// <summary>
    /// توليد رمز فريد 8 أحرف — مطابق لـ generateTeacherToken() سطر 227-234
    /// </summary>
    private static string GenerateToken()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var random = Random.Shared;
        return new string(Enumerable.Range(0, 8).Select(_ => chars[random.Next(chars.Length)]).ToArray());
    }

    /// <summary>
    /// تنسيق رقم الجوال — مطابق لـ formatPhone() سطر 920-928
    /// </summary>
    private static string FormatPhone(string phone)
    {
        var clean = new string(phone.Where(char.IsDigit).ToArray());
        if (clean.StartsWith("05"))
            clean = "966" + clean[1..];
        else if (clean.StartsWith("5") && clean.Length == 9)
            clean = "966" + clean;
        return clean;
    }

    /// <summary>
    /// اكتشاف المرحلة — مطابق لـ detectStage_() سطر 930-940
    /// </summary>
    private static Stage? DetectStage(string? className)
    {
        if (string.IsNullOrEmpty(className)) return null;

        if (className.Contains("ثانوي") || className.Contains("ثانوى") || className.Contains("secondary", StringComparison.OrdinalIgnoreCase))
            return Stage.Secondary;
        if (className.Contains("متوسط") || className.Contains("intermediate", StringComparison.OrdinalIgnoreCase))
            return Stage.Intermediate;
        if (className.Contains("ابتدائي") || className.Contains("ابتدائى") || className.Contains("primary", StringComparison.OrdinalIgnoreCase))
            return Stage.Primary;
        if (className.Contains("طفولة") || className.Contains("روضة") || className.Contains("kindergarten", StringComparison.OrdinalIgnoreCase))
            return Stage.Kindergarten;

        return null;
    }

    /// <summary>
    /// تحليل مفتاح الفصل — مطابق لـ parseClassKey_() سطر 431-464
    /// "الأول_intermediate_أ" → (grade, stage, section, displayName)
    /// </summary>
    private static (string grade, Stage stage, string section, string displayName)? ParseClassKey(string classKey)
    {
        if (string.IsNullOrEmpty(classKey)) return null;

        var parts = classKey.Split('_');
        if (parts.Length >= 3)
        {
            var gradeParts = parts[..^2];
            var grade = string.Join(" ", gradeParts);
            var stageStr = parts[^2];
            var section = parts[^1];

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

        // ★ plain format: "الأول متوسط أ"
        var detected = DetectStage(classKey);
        if (detected != null)
        {
            var stageAr = detected.Value.ToArabic();
            var cleaned = classKey
                .Replace("متوسط", "").Replace("ثانوي", "")
                .Replace("ابتدائي", "").Replace("طفولة مبكرة", "")
                .Trim();
            var words = cleaned.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            var grade = words.Length > 0 ? words[0] : classKey;
            var section = words.Length > 1 ? words[^1] : "";
            return (grade, detected.Value, section, classKey);
        }

        return null;
    }

    /// <summary>
    /// تسجيل النشاط — مطابق لـ logActivity_() سطر 1136-1167
    /// </summary>
    private async Task LogActivity(TeacherFormSubmission form, int count, Stage stage)
    {
        var typeLabels = new Dictionary<string, string>
        {
            ["absence"] = "غياب",
            ["violation"] = "مخالفة سلوكية",
            ["note"] = "ملاحظة تربوية",
            ["positive"] = "سلوك متمايز",
            ["custom"] = "ملاحظة خاصة"
        };

        var typeLabel = typeLabels.GetValueOrDefault(form.InputType, form.InputType);
        var details = $"الفصل: {form.ClassName}";
        if (!string.IsNullOrEmpty(form.ItemText))
            details += $" - {form.ItemText}";

        await _audit.LogAsync(typeLabel, details, form.TeacherName, count, stage.ToArabic());
    }

    /// <summary>
    /// إشعار الوكيل عبر واتساب — مطابق لـ notifyDeputyWhatsApp_() سطر 792-843
    /// </summary>
    private async Task NotifyDeputyWhatsApp(TeacherFormSubmission form, List<SavedRecord> records, Stage stage)
    {
        try
        {
            var typeLabels = new Dictionary<string, string>
            {
                ["absence"] = "⚠️ غياب",
                ["violation"] = "🚫 مخالفة سلوكية",
                ["note"] = "📝 ملاحظة تربوية",
                ["positive"] = "⭐ سلوك متمايز",
                ["custom"] = "📋 ملاحظة خاصة"
            };

            var message = "📋 *إشعار من نموذج المعلم*\n";
            message += "━━━━━━━━━━━━━━━\n\n";
            message += $"👤 المعلم: {form.TeacherName}\n";
            message += $"📚 الفصل: {form.ClassName}\n";
            message += $"📝 النوع: {typeLabels.GetValueOrDefault(form.InputType, form.InputType)}\n";
            message += $"👥 العدد: {records.Count} طالب\n";

            if (!string.IsNullOrEmpty(form.ItemText))
                message += $"📄 التفاصيل: {form.ItemText}\n";

            message += "\n━━━━━━━━━━━━━━━\n";

            // ★ أسماء الطلاب (أول 5 فقط) — مطابق لسطر 816-822
            var maxShow = Math.Min(records.Count, 5);
            for (int i = 0; i < maxShow; i++)
                message += $"{i + 1}. {records[i].StudentName}\n";
            if (records.Count > 5)
                message += $"... و {records.Count - 5} آخرين\n";

            message += $"\n⏰ {DateTime.Now:HH:mm:ss}";

            // ★ التوجيه الذكي: البحث عن الوكيل المسؤول (مطابق لسطر 827-838)
            var stageAr = stage.ToArabic();
            var deputyPhone = await GetResponsibleDeputyPhone(form.ClassName, stageAr);
            if (string.IsNullOrEmpty(deputyPhone))
                deputyPhone = await GetWakilPhoneByStage(stageAr);

            if (!string.IsNullOrEmpty(deputyPhone))
                await SendWhatsAppFromStage(deputyPhone, message, deputyPhone);
        }
        catch
        {
            // مطابق للأصلي: لا تكسر العملية إذا فشل الإشعار
        }
    }

    /// <summary>
    /// البحث عن الوكيل المسؤول — مطابق لـ getResponsibleDeputyPhone_() سطر 846-893
    /// </summary>
    private async Task<string?> GetResponsibleDeputyPhone(string? className, string stageArabic)
    {
        if (string.IsNullOrEmpty(className)) return null;

        var targetClassName = className.Trim();
        string? stageDeputyPhone = null;

        var deputies = await _db.Users
            .Where(u => u.IsActive &&
                (u.Role == UserRole.Deputy || u.Role == UserRole.Admin))
            .ToListAsync();

        foreach (var deputy in deputies)
        {
            if (string.IsNullOrEmpty(deputy.Mobile)) continue;

            // ★ 1. مسؤول عن هذا الفصل تحديداً (مطابق لسطر 875-879)
            if (deputy.ScopeType == "classes" && !string.IsNullOrEmpty(deputy.ScopeValue))
            {
                var assignedClasses = deputy.ScopeValue.Split(',', StringSplitOptions.TrimEntries);
                if (assignedClasses.Contains(targetClassName))
                    return FormatPhone(deputy.Mobile);
            }

            // ★ 2. وكيل للمرحلة كاملة — احتياط (مطابق لسطر 883-885)
            if (deputy.ScopeType == "stage" && deputy.ScopeValue == stageArabic)
                stageDeputyPhone = FormatPhone(deputy.Mobile);
            else if (string.IsNullOrEmpty(deputy.ScopeValue) || deputy.ScopeValue == stageArabic)
                stageDeputyPhone ??= FormatPhone(deputy.Mobile);
        }

        return stageDeputyPhone;
    }

    /// <summary>
    /// جوال وكيل المرحلة — مطابق لـ getWakilPhoneByStage_() سطر 1774-1798
    /// </summary>
    private async Task<string?> GetWakilPhoneByStage(string stageArabic)
    {
        // ★ أولوية: الرقم الأساسي (IsPrimary) — مطابق لسطر 1777-1782
        var primary = await _db.WhatsAppSessions
            .FirstOrDefaultAsync(s => s.Stage == stageArabic && s.IsPrimary && s.ConnectionStatus == "connected");
        if (primary != null)
            return FormatPhone(primary.PhoneNumber);

        // ★ بديل: أي رقم متصل — مطابق لسطر 1785-1789
        var any = await _db.WhatsAppSessions
            .FirstOrDefaultAsync(s => s.Stage == stageArabic && s.ConnectionStatus == "connected");
        return any != null ? FormatPhone(any.PhoneNumber) : null;
    }

    /// <summary>
    /// إرسال واتساب — مطابق لـ sendWhatsAppFromStage_() سطر 1824-1860
    /// </summary>
    private async Task<bool> SendWhatsAppFromStage(string to, string message, string fromPhone)
    {
        try
        {
            var settings = await _db.WhatsAppSettings.FirstOrDefaultAsync();
            if (settings == null || string.IsNullOrEmpty(settings.ServerUrl))
                return false;

            return await _whatsApp.SendMessageAsync(
                settings.ServerUrl,
                FormatPhone(fromPhone),
                FormatPhone(to),
                message);
        }
        catch
        {
            return false;
        }
    }

    /// <summary>
    /// بناء رسالة الرابط — مطابق لـ buildLinkMessage_() سطر 1806-1819
    /// </summary>
    private static string BuildLinkMessage(string name, string type, string link, string schoolName)
    {
        var typeText = type == "teacher" ? "المعلم" : "الإداري";
        var message = $"🎓 *{schoolName}*\n\n";
        message += "السلام عليكم ورحمة الله وبركاته\n\n";
        message += $"الأستاذ الفاضل/ {name}\n\n";
        message += "تم إعداد رابط خاص بك للدخول إلى نظام المتابعة:\n\n";
        message += $"🔗 {link}\n\n";
        message += "📱 يمكنك استخدام هذا الرابط من جوالك أو جهاز الكمبيوتر.\n\n";
        message += "شكراً لتعاونكم 🙏";
        return message;
    }

    /// <summary>
    /// إشعار وكلاء المراحل الأخرى — مطابق لـ notifyOtherWakils_() سطر 1959-1976
    /// </summary>
    private async Task NotifyOtherWakils(string name, string phone, string type, string linkedStage, List<string> otherStages)
    {
        try
        {
            var typeText = type == "teacher" ? "المعلم" : "الإداري";
            foreach (var otherStage in otherStages)
            {
                var wakilPhone = await GetWakilPhoneByStage(otherStage);
                if (!string.IsNullOrEmpty(wakilPhone))
                {
                    var message = "📢 *إشعار ربط*\n\n";
                    message += $"تم ربط {typeText} *{name}* بالنظام\n";
                    message += $"من قبل وكيل مرحلة *{linkedStage}*\n\n";
                    message += "ملاحظة: هذا الشخص مشترك في مرحلتك أيضاً، والردود ستصلك بحسب الفصل المختار.";
                    await SendWhatsAppFromStage(wakilPhone, message, wakilPhone);
                }
            }
        }
        catch
        {
            // مطابق للأصلي: لا تكسر العملية
        }
    }

    /// <summary>
    /// حفظ بيانات الشخص المربوط — مطابق لـ saveLinkedPerson_() سطر 1865-1913
    /// </summary>
    private async Task SaveLinkedPerson(string phone, string name, string type, string stage, string classes, string linkedBy)
    {
        try
        {
            // ★ فحص التكرار: نفس الجوال ونفس النوع → تحديث (مطابق لسطر 1879-1886)
            var existing = await _db.LinkedPersons
                .FirstOrDefaultAsync(lp => lp.Phone == phone && lp.Type == type);

            if (existing != null)
            {
                existing.Name = name;
                existing.Stage = stage;
                existing.Classes = classes;
                existing.LinkedBy = linkedBy;
                existing.LinkedAt = DateTime.UtcNow;
            }
            else
            {
                _db.LinkedPersons.Add(new LinkedPerson
                {
                    Phone = phone,
                    Name = name,
                    Type = type,
                    Stage = stage,
                    Classes = classes,
                    LinkedBy = linkedBy,
                    LinkedAt = DateTime.UtcNow
                });
            }
            await _db.SaveChangesAsync();
        }
        catch
        {
            // مطابق للأصلي: لا تكسر العملية
        }
    }

    /// <summary>
    /// استخراج المراحل من الفصول — مطابق لـ getStagesFromClasses_() سطر 1928-1954
    /// </summary>
    private static List<string> GetStagesFromClasses(string classes)
    {
        if (string.IsNullOrEmpty(classes)) return new();

        var stages = new List<string>();
        foreach (var cls in classes.Split(',', StringSplitOptions.TrimEntries))
        {
            string? stage = null;
            if (cls.Contains("ابتدائي", StringComparison.OrdinalIgnoreCase) || cls.Contains("primary", StringComparison.OrdinalIgnoreCase))
                stage = "ابتدائي";
            else if (cls.Contains("متوسط", StringComparison.OrdinalIgnoreCase) || cls.Contains("intermediate", StringComparison.OrdinalIgnoreCase))
                stage = "متوسط";
            else if (cls.Contains("ثانوي", StringComparison.OrdinalIgnoreCase) || cls.Contains("secondary", StringComparison.OrdinalIgnoreCase))
                stage = "ثانوي";

            if (stage != null && !stages.Contains(stage))
                stages.Add(stage);
        }
        return stages;
    }

    /// <summary>
    /// المراحل الأخرى للشخص — مطابق لـ getOtherStagesForPerson_() سطر 1918-1923
    /// </summary>
    private static List<string> GetOtherStagesForPerson(string classes, string currentStage)
    {
        return GetStagesFromClasses(classes)
            .Where(s => s != currentStage)
            .ToList();
    }

    /// <summary>
    /// البحث عن معلم بالجوال أو الاسم — مطابق لمنطق البحث في سطر 334-358
    /// </summary>
    private async Task<Teacher?> FindTeacherByPhoneOrName(string phone, string? name)
    {
        // ★ الجوال أولوية مطلقة
        var teacher = await _db.Teachers
            .FirstOrDefaultAsync(t => t.Mobile == phone);

        // ★ الاسم كبديل فقط إذا فريد
        if (teacher == null && !string.IsNullOrEmpty(name))
        {
            var nameMatches = await _db.Teachers
                .Where(t => t.Name == name)
                .ToListAsync();
            if (nameMatches.Count == 1)
                teacher = nameMatches[0];
        }

        return teacher;
    }

    /// <summary>
    /// البحث عن مستخدم بالجوال أو الاسم — مطابق لمنطق البحث في سطر 389-411
    /// </summary>
    private async Task<User?> FindUserByPhoneOrName(string phone, string? name)
    {
        var user = await _db.Users
            .FirstOrDefaultAsync(u => u.Mobile == phone);

        if (user == null && !string.IsNullOrEmpty(name))
        {
            var nameMatches = await _db.Users
                .Where(u => u.Name == name)
                .ToListAsync();
            if (nameMatches.Count == 1)
                user = nameMatches[0];
        }

        return user;
    }

    private static string MapViolationType(string? arabicType) => arabicType switch
    {
        "حضوري" => "InPerson",
        "رقمي" => "Digital",
        "هيئة تعليمية" => "Educational",
        _ => "InPerson"
    };
}

// ════════════════════════════════════════════════════════════════
// DTOs
// ════════════════════════════════════════════════════════════════

public class TeacherFormSubmission
{
    public string Token { get; set; } = "";
    public string TeacherName { get; set; } = "";
    public string ClassName { get; set; } = "";
    public string InputType { get; set; } = "";
    public string? ItemId { get; set; }
    public string? ItemText { get; set; }
    public string? ItemDegree { get; set; }
    public string? ViolationType { get; set; }
    public string? AbsenceType { get; set; }
    public string? TeacherSubject { get; set; }
    public string? Details { get; set; }
    public string? NoteClassification { get; set; }
    public string? HijriDate { get; set; }
    public string? DayName { get; set; }
    public bool NoAbsence { get; set; }
    public bool NotifyDeputy { get; set; }
    public string? Stage { get; set; }
    public List<TeacherFormStudent> Students { get; set; } = new();
}

public class TeacherFormStudent
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string? Phone { get; set; }
}

public class PhoneLinkRequest
{
    public string? Phone { get; set; }
    public string? Name { get; set; }
}

public class RemoveLinkRequest
{
    public string? Phone { get; set; }
    public string? Name { get; set; }
    public string Type { get; set; } = "teacher";
}

public class SendLinkRequest
{
    public string? Name { get; set; }
    public string? Phone { get; set; }
    public string Type { get; set; } = "teacher";
    public string? Stage { get; set; }
    public string? Classes { get; set; }
}

public class SavedRecord
{
    public string StudentName { get; set; } = "";
    public string StudentId { get; set; } = "";
}
