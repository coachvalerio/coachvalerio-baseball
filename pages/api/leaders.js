// pages/api/leaders.js
// Fetches top 10 league leaders in multiple categories from MLB Stats API

export default async function handler(req, res) {
  const season = req.query.season ?? new Date().getFullYear();

  const CATEGORIES = [
    'battingAverage',
    'homeRuns',
    'rbi',
    'onBasePlusSlugging',
    'stolenBases',
    'earnedRunAverage',
    'strikeouts',
    'wins',
  ];

  try {
    const results = await Promise.all(
      CATEGORIES.map(cat =>
        fetch(`https://statsapi.mlb.com/api/v1/stats/leaders?leaderCategories=${cat}&season=${season}&limit=10&sportId=1`)
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