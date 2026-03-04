// pages/api/savant.js
// Uses Baseball Savant's percentile rankings CSV — the cleanest, most documented endpoint.
// URL: /leaderboard/percentile-rankings?type=batter&year=YYYY&csv=true
// Returns one row per qualified player with columns like:
//   player_id, xba, xslg, xwoba, exit_velocity_avg, launch_angle_avg,
//   barrel_batted_rate, hard_hit_percent, sprint_speed, etc.
//   PLUS percentile rank columns named the same with _pct suffix

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing player id' });

  const year = new Date().getFullYear();
  // Also try prior year if current year returns nothing (early in season)
  const years = [year, year - 1];

  for (const yr of years) {
    for (const type of ['batter', 'pitcher']) {
      try {
        const url = `https://baseballsavant.mlb.com/leaderboard/percentile-rankings?type=${type}&year=${yr}&position=&team=&min=q&csv=true`;
        const r = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Referer': 'https://baseballsavant.mlb.com/percentile-rankings',
          },
        });

        if (!r.ok) continue;
        const text = await r.text();

        // Detect if we got CSV or HTML (sometimes Savant returns HTML on redirect)
        if (text.trimStart().startsWith('<')) continue;

        const rows = parseCSV(text);
        if (rows.length === 0) continue;

        // Log headers on first successful parse for debugging
        const headers = Object.keys(rows[0]);

        // Find this player — try every plausible ID column name
        const player = rows.find(row =>
          String(row.player_id)  === String(id) ||
          String(row.mlbam_id)   === String(id) ||
          String(row.batter_id)  === String(id) ||
          String(row.pitcher_id) === String(id) ||
          String(row.id)         === String(id)
        );

        if (!player) continue;

        // Build response — map all known Savant percentile CSV column variants
        const data = buildStats(player, type, headers);

        // Fetch sprint speed separately (different leaderboard)
        let sprint = {};
        try {
          const sr = await fetch(
            `https://baseballsavant.mlb.com/leaderboard/sprint_speed?year=${yr}&position=&team=&min=10&csv=true`,
            { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://baseballsavant.mlb.com' } }
          );
          if (sr.ok) {
            const stxt = await sr.text();
            if (!stxt.trimStart().startsWith('<')) {
              const srows = parseCSV(stxt);
              const sp = srows.find(r =>
                String(r.player_id) === String(id) ||
                String(r.mlbam_id)  === String(id)
              );
              if (sp) {
                sprint = {
                  sprint_speed: sp.hp_to_1b ?? sp.sprint_speed ?? sp.r_sprint_speed ?? null,
                  sprint_pct:   numOrNull(sp.r_sprint_speed_pct ?? sp.sprint_speed_pct ?? sp.pct_rank),
                };
              }
            }
          }
        } catch {}

        // Fetch OAA separately
        let oaa = {};
        try {
          const or = await fetch(
            `https://baseballsavant.mlb.com/leaderboard/outs_above_average?type=Fielder&inn=&pos=&year=${yr}&team=&min=q&csv=true`,
            { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://baseballsavant.mlb.com' } }
          );
          if (or.ok) {
            const otxt = await or.text();
            if (!otxt.trimStart().startsWith('<')) {
              const orows = parseCSV(otxt);
              const op = orows.find(r =>
                String(r.player_id) === String(id) ||
                String(r.mlbam_id)  === String(id)
              );
              if (op) {
                oaa = {
                  outs_above_avg: op.outs_above_average ?? op.oaa ?? null,
                  oaa_pct:        numOrNull(op.oaa_pct ?? op.outs_above_average_pct),
                };
              }
            }
          }
        } catch {}

        return res.status(200).json({
          available: true,
          playerType: type,
          season: yr,
          ...data,
          ...sprint,
          ...oaa,
        });

      } catch { continue; }
    }
  }

  return res.status(200).json({ available: false });
}

