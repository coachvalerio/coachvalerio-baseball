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
    // Savant custom leaderboard CSV columns we actually need
    const batterCols  = 'wrc_plus,war';
    const pitcherCols = 'p_era,p_whip,xera,fip,war';

    const [bRes, pRes, veloRes, moveRes] = await Promise.all([
      safeFetch(`https://baseballsavant.mlb.com/leaderboard/custom?year=${season}&type=batter&filter=&sort=wrc_plus&sortDir=desc&min=q&selections=${batterCols}&csv=true`),
      safeFetch(`https://baseballsavant.mlb.com/leaderboard/custom?year=${season}&type=pitcher&filter=&sort=p_era&sortDir=asc&min=q&selections=${pitcherCols}&csv=true`),
      safeFetch(`https://baseballsavant.mlb.com/leaderboard/pitch-arsenal-stats?type=pitcher&pitchType=FF&year=${season}&team=&min=50&sort=avg_speed&sortDir=desc&csv=true`),
      safeFetch(`https://baseballsavant.mlb.com/leaderboard/pitch-arsenal-stats?type=pitcher&pitchType=&year=${season}&team=&min=50&sort=avg_break&sortDir=desc&csv=true`),
    ]);

    // Helper: Savant CSVs use "last_name, first_name" in player_name column
    // player_id is a separate numeric column
    const parseName = r => {
      // player_name format: "Last, First" — convert to "First Last"
      const raw = r['player_name'] ?? r['name'] ?? '';
      if (raw.includes(',')) {
        const [last, first] = raw.split(',').map(s => s.trim());
        return `${first} ${last}`.trim();
      }
      return raw || '—';
    };
    const getId  = r => {
      const id = r['player_id'] ?? r['xba_player_id'] ?? '';
      return id ? parseInt(id) : null;
    };
    const getTeam = r => r['team_name_abbrev'] ?? r['team'] ?? '—';

    // Case-insensitive column lookup (Savant uses inconsistent casing)
    const col = (r, key) => {
      if (r[key] !== undefined) return r[key];
      const lower = key.toLowerCase();
      const found = Object.keys(r).find(k => k.toLowerCase() === lower);
      return found ? r[found] : undefined;
    };

    if (bRes) {
      const rows = parseCSV(await bRes.text()).filter(r => parseName(r) !== '—');

      const makeLeader = (sorted, valFn) =>
        sorted.slice(0, 10).map((r, i) => ({
          rank: i + 1,
          name: parseName(r),
          team: getTeam(r),
          teamId: null,
          playerId: getId(r),
          value: valFn(r),
        }));

      const byWrc = [...rows].sort((a,b) => (parseFloat(col(b,'wrc_plus'))||0) - (parseFloat(col(a,'wrc_plus'))||0));
      wrc_plus = makeLeader(byWrc, r => {
        const v = parseFloat(col(r,'wrc_plus'));
        return isNaN(v) ? '—' : Math.round(v).toString();
      });

      const byWar = [...rows].sort((a,b) => (parseFloat(col(b,'war'))||0) - (parseFloat(col(a,'war'))||0));
      batter_war = makeLeader(byWar, r => {
        const v = parseFloat(col(r,'war'));
        return isNaN(v) ? '—' : v.toFixed(1);
      });
    }

    if (pRes) {
      const rows = parseCSV(await pRes.text()).filter(r => parseName(r) !== '—');

      const makeLeaderP = (sorted, valFn) =>
        sorted.slice(0, 10).map((r, i) => ({
          rank: i + 1,
          name: parseName(r),
          team: getTeam(r),
          teamId: null,
          playerId: getId(r),
          value: valFn(r),
        }));

      const byXera = [...rows]
        .filter(r => parseFloat(col(r,'xera')) > 0)
        .sort((a,b) => (parseFloat(col(a,'xera'))||99) - (parseFloat(col(b,'xera'))||99));
      xera = makeLeaderP(byXera, r => {
        const v = parseFloat(col(r,'xera'));
        return isNaN(v) ? '—' : v.toFixed(2);
      });

      const byFip = [...rows]
        .filter(r => parseFloat(col(r,'fip')) > 0)
        .sort((a,b) => (parseFloat(col(a,'fip'))||99) - (parseFloat(col(b,'fip'))||99));
      fip = makeLeaderP(byFip, r => {
        const v = parseFloat(col(r,'fip'));
        return isNaN(v) ? '—' : v.toFixed(2);
      });

      const byWarP = [...rows].sort((a,b) => (parseFloat(col(b,'war'))||0) - (parseFloat(col(a,'war'))||0));
      pitcher_war = makeLeaderP(byWarP, r => {
        const v = parseFloat(col(r,'war'));
        return isNaN(v) ? '—' : v.toFixed(1);
      });
    }

    if (veloRes) {
      const rows = parseCSV(await veloRes.text());
      velo = rows
        .filter(r => parseFloat(col(r,'avg_speed')) > 0)
        .sort((a,b) => parseFloat(col(b,'avg_speed')) - parseFloat(col(a,'avg_speed')))
        .slice(0, 10)
        .map((r, i) => ({
          rank: i + 1,
          name: parseName(r),
          team: getTeam(r),
          teamId: null,
          playerId: getId(r),
          value: `${parseFloat(col(r,'avg_speed')).toFixed(1)} mph`,
          sub: col(r,'pitch_type_name') ?? 'Fastball',
        }));
    }

    if (moveRes) {
      const rows = parseCSV(await moveRes.text());
      movement = rows
        .filter(r => parseFloat(col(r,'avg_break')) > 0)
        .sort((a,b) => parseFloat(col(b,'avg_break')) - parseFloat(col(a,'avg_break')))
        .slice(0, 10)
        .map((r, i) => ({
          rank: i + 1,
          name: parseName(r),
          team: getTeam(r),
          teamId: null,
          playerId: getId(r),
          value: `${parseFloat(col(r,'avg_break')).toFixed(1)}"`,
          sub: col(r,'pitch_type_name') ?? '',
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