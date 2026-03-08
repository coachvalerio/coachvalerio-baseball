// pages/api/arsenal.js
//
// CONFIRMED column layouts from debug (2025-03-08):
//
// Source A — pitch-arsenal-stats (full leaderboard, filter by first_name=player_id)
//   Savant mislabels columns — ACTUAL mapping confirmed by value inspection:
//   'first_name'      → MLB player ID (numeric, use to filter rows)
//   'team_name_alt'   → pitch type CODE (FF, SI, ST, FC, etc.)
//   'pitch_type'      → pitch name TEXT (4-Seam Fastball, Sweeper, etc.)
//   'pitches'         → pitch USAGE % already (e.g. 31.0 = 31%) ← not a count!
//   'pitch_usage'     → PA count
//   'pa'              → BA
//   'ba'              → SLG
//   'slg'             → wOBA
//   'whiff_percent'   → whiff % ✓
//   'k_percent'       → K% ✓
//   'put_away'        → put away % ✓
//   'est_slg'         → xwOBA
//   'est_woba'        → hard_hit_percent
//
// Source Cn — pitch-arsenals?year=&type=n_   ← must use year= not season=
//   cols: last_name, first_name, pitcher, n_ff, n_si, n_fc, n_sl, n_ch, n_cu, n_fs, n_kn, n_st, n_sv
//   'pitcher' → player MLB ID (integer)
//   'n_ff', 'n_st', 'n_si' etc. → usage % (Savant-exact)
//   Match player by: parseInt(r['pitcher']) === numId
//
// Source D — pitch-movement?pitch_type={CODE}  ← must pass CODE not name
//   cols: player_id, avg_speed, avg_spin_rate, avg_break_x, avg_break_z

function getCurrentSeasonYear() {
  const now = new Date();
  const y   = now.getFullYear();
  return now >= new Date(y, 2, 20) ? y : y - 1;
}

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

