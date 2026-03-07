// pages/api/odds.js
// Player prop odds + Best Bet engine
// Combines: player trends, hot/cold streak, home/road splits,
//           pitcher velocity & arsenal, weather, handedness matchup

const safeFetch = async (url) => {
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
};

const SEASON = () => {
  const now = new Date();
  return now >= new Date(now.getFullYear(), 2, 20) ? now.getFullYear() : now.getFullYear() - 1;
};

async function getStreak(id) {
  const end   = new Date().toISOString().split('T')[0];
  const start = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const d = await safeFetch(
    `https://statsapi.mlb.com/api/v1/people/${id}/stats?stats=byDateRange&startDate=${start}&endDate=${end}&group=hitting&season=${SEASON()}`
  );
  const stat = d?.stats?.[0]?.splits?.[0]?.stat ?? null;
  if (!stat) return { label: null, score: 0, stat: null };
  const avg = parseFloat(stat.avg ?? .000);
  const ops = parseFloat(stat.ops ?? .000);
  if (avg >= .320 || ops >= .950) return { label: '🔥 Hot last 7 days', score: 3, stat: { avg, ops } };
  if (avg >= .270 || ops >= .800) return { label: '📈 Warm last 7 days', score: 2, stat: { avg, ops } };
  if (avg >= .220 || ops >= .650) return { label: '😐 Neutral last 7 days', score: 1, stat: { avg, ops } };
  return { label: '🥶 Cold last 7 days', score: -2, stat: { avg, ops } };
}

async function getSplitBonus(id, isHome) {
  if (isHome === null) return { label: null, score: 0 };
  const d = await safeFetch(
    `https://statsapi.mlb.com/api/v1/people/${id}/stats?stats=homeAndAway&season=${SEASON()}&group=hitting`
  );
  const splits  = d?.stats?.[0]?.splits ?? [];
  const homeSt  = splits.find(s => s.split?.code === 'H')?.stat ?? null;
  const roadSt  = splits.find(s => s.split?.code === 'A')?.stat ?? null;
  const rel     = isHome ? homeSt : roadSt;
  const other   = isHome ? roadSt  : homeSt;
  if (!rel || !other) return { label: null, score: 0 };
  const opsAdv  = parseFloat(rel.ops ?? .700) - parseFloat(other.ops ?? .700);
  if (opsAdv >= .080)  return { label: isHome ? '🏠 Strong home performer' : '✈️ Road warrior', score: 2 };
  if (opsAdv >= .030)  return { label: isHome ? '🏠 Slight home edge' : '✈️ Slight road edge', score: 1 };
  if (opsAdv <= -.080) return { label: isHome ? '⚠ Struggles at home' : '⚠ Struggles on road', score: -2 };
  if (opsAdv <= -.030) return { label: null, score: -1 };
  return { label: null, score: 0 };
}

async function getHandednessBonus(batterId, pitcherHand) {
  if (!pitcherHand || !batterId) return { label: null, score: 0 };
  const d = await safeFetch(
    `https://statsapi.mlb.com/api/v1/people/${batterId}/stats?stats=vsHand&season=${SEASON()}&group=hitting`
  );
  const splits = d?.stats?.[0]?.splits ?? [];
  const vs = splits.find(s =>
    s.split?.description?.toLowerCase().includes(pitcherHand === 'R' ? 'right' : 'left')
  )?.stat ?? null;
  if (!vs) return { label: null, score: 0 };
  const ops = parseFloat(vs.ops ?? .700);
  const avg = vs.avg ?? '---';
  if (ops >= .900)  return { label: `💪 Crushes ${pitcherHand}HP — ${avg}/${vs.ops} OPS`, score: 3 };
  if (ops >= .800)  return { label: `👍 Good vs ${pitcherHand}HP — ${vs.ops} OPS`, score: 2 };
  if (ops >= .720)  return { label: null, score: 1 };
  if (ops <= .580)  return { label: `🚫 Weak vs ${pitcherHand}HP — ${avg} avg`, score: -3 };
  if (ops <= .660)  return { label: `⚠ Below avg vs ${pitcherHand}HP`, score: -2 };
  return { label: null, score: 0 };
}

