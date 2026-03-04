// pages/api/homeruns.js
// Fetches home run log with correct Statcast CSV field mapping

export default async function handler(req, res) {
  const { id, season } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing player id' });

  const yr = season ?? new Date().getFullYear();

  try {
    // ── Step 1: Statcast CSV from Baseball Savant for all HRs this season
    // player_type=batter + batters_lookup = filter to THIS batter's HRs
    // hfAB=home_run = only home run events
    let savantHRs = [];
    try {
      const url = [
        'https://baseballsavant.mlb.com/statcast_search/csv?all=true',
        `&hfSea=${yr}%7C`,
        `&hfAB=home_run%7C`,
        `&player_type=batter`,
        `&batters_lookup%5B%5D=${id}`,
        `&hfGT=R%7C`,          // regular season only
        `&type=details`,
        `&sort_col=game_date`,
        `&sort_order=desc`,
      ].join('');

      const r = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CoachValerio/1.0)' },
      });

      if (r.ok) {
        const csv = await r.text();
        savantHRs = parseCSV(csv);
        console.log('Savant HR rows:', savantHRs.length);
        if (savantHRs.length > 0) {
          // Log first row keys so we can debug field names
          console.log('CSV headers sample:', Object.keys(savantHRs[0]).slice(0, 20).join(', '));
          console.log('First row sample:', JSON.stringify(savantHRs[0]).slice(0, 300));
        }
      }
    } catch (e) {
      console.error('Savant fetch error:', e.message);
    }

    let homeRuns = [];

    if (savantHRs.length > 0) {
      homeRuns = savantHRs.map((row, i) => {
        // ── CORRECT Statcast CSV field names (verified against actual Savant CSV schema):
        // player_name       = PITCHER's name (format: "Last, First")
        // batter            = batter's MLB ID
        // pitcher           = pitcher's MLB ID
        // pitch_type        = pitch abbreviation (FF, SL, etc.)
        // release_speed     = pitch velocity in mph
        // launch_speed      = exit velocity in mph  
        // hit_distance_sc   = home run distance in FEET
        // launch_angle      = launch angle in degrees
        // hc_x, hc_y        = hit coordinates for spray chart
        // inning            = inning number
        // inning_topbot     = "Top" or "Bot"
        // balls, strikes    = count when HR was hit
        // stand             = batter handedness (L/R)
        // p_throws          = pitcher handedness (L/R)
        // home_team, away_team = team abbreviations
        // game_date         = YYYY-MM-DD

        const pitcherName = formatPitcherName(row.player_name);
        const pitchVelo   = parseNum(row.release_speed);
        const exitVelo    = parseNum(row.launch_speed);
        const distance    = parseNum(row.hit_distance_sc);
        const launchAngle = parseNum(row.launch_angle);
        const inning      = row.inning ? parseInt(row.inning) : null;

        return {
          num:         i + 1,
          date:        formatDate(row.game_date),
          opponent:    getOpponent(row, id),
          pitcher:     pitcherName,
          pitcherHand: row.p_throws ?? '—',
          pitchType:   PITCH_TYPE_MAP[row.pitch_type] ?? row.pitch_type ?? '—',
          pitchVelo:   pitchVelo ? pitchVelo.toFixed(1) : '—',
          exitVelo:    exitVelo  ? exitVelo.toFixed(1)  : '—',
          distance:    distance  ? Math.round(distance) + ' ft' : '—',
          launchAngle: launchAngle ? launchAngle.toFixed(1) + '°' : '—',
          direction:   getDirection(row.hc_x, row.hc_y),
          inning:      inning ? `${inning}${ordinal(inning)}` : '—',
          count:       (row.balls !== undefined && row.strikes !== undefined)
                         ? `${row.balls}-${row.strikes}` : '—',
          stand:       row.stand ?? '—',
        };
      });
    } else {
      // Fallback: MLB Stats API game log (no pitch details)
      const logR = await fetch(
        `https://statsapi.mlb.com/api/v1/people/${id}/stats?stats=gameLog&season=${yr}&group=hitting`,
        { headers: { Accept: 'application/json' } }
      );
      const logData = await logR.json();
      const games = (logData.stats?.[0]?.splits ?? []).filter(g => parseInt(g.stat?.homeRuns ?? 0) > 0);

      let n = 0;
      for (const g of games) {
        const count = parseInt(g.stat?.homeRuns ?? 0);
        for (let i = 0; i < count; i++) {
          homeRuns.push({
            num: ++n,
            date: g.date ? formatDate(g.date) : '—',
            opponent: g.opponent?.name ?? '—',
            pitcher: '—', pitcherHand: '—', pitchType: '—',
            pitchVelo: '—', exitVelo: '—', distance: '—',
            launchAngle: '—', direction: '—', inning: '—', count: '—', stand: '—',
          });
        }
      }
    }

    res.status(200).json({
      homeRuns,
      season: yr,
      total: homeRuns.length,
      hasPitchData: savantHRs.length > 0,
    });

  } catch (err) {
    res.status(500).json({ error: err.message, homeRuns: [], hasPitchData: false });
  }
}

