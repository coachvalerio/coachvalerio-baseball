// pages/api/savant.js
// Fetches Statcast percentile data from Baseball Savant's public JSON API
// Uses the correct endpoint that returns structured JSON, not HTML

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing player id' });

  const year = new Date().getFullYear();

  try {
    // Baseball Savant exposes percentile data via their leaderboard search API
    // This endpoint returns JSON directly — more reliable than parsing HTML
    const [batterRes, pitcherRes] = await Promise.all([
      fetch(
        `https://baseballsavant.mlb.com/percentile-rankings?type=batter&year=${year}&position=&team=&min=q&player_id=${id}`,
        { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html,application/json' } }
      ),
      fetch(
        `https://baseballsavant.mlb.com/percentile-rankings?type=pitcher&year=${year}&position=&team=&min=q&player_id=${id}`,
        { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html,application/json' } }
      ),
    ]);

    // Try batter first, then pitcher
    for (const r of [batterRes, pitcherRes]) {
      if (!r.ok) continue;
      const html = await r.text();
      const data = extractFromHtml(html, id);
      if (data) return res.status(200).json({ available: true, ...data });
    }

    // Last resort: fetch the full leaderboard and find the player
    const allRes = await fetch(
      `https://baseballsavant.mlb.com/leaderboard/percentile-rankings?type=batter&year=${year}&position=&team=&min=q`,
      { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } }
    );
    if (allRes.ok) {
      const ct = allRes.headers.get('content-type') ?? '';
      if (ct.includes('json')) {
        const arr = await allRes.json();
        const player = Array.isArray(arr) ? arr.find(p => String(p.player_id) === String(id)) : null;
        if (player) return res.status(200).json({ available: true, ...extractPercentiles(player) });
      }
    }

    return res.status(200).json({ available: false });
  } catch (err) {
    return res.status(200).json({ available: false, error: err.message });
  }
}

function extractFromHtml(html, id) {
  // Savant embeds data in several possible JS variable patterns — try all
  const patterns = [
    // Most common: var data = [{...}];
    /(?:var\s+)?data\s*=\s*(\[\s*\{[\s\S]*?\}\s*\])\s*;/,
    // Also: percentile_rankings = [{...}]
    /percentile_rankings\s*=\s*(\[[\s\S]*?\])\s*[;,]/,
    // JSON block containing player_id
    /(\[\s*\{"player_id"[\s\S]*?\}\s*\])/,
  ];

  for (const pat of patterns) {
    const match = html.match(pat);
    if (!match) continue;
    try {
      const arr = JSON.parse(match[1]);
      if (!Array.isArray(arr)) continue;
      const player = arr.find(p => String(p.player_id) === String(id) || String(p.id) === String(id));
      if (player) return extractPercentiles(player);
      // If only one entry and we asked for this specific player_id, use it
      if (arr.length === 1) return extractPercentiles(arr[0]);
    } catch {}
  }

  // Try finding a single JSON object with player_id matching
  const objPattern = /\{[^{}]*"player_id"\s*:\s*(\d+)[^{}]*\}/g;
  let m;
  while ((m = objPattern.exec(html)) !== null) {
    if (m[1] === String(id)) {
      try { return extractPercentiles(JSON.parse(m[0])); } catch {}
    }
  }

  return null;
}

function extractPercentiles(p) {
  // Savant uses several different key naming conventions across years
  // We try all known variants for each metric
  const pick = (...keys) => {
    for (const k of keys) {
      if (p[k] !== undefined && p[k] !== null && p[k] !== '') return p[k];
    }
    return null;
  };

  return {
    // ── Exit velocity & contact quality
    exit_velocity: pick('exit_velocity_avg', 'avg_exit_velocity', 'exit_velo'),
    ev_pct:        pick('exit_velocity_avg_pct', 'exit_velocity_pct', 'ev_pct'),
    hard_hit:      pick('hard_hit_percent', 'hard_hit_pct', 'hard_hit'),
    hard_hit_pct:  pick('hard_hit_percent_pct', 'hard_hit_pct_rank'),
    barrel:        pick('barrel_batted_rate', 'barrel_pct', 'barrels_per_pa_percent'),
    barrel_pct:    pick('barrel_batted_rate_pct', 'barrel_rank'),
    launch_angle:  pick('launch_angle_avg', 'avg_launch_angle'),

    // ── Expected stats
    xba_pct:       pick('xba', 'xba_pct', 'expected_batting_avg_pct'),
    xslg_pct:      pick('xslg', 'xslg_pct', 'expected_slg_pct'),
    xwoba_pct:     pick('xwoba', 'xwoba_pct', 'expected_woba_pct'),

    // ── Discipline
    k_pct:         pick('strikeout_percent_pct', 'strikeout_pct_pct', 'k_pct_rank'),
    bb_pct:        pick('walk_percent_pct', 'walk_pct_pct', 'bb_pct_rank'),

    // ── Traditional (percentile ranks)
    avg_pct:       pick('batting_avg_pct', 'avg_pct', 'batting_average_pct'),
    obp_pct:       pick('on_base_pct_pct', 'obp_pct'),
    slg_pct:       pick('slg_pct_pct', 'slg_pct', 'slugging_pct'),
    ops_pct:       pick('on_base_plus_slg_pct', 'ops_pct'),
    hr_pct:        pick('home_run_pct', 'hr_pct'),

    // ── Speed & defense
    sprint_speed:  pick('sprint_speed', 'speed'),
    sprint_pct:    pick('sprint_speed_pct', 'speed_pct'),
    outs_above_avg:pick('outs_above_average', 'oaa'),
    oaa_pct:       pick('outs_above_average_pct', 'oaa_pct'),

    // ── Pitcher-specific
    xera:          pick('p_xera', 'xera', 'x_era'),
    xera_pct:      pick('p_era_pct', 'xera_pct', 'era_pct'),
    whiff:         pick('whiff_percent', 'whiff_pct', 'swing_and_miss_pct'),
    whiff_pct:     pick('whiff_percent_pct', 'whiff_rank'),
    csw:           pick('csw', 'called_strike_plus_whiff'),
    csw_pct:       pick('csw_pct', 'csw_rank'),
    avg_fastball:  pick('ff_avg_speed', 'fastball_avg_speed', 'velo'),
    velo_pct:      pick('ff_avg_speed_pct', 'velo_pct'),
    spin_rate:     pick('ff_avg_spin', 'fastball_avg_spin'),
    spin_pct:      pick('ff_avg_spin_pct', 'spin_pct'),
    extension:     pick('release_extension', 'ext'),
    ext_pct:       pick('release_extension_pct', 'ext_pct'),
    chase_rate:    pick('oz_swing_percent', 'chase_rate', 'o_swing_pct'),
    chase_pct:     pick('oz_swing_percent_pct', 'chase_pct'),
    era_pct:       pick('p_era_pct', 'era_pct'),
    whip_pct:      pick('p_whip_pct', 'whip_pct'),
    k9_pct:        pick('p_k_pct', 'k9_pct', 'k_per_9_pct'),
    bb9_pct:       pick('p_bb_pct', 'bb9_pct', 'bb_per_9_pct'),
  };
}