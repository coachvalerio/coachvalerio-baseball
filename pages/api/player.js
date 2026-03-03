// pages/api/player.js
// Updated to accept dynamic season year

export default async function handler(req, res) {
  const { id, season } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing player id' });

  // Auto-detect season if not passed
  const now = new Date();
  const currentSeason = season ?? (now >= new Date(now.getFullYear(), 2, 20) ? now.getFullYear() : now.getFullYear() - 1);

  try {
    const [infoRes, hitRes, pitRes, hitCareerRes, pitCareerRes] = await Promise.all([
      fetch(`https://statsapi.mlb.com/api/v1/people/${id}?hydrate=currentTeam`),
      fetch(`https://statsapi.mlb.com/api/v1/people/${id}/stats?stats=season&season=${currentSeason}&group=hitting`),
      fetch(`https://statsapi.mlb.com/api/v1/people/${id}/stats?stats=season&season=${currentSeason}&group=pitching`),
      fetch(`https://statsapi.mlb.com/api/v1/people/${id}/stats?stats=yearByYear&group=hitting`),
      fetch(`https://statsapi.mlb.com/api/v1/people/${id}/stats?stats=yearByYear&group=pitching`),
    ]);

    const [info, hit, pit, hitCareer, pitCareer] = await Promise.all([
      infoRes.json(), hitRes.json(), pitRes.json(),
      hitCareerRes.json(), pitCareerRes.json(),
    ]);

    res.status(200).json({
      player: info.people?.[0] ?? null,
      season: {
        hitting:  hit.stats?.[0]?.splits  ?? [],
        pitching: pit.stats?.[0]?.splits  ?? [],
      },
      career: {
        hitting:  hitCareer.stats?.[0]?.splits ?? [],
        pitching: pitCareer.stats?.[0]?.splits ?? [],
      },
      currentSeason,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch player data', detail: err.message });
  }
}