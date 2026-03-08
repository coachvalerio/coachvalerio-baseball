// pages/api/arsenal.js
// Fetches the FULL Savant pitch-arsenal leaderboard and filters by player ID.
// This is more reliable than using the player_id param which Savant often ignores.

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/csv,text/plain,*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://baseballsavant.mlb.com/',
  'Cache-Control': 'no-cache',
};

function parseCSV(text) {
  if (!text?.trim()) return { headers: [], rows: [] };
  const lines = text.trim().split('\n');
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
  const rows = lines.slice(1).map(line => {
    const vals = []; let cur = '', inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    vals.push(cur.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
    return obj;
  });
  return { headers, rows };
}

const flt = (r, ...keys) => {
  for (const k of keys) { const v = parseFloat(r[k]); if (!isNaN(v)) return v; }
  return null;
};

const str = (r, ...keys) => {
  for (const k of keys) {
    const v = (r[k] ?? '').trim();
    if (v && !v.match(/^-?\d+\.?\d*$/)) return v;
  }
  return null;
};

// Normalize one CSV row into consistent shape regardless of endpoint
function normalizeRow(r) {
  const pitchType = (r['pitch_type'] ?? '').trim();
  const pitchName = str(r, 'pitch_type_name', 'pitch_name') ?? pitchType ?? '—';
  const pitchPct  = flt(r, 'pitch_percent', 'pitch_usage');
  const pfxX      = flt(r, 'pfx_x'); // statcast_search returns feet
  const pfxZ      = flt(r, 'pfx_z');

  return {
    pitch_type:  pitchType,
    pitch_name:  pitchName,
    usage_pct:   pitchPct !== null ? (pitchPct > 1 ? pitchPct : pitchPct * 100) : null,
    pitch_count: flt(r, 'pitches', 'pitch_count', 'n') ?? 0,
    avg_speed:   flt(r, 'avg_speed', 'release_speed'),
    avg_spin:    flt(r, 'avg_spin_rate', 'avg_spin', 'release_spin_rate'),
    avg_break_x: flt(r, 'avg_break_x') ?? (pfxX !== null ? pfxX * 12 : null),
    avg_break_z: flt(r, 'avg_break_z') ?? (pfxZ !== null ? pfxZ * 12 : null),
    whiff_pct:   flt(r, 'whiff_percent', 'whiff_rate'),
    k_pct:       flt(r, 'k_percent'),
    ba:          flt(r, 'ba', 'batting_avg'),
    slg:         flt(r, 'slg', 'slg_percent'),
    woba:        flt(r, 'woba'),
    xwoba:       flt(r, 'xwoba', 'estimated_woba_using_speedangle'),
    put_away:    flt(r, 'put_away'),
  };
}

// Find the player_id column name (varies between endpoints)
function getPlayerId(r) {
  for (const k of ['player_id', 'pitcher', 'batter', 'mlbam_id', 'id']) {
    const v = (r[k] ?? '').trim();
    if (!v) continue;
    // Savant sometimes stores IDs as floats: "554430.0" — parse and floor
    const parsed = Math.floor(parseFloat(v));
    if (!isNaN(parsed) && parsed > 0) return String(parsed);
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');

  const { id, year = new Date().getFullYear(), debug } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing player id' });

  const results = { id, year, attempts: [] };

  // ── Attempt 1: pitch-arsenal-stats full leaderboard, filter by player_id ──
  // This is the same data Savant shows on player profile pages
  const url1 = `https://baseballsavant.mlb.com/leaderboard/pitch-arsenal-stats?type=pitcher&pitchType=&year=${year}&team=&min=0&csv=true`;

  try {
    const r1 = await fetch(url1, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
    const text1 = await r1.text();
    const { headers: h1, rows: all1 } = parseCSV(text1);

    // Sample some player_id values for debugging
    const sampleIds = all1.slice(0, 5).map(r => ({ raw: r['player_id'], parsed: getPlayerId(r) }));
    results.attempts.push({ url: url1, status: r1.status, totalRows: all1.length, cols: h1.slice(0, 15), sampleIds });

    // Filter rows for this specific player
    const playerRows = all1.filter(r => getPlayerId(r) === String(id));
    console.log(`[arsenal] attempt1: ${all1.length} total rows, ${playerRows.length} for player ${id}`);

    if (playerRows.length > 0) {
      const pitches = playerRows.map(normalizeRow).filter(p => p.pitch_type);
      // Compute usage from pitch_count if pitch_percent missing
      const total = pitches.reduce((s, p) => s + (p.pitch_count || 0), 0);
      pitches.forEach(p => {
        if (p.usage_pct === null && total > 0) p.usage_pct = (p.pitch_count / total) * 100;
      });
      pitches.sort((a, b) => (b.usage_pct ?? 0) - (a.usage_pct ?? 0));
      if (debug) return res.status(200).json({ pitches, ...results });
      return res.status(200).json({ pitches, source: 'arsenal_stats_leaderboard' });
    }
  } catch (e) {
    results.attempts.push({ url: url1, error: e.message });
    console.error(`[arsenal] attempt1 error: ${e.message}`);
  }

  // ── Attempt 2: pitch-arsenals leaderboard (different endpoint, also full list) ──
  const url2 = `https://baseballsavant.mlb.com/leaderboard/pitch-arsenals?season=${year}&position=&team=&min=0&csv=true`;

  try {
    const r2 = await fetch(url2, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
    const text2 = await r2.text();
    const { headers: h2, rows: all2 } = parseCSV(text2);

    results.attempts.push({ url: url2, status: r2.status, totalRows: all2.length, cols: h2.slice(0, 15) });

    const playerRows2 = all2.filter(r => getPlayerId(r) === String(id));
    console.log(`[arsenal] attempt2: ${all2.length} total rows, ${playerRows2.length} for player ${id}`);

    if (playerRows2.length > 0) {
      const pitches = playerRows2.map(normalizeRow).filter(p => p.pitch_type);
      const total = pitches.reduce((s, p) => s + (p.pitch_count || 0), 0);
      pitches.forEach(p => {
        if (p.usage_pct === null && total > 0) p.usage_pct = (p.pitch_count / total) * 100;
      });
      pitches.sort((a, b) => (b.usage_pct ?? 0) - (a.usage_pct ?? 0));
      if (debug) return res.status(200).json({ pitches, ...results });
      return res.status(200).json({ pitches, source: 'arsenal_leaderboard' });
    }
  } catch (e) {
    results.attempts.push({ url: url2, error: e.message });
    console.error(`[arsenal] attempt2 error: ${e.message}`);
  }

  // ── Attempt 3: statcast_search fallback ───────────────────────────────────
  const url3 = `https://baseballsavant.mlb.com/statcast_search/csv?all=true&hfSeas=${year}%7C&player_type=pitcher&pitchers_lookup%5B%5D=${id}&group_by=name-pitch&sort_col=pitches&sort_order=desc&min_pitches=0`;

  try {
    const r3 = await fetch(url3, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
    const text3 = await r3.text();
    const { headers: h3, rows: all3 } = parseCSV(text3);

    results.attempts.push({ url: url3, status: r3.status, totalRows: all3.length, cols: h3.slice(0, 15) });
    console.log(`[arsenal] attempt3 statcast_search: ${all3.length} rows`);

    if (all3.length > 0) {
      // Group by pitch type and aggregate (statcast_search may return many rows per type)
      const groups = {};
      for (const r of all3) {
        const pt = r['pitch_type']?.trim();
        if (!pt) continue;
        if (!groups[pt]) groups[pt] = [];
        groups[pt].push(normalizeRow(r));
      }

      const pitches = Object.entries(groups).map(([pt, rows]) => {
        const totalCount = rows.reduce((s, r) => s + (r.pitch_count || 1), 0);
        const wavg = (field) => {
          let num = 0, den = 0;
          rows.forEach(r => { if (r[field] !== null) { num += r[field] * (r.pitch_count || 1); den += (r.pitch_count || 1); } });
          return den > 0 ? num / den : null;
        };
        return {
          pitch_type: pt,
          pitch_name: rows[0].pitch_name,
          usage_pct:  null,
          pitch_count: totalCount,
          avg_speed:  wavg('avg_speed'),
          avg_spin:   wavg('avg_spin'),
          avg_break_x: wavg('avg_break_x'),
          avg_break_z: wavg('avg_break_z'),
          whiff_pct:  wavg('whiff_pct'),
          k_pct:      wavg('k_pct'),
          ba:         wavg('ba'),
          slg:        wavg('slg'),
          woba:       wavg('woba'),
          xwoba:      wavg('xwoba'),
          put_away:   wavg('put_away'),
        };
      });

      const total = pitches.reduce((s, p) => s + p.pitch_count, 0);
      pitches.forEach(p => { p.usage_pct = total > 0 ? (p.pitch_count / total) * 100 : null; });
      // Filter: must have >= 25 pitches (eliminates misclassifications)
      const filtered = pitches.filter(p => p.pitch_count >= 25).sort((a, b) => b.pitch_count - a.pitch_count);

      if (debug) return res.status(200).json({ pitches: filtered, ...results });
      return res.status(200).json({ pitches: filtered, source: 'statcast_search' });
    }
  } catch (e) {
    results.attempts.push({ url: url3, error: e.message });
    console.error(`[arsenal] attempt3 error: ${e.message}`);
  }

  // All attempts failed
  console.error(`[arsenal] all attempts failed for id=${id} year=${year}`);
  return res.status(200).json({ pitches: [], ...results, error: 'No data from any Savant endpoint' });
}