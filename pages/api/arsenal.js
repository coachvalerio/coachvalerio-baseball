// pages/api/arsenal.js
// Confirmed column sources (from debug responses):
//
// Source A — pitch-arsenal-stats?player_id={id}
//   cols: last_name, first_name, player_id(=team!), pitch_type, pitch_name,
//         pitches, pitch_usage, pa, ba, slg, woba, whiff_percent, k_percent,
//         put_away, est_ba, est_slg, est_woba, hard_hit_percent
//   → outcome stats per pitch type
//
// Source C — pitch-arsenals (full leaderboard, find row by `pitcher` int col)
//   cols: last_name, first_name, pitcher, ff_avg_speed, si_avg_speed, ...
//   → speed per pitch type (wide format, one row per pitcher)
//
// Source D — pitch-movement?pitch_type={PT} (one fetch per pitch type)
//   cols: player_id/pitcher_id, pitch_type, avg_speed, avg_spin_rate,
//         avg_break_x, avg_break_z (or pitcher_break_x/z)
//   → velo + spin + break per pitch type

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/csv,text/plain,*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://baseballsavant.mlb.com/',
};

const PITCH_NAMES = {
  FF:'4-Seam Fastball', SI:'Sinker', FC:'Cutter', SL:'Slider', ST:'Sweeper',
  CU:'Curveball', KC:'Knuckle Curve', CH:'Changeup', FS:'Split-Finger',
  KN:'Knuckleball', SV:'Slurve', FO:'Forkball', FA:'Fastball',
};

// pitch-arsenals wide-format speed column prefix per pitch type
const SPEED_COL = {
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
const wavg = (rows, field, wField) => {
  let num=0, den=0;
  for (const r of rows){
    const v = flt(r,field);
    const w = wField ? (flt(r,wField)??1) : 1;
    if(v!==null){ num+=v*w; den+=w; }
  }
  return den>0 ? num/den : null;
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
  const { id, year=new Date().getFullYear(), debug } = req.query;
  if (!id) return res.status(400).json({ error:'Missing player id' });
  const numId = parseInt(id, 10);

  // ── Step 1: Source A + Source C in parallel ────────────────────────────────
  const [resA, resC] = await Promise.allSettled([
    fetch(
      `https://baseballsavant.mlb.com/leaderboard/pitch-arsenal-stats?type=pitcher&pitchType=&year=${year}&team=&min=0&player_id=${id}&csv=true`,
      { headers:HEADERS, signal:AbortSignal.timeout(10000) }
    ).then(r=>r.text()),
    fetch(
      `https://baseballsavant.mlb.com/leaderboard/pitch-arsenals?season=${year}&position=&team=&min=0&csv=true`,
      { headers:HEADERS, signal:AbortSignal.timeout(10000) }
    ).then(r=>r.text()),
  ]);

  const { headers:hA, rows:rawA } = parseCSV(resA.status==='fulfilled' ? resA.value : '');
  const { headers:hC, rows:rawC } = parseCSV(resC.status==='fulfilled' ? resC.value : '');

  // ── Source C: find THIS player's row ──────────────────────────────────────
  // Column is `pitcher` (integer), not `player_id`
  const playerSpeedRow = rawC.find(r => parseInt(r['pitcher'],10) === numId) ?? {};

  // ── Source A: group by pitch_type, compute pitch_usage (0–1 float) ─────────
  const groupsA = {};
  for (const r of rawA) {
    const pt = (r['pitch_type']??'').trim();
    if (!pt) continue;
    if (!groupsA[pt]) groupsA[pt] = [];
    groupsA[pt].push(r);
  }

  // Compute usage from raw pitch COUNTS — not pitch_usage fractions.
  // Summing pitch_usage (already 0-1) then re-normalizing compounds errors,
  // especially for mid-season trades with multiple rows per pitch type.
  // Raw counts match Savant's displayed percentages exactly.
  const countByType = {};
  let totalPitchCount = 0;
  for (const [pt, rows] of Object.entries(groupsA)) {
    const c = rows.reduce((s,r) => s+(flt(r,'pitches')??0), 0);
    countByType[pt] = c;
    totalPitchCount += c;
  }

  // Determine which pitch types this player actually throws (>= 1% usage)
  const activePitchTypes = Object.entries(countByType)
    .filter(([pt, c]) => totalPitchCount > 0 ? (c/totalPitchCount)*100 >= 1.0 : c > 0)
    .map(([pt]) => pt);

  if (debug) {
    return res.status(200).json({
      A_cols: hA, A_sample: rawA[0]??null, A_rowCount: rawA.length,
      C_cols: hC, C_playerRow: playerSpeedRow,
      activePitchTypes, countByType, totalPitchCount,
    });
  }

  // ── Step 2: Fetch pitch-movement for each active pitch type (spin + break) ─
  const movementByType = {};
  if (activePitchTypes.length > 0) {
    const moveResults = await Promise.allSettled(
      activePitchTypes.map(pt =>
        fetch(
          `https://baseballsavant.mlb.com/leaderboard/pitch-movement?season=${year}&team=&min=0&type=pitcher&pitch_type=${pt}&hand=&csv=true`,
          { headers:HEADERS, signal:AbortSignal.timeout(10000) }
        ).then(r=>r.text())
          .then(text => ({ pt, ...parseCSV(text) }))
          .catch(() => ({ pt, headers:[], rows:[] }))
      )
    );

    for (const r of moveResults) {
      if (r.status !== 'fulfilled') continue;
      const { pt, rows } = r.value;
      // Find this player's row — try multiple possible ID column names
      const playerRow = rows.find(row => {
        for (const col of ['player_id','pitcher_id','pitcher','mlb_id','id']) {
          if (parseInt(row[col],10) === numId) return true;
        }
        return false;
      });
      if (playerRow) movementByType[pt] = playerRow;
    }
  }

  // ── Step 3: Build final pitch objects ─────────────────────────────────────
  const pitches = Object.entries(groupsA)
    .filter(([pt]) => activePitchTypes.includes(pt)) // >= 1% usage filter
    .map(([pt, rows]) => {
      const pitchCount = rows.reduce((s,r) => s+(flt(r,'pitches')??0), 0);
      const usage      = totalPitchCount > 0 ? (pitchCount/totalPitchCount)*100 : null;
      const col      = SPEED_COL[pt];
      const moveRow  = movementByType[pt] ?? {};

      // Velo: pitch-movement → pitch-arsenals wide speed column
      const speed = flt(moveRow,'avg_speed','release_speed')
        ?? (col ? flt(playerSpeedRow,`${col}_avg_speed`) : null);

      // Spin: pitch-movement
      const spin = flt(moveRow,'avg_spin_rate','spin_rate','release_spin_rate');

      // Break: pitch-movement (inches — try both column name variants)
      const breakX = flt(moveRow,'avg_break_x','pitcher_break_x','pfx_x_inches');
      const breakZ = flt(moveRow,'avg_break_z','pitcher_break_z','pfx_z_inches','avg_break');

      return {
        pitch_type:   pt,
        pitch_name:   str(rows[0],'pitch_name','pitch_type_name') ?? PITCH_NAMES[pt] ?? pt,
        pitch_count:  pitchCount,
        usage_pct:    usage,
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
    .sort((a,b) => (b.usage_pct??0) - (a.usage_pct??0));

  return res.status(200).json({ pitches, source:'arsenal_stats+movement' });
}