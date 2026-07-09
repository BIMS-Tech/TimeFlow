/**
 * Time & money precision helpers.
 *
 * Wrike records time in WHOLE MINUTES. One minute is 1/60 h = 0.01666… hours — a
 * repeating decimal that cannot be stored exactly in any DECIMAL column. Storing
 * decimal hours therefore loses time on every write (the old DECIMAL(5,2) column
 * rounded 0.01666… → 0.02, biased upward, drifting ~13 min per 420 entries).
 *
 * So INTEGER MINUTES are the source of truth everywhere. Hours are only ever
 * derived for display, and money is rounded exactly once, at the very end.
 */

const MINUTES_PER_HOUR = 60;

/** Wrike hours (float, always a whole number of minutes) → exact integer minutes. */
function hoursToMinutes(hours) {
  return Math.round(Number(hours || 0) * MINUTES_PER_HOUR);
}

/** Integer minutes → decimal hours (for display / legacy columns only, never for money). */
function minutesToHours(minutes) {
  return Number(minutes || 0) / MINUTES_PER_HOUR;
}

/**
 * Integer minutes → "496h 18m". Handles negatives and pads minutes to 2 digits.
 */
function formatHM(minutes) {
  const total = Math.round(Number(minutes) || 0);
  const sign = total < 0 ? '-' : '';
  const abs = Math.abs(total);
  const h = Math.floor(abs / MINUTES_PER_HOUR);
  const m = abs % MINUTES_PER_HOUR;
  return `${sign}${h}h ${String(m).padStart(2, '0')}m`;
}

/**
 * Round a currency amount to 2 decimals. Call this ONCE, on the final amount —
 * never on intermediate hour values.
 *
 * Rounds half away from zero (what accountants expect). `toPrecision(12)` clears the
 * binary-float artifact that makes 1.005 * 100 === 100.49999999999999, which would
 * otherwise round down to 1.00.
 */
function roundMoney(amount) {
  const n = Number(amount) || 0;
  if (!Number.isFinite(n)) return 0;
  const sign = n < 0 ? -1 : 1;
  const scaled = Number((Math.abs(n) * 100).toPrecision(12));
  const result = (sign * Math.round(scaled)) / 100;
  return Object.is(result, -0) ? 0 : result;
}

/** Exact pay for a number of minutes at an hourly rate. NOT rounded — round the total. */
function payForMinutes(minutes, hourlyRate, multiplier = 1) {
  return (Number(minutes || 0) / MINUTES_PER_HOUR) * Number(hourlyRate || 0) * Number(multiplier || 1);
}

module.exports = {
  MINUTES_PER_HOUR,
  hoursToMinutes,
  minutesToHours,
  formatHM,
  roundMoney,
  payForMinutes,
};
