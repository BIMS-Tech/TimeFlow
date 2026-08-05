/**
 * Date helpers.
 *
 * MySQL DATE columns come back from the driver as JS Date objects at LOCAL
 * midnight. `String(date).substring(0, 10)` on one of those yields "Thu Jul 16",
 * not "2026-07-16" — so every date that crosses a boundary (SQL, the Wrike API,
 * a cache key) must go through toDateStr first.
 */

/**
 * Normalise a Date / ISO string / 'YYYY-MM-DD' to a plain calendar date string.
 * Date objects are read in LOCAL time, matching how the driver built them, so
 * the calendar day survives the round trip regardless of the server's timezone.
 * @returns {string} 'YYYY-MM-DD', or '' when the input is empty/unparseable.
 */
function toDateStr(val) {
  if (!val) return '';
  const d = val instanceof Date ? val : (typeof val === 'string' ? null : new Date(val));
  if (d) {
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  const s = String(val).substring(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

/** True when `val` normalises to a usable calendar date. */
function isDateStr(val) {
  return /^\d{4}-\d{2}-\d{2}$/.test(toDateStr(val));
}

module.exports = { toDateStr, isDateStr };
