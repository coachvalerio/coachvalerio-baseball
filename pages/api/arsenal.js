// pages/api/arsenal.js
// Server-side proxy for Baseball Savant pitch arsenal data

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/csv,text/plain,*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://baseballsavant.mlb.com/',
};

// Only recognized MLB Statcast pitch classifications
// KN (knuckleball), EP (eephus), PO (pitchout) are valid but extremely rare —
// we require minimum thresholds to avoid misclassified outliers appearing
const KNOWN_PITCH_TYPES = new Set([
  'FF','SI','FC','SL','ST','CU','KC','CH','FS','FO','KN','EP','CS','SV','SC','FA','IN','PO'
]);

// Minimum pitches required for a pitch type to appear in the arsenal.
// This prevents 1-2 misclassified pitches (common in Statcast) from showing up.
// ~1% of typical starter workload (~3000 pitches) = 30 pitches minimum.
const MIN_PITCHES = 25;

function parseCSV(text) {
  if (!text?.trim()) return { headers: [], rows: [] };
  const lines = text.trim().split('\n');
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map(h => h.replace(/"/g,'').trim().toLowerCase());
  const rows = lines.slice(1).map(line => {
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
  return { headers, rows };
}

const flt = (r, ...keys) => {
  for (const k of keys) {
    const v = parseFloat(r[k]);
    if (!isNaN(v)) return v;
  }
  return null;
};

const str = (r, ...keys) => {
  for (const k of keys) {
    const v = (r[k]??'').trim();
    // must be non-empty and not a pure number
    if (v && !v.match(/^-?\d+\.?\d*$/)) return v;
  }
  return null;
};

function wavg(items, valKey, weightKey) {
  let num = 0, den = 0;
  for (const it of items) {
    const v = it[valKey], w = it[weightKey];
    if (v !== null && w !== null && w > 0) { num += v * w; den += w; }
  }
  return den > 0 ? num / den : null;
}

function parseRow(r) {
  const pitchType = (r['pitch_type']??'').trim();
  // pitch_type_name comes from pitch-arsenal-stats; pitch_name from statcast_search
  const pitchName = str(r, 'pitch_type_name', 'pitch_name') ?? pitchType ?? '—';

  const pitchPct   = flt(r, 'pitch_percent');
  const pitchCount = flt(r, 'pitches', 'pitch_count', 'n') ?? 0;

  // pfx_x / pfx_z from statcast_search come in feet — convert to inches
  const pfxX = flt(r, 'pfx_x');
  const pfxZ = flt(r, 'pfx_z');

  return {
    pitch_type:  pitchType || '—',
    pitch_name:  pitchName,
    usage_pct:   pitchPct !== null ? (pitchPct > 1 ? pitchPct : pitchPct * 100) : null,
    pitch_count: pitchCount,
    avg_speed:   flt(r, 'avg_speed', 'release_speed'),
    avg_spin:    flt(r, 'avg_spin_rate', 'avg_spin', 'release_spin_rate'),
    avg_break_x: flt(r, 'avg_break_x') ?? (pfxX !== null ? pfxX * 12 : null),
    avg_break_z: flt(r, 'avg_break_z') ?? (pfxZ !== null ? pfxZ * 12 : null),
    whiff_pct:   flt(r, 'whiff_percent', 'whiff_rate'),
    k_pct:       flt(r, 'k_percent'),
    ba:          flt(r, 'ba', 'batting_avg', 'batting_average'),
    slg:         flt(r, 'slg', 'slg_percent'),
    woba:        flt(r, 'woba'),
    xwoba:       flt(r, 'xwoba', 'estimated_woba_using_speedangle'),
    put_away:    flt(r, 'put_away'),
  };
}

function aggregateByPitchType(parsedRows) {
  const groups = {};
  for (const r of parsedRows) {
    const key = r.pitch_type !== '—' ? r.pitch_type : null;
    if (!key) continue;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }

  const result = Object.entries(groups).map(([key, rows]) => {
    const totalCount = rows.reduce((s, r) => s + (r.pitch_count || 1), 0);
    const hasUsagePct = rows.some(r => r.usage_pct !== null);
    const usagePct = hasUsagePct
      ? rows.reduce((s, r) => s + (r.usage_pct ?? 0), 0)
      : null;

    const wavgField = (field) => {
      const w = wavg(rows, field, 'pitch_count');
      if (w !== null) return w;
      const valid = rows.filter(r => r[field] !== null);
      return valid.length > 0 ? valid.reduce((s,r) => s + r[field], 0) / valid.length : null;
    };

    return {
      pitch_type:  key,
      pitch_name:  rows[0].pitch_name,
      usage_pct:   usagePct,
      pitch_count: totalCount,
      avg_speed:   wavgField('avg_speed'),
      avg_spin:    wavgField('avg_spin'),
      avg_break_x: wavgField('avg_break_x'),
      avg_break_z: wavgField('avg_break_z'),
      whiff_pct:   wavgField('whiff_pct'),
      k_pct:       wavgField('k_pct'),
      ba:          wavgField('ba'),
      slg:         wavgField('slg'),
      woba:        wavgField('woba'),
      xwoba:       wavgField('xwoba'),
      put_away:    wavgField('put_away'),
    };
  });

  // Sort by pitch count descending (most-used pitch first)
  return result.sort((a, b) => (b.pitch_count || b.usage_pct || 0) - (a.pitch_count || a.usage_pct || 0));
}

// Filter aggregated pitches: must be a known type AND meet minimum count threshold
// Also computes final usage_pct if not already set
function finalize(pitches) {
  // First pass: compute total for usage denominator
  const total = pitches.reduce((s, p) => s + (p.pitch_count || 0), 0);

  return pitches
    .filter(p => {
      // Must be a known Statcast pitch classification
      if (!KNOWN_PITCH_TYPES.has(p.pitch_type)) return false;
      // Allow if usage_pct is meaningful (primary endpoint has % but no raw counts)
      if (p.usage_pct !== null && p.usage_pct >= 0.5) return true;
      // Otherwise require minimum raw pitch count to filter Statcast misclassifications
      if ((p.pitch_count || 0) >= MIN_PITCHES) return true;
      return false;
    })
    .map(p => ({
      ...p,
      usage_pct: p.usage_pct ?? (total > 0 ? (p.pitch_count / total) * 100 : null),
    }));
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');

  const { id, year = new Date().getFullYear() } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing player id' });

  // ── Primary: pitch-arsenal-stats (already 1 row per pitch type) ──────────
  const primaryUrl = `https://baseballsavant.mlb.com/leaderboard/pitch-arsenal-stats?type=pitcher&pitchType=&year=${year}&team=&min=0&player_id=${id}&csv=true`;

  try {
    const r = await fetch(primaryUrl, { headers: HEADERS, signal: AbortSignal.timeout(9000) });

    if (r.ok) {
      const text = await r.text();
      const { headers, rows: rawRows } = parseCSV(text);
      console.log(`[arsenal/primary] id=${id} year=${year} rawRows=${rawRows.length} cols=${headers.slice(0,10).join('|')}`);

      const parsed = rawRows
        .filter(r => r['pitch_type'] && KNOWN_PITCH_TYPES.has(r['pitch_type'].trim()))
        .map(parseRow)
        .filter(r => (r.usage_pct !== null && r.usage_pct >= 0.5) || r.pitch_count >= MIN_PITCHES);

      if (parsed.length > 0) {
        const pitches = finalize(aggregateByPitchType(parsed));
        console.log(`[arsenal/primary] returning ${pitches.length} pitch types: ${pitches.map(p=>p.pitch_type).join(',')}`);
        return res.status(200).json({ pitches, source: 'pitch_arsenal_stats' });
      }
    }

    // ── Fallback: statcast_search ─────────────────────────────────────────
    console.log(`[arsenal] primary empty — trying statcast_search fallback`);
    const fallbackUrl = `https://baseballsavant.mlb.com/statcast_search/csv?all=true&hfSeas=${year}%7C&player_type=pitcher&pitchers_lookup%5B%5D=${id}&group_by=name-pitch&sort_col=pitches&sort_order=desc&min_pitches=${MIN_PITCHES}`;
    const r2 = await fetch(fallbackUrl, { headers: HEADERS, signal: AbortSignal.timeout(9000) });

    if (!r2.ok) return res.status(502).json({ error: 'Both Savant endpoints failed' });

    const text2 = await r2.text();
    const { headers: h2, rows: rawRows2 } = parseCSV(text2);
    console.log(`[arsenal/fallback] rawRows=${rawRows2.length} cols=${h2.slice(0,10).join('|')}`);

    const parsed2 = rawRows2
      .filter(r => r['pitch_type'] && KNOWN_PITCH_TYPES.has(r['pitch_type'].trim()))
      .map(parseRow);

    const pitches = finalize(aggregateByPitchType(parsed2));
    console.log(`[arsenal/fallback] returning ${pitches.length} pitch types: ${pitches.map(p=>p.pitch_type).join(',')}`);

    return res.status(200).json({ pitches, source: 'statcast_search' });

  } catch (e) {
    console.error(`[arsenal] error: ${e.message}`);
    return res.status(500).json({ error: e.message });
  }
}