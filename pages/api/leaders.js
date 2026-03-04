// pages/api/leaders.js
// Fetches top 10 league leaders in multiple categories from MLB Stats API
// battingAverage and stolenBases explicitly use playerPool=hitters to exclude pitchers

export default async function handler(req, res) {
  const season = req.query.season ?? new Date().getFullYear();

  // Each entry: [leaderCategory, extraParams]
  // playerPool=qualified_hitters → position players only, must meet PA minimum
  // playerPool=hitters           → position players only, no PA minimum
  // playerPool=qualified_pitchers → pitchers only, must meet IP minimum
  // playerPool=pitchers           → pitchers only, no IP minimum
  const CATEGORIES = [
    ['battingAverage',     'playerPool=qualified_hitters'],
    ['homeRuns',           'playerPool=hitters'],
    ['rbi',                'playerPool=hitters'],
    ['onBasePlusSlugging', 'playerPool=qualified_hitters'],
    ['stolenBases',        'playerPool=hitters'],
    ['earnedRunAverage',   'playerPool=qualified_pitchers'],
    ['strikeouts',         'playerPool=pitchers'],
    ['wins',               'playerPool=pitchers'],
  ];

  try {
    const results = await Promise.all(
      CATEGORIES.map(([cat, extra]) =>
        fetch(`https://statsapi.mlb.com/api/v1/stats/leaders?leaderCategories=${cat}&season=${season}&limit=10&sportId=1&${extra}`)
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