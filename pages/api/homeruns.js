// pages/api/homeruns.js
// Fetches HR log from Baseball Savant, then resolves pitcher IDs → names via MLB API

export default async function handler(req, res) {
  const { id, season } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing player id' });
  const yr = season ?? new Date().getFullYear();

  try {
    // ── Step 1: Fetch HR pitch data from Baseball Savant
    // When player_type=batter, the CSV contains:
    //   player_name  = BATTER name ("Last, First")  ← NOT the pitcher
    //   pitcher      = pitcher's MLB numeric ID
    //   batter       = batter's MLB numeric ID
    //   release_speed     = pitch velo (mph)
    //   launch_speed      = exit velo (mph)
    //   hit_distance_sc   = HR distance (feet)
    //   launch_angle      = degrees
    //   inning            = inning number (integer)
    //   p_throws          = pitcher handedness (L/R)
    //   pitch_type        = FF/SL/CH/etc.
    //   hc_x, hc_y        = spray chart coordinates

    const savantUrl = [
      'https://baseballsavant.mlb.com/statcast_search/csv?all=true',
      `&hfSea=${yr}%7C`,
      `&hfAB=home_run%7C`,
      `&player_type=batter`,
      `&batters_lookup%5B%5D=${id}`,
      `&hfGT=R%7C`,
      `&type=details`,
      `&sort_col=game_date`,
      `&sort_order=desc`,
    ].join('');

    const savantRes = await fetch(savantUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CoachValerio/1.0)' },
    });

    if (!savantRes.ok) {
      return res.status(200).json({ homeRuns: [], season: yr, total: 0, hasPitchData: false });
    }

    const csv = await savantRes.text();
    const rows = parseCSV(csv);

    if (rows.length === 0) {
      return res.status(200).json({ homeRuns: [], season: yr, total: 0, hasPitchData: false });
    }

    // ── Step 2: Collect unique pitcher IDs and batch-resolve to names
    const pitcherIds = [...new Set(rows.map(r => r.pitcher).filter(p => p && p !== ''))];
    const pitcherNames = await resolvePitcherNames(pitcherIds);

    // ── Step 3: Build HR list with correct field mapping
    const homeRuns = rows.map((row, i) => {
      const pitcherId = row.pitcher ?? '';
      const pitcherName = pitcherNames[pitcherId] ?? `Pitcher #${pitcherId}`;

      const pitchVelo   = parseNum(row.release_speed);
      const exitVelo    = parseNum(row.launch_speed);
      const distance    = parseNum(row.hit_distance_sc);
      const launchAngle = parseNum(row.launch_angle);
      const inning      = row.inning ? parseInt(row.inning) : null;

      return {
        num:         i + 1,
        date:        formatDate(row.game_date),
        opponent:    getMatchup(row),
        pitcher:     pitcherName,
        pitcherHand: row.p_throws ?? '—',
        pitchType:   PITCH_TYPE_MAP[row.pitch_type] ?? row.pitch_type ?? '—',
        pitchVelo:   pitchVelo   != null ? pitchVelo.toFixed(1)   : '—',
        exitVelo:    exitVelo    != null ? exitVelo.toFixed(1)     : '—',
        distance:    distance    != null ? Math.round(distance) + ' ft' : '—',
        launchAngle: launchAngle != null ? launchAngle.toFixed(1) + '°' : '—',
        direction:   getDirection(row.hc_x, row.hc_y),
        inning:      inning      != null ? inning + ordinal(inning) : '—',
        count:       (row.balls !== '' && row.strikes !== '')
                       ? `${row.balls}-${row.strikes}` : '—',
        stand:       row.stand ?? '—',
      };
    });

    res.status(200).json({
      homeRuns,
      season: yr,
      total: homeRuns.length,
      hasPitchData: true,
    });

  } catch (err) {
    res.status(500).json({ error: err.message, homeRuns: [], hasPitchData: false });
  }
}

// ── Batch resolve pitcher IDs → full names via MLB Stats API
async function resolvePitcherNames(ids) {
  if (ids.length === 0) return {};
  try {
    // MLB API supports comma-separated IDs for bulk lookup
    const chunks = chunkArray(ids, 50); // max 50 per request
    const nameMap = {};
    await Promise.all(chunks.map(async chunk => {
      const joined = chunk.join(',');
      const r = await fetch(
        `https://statsapi.mlb.com/api/v1/people?personIds=${joined}&fields=people,id,fullName`,
        { headers: { Accept: 'application/json' } }
      );
      if (!r.ok) return;
      const data = await r.json();
      for (const person of (data.people ?? [])) {
        nameMap[String(person.id)] = person.fullName;
      }
    }));
    return nameMap;
  } catch {
    return {};
  }
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

// ── CSV parser (handles quoted fields containing commas)
function parseCSV(csv) {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1)
    .map(line => {
      const vals = parseCSVLine(line);
      const row = {};
      headers.forEach((h, i) => { row[h.trim()] = (vals[i] ?? '').trim(); });
      return row;
    })
    .filter(r => r.game_date && /\d{4}-\d{2}-\d{2}/.test(r.game_date));
}

function parseCSVLine(line) {
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

function parseNum(val) {
  if (!val || val === '' || val === 'null') return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function getMatchup(row) {
  if (row.home_team && row.away_team) return `${row.away_team} @ ${row.home_team}`;
  return row.home_team ?? row.away_team ?? '—';
}

function getDirection(x, y) {
  if (!x || !y || x === '' || y === '') return '—';
  const xi = parseFloat(x);
  if (isNaN(xi)) return '—';
  if (xi < 125)  return 'Left Field';
  if (xi < 150)  return 'Left-Center';
  if (xi < 165)  return 'Center Field';
  if (xi < 185)  return 'Right-Center';
  return 'Right Field';
}

function ordinal(n) {
  if (n === 1) return 'st';
  if (n === 2) return 'nd';
  if (n === 3) return 'rd';
  return 'th';
}

function formatDate(d) {
  if (!d) return '—';
  try {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return d; }
}

const PITCH_TYPE_MAP = {
  FF: 'Four-Seam FB', SI: 'Sinker',    FC: 'Cutter',      FS: 'Splitter',
  SL: 'Slider',       CU: 'Curveball', KC: 'Knuckle Curve', CH: 'Changeup',
  KN: 'Knuckleball',  ST: 'Sweeper',   SV: 'Slurve',      CS: 'Slow Curve',
  FA: 'Fastball',     FT: 'Two-Seam FB', EP: 'Eephus',    PO: 'Pitchout',
};