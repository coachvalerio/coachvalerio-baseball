// pages/api/savant.js
// Three Savant CSV endpoints merged:
//   /leaderboard/expected_statistics → xBA, xSLG, xwOBA (raw decimals)
//   /leaderboard/statcast            → exit velo, launch angle, hard hit%, barrel%, sweet spot%
//   /leaderboard/percentile-rankings → all percentile ranks (0-100 integers)
// Sprint speed and OAA come from their own separate endpoints.

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing player id' });

  const year  = new Date().getFullYear();
  const years = [year, year - 1];

  for (const yr of years) {
    for (const type of ['batter', 'pitcher']) {
      try {
        const H = {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Referer': 'https://baseballsavant.mlb.com',
        };

        // ── 1. Fetch all three stat CSVs in parallel
        const [xstatTxt, statcastTxt, pctTxt] = await Promise.all([
          fetch(`https://baseballsavant.mlb.com/leaderboard/expected_statistics?type=${type}&year=${yr}&position=&team=&min=q&csv=true`, { headers: H }).then(r => r.ok ? r.text() : ''),
          fetch(`https://baseballsavant.mlb.com/leaderboard/statcast?type=${type}&year=${yr}&position=&team=&min=q&csv=true`, { headers: H }).then(r => r.ok ? r.text() : ''),
          fetch(`https://baseballsavant.mlb.com/leaderboard/percentile-rankings?type=${type}&year=${yr}&position=&team=&min=q&csv=true`, { headers: H }).then(r => r.ok ? r.text() : ''),
        ]);

        // ── 2. Parse CSVs and find this player in each
        const find = (txt) => {
          if (!txt || txt.trimStart().startsWith('<')) return null;
          const rows = parseCSV(txt);
          return rows.find(r =>
            String(r.player_id) === String(id) ||
            String(r.mlbam_id)  === String(id) ||
            String(r.batter)    === String(id) ||
            String(r.pitcher)   === String(id)
          ) ?? null;
        };

        const xstatRow    = find(xstatTxt);    // expected stats (xBA/xSLG/xwOBA)
        const statcastRow = find(statcastTxt); // statcast (EV/LA/HH%/barrel%/sweet spot%)
        const pctRow      = find(pctTxt);      // percentile ranks

        if (!xstatRow && !statcastRow && !pctRow) continue;

        // Merge all raw-value rows — statcast base, xstat overrides for expected stats
        const vals = { ...(statcastRow ?? {}), ...(xstatRow ?? {}) };
        const pcts = pctRow ?? {};

        // ── 3. Sprint speed (separate endpoint)
        let sprintVal = null, sprintPct = null;
        try {
          const stxt = await fetch(
            `https://baseballsavant.mlb.com/leaderboard/sprint_speed?year=${yr}&position=&team=&min=10&csv=true`,
            { headers: H }
          ).then(r => r.ok ? r.text() : '');
          const sp = find(stxt);
          if (sp) {
            sprintVal = sp.r_sprint_speed ?? sp.sprint_speed ?? null;
            const rawPct = numOrNull(sp.r_sprint_speed_pct ?? sp.sprint_speed_pct ?? sp.pct_rank ?? sp.percentile);
            if (rawPct !== null) {
              sprintPct = rawPct;
            } else if (sprintVal) {
              const sv = parseFloat(sprintVal);
              sprintPct = isNaN(sv) ? null
                : sv >= 29.5 ? 99 : sv >= 29.0 ? 95 : sv >= 28.5 ? 90
                : sv >= 28.0 ? 80 : sv >= 27.5 ? 70 : sv >= 27.0 ? 55
                : sv >= 26.5 ? 40 : sv >= 26.0 ? 28 : sv >= 25.5 ? 18 : 8;
            }
          }
        } catch {}

        // ── 4. Outs Above Average (separate endpoint)
        let oaaVal = null, oaaPct = null;
        try {
          const otxt = await fetch(
            `https://baseballsavant.mlb.com/leaderboard/outs_above_average?type=Fielder&inn=&pos=&year=${yr}&team=&min=q&csv=true`,
            { headers: H }
          ).then(r => r.ok ? r.text() : '');
          const op = find(otxt);
          if (op) {
            oaaVal = op.outs_above_average ?? op.oaa ?? null;
            const rawPct = numOrNull(op.outs_above_average_pct ?? op.oaa_pct ?? op.percentile ?? op.pct_rank);
            if (rawPct !== null) {
              oaaPct = rawPct;
            } else if (oaaVal !== null) {
              const o = parseInt(oaaVal);
              oaaPct = o >= 15 ? 99 : o >= 10 ? 95 : o >= 6 ? 88 : o >= 3 ? 75
                : o >= 1 ? 62 : o === 0 ? 50 : o >= -2 ? 38 : o >= -5 ? 25 : 8;
            }
          }
        } catch {}

        // ── 5. Helper: read raw numeric value from merged vals object
        const raw = (...keys) => {
          for (const k of keys) {
            const v = vals[k];
            if (v !== undefined && v !== '' && v !== 'null' && v !== 'NA') {
              const n = parseFloat(v);
              if (!isNaN(n)) return n;
            }
          }
          return null;
        };

        // Helper: read percentile rank (0-100 int) from pcts object
        const pct = (...keys) => {
          for (const k of keys) {
            const v = pcts[k];
            if (v !== undefined && v !== '' && v !== 'null' && v !== 'NA') {
              const n = parseFloat(v);
              if (!isNaN(n)) return Math.round(n);
            }
          }
          return null;
        };

        const dec  = (n, d) => n != null ? n.toFixed(d) : null;
        const pctF = (n) => n != null ? (n > 1 ? n : n * 100).toFixed(1) + '%' : null;

        // ── 6. Compute estimated percentiles for metrics Savant doesn't rank
        // Sweet Spot% — MLB avg ~33%, elite ~40%+
        const ssRaw = raw('sweet_spot_percent', 'sweet_spot', 'sweet_spot_pct', 'ss_percent');
        const sweetSpotPct = ssRaw != null
          ? ssRaw >= 40 ? 90 : ssRaw >= 37 ? 80 : ssRaw >= 34 ? 65
          : ssRaw >= 31 ? 50 : ssRaw >= 28 ? 35 : 20
          : null;

        // Launch Angle — optimal is 10–18°, MLB avg ~12–14°
        const laRaw = raw('avg_launch_angle', 'launch_angle_avg', 'la_avg', 'avg_la', 'launch_angle');
        const laDisplay = laRaw != null ? laRaw.toFixed(1) + '\u00b0' : null;
        const laPct = laRaw != null
          ? (laRaw >= 10 && laRaw <= 18) ? 85
          : (laRaw >= 7  && laRaw <= 22) ? 65
          : (laRaw >= 4  && laRaw <= 26) ? 45
          : 25
          : null;

        // ── 7. Build and return response
        if (type === 'batter') {
          return res.status(200).json({
            available: true, playerType: 'batter', season: yr,

            // Raw displayed values
            xba:           dec(raw('est_ba', 'xba'), 3),
            xslg:          dec(raw('est_slg', 'xslg'), 3),
            xwoba:         dec(raw('est_woba', 'xwoba'), 3),
            exit_velocity: dec(raw('avg_hit_speed', 'exit_velocity_avg', 'avg_exit_velocity', 'ev_avg'), 1),
            launch_angle:  laDisplay,
            hard_hit:      pctF(raw('hard_hit_percent', 'hard_hit_rate', 'hard_hit')),
            barrel:        pctF(raw('brl_pa', 'barrel_batted_rate', 'barrel_rate', 'brl_percent')),
            sweet_spot:    pctF(ssRaw),
            sprint_speed:  sprintVal ? parseFloat(sprintVal).toFixed(1) : null,
            outs_above_avg: oaaVal,

            // Percentile ranks — from Savant CSV where available, estimated otherwise
            xba_pct:        pct('xba', 'est_ba'),
            xslg_pct:       pct('xslg', 'est_slg'),
            xwoba_pct:      pct('xwoba', 'est_woba'),
            ev_pct:         pct('exit_velocity', 'exit_velocity_avg', 'avg_hit_speed', 'ev_avg'),
            hard_hit_pct:   pct('hard_hit', 'hard_hit_percent', 'hard_hit_rate'),
            barrel_pct:     pct('barrel', 'brl_pa', 'barrel_batted_rate'),
            sweet_spot_pct: sweetSpotPct,
            launch_angle_pct: laPct,
            avg_pct:        pct('batting_avg', 'batting_average', 'ba', 'avg'),
            obp_pct:        pct('on_base_percent', 'obp', 'on_base_pct'),
            slg_pct:        pct('slg', 'slugging_pct'),
            ops_pct:        pct('on_base_plus_slg', 'ops'),
            k_pct:          pct('strikeout_percent', 'k_percent', 'strikeout_pct'),
            bb_pct:         pct('walk_percent', 'bb_percent', 'walk_pct'),
            sprint_pct:     sprintPct,
            oaa_pct:        oaaPct,
          });

        } else {
          return res.status(200).json({
            available: true, playerType: 'pitcher', season: yr,

            // Raw values
            xera:          dec(raw('xera', 'p_xera', 'est_era'), 2),
            avg_fastball:  dec(raw('ff_avg_speed', 'fastball_avg_speed', 'avg_fastball'), 1),
            whiff:         pctF(raw('whiff_percent', 'whiff_pct', 'swing_miss_pct')),
            exit_velocity: dec(raw('avg_hit_speed', 'exit_velocity_avg', 'ev_avg'), 1),
            hard_hit:      pctF(raw('hard_hit_percent', 'hard_hit_rate', 'hard_hit')),
            barrel:        pctF(raw('brl_pa', 'barrel_batted_rate', 'barrel_rate', 'brl_percent')),
            xba:           dec(raw('est_ba', 'xba'), 3),
            xwoba:         dec(raw('est_woba', 'xwoba'), 3),

            // Percentile ranks
            xera_pct:      pct('xera', 'p_xera', 'est_era'),
            velo_pct:      pct('fastball_speed', 'ff_avg_speed', 'avg_fastball'),
            whiff_pct:     pct('whiff_percent', 'whiff_pct'),
            ev_pct:        pct('exit_velocity', 'exit_velocity_avg', 'avg_hit_speed'),
            hard_hit_pct:  pct('hard_hit', 'hard_hit_percent', 'hard_hit_rate'),
            barrel_pct:    pct('barrel', 'brl_pa', 'barrel_batted_rate'),
            xba_pct:       pct('xba', 'est_ba'),
            xwoba_pct:     pct('xwoba', 'est_woba'),
            era_pct:       pct('era', 'p_era'),
            whip_pct:      pct('whip', 'p_whip'),
            k9_pct:        pct('k_per_9', 'k9', 'k_percent'),
            bb9_pct:       pct('bb_per_9', 'bb9', 'bb_percent'),
          });
        }

      } catch { continue; }
    }
  }

  return res.status(200).json({ available: false });
}

// ── CSV parser — handles quoted fields with embedded commas
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