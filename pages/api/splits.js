// pages/api/splits.js
// Fetches velocity splits (batter vs pitch speed) and inning-by-inning stats (pitchers)
// Uses MLB Stats API for inning splits + Baseball Savant CSV for velocity data

export default async function handler(req, res) {
  const { id, season } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing player id' });

  const yr = season ?? new Date().getFullYear();

  try {
    // ── Fetch player info to determine position
    const infoR = await fetch(`https://statsapi.mlb.com/api/v1/people/${id}`);
    const infoData = await infoR.json();
    const pos = infoData.people?.[0]?.primaryPosition?.abbreviation ?? '';
    const isPitcher = ['P', 'SP', 'RP', 'CP'].includes(pos);

    // ── Fetch situational splits from MLB Stats API
    const [situationalR, inningR] = await Promise.all([
      fetch(`https://statsapi.mlb.com/api/v1/people/${id}/stats?stats=statSplits&season=${yr}&group=${isPitcher ? 'pitching' : 'hitting'}&sitCodes=vl,vr,h,a,risp,hi`),
      fetch(`https://statsapi.mlb.com/api/v1/people/${id}/stats?stats=byInning&season=${yr}&group=pitching`),
    ]);

    const [situationalData, inningData] = await Promise.all([
      situationalR.json(),
      inningR.json(),
    ]);

    // ── Parse situational splits
    const situationalSplits = parseSituational(situationalData, isPitcher);

    // ── Parse inning-by-inning splits (pitchers)
    const inningRows = parseInnings(inningData);

    // ── Fetch velocity splits from Baseball Savant pitch-level data
    let velocityBuckets = [];
    try {
      // Savant pitch-level search filtered by player
      const savantType = isPitcher ? 'pitcher' : 'batter';
      const playerParam = isPitcher ? 'pitchers_lookup' : 'batters_lookup';
      const savantUrl = `https://baseballsavant.mlb.com/statcast_search/csv?all=true&hfSea=${yr}%7C&${playerParam}%5B%5D=${id}&player_type=${savantType}&type=details&hfAB=&min_results=0&group_by=name&sort_col=pitches&sort_order=desc`;

      const savantR = await fetch(savantUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CoachValerio/1.0)' },
      });

      if (savantR.ok) {
        const csv = await savantR.text();
        velocityBuckets = buildVelocityBuckets(csv, isPitcher);
      }
    } catch {}

    res.status(200).json({
      isPitcher,
      innings: inningRows.length > 0 ? inningRows : null,
      situational: situationalSplits,
      velocityBuckets,
    });

  } catch (err) {
    res.status(500).json({ error: err.message, innings: null, situational: [], velocityBuckets: [] });
  }
}

// ── Parse MLB situational splits API response
function parseSituational(data, isPitcher) {
  const splits = data.stats?.[0]?.splits ?? [];
  const labelMap = {
    'vl':   'vs Left-Handed P',
    'vr':   'vs Right-Handed P',
    'h':    'Home',
    'a':    'Away',
    'risp': 'RISP',
    'hi':   'High Leverage',
  };
  return splits.map(s => {
    const st = s.stat ?? {};
    const label = labelMap[s.split?.code] ?? s.split?.description ?? s.split?.code ?? '—';
    if (isPitcher) {
      return {
        situation: label,
        pa: st.battersFaced ?? st.atBats ?? '—',
        era: st.era ?? '—',
        whip: st.whip ?? '—',
        kpct: st.strikeOuts && st.battersFaced
          ? ((st.strikeOuts / st.battersFaced) * 100).toFixed(1) + '%' : '—',
        bbpct: st.baseOnBalls && st.battersFaced
          ? ((st.baseOnBalls / st.battersFaced) * 100).toFixed(1) + '%' : '—',
        avg: st.avg ?? '—',
      };
    } else {
      return {
        situation: label,
        pa: st.plateAppearances ?? st.atBats ?? '—',
        avg: st.avg ?? '—',
        obp: st.obp ?? '—',
        slg: st.slg ?? '—',
        ops: st.ops ?? '—',
        hr: st.homeRuns ?? '—',
      };
    }
  });
}

// ── Parse inning-by-inning stats
function parseInnings(data) {
  const splits = data.stats?.[0]?.splits ?? [];
  return splits.map(s => {
    const st = s.stat ?? {};
    const innNum = s.inning ?? s.split?.description?.replace(/\D/g, '') ?? '?';
    const ip = parseFloat(st.inningsPitched ?? 0);
    const bf = parseInt(st.battersFaced ?? 1) || 1;
    return {
      inning: innNum,
      ip:     st.inningsPitched ?? '—',
      era:    st.era ?? (ip > 0 ? ((parseInt(st.earnedRuns ?? 0) * 9) / ip).toFixed(2) : '—'),
      whip:   st.whip ?? (ip > 0 ? (((parseInt(st.baseOnBalls ?? 0) + parseInt(st.hits ?? 0)) / ip)).toFixed(2) : '—'),
      kpct:   st.strikeOuts ? ((st.strikeOuts / bf) * 100).toFixed(1) + '%' : '—',
      bbpct:  st.baseOnBalls ? ((st.baseOnBalls / bf) * 100).toFixed(1) + '%' : '—',
      baa:    st.avg ?? '—',
      h:      st.hits ?? '—',
      er:     st.earnedRuns ?? '—',
    };
  }).sort((a, b) => parseInt(a.inning) - parseInt(b.inning));
}

