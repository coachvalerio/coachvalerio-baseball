// pages/api/scoreboard.js
// Live MLB scoreboard with OpenWeatherMap weather overlaid per stadium

const STADIUMS = {
  109: { name: 'Chase Field',            lat: 33.4453, lon: -112.0667, roof: true  }, // ARI
  144: { name: 'Truist Park',            lat: 33.8908, lon: -84.4678,  roof: false }, // ATL
  110: { name: 'Camden Yards',           lat: 39.2838, lon: -76.6218,  roof: false }, // BAL
  111: { name: 'Fenway Park',            lat: 42.3467, lon: -71.0972,  roof: false }, // BOS
  112: { name: 'Wrigley Field',          lat: 41.9484, lon: -87.6553,  roof: false }, // CHC
  145: { name: 'Guaranteed Rate Field',  lat: 41.8300, lon: -87.6338,  roof: false }, // CWS
  113: { name: 'Great American Ball Park',lat:39.0979, lon: -84.5082,  roof: false }, // CIN
  114: { name: 'Progressive Field',      lat: 41.4962, lon: -81.6852,  roof: false }, // CLE
  115: { name: 'Coors Field',            lat: 39.7559, lon: -104.9942, roof: false }, // COL
  116: { name: 'Comerica Park',          lat: 42.3390, lon: -83.0485,  roof: false }, // DET
  117: { name: 'Minute Maid Park',       lat: 29.7573, lon: -95.3555,  roof: true  }, // HOU
  118: { name: 'Kauffman Stadium',       lat: 39.0517, lon: -94.4803,  roof: false }, // KC
  108: { name: 'Angel Stadium',          lat: 33.8003, lon: -117.8827, roof: false }, // LAA
  119: { name: 'Dodger Stadium',         lat: 34.0739, lon: -118.2400, roof: false }, // LAD
  146: { name: 'loanDepot park',         lat: 25.7781, lon: -80.2197,  roof: true  }, // MIA
  158: { name: 'American Family Field',  lat: 43.0280, lon: -87.9712,  roof: true  }, // MIL
  142: { name: 'Target Field',           lat: 44.9817, lon: -93.2781,  roof: false }, // MIN
  121: { name: 'Citi Field',             lat: 40.7571, lon: -73.8458,  roof: false }, // NYM
  147: { name: 'Yankee Stadium',         lat: 40.8296, lon: -73.9262,  roof: false }, // NYY
  133: { name: 'Oakland Coliseum',       lat: 37.7516, lon: -122.2005, roof: false }, // OAK
  143: { name: 'Citizens Bank Park',     lat: 39.9061, lon: -75.1665,  roof: false }, // PHI
  134: { name: 'PNC Park',               lat: 40.4469, lon: -80.0057,  roof: false }, // PIT
  135: { name: 'Petco Park',             lat: 32.7076, lon: -117.1570, roof: false }, // SD
  137: { name: 'Oracle Park',            lat: 37.7786, lon: -122.3893, roof: false }, // SF
  136: { name: 'T-Mobile Park',          lat: 47.5914, lon: -122.3325, roof: true  }, // SEA
  138: { name: 'Busch Stadium',          lat: 38.6226, lon: -90.1928,  roof: false }, // STL
  139: { name: 'Tropicana Field',        lat: 27.7683, lon: -82.6534,  roof: true  }, // TB
  140: { name: 'Globe Life Field',       lat: 32.7473, lon: -97.0825,  roof: true  }, // TEX
  141: { name: 'Rogers Centre',          lat: 43.6414, lon: -79.3894,  roof: true  }, // TOR
  120: { name: 'Nationals Park',         lat: 38.8730, lon: -77.0074,  roof: false }, // WSH
};

