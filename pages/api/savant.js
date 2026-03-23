// pages/api/savant.js
// Three Savant CSV endpoints merged:
//   /leaderboard/expected_statistics → xBA, xSLG, xwOBA (raw decimals)
//   /leaderboard/statcast            → exit velo, launch angle, hard hit%, barrel%, sweet spot%
//   /leaderboard/percentile-rankings → all percentile ranks (0-100 integers)
// Sprint speed and OAA come from their own separate endpoints.

export default async function handler(req, res) {
  const { id, year: yearParam, debug } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing player id' });

  const currentYear = new Date().getFullYear();
  const requestedYear = yearParam ? parseInt(yearParam) : null;
  const years = requestedYear ? [requestedYear] : [currentYear, currentYear - 1];

  for (const yr of years) {
    for (const type of ['batter', 'pitcher']) {
      try {
        const H = {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Referer': 'https://baseballsavant.mlb.com',
        };

        const [xstatTxt, statcastTxt, pctTxt] = await Promise.all([
          fetch(`https://baseballsavant.mlb.com/leaderboard/expected_statistics?type=${type}&year=${yr}&position=&team=&min=q&csv=true`, { headers: H }).then(r => r.ok ? r.text() : ''),
          fetch(`https://baseballsavant.mlb.com/leaderboard/statcast?type=${type}&year=${yr}&position=&team=&min=q&csv=true`, { headers: H }).then(r => r.ok ? r.text() : ''),
          fetch(`https://baseballsavant.mlb.com/leaderboard/percentile-rankings?type=${type}&year=${yr}&position=&team=&min=q&csv=true`, { headers: H }).then(r => r.ok ? r.text() : ''),
        ]);

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

        const xstatRow    = find(xstatTxt);
        const statcastRow = find(statcastTxt);
        const pctRow      = find(pctTxt);

        if (!xstatRow && !statcastRow && !pctRow) continue;

        // ── DEBUG: dump actual column names so we can fix lookup keys ──────────
        if (debug === '1') {
          const hdr = (txt) => {
            if (!txt || txt.trimStart().startsWith('<')) return [];
            return txt.trim().split('\n')[0].split(',').map(h => h.replace(/"/g,'').trim());
          };
          return res.status(200).json({
            type, yr,
            statcast_cols:  hdr(statcastTxt),
            xstat_cols:     hdr(xstatTxt),
            pct_cols:       hdr(pctTxt),
            statcast_row:   statcastRow,
            xstat_row:      xstatRow,
            pct_row:        pctRow,
          });
        }

        const vals = { ...(statcastRow ?? {}), ...(xstatRow ?? {}) };
        const pcts = pctRow ?? {};

        // Sprint speed
        let sprintVal = null, sprintPct = null;
        try {
          const stxt = await fetch(
            `https://baseballsavant.mlb.com/leaderboard/sprint_speed?year=${yr}&position=&team=&min=10&csv=true`,
            { headers: H }
          ).then(r => r.ok ? r.text() : '');
          const sp = find(stxt);
          if (sp) {
            sprintVal = sp.r_sprint_speed ?? sp.sprint_speed ?? null;
            const rawPct = numOrNull(sp.r_sprint_speed_pct ?? sp.sprint_speed_pct ?? sp.pct_rank ?? sp.percentile ?? sp.hp_to_1b_pct);
            if (rawPct !== null) {
              sprintPct = rawPct;
            } else if (sprintVal) {
              const sv = parseFloat(sprintVal);
              sprintPct = isNaN(sv) ? null
                : sv >= 30.0 ? 99 : sv >= 29.5 ? 97 : sv >= 29.0 ? 93
                : sv >= 28.5 ? 85 : sv >= 28.0 ? 74 : sv >= 27.5 ? 61
                : sv >= 27.0 ? 47 : sv >= 26.5 ? 34 : sv >= 26.0 ? 22
                : sv >= 25.5 ? 13 : sv >= 25.0 ? 7 : 3;
            }
          }
        } catch {}

        // OAA
        let oaaVal = null, oaaPct = null;
        try {
          const otxt = await fetch(
            `https://baseballsavant.mlb.com/leaderboard/outs_above_average?type=Fielder&inn=&pos=&year=${yr}&team=&min=q&csv=true`,
            { headers: H }
          ).then(r => r.ok ? r.text() : '');
          const op = find(otxt);
          if (op) {
            oaaVal = op.outs_above_average ?? op.oaa ?? null;
            const rawPct = numOrNull(op.outs_above_average_pct ?? op.oaa_pct ?? op.percentile ?? op.pct_rank ?? op.range_factor_pct);
            if (rawPct !== null) { oaaPct = rawPct; }
            else if (oaaVal !== null) {
              const o = parseInt(oaaVal);
              oaaPct = o >= 15 ? 99 : o >= 10 ? 95 : o >= 6 ? 88 : o >= 3 ? 75
                : o >= 1 ? 62 : o === 0 ? 50 : o >= -2 ? 38 : o >= -5 ? 25 : 8;
            }
          }
        } catch {}

        // Arm Strength
        let armVal = null, armPct = null;
        try {
          const armUrls = [
            `https://baseballsavant.mlb.com/leaderboard/arm-strength?pos=&year=${yr}&team=&min=0&csv=true`,
            `https://baseballsavant.mlb.com/leaderboard/arm-strength?type=Fielder&pos=&year=${yr}&team=&min=0&csv=true`,
            `https://baseballsavant.mlb.com/leaderboard/arm-strength?year=${yr}&csv=true`,
            `https://baseballsavant.mlb.com/leaderboard/arm_strength?pos=&year=${yr}&team=&min=0&csv=true`,
          ];
          let atxt = '';
          for (const url of armUrls) {
            const t = await fetch(url, { headers: H }).then(r => r.ok ? r.text() : '').catch(() => '');
            if (t && !t.trimStart().startsWith('<') && t.includes(',')) { atxt = t; break; }
          }
          if (atxt) {
            const ap = find(atxt);
            if (ap) {
              armVal = ap.arm_strength ?? ap.avg_arm_strength ?? ap.max_eff_vel ?? ap.pop_2b_sba ?? ap.arm_value ?? null;
              const rawPct = numOrNull(ap.arm_strength_pct ?? ap.percentile ?? ap.pct_rank ?? ap.arm_strength_percentile);
              if (rawPct !== null) { armPct = rawPct; }
              else if (armVal !== null) {
                const av = parseFloat(armVal);
                armPct = isNaN(av) ? null
                  : av >= 90 ? 99 : av >= 87 ? 95 : av >= 84 ? 88
                  : av >= 81 ? 78 : av >= 78 ? 65 : av >= 75 ? 50
                  : av >= 72 ? 36 : av >= 69 ? 23 : av >= 66 ? 12 : 5;
              }
            }
          }
        } catch {}

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

        // Sweet Spot
        const ssRaw = raw('sweet_spot_percent','la_sweet_spot_percent','sweet_spot_pct','sweet_spot','ss_percent','sweetspot_percent');
        const sweetSpotEstPct = ssRaw != null
          ? ssRaw >= 40 ? 90 : ssRaw >= 37 ? 80 : ssRaw >= 34 ? 65 : ssRaw >= 31 ? 50 : ssRaw >= 28 ? 35 : 20
          : null;

        // Launch Angle
        const laRaw = raw('launch_angle_avg','avg_launch_angle','la_avg','avg_la','launch_angle','la');
        const laDisplay = laRaw != null ? laRaw.toFixed(1) + '\u00b0' : null;
        const laEstPct = laRaw != null
          ? (laRaw >= 10 && laRaw <= 18) ? 85 : (laRaw >= 7 && laRaw <= 22) ? 65 : (laRaw >= 4 && laRaw <= 26) ? 45 : 25
          : null;

        if (type === 'batter') {
          return res.status(200).json({
            available: true, playerType: 'batter', season: yr,
            xba:           dec(raw('est_ba','xba'), 3),
            xslg:          dec(raw('est_slg','xslg'), 3),
            xwoba:         dec(raw('est_woba','xwoba'), 3),
            exit_velocity: dec(raw('avg_hit_speed','exit_velocity_avg','avg_exit_velocity','ev_avg'), 1),
            launch_angle:  laDisplay,
            hard_hit:      pctF(raw('hard_hit_percent','hard_hit_rate','hard_hit')),
            barrel:        pctF(raw('brl_pa','barrel_batted_rate','barrel_rate','brl_percent')),
            sweet_spot:    pctF(ssRaw),
            sprint_speed:  sprintVal ? parseFloat(sprintVal).toFixed(1) : null,
            outs_above_avg: oaaVal,
            arm_strength:  armVal ? parseFloat(armVal).toFixed(1) : null,
            xba_pct:           pct('xba','est_ba'),
            xslg_pct:          pct('xslg','est_slg'),
            xwoba_pct:         pct('xwoba','est_woba'),
            ev_pct:            pct('exit_velocity','exit_velocity_avg','avg_hit_speed','ev_avg'),
            hard_hit_pct:      pct('hard_hit','hard_hit_percent','hard_hit_rate'),
            barrel_pct:        pct('barrel','brl_pa','barrel_batted_rate','brl_percent','barrel_rate'),
            sweet_spot_pct:    pct('la_sweet_spot','sweet_spot','sweet_spot_percent','ss_percent') ?? sweetSpotEstPct,
            launch_angle_pct:  pct('launch_angle','avg_launch_angle','la_avg') ?? laEstPct,
            avg_pct:           pct('batting_avg','batting_average','ba','avg'),
            obp_pct:           pct('on_base_percent','obp','on_base_pct'),
            slg_pct:           pct('slg','slugging_pct'),
            ops_pct:           pct('on_base_plus_slg','ops'),
            k_pct:             pct('strikeout_percent','k_percent','strikeout_pct'),
            bb_pct:            pct('walk_percent','bb_percent','walk_pct'),
            sprint_pct:        sprintPct,
            oaa_pct:           oaaPct,
            arm_strength_pct:  armPct,
          });

        } else {
          // ── Pitcher raw values ──────────────────────────────────────────────
          // avg_fastball: statcast pitcher leaderboard columns confirmed variants
          const avgFastball = raw(
            'ff_avg_speed',          // most common
            'fastball_avg_speed',
            'avg_fastball',
            'p_ff_avg_speed',
            'ff_avg_speed',
            'velocity',
            'avg_speed',             // sometimes used in older CSVs
            'fastball_velocity',
            'release_speed',
          );

          // whiff%: statcast pitcher leaderboard
          const whiffRaw = raw(
            'whiff_percent',
            'p_whiff_percent',
            'whiff_pct',
            'swing_miss_pct',
            'swinging_strike_pct',
            'swstr_pct',
          );

          // hard hit% and barrel%: statcast pitcher leaderboard
          const hardHitRaw = raw(
            'hard_hit_percent',
            'hard_hit_rate',
            'hard_hit',
            'p_hard_hit_percent',
          );

          const barrelRaw = raw(
            'brl_pa',
            'barrel_batted_rate',
            'barrel_rate',
            'brl_percent',
            'p_brl_pa',
            'barrel',
            'brl_per_pa',
          );

          // ── Pitcher percentile lookups ──────────────────────────────────────
          // Savant percentile CSV for pitchers uses these key names (confirmed patterns)
          const veloP = pct(
            'fastball_speed',        // most common in percentile CSV
            'ff_avg_speed',
            'avg_fastball',
            'p_fastball_speed',
            'velocity',
          );

          const barrelP = pct(
            'barrel_batted_rate',    // confirmed key in pitcher percentile CSV
            'barrel',
            'brl_pa',
            'brl_percent',
            'brl_per_pa',
            'p_barrel',
            'p_brl_pa',
          );

          const hardHitP = pct(
            'hard_hit',
            'hard_hit_percent',
            'hard_hit_rate',
            'p_hard_hit',
          );

          const whiffP = pct(
            'whiff_percent',
            'p_whiff_percent',
            'whiff_pct',
            'swing_miss_pct',
          );

          return res.status(200).json({
            available: true, playerType: 'pitcher', season: yr,
            xera:          dec(raw('xera','p_xera','est_era'), 2),
            avg_fastball:  dec(avgFastball, 1),
            whiff:         pctF(whiffRaw),
            exit_velocity: dec(raw('avg_hit_speed','exit_velocity_avg','ev_avg'), 1),
            hard_hit:      pctF(hardHitRaw),
            barrel:        pctF(barrelRaw),
            xba:           dec(raw('est_ba','xba'), 3),
            xwoba:         dec(raw('est_woba','xwoba'), 3),
            xera_pct:      pct('xera','p_xera','est_era'),
            velo_pct:      veloP,
            whiff_pct:     whiffP,
            ev_pct:        pct('exit_velocity','exit_velocity_avg','avg_hit_speed'),
            hard_hit_pct:  hardHitP,
            barrel_pct:    barrelP,
            xba_pct:       pct('xba','est_ba'),
            xwoba_pct:     pct('xwoba','est_woba'),
            era_pct:       pct('era','p_era'),
            whip_pct:      pct('whip','p_whip'),
            k9_pct:        pct('k_per_9','k9','k_percent'),
            bb9_pct:       pct('bb_per_9','bb9','bb_percent'),
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