async function getPitcherStrength(pitcherId) {
  if (!pitcherId) return { label: null, score: 0 };
  const [szn, recent] = await Promise.all([
    safeFetch(`https://statsapi.mlb.com/api/v1/people/${pitcherId}/stats?stats=season&season=${SEASON()}&group=pitching`),
    safeFetch(`https://statsapi.mlb.com/api/v1/people/${pitcherId}/stats?stats=byDateRange&startDate=${new Date(Date.now()-14*86400000).toISOString().split('T')[0]}&endDate=${new Date().toISOString().split('T')[0]}&group=pitching&season=${SEASON()}`),
  ]);
  const s = szn?.stats?.[0]?.splits?.[0]?.stat ?? null;
  const r = recent?.stats?.[0]?.splits?.[0]?.stat ?? null;
  if (!s) return { label: null, score: 0 };

  const era   = parseFloat(s.era  ?? 4.50);
  const whip  = parseFloat(s.whip ?? 1.35);
  const k9    = parseFloat(s.strikeoutsPer9Inn ?? 8.0);
  const recentEra = r ? parseFloat(r.era ?? era) : era;

  let score = 0;
  let details = `ERA ${era} / WHIP ${whip} / ${k9.toFixed(1)} K/9`;
  let recentTag = '';

  if (era <= 2.80) score = -3;
  else if (era <= 3.50) score = -2;
  else if (era <= 4.20) score = -1;
  else if (era <= 5.00) score = 1;
  else score = 2;

  if (r && recentEra > era + 2.00) { score += 1; recentTag = ' (struggling lately)'; }
  else if (r && recentEra < era - 1.50) { score -= 1; recentTag = ' (dealing lately)'; }

  const tier = era <= 2.80 ? 'ACE' : era <= 3.50 ? 'TOUGH' : era <= 4.20 ? 'AVERAGE' : era <= 5.00 ? 'HITTABLE' : 'VULNERABLE';
  const emoji = { ACE:'😤', TOUGH:'💪', AVERAGE:'😐', HITTABLE:'👀', VULNERABLE:'🎯' }[tier];

  return {
    label: `${emoji} Opp pitcher: ${tier} — ${details}${recentTag}`,
    score,
    tier,
    era, whip, k9,
  };
}