// pitch-arsenals n_ columns: n_{prefix}
const PITCH_PREFIX = {
  FF:'ff', SI:'si', FC:'fc', SL:'sl', ST:'st', CU:'cu',
  KC:'kc', CH:'ch', FS:'fs', KN:'kn', SV:'sv', FO:'fo', FA:'fa',
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
  const { id, year:yearParam, debug } = req.query;
  if (!id) return res.status(400).json({ error:'Missing player id' });
  const year  = yearParam ?? getCurrentSeasonYear();
  const numId = parseInt(id, 10);

  // ── Step 1: Source A + Source Cn in parallel ──────────────────────────────
  // Note: pitch-arsenals MUST use year= not season=
  const [resA, resCn, resCspd] = await Promise.allSettled([
    fetch(
      `https://baseballsavant.mlb.com/leaderboard/pitch-arsenal-stats?type=pitcher&pitchType=&year=${year}&team=&min=0&csv=true`,
      { headers:HEADERS, signal:AbortSignal.timeout(15000) }
    ).then(r=>r.text()),
    fetch(
      `https://baseballsavant.mlb.com/leaderboard/pitch-arsenals?year=${year}&min=0&type=n_&hand=&csv=true`,
      { headers:HEADERS, signal:AbortSignal.timeout(15000) }
    ).then(r=>r.text()),
    fetch(
      `https://baseballsavant.mlb.com/leaderboard/pitch-arsenals?year=${year}&min=0&type=avg_speed&hand=&csv=true`,
      { headers:HEADERS, signal:AbortSignal.timeout(15000) }
    ).then(r=>r.text()),
  ]);

  const { headers:hA,    rows:rawA    } = parseCSV(resA.status==='fulfilled'    ? resA.value    : '');
  const { headers:hCn,   rows:rawCn   } = parseCSV(resCn.status==='fulfilled'   ? resCn.value   : '');
  const { headers:hCspd, rows:rawCspd } = parseCSV(resCspd.status==='fulfilled' ? resCspd.value : '');

  // Source A: filter to this player only
  // Savant puts the MLB ID in the 'first_name' column (confirmed by debug)
  const playerRowsA = rawA.filter(r => parseInt(r['first_name'],10) === numId);

  // Source Cn/Cspd: find player row by 'pitcher' integer column
  const playerUsageRow = rawCn.find(r   => parseInt(r['pitcher'],10) === numId) ?? {};
  const playerSpeedRow = rawCspd.find(r => parseInt(r['pitcher'],10) === numId) ?? {};

  // ── Step 2: Build pitch type → usage map ─────────────────────────────────
  // PRIMARY: Source Cn  (n_ff, n_st, n_si... — exact Savant percentages)
  // FALLBACK: Source A  ('pitches' column = usage % already, 'team_name_alt' = pitch code)
  const usageFinal = {};

  const hasCnData = Object.keys(playerUsageRow).length > 0;

  if (hasCnData) {
    for (const [pt, prefix] of Object.entries(PITCH_PREFIX)) {
      const val = flt(playerUsageRow, `n_${prefix}`);
      if (val !== null && val > 0) usageFinal[pt] = val;
    }
  } else {
    // Fallback: Source A — 'team_name_alt' = pitch code, 'pitches' = usage %
    for (const r of playerRowsA) {
      const pt      = (r['team_name_alt']??'').trim().toUpperCase();
      const usagePct = flt(r, 'pitches'); // confirmed: 'pitches' col holds usage %
      if (pt && usagePct !== null && usagePct > 0) {
        usageFinal[pt] = (usageFinal[pt] ?? 0) + usagePct;
      }
    }
  }

  const activePitchTypes = Object.entries(usageFinal)
    .filter(([, u]) => u >= 1.0)
    .map(([pt]) => pt);

  // ── Source A: group by pitch type code ('team_name_alt') ─────────────────
  const groupsA = {};
  for (const r of playerRowsA) {
    const pt = (r['team_name_alt']??'').trim().toUpperCase();
    if (!pt) continue;
    if (!groupsA[pt]) groupsA[pt] = [];
    groupsA[pt].push(r);
  }

  if (debug) {
    return res.status(200).json({
      A_cols:         hA,
      A_playerRows:   playerRowsA.length,
      A_sample:       playerRowsA[0] ?? null,
      Cn_cols:        hCn,
      Cn_playerRow:   playerUsageRow,
      Cspd_playerRow: playerSpeedRow,
      usageFinal,
      activePitchTypes,
      groupsA_keys:   Object.keys(groupsA),
    });
  }

  // ── Step 3: Fetch pitch-movement per active pitch type (using CODES) ──────
  const movementByType = {};
  if (activePitchTypes.length > 0) {
    const moveResults = await Promise.allSettled(
      activePitchTypes.map(pt =>
        fetch(
          `https://baseballsavant.mlb.com/leaderboard/pitch-movement?season=${year}&team=&min=0&type=pitcher&pitch_type=${pt}&hand=&csv=true`,
          { headers:HEADERS, signal:AbortSignal.timeout(12000) }
        ).then(r=>r.text())
          .then(text => ({ pt, ...parseCSV(text) }))
          .catch(() => ({ pt, headers:[], rows:[] }))
      )
    );

    for (const result of moveResults) {
      if (result.status !== 'fulfilled') continue;
      const { pt, rows } = result.value;
      const playerRow = rows.find(row => {
        for (const col of ['player_id','pitcher_id','pitcher','mlb_id','id']) {
          if (parseInt(row[col],10) === numId) return true;
        }
        return false;
      });
      if (playerRow) movementByType[pt] = playerRow;
    }
  }

  // ── Step 4: Build final pitch objects ─────────────────────────────────────
  // Source A column → actual meaning (confirmed by debug):
  //   'pitches'         → usage % (already percent)
  //   'pa'              → BA
  //   'ba'              → SLG
  //   'slg'             → wOBA
  //   'whiff_percent'   → whiff %  ✓
  //   'k_percent'       → K%       ✓
  //   'put_away'        → put away ✓
  //   'est_slg'         → xwOBA
  //   'est_woba'        → hard hit %

  const pitches = activePitchTypes
    .map(pt => {
      const rows    = groupsA[pt] ?? [];
      const prefix  = PITCH_PREFIX[pt];
      const moveRow = movementByType[pt] ?? {};

      const usage      = usageFinal[pt] ?? null;
      // PA count for weighted averages ('pitch_usage' col = PA count per confirmed debug)
      const paCounts   = rows.map(r => flt(r,'pitch_usage') ?? 1);
      const totalPA    = paCounts.reduce((s,v)=>s+v, 0);

      // Weighted average helper using PA counts
      const waPA = (field) => {
        let num=0, den=0;
        rows.forEach((r,i) => {
          const v = flt(r,field);
          if(v!==null){ num+=v*paCounts[i]; den+=paCounts[i]; }
        });
        return den>0 ? num/den : null;
      };

      // Velo: movement → speed leaderboard fallback
      const speed = flt(moveRow,'avg_speed','release_speed')
        ?? (prefix ? flt(playerSpeedRow,`${prefix}_avg_speed`) : null);

      const spin   = flt(moveRow,'avg_spin_rate','spin_rate','release_spin_rate');
      const breakX = flt(moveRow,'avg_break_x','pitcher_break_x','pfx_x_inches');
      const breakZ = flt(moveRow,'avg_break_z','pitcher_break_z','pfx_z_inches','avg_break');

      // Pitch name: from Source A 'pitch_type' col (holds text name per debug)
      const pitchName = str(rows[0],'pitch_type') ?? PITCH_NAMES[pt] ?? pt;

      return {
        pitch_type:   pt,
        pitch_name:   pitchName,
        pitch_count:  totalPA,
        usage_pct:    usage,
        avg_speed:    speed,
        avg_spin:     spin,
        avg_break_x:  breakX,
        avg_break_z:  breakZ,
        // Stat columns — confirmed actual mapping from debug:
        whiff_pct:    rows.length > 0 ? waPA('whiff_percent') : null,
        k_pct:        rows.length > 0 ? waPA('k_percent')     : null,
        ba:           rows.length > 0 ? waPA('pa')            : null,  // 'pa' col = BA
        slg:          rows.length > 0 ? waPA('ba')            : null,  // 'ba' col = SLG
        woba:         rows.length > 0 ? waPA('slg')           : null,  // 'slg' col = wOBA
        xwoba:        rows.length > 0 ? waPA('est_slg')       : null,  // 'est_slg' col = xwOBA
        put_away:     rows.length > 0 ? waPA('put_away')      : null,
        hard_hit_pct: rows.length > 0 ? waPA('est_woba')      : null,  // 'est_woba' col = hard hit
      };
    })
    .sort((a,b) => (b.usage_pct??0) - (a.usage_pct??0));

  return res.status(200).json({ pitches, source:'cn_usage+movement+arsenal_stats' });
}