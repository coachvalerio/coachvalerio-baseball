// pages/api/team.js
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing team id' });

  const season = new Date().getFullYear();

  // Safe fetch wrapper — never throws, returns null on any failure
  const safeFetch = async (url) => {
    try {
      const r = await fetch(url);
      if (!r.ok) return null;
      return await r.json();
    } catch { return null; }
  };

  // ── Wave 1: all independent fetches in parallel
  const [teamData, rosterData, standingsData, teamHitData, teamPitData, newsData] = await Promise.all([
    safeFetch(`https://statsapi.mlb.com/api/v1/teams/${id}?hydrate=venue,division,league`),
    safeFetch(`https://statsapi.mlb.com/api/v1/teams/${id}/roster?rosterType=fullRoster&season=${season}`),
    safeFetch(`https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=${season}&standingsTypes=regularSeason&hydrate=team,division`),
    safeFetch(`https://statsapi.mlb.com/api/v1/teams/${id}/stats?stats=season&season=${season}&group=hitting`),
    safeFetch(`https://statsapi.mlb.com/api/v1/teams/${id}/stats?stats=season&season=${season}&group=pitching`),
    safeFetch(`https://statsapi.mlb.com/api/v1/transactions?teamId=${id}&startDate=${daysAgo(30)}&endDate=${today()}&sportId=1`),
  ]);

  const rawTeam = teamData?.teams?.[0];
  if (!rawTeam) {
    return res.status(404).json({ error: `No team found for id=${id}. MLB API returned: ${JSON.stringify(teamData)?.slice(0,200)}` });
  }

  // ── Wave 2: batch player stats (optional — page works without it)
  const playerIds = (rosterData?.roster ?? []).map(p => p.person?.id).filter(Boolean);
  let playerStatsMap = {};
  if (playerIds.length > 0) {
    const chunks = [];
    for (let i = 0; i < playerIds.length; i += 40) chunks.push(playerIds.slice(i, i + 40));
    await Promise.all(chunks.map(async (chunk) => {
      const d = await safeFetch(
        `https://statsapi.mlb.com/api/v1/people?personIds=${chunk.join(',')}&hydrate=stats(group=[hitting,pitching],type=season,season=${season})`
      );
      for (const p of d?.people ?? []) {
        playerStatsMap[p.id] = p.stats ?? [];
      }
    }));
  }

  // ── Build roster
  const roster = (rosterData?.roster ?? []).map(p => {
    const person  = p.person ?? {};
    const pos     = p.position?.abbreviation ?? '—';
    const pStats  = playerStatsMap[person.id] ?? [];
    const hitStat = pStats.find(s => s.group?.displayName === 'hitting')?.splits?.[0]?.stat ?? null;
    const pitStat = pStats.find(s => s.group?.displayName === 'pitching')?.splits?.[0]?.stat ?? null;
    return {
      id:       person.id,
      name:     person.fullName ?? '—',
      number:   p.jerseyNumber ?? '—',
      pos,
      status:   p.status?.description ?? 'Active',
      hitting:  hitStat ? {
        avg: hitStat.avg,        hr:  hitStat.homeRuns,     rbi: hitStat.rbi,
        ops: hitStat.ops,        sb:  hitStat.stolenBases,  g:   hitStat.gamesPlayed,
        h:   hitStat.hits,       bb:  hitStat.baseOnBalls,  k:   hitStat.strikeOuts,
      } : null,
      pitching: pitStat ? {
        era:  pitStat.era,           w:    pitStat.wins,       l:    pitStat.losses,
        sv:   pitStat.saves,         ip:   pitStat.inningsPitched,
        so:   pitStat.strikeOuts,    whip: pitStat.whip,       g:    pitStat.gamesPitched,
        bb:   pitStat.baseOnBalls,
      } : null,
    };
  }).sort((a, b) => {
    const o = { C:1,'1B':2,'2B':3,'3B':4,SS:5,LF:6,CF:7,RF:8,OF:9,DH:10,SP:11,RP:12,CP:13 };
    return (o[a.pos] ?? 99) - (o[b.pos] ?? 99);
  });

  // ── Find standing
  let standing = null;
  for (const div of standingsData?.records ?? []) {
    const found = div.teamRecords?.find(r => String(r.team?.id) === String(id));
    if (found) {
      const spl = found.records?.splitRecords ?? [];
      const sr  = (type) => spl.find(r => r.type === type) ?? null;
      standing = {
        wins:        found.wins,
        losses:      found.losses,
        pct:         found.winningPercentage,
        gb:          found.gamesBack,
        divRank:     found.divisionRank,
        divName:     div.division?.name ?? '',
        runsScored:  found.runsScored  ?? 0,
        runsAllowed: found.runsAllowed ?? 0,
        runDiff:     (found.runsScored ?? 0) - (found.runsAllowed ?? 0),
        streak:      found.streak?.streakCode ?? '—',
        last10:      (() => { const r = sr('lastTen'); return r ? `${r.wins}-${r.losses}` : '—'; })(),
        homeRecord:  sr('home'),
        awayRecord:  sr('away'),
        vsLeft:      sr('leftHandedStarter'),
        vsRight:     sr('rightHandedStarter'),
        day:         sr('day'),
        night:       sr('night'),
        grass:       sr('grass'),
        turf:        sr('turf'),
      };
      break;
    }
  }

  const hitTotals = teamHitData?.stats?.[0]?.splits?.[0]?.stat ?? {};
  const pitTotals = teamPitData?.stats?.[0]?.splits?.[0]?.stat ?? {};

  const transactions = (newsData?.transactions ?? []).slice(0, 20).map(t => ({
    date:   t.date,
    type:   t.typeDesc ?? t.typeCode ?? '—',
    desc:   t.description ?? '',
    player: t.person?.fullName ?? '',
  }));

  return res.status(200).json({
    team: {
      id:       rawTeam.id,
      name:     rawTeam.name,
      abbr:     rawTeam.abbreviation,
      short:    rawTeam.teamName,
      location: rawTeam.locationName,
      venue:    rawTeam.venue?.name ?? '',
      league:   rawTeam.league?.name ?? '',
      division: rawTeam.division?.name ?? '',
      founded:  rawTeam.firstYearOfPlay ?? '',
    },
    standing,
    roster,
    batting:      hitTotals,
    pitching:     pitTotals,
    transactions,
    season,
  });
}

function today()    { return new Date().toISOString().slice(0, 10); }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }