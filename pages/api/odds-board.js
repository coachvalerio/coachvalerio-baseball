// pages/api/odds-board.js
// Combines The Odds API (game lines) with MLB Stats API (win probability + schedule)
// to surface where the market disagrees with the data.
// ODDS_API_KEY in .env.local is required for live lines.
// Without it, returns schedule + model probabilities only.

const safeFetch = async (url) => {
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
};

// Convert American odds → implied probability (0-100)
function impliedProb(american) {
  const n = parseFloat(american);
  if (isNaN(n)) return null;
  return n > 0
    ? Math.round(100 / (n + 100) * 1000) / 10
    : Math.round(Math.abs(n) / (Math.abs(n) + 100) * 1000) / 10;
}

// Vig-removed probability (devigged from both sides)
function devig(homeOdds, awayOdds) {
  const h = impliedProb(homeOdds);
  const a = impliedProb(awayOdds);
  if (!h || !a) return null;
  const total = h + a;
  return { home: Math.round(h / total * 1000) / 10, away: Math.round(a / total * 1000) / 10 };
}

// Value edge: model prob minus devigged market prob
function valueEdge(modelPct, marketPct) {
  if (!modelPct || !marketPct) return null;
  return Math.round((modelPct - marketPct) * 10) / 10;
}

// Value tier label
function valueTier(edge) {
  if (edge === null) return null;
  if (edge >= 8)  return { label: '🔥 Strong Value', color: '#00c2a8', rank: 4 };
  if (edge >= 4)  return { label: '✅ Lean Value',   color: '#2ed47a', rank: 3 };
  if (edge >= 2)  return { label: '👀 Slight Edge',  color: '#f5a623', rank: 2 };
  if (edge <= -5) return { label: '⚠ Fading',        color: '#e63535', rank: 1 };
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=30');
  res.setHeader('Content-Type', 'application/json');

  const apiKey = process.env.ODDS_API_KEY;
  const today  = new Date().toISOString().split('T')[0];

  // ── 1. MLB Schedule (free) ───────────────────────────────────────────────
  const schedData = await safeFetch(
    `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${today}&hydrate=team,probablePitcher,linescore,weather`
  );

  const mlbGames = (schedData?.dates?.[0]?.games ?? []).map(g => {
    const gamePk    = g.gamePk;
    const status    = g.status?.abstractGameState ?? 'Preview';
    const isLive    = status === 'Live';
    const isFinal   = status === 'Final';
    const inning    = g.linescore?.currentInning ?? null;
    const inningHalf= g.linescore?.inningHalf ?? '';
    const homeScore = g.linescore?.teams?.home?.runs ?? null;
    const awayScore = g.linescore?.teams?.away?.runs ?? null;
    return {
      gamePk,
      status, isLive, isFinal, inning, inningHalf, homeScore, awayScore,
      gameDate:  g.gameDate,
      venue:     g.venue?.name ?? '',
      seriesDesc: g.seriesDescription ?? '',
      home: {
        id:     g.teams?.home?.team?.id,
        name:   g.teams?.home?.team?.name ?? '',
        abbr:   g.teams?.home?.team?.abbreviation ?? '',
        record: `${g.teams?.home?.leagueRecord?.wins ?? 0}-${g.teams?.home?.leagueRecord?.losses ?? 0}`,
        pitcher: g.teams?.home?.probablePitcher?.fullName ?? null,
        pitcherId: g.teams?.home?.probablePitcher?.id ?? null,
      },
      away: {
        id:     g.teams?.away?.team?.id,
        name:   g.teams?.away?.team?.name ?? '',
        abbr:   g.teams?.away?.team?.abbreviation ?? '',
        record: `${g.teams?.away?.leagueRecord?.wins ?? 0}-${g.teams?.away?.leagueRecord?.losses ?? 0}`,
        pitcher: g.teams?.away?.probablePitcher?.fullName ?? null,
        pitcherId: g.teams?.away?.probablePitcher?.id ?? null,
      },
      weather: g.weather ?? null,
    };
  });

  // ── 2. Win probability from live feed (parallel, only for started games) ─
  const liveGames = mlbGames.filter(g => g.isLive || g.isFinal);
  const wpMap = {};
  await Promise.all(liveGames.slice(0, 8).map(async g => {
    const feed = await safeFetch(
      `https://statsapi.mlb.com/api/v1/game/${g.gamePk}/winProbability`
    );
    if (feed && Array.isArray(feed) && feed.length > 0) {
      const last = feed[feed.length - 1];
      wpMap[g.gamePk] = Math.round(last.homeTeamWinProbability ?? 50);
    }
  }));

  // ── 3. The Odds API (game lines) ─────────────────────────────────────────
  let oddsMap    = {}; // keyed by normalized team name pairs
  let oddsQuota  = null;
  let oddsError  = null;
  let oddsRawCount = 0;

  if (apiKey) {
    // Try both regular-season and spring-training sport keys
    const sportKeys = ['baseball_mlb', 'baseball_mlb_preseason'];
    for (const sportKey of sportKeys) {
      const oddsUrl = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?apiKey=${apiKey}&regions=us&markets=h2h,spreads,totals&oddsFormat=american`;
      try {
        const oddsRes = await fetch(oddsUrl, { signal: AbortSignal.timeout(6000) });
        oddsQuota = {
          remaining: oddsRes.headers.get('x-requests-remaining'),
          used:      oddsRes.headers.get('x-requests-used'),
        };
        if (oddsRes.ok) {
          const raw = await oddsRes.json();
          if (Array.isArray(raw) && raw.length > 0) {
            oddsRawCount += raw.length;
            for (const event of raw) {
              const key = `${event.home_team}|${event.away_team}`;
              const lines = { moneyline: {}, runline: {}, total: {} };

              for (const bk of (event.bookmakers ?? [])) {
                for (const market of (bk.markets ?? [])) {
                  if (market.key === 'h2h') {
                    for (const o of market.outcomes) {
                      const side = o.name === event.home_team ? 'home' : 'away';
                      if (!lines.moneyline[side] || bk.key === 'fanduel') {
                        lines.moneyline[side] = { price: o.price, book: bk.title };
                      }
                    }
                  }
                  if (market.key === 'spreads') {
                    for (const o of market.outcomes) {
                      const side = o.name === event.home_team ? 'home' : 'away';
                      if (!lines.runline[side] || bk.key === 'fanduel') {
                        lines.runline[side] = { price: o.price, point: o.point, book: bk.title };
                      }
                    }
                  }
                  if (market.key === 'totals') {
                    if (!lines.total.over && market.outcomes?.length) {
                      const over  = market.outcomes.find(o => o.name === 'Over');
                      const under = market.outcomes.find(o => o.name === 'Under');
                      lines.total = {
                        line:  over?.point ?? null,
                        over:  { price: over?.price,  book: bk.title },
                        under: { price: under?.price, book: bk.title },
                      };
                    }
                  }
                }
              }
              oddsMap[key] = lines;
            }
          }
        } else if (!oddsRes.ok) {
          const errBody = await oddsRes.text();
          // 422 = sport key not found (spring training not available), continue to next key
          if (!oddsRes.status === 422) {
            oddsError = errBody.slice(0, 200);
            break;
          }
        }
      } catch (e) {
        oddsError = e.message;
      }
    }
  }

  // ── 4. Match MLB games to odds, compute edges ─────────────────────────────
  // Normalize: lowercase last word of team name (e.g. "Astros", "Red Sox" → "sox")
  const teamKey = name => name?.toLowerCase().split(' ').pop() ?? '';
  const nameMatch = (mlbName, oddsName) => {
    if (!mlbName || !oddsName) return false;
    const ml = mlbName.toLowerCase();
    const od = oddsName.toLowerCase();
    return ml === od || ml.includes(teamKey(oddsName)) || od.includes(teamKey(mlbName));
  };

  const games = mlbGames.map(g => {
    let matchedLines = null;
    for (const [key, lines] of Object.entries(oddsMap)) {
      const [oddsHome, oddsAway] = key.split('|');
      if (nameMatch(g.home.name, oddsHome) && nameMatch(g.away.name, oddsAway)) {
        matchedLines = lines; break;
      }
      // Try reversed (odds API sometimes flips home/away)
      if (nameMatch(g.home.name, oddsAway) && nameMatch(g.away.name, oddsHome)) {
        matchedLines = {
          moneyline: { home: lines.moneyline.away, away: lines.moneyline.home },
          runline:   { home: lines.runline.away,   away: lines.runline.home },
          total:     lines.total,
        };
        break;
      }
    }

    // Model probability (from live feed or pre-game estimate)
    const modelHomePct = wpMap[g.gamePk] ?? null;
    const modelAwayPct = modelHomePct !== null ? 100 - modelHomePct : null;

    // Market probabilities (devigged)
    const mlHome = matchedLines?.moneyline?.home?.price;
    const mlAway = matchedLines?.moneyline?.away?.price;
    const dvg    = mlHome && mlAway ? devig(mlHome, mlAway) : null;

    // Value edges
    const homeEdge = valueEdge(modelHomePct, dvg?.home ?? null);
    const awayEdge = valueEdge(modelAwayPct, dvg?.away ?? null);

    const homeTier = homeEdge !== null ? valueTier(homeEdge) : null;
    const awayTier = awayEdge !== null ? valueTier(awayEdge) : null;

    // Best bet of the game
    let bestBet = null;
    if (homeTier && awayTier) {
      bestBet = homeTier.rank >= awayTier.rank ? { side: 'home', ...homeTier, edge: homeEdge } : { side: 'away', ...awayTier, edge: awayEdge };
    } else if (homeTier) bestBet = { side: 'home', ...homeTier, edge: homeEdge };
    else if (awayTier)   bestBet = { side: 'away', ...awayTier, edge: awayEdge };

    // Weather impact on total
    let weatherNote = null;
    if (g.weather?.temp) {
      const temp  = parseInt(g.weather.temp);
      const wind  = parseInt(g.weather.wind?.speed ?? 0);
      const windDir = g.weather.wind?.direction ?? '';
      if (temp >= 80 && wind >= 10 && /out|center/i.test(windDir)) weatherNote = '🚀 Wind blowing out — favor OVER';
      else if (temp <= 50) weatherNote = '🥶 Cold weather — favor UNDER';
      else if (wind >= 15 && /in/i.test(windDir)) weatherNote = '💨 Wind blowing in — favor UNDER';
    }

    return {
      gamePk: g.gamePk,
      status: g.status, isLive: g.isLive, isFinal: g.isFinal,
      inning: g.inning, inningHalf: g.inningHalf,
      homeScore: g.homeScore, awayScore: g.awayScore,
      gameDate: g.gameDate, venue: g.venue,
      home: g.home, away: g.away,
      weather: g.weather, weatherNote,
      odds: matchedLines,
      hasOdds: !!matchedLines,
      model: {
        homePct: modelHomePct,
        awayPct: modelAwayPct,
        source:  modelHomePct ? 'MLB Live Feed' : 'Pre-game',
      },
      market: dvg ? { homePct: dvg.home, awayPct: dvg.away } : null,
      homeEdge, awayEdge,
      homeTier, awayTier, bestBet,
    };
  });

  // Sort: value games first, then by game time
  games.sort((a, b) => {
    const aRank = Math.max(a.homeTier?.rank ?? 0, a.awayTier?.rank ?? 0);
    const bRank = Math.max(b.homeTier?.rank ?? 0, b.awayTier?.rank ?? 0);
    if (bRank !== aRank) return bRank - aRank;
    return new Date(a.gameDate) - new Date(b.gameDate);
  });

  res.status(200).json({
    games,
    date: today,
    hasApiKey: !!apiKey,
    oddsQuota,
    oddsError,
    oddsRawCount,
    gamesWithOdds: games.filter(g => g.hasOdds).length,
    valueGames:    games.filter(g => g.bestBet?.rank >= 3).length,
  });
}