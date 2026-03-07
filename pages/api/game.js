// pages/api/game.js
// Fetches + shapes live game data from MLB Stats API
// Single endpoint: /api/v1.1/game/{gamePk}/feed/live contains everything

export default async function handler(req, res) {
  const { gamePk } = req.query;
  if (!gamePk) return res.status(400).json({ error: 'Missing gamePk' });

  // Live games: no cache. Final/Scheduled: short cache
  const safeFetch = async (url) => {
    try {
      const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!r.ok) return null;
      return await r.json();
    } catch { return null; }
  };

  try {
    // Master endpoint — contains linescore, plays, boxscore, win probability
    const [feedData, wpData] = await Promise.all([
      safeFetch(`https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`),
      safeFetch(`https://statsapi.mlb.com/api/v1/game/${gamePk}/winProbability`),
    ]);

    if (!feedData) return res.status(404).json({ error: 'Game not found' });

    const gameData = feedData.gameData   ?? {};
    const liveData = feedData.liveData   ?? {};
    const ls       = liveData.linescore  ?? {};
    const bs       = liveData.boxscore   ?? {};
    const plays    = liveData.plays      ?? {};

    // ── Status
    const status       = gameData.status?.abstractGameState ?? 'Preview'; // Preview | Live | Final
    const detailStatus = gameData.status?.detailedState     ?? '';
    const isLive       = status === 'Live';
    const isFinal      = status === 'Final';

    // ── Teams
    const homeTeam = gameData.teams?.home ?? {};
    const awayTeam = gameData.teams?.away ?? {};

    // ── Linescore
    const innings = (ls.innings ?? []).map(inn => ({
      num:   inn.num,
      home:  inn.home?.runs  ?? (inn.home?.hits  !== undefined ? '' : ''),
      away:  inn.away?.runs  ?? (inn.away?.hits  !== undefined ? '' : ''),
      homeH: inn.home?.hits  ?? 0,
      awayH: inn.away?.hits  ?? 0,
      homeE: inn.home?.errors ?? 0,
      awayE: inn.away?.errors ?? 0,
    }));

    const linescore = {
      innings,
      currentInning:     ls.currentInning     ?? null,
      inningHalf:        ls.inningHalf        ?? '',   // 'Top' | 'Bottom'
      inningState:       ls.inningState       ?? '',   // 'Middle' | 'End'
      homeRuns:          ls.teams?.home?.runs  ?? 0,
      awayRuns:          ls.teams?.away?.runs  ?? 0,
      homeHits:          ls.teams?.home?.hits  ?? 0,
      awayHits:          ls.teams?.away?.hits  ?? 0,
      homeErrors:        ls.teams?.home?.errors ?? 0,
      awayErrors:        ls.teams?.away?.errors ?? 0,
      balls:             ls.balls   ?? 0,
      strikes:           ls.strikes ?? 0,
      outs:              ls.outs    ?? 0,
    };

    // ── Bases (runners on base)
    const defense   = plays.currentPlay?.matchup ?? {};
    const offense   = ls.offense ?? {};
    const bases = {
      first:  !!(offense.first),
      second: !!(offense.second),
      third:  !!(offense.third),
      batter: offense.batter?.fullName  ?? null,
      pitcher:defense.pitcher?.fullName ?? null,
    };

    // ── Current play / pitch-by-pitch
    const currentPlay = plays.currentPlay ?? null;
    const currentAtBat = currentPlay ? {
      description:   currentPlay.result?.description ?? '',
      batter:        currentPlay.matchup?.batter?.fullName  ?? '',
      batterId:      currentPlay.matchup?.batter?.id        ?? null,
      pitcher:       currentPlay.matchup?.pitcher?.fullName ?? '',
      pitcherId:     currentPlay.matchup?.pitcher?.id       ?? null,
      batSide:       currentPlay.matchup?.batSide?.code     ?? '',
      pitchHand:     currentPlay.matchup?.pitchHand?.code   ?? '',
      count: {
        balls:   currentPlay.count?.balls   ?? 0,
        strikes: currentPlay.count?.strikes ?? 0,
        outs:    currentPlay.count?.outs    ?? 0,
      },
      pitches: (currentPlay.playEvents ?? [])
        .filter(e => e.isPitch)
        .map(e => ({
          num:         e.pitchNumber,
          type:        e.details?.type?.description ?? e.details?.call?.description ?? '—',
          typeCode:    e.details?.call?.code ?? '',
          speed:       e.pitchData?.startSpeed    ?? null,
          spinRate:    e.pitchData?.breaks?.spinRate ?? null,
          pX:          e.pitchData?.coordinates?.pX  ?? null,
          pZ:          e.pitchData?.coordinates?.pZ  ?? null,
          // Strike zone top/bottom vary by batter but ~1.5–3.5 is standard
          szTop:       e.pitchData?.strikeZoneTop    ?? 3.5,
          szBot:       e.pitchData?.strikeZoneBottom ?? 1.5,
          isStrike:    ['S','C','F','T','L','O','K'].includes(e.details?.call?.code),
          isBall:      ['B','*B'].includes(e.details?.call?.code),
          isInPlay:    e.details?.call?.code === 'X',
          exitVelo:    e.hitData?.launchSpeed   ?? null,
          launchAngle: e.hitData?.launchAngle   ?? null,
          description: e.details?.description  ?? '',
        })),
    } : null;

    // ── All plays (play-by-play) — last 30 most recent first
    const allPlays = (plays.allPlays ?? [])
      .slice(-50)
      .reverse()
      .map(p => ({
        inning:      p.about?.inning      ?? 0,
        halfInning:  p.about?.halfInning  ?? '',
        description: p.result?.description ?? '',
        event:       p.result?.event       ?? '',
        eventType:   p.result?.eventType   ?? '',
        rbi:         p.result?.rbi         ?? 0,
        awayScore:   p.result?.awayScore   ?? 0,
        homeScore:   p.result?.homeScore   ?? 0,
        batter:      p.matchup?.batter?.fullName  ?? '',
        pitcher:     p.matchup?.pitcher?.fullName ?? '',
        isOut:       p.result?.eventType?.includes('out'),
        isHit:       ['single','double','triple','home_run'].includes(p.result?.eventType),
        isHR:        p.result?.eventType === 'home_run',
        isWalk:      p.result?.eventType === 'walk',
        isStrikeout: p.result?.eventType?.includes('strikeout'),
      }));

    // ── Scoring plays only
    const scoringPlays = (plays.scoringPlays ?? []).map(idx => {
      const p = plays.allPlays?.[idx];
      if (!p) return null;
      return {
        inning:      p.about?.inning,
        halfInning:  p.about?.halfInning,
        description: p.result?.description,
        awayScore:   p.result?.awayScore,
        homeScore:   p.result?.homeScore,
        rbi:         p.result?.rbi,
        event:       p.result?.event,
      };
    }).filter(Boolean);

    // ── Box score — batters
    const buildBatters = (teamSide) => {
      const batters = bs.teams?.[teamSide]?.batters ?? [];
      const players  = bs.teams?.[teamSide]?.players ?? {};
      return batters.map(id => {
        const p    = players[`ID${id}`] ?? {};
        const stat = p.stats?.batting ?? {};
        return {
          id,
          name:       p.person?.fullName ?? '—',
          pos:        p.position?.abbreviation ?? '—',
          battingOrder: p.battingOrder,
          ab:   stat.atBats         ?? 0,
          r:    stat.runs           ?? 0,
          h:    stat.hits           ?? 0,
          rbi:  stat.rbi            ?? 0,
          bb:   stat.baseOnBalls    ?? 0,
          k:    stat.strikeOuts     ?? 0,
          avg:  stat.avg            ?? '—',
          hr:   stat.homeRuns       ?? 0,
          lob:  stat.leftOnBase     ?? 0,
          sb:   stat.stolenBases    ?? 0,
          note: p.gameStatus?.isCurrentBatter ? '▶' : '',
        };
      });
    };

    // ── Box score — pitchers
    const buildPitchers = (teamSide) => {
      const pitchers = bs.teams?.[teamSide]?.pitchers ?? [];
      const players   = bs.teams?.[teamSide]?.players ?? {};
      return pitchers.map(id => {
        const p    = players[`ID${id}`] ?? {};
        const stat = p.stats?.pitching  ?? {};
        return {
          id,
          name:  p.person?.fullName ?? '—',
          ip:    stat.inningsPitched ?? '0.0',
          h:     stat.hits           ?? 0,
          r:     stat.runs           ?? 0,
          er:    stat.earnedRuns     ?? 0,
          bb:    stat.baseOnBalls    ?? 0,
          k:     stat.strikeOuts     ?? 0,
          hr:    stat.homeRuns       ?? 0,
          era:   stat.era            ?? '—',
          pc:    stat.pitchesThrown  ?? 0,
          strikes: stat.strikes      ?? 0,
          note:  p.gameStatus?.isCurrentPitcher ? '▶' : '',
          decision: p.stats?.pitching?.wins     ? 'W' :
                    p.stats?.pitching?.losses   ? 'L' :
                    p.stats?.pitching?.saves    ? 'S' : '',
        };
      });
    };

    const boxScore = {
      away: {
        batters:  buildBatters('away'),
        pitchers: buildPitchers('away'),
        info:     bs.teams?.away?.teamStats?.batting  ?? {},
        pitInfo:  bs.teams?.away?.teamStats?.pitching ?? {},
        notes:    bs.teams?.away?.note ?? [],
      },
      home: {
        batters:  buildBatters('home'),
        pitchers: buildPitchers('home'),
        info:     bs.teams?.home?.teamStats?.batting  ?? {},
        pitInfo:  bs.teams?.home?.teamStats?.pitching ?? {},
        notes:    bs.teams?.home?.note ?? [],
      },
    };

    // ── Win probability (from dedicated endpoint, fallback to calculated)
    let homeWinPct = 50;
    let wpHistory  = [];
    if (wpData && Array.isArray(wpData) && wpData.length > 0) {
      const last   = wpData[wpData.length - 1];
      homeWinPct   = Math.round((last.homeTeamWinProbability ?? 50));
      // Sample every ~5 plays for chart
      wpHistory    = wpData
        .filter((_,i) => i % Math.max(1, Math.floor(wpData.length / 40)) === 0)
        .map(p => ({
          inning:  p.atBatIndex,
          homePct: Math.round(p.homeTeamWinProbability ?? 50),
        }));
    } else if (isLive) {
      const diff    = linescore.homeRuns - linescore.awayRuns;
      const inning  = linescore.currentInning ?? 1;
      homeWinPct    = Math.min(97, Math.max(3, 50 + diff * inning * 3.5));
    } else if (isFinal) {
      homeWinPct    = linescore.homeRuns > linescore.awayRuns ? 100 : 0;
    }

    // ── Game info
    const gameInfo = {
      gamePk,
      status,
      detailStatus,
      isLive,
      isFinal,
      isPreview:   status === 'Preview',
      gameDate:    gameData.datetime?.dateTime ?? '',
      venue:       gameData.venue?.name        ?? '',
      weather:     gameData.weather            ?? null,
      home: {
        id:     homeTeam.id,
        name:   homeTeam.name,
        abbr:   homeTeam.abbreviation,
        record: `${homeTeam.record?.wins ?? 0}-${homeTeam.record?.losses ?? 0}`,
      },
      away: {
        id:     awayTeam.id,
        name:   awayTeam.name,
        abbr:   awayTeam.abbreviation,
        record: `${awayTeam.record?.wins ?? 0}-${awayTeam.record?.losses ?? 0}`,
      },
    };

    // Set cache header based on game state
    const cacheSeconds = isLive ? 0 : isFinal ? 3600 : 30;
    res.setHeader('Cache-Control', `s-maxage=${cacheSeconds}, stale-while-revalidate=10`);

    return res.status(200).json({
      gameInfo,
      linescore,
      bases,
      currentAtBat,
      allPlays,
      scoringPlays,
      boxScore,
      homeWinPct,
      wpHistory,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}