using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using SchoolBehaviorSystem.Domain.Enums;
using SchoolBehaviorSystem.Infrastructure.Data;

namespace SchoolBehaviorSystem.Infrastructure.Services;

/// <summary>
/// خبز بيانات المعلمين يومياً الساعة 5 صباحاً — مطابق لـ:
/// - bakeAllTeachersData() في Server_TeacherInput.gs سطر 146-180
/// - setupDailyBakeTrigger() سطر 185-203
/// البديل لـ CacheService.getScriptCache() هو IMemoryCache
/// </summary>
public class TeacherDataBakeService : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly IMemoryCache _cache;
    private readonly ILogger<TeacherDataBakeService> _logger;

    // ★ التوقيت: الساعة 5 صباحاً بتوقيت الرياض (مطابق لسطر 197-199)
    private static readonly TimeZoneInfo RiyadhTz = TimeZoneInfo.FindSystemTimeZoneById("Asia/Riyadh");
    private const int TargetHourRiyadh = 5;

    public TeacherDataBakeService(
        IServiceProvider services,
        IMemoryCache cache,
        ILogger<TeacherDataBakeService> logger)
    {
        _services = services;
        _cache = cache;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("✅ TeacherDataBakeService بدأ — يعمل يومياً الساعة 5 صباحاً بتوقيت الرياض");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var delay = CalculateDelayUntilNextRun();
                _logger.LogInformation("⏳ الخبز القادم بعد {Hours:F1} ساعة", delay.TotalHours);
                await Task.Delay(delay, stoppingToken);

                await BakeAllTeachersData(stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ خطأ في TeacherDataBakeService");
                // انتظار 5 دقائق قبل المحاولة مرة أخرى
                await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
            }
        }
    }

    /// <summary>
    /// خبز بيانات كل المعلمين — مطابق لـ bakeAllTeachersData() سطر 146-180
    /// يبني بيانات كل معلم ويحفظها في الكاش لمدة 6 ساعات
    /// </summary>
    private async Task BakeAllTeachersData(CancellationToken ct)
    {
        _logger.LogInformation("🔥 بدء خبز بيانات المعلمين...");

        using var scope = _services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        // ★ جلب كل المعلمين الذين لديهم توكن (مطابق لسطر 155-156)
        var teachers = await db.Teachers
            .Where(t => t.IsActive && !string.IsNullOrEmpty(t.TokenLink))
            .ToListAsync(ct);

        var schoolSettings = await db.SchoolSettings.FirstOrDefaultAsync(ct);
        int baked = 0;

        // ★ خريطة تحويل الحرف لرقم
        var letterToNum = new Dictionary<string, string>
        {
            ["أ"] = "1", ["ب"] = "2", ["ج"] = "3", ["د"] = "4",
            ["ه"] = "5", ["هـ"] = "5", ["و"] = "6", ["ز"] = "7",
            ["ح"] = "8", ["ط"] = "9"
        };

        foreach (var teacher in teachers)
        {
            if (ct.IsCancellationRequested) break;

            try
            {
                // ★ بناء البيانات (مطابق لـ buildTeacherPageData_ سطر 12-141)
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

                var classesData = new List<object>();
                var studentsMap = new Dictionary<string, List<object>>();

                foreach (var classKey in rawClasses)
                {
                    var parsed = ParseClassKey(classKey);
                    if (parsed == null) continue;

                    var (grade, stage, section, displayName) = parsed.Value;
                    var classNum = letterToNum.GetValueOrDefault(section, section);
                    var stageArabic = stage.ToArabic();
                    var gradeWithStage = $"{grade} {stageArabic}".Trim();
                    var display = $"{gradeWithStage} {classNum}";
                    var classSubject = classSubjectMap.GetValueOrDefault(classKey, teacher.Subjects ?? "");

                    classesData.Add(new
                    {
                        d = display,
                        g = gradeWithStage,
                        c = classNum,
                        s = stageArabic,
                        sub = classSubject
                    });

                    var students = await db.Students
                        .Where(s => s.Stage == stage && s.Grade == grade && s.Class == classNum)
                        .OrderBy(s => s.Name)
                        .Select(s => new { i = s.StudentNumber, n = s.Name, p = s.Mobile })
                        .ToListAsync(ct);

                    studentsMap[display] = students.Cast<object>().ToList();
                }

                var pageData = new
                {
                    success = true,
                    sn = schoolSettings?.SchoolName ?? "",
                    t = new { n = teacher.Name, s = teacher.Subjects ?? "" },
                    cl = classesData,
                    st = studentsMap
                };

                // ★ حفظ في الكاش 6 ساعات (مطابق لسطر 168)
                _cache.Set($"tpd_{teacher.TokenLink}", pageData, TimeSpan.FromHours(6));
                baked++;
            }
            catch (Exception ex)
            {
                // مطابق لسطر 170-172: "فشل تخزين بيانات المعلم (حجم كبير)"
                _logger.LogWarning("فشل خبز بيانات المعلم {Token}: {Error}", teacher.TokenLink, ex.Message);
            }
        }

        _logger.LogInformation("✅ تم بناء بيانات {Count} معلم بنجاح", baked);
    }

    /// <summary>
    /// حساب التأخير حتى الساعة 5 صباحاً القادمة بتوقيت الرياض
    /// </summary>
    private TimeSpan CalculateDelayUntilNextRun()
    {
        var nowRiyadh = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, RiyadhTz);
        var nextRun = nowRiyadh.Date.AddHours(TargetHourRiyadh);

        // إذا فات الوقت اليوم → غداً
        if (nextRun <= nowRiyadh)
            nextRun = nextRun.AddDays(1);

        var nextRunUtc = TimeZoneInfo.ConvertTimeToUtc(nextRun, RiyadhTz);
        return nextRunUtc - DateTime.UtcNow;
    }

    /// <summary>
    /// نسخة محلية من ParseClassKey (مستقلة عن الكنترولر)
    /// </summary>
    private static (string grade, Domain.Enums.Stage stage, string section, string displayName)? ParseClassKey(string classKey)
    {
        if (string.IsNullOrEmpty(classKey)) return null;

        var parts = classKey.Split('_');
        if (parts.Length >= 3)
        {
            var gradeParts = parts[..^2];
            var grade = string.Join(" ", gradeParts);
            var stageStr = parts[^2];
            var section = parts[^1];

            Domain.Enums.Stage? stage = stageStr.ToLowerInvariant() switch
            {
                "intermediate" or "متوسط" => Domain.Enums.Stage.Intermediate,
                "secondary" or "ثانوي" => Domain.Enums.Stage.Secondary,
                "primary" or "ابتدائي" => Domain.Enums.Stage.Primary,
                "kindergarten" or "طفولة مبكرة" => Domain.Enums.Stage.Kindergarten,
                _ => null
            };

            if (stage != null)
            {
                var stageArabic = stage.Value.ToArabic();
                return (grade, stage.Value, section, $"{grade} {stageArabic} {section}");
            }
        }

        return null;
    }
}
