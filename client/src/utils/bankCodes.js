/**
 * Loads and parses bank-codes.csv from /public.
 * Returns { local: [{ code, name }], foreign: [{ swift, name }] }
 * Result is module-level cached after first load.
 */

let _cache = null;
let _loading = null;

function parseRow(line) {
  // All fields are double-quoted: "VALUE","VALUE","VALUE","VALUE"
  const row = [];
  let inQ = false, cur = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      row.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  row.push(cur);
  return row;
}

export async function loadBankCodes() {
  if (_cache) return _cache;
  if (_loading) return _loading;

  _loading = fetch('/bank-codes.csv')
    .then(r => r.text())
    .then(text => {
      const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
      const local   = [];
      const foreign = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const row = parseRow(line);
        if (row.length < 4) continue;

        const code    = row[0].replace(/[^\x20-\x7E]/g, '').trim(); // strip BOM / non-ASCII
        const rawName = row[1].trim();
        const swift   = row[2].replace(/[^\x20-\x7E]/g, '').trim();
        const type    = row[3].trim();

        if (type.includes('1 - LOCAL')) {
          if (code && rawName) local.push({ code, name: rawName });
        } else if (type.includes('2 - FOREIGN')) {
          // rawName format: "BANK NAME - SWIFTCODEXX" — strip the appended SWIFT suffix
          const name = rawName.replace(/\s*-\s*[A-Z0-9]{6,11}$/, '').trim();
          if (swift && name) foreign.push({ swift, name });
        }
      }

      _cache   = { local, foreign };
      _loading = null;
      return _cache;
    })
    .catch(() => {
      _loading = null;
      return { local: [], foreign: [] };
    });

  return _loading;
}

/** Filter foreign SWIFT entries by a query string (code or name). Returns up to `limit` results. */
export function searchSwift(codes, query, limit = 30) {
  if (!query || query.length < 2) return [];
  const q = query.toUpperCase();
  const results = [];
  for (const entry of codes.foreign) {
    if (entry.swift.startsWith(q) || entry.name.toUpperCase().includes(q)) {
      results.push(entry);
      if (results.length >= limit) break;
    }
  }
  return results;
}

/** Filter local bank entries by name. Returns up to `limit` results. */
export function searchLocal(codes, query, limit = 30) {
  if (!query || query.length < 2) return codes.local.slice(0, limit);
  const q = query.toUpperCase();
  return codes.local.filter(e => e.name.toUpperCase().includes(q) || e.code.startsWith(q)).slice(0, limit);
}
