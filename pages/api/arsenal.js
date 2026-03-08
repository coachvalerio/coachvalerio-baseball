// pages/api/arsenal.js
// Uses player_id as a URL filter param (Savant filters server-side)
// Column names confirmed from debug: pitch_name, pitch_usage, pitches, 
// whiff_percent, k_percent, ba, slg, woba, est_woba, put_away, hard_hit_percent

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

// Map confirmed column names from Savant's pitch-arsenal-stats CSV
function normalizeArsenalRow(r) {
  // pitch_usage is 0–1 float (e.g. 0.415 = 41.5%)
  const rawUsage = flt(r, 'pitch_usage', 'pitch_percent');
  const pfxX = flt(r, 'pfx_x');
  const pfxZ = flt(r, 'pfx_z');

  return {
    pitch_type:  (r['pitch_type'] ?? '').trim(),
    pitch_name:  str(r, 'pitch_name', 'pitch_type_name') ?? (r['pitch_type'] ?? '').trim(),
    usage_pct:   rawUsage !== null ? (rawUsage > 1 ? rawUsage : rawUsage * 100) : null,
    pitch_count: flt(r, 'pitches', 'pitch_count') ?? 0,
    avg_speed:   flt(r, 'avg_speed', 'release_speed'),
    avg_spin:    flt(r, 'avg_spin_rate', 'avg_spin', 'release_spin_rate'),
    avg_break_x: flt(r, 'avg_break_x') ?? (pfxX !== null ? pfxX * 12 : null),
    avg_break_z: flt(r, 'avg_break_z') ?? (pfxZ !== null ? pfxZ * 12 : null),
    whiff_pct:   flt(r, 'whiff_percent'),
    k_pct:       flt(r, 'k_percent'),
    ba:          flt(r, 'ba'),
    slg:         flt(r, 'slg'),
    woba:        flt(r, 'woba'),
    xwoba:       flt(r, 'est_woba', 'xwoba', 'estimated_woba_using_speedangle'),
    put_away:    flt(r, 'put_away'),
    hard_hit_pct: flt(r, 'hard_hit_percent'),
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');

  const { id, year = new Date().getFullYear(), debug } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing player id' });

  // ── Primary: player_id param lets Savant filter server-side ──────────────
  // This is exactly what Savant's own player page uses
  const url = `https://baseballsavant.mlb.com/leaderboard/pitch-arsenal-stats?type=pitcher&pitchType=&year=${year}&team=&min=0&player_id=${id}&csv=true`;

  try {
    const r = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(12000) });
    const text = await r.text();
    const { headers, rows } = parseCSV(text);

    if (debug) {
      return res.status(200).json({
        status: r.status,
        totalRows: rows.length,
        cols: headers,
        firstRow: rows[0] ?? null,
        secondRow: rows[1] ?? null,
      });
    }

    if (rows.length > 0 && rows[0]['pitch_type']) {
      const pitches = rows
        .map(normalizeArsenalRow)
        .filter(p => p.pitch_type && p.pitch_name)
        .sort((a, b) => (b.usage_pct ?? 0) - (a.usage_pct ?? 0));

      return res.status(200).json({ pitches, source: 'arsenal_stats' });
    }
  } catch (e) {
    console.error(`[arsenal] primary error: ${e.message}`);
    if (debug) return res.status(200).json({ error: e.message });
  }

  // ── Fallback: statcast_search grouped by pitch type ───────────────────────
  const fallbackUrl = `https://baseballsavant.mlb.com/statcast_search/csv?all=true&hfSeas=${year}%7C&player_type=pitcher&pitchers_lookup%5B%5D=${id}&group_by=name-pitch&sort_col=pitches&sort_order=desc&min_pitches=0`;

  try {
    const r2 = await fetch(fallbackUrl, { headers: HEADERS, signal: AbortSignal.timeout(12000) });
    const text2 = await r2.text();
    const { rows: rows2 } = parseCSV(text2);

    const groups = {};
    for (const r of rows2) {
      const pt = (r['pitch_type'] ?? '').trim();
      if (!pt) continue;
      if (!groups[pt]) groups[pt] = [];
      groups[pt].push(normalizeArsenalRow(r));
    }

    const total = Object.values(groups).reduce((s, g) => s + g.reduce((gs, r) => gs + (r.pitch_count || 1), 0), 0);

    const pitches = Object.entries(groups).map(([pt, group]) => {
      const count = group.reduce((s, r) => s + (r.pitch_count || 1), 0);
      const wavg = f => {
        let num = 0, den = 0;
        group.forEach(r => { if (r[f] !== null) { num += r[f] * (r.pitch_count||1); den += (r.pitch_count||1); } });
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
        hard_hit_pct: wavg('hard_hit_pct'),
      };
    })
    .filter(p => p.pitch_count >= 25)
    .sort((a, b) => b.pitch_count - a.pitch_count);

    return res.status(200).json({ pitches, source: 'statcast_search' });
  } catch(e) {
    return res.status(200).json({ pitches: [], error: e.message });
  }
}