// Park HR factors (>1.0 = hitter friendly). Approximate 2024 values.
const PARK_HR_FACTOR = {
  109:1.20, 144:1.00, 110:0.95, 111:0.93, 112:1.05, 145:1.08, 113:1.10,
  114:0.88, 115:1.35, 116:0.95, 117:1.00, 118:0.93, 108:1.05, 119:0.93,
  146:0.88, 158:1.05, 142:1.00, 121:0.98, 147:1.10, 133:0.90, 143:1.12,
  134:0.85, 135:0.88, 137:0.82, 136:0.90, 138:0.95, 139:0.80, 140:1.15,
  141:1.00, 120:1.00,
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
  const today = req.query.date ?? new Date().toISOString().slice(0, 10);

  try {
    // 1. Fetch schedule — NO fields= filter (it strips nested data like team names/IDs)
    //    NO gameType= filter either so we get ALL types in one call:
    //    R=Regular Season, S=Spring Training, E=Exhibition, W=WBC
    //    Two fetches: sportId=1 (all MLB incl Spring Training) + sportId=51 (WBC)
    const [mlbRes, wbcRes] = await Promise.all([
      fetch(
        `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${today}` +
        `&hydrate=team,linescore,probablePitcher(note)`
      ),
      fetch(
        `https://statsapi.mlb.com/api/v1/schedule?sportId=51&date=${today}` +
        `&hydrate=team,linescore,probablePitcher(note)`
      ),
    ]);

    const mlbData = await mlbRes.json();
    const wbcData = wbcRes.ok ? await wbcRes.json() : { dates: [] };

    const allGames = [
      ...(mlbData.dates?.[0]?.games ?? []),
      ...(wbcData.dates?.[0]?.games ?? []),
    ];

    // Deduplicate by gamePk
    const seen = new Set();
    const games = allGames.filter(g => {
      if (seen.has(g.gamePk)) return false;
      seen.add(g.gamePk);
      return true;
    });

    if (!games.length) return res.status(200).json({ games: [], date: today });

    // 2. Fetch weather for unique venues in parallel (deduplicated)
    const venueIds = [...new Set(games.map(g => g.teams?.home?.team?.id).filter(Boolean))];
    const weatherMap = {};

    await Promise.all(venueIds.map(async (teamId) => {
      const stadium = STADIUMS[teamId];
      if (!stadium || stadium.roof) return; // skip domed stadiums
      try {
        const wRes = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${stadium.lat}&lon=${stadium.lon}` +
          `&appid=${process.env.OPENWEATHER_API_KEY}&units=imperial`
        );
        if (wRes.ok) weatherMap[teamId] = await wRes.json();
      } catch {}
    }));

    // 3. Build enriched game objects
    const enriched = games.map(g => {
      const homeId = g.teams?.home?.team?.id;
      const awayId = g.teams?.away?.team?.id;
      const stadium = STADIUMS[homeId] ?? null;
      const weather = weatherMap[homeId] ?? null;
      const parkFactor = PARK_HR_FACTOR[homeId] ?? 1.0;

      // Weather-based HR boost: wind toward CF + warm + low humidity = boost
      let hrBoost = parkFactor;
      let weatherNote = null;
      if (weather && !stadium?.roof) {
        const windSpeed   = weather.wind?.speed ?? 0;   // mph
        const windDeg     = weather.wind?.deg ?? 0;     // 0=N,90=E,180=S,270=W
        const temp        = weather.main?.temp ?? 72;
        const humidity    = weather.main?.humidity ?? 50;
        // Wind blowing "out" (roughly S→N = toward CF in most stadiums): deg 135-225
        const windOut = windDeg >= 135 && windDeg <= 225;
        const windBoost = windOut ? (windSpeed * 0.008) : -(windSpeed * 0.004);
        const tempBoost  = (temp - 72) * 0.002;
        const humBoost   = (50 - humidity) * 0.001;
        hrBoost = Math.max(0.70, parkFactor + windBoost + tempBoost + humBoost);
        weatherNote = `${Math.round(temp)}°F · ${Math.round(windSpeed)}mph ${compassDir(windDeg)} · ${weather.weather?.[0]?.description ?? ''}`;
      } else if (stadium?.roof) {
        weatherNote = 'Domed / retractable roof';
      }

      // Win probability from linescore (use API value if live, else 50/50)
      const ls = g.linescore ?? {};
      const homeScore = ls.teams?.home?.runs ?? g.teams?.home?.score ?? 0;
      const awayScore = ls.teams?.away?.runs ?? g.teams?.away?.score ?? 0;
      const status    = g.status?.detailedState ?? g.status?.abstractGameState ?? 'Scheduled';
      const isLive    = status === 'In Progress' || status === 'Manager Challenge';
      const isFinal   = status.toLowerCase().includes('final');

      // Rough win prob from run diff mid-game (very simplified)
      let homeWinPct = 50;
      if (isLive) {
        const inning = parseInt(ls.currentInning ?? 1);
        const diff   = homeScore - awayScore;
        homeWinPct   = Math.min(97, Math.max(3, 50 + diff * (inning * 4)));
      } else if (isFinal) {
        homeWinPct = homeScore > awayScore ? 100 : 0;
      }

      // gameType is now included in fields so this will be populated
      // S=Spring Training, E=Exhibition, R=Regular, W=World Classic/WBC
      const gameTypeCode  = g.gameType ?? 'R';
      const sportId       = g.sport?.id ?? 1;
      const gameTypeLabel =
        gameTypeCode === 'S'           ? 'Spring Training' :
        gameTypeCode === 'E'           ? 'Exhibition' :
        gameTypeCode === 'W'           ? 'World Baseball Classic' :
        sportId === 51                 ? 'World Baseball Classic' :
        gameTypeCode !== 'R'           ? gameTypeCode :
        '';

      return {
        gamePk:      g.gamePk,
        gameDate:    g.gameDate,
        gameTypeLabel,
        status,
        isLive,
        isFinal,
        inning:      ls.currentInning ?? null,
        inningHalf:  ls.inningHalf ?? null,
        home: {
          id:        homeId,
          name:      g.teams?.home?.team?.name,
          abbr:      g.teams?.home?.team?.abbreviation,
          score:     homeScore,
          pitcher:   g.teams?.home?.probablePitcher?.fullName ?? null,
          record:    `${g.teams?.home?.leagueRecord?.wins ?? 0}-${g.teams?.home?.leagueRecord?.losses ?? 0}`,
        },
        away: {
          id:        awayId,
          name:      g.teams?.away?.team?.name,
          abbr:      g.teams?.away?.team?.abbreviation,
          score:     awayScore,
          pitcher:   g.teams?.away?.probablePitcher?.fullName ?? null,
          record:    `${g.teams?.away?.leagueRecord?.wins ?? 0}-${g.teams?.away?.leagueRecord?.losses ?? 0}`,
        },
        venue:       g.venue?.name ?? stadium?.name ?? 'TBD',
        stadiumInfo: stadium,
        weather:     weather ? {
          temp:        Math.round(weather.main?.temp ?? 0),
          feelsLike:   Math.round(weather.main?.feels_like ?? 0),
          humidity:    weather.main?.humidity,
          windSpeed:   Math.round(weather.wind?.speed ?? 0),
          windDir:     compassDir(weather.wind?.deg ?? 0),
          windDeg:     weather.wind?.deg ?? 0,
          condition:   weather.weather?.[0]?.main ?? '',
          description: weather.weather?.[0]?.description ?? '',
          icon:        weather.weather?.[0]?.icon ?? '',
          note:        weatherNote,
        } : { note: weatherNote },
        hrBoost:     +hrBoost.toFixed(3),
        homeWinPct,
      };
    });

    return res.status(200).json({ games: enriched, date: today });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

function compassDir(deg) {
  const dirs = ['N','NE','E','SE','S','SW','W','NW'];
  return dirs[Math.round(deg / 45) % 8];
}