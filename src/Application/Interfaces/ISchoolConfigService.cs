using SchoolBehaviorSystem.Domain.Entities;
using SchoolBehaviorSystem.Domain.Enums;

namespace SchoolBehaviorSystem.Application.Interfaces;

public interface ISchoolConfigService
{
    // هيكل المدرسة
    Task<SchoolSettings?> GetSettingsAsync();
    Task<SchoolSettings> SaveSettingsAsync(SchoolSettings settings);
    Task<bool> IsConfiguredAsync();

    // المراحل والصفوف
    Task<List<StageConfig>> GetEnabledStagesAsync();
    Task<StageConfig?> GetStageConfigAsync(Stage stage);
    Task SaveStructureAsync(SchoolType schoolType, SecondarySystem secondarySystem, List<StageConfig> stages);

    // الصفوف المتاحة لمرحلة
    Task<List<string>> GetGradesForStageAsync(Stage stage);
    Task<int> GetClassCountAsync(Stage stage, string gradeName);

    // مسح الكاش
    void InvalidateCache();
}