// ── Build velocity buckets from Statcast CSV
function buildVelocityBuckets(csv, isPitcher) {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const rows = lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/"/g, ''));
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i]; });
    return obj;
  }).filter(r => r.release_speed && parseFloat(r.release_speed) > 0);

  // Bucket definitions: [label, min, max, midpoint]
  const buckets = [
    { zone: '97+ mph  (Elite Heat)',  min: 97,  max: 120, midpoint: 98  },
    { zone: '94–96 mph  (Hard)',      min: 94,  max: 97,  midpoint: 95  },
    { zone: '90–93 mph  (Mid FB)',    min: 90,  max: 94,  midpoint: 92  },
    { zone: '85–89 mph  (Soft FB)',   min: 85,  max: 90,  midpoint: 87  },
    { zone: '<85 mph  (Off-Speed)',   min: 0,   max: 85,  midpoint: 82  },
  ];

  return buckets.map(bucket => {
    const inBucket = rows.filter(r => {
      const v = parseFloat(r.release_speed);
      return v >= bucket.min && v < bucket.max;
    });

    if (inBucket.length === 0) return null;

    if (isPitcher) {
      // For pitchers: K%, whiff%, ERA estimate per bucket
      const strikeouts = inBucket.filter(r => r.events === 'strikeout').length;
      const walks      = inBucket.filter(r => r.events === 'walk').length;
      const swings     = inBucket.filter(r => ['swinging_strike', 'swinging_strike_blocked', 'foul', 'foul_tip', 'hit_into_play'].includes(r.description)).length;
      const whiffs     = inBucket.filter(r => ['swinging_strike', 'swinging_strike_blocked'].includes(r.description)).length;
      const bf         = new Set(inBucket.map(r => r.at_bat_number + '_' + r.game_pk)).size || inBucket.length;

      return {
        ...bucket,
        pa:     bf,
        kpct:   bf > 0 ? ((strikeouts / bf) * 100).toFixed(1) + '%' : '—',
        bbpct:  bf > 0 ? ((walks / bf) * 100).toFixed(1) + '%' : '—',
        whiff:  swings > 0 ? ((whiffs / swings) * 100).toFixed(1) + '%' : '—',
        era:    '—', // Hard to compute ERA at pitch level
        tendency: getTendencyPit(bucket.midpoint, parseFloat(inBucket.filter(r=>r.events==='strikeout').length/Math.max(bf,1)*100)),
      };
    } else {
      // For batters: AVG, SLG, K%, HR per bucket
      const atBats   = inBucket.filter(r => !['walk','hit_by_pitch','sac_fly','sac_bunt','catcher_interf'].includes(r.events) && r.events).length;
      const hits      = inBucket.filter(r => ['single','double','triple','home_run'].includes(r.events)).length;
      const hrs       = inBucket.filter(r => r.events === 'home_run').length;
      const sos       = inBucket.filter(r => r.events === 'strikeout').length;
      const tb        = inBucket.reduce((acc, r) => {
        const tbMap = { single: 1, double: 2, triple: 3, home_run: 4 };
        return acc + (tbMap[r.events] ?? 0);
      }, 0);
      const pa = new Set(inBucket.map(r => r.at_bat_number + '_' + r.game_pk)).size || atBats || 1;

      return {
        ...bucket,
        pa,
        avg:  atBats > 0 ? (hits / atBats).toFixed(3) : '—',
        slg:  atBats > 0 ? (tb / atBats).toFixed(3) : '—',
        kpct: pa > 0 ? ((sos / pa) * 100).toFixed(1) + '%' : '—',
        hr:   hrs,
        tendency: getTendencyBat(bucket.midpoint, atBats > 0 ? hits / atBats : 0),
      };
    }
  }).filter(Boolean);
}

function getTendencyBat(mph, avg) {
  if (mph >= 97) return avg >= .260 ? 'Handles elite velo well' : 'Struggles vs elite heat';
  if (mph >= 94) return avg >= .270 ? 'Strong vs hard fastballs' : 'Challenged by hard FB';
  if (mph >= 90) return avg >= .280 ? 'Best zone — thrives on mid FB' : 'Average vs mid FB';
  if (mph >= 85) return avg >= .290 ? 'Punishes soft velocity' : 'Average vs softer stuff';
  return avg >= .300 ? 'Crushes slow/off-speed' : 'Patient vs off-speed';
}

function getTendencyPit(mph, kpct) {
  if (mph >= 97) return kpct >= 35 ? 'Elite zone — dominant strikeout pitch' : 'High velo, moderate results';
  if (mph >= 94) return kpct >= 28 ? 'Primary weapon velocity' : 'Command-heavy at this speed';
  if (mph >= 90) return kpct >= 22 ? 'Effective mid-range velo' : 'Gets weak contact here';
  if (mph >= 85) return 'Transition to secondary stuff';
  return kpct >= 18 ? 'Off-speed working well' : 'Gets hit when slow pitches miss';
}