// pages/api/arsenal.js
// Two-source approach:
// Source A: pitch-arsenal-stats → whiff%, K%, BA, SLG, wOBA (grouped by pitch type)
// Source B: pitch-arsenals leaderboard → velo, spin, break per pitch type
// Both use player_id URL param for server-side filtering

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
    headers.forEach((h,i) => { obj[h]=vals[i]??''; });
    return obj;
  });
  return { headers, rows };
}

const flt = (r,...keys) => {
  for (const k of keys){ const v=parseFloat(r[k]); if(!isNaN(v)) return v; }
  return null;
};

const str = (r,...keys) => {
  for (const k of keys){
    const v=(r[k]??'').trim();
    if(v && !v.match(/^-?\d+\.?\d*$/)) return v;
  }
  return null;
};

// Pitch type → column prefix in pitch-arsenals CSV
const PITCH_COL = {
  FF:'ff', SI:'si', FC:'fc', SL:'sl', ST:'st',
  CU:'cu', KC:'kc', CH:'ch', FS:'fs', KN:'kn', SV:'sv', FO:'fo',
};

// Pitch type → human name fallback
const PITCH_NAMES = {
  FF:'4-Seam Fastball', SI:'Sinker', FC:'Cutter', SL:'Slider', ST:'Sweeper',
  CU:'Curveball', KC:'Knuckle Curve', CH:'Changeup', FS:'Split-Finger',
  KN:'Knuckleball', SV:'Slurve', FO:'Forkball',
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
  const { id, year=new Date().getFullYear(), debug } = req.query;
  if (!id) return res.status(400).json({ error:'Missing player id' });

  // ── Fetch both sources in parallel ────────────────────────────────────────
  const [statsRes, arsenalRes] = await Promise.allSettled([
    // Source A: outcome stats per pitch type (whiff, K%, BA, SLG, wOBA)
    fetch(
      `https://baseballsavant.mlb.com/leaderboard/pitch-arsenal-stats?type=pitcher&pitchType=&year=${year}&team=&min=0&player_id=${id}&csv=true`,
      { headers: HEADERS, signal: AbortSignal.timeout(10000) }
    ).then(r => r.text()),

    // Source B: velocity/movement per pitch type (one row per pitcher, wide format)
    fetch(
      `https://baseballsavant.mlb.com/leaderboard/pitch-arsenals?season=${year}&position=&team=&min=0&player_id=${id}&csv=true`,
      { headers: HEADERS, signal: AbortSignal.timeout(10000) }
    ).then(r => r.text()),
  ]);

  // ── Parse Source A — group by pitch_type, aggregate stats ─────────────────
  const statsText  = statsRes.status === 'fulfilled' ? statsRes.value : '';
  const { headers: hA, rows: rawA } = parseCSV(statsText);

  if (debug) {
    const { headers: hB, rows: rawB } = parseCSV(arsenalRes.status==='fulfilled' ? arsenalRes.value : '');
    return res.status(200).json({
      sourceA: { cols: hA, rows: rawA.slice(0,3) },
      sourceB: { cols: hB, rows: rawB.slice(0,2) },
    });
  }

  // Group Source A rows by pitch_type, sum counts, wavg everything else
  const groups = {};
  for (const r of rawA) {
    const pt = (r['pitch_type']??'').trim();
    if (!pt) continue;
    if (!groups[pt]) groups[pt] = { rows:[], count:0 };
    const n = flt(r,'pitches','pitch_count') ?? 1;
    groups[pt].rows.push(r);
    groups[pt].count += n;
  }

  // Total pitch count across all types → usage %
  const grandTotal = Object.values(groups).reduce((s,g) => s+g.count, 0);

  const wavg = (rows, field, weightField='pitches') => {
    let num=0, den=0;
    for (const r of rows) {
      const v = flt(r, field);
      const w = flt(r, weightField) ?? 1;
      if (v !== null) { num += v*w; den += w; }
    }
    return den > 0 ? num/den : null;
  };

  const statsPitches = Object.entries(groups).map(([pt, g]) => ({
    pitch_type:  pt,
    pitch_name:  str(g.rows[0], 'pitch_name', 'pitch_type_name') ?? PITCH_NAMES[pt] ?? pt,
    pitch_count: g.count,
    usage_pct:   grandTotal > 0 ? (g.count/grandTotal)*100 : null,
    whiff_pct:   wavg(g.rows, 'whiff_percent'),
    k_pct:       wavg(g.rows, 'k_percent'),
    ba:          wavg(g.rows, 'ba'),
    slg:         wavg(g.rows, 'slg'),
    woba:        wavg(g.rows, 'woba'),
    xwoba:       wavg(g.rows, 'est_woba') ?? wavg(g.rows, 'xwoba'),
    put_away:    wavg(g.rows, 'put_away'),
    hard_hit_pct: wavg(g.rows, 'hard_hit_percent'),
  })).sort((a,b) => b.pitch_count - a.pitch_count);

  // ── Parse Source B — wide format, extract velo/spin/break per pitch type ──
  const arsenalText = arsenalRes.status === 'fulfilled' ? arsenalRes.value : '';
  const { rows: rawB } = parseCSV(arsenalText);
  // Should be 1 row (the filtered player), or we find by player_id-like column
  const playerRow = rawB[0] ?? {};

  // Merge velo/break from Source B into Source A pitch objects
  const pitches = statsPitches
    .filter(p => p.pitch_count >= 5) // safety: drop micro-groups
    .map(p => {
      const col = PITCH_COL[p.pitch_type];
      const speed  = col ? flt(playerRow, `${col}_avg_speed`) : null;
      const spin   = col ? flt(playerRow, `${col}_avg_spin`,`${col}_avg_spin_rate`) : null;
      const breakX = col ? flt(playerRow, `${col}_avg_break_x`,`${col}_pfx_x`) : null;
      const breakZ = col ? flt(playerRow, `${col}_avg_break_z`,`${col}_pfx_z`) : null;

      return { ...p, avg_speed: speed, avg_spin: spin, avg_break_x: breakX, avg_break_z: breakZ };
    });

  return res.status(200).json({ pitches, source: 'arsenal_stats+arsenals' });
}