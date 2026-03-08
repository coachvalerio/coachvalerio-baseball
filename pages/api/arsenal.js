// pages/api/arsenal.js
// Server-side proxy for Baseball Savant pitch arsenal data
// Avoids CORS by fetching from Node.js, not the browser

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
  const headers = lines[0].split(',').map(h => h.replace(/"/g,'').trim().toLowerCase());
  const rows = lines.slice(1).map(line => {
    const vals=[]; let cur='', inQ=false;
    for (const ch of line) {
      if (ch==='"'){ inQ=!inQ; }
      else if (ch===',' && !inQ){ vals.push(cur.trim()); cur=''; }
      else cur+=ch;
    }
    vals.push(cur.trim());
    const obj={};
    headers.forEach((h,i)=>{ obj[h]=vals[i]??''; });
    return obj;
  });
  return { headers, rows };
}

const flt = (r, ...keys) => {
  for (const k of keys) {
    const v = parseFloat(r[k]);
    if (!isNaN(v)) return v;
  }
  return null;
};

const str = (r, ...keys) => {
  for (const k of keys) {
    const v = (r[k]??'').trim();
    if (v && !v.match(/^-?\d+\.?\d*$/)) return v; // ignore pure numbers
  }
  return null;
};

// Normalize a pitch-arsenal-stats row (primary endpoint)
// Columns: pitch_type, pitch_type_name, pitch_percent (0–1), avg_speed,
//          avg_spin_rate, avg_break_x, avg_break_z, whiff_percent, k_percent, ba, slg, woba, xwoba
function normalizeArsenalRow(r, totalFromFallback) {
  const pitchPct = flt(r, 'pitch_percent');
  const usagePct = pitchPct !== null
    ? (pitchPct > 1 ? pitchPct : pitchPct * 100) // handle both 0.43 and 43 formats
    : null;

  return {
    pitch_type:  str(r, 'pitch_type') ?? '—',
    pitch_name:  str(r, 'pitch_type_name', 'pitch_name', 'pitch_type') ?? '—',
    usage_pct:   usagePct,
    avg_speed:   flt(r, 'avg_speed', 'velocity', 'release_speed'),
    avg_spin:    flt(r, 'avg_spin_rate', 'avg_spin', 'release_spin_rate', 'spin_rate'),
    avg_break_x: flt(r, 'avg_break_x', 'pfx_x_inches', 'break_x'),
    avg_break_z: flt(r, 'avg_break_z', 'pfx_z_inches', 'break_z'),
    // pfx_ fields come in feet from statcast_search — convert to inches
    pfx_x_ft:   flt(r, 'pfx_x'),
    pfx_z_ft:   flt(r, 'pfx_z'),
    whiff_pct:   flt(r, 'whiff_percent', 'whiff_rate'),
    k_pct:       flt(r, 'k_percent'),
    ba:          flt(r, 'ba', 'batting_avg', 'batting_average'),
    slg:         flt(r, 'slg', 'slg_percent', 'slugging_percent'),
    woba:        flt(r, 'woba', 'on_base_plus_slg'),
    xwoba:       flt(r, 'xwoba', 'estimated_woba_using_speedangle'),
    put_away:    flt(r, 'put_away', 'put_away_percent'),
    pitches:     flt(r, 'pitch_count', 'pitches', 'n'),
  };
}

// Normalize a statcast_search row (fallback, group_by=name-pitch)
// Columns: pitch_type, pitch_name, pitches, release_speed, release_spin_rate,
//          pfx_x (feet), pfx_z (feet), whiff_rate, ...
function normalizeStatcastRow(r, totalPitches) {
  const count = flt(r, 'pitches', 'pitch_count') ?? 0;
  const usagePct = totalPitches > 0 ? (count / totalPitches * 100) : null;

  // pfx_x and pfx_z come in feet from statcast_search — convert to inches
  const pfxX = flt(r, 'pfx_x');
  const pfxZ = flt(r, 'pfx_z');

  return {
    pitch_type:  str(r, 'pitch_type') ?? '—',
    pitch_name:  str(r, 'pitch_name', 'pitch_type') ?? '—',
    usage_pct:   usagePct,
    avg_speed:   flt(r, 'release_speed', 'avg_speed'),
    avg_spin:    flt(r, 'release_spin_rate', 'avg_spin_rate'),
    avg_break_x: pfxX !== null ? pfxX * 12 : null, // feet → inches
    avg_break_z: pfxZ !== null ? pfxZ * 12 : null,
    pfx_x_ft:   pfxX,
    pfx_z_ft:   pfxZ,
    whiff_pct:   flt(r, 'whiff_percent', 'whiff_rate'),
    k_pct:       flt(r, 'k_percent'),
    ba:          flt(r, 'ba', 'batting_avg'),
    slg:         flt(r, 'slg', 'slg_percent'),
    woba:        flt(r, 'woba'),
    xwoba:       flt(r, 'xwoba', 'estimated_woba_using_speedangle'),
    put_away:    flt(r, 'put_away'),
    pitches:     count,
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');

  const { id, year = new Date().getFullYear() } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing player id' });

  // ── Primary: pitch-arsenal-stats endpoint ──────────────────────────────
  const primaryUrl = `https://baseballsavant.mlb.com/leaderboard/pitch-arsenal-stats?type=pitcher&pitchType=&year=${year}&team=&min=0&player_id=${id}&csv=true`;

  try {
    const r = await fetch(primaryUrl, { headers: HEADERS, signal: AbortSignal.timeout(9000) });

    if (r.ok) {
      const text = await r.text();
      const { headers, rows: rawRows } = parseCSV(text);

      console.log(`[arsenal/primary] id=${id} year=${year} cols=${headers.slice(0,15).join('|')} rows=${rawRows.length}`);

      const validRows = rawRows.filter(r => r['pitch_type'] || r['pitch_type_name']);

      if (validRows.length > 0) {
        const normalized = validRows.map(r => normalizeArsenalRow(r));
        return res.status(200).json({ pitches: normalized, source: 'pitch_arsenal_stats', debug: { headers: headers.slice(0,20) } });
      }
    }

    console.log(`[arsenal/primary] failed or empty — trying statcast_search fallback`);

    // ── Fallback: statcast_search grouped by pitch ──────────────────────
    const fallbackUrl = `https://baseballsavant.mlb.com/statcast_search/csv?all=true&hfSeas=${year}%7C&player_type=pitcher&pitchers_lookup%5B%5D=${id}&group_by=name-pitch&sort_col=pitches&sort_order=desc&min_pitches=0`;
    const r2 = await fetch(fallbackUrl, { headers: HEADERS, signal: AbortSignal.timeout(9000) });

    if (!r2.ok) return res.status(502).json({ error: 'Both Savant endpoints failed', status: r2.status });

    const text2 = await r2.text();
    const { headers: h2, rows: rawRows2 } = parseCSV(text2);

    console.log(`[arsenal/fallback] cols=${h2.slice(0,15).join('|')} rows=${rawRows2.length}`);

    const validRows2 = rawRows2.filter(r => r['pitch_type'] && parseInt(r['pitches']||r['pitch_count']||0) > 0);
    const totalPitches = validRows2.reduce((s, r) => s + (parseInt(r['pitches']||0)), 0);
    const normalized2 = validRows2.map(r => normalizeStatcastRow(r, totalPitches));

    return res.status(200).json({ pitches: normalized2, source: 'statcast_search', debug: { headers: h2.slice(0,20) } });

  } catch (e) {
    console.error(`[arsenal] error: ${e.message}`);
    return res.status(500).json({ error: e.message });
  }
}