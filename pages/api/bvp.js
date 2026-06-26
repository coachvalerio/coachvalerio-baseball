// pages/api/bvp.js
// #9 Batter vs Pitcher career matchup data from MLB Stats API
// ?batter=592450&pitcher=554430

const TIMEOUT = ms => AbortSignal.timeout(ms);

async function fetchJSON(url, ms = 8000) {
  try {
    const r = await fetch(url, { signal: TIMEOUT(ms) });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
  const { batter, pitcher } = req.query;
  if (!batter || !pitcher) return res.status(400).json({ error: 'Need batter and pitcher IDs' });

  const season = new Date().getFullYear();

  const [bvpData, batterInfo, pitcherInfo, batterStats, pitcherStats] = await Promise.all([
    // Career BvP splits
    fetchJSON(`https://statsapi.mlb.com/api/v1/people/${batter}/stats?stats=vsPlayer&opposingPlayerId=${pitcher}&group=hitting`),
    fetchJSON(`https://statsapi.mlb.com/api/v1/people/${batter}`),
    fetchJSON(`https://statsapi.mlb.com/api/v1/people/${pitcher}`),
    fetchJSON(`https://statsapi.mlb.com/api/v1/people/${batter}/stats?stats=season&season=${season}&group=hitting`),
    fetchJSON(`https://statsapi.mlb.com/api/v1/people/${pitcher}/stats?stats=season&season=${season}&group=pitching`),
  ]);

  // Extract BvP career + season splits
  const splits = bvpData?.stats ?? [];
  let career = null, thisSeason = null;
  for (const s of splits) {
    const type = s.type?.displayName;
    for (const sp of (s.splits ?? [])) {
      if (type === 'vsPlayerTotal') career = sp.stat;
      if (type === 'vsPlayer' && String(sp.season) === String(season)) thisSeason = sp.stat;
    }
  }

  res.status(200).json({
    batter: {
      id: parseInt(batter),
      name: batterInfo?.people?.[0]?.fullName ?? '—',
      team: batterInfo?.people?.[0]?.currentTeam?.abbreviation ?? '',
      bats: batterInfo?.people?.[0]?.batSide?.code ?? '',
      seasonStats: batterStats?.stats?.[0]?.splits?.[0]?.stat ?? null,
    },
    pitcher: {
      id: parseInt(pitcher),
      name: pitcherInfo?.people?.[0]?.fullName ?? '—',
      team: pitcherInfo?.people?.[0]?.currentTeam?.abbreviation ?? '',
      throws: pitcherInfo?.people?.[0]?.pitchHand?.code ?? '',
      seasonStats: pitcherStats?.stats?.[0]?.splits?.[0]?.stat ?? null,
    },
    bvp: { career, season: thisSeason },
  });
}