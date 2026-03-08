// pages/api/arsenal.js
//
// Source map — one correct source per stat type:
//
// Source A — pitch-arsenal-stats?player_id={id}
//   → outcome stats: ba, slg, woba, est_woba, whiff_percent, k_percent,
//                    put_away, hard_hit_percent, pitch_name
//
// Source C_n — pitch-arsenals?type=n_
//   → usage % (wide format, cols: ff_n_, si_n_, st_n_, fc_n_, etc.)
//   → THIS is what Savant's arsenal page actually displays — exact 1:1 match
//
// Source C_spd — pitch-arsenals?type=avg_speed
//   → velo fallback (wide format, cols: ff_avg_speed, si_avg_speed, etc.)
//
// Source D — pitch-movement?pitch_type={PT}  (one fetch per active pitch)
//   → avg_speed (primary velo), avg_spin_rate, avg_break_x, avg_break_z

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

// Prefix used in the pitch-arsenals wide-format CSV for each pitch type
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

  // ── Step 1: Fetch Source A + Source C_n + Source C_spd in parallel ───────────
  const [resA, resCn, resCspd] = await Promise.allSettled([
    // Source A — outcome stats per pitch type
    fetch(
      `https://baseballsavant.mlb.com/leaderboard/pitch-arsenal-stats?type=pitcher&pitchType=&year=${year}&team=&min=0&player_id=${id}&csv=true`,
      { headers:HEADERS, signal:AbortSignal.timeout(12000) }
    ).then(r=>r.text()),
    // Source C_n — USAGE % — exact same data as Savant's arsenal page
    fetch(
      `https://baseballsavant.mlb.com/leaderboard/pitch-arsenals?season=${year}&position=&team=&min=0&type=n_&csv=true`,
      { headers:HEADERS, signal:AbortSignal.timeout(12000) }
    ).then(r=>r.text()),
    // Source C_spd — avg speed fallback
    fetch(
      `https://baseballsavant.mlb.com/leaderboard/pitch-arsenals?season=${year}&position=&team=&min=0&type=avg_speed&csv=true`,
      { headers:HEADERS, signal:AbortSignal.timeout(12000) }
    ).then(r=>r.text()),
  ]);

  const { headers:hA,    rows:rawA    } = parseCSV(resA.status==='fulfilled'    ? resA.value    : '');
  const { headers:hCn,   rows:rawCn   } = parseCSV(resCn.status==='fulfilled'   ? resCn.value   : '');
  const { headers:hCspd, rows:rawCspd } = parseCSV(resCspd.status==='fulfilled' ? resCspd.value : '');

  // Find this player's row in wide-format leaderboards (column name is `pitcher`)
  const playerUsageRow = rawCn.find(r   => parseInt(r['pitcher'],10) === numId) ?? {};
  const playerSpeedRow = rawCspd.find(r => parseInt(r['pitcher'],10) === numId) ?? {};

  // ── Step 2: Determine active pitch types + usage% from Source C_n ────────────
  // Columns: ff_n_, si_n_, st_n_, fc_n_, cu_n_, ch_n_, sl_n_, fs_n_, etc.
  // Values are already percentages (e.g. 15.0 = 15%) — exactly what Savant shows.
  const usageFromCn = {};
  for (const [pt, prefix] of Object.entries(PITCH_PREFIX)) {
    const val = flt(playerUsageRow, `${prefix}_n_`);
    if (val !== null && val > 0) usageFromCn[pt] = val;
  }

  let usageFinal = {};
  let activePitchTypes = [];

  if (Object.keys(usageFromCn).length > 0) {
    // Primary path: exact Savant usage percentages
    usageFinal = usageFromCn;
    activePitchTypes = Object.entries(usageFromCn)
      .filter(([, u]) => u >= 1.0)
      .map(([pt]) => pt);
  } else {
    // Fallback: player not in pitch-arsenals leaderboard (e.g. low pitch count)
    // Derive usage from raw pitch counts in Source A
    const countByType = {};
    let totalCount = 0;
    for (const r of rawA) {
      const pt = (r['pitch_type']??'').trim();
      if (!pt) continue;
      const c = flt(r,'pitches') ?? 0;
      countByType[pt] = (countByType[pt] ?? 0) + c;
      totalCount += c;
    }
    for (const [pt, c] of Object.entries(countByType)) {
      usageFinal[pt] = totalCount > 0 ? (c/totalCount)*100 : 0;
    }
    activePitchTypes = Object.entries(usageFinal)
      .filter(([, u]) => u >= 1.0)
      .map(([pt]) => pt);
  }

  // ── Source A: group rows by pitch_type for outcome stats ─────────────────────
  const groupsA = {};
  for (const r of rawA) {
    const pt = (r['pitch_type']??'').trim();
    if (!pt) continue;
    if (!groupsA[pt]) groupsA[pt] = [];
    groupsA[pt].push(r);
  }

  if (debug) {
    return res.status(200).json({
      A_cols:         hA,
      A_sample:       rawA[0] ?? null,
      A_rowCount:     rawA.length,
      Cn_cols:        hCn,
      Cn_playerRow:   playerUsageRow,
      Cspd_playerRow: playerSpeedRow,
      usageFromCn,
      usageFinal,
      activePitchTypes,
    });
  }

  // ── Step 3: Fetch pitch-movement per active pitch type ───────────────────────
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

  // ── Step 4: Build final pitch objects ────────────────────────────────────────
  const pitches = activePitchTypes
    .map(pt => {
      const rows    = groupsA[pt] ?? [];
      const prefix  = PITCH_PREFIX[pt];
      const moveRow = movementByType[pt] ?? {};

      // Usage: from Source C_n (Savant-exact)
      const usage = usageFinal[pt] ?? null;

      // Pitch count: sum from Source A (display only)
      const pitchCount = rows.reduce((s,r) => s+(flt(r,'pitches')??0), 0);

      // Velo: pitch-movement primary → Source C_spd wide-format fallback
      const speed = flt(moveRow,'avg_speed','release_speed')
        ?? (prefix ? flt(playerSpeedRow,`${prefix}_avg_speed`) : null);

      // Spin + Break: pitch-movement
      const spin   = flt(moveRow,'avg_spin_rate','spin_rate','release_spin_rate');
      const breakX = flt(moveRow,'avg_break_x','pitcher_break_x','pfx_x_inches');
      const breakZ = flt(moveRow,'avg_break_z','pitcher_break_z','pfx_z_inches','avg_break');

      // Pitch name: Source A → lookup table
      const pitchName = (rows.length > 0 ? str(rows[0],'pitch_name','pitch_type_name') : null)
        ?? PITCH_NAMES[pt] ?? pt;

      return {
        pitch_type:   pt,
        pitch_name:   pitchName,
        pitch_count:  pitchCount,
        usage_pct:    usage,
        avg_speed:    speed,
        avg_spin:     spin,
        avg_break_x:  breakX,
        avg_break_z:  breakZ,
        whiff_pct:    rows.length > 0 ? wavg(rows,'whiff_percent')    : null,
        k_pct:        rows.length > 0 ? wavg(rows,'k_percent')        : null,
        ba:           rows.length > 0 ? wavg(rows,'ba')               : null,
        slg:          rows.length > 0 ? wavg(rows,'slg')              : null,
        woba:         rows.length > 0 ? wavg(rows,'woba')             : null,
        xwoba:        rows.length > 0 ? (wavg(rows,'est_woba') ?? wavg(rows,'xwoba')) : null,
        put_away:     rows.length > 0 ? wavg(rows,'put_away')         : null,
        hard_hit_pct: rows.length > 0 ? wavg(rows,'hard_hit_percent') : null,
      };
    })
    .sort((a,b) => (b.usage_pct??0) - (a.usage_pct??0));

  return res.status(200).json({ pitches, source:'cn_usage+movement+arsenal_stats' });
}