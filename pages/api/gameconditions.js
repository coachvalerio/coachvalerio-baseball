// pages/api/game-conditions.js
// Hyper-local game conditions: weather + park factors + pitcher/hitter H2H context
// Requires: OPENWEATHER_API_KEY in .env.local

const STADIUM_DATA = {
  // team_id: { name, lat, lng, bearing (home plate → CF compass°), roofType, altitude_ft,
  //            dims: {lf,lf_gap,cf,rf_gap,rf}, wall_lf, wall_cf, wall_rf,
  //            pf: { hr, runs, h, doubles } }   (park factor: 100=neutral, >100=batter-friendly)
  110: { name:'Camden Yards',        lat:39.2838, lng:-76.6218, bearing:95,  roof:'open',     alt:10,   dims:{lf:333,lf_gap:364,cf:410,rf_gap:373,rf:318}, wall:{lf:7,cf:7,rf:7},   pf:{hr:96, runs:99, h:98,  d:101} },
  111: { name:'Fenway Park',         lat:42.3467, lng:-71.0972, bearing:90,  roof:'open',     alt:20,   dims:{lf:310,lf_gap:379,cf:420,rf_gap:380,rf:302}, wall:{lf:37,cf:17,rf:3},  pf:{hr:94, runs:103,h:103, d:112} },
  147: { name:'Yankee Stadium',      lat:40.8296, lng:-73.9262, bearing:218, roof:'open',     alt:15,   dims:{lf:318,lf_gap:399,cf:408,rf_gap:385,rf:314}, wall:{lf:8,cf:8,rf:8},   pf:{hr:106,runs:100,h:98,  d:95}  },
  139: { name:'Tropicana Field',     lat:27.7683, lng:-82.6534, bearing:180, roof:'dome',     alt:5,    dims:{lf:315,lf_gap:370,cf:404,rf_gap:370,rf:322}, wall:{lf:11,cf:10,rf:11}, pf:{hr:95, runs:95, h:93,  d:94}  },
  141: { name:'Rogers Centre',       lat:43.6414, lng:-79.3894, bearing:270, roof:'retract',  alt:76,   dims:{lf:328,lf_gap:375,cf:400,rf_gap:375,rf:328}, wall:{lf:10,cf:10,rf:10}, pf:{hr:103,runs:101,h:100, d:97}  },
  145: { name:'Guaranteed Rate',     lat:41.8300, lng:-87.6339, bearing:5,   roof:'open',     alt:595,  dims:{lf:330,lf_gap:377,cf:400,rf_gap:375,rf:335}, wall:{lf:8,cf:8,rf:8},   pf:{hr:100,runs:99, h:99,  d:98}  },
  114: { name:'Progressive Field',   lat:41.4962, lng:-81.6852, bearing:60,  roof:'open',     alt:653,  dims:{lf:325,lf_gap:370,cf:405,rf_gap:375,rf:325}, wall:{lf:19,cf:19,rf:8},  pf:{hr:95, runs:96, h:96,  d:97}  },
  116: { name:'Comerica Park',       lat:42.3390, lng:-83.0485, bearing:15,  roof:'open',     alt:585,  dims:{lf:345,lf_gap:370,cf:420,rf_gap:365,rf:330}, wall:{lf:8,cf:8,rf:8},   pf:{hr:88, runs:94, h:95,  d:99}  },
  118: { name:'Kauffman Stadium',    lat:39.0517, lng:-94.4803, bearing:35,  roof:'open',     alt:910,  dims:{lf:330,lf_gap:387,cf:410,rf_gap:387,rf:330}, wall:{lf:9,cf:8,rf:9},   pf:{hr:97, runs:98, h:98,  d:98}  },
  142: { name:'Target Field',        lat:44.9817, lng:-93.2781, bearing:15,  roof:'open',     alt:838,  dims:{lf:339,lf_gap:377,cf:404,rf_gap:367,rf:328}, wall:{lf:8,cf:8,rf:23},  pf:{hr:97, runs:99, h:100, d:102} },
  117: { name:'Minute Maid Park',    lat:29.7572, lng:-95.3555, bearing:15,  roof:'retract',  alt:43,   dims:{lf:315,lf_gap:362,cf:435,rf_gap:373,rf:326}, wall:{lf:19,cf:21,rf:7},  pf:{hr:95, runs:97, h:97,  d:97}  },
  108: { name:'Angel Stadium',       lat:33.8003, lng:-117.8827,bearing:192, roof:'open',     alt:152,  dims:{lf:347,lf_gap:370,cf:396,rf_gap:370,rf:350}, wall:{lf:8,cf:8,rf:8},   pf:{hr:97, runs:97, h:97,  d:96}  },
  133: { name:'Oakland Coliseum',    lat:37.7516, lng:-122.2005,bearing:230, roof:'open',     alt:7,    dims:{lf:330,lf_gap:388,cf:400,rf_gap:362,rf:330}, wall:{lf:8,cf:10,rf:8},  pf:{hr:89, runs:93, h:95,  d:101} },
  136: { name:'T-Mobile Park',       lat:47.5914, lng:-122.3325,bearing:230, roof:'retract',  alt:15,   dims:{lf:331,lf_gap:378,cf:401,rf_gap:381,rf:326}, wall:{lf:8,cf:8,rf:8},   pf:{hr:95, runs:96, h:97,  d:96}  },
  140: { name:'Globe Life Field',    lat:32.7473, lng:-97.0822, bearing:34,  roof:'retract',  alt:551,  dims:{lf:329,lf_gap:372,cf:407,rf_gap:374,rf:326}, wall:{lf:8,cf:8,rf:8},   pf:{hr:101,runs:100,h:100, d:99}  },
  144: { name:'Truist Park',         lat:33.8908, lng:-84.4678, bearing:30,  roof:'open',     alt:1050, dims:{lf:335,lf_gap:380,cf:400,rf_gap:375,rf:325}, wall:{lf:7,cf:8,rf:7},   pf:{hr:99, runs:99, h:99,  d:98}  },
  146: { name:'loanDepot park',      lat:25.7781, lng:-80.2197, bearing:46,  roof:'retract',  alt:6,    dims:{lf:344,lf_gap:386,cf:416,rf_gap:392,rf:335}, wall:{lf:34,cf:16,rf:18}, pf:{hr:88, runs:91, h:92,  d:93}  },
  121: { name:'Citi Field',          lat:40.7571, lng:-73.8458, bearing:120, roof:'open',     alt:18,   dims:{lf:335,lf_gap:379,cf:408,rf_gap:375,rf:330}, wall:{lf:8,cf:8,rf:8},   pf:{hr:95, runs:96, h:95,  d:95}  },
  143: { name:'Citizens Bank Park',  lat:39.9061, lng:-75.1665, bearing:175, roof:'open',     alt:20,   dims:{lf:329,lf_gap:369,cf:401,rf_gap:369,rf:330}, wall:{lf:6,cf:8,rf:13},  pf:{hr:107,runs:105,h:103, d:102} },
  120: { name:'Nationals Park',      lat:38.8730, lng:-77.0074, bearing:195, roof:'open',     alt:20,   dims:{lf:336,lf_gap:377,cf:402,rf_gap:370,rf:335}, wall:{lf:8,cf:8,rf:8},   pf:{hr:100,runs:97, h:97,  d:97}  },
  112: { name:'Wrigley Field',       lat:41.9484, lng:-87.6553, bearing:60,  roof:'open',     alt:595,  dims:{lf:355,lf_gap:368,cf:400,rf_gap:368,rf:353}, wall:{lf:12,cf:11,rf:11}, pf:{hr:102,runs:104,h:103, d:104} },
  113: { name:'Great American BP',   lat:39.0975, lng:-84.5072, bearing:15,  roof:'open',     alt:490,  dims:{lf:328,lf_gap:365,cf:404,rf_gap:370,rf:325}, wall:{lf:12,cf:12,rf:8},  pf:{hr:115,runs:109,h:107, d:107} },
  158: { name:'American Family Fld', lat:43.0280, lng:-87.9712, bearing:285, roof:'retract',  alt:634,  dims:{lf:344,lf_gap:371,cf:400,rf_gap:374,rf:345}, wall:{lf:8,cf:8,rf:8},   pf:{hr:97, runs:98, h:98,  d:99}  },
  134: { name:'PNC Park',            lat:40.4469, lng:-80.0058, bearing:32,  roof:'open',     alt:730,  dims:{lf:325,lf_gap:389,cf:399,rf_gap:375,rf:320}, wall:{lf:6,cf:10,rf:21},  pf:{hr:94, runs:96, h:97,  d:99}  },
  138: { name:'Busch Stadium',       lat:38.6226, lng:-90.1928, bearing:35,  roof:'open',     alt:455,  dims:{lf:336,lf_gap:375,cf:400,rf_gap:375,rf:335}, wall:{lf:8,cf:8,rf:8},   pf:{hr:97, runs:97, h:97,  d:97}  },
  109: { name:'Chase Field',         lat:33.4453, lng:-112.0667,bearing:160, roof:'retract',  alt:1082, dims:{lf:330,lf_gap:376,cf:407,rf_gap:374,rf:335}, wall:{lf:7,cf:8,rf:25},  pf:{hr:109,runs:103,h:101, d:102} },
  115: { name:'Coors Field',         lat:39.7559, lng:-104.9942,bearing:17,  roof:'open',     alt:5200, dims:{lf:347,lf_gap:390,cf:415,rf_gap:375,rf:350}, wall:{lf:8,cf:8,rf:8},   pf:{hr:119,runs:117,h:112, d:119} },
  119: { name:'Dodger Stadium',      lat:34.0739, lng:-118.2400,bearing:30,  roof:'open',     alt:512,  dims:{lf:330,lf_gap:360,cf:395,rf_gap:385,rf:330}, wall:{lf:8,cf:8,rf:8},   pf:{hr:93, runs:94, h:93,  d:91}  },
  135: { name:'Petco Park',          lat:32.7073, lng:-117.1566,bearing:295, roof:'open',     alt:20,   dims:{lf:336,lf_gap:367,cf:396,rf_gap:391,rf:322}, wall:{lf:8,cf:22,rf:8},  pf:{hr:81, runs:88, h:91,  d:91}  },
  137: { name:'Oracle Park',         lat:37.7786, lng:-122.3893,bearing:110, roof:'open',     alt:10,   dims:{lf:339,lf_gap:382,cf:399,rf_gap:421,rf:309}, wall:{lf:8,cf:8,rf:24},  pf:{hr:81, runs:88, h:90,  d:91}  },
};

