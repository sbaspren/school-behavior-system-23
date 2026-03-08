namespace SchoolBehaviorSystem.Application.Interfaces;

/// <summary>
/// خدمة التقويم الهجري (أم القرى) — مطابق لـ convertToHijri_ + getHijriDate_ + getHijriDateFull_ في Config.gs
/// </summary>
public interface IHijriDateService
{
    /// <summary>تحويل تاريخ ميلادي إلى هجري (سنة/شهر/يوم)</summary>
    string GetHijriDate(DateTime? date = null);

    /// <summary>تاريخ هجري كامل مع اسم الشهر واليوم — للداشبورد والطباعة</summary>
    HijriDateFull GetHijriDateFull(DateTime? date = null);
}

public class HijriDateFull
{
    public int HijriDay { get; set; }
    public string HijriMonth { get; set; } = "";
    public int HijriMonthNum { get; set; }
    public int HijriYear { get; set; }
    public string HijriStr { get; set; } = "";
    public string GregorianStr { get; set; } = "";
    public string WeekdayAr { get; set; } = "";
}
