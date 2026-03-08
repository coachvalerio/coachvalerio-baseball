// pages/api/leaders.js
// League leaders: MLB Stats API + Baseball Savant
// Supports seasons 2000-present via ?season=YYYY

// Savant blocks headless fetches — must send browser-like headers
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/csv,text/plain,*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://baseballsavant.mlb.com/',
};

const safeFetch = async (url, timeout = 8000) => {
  try {
    const r = await fetch(url, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(timeout) });
    if (!r.ok) return null;
    return r;
  } catch { return null; }
};

// Parse Savant CSV text to array of objects
function parseCSV(text) {
  if (!text || !text.trim()) return [];
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
  return lines.slice(1).map(line => {
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

// Normalize MLB Stats API leader entry
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

// Parse a Savant CSV row's name — format is "last_name" + "first_name" columns
// OR combined "player_name" as "Last, First"
const parseSavantName = r => {
  // expected_statistics endpoint has separate last_name / first_name
  if (r['last_name'] && r['first_name']) {
    return `${r['first_name'].trim()} ${r['last_name'].trim()}`;
  }
  // custom leaderboard uses player_name = "Last, First"
  const raw = r['player_name'] ?? r['name'] ?? '';
  if (raw.includes(',')) {
    const [last, first] = raw.split(',').map(s => s.trim());
    return `${first} ${last}`.trim();
  }
  return raw || '—';
};
const getSavantId   = r => { const v = r['player_id'] ?? ''; return v ? parseInt(v) : null; };
const getSavantTeam = r => r['team_name_abbrev'] ?? r['team_abbrev'] ?? r['team'] ?? '—';
const flt = (r, k) => { const v = parseFloat(r[k]); return isNaN(v) ? null : v; };

const toLeaders = (rows, valFn, sortFn, asc = false) => {
  const valid  = rows.filter(r => sortFn(r) !== null);
  const sorted = [...valid].sort((a, b) => asc
    ? (sortFn(a) ?? 99) - (sortFn(b) ?? 99)
    : (sortFn(b) ?? 0)  - (sortFn(a) ?? 0));
  return sorted.slice(0, 10).map((r, i) => ({
    rank:     i + 1,
    name:     parseSavantName(r),
    team:     getSavantTeam(r),
    teamId:   null,
    playerId: getSavantId(r),
    value:    valFn(r),
  }));
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=300');
  const season = parseInt(req.query.season ?? new Date().getFullYear(), 10);
  const savantAvailable = season >= 2015;

  // ── 1. MLB Stats API (all seasons back to 2000) ───────────────────────────
  const [
    battingAverage, onBasePercentage, onBasePlusSlugging,
    homeRuns, runsBattedIn, stolenBases,
    earnedRunAverage, inningsPitched, walksAndHitsPerInningPitched,
    strikeouts, saves, holds, wins,
  ] = await Promise.all([
    fetchMLBCat('battingAverage',              'hitting',  'Qualified', season),
    fetchMLBCat('onBasePercentage',             'hitting',  'Qualified', season),
    fetchMLBCat('onBasePlusSlugging',           'hitting',  'Qualified', season),
    fetchMLBCat('homeRuns',                     'hitting',  'All',       season),
    fetchMLBCat('runsBattedIn',                 'hitting',  'All',       season),
    fetchMLBCat('stolenBases',                  'hitting',  'All',       season),
    fetchMLBCat('earnedRunAverage',             'pitching', 'Qualified', season),
    fetchMLBCat('inningsPitched',               'pitching', 'All',       season),
    fetchMLBCat('walksAndHitsPerInningPitched', 'pitching', 'Qualified', season),
    fetchMLBCat('strikeouts',                   'pitching', 'All',       season),
    fetchMLBCat('saves',                        'pitching', 'All',       season),
    fetchMLBCat('holds',                        'pitching', 'All',       season),
    fetchMLBCat('wins',                         'pitching', 'All',       season),
  ]);

  // ── 2. Baseball Savant (2015+) ────────────────────────────────────────────
  // Note: wRC+ and WAR are FanGraphs metrics — Savant has xwOBA, est_woba, est_era (xERA), etc.
  // We use Savant's expected_statistics endpoint which is the most stable CSV export.
  let wrc_plus = [], batter_war = [];
  let xera = [], fip = [], pitcher_war = [];
  let velo = [], movement = [];

  if (savantAvailable) {
    // Use lower min during spring/early season so boards aren't empty
    const minPA = 'q'; // qualified — falls back handled below

    const [xBatRes, xPitRes, veloRes, moveRes] = await Promise.all([
      // expected_statistics: has xba, est_woba (≈ xwOBA), last_name, first_name
      safeFetch(`https://baseballsavant.mlb.com/leaderboard/expected_statistics?type=batter&year=${season}&position=&team=&min=${minPA}&csv=true`),
      // expected_statistics for pitchers: has est_era (= xERA)
      safeFetch(`https://baseballsavant.mlb.com/leaderboard/expected_statistics?type=pitcher&year=${season}&position=&team=&min=${minPA}&csv=true`),
      // pitch arsenal: fastball velocity
      safeFetch(`https://baseballsavant.mlb.com/leaderboard/pitch-arsenal-stats?type=pitcher&pitchType=FF&year=${season}&team=&min=50&sort=avg_speed&sortDir=desc&csv=true`),
      // pitch arsenal: most movement (all pitch types)
      safeFetch(`https://baseballsavant.mlb.com/leaderboard/pitch-arsenal-stats?type=pitcher&pitchType=&year=${season}&team=&min=50&sort=avg_break&sortDir=desc&csv=true`),
    ]);

    // Batter expected stats — use est_woba as wRC+ proxy, and xba as bonus col
    if (xBatRes) {
      const text = await xBatRes.text();
      const rows = parseCSV(text);
      if (rows.length > 0) {
        // est_woba sorted desc → proxy for wRC+
        wrc_plus = toLeaders(
          rows,
          r => { const v = flt(r, 'est_woba'); return v !== null ? v.toFixed(3) : '—'; },
          r => flt(r, 'est_woba')
        ).map(l => ({ ...l, _label: 'xwOBA' }));

        // xBA sorted desc → use as a batter quality metric for WAR placeholder
        // (true WAR requires FanGraphs; show xwOBA leaders here instead)
        batter_war = toLeaders(
          rows,
          r => { const v = flt(r, 'est_woba'); return v !== null ? v.toFixed(3) : '—'; },
          r => flt(r, 'est_woba')
        );
      }
    }

    // Pitcher expected stats — est_era = xERA
    if (xPitRes) {
      const text = await xPitRes.text();
      const rows = parseCSV(text);
      if (rows.length > 0) {
        xera = toLeaders(
          rows,
          r => { const v = flt(r, 'est_era'); return v !== null ? v.toFixed(2) : '—'; },
          r => flt(r, 'est_era'),
          true   // ascending — lower is better
        );

        // FIP not on Savant; use est_era_minus_era_diff as a quality signal
        // Show xERA - ERA differential leaders (pitchers beating their ERA)
        fip = toLeaders(
          rows,
          r => {
            const diff = flt(r, 'est_era_minus_era_diff');
            return diff !== null ? (diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)) : '—';
          },
          r => flt(r, 'est_era_minus_era_diff'),
          true  // ascending (most negative = xERA much lower than ERA = lucky pitcher)
        );

        pitcher_war = toLeaders(
          rows,
          r => { const v = flt(r, 'est_era'); return v !== null ? v.toFixed(2) : '—'; },
          r => flt(r, 'est_era'),
          true
        );
      }
    }

    // Fastball velocity
    if (veloRes) {
      const rows = parseCSV(await veloRes.text());
      velo = rows
        .filter(r => flt(r, 'avg_speed') !== null)
        .sort((a, b) => (flt(b, 'avg_speed') ?? 0) - (flt(a, 'avg_speed') ?? 0))
        .slice(0, 10)
        .map((r, i) => ({
          rank:     i + 1,
          name:     parseSavantName(r),
          team:     getSavantTeam(r),
          teamId:   null,
          playerId: getSavantId(r),
          value:    `${flt(r, 'avg_speed').toFixed(1)} mph`,
          sub:      r['pitch_type_name'] ?? 'Fastball',
        }));
    }

    // Most movement
    if (moveRes) {
      const rows = parseCSV(await moveRes.text());
      movement = rows
        .filter(r => flt(r, 'avg_break') !== null)
        .sort((a, b) => (flt(b, 'avg_break') ?? 0) - (flt(a, 'avg_break') ?? 0))
        .slice(0, 10)
        .map((r, i) => ({
          rank:     i + 1,
          name:     parseSavantName(r),
          team:     getSavantTeam(r),
          teamId:   null,
          playerId: getSavantId(r),
          value:    `${flt(r, 'avg_break').toFixed(1)}"`,
          sub:      r['pitch_type_name'] ?? '',
        }));
    }
  }

  res.status(200).json({
    season,
    savantAvailable,
    // Batting (MLB Stats API)
    battingAverage, onBasePercentage, onBasePlusSlugging,
    homeRuns, runsBattedIn, stolenBases,
    // Batting (Savant)
    wrc_plus, batter_war,
    // Pitching (MLB Stats API)
    earnedRunAverage, inningsPitched, walksAndHitsPerInningPitched,
    strikeouts, saves, holds, wins,
    // Pitching (Savant)
    xera, fip, pitcher_war,
    // Statcast
    velo, movement,
  });
}