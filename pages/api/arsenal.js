// pages/api/arsenal.js
// Three sources merged:
// A: pitch-arsenal-stats  → usage%, whiff%, K%, BA, SLG, wOBA (per pitch type, server-filtered)
// B: statcast_search       → avg_speed, avg_spin, pfx_x, pfx_z (per pitch type, server-filtered)
// C: pitch-arsenals        → avg_speed fallback (wide format, one row per pitcher)

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/csv,text/plain,*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://baseballsavant.mlb.com/',
};

// Minimum pitches for a pitch type to appear. Eliminates Statcast misclassifications.
// 0.8% of a starter's ~3000 pitches = ~24. Set to 25.
const MIN_PITCHES = 25;

const PITCH_NAMES = {
  FF:'4-Seam Fastball', SI:'Sinker', FC:'Cutter', SL:'Slider', ST:'Sweeper',
  CU:'Curveball', KC:'Knuckle Curve', CH:'Changeup', FS:'Split-Finger',
  KN:'Knuckleball', SV:'Slurve', FO:'Forkball', FA:'Fastball', SC:'Screwball',
};

// pitch-arsenals wide-format column prefix per pitch type
const PITCH_COL = {
  FF:'ff', SI:'si', FC:'fc', SL:'sl', ST:'st', CU:'cu',
  KC:'kc', CH:'ch', FS:'fs', KN:'kn', SV:'sv', FO:'fo',
};

function parseCSV(text) {
  if (!text?.trim()) return { headers:[], rows:[] };
  const lines = text.trim().split('\n');
  if (lines.length < 2) return { headers:[], rows:[] };
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

const wavg = (rows, field, wField='pitches') => {
  let num=0, den=0;
  for (const r of rows){
    const v=flt(r,field), w=flt(r,wField)??1;
    if(v!==null){ num+=v*w; den+=w; }
  }
  return den>0 ? num/den : null;
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
  const { id, year=new Date().getFullYear(), debug } = req.query;
  if (!id) return res.status(400).json({ error:'Missing player id' });

  // Fetch all three sources in parallel
  const [resA, resB, resC] = await Promise.allSettled([
    fetch(`https://baseballsavant.mlb.com/leaderboard/pitch-arsenal-stats?type=pitcher&pitchType=&year=${year}&team=&min=0&player_id=${id}&csv=true`,
      { headers:HEADERS, signal:AbortSignal.timeout(10000) }).then(r=>r.text()),
    fetch(`https://baseballsavant.mlb.com/statcast_search/csv?all=true&hfSeas=${year}%7C&player_type=pitcher&pitchers_lookup%5B%5D=${id}&group_by=name-pitch&sort_col=pitches&sort_order=desc&min_pitches=0`,
      { headers:HEADERS, signal:AbortSignal.timeout(10000) }).then(r=>r.text()),
    fetch(`https://baseballsavant.mlb.com/leaderboard/pitch-arsenals?season=${year}&position=&team=&min=0&player_id=${id}&csv=true`,
      { headers:HEADERS, signal:AbortSignal.timeout(10000) }).then(r=>r.text()),
  ]);

  const textA = resA.status==='fulfilled' ? resA.value : '';
  const textB = resB.status==='fulfilled' ? resB.value : '';
  const textC = resC.status==='fulfilled' ? resC.value : '';

  const { headers:hA, rows:rawA } = parseCSV(textA);
  const { headers:hB, rows:rawB } = parseCSV(textB);
  const { headers:hC, rows:rawC } = parseCSV(textC);

  if (debug) {
    return res.status(200).json({
      A:{ cols:hA, sample:rawA[0]??null },
      B:{ cols:hB, sample:rawB[0]??null },
      C:{ cols:hC, sample:rawC[0]??null },
    });
  }

  // ── Source A: aggregate by pitch_type ─────────────────────────────────────
  const groupsA = {};
  for (const r of rawA) {
    const pt = (r['pitch_type']??'').trim();
    if (!pt) continue;
    if (!groupsA[pt]) groupsA[pt] = [];
    groupsA[pt].push(r);
  }
  const totalPitches = Object.values(groupsA).reduce((s,g) =>
    s + g.reduce((gs,r) => gs+(flt(r,'pitches')??1), 0), 0);

  // ── Source B: index by pitch_type for velo/spin/break ─────────────────────
  const statsB = {}; // pitch_type → row
  for (const r of rawB) {
    const pt = (r['pitch_type']??'').trim();
    if (pt) statsB[pt] = r;
  }

  // ── Source C: wide-format row for speed fallback ───────────────────────────
  const wideRow = rawC[0] ?? {};

  // ── Merge and build final pitch objects ───────────────────────────────────
  const pitches = Object.entries(groupsA).map(([pt, rows]) => {
    const count = rows.reduce((s,r) => s+(flt(r,'pitches')??1), 0);
    const bRow  = statsB[pt] ?? {};
    const col   = PITCH_COL[pt];

    // Velo: prefer statcast_search (release_speed), fallback pitch-arsenals wide column
    const speed = flt(bRow,'release_speed','avg_speed')
      ?? (col ? flt(wideRow,`${col}_avg_speed`) : null);

    // Spin: statcast_search has release_spin_rate
    const spin  = flt(bRow,'release_spin_rate','avg_spin_rate');

    // Break: statcast_search pfx_x/pfx_z in feet → convert to inches
    const pfxX  = flt(bRow,'pfx_x');
    const pfxZ  = flt(bRow,'pfx_z');
    const breakX = pfxX !== null ? pfxX*12 : null;
    const breakZ = pfxZ !== null ? pfxZ*12 : null;

    return {
      pitch_type:   pt,
      pitch_name:   str(rows[0],'pitch_name','pitch_type_name') ?? PITCH_NAMES[pt] ?? pt,
      pitch_count:  count,
      usage_pct:    totalPitches>0 ? (count/totalPitches)*100 : null,
      avg_speed:    speed,
      avg_spin:     spin,
      avg_break_x:  breakX,
      avg_break_z:  breakZ,
      whiff_pct:    wavg(rows,'whiff_percent'),
      k_pct:        wavg(rows,'k_percent'),
      ba:           wavg(rows,'ba'),
      slg:          wavg(rows,'slg'),
      woba:         wavg(rows,'woba'),
      xwoba:        wavg(rows,'est_woba') ?? wavg(rows,'xwoba'),
      put_away:     wavg(rows,'put_away'),
      hard_hit_pct: wavg(rows,'hard_hit_percent'),
    };
  })
  .filter(p => p.pitch_count >= MIN_PITCHES)   // ← kills misclassifications
  .sort((a,b) => b.pitch_count - a.pitch_count);

  return res.status(200).json({ pitches, source:'merged' });
}