// pages/api/team.js
// Full team data: roster, record, standings, batting/pitching stats, splits, news

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing team id' });

  const season = new Date().getFullYear();

  try {
    const [
      teamRes, rosterRes, standingsRes,
      teamHitRes, teamPitRes, newsRes,
    ] = await Promise.all([
      // Team info
      fetch(`https://statsapi.mlb.com/api/v1/teams/${id}?hydrate=venue,division,league`),
      // Full 40-man roster with position + status
      fetch(`https://statsapi.mlb.com/api/v1/teams/${id}/roster?rosterType=fullRoster&season=${season}&hydrate=person(stats(type=season,season=${season},group=[hitting,pitching]))`),
      // Division standings
      fetch(`https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=${season}&standingsTypes=regularSeason&hydrate=team,division`),
      // Team batting stats
      fetch(`https://statsapi.mlb.com/api/v1/teams/${id}/stats?stats=season&season=${season}&group=hitting`),
      // Team pitching stats
      fetch(`https://statsapi.mlb.com/api/v1/teams/${id}/stats?stats=season&season=${season}&group=pitching`),
      // Recent news via MLB transactions (gives us recent activity)
      fetch(`https://statsapi.mlb.com/api/v1/transactions?teamId=${id}&startDate=${daysAgo(30)}&endDate=${today()}&sportId=1`),
    ]);

    const [teamData, rosterData, standingsData, teamHitData, teamPitData, newsData] = await Promise.all([
      teamRes.json(), rosterRes.json(), standingsRes.json(),
      teamHitRes.json(), teamPitRes.json(), newsRes.json(),
    ]);

    const team = teamData.teams?.[0] ?? {};

    // ── Roster: split into batters, pitchers, catchers
    const roster = (rosterData.roster ?? []).map(p => {
      const person = p.person ?? {};
      const pos    = p.position?.abbreviation ?? p.position?.name ?? '—';
      const hitStat = person.stats?.find(s => s.group?.displayName === 'hitting')?.splits?.[0]?.stat ?? null;
      const pitStat = person.stats?.find(s => s.group?.displayName === 'pitching')?.splits?.[0]?.stat ?? null;
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
    return res.status(500).json({ error: err.message });
  }
}

function today() { return new Date().toISOString().slice(0, 10); }
function daysAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}