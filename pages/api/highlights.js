// pages/api/highlights.js
// Fetches recent highlight videos from MLB Stats API (no API key required)

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing player id' });

  try {
    // MLB Stats API returns recent content for a player
    const r = await fetch(
      `https://statsapi.mlb.com/api/v1/people/${id}/stats/game/current?fields=stats,type,group,splits,stat,description,video,thumbnail,date`,
      { headers: { 'Accept': 'application/json' } }
    );

    // Also try the MLB content API for videos
    const contentR = await fetch(
      `https://statsapi.mlb.com/api/v1/people/${id}?hydrate=currentTeam,stats(type=season)`,
      { headers: { 'Accept': 'application/json' } }
    );
    const playerData = await contentR.json();
    const player = playerData.people?.[0];

    // Build MLB video search URL data
    // MLB.com has a video feed but requires their internal CMS — we provide direct links
    const teamId = player?.currentTeam?.id;

    // Try to get recent game highlights from MLB film room
    let mlbVids = [];
    try {
      const filmR = await fetch(
        `https://www.mlb.com/video/search?q=playerId+%3D+%5B${id}%5D+Order+By+Date+DESC&page=1&pageSize=6`,
        { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } }
      );
      if (filmR.ok) {
        const filmData = await filmR.json();
        mlbVids = (filmData?.results ?? []).map(v => ({
          title:    v.title ?? v.headline ?? 'MLB Highlight',
          thumb:    v.image?.cuts?.find(c => c.width >= 400)?.src ?? v.image?.cuts?.[0]?.src ?? '',
          url:      v.mp4Url ?? v.url ?? '',
          mlbUrl:   `https://www.mlb.com/video/${v.slug ?? ''}`,
          date:     v.date ? new Date(v.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
          duration: v.duration ?? '',
        }));
      }
    } catch {}

    // Fallback: use MLB Stats API highlight endpoint
    if (mlbVids.length === 0) {
      try {
        const highlightR = await fetch(
          `https://statsapi.mlb.com/api/v1/people/${id}/stats?stats=gameLog&season=2025&group=hitting`,
          { headers: { 'Accept': 'application/json' } }
        );
        // Game log gives us game dates we can link to
        const hlData = await highlightR.json();
        const games = hlData.stats?.[0]?.splits?.slice(0, 6) ?? [];
        mlbVids = games.map(g => ({
          title:   `vs ${g.opponent?.name ?? 'Unknown'} — ${g.date ?? ''}`,
          thumb:   `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:action:hero:current.jpg/w_640,q_auto:best/v1/people/${id}/action/hero/current`,
          url:     '',
          mlbUrl:  `https://www.mlb.com/video?q=playerId+%3D+%5B${id}%5D`,
          date:    g.date ?? '',
          gamePk:  g.game?.gamePk,
        }));
      } catch {}
    }

    res.status(200).json({
      mlb: mlbVids,
      mlbSearchUrl: `https://www.mlb.com/video?q=playerId+%3D+%5B${id}%5D+Order+By+Date+DESC`,
      playerName: player?.fullName ?? '',
    });

  } catch (err) {
    res.status(200).json({ mlb: [], error: err.message });
  }
}