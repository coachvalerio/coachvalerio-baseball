// pages/api/team.js
// Full team data: roster, record, standings, batting/pitching stats, splits, news

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing team id' });

  const season = new Date().getFullYear();

  try {
    // Fetch in two waves: first wave gets IDs, second wave gets player stats
    const [teamRes, rosterRes, standingsRes, teamHitRes, teamPitRes, newsRes] = await Promise.all([
      fetch(`https://statsapi.mlb.com/api/v1/teams/${id}?hydrate=venue,division,league`),
      fetch(`https://statsapi.mlb.com/api/v1/teams/${id}/roster?rosterType=fullRoster&season=${season}`),
      fetch(`https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=${season}&standingsTypes=regularSeason&hydrate=team,division`),
      fetch(`https://statsapi.mlb.com/api/v1/teams/${id}/stats?stats=season&season=${season}&group=hitting`),
      fetch(`https://statsapi.mlb.com/api/v1/teams/${id}/stats?stats=season&season=${season}&group=pitching`),
      fetch(`https://statsapi.mlb.com/api/v1/transactions?teamId=${id}&startDate=${daysAgo(30)}&endDate=${today()}&sportId=1`),
    ]);

    const [teamData, rosterData, standingsData, teamHitData, teamPitData, newsData] = await Promise.all([
      teamRes.json(), rosterRes.json(), standingsRes.json(),
      teamHitRes.json(), teamPitRes.json(), newsRes.json(),
    ]);

    // Second wave: batch-fetch season stats for all roster players
    const playerIds = (rosterData.roster ?? []).map(p => p.person?.id).filter(Boolean);
    let playerStatsMap = {};
    if (playerIds.length > 0) {
      // MLB API allows up to ~50 per request — chunk if needed
      const chunks = [];
      for (let i = 0; i < playerIds.length; i += 50) chunks.push(playerIds.slice(i, i + 50));
      await Promise.all(chunks.map(async (chunk) => {
        try {
          const r = await fetch(
            `https://statsapi.mlb.com/api/v1/people?personIds=${chunk.join(',')}&hydrate=stats(group=[hitting,pitching],type=season,season=${season})`
          );
          const d = await r.json();
          for (const p of d.people ?? []) {
            playerStatsMap[p.id] = p.stats ?? [];
          }
        } catch {}
      }));
    }

    const team = teamData.teams?.[0] ?? {};

    // ── Roster: split into batters, pitchers, catchers
    const roster = (rosterData.roster ?? []).map(p => {
      const person  = p.person ?? {};
      const pos     = p.position?.abbreviation ?? p.position?.name ?? '—';
      const pStats  = playerStatsMap[person.id] ?? [];
      const hitStat = pStats.find(s => s.group?.displayName === 'hitting')?.splits?.[0]?.stat ?? null;
      const pitStat = pStats.find(s => s.group?.displayName === 'pitching')?.splits?.[0]?.stat ?? null;
      return {
        id:       person.id,
        name:     person.fullName,
        number:   p.jerseyNumber ?? '—',
        pos,
        status:   p.status?.description ?? 'Active',
        hitting:  hitStat ? {
          avg: hitStat.avg, hr: hitStat.homeRuns, rbi: hitStat.rbi,
          ops: hitStat.ops, sb: hitStat.stolenBases, g: hitStat.gamesPlayed,
          h: hitStat.hits, bb: hitStat.baseOnBalls, k: hitStat.strikeOuts,
        } : null,
        pitching: pitStat ? {
          era: pitStat.era, w: pitStat.wins, l: pitStat.losses,
          sv: pitStat.saves, ip: pitStat.inningsPitched,
          so: pitStat.strikeOuts, whip: pitStat.whip, g: pitStat.gamesPitched,
          bb: pitStat.baseOnBalls,
        } : null,
      };
    }).sort((a, b) => {
      const posOrder = { C:1, '1B':2, '2B':3, '3B':4, SS:5, LF:6, CF:7, RF:8, DH:9, OF:10, SP:11, RP:12, CP:13 };
      return (posOrder[a.pos] ?? 99) - (posOrder[b.pos] ?? 99);
    });

    // ── Find this team in standings
    let standing = null;
    for (const div of standingsData.records ?? []) {
      const found = div.teamRecords?.find(r => String(r.team?.id) === String(id));
      if (found) {
        standing = {
          wins:        found.wins,
          losses:      found.losses,
          pct:         found.winningPercentage,
          gb:          found.gamesBack,
          divRank:     found.divisionRank,
          divName:     div.division?.name ?? '',
          runsScored:  found.runsScored,
          runsAllowed: found.runsAllowed,
          runDiff:     (found.runsScored ?? 0) - (found.runsAllowed ?? 0),
          streak:      found.streak?.streakCode ?? '—',
          last10:      found.records?.splitRecords?.find(r => r.type === 'lastTen')?.wins + '-' +
                       found.records?.splitRecords?.find(r => r.type === 'lastTen')?.losses ?? '—',
          homeRecord:  found.records?.splitRecords?.find(r => r.type === 'home'),
          awayRecord:  found.records?.splitRecords?.find(r => r.type === 'away'),
          xWins:       found.records?.splitRecords?.find(r => r.type === 'extraInning'),
          // splits
          vsLeft:      found.records?.splitRecords?.find(r => r.type === 'leftHandedStarter'),
          vsRight:     found.records?.splitRecords?.find(r => r.type === 'rightHandedStarter'),
          day:         found.records?.splitRecords?.find(r => r.type === 'day'),
          night:       found.records?.splitRecords?.find(r => r.type === 'night'),
          grass:       found.records?.splitRecords?.find(r => r.type === 'grass'),
          turf:        found.records?.splitRecords?.find(r => r.type === 'turf'),
        };
        break;
      }
    }

    // ── Team batting/pitching totals
    const hitTotals  = teamHitData.stats?.[0]?.splits?.[0]?.stat ?? {};
    const pitTotals  = teamPitData.stats?.[0]?.splits?.[0]?.stat ?? {};

    // ── Recent transactions as "news"
    const transactions = (newsData.transactions ?? [])
      .slice(0, 20)
      .map(t => ({
        date:   t.date,
        type:   t.typeDesc ?? t.typeCode,
        desc:   t.description ?? '',
        player: t.person?.fullName ?? '',
      }));

    return res.status(200).json({
      team: {
        id:       team.id,
        name:     team.name,
        abbr:     team.abbreviation,
        short:    team.teamName,
        location: team.locationName,
        venue:    team.venue?.name ?? '',
        league:   team.league?.name ?? '',
        division: team.division?.name ?? '',
        founded:  team.firstYearOfPlay,
      },
      standing,
      roster,
      batting:  hitTotals,
      pitching: pitTotals,
      transactions,
      season,
    });

  } catch (err) {
    console.error('Team API error:', err);
    return res.status(500).json({ error: err.message, stack: err.stack?.slice(0, 300) });
  }
}

function today() { return new Date().toISOString().slice(0, 10); }
function daysAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}