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
    public Dictionary<string, StageGradesRequest> Stages { get; set; } = new();
    /// <summary>تأكيد حذف المراحل المُلغاة — مطابق لـ confirmedDeletion في Config.gs سطر 172</summary>
    public bool ConfirmedDeletion { get; set; } = false;
}

public class StageGradesRequest
{
    public Dictionary<string, GradeRequest> Grades { get; set; } = new();
}

public class GradeRequest
{
    public bool Enabled { get; set; }
    public int ClassCount { get; set; }
}
