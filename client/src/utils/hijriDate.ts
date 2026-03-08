/**
 * Hijri date utilities using Intl API with UmAlQura calendar
 */

const hijriFormatter = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
  day: 'numeric', month: 'numeric', year: 'numeric',
});

const hijriFormatterFull = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
  day: 'numeric', month: 'long', year: 'numeric',
});

/** Format a date as short Hijri string (e.g. "1446/02/15") */
export function formatHijri(date?: string | Date | null): string {
  if (!date) return '';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return typeof date === 'string' ? date : '';
    return hijriFormatter.format(d);
  } catch {
    return typeof date === 'string' ? date : '';
  }
}

/** Format as full Hijri (e.g. "15 صفر 1446") */
export function formatHijriFull(date?: string | Date | null): string {
  if (!date) return '';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return typeof date === 'string' ? date : '';
    return hijriFormatterFull.format(d);
  } catch {
    return typeof date === 'string' ? date : '';
  }
}

/** Get today's Hijri date (short format) */
export function getTodayHijri(): string {
  return formatHijri(new Date());
}

/** Fallback: display hijriDate from API, or compute from miladiDate, or show raw */
export function displayHijri(hijriDate?: string, miladiDate?: string): string {
  if (hijriDate) return hijriDate;
  if (miladiDate) return formatHijri(miladiDate);
  return '';
}
