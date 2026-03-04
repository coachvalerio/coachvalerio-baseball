// pages/api/leaders.js
// Fetches top 10 league leaders using correct MLB Stats API params
// statGroup=hitting → position players only
// statGroup=pitching → pitchers only
// playerPool=Qualified → must meet minimum PA/IP thresholds

export default async function handler(req, res) {
  const season = req.query.season ?? new Date().getFullYear();

  // [leaderCategory, statGroup, playerPool]
  const CATEGORIES = [
    ['battingAverage',      'hitting',  'Qualified'],
    ['homeRuns',            'hitting',  'All'],
    ['rbi',                 'hitting',  'All'],
    ['onBasePlusSlugging',  'hitting',  'Qualified'],
    ['stolenBases',         'hitting',  'All'],
    ['earnedRunAverage',    'pitching', 'Qualified'],
    ['strikeouts',          'pitching', 'All'],
    ['wins',                'pitching', 'All'],
  ];

  try {
    const results = await Promise.all(
      CATEGORIES.map(([cat, group, pool]) =>
        fetch(
          `https://statsapi.mlb.com/api/v1/stats/leaders?leaderCategories=${cat}&season=${season}&limit=10&sportId=1&statGroup=${group}&playerPool=${pool}`
        )
          .then(r => r.json())
          .then(d => ({ [cat]: d.leagueLeaders?.[0]?.leaders ?? [] }))
          .catch(() => ({ [cat]: [] }))
      )
    );

    const merged = Object.assign({}, ...results);
    res.status(200).json(merged);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch leaders', detail: err.message });
  }
}