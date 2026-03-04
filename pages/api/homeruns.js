// pages/api/homeruns.js
// Fetches home run log with pitcher, pitch type, velocity data
// Uses MLB Stats API game log + Baseball Savant pitch data

export default async function handler(req, res) {
  const { id, season } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing player id' });

  const yr = season ?? new Date().getFullYear();

  try {
    // Step 1: Get game-by-game hitting log
    const logR = await fetch(
      `https://statsapi.mlb.com/api/v1/people/${id}/stats?stats=gameLog&season=${yr}&group=hitting`,
      { headers: { Accept: 'application/json' } }
    );
    const logData = await logR.json();
    const gameSplits = logData.stats?.[0]?.splits ?? [];

    // Filter games where player hit a HR
    const hrGames = gameSplits.filter(g => parseInt(g.stat?.homeRuns ?? 0) > 0);

    // Step 2: Try to get pitch-level HR data from Baseball Savant
    // Savant's search API: statcast search for home runs
    let savantHRs = [];
    try {
      const savantR = await fetch(
        `https://baseballsavant.mlb.com/statcast_search/csv?all=true&hfPT=&hfAB=home_run%7C&hfBBT=&hfPR=&hfZ=&stadium=&hfBBL=&hfNewZones=&hfGT=R%7C&hfC=&hfSea=${yr}%7C&hfSit=&player_type=batter&hfOuts=&opponent=&pitcher_throws=&batter_stands=&hfSA=&game_date_gt=&game_date_lt=&hfInfield=&team=&position=&hfOutfield=&hfRO=&home_away=&batters_lookup%5B%5D=${id}&hfFlag=&hfPull=&metric_1=&hfInn=&min_pitches=0&min_results=0&group_by=name&sort_col=pitches&player_event_sort=h_launch_speed&sort_order=desc&min_pas=0&type=details`,
        { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CoachValerio/1.0)' } }
      );

      if (savantR.ok) {
        const csv = await savantR.text();
        savantHRs = parseStatcastCSV(csv);
      }
    } catch {}

    // Step 3: Build HR list — use Savant data if available, else use game log
    let homeRuns = [];

    if (savantHRs.length > 0) {
      homeRuns = savantHRs.map((row, i) => ({
        num:       i + 1,
        date:      formatDate(row.game_date),
        opponent:  row.away_team === row.pitcher_team ? row.away_team : row.home_team,
        pitcher:   row.player_name_pitcher ?? row.pitcher ?? '—',
        pitchType: PITCH_TYPE_MAP[row.pitch_type] ?? row.pitch_type ?? '—',
        pitchVelo: row.release_speed ? parseFloat(row.release_speed).toFixed(1) : '—',
        exitVelo:  row.launch_speed  ? parseFloat(row.launch_speed).toFixed(1)  : '—',
        distance:  row.hit_distance_sc ?? row.estimated_distance ?? '—',
        launchAngle: row.launch_angle ? parseFloat(row.launch_angle).toFixed(1) : '—',
        direction: getDirection(row.hc_x, row.hc_y),
        inning:    row.inning ? `${row.inning}${getOrdinal(row.inning)}` : '—',
        balls:     row.balls,
        strikes:   row.strikes,
        count:     row.balls !== undefined ? `${row.balls}-${row.strikes}` : '—',
      }));
    } else {
      // Fallback: build from game log (no pitch details available)
      let hrNum = 0;
      for (const game of hrGames) {
        const hrCount = parseInt(game.stat?.homeRuns ?? 0);
        for (let i = 0; i < hrCount; i++) {
          hrNum++;
          homeRuns.push({
            num:      hrNum,
            date:     game.date ? formatDate(game.date) : '—',
            opponent: game.opponent?.name ?? '—',
            pitcher:  '—',
            pitchType:'—',
            pitchVelo:'—',
            exitVelo: '—',
            distance: '—',
            direction:'—',
            inning:   '—',
            count:    '—',
            note:     'Pitch details via Savant not available',
          });
        }
      }
    }

    res.status(200).json({
      homeRuns,
      season: yr,
      total:  homeRuns.length,
      hasPitchData: savantHRs.length > 0,
    });

  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch HR data', detail: err.message, homeRuns: [] });
  }
}

// ── Parse Baseball Savant CSV
function parseStatcastCSV(csv) {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i]; });
    return row;
  }).filter(r => r.game_date); // filter empty rows
}

// ── Pitch type abbreviation map
const PITCH_TYPE_MAP = {
  FF: 'Four-Seam FB', SI: 'Sinker', FC: 'Cutter', FS: 'Splitter',
  SL: 'Slider', CU: 'Curveball', KC: 'Knuckle Curve', CH: 'Changeup',
  KN: 'Knuckleball', ST: 'Sweeper', SV: 'Slurve', CS: 'Slow Curve',
  EP: 'Eephus', FO: 'Forkball', SC: 'Screwball', PO: 'Pitchout',
};

function getDirection(x, y) {
  if (!x || !y) return '—';
  const xi = parseFloat(x);
  if (xi < 90)  return 'Left Field';
  if (xi < 150) return 'Center Field';
  return 'Right Field';
}

function getOrdinal(n) {
  const num = parseInt(n);
  if (num === 1) return 'st'; if (num === 2) return 'nd'; if (num === 3) return 'rd'; return 'th';
}

function formatDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return d; }
}