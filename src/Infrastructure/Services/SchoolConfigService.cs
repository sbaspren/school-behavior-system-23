using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using SchoolBehaviorSystem.Application.Interfaces;
using SchoolBehaviorSystem.Domain.Entities;
using SchoolBehaviorSystem.Domain.Enums;
using SchoolBehaviorSystem.Infrastructure.Data;

namespace SchoolBehaviorSystem.Infrastructure.Services;

public class SchoolConfigService : ISchoolConfigService
{
    private readonly AppDbContext _db;
    private readonly IMemoryCache _cache;

    private const string SettingsCacheKey = "school_settings";
    private const string StagesCacheKey = "enabled_stages";
    private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(30);

    public SchoolConfigService(AppDbContext db, IMemoryCache cache)
    {
        _db = db;
        _cache = cache;
    }

    public async Task<SchoolSettings?> GetSettingsAsync()
    {
        return await _cache.GetOrCreateAsync(SettingsCacheKey, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = CacheDuration;
            return await _db.SchoolSettings.FirstOrDefaultAsync();
        });
    }

    public async Task<SchoolSettings> SaveSettingsAsync(SchoolSettings settings)
    {
        var existing = await _db.SchoolSettings.FirstOrDefaultAsync();

        if (existing == null)
        {
            settings.CreatedAt = DateTime.UtcNow;
            settings.UpdatedAt = DateTime.UtcNow;
            _db.SchoolSettings.Add(settings);
        }
        else
        {
            existing.SchoolName = settings.SchoolName;
            existing.EduAdmin = settings.EduAdmin;
            existing.EduDept = settings.EduDept;
            existing.LetterheadMode = settings.LetterheadMode;
            existing.LetterheadImageUrl = settings.LetterheadImageUrl;
            existing.Letterhead = settings.Letterhead;
            existing.WhatsAppMode = settings.WhatsAppMode;
            existing.SchoolType = settings.SchoolType;
            existing.SecondarySystem = settings.SecondarySystem;
            existing.ManagerName = settings.ManagerName;
            existing.DeputyName = settings.DeputyName;
            existing.CounselorName = settings.CounselorName;
            existing.CommitteeName = settings.CommitteeName;
            existing.WakeelName = settings.WakeelName;
            existing.WakeelSignature = settings.WakeelSignature;
            existing.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();
        InvalidateCache();
        return existing ?? settings;
    }

    public async Task<bool> IsConfiguredAsync()
    {
        var settings = await GetSettingsAsync();
        if (settings == null) return false;

        var stages = await GetEnabledStagesAsync();
        return stages.Count > 0;
    }

    public async Task<List<StageConfig>> GetEnabledStagesAsync()
    {
        return await _cache.GetOrCreateAsync(StagesCacheKey, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = CacheDuration;
            return await _db.StageConfigs
                .Where(s => s.IsEnabled)
                .Include(s => s.Grades.Where(g => g.IsEnabled && g.ClassCount > 0))
                .OrderBy(s => s.Stage)
                .ToListAsync();
        }) ?? new List<StageConfig>();
    }

    public async Task<StageConfig?> GetStageConfigAsync(Stage stage)
    {
        var stages = await GetEnabledStagesAsync();
        return stages.FirstOrDefault(s => s.Stage == stage);
    }

    public async Task SaveStructureAsync(SchoolType schoolType, SecondarySystem secondarySystem, List<StageConfig> newStages)
    {
        // تحديث إعدادات المدرسة
        var settings = await _db.SchoolSettings.FirstOrDefaultAsync();
        if (settings != null)
        {
            settings.SchoolType = schoolType;
            settings.SecondarySystem = secondarySystem;
            settings.UpdatedAt = DateTime.UtcNow;
        }

        // ★ مقارنة المراحل القديمة والجديدة — مطابق لـ saveSchoolStructure في Server_Settings.gs سطر 220-287
        var existingStages = await _db.StageConfigs.Include(s => s.Grades).ToListAsync();
        var oldEnabledIds = existingStages.Where(s => s.IsEnabled).Select(s => s.Stage).ToHashSet();
        var newEnabledIds = newStages.Where(s => s.IsEnabled).Select(s => s.Stage).ToHashSet();
        var removedStages = oldEnabledIds.Except(newEnabledIds).ToList();

        // ★ حذف بيانات المراحل المُلغاة (طلاب + سجلات per-stage)
        // مطابق لسلوك الأصلي: حذف شيت الطلاب + سجلات المخالفات/الغياب/التأخر/الاستئذان/الملاحظات/السلوك
        if (removedStages.Count > 0)
        {
            foreach (var removedStage in removedStages)
            {
                // حذف الطلاب
                var students = await _db.Students.Where(s => s.Stage == removedStage).ToListAsync();
                _db.Students.RemoveRange(students);

                // حذف المخالفات
                var violations = await _db.Violations.Where(v => v.Stage == removedStage).ToListAsync();
                _db.Violations.RemoveRange(violations);

                // حذف الغياب اليومي
                var absences = await _db.DailyAbsences.Where(a => a.Stage == removedStage).ToListAsync();
                _db.DailyAbsences.RemoveRange(absences);

                // حذف الغياب التراكمي
                var cumAbsences = await _db.CumulativeAbsences.Where(a => a.Stage == removedStage).ToListAsync();
                _db.CumulativeAbsences.RemoveRange(cumAbsences);

                // حذف التأخر
                var tardiness = await _db.TardinessRecords.Where(t => t.Stage == removedStage).ToListAsync();
                _db.TardinessRecords.RemoveRange(tardiness);

                // حذف الاستئذان
                var permissions = await _db.PermissionRecords.Where(p => p.Stage == removedStage).ToListAsync();
                _db.PermissionRecords.RemoveRange(permissions);

                // حذف الملاحظات التربوية
                var notes = await _db.EducationalNotes.Where(n => n.Stage == removedStage).ToListAsync();
                _db.EducationalNotes.RemoveRange(notes);

                // حذف السلوك الإيجابي
                var behaviors = await _db.PositiveBehaviors.Where(b => b.Stage == removedStage).ToListAsync();
                _db.PositiveBehaviors.RemoveRange(behaviors);
            }

            await _db.SaveChangesAsync();
        }

        // حذف المراحل القديمة واستبدالها
        _db.StageConfigs.RemoveRange(existingStages);
        await _db.SaveChangesAsync();

        // إضافة المراحل الجديدة
        foreach (var stage in newStages)
        {
            stage.CreatedAt = DateTime.UtcNow;
            stage.UpdatedAt = DateTime.UtcNow;
            foreach (var grade in stage.Grades)
            {
                grade.CreatedAt = DateTime.UtcNow;
            }
            _db.StageConfigs.Add(stage);
        }

        await _db.SaveChangesAsync();
        InvalidateCache();
    }

    public async Task<List<string>> GetGradesForStageAsync(Stage stage)
    {
        var config = await GetStageConfigAsync(stage);
        if (config == null) return new List<string>();

        return config.Grades
            .Where(g => g.IsEnabled && g.ClassCount > 0)
            .Select(g => g.GradeName)
            .ToList();
    }

    public async Task<int> GetClassCountAsync(Stage stage, string gradeName)
    {
        var config = await GetStageConfigAsync(stage);
        var grade = config?.Grades.FirstOrDefault(g => g.GradeName == gradeName && g.IsEnabled);
        return grade?.ClassCount ?? 0;
    }

    public void InvalidateCache()
    {
        _cache.Remove(SettingsCacheKey);
        _cache.Remove(StagesCacheKey);
    }
}