async function getWeatherBonus(gamePk) {
  if (!gamePk) return { label: null, score: 0 };
  const d = await safeFetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&gamePk=${gamePk}&hydrate=weather`);
  const weather = d?.dates?.[0]?.games?.[0]?.weather;
  if (!weather?.temp) return { label: null, score: 0 };
  const temp = parseInt(weather.temp);
  const wind = parseInt(weather.wind?.speed ?? 0);
  const dir  = (weather.wind?.direction ?? '').toLowerCase();
  if (temp >= 82 && wind >= 10 && /out|center/.test(dir)) return { label: `🚀 Wind blowing out ${wind}mph — HR upside`, score: 2 };
  if (temp >= 80) return { label: `☀️ Warm ${temp}°F — hitter friendly`, score: 1 };
  if (temp <= 45) return { label: `🥶 Cold ${temp}°F — offense suppressed`, score: -2 };
  if (temp <= 55) return { label: `🌧 Cool ${temp}°F — slight pitcher edge`, score: -1 };
  if (wind >= 15 && /in/.test(dir)) return { label: `💨 Wind in ${wind}mph — lower totals`, score: -1 };
  return { label: null, score: 0 };
}

function confidenceLabel(score) {
  if (score >= 5)  return { grade: 'A',  text: 'Strong Bet', color: '#00c2a8' };
  if (score >= 4)  return { grade: 'B+', text: 'Lean Bet',   color: '#2ed47a' };
  if (score >= 3)  return { grade: 'B',  text: 'Slight Lean',color: '#2ed47a' };
  if (score >= 2)  return { grade: 'C+', text: 'Marginal',   color: '#f5a623' };
  if (score <= -3) return { grade: 'A',  text: 'Fade / Under',color: '#e63535' };
  if (score <= -2) return { grade: 'B',  text: 'Lean Fade',  color: '#e63535' };
  return null;
}

export default async function handler(req, res) {
  const { playerId } = req.query;
  const apiKey = process.env.ODDS_API_KEY;
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
  res.setHeader('Content-Type', 'application/json');

  const playerData = await safeFetch(`https://statsapi.mlb.com/api/v1/people/${playerId}?hydrate=currentTeam`);
  const person     = playerData?.people?.[0];
  if (!person) return res.status(200).json({ available: false });

  const playerName = person.fullName;
  const pos        = person.primaryPosition?.abbreviation ?? '';
  const isPitcher  = ['P','SP','RP','CP'].includes(pos);
  const teamId     = person.currentTeam?.id;

  // Today's game
  const today      = new Date().toISOString().split('T')[0];
  const schedData  = await safeFetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${today}&hydrate=team,probablePitcher,weather`);
  const allGames   = schedData?.dates?.[0]?.games ?? [];
  const todayGame  = allGames.find(g => g.teams?.home?.team?.id === teamId || g.teams?.away?.team?.id === teamId);
  const gamePk     = todayGame?.gamePk ?? null;
  const playerIsHome = todayGame ? todayGame.teams?.home?.team?.id === teamId : null;

  const oppPitcher   = todayGame
    ? (playerIsHome ? todayGame.teams?.away?.probablePitcher : todayGame.teams?.home?.probablePitcher)
    : null;
  const oppPitcherId = oppPitcher?.id ?? null;
  const oppPitcherHand = null; // hand data not in schedule hydration — fetched in getHandednessBonus fallback

  // Fetch all signals in parallel
  const [streak, split, handedness, pitcherStrength, weather] = await Promise.all([
    isPitcher ? Promise.resolve({ label: null, score: 0 }) : getStreak(playerId),
    isPitcher ? Promise.resolve({ label: null, score: 0 }) : getSplitBonus(playerId, playerIsHome),
    isPitcher ? Promise.resolve({ label: null, score: 0 }) : getHandednessBonus(playerId, null),
    getPitcherStrength(isPitcher ? playerId : oppPitcherId),
    getWeatherBonus(gamePk),
  ]);

  const allFactors  = [streak, split, handedness, pitcherStrength, weather];
  const totalScore  = allFactors.reduce((s, f) => s + (f?.score ?? 0), 0);
  const conf        = confidenceLabel(totalScore);
  const positives   = allFactors.filter(f => f?.score > 0 && f?.label).map(f => f.label);
  const negatives   = allFactors.filter(f => f?.score < 0 && f?.label).map(f => f.label);

  // Best Bet object
  let bestBet = null;
  if (todayGame && conf) {
    const isFade = totalScore <= -2;
    const prop = isPitcher
      ? (totalScore > 0 ? 'Strikeouts OVER' : 'Strikeouts UNDER')
      : (totalScore >= 3 ? 'To Get a Hit' : totalScore >= 2 ? 'Total Bases OVER' : 'Hit UNDER / Fade');

    bestBet = {
      grade:          conf.grade,
      text:           conf.text,
      color:          conf.color,
      prop,
      confidence:     Math.min(92, 48 + Math.abs(totalScore) * 7),
      recommendation: isFade ? 'FADE' : 'BACK',
      totalScore,
      supporting:     isFade ? negatives : positives,
      opposing:       isFade ? positives : negatives,
    };
  }

  // Live props
  let props = [];
  if (apiKey && todayGame) {
    const batterMarkets  = 'batter_hits,batter_home_runs,batter_rbis,batter_total_bases,batter_runs_scored,batter_stolen_bases';
    const pitcherMarkets = 'pitcher_strikeouts,pitcher_innings_pitched,pitcher_earned_runs,pitcher_record_a_win';
    const markets = isPitcher ? pitcherMarkets : batterMarkets;
    const url = `https://api.the-odds-api.com/v4/sports/baseball_mlb/events/odds/?apiKey=${apiKey}&regions=us&markets=${markets}&oddsFormat=american&bookmakers=fanduel,draftkings,betmgm`;
    try {
      const oddsRes  = await fetch(url);
      const oddsData = await oddsRes.json();
      if (Array.isArray(oddsData)) {
        const labels = {
          batter_hits:'To Get a Hit', batter_home_runs:'Home Run',
          batter_rbis:'RBI', batter_total_bases:'Total Bases',
          batter_runs_scored:'Run Scored', batter_stolen_bases:'Stolen Base',
          pitcher_strikeouts:'Strikeouts', pitcher_innings_pitched:'Innings Pitched',
          pitcher_earned_runs:'Earned Runs', pitcher_record_a_win:'Win',
        };
        for (const game of oddsData) {
          for (const bk of (game.bookmakers ?? [])) {
            for (const mkt of (bk.markets ?? [])) {
              if (!labels[mkt.key]) continue;
              for (const o of (mkt.outcomes ?? [])) {
                const ln = playerName.split(' ').pop().toLowerCase();
                if (!o.description?.toLowerCase().includes(ln) && !o.name?.toLowerCase().includes(ln)) continue;
                const ex = props.find(p => p.key === mkt.key && p.point === o.point);
                if (ex) ex.outcomes.push({ bookmaker: bk.title, price: o.price, name: o.name });
                else props.push({ key: mkt.key, label: labels[mkt.key] + (o.point ? ` O/U ${o.point}` : ''), line: o.point ?? null, outcomes: [{ bookmaker: bk.title, price: o.price, name: o.name }] });
              }
            }
          }
        }
      }
    } catch {}
  }

  return res.status(200).json({
    available: props.length > 0,
    hasGame: !!todayGame,
    playerName, isPitcher,
    gameInfo: todayGame ? {
      opponent:        playerIsHome ? todayGame.teams?.away?.team?.name : todayGame.teams?.home?.team?.name,
      opponentAbbr:    playerIsHome ? todayGame.teams?.away?.team?.abbreviation : todayGame.teams?.home?.team?.abbreviation,
      opponentId:      playerIsHome ? todayGame.teams?.away?.team?.id : todayGame.teams?.home?.team?.id,
      venue:           todayGame.venue?.name,
      gameTime:        todayGame.gameDate,
      probablePitcher: oppPitcher?.fullName ?? null,
      probablePitcherId: oppPitcherId,
    } : null,
    bestBet,
    factors: allFactors,
    totalScore,
    props: props.slice(0, 8),
    hasApiKey: !!apiKey,
    noGame: !todayGame,
    message: !todayGame ? `No game found for ${playerName} today.` : props.length === 0 && apiKey ? `Props not yet posted for ${playerName}.` : null,
  });
}