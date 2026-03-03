// pages/api/savant.js
// Fetches real Statcast percentile data from Baseball Savant's leaderboard CSV API
// No API key required — this is public data

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing player id' });

  try {
    // Baseball Savant percentile leaderboard — returns CSV with all players
    // We fetch the current season percentile rankings
    const year = new Date().getFullYear();
    const url = `https://baseballsavant.mlb.com/percentile-rankings?type=batter&year=${year}&position=&team=&min=q&player_id=${id}`;

    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CoachValerio/1.0)' }
    });

    if (!r.ok) {
      // Fallback: try pitcher endpoint
      const rp = await fetch(
        `https://baseballsavant.mlb.com/percentile-rankings?type=pitcher&year=${year}&position=&team=&min=q&player_id=${id}`,
        { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CoachValerio/1.0)' } }
      );
      if (!rp.ok) return res.status(200).json({ available: false });
      const html = await rp.text();
      const data = parseSavantHtml(html, id);
      return res.status(200).json({ available: true, ...data });
    }

    const html = await r.text();
    const data = parseSavantHtml(html, id);
    res.status(200).json({ available: true, ...data });

  } catch (err) {
    // Return empty — UI will show estimated percentiles
    res.status(200).json({ available: false, error: err.message });
  }
}

function parseSavantHtml(html, id) {
  // Savant embeds player percentile data in a JavaScript variable in the page
  // Pattern: {"player_id":592450,"xba":95,"xslg":99,...}
  const patterns = [
    /percentile_rankings\s*=\s*(\[.*?\])/s,
    /var\s+data\s*=\s*(\[.*?\]);/s,
    /"player_id"\s*:\s*\d+.*?"xba"\s*:\s*\d+/s,
  ];

  for (const pat of patterns) {
    const match = html.match(pat);
    if (match) {
      try {
        const arr = JSON.parse(match[1]);
        const player = arr.find(p => String(p.player_id) === String(id));
        if (player) return extractPercentiles(player);
      } catch {}
    }
  }

  // Try extracting JSON objects directly
  const jsonMatches = html.match(/\{"player_id":\d+[^}]+\}/g);
  if (jsonMatches) {
    for (const jm of jsonMatches) {
      try {
        const obj = JSON.parse(jm);
        if (String(obj.player_id) === String(id)) return extractPercentiles(obj);
      } catch {}
    }
  }

  return { available: false };
}

function extractPercentiles(p) {
  return {
    // Batting percentiles
    xba_pct:       p.xba        ?? null,
    xslg_pct:      p.xslg       ?? null,
    xwoba_pct:     p.xwoba      ?? null,
    xwobacon_pct:  p.xwobacon   ?? null,
    exit_velocity: p.exit_velocity_avg ?? null,
    ev_pct:        p.exit_velocity_avg_pct ?? null,
    launch_angle:  p.launch_angle_avg ?? null,
    hard_hit:      p.hard_hit_percent ?? null,
    hard_hit_pct:  p.hard_hit_percent_pct ?? null,
    barrel:        p.barrel_batted_rate ?? null,
    barrel_pct:    p.barrel_batted_rate_pct ?? null,
    sprint_speed:  p.sprint_speed ?? null,
    sprint_pct:    p.sprint_speed_pct ?? null,
    k_pct:         p.strikeout_pct_pct ?? null,   // note: lower=better, savant inverts
    bb_pct:        p.walk_pct_pct ?? null,
    avg_pct:       p.batting_avg_pct ?? null,
    obp_pct:       p.on_base_pct_pct ?? null,
    slg_pct:       p.slg_pct_pct ?? null,
    ops_pct:       p.on_base_plus_slg_pct ?? null,
    hr_pct:        p.home_run_pct ?? null,
    outs_above_avg: p.outs_above_average ?? null,
    oaa_pct:       p.outs_above_average_pct ?? null,

    // Pitching percentiles
    xera_pct:      p.p_era_pct   ?? null,
    xera:          p.p_xera      ?? null,
    whiff_pct:     p.whiff_percent_pct ?? null,
    whiff:         p.whiff_percent ?? null,
    csw_pct:       p.csw_pct     ?? null,
    csw:           p.csw         ?? null,
    avg_fastball:  p.ff_avg_speed ?? null,
    velo_pct:      p.ff_avg_speed_pct ?? null,
    spin_rate:     p.ff_avg_spin ?? null,
    spin_pct:      p.ff_avg_spin_pct ?? null,
    extension:     p.release_extension ?? null,
    ext_pct:       p.release_extension_pct ?? null,
    chase_rate:    p.oz_swing_percent ?? null,
    chase_pct:     p.oz_swing_percent_pct ?? null,
    era_pct:       p.p_era_pct   ?? null,
    whip_pct:      p.p_whip_pct  ?? null,
    k9_pct:        p.p_k_pct     ?? null,
    bb9_pct:       p.p_bb_pct    ?? null,
  };
}