// ── CSV parser — handles quoted fields with commas inside
function parseCSV(csv) {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);

  return lines.slice(1)
    .map(line => {
      const values = parseCSVLine(line);
      const row = {};
      headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
      return row;
    })
    .filter(r => r.game_date && r.game_date.match(/\d{4}-\d{2}-\d{2}/));
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// ── Savant "player_name" is "Last, First" for the pitcher
function formatPitcherName(raw) {
  if (!raw || raw.trim() === '') return '—';
  // Format is "Last, First" — convert to "First Last"
  const parts = raw.split(',');
  if (parts.length === 2) {
    return `${parts[1].trim()} ${parts[0].trim()}`;
  }
  return raw.trim();
}

function parseNum(val) {
  if (!val || val === '' || val === 'null') return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

// Determine opponent team from home/away fields
// The batter's team is NOT the pitcher's team
function getOpponent(row, batterId) {
  // home_team and away_team are 3-letter abbreviations
  // We can't easily tell which is the batter's team without the roster
  // Use both and show "vs [away] @ [home]" style, or just show both
  if (row.home_team && row.away_team) {
    return `${row.away_team} @ ${row.home_team}`;
  }
  return row.home_team ?? row.away_team ?? '—';
}

function getDirection(x, y) {
  if (!x || !y || x === '' || y === '') return '—';
  const xi = parseFloat(x);
  if (isNaN(xi)) return '—';
  // Savant hc_x: ~100 = left field line, ~125 = LF, ~140 = LC, ~155 = CF, ~170 = RC, ~185 = RF, ~200 = RF line
  if (xi < 125)  return 'Left Field';
  if (xi < 150)  return 'Left-Center';
  if (xi < 165)  return 'Center Field';
  if (xi < 185)  return 'Right-Center';
  return 'Right Field';
}

function ordinal(n) {
  const num = parseInt(n);
  if (num === 1) return 'st';
  if (num === 2) return 'nd';
  if (num === 3) return 'rd';
  return 'th';
}

function formatDate(d) {
  if (!d) return '—';
  try {
    // Add T00:00:00 to avoid timezone shift turning Sep 28 into Sep 27
    return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return d; }
}

const PITCH_TYPE_MAP = {
  FF: 'Four-Seam FB', SI: 'Sinker',    FC: 'Cutter',    FS: 'Splitter',
  SL: 'Slider',       CU: 'Curveball', KC: 'Knuckle Curve', CH: 'Changeup',
  KN: 'Knuckleball',  ST: 'Sweeper',   SV: 'Slurve',    CS: 'Slow Curve',
  EP: 'Eephus',       FO: 'Forkball',  SC: 'Screwball', PO: 'Pitchout',
  FA: 'Fastball',     FT: 'Two-Seam FB',
};