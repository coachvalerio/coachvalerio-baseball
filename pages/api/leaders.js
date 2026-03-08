// pages/api/leaders.js
// League leaders: MLB Stats API (standard) + Baseball Savant CSV (advanced/Statcast)
// Supports seasons 2000-present via ?season=YYYY

const safeFetch = async (url, timeout = 7000) => {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(timeout) });
    if (!r.ok) return null;
    return r;
  } catch { return null; }
};

// Parse Savant CSV text → array of objects
function parseCSV(text) {
  if (!text || !text.trim()) return [];
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
  return lines.slice(1).map(line => {
    // Handle quoted fields with commas
    const vals = [];
    let cur = '', inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    vals.push(cur.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
    return obj;
  });
}

// Normalize MLB Stats API leader list
function normMLB(leaders, valueKey = null) {
  return (leaders ?? []).map((l, i) => ({
    rank:     l.rank ?? i + 1,
    name:     l.person?.fullName ?? '—',
    team:     l.team?.abbreviation ?? l.team?.name?.split(' ').pop() ?? '—',
    teamId:   l.team?.id ?? null,
    playerId: l.person?.id ?? null,
    value:    valueKey ? l[valueKey] : l.value,
  }));
}

// Fetch one MLB Stats API leader category
async function fetchMLBCat(cat, group, pool, season, limit = 10) {
  const url = `https://statsapi.mlb.com/api/v1/stats/leaders?leaderCategories=${cat}&season=${season}&limit=${limit}&sportId=1&statGroup=${group}&playerPool=${pool}`;
  const r = await safeFetch(url);
  if (!r) return [];
  try {
    const d = await r.json();
    return normMLB(d.leagueLeaders?.[0]?.leaders ?? []);
  } catch { return []; }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=300');
  const season = parseInt(req.query.season ?? new Date().getFullYear(), 10);
  const savantAvailable = season >= 2015;

  // ── 1. MLB Stats API  (all seasons) ───────────────────────────────────────
  const [
    battingAverage, onBasePercentage, onBasePlusSlugging,
    homeRuns, runsBattedIn, stolenBases,
    earnedRunAverage, inningsPitched, walksAndHitsPerInningPitched,
    strikeouts, saves, holds, wins,
  ] = await Promise.all([
    fetchMLBCat('battingAverage',           'hitting',  'Qualified', season),
    fetchMLBCat('onBasePercentage',          'hitting',  'Qualified', season),
    fetchMLBCat('onBasePlusSlugging',        'hitting',  'Qualified', season),
    fetchMLBCat('homeRuns',                  'hitting',  'All',       season),
    fetchMLBCat('runsBattedIn',              'hitting',  'All',       season),
    fetchMLBCat('stolenBases',               'hitting',  'All',       season),
    fetchMLBCat('earnedRunAverage',          'pitching', 'Qualified', season),
    fetchMLBCat('inningsPitched',            'pitching', 'All',       season),
    fetchMLBCat('walksAndHitsPerInningPitched','pitching','Qualified', season),
    fetchMLBCat('strikeouts',                'pitching', 'All',       season),
    fetchMLBCat('saves',                     'pitching', 'All',       season),
    fetchMLBCat('holds',                     'pitching', 'All',       season),
    fetchMLBCat('wins',                      'pitching', 'All',       season),
  ]);

  // ── 2. Baseball Savant CSV  (2015+) ───────────────────────────────────────
  let batter_war = [], wrc_plus = [];
  let pitcher_war = [], xera = [], fip = [];
  let velo = [], movement = [];

  if (savantAvailable) {
    const batterCols = 'b_ab,b_pa,b_home_run,b_rbi,batting_avg,on_base_percent,slg_percent,on_base_plus_slg,woba,wrc_plus,war';
    const pitcherCols = 'p_game,p_formatted_ip,p_win,p_loss,p_save,p_earned_run_avg,p_whip,xera,fip,war';

    const [bRes, pRes, veloRes, moveRes] = await Promise.all([
      safeFetch(`https://baseballsavant.mlb.com/leaderboard/custom?year=${season}&type=batter&filter=&sort=4&sortDir=desc&min=q&selections=${batterCols}&csv=true`),
      safeFetch(`https://baseballsavant.mlb.com/leaderboard/custom?year=${season}&type=pitcher&filter=&sort=4&sortDir=desc&min=q&selections=${pitcherCols}&csv=true`),
      safeFetch(`https://baseballsavant.mlb.com/leaderboard/pitch-arsenal-stats?type=pitcher&pitchType=FF&year=${season}&team=&min=50&sort=avg_speed&sortDir=desc&csv=true`),
      safeFetch(`https://baseballsavant.mlb.com/leaderboard/pitch-arsenal-stats?type=pitcher&pitchType=&year=${season}&team=&min=50&sort=avg_break&sortDir=desc&csv=true`),
    ]);

    if (bRes) {
      const rows = parseCSV(await bRes.text());
      const toLeader = (rows, valFn, sortFn, asc = false) => {
        const sorted = [...rows].sort((a, b) => asc ? sortFn(a) - sortFn(b) : sortFn(b) - sortFn(a));
        return sorted.slice(0, 10).map((r, i) => ({
          rank: i + 1,
          name: `${r.first_name} ${r.last_name}`.trim(),
          team: r.team_name_abbrev ?? '—',
          teamId: null,
          playerId: r.player_id ? parseInt(r.player_id) : null,
          value: valFn(r),
        }));
      };
      batter_war = toLeader(rows, r => parseFloat(r.war)?.toFixed(1) ?? '—', r => parseFloat(r.war) || 0);
      wrc_plus   = toLeader(rows, r => r.wrc_plus ?? '—', r => parseFloat(r.wrc_plus) || 0);
    }

    if (pRes) {
      const rows = parseCSV(await pRes.text());
      const toLeaderP = (rows, valFn, sortFn, asc = false) => {
        const valid = rows.filter(r => sortFn(r) > 0 && sortFn(r) < 99);
        const sorted = [...valid].sort((a, b) => asc ? sortFn(a) - sortFn(b) : sortFn(b) - sortFn(a));
        return sorted.slice(0, 10).map((r, i) => ({
          rank: i + 1,
          name: `${r.first_name} ${r.last_name}`.trim(),
          team: r.team_name_abbrev ?? '—',
          teamId: null,
          playerId: r.player_id ? parseInt(r.player_id) : null,
          value: valFn(r),
        }));
      };
      pitcher_war = toLeaderP(rows, r => parseFloat(r.war)?.toFixed(1) ?? '—', r => parseFloat(r.war) || 0);
      xera        = toLeaderP(rows, r => parseFloat(r.xera)?.toFixed(2) ?? '—', r => parseFloat(r.xera) || 99, true);
      fip         = toLeaderP(rows, r => parseFloat(r.fip)?.toFixed(2) ?? '—',  r => parseFloat(r.fip)  || 99, true);
    }

    if (veloRes) {
      const rows = parseCSV(await veloRes.text());
      velo = rows
        .filter(r => parseFloat(r.avg_speed) > 0)
        .sort((a, b) => parseFloat(b.avg_speed) - parseFloat(a.avg_speed))
        .slice(0, 10)
        .map((r, i) => ({
          rank: i + 1,
          name: `${r.first_name} ${r.last_name}`.trim(),
          team: r.team_name_abbrev ?? '—',
          teamId: null,
          playerId: r.player_id ? parseInt(r.player_id) : null,
          value: `${parseFloat(r.avg_speed).toFixed(1)} mph`,
          sub: r.pitch_type_name ?? 'Fastball',
        }));
    }

    if (moveRes) {
      const rows = parseCSV(await moveRes.text());
      movement = rows
        .filter(r => parseFloat(r.avg_break) > 0)
        .sort((a, b) => parseFloat(b.avg_break) - parseFloat(a.avg_break))
        .slice(0, 10)
        .map((r, i) => ({
          rank: i + 1,
          name: `${r.first_name} ${r.last_name}`.trim(),
          team: r.team_name_abbrev ?? '—',
          teamId: null,
          playerId: r.player_id ? parseInt(r.player_id) : null,
          value: `${parseFloat(r.avg_break).toFixed(1)}"`,
          sub: r.pitch_type_name ?? '',
        }));
    }
  }

  res.status(200).json({
    season,
    savantAvailable,
    // Batting
    battingAverage, onBasePercentage, onBasePlusSlugging,
    homeRuns, runsBattedIn, stolenBases,
    wrc_plus, batter_war,
    // Pitching
    earnedRunAverage, inningsPitched, walksAndHitsPerInningPitched,
    strikeouts, saves, holds, wins,
    xera, fip, pitcher_war,
    // Statcast
    velo, movement,
  });
}