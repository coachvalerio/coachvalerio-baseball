// pages/api/highlights.js
// Auto-fetches YouTube highlights server-side using YOUTUBE_API_KEY env var
// Also attempts MLB Film Room for official clips

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing player id' });

  // 1. Get player name first (needed for YouTube search)
  let playerName = '';
  let teamId = null;
  try {
    const pRes = await fetch(`https://statsapi.mlb.com/api/v1/people/${id}?hydrate=currentTeam`);
    const pData = await pRes.json();
    const p = pData.people?.[0];
    playerName = p?.fullName ?? '';
    teamId     = p?.currentTeam?.id ?? null;
  } catch {}

  const season = new Date().getFullYear();

  // 2. YouTube search (server-side — key never exposed to browser)
  let ytVideos = [];
  const ytKey = process.env.YOUTUBE_API_KEY;
  if (ytKey && playerName) {
    try {
      const q = encodeURIComponent(`${playerName} MLB highlights ${season}`);
      const ytRes = await fetch(
        `https://www.googleapis.com/youtube/v3/search` +
        `?part=snippet&q=${q}&type=video&maxResults=8&order=date&key=${ytKey}`
      );
      if (ytRes.ok) {
        const ytData = await ytRes.json();
        ytVideos = (ytData.items ?? [])
          .filter(v => v.id?.videoId)
          .map(v => ({
            youtubeId:   v.id.videoId,
            title:       v.snippet.title,
            channelName: v.snippet.channelTitle,
            thumb:       v.snippet.thumbnails?.medium?.url ?? v.snippet.thumbnails?.default?.url ?? '',
            date:        new Date(v.snippet.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            url:         `https://www.youtube.com/watch?v=${v.id.videoId}`,
          }));
      }
    } catch {}
  }

  // 3. MLB Film Room — official highlight clips (no key needed)
  let mlbVids = [];
  try {
    const filmRes = await fetch(
      `https://www.mlb.com/video/search?q=playerId+%3D+%5B${id}%5D+Order+By+Date+DESC&page=1&pageSize=6`,
      { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } }
    );
    if (filmRes.ok) {
      const filmData = await filmRes.json();
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

  // 4. Fallback: recent game log as placeholder tiles if both sources empty
  if (mlbVids.length === 0 && ytVideos.length === 0) {
    try {
      const glRes = await fetch(
        `https://statsapi.mlb.com/api/v1/people/${id}/stats?stats=gameLog&season=${season}&group=hitting`
      );
      const glData = await glRes.json();
      const games  = glData.stats?.[0]?.splits?.slice(0, 6) ?? [];
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

  return res.status(200).json({
    mlb:          mlbVids,
    youtube:      ytVideos,
    youtubeReady: ytVideos.length > 0,
    mlbSearchUrl: `https://www.mlb.com/video?q=playerId+%3D+%5B${id}%5D+Order+By+Date+DESC`,
    playerName,
  });
}