// pages/api/leaders.js
// All standard stats via MLB Stats API (reliable, all seasons 2000+)
// Velocity + movement via Baseball Savant pitch-arsenal-stats (stable CSV)

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/csv,text/plain,*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://baseballsavant.mlb.com/',
};

function parseCSV(text) {
  if (!text || !text.trim()) return [];
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.replace(/"/g,'').trim().toLowerCase());
  return lines.slice(1).map(line => {
    const vals = []; let cur = '', inQ = false;
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

function normMLB(leaders) {
  return (leaders ?? []).map((l, i) => ({
    rank:     l.rank ?? i + 1,
    name:     l.person?.fullName ?? '—',
    team:     l.team?.abbreviation ?? '—',
    teamId:   l.team?.id ?? null,
    playerId: l.person?.id ?? null,
    value:    l.value,
  }));
}

async function fetchMLBCat(cat, group, pool, season, limit = 10) {
  try {
    const url = `https://statsapi.mlb.com/api/v1/stats/leaders?leaderCategories=${cat}&season=${season}&limit=${limit}&sportId=1&statGroup=${group}&playerPool=${pool}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(7000) });
    if (!r.ok) return [];
    const d = await r.json();
    return normMLB(d.leagueLeaders?.[0]?.leaders ?? []);
  } catch { return []; }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=300');
  const season = parseInt(req.query.season ?? new Date().getFullYear(), 10);

  // ── Short-circuit: pitch movement by type (for Statcast leaders board) ────
  if (req.query.movement) {
    const pitchType = req.query.movement; // e.g. FF, SL, CU …
    try {
      const url = `https://baseballsavant.mlb.com/leaderboard/pitch-movement?season=${season}&team=&min=100&type=pitcher&pitch_type=${pitchType}&hand=&csv=true`;
      const r = await fetch(url, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(8000) });
      if (!r.ok) return res.status(502).json({ rows: [] });
      const text = await r.text();
      const parseName = row => {
        if (row['last_name'] && row['first_name']) return `${row['first_name'].trim()} ${row['last_name'].trim()}`;
        const raw = row['player_name'] ?? '';
        if (raw.includes(',')) { const [l,f] = raw.split(',').map(s=>s.trim()); return `${f} ${l}`; }
        return raw || '—';
      };
      const flt = (r, k) => { const v = parseFloat(r[k]); return isNaN(v) ? null : v; };
      const rows = parseCSV(text)
        .filter(r => flt(r, 'avg_break') !== null || flt(r, 'pitcher_break_z') !== null)
        .sort((a,b) => {
          const bv = Math.abs(flt(b,'avg_break') ?? flt(b,'pitcher_break_z') ?? 0);
          const av = Math.abs(flt(a,'avg_break') ?? flt(a,'pitcher_break_z') ?? 0);
          return bv - av;
        })
        .slice(0, 10)
        .map((r, i) => {
          const breakVal = flt(r,'avg_break') ?? flt(r,'pitcher_break_z') ?? 0;
          return {
            rank: i + 1,
            name: parseName(r),
            team: r['team_name_abbrev'] ?? r['team_abbrev'] ?? '—',
            playerId: r['player_id'] ? parseInt(r['player_id']) : null,
            value: `${Math.abs(breakVal).toFixed(1)}"`,
            sub: pitchType,
          };
        });
      return res.status(200).json({ rows });
    } catch (e) {
      return res.status(500).json({ rows: [], error: e.message });
    }
  }

  // ── MLB Stats API — all standard stats ────────────────────────────────────
  const [
    battingAverage, onBasePercentage, sluggingPercentage, onBasePlusSlugging,
    homeRuns, runsBattedIn, stolenBases, baseOnBalls, hits, totalBases,
    earnedRunAverage, walksAndHitsPerInningPitched, inningsPitched,
    strikeouts, wins, saves, holds,
    strikeoutsPer9Inn, baseOnBallsPer9Inn, strikeoutWalkRatio,
  ] = await Promise.all([
    fetchMLBCat('battingAverage',              'hitting',  'Qualified', season),
    fetchMLBCat('onBasePercentage',             'hitting',  'Qualified', season),
    fetchMLBCat('sluggingPercentage',           'hitting',  'Qualified', season),
    fetchMLBCat('onBasePlusSlugging',           'hitting',  'Qualified', season),
    fetchMLBCat('homeRuns',                     'hitting',  'All',       season),
    fetchMLBCat('runsBattedIn',                 'hitting',  'All',       season),
    fetchMLBCat('stolenBases',                  'hitting',  'All',       season),
    fetchMLBCat('baseOnBalls',                  'hitting',  'All',       season),
    fetchMLBCat('hits',                         'hitting',  'All',       season),
    fetchMLBCat('totalBases',                   'hitting',  'All',       season),
    fetchMLBCat('earnedRunAverage',             'pitching', 'Qualified', season),
    fetchMLBCat('walksAndHitsPerInningPitched', 'pitching', 'Qualified', season),
    fetchMLBCat('inningsPitched',               'pitching', 'All',       season),
    fetchMLBCat('strikeouts',                   'pitching', 'All',       season),
    fetchMLBCat('wins',                         'pitching', 'All',       season),
    fetchMLBCat('saves',                        'pitching', 'All',       season),
    fetchMLBCat('holds',                        'pitching', 'All',       season),
    fetchMLBCat('strikeoutsPer9Inn',            'pitching', 'Qualified', season),
    fetchMLBCat('baseOnBallsPer9Inn',           'pitching', 'Qualified', season),
    fetchMLBCat('strikeoutWalkRatio',           'pitching', 'Qualified', season),
  ]);

  // ── Baseball Savant — pitch arsenal only (stable endpoints) ───────────────
  let velo = [], movement = [];
  const savantAvailable = season >= 2017;

  if (savantAvailable) {
    const [veloRes, moveRes] = await Promise.all([
      fetch(
        `https://baseballsavant.mlb.com/leaderboard/pitch-arsenal-stats?type=pitcher&pitchType=FF&year=${season}&team=&min=50&sort=avg_speed&sortDir=desc&csv=true`,
        { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(8000) }
      ).catch(() => null),
      fetch(
        `https://baseballsavant.mlb.com/leaderboard/pitch-arsenal-stats?type=pitcher&pitchType=&year=${season}&team=&min=50&sort=avg_break&sortDir=desc&csv=true`,
        { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(8000) }
      ).catch(() => null),
    ]);

    const parseName = r => {
      // pitch-arsenal CSV uses last_name and first_name as separate columns
      if (r['last_name'] && r['first_name']) return `${r['first_name'].trim()} ${r['last_name'].trim()}`;
      // fallback: player_name as "Last, First"
      const raw = r['player_name'] ?? '';
      if (raw.includes(',')) { const [l,f] = raw.split(',').map(s=>s.trim()); return `${f} ${l}`; }
      return raw || '—';
    };
    const getId  = r => { const v = r['player_id']??''; return v ? parseInt(v) : null; };
    const getTeam = r => r['team_name_abbrev'] ?? r['team_abbrev'] ?? r['team'] ?? '—';
    const flt = (r, k) => { const v = parseFloat(r[k]); return isNaN(v) ? null : v; };

    if (veloRes?.ok) {
      const rows = parseCSV(await veloRes.text());
      velo = rows
        .filter(r => flt(r,'avg_speed') !== null)
        .sort((a,b) => (flt(b,'avg_speed')??0) - (flt(a,'avg_speed')??0))
        .slice(0,10)
        .map((r,i) => ({
          rank: i+1, name: parseName(r), team: getTeam(r),
          teamId: null, playerId: getId(r),
          value: `${flt(r,'avg_speed').toFixed(1)} mph`,
          sub: r['pitch_type_name'] ?? 'Fastball',
        }));
    }

    if (moveRes?.ok) {
      const rows = parseCSV(await moveRes.text());
      movement = rows
        .filter(r => flt(r,'avg_break') !== null)
        .sort((a,b) => (flt(b,'avg_break')??0) - (flt(a,'avg_break')??0))
        .slice(0,10)
        .map((r,i) => ({
          rank: i+1, name: parseName(r), team: getTeam(r),
          teamId: null, playerId: getId(r),
          value: `${flt(r,'avg_break').toFixed(1)}"`,
          sub: r['pitch_type_name'] ?? '',
        }));
    }
  }

  res.status(200).json({
    season, savantAvailable,
    // Batting
    battingAverage, onBasePercentage, sluggingPercentage, onBasePlusSlugging,
    homeRuns, runsBattedIn, stolenBases, baseOnBalls, hits, totalBases,
    // Pitching
    earnedRunAverage, walksAndHitsPerInningPitched, inningsPitched,
    strikeouts, wins, saves, holds,
    strikeoutsPer9Inn, baseOnBallsPer9Inn, strikeoutWalkRatio,
    // Statcast
    velo, movement,
  });
}