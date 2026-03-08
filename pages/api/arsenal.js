// pages/api/arsenal.js
// Server-side proxy for Baseball Savant pitch arsenal data
// Avoids CORS by fetching from Node.js, not the browser

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/csv,text/plain,*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://baseballsavant.mlb.com/',
};

function parseCSV(text) {
  if (!text?.trim()) return [];
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.replace(/"/g,'').trim().toLowerCase());
  return lines.slice(1).map(line => {
    const vals=[]; let cur='', inQ=false;
    for (const ch of line) {
      if (ch==='"'){ inQ=!inQ; }
      else if (ch===',' && !inQ){ vals.push(cur.trim()); cur=''; }
      else cur+=ch;
    }
    vals.push(cur.trim());
    const obj={};
    headers.forEach((h,i)=>{ obj[h]=vals[i]??''; });
    return obj;
  });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');

  const { id, year = new Date().getFullYear() } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing player id' });

  // Baseball Savant pitch arsenal — group by pitch type for this pitcher
  // This endpoint returns one row per pitch type with aggregated stats
  const url = `https://baseballsavant.mlb.com/leaderboard/pitch-arsenal-stats?type=pitcher&pitchType=&year=${year}&team=&min=0&player_id=${id}&csv=true`;

  try {
    const r = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(8000),
    });

    if (!r.ok) {
      // Fallback: try the statcast search grouped by pitch
      const fallbackUrl = `https://baseballsavant.mlb.com/statcast_search/csv?all=true&hfSeas=${year}%7C&player_type=pitcher&pitchers_lookup%5B%5D=${id}&group_by=name-pitch&sort_col=pitches&sort_order=desc&min_pitches=0`;
      const r2 = await fetch(fallbackUrl, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
      if (!r2.ok) return res.status(502).json({ error: 'Savant unavailable', status: r2.status });
      const text2 = await r2.text();
      const rows2 = parseCSV(text2).filter(r => r.pitch_name && parseInt(r.pitches||0) > 0);
      return res.status(200).json({ rows: rows2, source: 'statcast_search' });
    }

    const text = await r.text();
    const rows = parseCSV(text).filter(r => r.pitch_type || r.pitch_name);
    console.log(`[arsenal] id=${id} year=${year} primary rows=${rows.length} headers=${text.split('\n')[0]?.slice(0,120)}`);
    
    if (rows.length === 0) {
      // Try statcast_search as fallback
      const fallbackUrl = `https://baseballsavant.mlb.com/statcast_search/csv?all=true&hfSeas=${year}%7C&player_type=pitcher&pitchers_lookup%5B%5D=${id}&group_by=name-pitch&sort_col=pitches&sort_order=desc&min_pitches=0`;
      const r2 = await fetch(fallbackUrl, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
      if (r2.ok) {
        const text2 = await r2.text();
        const rows2 = parseCSV(text2).filter(r => r.pitch_name && parseInt(r.pitches||0) > 0);
        if (rows2.length > 0) return res.status(200).json({ rows: rows2, source: 'statcast_search' });
      }
    }

    return res.status(200).json({ rows, source: 'pitch_arsenal' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}