// Compass direction label from degrees
function windDirLabel(deg) {
  if (deg == null) return 'Variable';
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

// Calculate effective wind component: positive = blowing OUT (toward CF), negative = blowing IN
function windComponent(windDeg, stadiumBearing) {
  if (windDeg == null) return 0;
  const diff = ((windDeg - stadiumBearing) + 360) % 360;
  // diff=0 → wind blowing straight OUT to CF, diff=180 → straight IN from CF
  return Math.cos((diff * Math.PI) / 180); // 1=out, -1=in, 0=crosswind
}

// HR adjustment factor from weather conditions
function hrWeatherFactor(temp, windSpeedMph, windComp, altitudeFt, roofType) {
  if (roofType === 'dome') return { factor: 1.0, notes: ['🏟️ Dome: weather has no impact'] };
  const notes = [];
  let factor = 1.0;

  // Temperature: ball travels ~4ft further per 10°F above 70°F
  if (temp >= 90)      { factor *= 1.10; notes.push(`🌡️ ${temp}°F — hot air carries ball further (+10%)`) }
  else if (temp >= 80) { factor *= 1.06; notes.push(`🌡️ ${temp}°F — warm conditions favorable (+6%)`) }
  else if (temp >= 70) { factor *= 1.02; notes.push(`🌡️ ${temp}°F — neutral temperature`) }
  else if (temp >= 55) { factor *= 0.97; notes.push(`🌡️ ${temp}°F — cool air reduces carry (-3%)`) }
  else if (temp >= 45) { factor *= 0.93; notes.push(`🌡️ ${temp}°F — cold air reduces carry (-7%)`) }
  else                 { factor *= 0.88; notes.push(`🥶 ${temp}°F — very cold, ball dies (-12%)`) }

  // Altitude (Coors effect)
  if (altitudeFt >= 4000)      { factor *= 1.12; notes.push(`⛰️ ${altitudeFt}ft elevation — thin air, significant carry (+12%)`) }
  else if (altitudeFt >= 2000) { factor *= 1.05; notes.push(`⛰️ ${altitudeFt}ft elevation — elevated park (+5%)`) }
  else if (altitudeFt >= 1000) { factor *= 1.02; notes.push(`⛰️ ${altitudeFt}ft elevation — slight elevation benefit`) }

  // Wind
  const effectiveWind = windSpeedMph * windComp;
  if (effectiveWind >= 15)       { factor *= 1.18; notes.push(`💨 ${windSpeedMph}mph blowing out — ball carries significantly (+18%)`) }
  else if (effectiveWind >= 10)  { factor *= 1.12; notes.push(`💨 ${windSpeedMph}mph blowing out — favorable for HR (+12%)`) }
  else if (effectiveWind >= 5)   { factor *= 1.06; notes.push(`🌬️ ${windSpeedMph}mph blowing out — slight carry (+6%)`) }
  else if (effectiveWind <= -15) { factor *= 0.78; notes.push(`💨 ${windSpeedMph}mph blowing IN — ball dies at warning track (-22%)`) }
  else if (effectiveWind <= -10) { factor *= 0.84; notes.push(`💨 ${windSpeedMph}mph blowing IN — tough HR conditions (-16%)`) }
  else if (effectiveWind <= -5)  { factor *= 0.92; notes.push(`🌬️ ${windSpeedMph}mph blowing IN — slight headwind (-8%)`) }
  else                           { notes.push(`🌬️ Crosswind — neutral impact on HR`) }

  return { factor, notes };
}

// Predict O/U adjustment based on conditions vs park baseline
function ouAdjustment(weatherFactor, parkHrFactor, parkRunFactor) {
  const combined = (weatherFactor * (parkHrFactor / 100) * (parkRunFactor / 100));
  const adj = (combined - 1.0) * 4.5; // rough runs per game adjustment
  return Math.round(adj * 10) / 10;
}

const safeFetch = async (url, opts = {}) => {
  try {
    const r = await fetch(url, { ...opts, headers: { Accept: 'application/json', ...opts.headers } });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
};

export default async function handler(req, res) {
  const { gamePk } = req.query;
  if (!gamePk) return res.status(400).json({ error: 'Missing gamePk' });

  const OW_KEY = process.env.OPENWEATHER_API_KEY;

  // ── 1. Get game info from MLB Stats API
  const feedData = await safeFetch(
    `https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`
  );
  if (!feedData) return res.status(404).json({ error: 'Game not found' });

  const gd = feedData.gameData ?? {};
  const homeTeam = gd.teams?.home ?? {};
  const awayTeam = gd.teams?.away ?? {};
  const homeId   = homeTeam.id;
  const stadium  = STADIUM_DATA[homeId] ?? null;

  // Probable pitchers from game data
  const homePitcherId = gd.probablePitchers?.home?.id ?? null;
  const awayPitcherId = gd.probablePitchers?.away?.id ?? null;
  const homePitcherName = gd.probablePitchers?.home?.fullName ?? 'TBD';
  const awayPitcherName = gd.probablePitchers?.away?.fullName ?? 'TBD';

  // ── 2. Weather — OpenWeatherMap or MLB weather fallback
  let weather = null;
  if (OW_KEY && stadium) {
    const owData = await safeFetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${stadium.lat}&lon=${stadium.lng}&appid=${OW_KEY}&units=imperial`
    );
    if (owData?.main) {
      const wDeg  = owData.wind?.deg ?? null;
      const wComp = stadium ? windComponent(wDeg, stadium.bearing) : 0;
      weather = {
        source:    'OpenWeatherMap',
        temp:      Math.round(owData.main.temp),
        feelsLike: Math.round(owData.main.feels_like),
        humidity:  owData.main.humidity,
        condition: owData.weather?.[0]?.main ?? 'Clear',
        description: owData.weather?.[0]?.description ?? '',
        icon:      owData.weather?.[0]?.icon ?? '01d',
        wind: {
          speed:     Math.round(owData.wind?.speed ?? 0),
          deg:       wDeg,
          direction: windDirLabel(wDeg),
          component: Math.round(wComp * 100) / 100,
          label:     wComp > 0.3 ? 'Blowing OUT' : wComp < -0.3 ? 'Blowing IN' : 'Crosswind',
        },
        visibility: owData.visibility ? Math.round(owData.visibility / 1609.34) : null,
      };
    }
  }

  // Fallback to MLB weather if OW not available
  if (!weather && gd.weather?.temp) {
    const wDir   = gd.weather.wind?.direction ?? '';
    const wSpeed = parseInt(gd.weather.wind?.speed ?? 0);
    // crude direction text → bearing offset
    const wComp = /out|center/i.test(wDir) ? 0.8 : /in/i.test(wDir) ? -0.8 : 0;
    weather = {
      source:    'MLB Stats API',
      temp:      parseInt(gd.weather.temp),
      feelsLike: parseInt(gd.weather.temp),
      humidity:  null,
      condition: gd.weather.condition ?? 'Unknown',
      description: gd.weather.condition ?? '',
      icon:      null,
      wind: {
        speed:     wSpeed,
        deg:       null,
        direction: wDir,
        component: wComp,
        label:     wComp > 0.3 ? 'Blowing OUT' : wComp < -0.3 ? 'Blowing IN' : 'Crosswind',
      },
    };
  }

  // ── 3. Park + weather HR factor
  const pf = stadium?.pf ?? { hr: 100, runs: 100, h: 100, d: 100 };
  let weatherAnalysis = { factor: 1.0, notes: [] };
  if (weather && stadium) {
    weatherAnalysis = hrWeatherFactor(
      weather.temp,
      weather.wind.speed,
      weather.wind.component,
      stadium.alt,
      stadium.roof
    );
  } else if (!weather) {
    weatherAnalysis.notes.push('⚠️ Weather data unavailable — add OPENWEATHER_API_KEY for hyper-local forecast');
  }

  const ouAdj = weather ? ouAdjustment(weatherAnalysis.factor, pf.hr, pf.runs) : null;

  // ── 4. H2H pitcher vs lineup context (sample top batters)
  // Pull boxscore for batting orders
  const liveData   = feedData.liveData ?? {};
  const bs         = liveData.boxscore ?? {};
  const awayBatters = (bs.teams?.away?.batters ?? []).slice(0, 5);
  const homeBatters = (bs.teams?.home?.batters ?? []).slice(0, 5);

  // Fetch pitcher season stats for both starters
  const [homePitStats, awayPitStats] = await Promise.all([
    homePitcherId ? safeFetch(`https://statsapi.mlb.com/api/v1/people/${homePitcherId}/stats?stats=season&group=pitching&season=${new Date().getFullYear()}`) : null,
    awayPitcherId ? safeFetch(`https://statsapi.mlb.com/api/v1/people/${awayPitcherId}/stats?stats=season&group=pitching&season=${new Date().getFullYear()}`) : null,
  ]);

  const extractPitStats = (d) => {
    const s = d?.stats?.[0]?.splits?.[0]?.stat ?? {};
    return {
      era:  s.era   ?? '--',
      whip: s.whip  ?? '--',
      k9:   s.strikeoutsPer9Inn ?? '--',
      bb9:  s.walksPer9Inn ?? '--',
      hr9:  s.homeRunsPer9 ?? '--',
      ip:   s.inningsPitched ?? '--',
    };
  };

  // H2H: fetch career stats vs opposing pitcher for top batters
  // Only fetch for available batters vs probable pitchers
  const h2hResults = [];
  const pitcherToFace = { away: homePitcherId, home: awayPitcherId }; // away batters face home pitcher

  for (const [side, batterIds] of [['away', awayBatters], ['home', homeBatters]]) {
    const oppPitId = pitcherToFace[side];
    if (!oppPitId || batterIds.length === 0) continue;

    // Sample up to 3 batters
    for (const batterId of batterIds.slice(0, 3)) {
      const h2hData = await safeFetch(
        `https://statsapi.mlb.com/api/v1/people/${batterId}/stats?stats=vsPlayer&opposingPlayerId=${oppPitId}&group=hitting`
      );
      const split = h2hData?.stats?.[0]?.splits?.[0];
      if (!split?.stat) continue;

      const s   = split.stat;
      const ab  = parseInt(s.atBats ?? 0);
      const hr  = parseInt(s.homeRuns ?? 0);
      const hits = parseInt(s.hits ?? 0);

      if (ab < 3) continue; // not enough sample

      // Get batter name from boxscore
      const batterInfo = bs.teams?.[side]?.players?.[`ID${batterId}`];
      const batterName = batterInfo?.person?.fullName ?? `Player ${batterId}`;

      h2hResults.push({
        side,
        batterId,
        batterName,
        pitcherName: side === 'away' ? homePitcherName : awayPitcherName,
        ab,  hits, hr,
        avg: ab > 0 ? (hits / ab).toFixed(3) : '.000',
        hrNote: hr >= 3 ? `🚨 ${hr} HR in ${ab} AB` : hr >= 1 ? `⚡ ${hr} HR in ${ab} AB` : null,
        hotNote: ab >= 5 && (hits / ab) >= 0.400 ? `🔥 ${(hits/ab*1000/10).toFixed(0)}% career avg` : null,
        coldNote: ab >= 5 && (hits / ab) <= 0.150 ? `🧊 Struggles (${(hits/ab).toFixed(3)})` : null,
      });
    }
  }

  // Sort by HR descending
  h2hResults.sort((a, b) => b.hr - a.hr || (b.hits/Math.max(b.ab,1)) - (a.hits/Math.max(a.ab,1)));

  // ── 5. Build HR prediction narrative
  const hrPredictions = [];
  const totalHrFactor = weatherAnalysis.factor * (pf.hr / 100);
  if (totalHrFactor >= 1.15)      hrPredictions.push({ grade:'🚀', text:'EXTREMELY favorable HR conditions today', color:'#c8102e' });
  else if (totalHrFactor >= 1.08) hrPredictions.push({ grade:'🔥', text:'Very favorable for home runs', color:'#e8354a' });
  else if (totalHrFactor >= 1.03) hrPredictions.push({ grade:'✅', text:'Slightly above average HR conditions', color:'#f47c7c' });
  else if (totalHrFactor >= 0.97) hrPredictions.push({ grade:'➡️', text:'Neutral HR environment today', color:'#9e9e9e' });
  else if (totalHrFactor >= 0.90) hrPredictions.push({ grade:'📉', text:'Below average HR conditions', color:'#6baed6' });
  else                            hrPredictions.push({ grade:'🥶', text:'Very tough conditions for home runs', color:'#2171b5' });

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
  return res.status(200).json({
    gamePk,
    gameInfo: {
      home: { id: homeId, name: homeTeam.name, abbr: homeTeam.abbreviation },
      away: { id: awayTeam.id, name: awayTeam.name, abbr: awayTeam.abbreviation },
      venue: gd.venue?.name ?? stadium?.name ?? 'Unknown',
      gameDate: gd.datetime?.dateTime ?? null,
    },
    stadium: stadium ? {
      name:    stadium.name,
      roof:    stadium.roof,
      alt:     stadium.alt,
      dims:    stadium.dims,
      wall:    stadium.wall,
      bearing: stadium.bearing,
    } : null,
    weather,
    parkFactors: {
      hr:    pf.hr,
      runs:  pf.runs,
      hits:  pf.h,
      doubles: pf.d,
      hrLabel:   pf.hr >= 110 ? 'Very HR-Friendly' : pf.hr >= 105 ? 'HR-Friendly' : pf.hr >= 98 ? 'Neutral' : pf.hr >= 92 ? 'Pitcher-Friendly' : 'Very Pitcher-Friendly',
      runLabel:  pf.runs >= 108 ? 'High-Scoring' : pf.runs >= 103 ? 'Above Average' : pf.runs >= 97 ? 'Neutral' : pf.runs >= 92 ? 'Below Average' : 'Low-Scoring',
    },
    weatherAnalysis: {
      hrFactor:  Math.round(weatherAnalysis.factor * 100) / 100,
      notes:     weatherAnalysis.notes,
    },
    combinedAnalysis: {
      totalHrFactor:  Math.round(totalHrFactor * 100) / 100,
      ouAdjustment:   ouAdj,
      prediction:     hrPredictions[0] ?? null,
    },
    pitchers: {
      home: { id: homePitcherId, name: homePitcherName, stats: extractPitStats(homePitStats) },
      away: { id: awayPitcherId, name: awayPitcherName, stats: extractPitStats(awayPitStats) },
    },
    h2h: h2hResults,
    hasWeatherKey: !!OW_KEY,
  });
}