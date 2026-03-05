// pages/api/savant.js
// TWO endpoints must be merged:
//   1. /leaderboard/expected_statistics?csv=true  → raw stat VALUES (est_ba, exit_velocity_avg, etc.)
//   2. /leaderboard/percentile-rankings?csv=true  → percentile RANKS (xba=55 means 55th percentile)
// They are DIFFERENT data — never mix them.

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing player id' });

  const year = new Date().getFullYear();
  const years = [year, year - 1]; // fallback to prior year if not enough data yet

  for (const yr of years) {
    for (const type of ['batter', 'pitcher']) {
      try {
        const HEADERS = {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html,*/*',
          'Referer': 'https://baseballsavant.mlb.com',
        };

        // ── Fetch both CSVs in parallel
        const [statsRes, pctRes] = await Promise.all([
          fetch(`https://baseballsavant.mlb.com/leaderboard/expected_statistics?type=${type}&year=${yr}&position=&team=&min=q&csv=true`, { headers: HEADERS }),
          fetch(`https://baseballsavant.mlb.com/leaderboard/percentile-rankings?type=${type}&year=${yr}&position=&team=&min=q&csv=true`, { headers: HEADERS }),
        ]);

        if (!statsRes.ok && !pctRes.ok) continue;

        // Parse both CSVs
        const statRows = statsRes.ok ? parseCSV(await statsRes.text()) : [];
        const pctRows  = pctRes.ok  ? parseCSV(await pctRes.text())  : [];

        // Find player in each
        const findPlayer = (rows) => rows.find(r =>
          String(r.player_id) === String(id) ||
          String(r.mlbam_id)  === String(id) ||
          String(r.batter)    === String(id) ||
          String(r.pitcher)   === String(id)
        );

        const statRow = findPlayer(statRows);
        const pctRow  = findPlayer(pctRows);

        if (!statRow && !pctRow) continue;

        // ── expected_statistics CSV columns (raw values):
        // Batter: player_id, est_ba, est_slg, est_woba, exit_velocity_avg,
        //         launch_angle_avg, barrel_batted_rate, hard_hit_percent,
        //         avg_best_speed, sweet_spot_percent
        // Pitcher: player_id, est_ba, est_slg, est_woba, exit_velocity_avg,
        //          launch_angle_avg, barrel_batted_rate, hard_hit_percent,
        //          xera (sometimes p_xera), ff_avg_speed, whiff_percent

        // ── percentile-rankings CSV columns (0–100 RANK values, NOT raw stats):
        // Each column IS the percentile rank for that metric.
        // Batter columns typically: xba, xslg, xwoba, exit_velocity, hard_hit,
        //   barrel, sprint_speed, strikeout_percent, walk_percent, etc.
        // Pitcher columns: xera, fastball_speed, whiff_percent, etc.

        // ── Sprint speed (separate leaderboard)
        let sprintVal = null, sprintPct = null;
        try {
          const sprintTxt = await fetch(
            `https://baseballsavant.mlb.com/leaderboard/sprint_speed?year=${yr}&position=&team=&min=10&csv=true`,
            { headers: HEADERS }
          ).then(r => r.ok ? r.text() : '');
          if (sprintTxt && !sprintTxt.trimStart().startsWith('<')) {
            const sRows = parseCSV(sprintTxt);
            const sp = sRows.find(r =>
              String(r.player_id) === String(id) || String(r.mlbam_id) === String(id)
            );
            if (sp) {
              // r_sprint_speed = actual ft/s value (~27-30 range)
              // hp_to_1b = home-to-first time in seconds — NOT what we want
              sprintVal = sp.r_sprint_speed ?? sp.sprint_speed ?? null;
              // percentile rank column
              sprintPct = numOrNull(sp.r_sprint_speed_pct ?? sp.sprint_speed_pct ?? sp.percentile ?? sp.pct_rank);
            }
          }
        } catch {}

        // ── OAA (outs above average)
        let oaaVal = null, oaaPct = null;
        try {
          const oaaTxt = await fetch(
            `https://baseballsavant.mlb.com/leaderboard/outs_above_average?type=Fielder&inn=&pos=&year=${yr}&team=&min=q&csv=true`,
            { headers: HEADERS }
          ).then(r => r.ok ? r.text() : '');
          if (oaaTxt && !oaaTxt.trimStart().startsWith('<')) {
            const oRows = parseCSV(oaaTxt);
            const op = oRows.find(r =>
              String(r.player_id) === String(id) || String(r.mlbam_id) === String(id)
            );
            if (op) {
              oaaVal = op.outs_above_average ?? op.oaa ?? null;
              oaaPct = numOrNull(op.outs_above_average_pct ?? op.oaa_pct ?? op.percentile);
            }
          }
        } catch {}

        const s = statRow ?? {};  // raw values
        const p = pctRow  ?? {};  // percentile ranks

        // Helper: get raw numeric value from stats row
        const raw = (...keys) => {
          for (const k of keys) {
            const v = s[k];
            if (v !== undefined && v !== '' && v !== 'null' && v !== 'NA') {
              const n = parseFloat(v);
              if (!isNaN(n)) return n;
            }
          }
          return null;
        };
        // Helper: get percentile rank (integer 0-100) from pct row
        const pct = (...keys) => {
          for (const k of keys) {
            const v = p[k];
            if (v !== undefined && v !== '' && v !== 'null' && v !== 'NA') {
              const n = parseFloat(v);
              if (!isNaN(n)) return Math.round(n);
            }
          }
          return null;
        };

        const fmtDec = (n, d) => n != null ? n.toFixed(d) : null;
        const fmtPct = (n) => n != null ? (n > 1 ? n.toFixed(1) : (n * 100).toFixed(1)) + '%' : null;

        if (type === 'batter') {
          return res.status(200).json({
            available: true, playerType: 'batter', season: yr,

            // ── RAW values (from expected_statistics CSV)
            xba:           fmtDec(raw('est_ba','xba_raw'), 3),
            xslg:          fmtDec(raw('est_slg','xslg_raw'), 3),
            xwoba:         fmtDec(raw('est_woba','xwoba_raw'), 3),
            exit_velocity: fmtDec(raw('exit_velocity_avg','avg_exit_velocity','avg_hit_speed'), 1),
            launch_angle:  fmtDec(raw('launch_angle_avg','avg_launch_angle'), 1),
            hard_hit:      fmtPct(raw('hard_hit_percent','hard_hit_rate')),
            barrel:        fmtPct(raw('barrel_batted_rate','barrel_rate','barrels_per_pa_percent')),
            sweet_spot:    fmtPct(raw('sweet_spot_percent')),
            sprint_speed:  sprintVal ? parseFloat(sprintVal).toFixed(1) : null,
            outs_above_avg: oaaVal,

            // ── PERCENTILE ranks (from percentile-rankings CSV — these ARE the 0-100 numbers)
            xba_pct:       pct('xba','est_ba_pct','expected_ba_pct'),
            xslg_pct:      pct('xslg','est_slg_pct','expected_slg_pct'),
            xwoba_pct:     pct('xwoba','est_woba_pct','expected_woba_pct'),
            ev_pct:        pct('exit_velocity','exit_velocity_avg_pct','ev_pct'),
            hard_hit_pct:  pct('hard_hit','hard_hit_percent_pct','hard_hit_pct'),
            barrel_pct:    pct('barrel','barrel_batted_rate_pct','barrel_pct'),
            avg_pct:       pct('batting_avg','batting_average','ba_pct','avg_pct'),
            obp_pct:       pct('on_base_percent','obp','obp_pct'),
            slg_pct:       pct('slg','slg_pct','slugging_pct'),
            ops_pct:       pct('on_base_plus_slg','ops','ops_pct'),
            k_pct:         pct('strikeout_percent','k_percent','so_pct','k_pct'),
            bb_pct:        pct('walk_percent','bb_percent','bb_pct'),
            sprint_pct:    sprintPct,
            oaa_pct:       oaaPct,
          });
        } else {
          return res.status(200).json({
            available: true, playerType: 'pitcher', season: yr,

            // ── RAW values
            xera:          fmtDec(raw('xera','p_xera','est_era'), 2),
            avg_fastball:  fmtDec(raw('ff_avg_speed','fastball_avg_speed','avg_fastball'), 1),
            whiff:         fmtPct(raw('whiff_percent','whiff_pct','swing_miss_pct')),
            exit_velocity: fmtDec(raw('exit_velocity_avg','avg_hit_speed'), 1),
            hard_hit:      fmtPct(raw('hard_hit_percent','hard_hit_rate')),
            barrel:        fmtPct(raw('barrel_batted_rate','barrel_rate')),
            xba:           fmtDec(raw('est_ba'), 3),
            xwoba:         fmtDec(raw('est_woba'), 3),

            // ── PERCENTILE ranks
            xera_pct:      pct('xera','p_xera_pct','est_era_pct'),
            velo_pct:      pct('fastball_speed','ff_avg_speed_pct','velo_pct'),
            whiff_pct:     pct('whiff_percent','whiff_pct_rank'),
            ev_pct:        pct('exit_velocity','exit_velocity_avg_pct'),
            hard_hit_pct:  pct('hard_hit','hard_hit_percent_pct'),
            barrel_pct:    pct('barrel','barrel_batted_rate_pct'),
            xba_pct:       pct('xba','est_ba_pct'),
            xwoba_pct:     pct('xwoba','est_woba_pct'),
            era_pct:       pct('era','era_pct','p_era_pct'),
            whip_pct:      pct('whip','whip_pct','p_whip_pct'),
            k9_pct:        pct('k_per_9','k9_pct','p_k_pct'),
            bb9_pct:       pct('bb_per_9','bb9_pct','p_bb_pct'),
          });
        }

      } catch { continue; }
    }
  }

  return res.status(200).json({ available: false });
}

function parseCSV(text) {
  if (!text || text.trimStart().startsWith('<')) return [];
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = parseLine(lines[0]).map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = parseLine(line);
    const row = {};
    headers.forEach((h, i) => { row[h] = (vals[i] ?? '').trim(); });
    return row;
  }).filter(r => Object.values(r).some(v => v !== ''));
}

function parseLine(line) {
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
  if (!v || v === '' || v === 'null' || v === 'NA') return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : Math.round(n);
}