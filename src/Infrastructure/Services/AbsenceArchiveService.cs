using Microsoft.EntityFrameworkCore;
using SchoolBehaviorSystem.Domain.Entities;
using SchoolBehaviorSystem.Domain.Enums;
using SchoolBehaviorSystem.Infrastructure.Data;

namespace SchoolBehaviorSystem.Infrastructure.Services;

/// <summary>
/// ترحيل الغياب اليومي — يعمل الساعة 12 صباحاً بتوقيت الرياض
/// مطابق لـ archiveDailyAbsence() في Server_Absence_Daily.gs سطر 846-897
/// + createArchiveTrigger() سطر 902-919
///
/// المنطق:
/// 1. يجلب سجلات الغياب اليومي من الأمس وما قبله
/// 2. للسجلات التي حالتها "غائب" ولم تُعتمد → يحدث السجل التراكمي
/// 3. لا يحذف السجلات من DB (فرق عن GAS: الأصلي كان يحذف من الشيت)
///    بدلاً من ذلك يعلّمها كمؤرشفة (isArchived flag) إذا تم إضافته لاحقاً
/// </summary>
public class AbsenceArchiveService : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly ILogger<AbsenceArchiveService> _logger;

    // ★ التوقيت: الساعة 12 صباحاً بتوقيت الرياض (مطابق لسطر 911-913)
    private static readonly TimeZoneInfo RiyadhTz = TimeZoneInfo.FindSystemTimeZoneById("Asia/Riyadh");
    private const int TargetHourRiyadh = 0; // 12 صباحاً

    public AbsenceArchiveService(
        IServiceProvider services,
        ILogger<AbsenceArchiveService> logger)
    {
        _services = services;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("✅ AbsenceArchiveService بدأ — يعمل يومياً الساعة 12 صباحاً بتوقيت الرياض");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var delay = CalculateDelayUntilNextRun();
                _logger.LogInformation("⏳ الترحيل القادم بعد {Hours:F1} ساعة", delay.TotalHours);
                await Task.Delay(delay, stoppingToken);

                await ArchiveDailyAbsence(stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ خطأ في AbsenceArchiveService");
                await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
            }
        }
    }

    /// <summary>
    /// ترحيل سجلات الغياب اليومي — مطابق لـ archiveDailyAbsence() سطر 846-897
    /// يحدّث السجل التراكمي لكل طالب لم يُعتمد غيابه بعد
    /// </summary>
    private async Task ArchiveDailyAbsence(CancellationToken ct)
    {
        _logger.LogInformation("📋 بدء ترحيل الغياب اليومي...");

        using var scope = _services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var nowRiyadh = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, RiyadhTz);
        var todayStart = nowRiyadh.Date;
        var todayStartUtc = TimeZoneInfo.ConvertTimeToUtc(todayStart, RiyadhTz);

        // ★ سجلات الأمس وما قبله (مطابق لسطر 873: recordDateStr < todayStr)
        var oldRecords = await db.DailyAbsences
            .Where(a => a.RecordedAt < todayStartUtc)
            .Where(a => a.AbsenceType == AbsenceType.FullDay) // يوم كامل فقط
            .Where(a => a.TardinessStatus == "غائب" || a.TardinessStatus == "" || a.TardinessStatus == null) // لم يحضر
            .Where(a => a.Status != AbsenceStatus.Approved) // لم يُعتمد مسبقاً
            .ToListAsync(ct);

        if (oldRecords.Count == 0)
        {
            _logger.LogInformation("✅ لا توجد سجلات للترحيل");
            return;
        }

        int archivedCount = 0;
        var processedStudents = new HashSet<int>();

        foreach (var record in oldRecords)
        {
            if (ct.IsCancellationRequested) break;

            // ★ تحديث السجل التراكمي (مطابق لسطر 878-879)
            if (!processedStudents.Contains(record.StudentId))
            {
                await UpdateCumulativeForStudent(db, record.StudentId, ct);
                processedStudents.Add(record.StudentId);
            }

            archivedCount++;
        }

        await db.SaveChangesAsync(ct);
        _logger.LogInformation("✅ تم ترحيل {Count} سجل للتراكمي ({Students} طالب)",
            archivedCount, processedStudents.Count);
    }

    /// <summary>
    /// تحديث السجل التراكمي لطالب — مطابق لـ updateCumulativeAbsence_() سطر 329-373
    /// يحسب مجموع الغياب بعذر وبدون عذر من كل سجلات الغياب اليومي
    /// </summary>
    private async Task UpdateCumulativeForStudent(AppDbContext db, int studentId, CancellationToken ct)
    {
        var student = await db.Students.FindAsync(new object[] { studentId }, ct);
        if (student == null) return;

        var absences = await db.DailyAbsences
            .Where(a => a.StudentId == studentId && a.AbsenceType == AbsenceType.FullDay)
            .ToListAsync(ct);

        var excused = absences.Count(a => a.ExcuseType == ExcuseType.Excused);
        var unexcused = absences.Count(a => a.ExcuseType == ExcuseType.Unexcused);
        var lateDays = await db.TardinessRecords.CountAsync(t => t.StudentId == studentId, ct);

        var cumulative = await db.CumulativeAbsences
            .FirstOrDefaultAsync(c => c.StudentId == studentId, ct);

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
            db.CumulativeAbsences.Add(cumulative);
        }

        cumulative.ExcusedDays = excused;
        cumulative.UnexcusedDays = unexcused;
        cumulative.LateDays = lateDays;
        cumulative.LastUpdated = DateTime.UtcNow;
    }

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
}
