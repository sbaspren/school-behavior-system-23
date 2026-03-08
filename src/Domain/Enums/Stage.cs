namespace SchoolBehaviorSystem.Domain.Enums;

public enum Stage
{
    Kindergarten,   // طفولة مبكرة
    Primary,        // ابتدائي
    Intermediate,   // متوسط
    Secondary       // ثانوي
}

public static class StageExtensions
{
    public static string ToArabic(this Stage stage) => stage switch
    {
        Stage.Kindergarten => "طفولة مبكرة",
        Stage.Primary => "ابتدائي",
        Stage.Intermediate => "متوسط",
        Stage.Secondary => "ثانوي",
        _ => ""
    };

    public static Stage? FromArabic(string arabic) => arabic switch
    {
        "طفولة مبكرة" => Stage.Kindergarten,
        "ابتدائي" => Stage.Primary,
        "متوسط" => Stage.Intermediate,
        "ثانوي" => Stage.Secondary,
        _ => null
    };
}
