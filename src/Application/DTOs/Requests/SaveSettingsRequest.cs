namespace SchoolBehaviorSystem.Application.DTOs.Requests;

public class SaveSettingsRequest
{
    public string SchoolName { get; set; } = "";
    public string EduAdmin { get; set; } = "";
    public string EduDept { get; set; } = "";
    public string LetterheadMode { get; set; } = "text";        // text | image
    public string LetterheadImageUrl { get; set; } = "";
    public string? Letterhead { get; set; }
    public string WhatsAppMode { get; set; } = "per_stage";     // per_stage | unified
    // طاقم العمل — مطابق لـ getSchoolSettings_ في Server_Data.gs
    public string? ManagerName { get; set; }
    public string? DeputyName { get; set; }
    public string? CounselorName { get; set; }
    public string? CommitteeName { get; set; }
    public string? WakeelName { get; set; }
    public string? WakeelSignature { get; set; }
}

public class SaveStructureRequest
{
    public string SchoolType { get; set; } = "بنين";
    public string SecondarySystem { get; set; } = "فصلي";
    /// <summary>مصفوفة المراحل — مطابق لـ StageConfigData[] في الواجهة</summary>
    public List<StageConfigRequest> Stages { get; set; } = new();
    /// <summary>تأكيد حذف المراحل المُلغاة — مطابق لـ confirmedDeletion في Config.gs سطر 172</summary>
    public bool ConfirmedDeletion { get; set; } = false;
}

public class StageConfigRequest
{
    public string Stage { get; set; } = "";
    public bool IsEnabled { get; set; }
    public List<GradeConfigRequest> Grades { get; set; } = new();
}

public class GradeConfigRequest
{
    public string GradeName { get; set; } = "";
    public bool IsEnabled { get; set; }
    public int ClassCount { get; set; }
}
