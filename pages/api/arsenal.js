// pages/api/arsenal.js
// Fetches full Savant pitch-arsenal-stats leaderboard, filters by player ID

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/csv,text/plain,*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://baseballsavant.mlb.com/',
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

function normalizeRow(r) {
  const pitchType = (r['pitch_type'] ?? '').trim();
  const pitchName = str(r, 'pitch_type_name', 'pitch_name') ?? pitchType ?? '—';
  const pitchPct  = flt(r, 'pitch_usage', 'pitch_percent');
  const pfxX      = flt(r, 'pfx_x');
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

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');

  const { id, year = new Date().getFullYear(), debug } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing player id' });

  const targetId = parseInt(id, 10);
  const debugInfo = { targetId, year, attempts: [] };

  // ── Strategy: fetch full leaderboard, match by integer player ID ──────────
  const url = `https://baseballsavant.mlb.com/leaderboard/pitch-arsenal-stats?type=pitcher&pitchType=&year=${year}&team=&min=0&csv=true`;

  try {
    const r = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(12000) });
    const text = await r.text();
    const { headers, rows } = parseCSV(text);

    // Find the player_id column — try every column name that could be an ID
    const idCols = headers.filter(h => h.includes('player') || h.includes('pitcher') || h === 'id' || h === 'mlbam_id');

    // Sample first few rows to inspect IDs
    const sample = rows.slice(0, 3).map(r => {
      const out = {};
      idCols.forEach(c => out[c] = r[c]);
      return out;
    });

    debugInfo.attempts.push({ url, status: r.status, totalRows: rows.length, cols: headers, idCols, sample });

    // Match: compare as integers (handles "554430.0" vs "554430" vs 554430)
    const playerRows = rows.filter(r => {
      for (const col of idCols) {
        const v = parseInt(r[col], 10);
        if (!isNaN(v) && v === targetId) return true;
      }
      return false;
    });

    debugInfo.matchCount = playerRows.length;

    if (playerRows.length > 0) {
      const pitches = playerRows
        .map(normalizeRow)
        .filter(p => p.pitch_type && p.pitch_type !== '')
        .sort((a, b) => (b.usage_pct ?? 0) - (a.usage_pct ?? 0));

      if (debug) return res.status(200).json({ pitches, debug: debugInfo });
      return res.status(200).json({ pitches, source: 'arsenal_stats' });
    }

    // If no match — return debug info so we can see why
    if (debug) return res.status(200).json({ pitches: [], debug: debugInfo });

  } catch (e) {
    debugInfo.error = e.message;
    if (debug) return res.status(200).json({ pitches: [], debug: debugInfo });
    console.error(`[arsenal] primary failed: ${e.message}`);
  }

  // ── Fallback: statcast_search (returns aggregate per pitch type for one player) ──
  const fallbackUrl = `https://baseballsavant.mlb.com/statcast_search/csv?all=true&hfSeas=${year}%7C&player_type=pitcher&pitchers_lookup%5B%5D=${id}&group_by=name-pitch&sort_col=pitches&sort_order=desc&min_pitches=0`;

  try {
    const r2 = await fetch(fallbackUrl, { headers: HEADERS, signal: AbortSignal.timeout(12000) });
    const text2 = await r2.text();
    const { headers: h2, rows: rows2 } = parseCSV(text2);

    // Group by pitch_type and aggregate (in case multiple rows per type)
    const groups = {};
    for (const r of rows2) {
      const pt = (r['pitch_type'] ?? '').trim();
      if (!pt) continue;
      if (!groups[pt]) groups[pt] = [];
      groups[pt].push(normalizeRow(r));
    }

    const total = Object.values(groups).reduce((s, g) => s + g.reduce((gs, r) => gs + (r.pitch_count||1), 0), 0);

    const pitches = Object.entries(groups).map(([pt, group]) => {
      const count = group.reduce((s, r) => s + (r.pitch_count || 1), 0);
      const wavg = (field) => {
        let num = 0, den = 0;
        group.forEach(r => { if (r[field] !== null) { num += r[field] * (r.pitch_count||1); den += (r.pitch_count||1); } });
        return den > 0 ? num/den : null;
      };
      return {
        pitch_type: pt, pitch_name: group[0].pitch_name,
        usage_pct: total > 0 ? (count/total)*100 : null,
        pitch_count: count,
        avg_speed: wavg('avg_speed'), avg_spin: wavg('avg_spin'),
        avg_break_x: wavg('avg_break_x'), avg_break_z: wavg('avg_break_z'),
        whiff_pct: wavg('whiff_pct'), k_pct: wavg('k_pct'),
        ba: wavg('ba'), slg: wavg('slg'), woba: wavg('woba'),
        xwoba: wavg('xwoba'), put_away: wavg('put_away'),
      };
    }).filter(p => p.pitch_count >= 25).sort((a,b) => b.pitch_count - a.pitch_count);

    return res.status(200).json({ pitches, source: 'statcast_search' });
  } catch(e) {
    return res.status(200).json({ pitches: [], error: e.message });
  }
}