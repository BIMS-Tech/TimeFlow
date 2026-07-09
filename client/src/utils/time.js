/**
 * Display helpers for time. Integer minutes are the source of truth on the server
 * (Wrike records whole minutes; decimal hours cannot represent 1/60 h exactly),
 * so the UI formats minutes rather than re-deriving hours.
 */

const MINUTES_PER_HOUR = 60;

/** Integer minutes → "496h 18m". */
export function formatHM(minutes) {
  const total = Math.round(Number(minutes) || 0);
  const sign = total < 0 ? '-' : '';
  const abs = Math.abs(total);
  const h = Math.floor(abs / MINUTES_PER_HOUR);
  const m = abs % MINUTES_PER_HOUR;
  return `${sign}${h}h ${String(m).padStart(2, '0')}m`;
}

/** Decimal hours → "496h 18m". Use only where the API still returns hours. */
export function formatHoursAsHM(hours) {
  return formatHM(Math.round((Number(hours) || 0) * MINUTES_PER_HOUR));
}

/** Integer minutes → decimal hours (display/auditing only). */
export function minutesToHours(minutes) {
  return (Number(minutes) || 0) / MINUTES_PER_HOUR;
}

/** Parse a user-typed "8h 30m", "8:30", "8.5" or "510m" into integer minutes. */
export function parseToMinutes(input) {
  if (input === null || input === undefined || input === '') return null;
  const s = String(input).trim().toLowerCase();

  // "8:30"
  let m = s.match(/^(\d+):([0-5]?\d)$/);
  if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);

  // "8h 30m" / "8h" / "30m"
  m = s.match(/^(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+)\s*m)?$/);
  if (m && (m[1] || m[2])) {
    const h = m[1] ? parseFloat(m[1]) : 0;
    const mins = m[2] ? parseInt(m[2], 10) : 0;
    return Math.round(h * 60) + mins;
  }

  // plain decimal hours "8.5"
  const num = parseFloat(s);
  return Number.isFinite(num) ? Math.round(num * 60) : null;
}
