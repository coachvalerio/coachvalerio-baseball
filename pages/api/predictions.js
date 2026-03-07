// pages/api/predictions.js
// Fetches today's opponent starting pitcher + their Savant stats
// Returns matchup adjustment data for the Prediction tab

const PARK_FACTORS = {
  1: 1.08,  // BAL - Camden Yards (HR-friendly)
  2: 0.94,  // BOS - Fenway
  3: 1.05,  // NYY - Yankee Stadium
  4: 0.95,  // TB  - Tropicana
  5: 0.97,  // TOR - Rogers Centre
  6: 0.90,  // CWS - Guaranteed Rate (pitcher-friendly)
  7: 1.02,  // CLE - Progressive
  8: 1.00,  // DET - Comerica
  9: 1.06,  // KC  - Kauffman
  10: 0.97, // MIN - Target Field
  11: 1.10, // HOU - Minute Maid (Crawford Boxes)
  12: 0.93, // LAA - Angel Stadium
  13: 0.96, // OAK - Oakland Coliseum
  14: 0.91, // SEA - T-Mobile (pitcher-friendly)
  15: 1.04, // TEX - Globe Life
  16: 1.07, // ATL - Truist Park
  17: 0.96, // MIA - loanDepot park (dome)
  18: 1.09, // NYM - Citi Field
  19: 1.06, // PHI - Citizens Bank Park
  20: 0.95, // WSH - Nationals Park
  21: 0.98, // CHC - Wrigley Field
  22: 1.08, // CIN - Great American Ball Park
  23: 0.96, // MIL - American Family Field
  24: 0.94, // PIT - PNC Park
  25: 1.00, // STL - Busch Stadium
  26: 0.98, // ARI - Chase Field (retractable)
  27: 1.11, // COL - Coors Field
  28: 1.00, // LAD - Dodger Stadium
  29: 0.95, // SD  - Petco Park
  30: 0.97, // SF  - Oracle Park
};

