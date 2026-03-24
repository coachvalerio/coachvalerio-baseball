// pages/api/search.js
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
  const { q } = req.query;
  if (!q || q.length < 2) return res.status(200).json({ players: [] });

  const seen = new Set();
  const players = [];

  const merge = (people) => {
    for (const p of (people ?? [])) {
      if (!p.id || seen.has(p.id)) continue;
      seen.add(p.id);
      players.push(p);
    }
  };

  try {
    // ── Source 1: primary names search — all sport levels so minor leaguers appear
    const r1 = await fetch(
      `https://statsapi.mlb.com/api/v1/people/search?names=${encodeURIComponent(q)}&sportIds=1,11,12,13,14,16&limit=12&hydrate=currentTeam`,
      { headers: { 'Accept': 'application/json' } }
    );
    if (r1.ok) merge((await r1.json()).people);
  } catch {}

  // ── Source 2: fullName exact-ish search — catches players the names endpoint misses
  // (e.g. players with accents, hyphenated names, or limited service time)
  if (players.length < 5) {
    try {
      const r2 = await fetch(
        `https://statsapi.mlb.com/api/v1/people?fullName=${encodeURIComponent(q)}&sportId=1&hydrate=currentTeam`,
        { headers: { 'Accept': 'application/json' } }
      );
      if (r2.ok) merge((await r2.json()).people);
    } catch {}
  }

  // ── Source 3: search endpoint with activeStatus=N for retired/former players
  if (players.length < 3) {
    try {
      const r3 = await fetch(
        `https://statsapi.mlb.com/api/v1/people/search?names=${encodeURIComponent(q)}&sportIds=1&activeStatus=N&limit=8&hydrate=currentTeam`,
        { headers: { 'Accept': 'application/json' } }
      );
      if (r3.ok) merge((await r3.json()).people);
    } catch {}
  }

  // Sort: active MLB players first, then by name match quality
  players.sort((a, b) => {
    const aActive = a.active ? 0 : 1;
    const bActive = b.active ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    // Prefer exact name start match
    const ql = q.toLowerCase();
    const aStarts = a.fullName?.toLowerCase().startsWith(ql) ? 0 : 1;
    const bStarts = b.fullName?.toLowerCase().startsWith(ql) ? 0 : 1;
    return aStarts - bStarts;
  });

  return res.status(200).json({ players: players.slice(0, 10) });
}