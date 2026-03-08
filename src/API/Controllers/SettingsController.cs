using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SchoolBehaviorSystem.Application.DTOs.Requests;
using SchoolBehaviorSystem.Application.DTOs.Responses;
using SchoolBehaviorSystem.Application.Interfaces;
using SchoolBehaviorSystem.Domain.Entities;
using SchoolBehaviorSystem.Domain.Enums;

namespace SchoolBehaviorSystem.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class SettingsController : ControllerBase
{
    private readonly ISchoolConfigService _configService;

    public SettingsController(ISchoolConfigService configService)
    {
        _configService = configService;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<SchoolSettings>>> GetSettings()
    {
        var settings = await _configService.GetSettingsAsync();
        return Ok(ApiResponse<SchoolSettings>.Ok(settings!));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse>> SaveSettings([FromBody] SaveSettingsRequest request)
    {
        // التحقق من القيم المسموحة (يدعم PascalCase من الواجهة و lowercase من الأصلي)
        var letterheadMode = string.Equals(request.LetterheadMode, "image", StringComparison.OrdinalIgnoreCase)
            ? LetterheadMode.Image : LetterheadMode.Text;
        var whatsappMode = string.Equals(request.WhatsAppMode, "unified", StringComparison.OrdinalIgnoreCase)
            ? WhatsAppMode.Unified : WhatsAppMode.PerStage;

        // تنظيف المدخلات
        var schoolName = SanitizeInput(request.SchoolName);
        var eduAdmin = SanitizeInput(request.EduAdmin);
        var eduDept = SanitizeInput(request.EduDept);
        var imageUrl = (request.LetterheadImageUrl ?? "").Trim();

        // التحقق من الروابط (مطابق للنظام الأصلي)
        if (!string.IsNullOrEmpty(imageUrl) && !imageUrl.StartsWith("https://"))
            return Ok(ApiResponse.Fail("رابط صورة الكليشة يجب أن يبدأ بـ https://"));

        if (letterheadMode == LetterheadMode.Image && string.IsNullOrEmpty(imageUrl))
            return Ok(ApiResponse.Fail("يرجى إدخال رابط صورة الكليشة"));

        if (letterheadMode == LetterheadMode.Text && string.IsNullOrEmpty(schoolName))
            return Ok(ApiResponse.Fail("يرجى إدخال اسم المدرسة على الأقل"));

        var settings = new SchoolSettings
        {
            SchoolName = schoolName,
            EduAdmin = eduAdmin,
            EduDept = eduDept,
            LetterheadMode = letterheadMode,
            LetterheadImageUrl = imageUrl,
            Letterhead = SanitizeInput(request.Letterhead),
            WhatsAppMode = whatsappMode,
            // طاقم العمل
            ManagerName = SanitizeInput(request.ManagerName),
            DeputyName = SanitizeInput(request.DeputyName),
            CounselorName = SanitizeInput(request.CounselorName),
            CommitteeName = SanitizeInput(request.CommitteeName),
            WakeelName = SanitizeInput(request.WakeelName),
            WakeelSignature = SanitizeInput(request.WakeelSignature),
        };

        await _configService.SaveSettingsAsync(settings);
        return Ok(ApiResponse.Ok("تم حفظ الإعدادات بنجاح"));
    }

    [HttpGet("structure")]
    public async Task<ActionResult<ApiResponse<object>>> GetStructure()
    {
        var settings = await _configService.GetSettingsAsync();
        var allStages = await _configService.GetEnabledStagesAsync();

        // stages as array for frontend StageConfigData[]
        var stagesArray = allStages.Select(s => new
        {
            stage = s.Stage.ToString(),
            isEnabled = s.IsEnabled,
            grades = s.Grades.Select(g => new
            {
                gradeName = g.GradeName,
                classCount = g.ClassCount,
                isEnabled = g.IsEnabled
            })
        });

        return Ok(ApiResponse<object>.Ok(new
        {
            schoolType = settings?.SchoolType.ToString() ?? "Boys",
            secondarySystem = settings?.SecondarySystem.ToString() ?? "Semester",
            stages = stagesArray
        }));
    }

    [HttpPost("structure")]
    public async Task<ActionResult<ApiResponse>> SaveStructure([FromBody] SaveStructureRequest request)
    {
        // التحقق من القيم المسموحة (يدعم القيم العربية والإنجليزية من الواجهة)
        var schoolType = (request.SchoolType == "بنات" || string.Equals(request.SchoolType, "Girls", StringComparison.OrdinalIgnoreCase))
            ? SchoolType.Girls : SchoolType.Boys;
        var secondarySystem = (request.SecondarySystem == "مسارات" || string.Equals(request.SecondarySystem, "Tracks", StringComparison.OrdinalIgnoreCase))
            ? SecondarySystem.Tracks : SecondarySystem.Semester;

        var stageConfigs = new List<StageConfig>();
        bool hasEnabledStage = false;

        foreach (var stageReq in request.Stages)
        {
            // تحويل اسم المرحلة إلى enum (يدعم PascalCase من الواجهة)
            if (!Enum.TryParse<Stage>(stageReq.Stage, true, out var stage)) continue;

            var gradeConfigs = new List<GradeConfig>();
            bool stageHasEnabled = false;

            foreach (var gradeReq in stageReq.Grades)
            {
                var classCount = Math.Min(gradeReq.ClassCount, 15); // حد أقصى 15 (مطابق للأصلي)
                if (gradeReq.IsEnabled && classCount > 0)
                {
                    stageHasEnabled = true;
                    hasEnabledStage = true;
                }

                gradeConfigs.Add(new GradeConfig
                {
                    GradeName = gradeReq.GradeName,
                    IsEnabled = gradeReq.IsEnabled,
                    ClassCount = classCount
                });
            }

            stageConfigs.Add(new StageConfig
            {
                Stage = stage,
                IsEnabled = stageHasEnabled,
                Grades = gradeConfigs
            });
        }

        if (!hasEnabledStage)
            return Ok(ApiResponse.Fail("يجب تفعيل مرحلة واحدة على الأقل مع صف وفصل"));

        // مقارنة المراحل القديمة بالجديدة (مطابق لـ saveSchoolStructure في Server_Settings.gs سطر 220-253)
        var oldStages = await _configService.GetEnabledStagesAsync();
        var oldEnabledIds = oldStages.Where(s => s.IsEnabled).Select(s => s.Stage).ToHashSet();
        var newEnabledIds = stageConfigs.Where(s => s.IsEnabled).Select(s => s.Stage).ToHashSet();

        var removedStages = oldEnabledIds.Except(newEnabledIds).ToList();

        // إذا هناك مراحل مُلغاة ولم يُؤكّد الحذف — أرجع قائمة للتأكيد
        // ★ مطابق لـ saveSchoolStructure في Server_Settings.gs سطر 234-253
        if (removedStages.Count > 0 && !request.ConfirmedDeletion)
        {
            // بناء قائمة البيانات التي ستُحذف (مطابق لـ sheetsToDelete في الأصلي)
            var dataToDelete = new List<string>();
            foreach (var removedStage in removedStages)
            {
                var arabicName = removedStage.ToArabic();
                dataToDelete.Add($"طلاب_{arabicName}");
                dataToDelete.Add($"مخالفات_{arabicName}");
                dataToDelete.Add($"غياب_{arabicName}");
                dataToDelete.Add($"غياب_تراكمي_{arabicName}");
                dataToDelete.Add($"تأخر_{arabicName}");
                dataToDelete.Add($"استئذان_{arabicName}");
                dataToDelete.Add($"ملاحظات_{arabicName}");
                dataToDelete.Add($"سلوك_{arabicName}");
            }

            return Ok(ApiResponse<object>.Ok(new
            {
                needsConfirmation = true,
                removedStages = removedStages.Select(s => s.ToArabic()).ToList(),
                dataToDelete,
                message = "سيتم حذف جميع بيانات المراحل المُلغاة نهائياً. هل أنت متأكد؟"
            }));
        }

        await _configService.SaveStructureAsync(schoolType, secondarySystem, stageConfigs);

        var addedStages = newEnabledIds.Except(oldEnabledIds).Select(s => s.ToArabic()).ToList();

        return Ok(ApiResponse<object>.Ok(new
        {
            success = true,
            message = "تم حفظ الهيكل بنجاح",
            addedStages,
            removedStages = request.ConfirmedDeletion ? removedStages.Select(s => s.ToArabic()).ToList() : new List<string>()
        }));
    }

    [HttpGet("is-configured")]
    public async Task<ActionResult<ApiResponse<bool>>> IsConfigured()
    {
        var configured = await _configService.IsConfiguredAsync();
        return Ok(ApiResponse<bool>.Ok(configured));
    }

    /// <summary>التاريخ الهجري الكامل — مطابق لـ getHijriDateFull_ في Config.gs</summary>
    [HttpGet("hijri-date")]
    public ActionResult<ApiResponse<HijriDateFull>> GetHijriDate([FromServices] IHijriDateService hijriService)
    {
        var result = hijriService.GetHijriDateFull();
        return Ok(ApiResponse<HijriDateFull>.Ok(result));
    }

    [HttpGet("stages")]
    public async Task<ActionResult<ApiResponse<object>>> GetEnabledStages()
    {
        var stages = await _configService.GetEnabledStagesAsync();
        var result = stages.Select(s => new
        {
            id = s.Stage.ToString().ToLower(),
            name = s.Stage.ToArabic(),
            grades = s.Grades.Select(g => new
            {
                name = g.GradeName,
                classCount = g.ClassCount
            })
        });
        return Ok(ApiResponse<object>.Ok(result));
    }

    private static string SanitizeInput(string? input)
    {
        if (string.IsNullOrEmpty(input)) return "";
        // إزالة HTML tags (مطابق لـ sanitizeInput_ في الأصلي)
        return System.Text.RegularExpressions.Regex.Replace(input, "<[^>]*>", "")
            .Replace("\n", " ")
            .Trim();
    }
}