// Map MLB team IDs to park factor keys (ordered by team ID)
const TEAM_PARK_FACTOR = {
  110: 1.08, // BAL
  111: 0.94, // BOS
  147: 1.05, // NYY
  139: 0.95, // TB
  141: 0.97, // TOR
  145: 0.90, // CWS
  114: 1.02, // CLE
  116: 1.00, // DET
  118: 1.06, // KC
  142: 0.97, // MIN
  117: 1.10, // HOU
  108: 0.93, // LAA
  133: 0.96, // OAK
  136: 0.91, // SEA
  140: 1.04, // TEX
  144: 1.07, // ATL
  146: 0.96, // MIA
  121: 1.09, // NYM
  143: 1.06, // PHI
  120: 0.95, // WSH
  112: 0.98, // CHC
  113: 1.08, // CIN
  158: 0.96, // MIL
  134: 0.94, // PIT
  138: 1.00, // STL
  109: 0.98, // ARI
  115: 1.11, // COL
  119: 1.00, // LAD
  135: 0.95, // SD
  137: 0.97, // SF
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=120');
  const { playerId } = req.query;
  if (!playerId) return res.status(400).json({ error: 'Missing playerId' });

  const safeFetch = async (url) => {
    try {
      const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!r.ok) return null;
      return await r.json();
    } catch { return null; }
  };

  const today = new Date().toISOString().slice(0, 10);

  try {
    // 1. Find today's game for this player via the schedule
    const schedData = await safeFetch(
      `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${today}&hydrate=team,probablePitcher,linescore`
    );

    if (!schedData?.dates?.[0]?.games?.length) {
      return res.status(200).json({ hasGame: false, reason: 'No MLB games today' });
    }

    const games = schedData.dates[0].games;

    // 2. Find which game this player's team is in
    //    First get this player's current team
    const playerData = await safeFetch(
      `https://statsapi.mlb.com/api/v1/people/${playerId}?hydrate=currentTeam`
    );
    const player = playerData?.people?.[0];
    if (!player) return res.status(200).json({ hasGame: false, reason: 'Player not found' });

    const teamId = player.currentTeam?.id;
    const playerName = player.fullName;
    const isPitcher = ['P', 'SP', 'RP'].includes(player.primaryPosition?.abbreviation);

    const game = games.find(g =>
      g.teams?.home?.team?.id === teamId ||
      g.teams?.away?.team?.id === teamId
    );

    if (!game) {
      return res.status(200).json({ hasGame: false, reason: `${playerName} has no game today` });
    }

    const isHome = game.teams?.home?.team?.id === teamId;
    const oppTeam = isHome ? game.teams.away.team : game.teams.home.team;
    const homeTeam = game.teams.home.team;
    const parkFactor = TEAM_PARK_FACTOR[homeTeam.id] ?? 1.00;

    // 3. Get opposing probable pitcher
    const oppSide = isHome ? game.teams.away : game.teams.home;
    const probPitcher = oppSide.probablePitcher;

    const gameInfo = {
      gamePk:    game.gamePk,
      gameTime:  game.gameDate,
      venue:     game.venue?.name ?? '',
      homeTeam:  homeTeam.name,
      oppTeam:   oppTeam.name,
      oppTeamId: oppTeam.id,
      isHome,
      parkFactor,
      status:    game.status?.detailedState ?? 'Scheduled',
    };

    if (!probPitcher) {
      return res.status(200).json({
        hasGame: true,
        gameInfo,
        pitcher: null,
        matchup: null,
        reason: 'Probable pitcher not yet announced',
      });
    }

    const pitcherId   = probPitcher.id;
    const pitcherName = probPitcher.fullName;

    // 4. Get pitcher's season stats
    const pitcherStatsData = await safeFetch(
      `https://statsapi.mlb.com/api/v1/people/${pitcherId}/stats?stats=season&group=pitching&season=${new Date().getFullYear()}`
    );
    const pitcherStat = pitcherStatsData?.stats?.[0]?.splits?.[0]?.stat ?? {};

    // 5. Get pitcher's Savant data (exit velo allowed, barrel%, hard hit%, whiff%)
    const season = new Date().getFullYear();
    let savantPitcher = null;
    try {
      const savantRes = await fetch(
        `https://baseballsavant.mlb.com/leaderboard/statcast?year=${season}&position=1&team=&min=1&csv=true`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } }
      );
      if (savantRes.ok) {
        const csv = await savantRes.text();
        const lines = csv.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const idIdx    = headers.indexOf('player_id');
        const evoIdx   = headers.indexOf('avg_hit_speed');
        const laIdx    = headers.indexOf('avg_launch_angle');
        const hhIdx    = headers.indexOf('hard_hit_percent');
        const brlIdx   = headers.indexOf('brl_pa');
        const whiffIdx = headers.indexOf('whiff_percent');

        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          const cols = lines[i].split(',');
          if (cols[idIdx]?.trim() === String(pitcherId)) {
            savantPitcher = {
              exitVeloAllowed:   parseFloat(cols[evoIdx])   || null,
              launchAngle:       parseFloat(cols[laIdx])    || null,
              hardHitAllowed:    parseFloat(cols[hhIdx])    || null,
              barrelAllowed:     parseFloat(cols[brlIdx])   || null,
              whiffPct:          parseFloat(cols[whiffIdx]) || null,
            };
            break;
          }
        }
      }
    } catch {}

    // 6. Calculate matchup adjustment
    const era   = parseFloat(pitcherStat.era   ?? 4.50);
    const whip  = parseFloat(pitcherStat.whip  ?? 1.30);
    const k9    = parseFloat(pitcherStat.strikeoutsPer9Inn ?? 8.5);
    const bb9   = parseFloat(pitcherStat.walksPer9Inn      ?? 3.5);
    const ip    = parseFloat(pitcherStat.inningsPitched    ?? 0);

    // Pitcher quality score (0-100, higher = tougher for hitter)
    const eraScore  = Math.min(100, Math.max(0, ((6.00 - era)  / 4.50) * 100));
    const whipScore = Math.min(100, Math.max(0, ((2.00 - whip) / 1.20) * 100));
    const k9Score   = Math.min(100, (k9 / 14.0) * 100);
    const pitcherQuality = Math.round(eraScore * 0.40 + whipScore * 0.35 + k9Score * 0.25);

    // Difficulty tier
    const difficulty =
      pitcherQuality >= 75 ? 'ACE'       :
      pitcherQuality >= 60 ? 'TOUGH'     :
      pitcherQuality >= 45 ? 'AVERAGE'   :
      pitcherQuality >= 30 ? 'HITTABLE'  : 'VULNERABLE';

    // Adjustment multiplier applied to hitter probabilities
    // Ace (75+) = -15% to probs, Vulnerable (<30) = +12%
    const hitAdj  = pitcherQuality >= 75 ? -0.15 :
                    pitcherQuality >= 60 ? -0.08 :
                    pitcherQuality >= 45 ?  0.00 :
                    pitcherQuality >= 30 ?  0.06 : 0.12;

    const parkAdj = parkFactor - 1.00; // e.g. Coors = +0.11, Petco = -0.05

    return res.status(200).json({
      hasGame: true,
      gameInfo,
      pitcher: {
        id:         pitcherId,
        name:       pitcherName,
        era:        pitcherStat.era         ?? '—',
        whip:       pitcherStat.whip        ?? '—',
        k9:         pitcherStat.strikeoutsPer9Inn ?? '—',
        bb9:        pitcherStat.walksPer9Inn      ?? '—',
        wins:       pitcherStat.wins        ?? 0,
        losses:     pitcherStat.losses      ?? 0,
        ip:         pitcherStat.inningsPitched ?? '—',
        savant:     savantPitcher,
      },
      matchup: {
        pitcherQuality,
        difficulty,
        hitAdj,
        parkAdj,
        parkFactor,
      },
    });

  } catch (err) {
    return res.status(200).json({ hasGame: false, reason: err.message });
  }
}