// ── Build stats object by checking all known column name variants
function buildStats(p, type, headers) {
  // Helper: pick first non-null value from list of possible column names
  const col = (...keys) => {
    for (const k of keys) {
      const v = p[k];
      if (v !== undefined && v !== null && v !== '' && v !== 'null' && v !== 'NA') return v;
    }
    return null;
  };

  const fmtDec = (v, d) => { const n = parseFloat(v); return isNaN(n) ? null : n.toFixed(d); };
  const fmtPct = (v) => {
    const n = parseFloat(v);
    if (isNaN(n)) return null;
    return (n > 1 ? n : n * 100).toFixed(1) + '%';
  };

  if (type === 'batter') {
    return {
      // Raw stat values — shown in tile
      xba:           fmtDec(col('xba','est_ba','expected_batting_avg'), 3),
      xslg:          fmtDec(col('xslg','est_slg','expected_slg'), 3),
      xwoba:         fmtDec(col('xwoba','est_woba','expected_woba'), 3),
      exit_velocity: fmtDec(col('exit_velocity_avg','avg_hit_speed','avg_exit_velocity'), 1),
      launch_angle:  fmtDec(col('launch_angle_avg','avg_launch_angle'), 1),
      hard_hit:      fmtPct(col('hard_hit_percent','hard_hit_rate','hard_hit_pct')),
      barrel:        fmtPct(col('barrel_batted_rate','barrel_rate','barrel_pct','barrels_per_pa_percent')),

      // Percentile ranks (0–100 integers) — shown in badge
      xba_pct:       numOrNull(col('xba_pct','est_ba_pct','expected_batting_avg_pct')),
      xslg_pct:      numOrNull(col('xslg_pct','est_slg_pct','expected_slg_pct')),
      xwoba_pct:     numOrNull(col('xwoba_pct','est_woba_pct','expected_woba_pct')),
      ev_pct:        numOrNull(col('exit_velocity_avg_pct','avg_hit_speed_pct','exit_velocity_pct')),
      hard_hit_pct:  numOrNull(col('hard_hit_percent_pct','hard_hit_rate_pct','hard_hit_pct_rank')),
      barrel_pct:    numOrNull(col('barrel_batted_rate_pct','barrel_rate_pct','barrel_pct_rank')),
      avg_pct:       numOrNull(col('batting_avg_pct','ba_pct','avg_pct')),
      obp_pct:       numOrNull(col('on_base_pct_pct','obp_pct')),
      slg_pct:       numOrNull(col('slg_pct_pct','slg_pct')),
      ops_pct:       numOrNull(col('on_base_plus_slg_pct','ops_pct')),
      k_pct:         numOrNull(col('strikeout_percent_pct','k_percent_pct','k_pct_rank','strikeout_pct_pct')),
      bb_pct:        numOrNull(col('walk_percent_pct','bb_percent_pct','bb_pct_rank','walk_pct_pct')),
    };
  } else {
    return {
      xera:          fmtDec(col('xera','p_xera','est_era','expected_era'), 2),
      avg_fastball:  fmtDec(col('ff_avg_speed','fastball_avg_speed','avg_fastball_speed'), 1),
      whiff:         fmtPct(col('whiff_percent','whiff_pct','swing_miss_pct')),
      exit_velocity: fmtDec(col('exit_velocity_avg','avg_hit_speed'), 1),
      hard_hit:      fmtPct(col('hard_hit_percent','hard_hit_rate')),
      barrel:        fmtPct(col('barrel_batted_rate','barrel_rate')),
      xba:           fmtDec(col('xba','est_ba'), 3),
      xwoba:         fmtDec(col('xwoba','est_woba'), 3),

      xera_pct:      numOrNull(col('xera_pct','p_era_pct','est_era_pct')),
      velo_pct:      numOrNull(col('ff_avg_speed_pct','fastball_speed_pct','velo_pct')),
      whiff_pct:     numOrNull(col('whiff_percent_pct','whiff_pct_rank')),
      ev_pct:        numOrNull(col('exit_velocity_avg_pct','avg_hit_speed_pct')),
      hard_hit_pct:  numOrNull(col('hard_hit_percent_pct','hard_hit_rate_pct')),
      barrel_pct:    numOrNull(col('barrel_batted_rate_pct','barrel_rate_pct')),
      xba_pct:       numOrNull(col('xba_pct','est_ba_pct')),
      xwoba_pct:     numOrNull(col('xwoba_pct','est_woba_pct')),
      era_pct:       numOrNull(col('p_era_pct','era_pct')),
      whip_pct:      numOrNull(col('p_whip_pct','whip_pct')),
      k9_pct:        numOrNull(col('p_k_pct','k9_pct','k_per_9_pct')),
      bb9_pct:       numOrNull(col('p_bb_pct','bb9_pct')),
    };
  }
}

// ── CSV parser — handles quoted fields with embedded commas
function parseCSV(csv) {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = parseCSVLine(line);
    const row = {};
    headers.forEach((h, i) => { row[h] = (vals[i] ?? '').trim(); });
    return row;
  }).filter(r => Object.values(r).some(v => v !== ''));
}

function parseCSVLine(line) {
  const result = [];
  let cur = '', inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; }
    else if (ch === ',' && !inQ) { result.push(cur); cur = ''; }
    else { cur += ch; }
  }
  result.push(cur);
  return result;
}

function numOrNull(v) {
  if (v === undefined || v === null || v === '' || v === 'null' || v === 'NA') return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : Math.round(n);
}