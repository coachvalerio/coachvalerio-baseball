// pages/api/search.js
export default async function handler(req, res) {
  const { q } = req.query;
  if (!q || q.length < 2) return res.status(200).json({ players: [] });

  try {
    const r = await fetch(
      `https://statsapi.mlb.com/api/v1/people/search?names=${encodeURIComponent(q)}&sportIds=1&limit=8`
    );
    const data = await r.json();
    res.status(200).json({ players: data.people ?? [] });
  } catch (err) {
    res.status(500).json({ error: 'Search failed', detail: err.message });
  }
}