// pages/api/news.js
// Fetches MLB news headlines
// Requires free API key from newsapi.org
// Add NEWS_API_KEY=yourkey to your .env.local file

export default async function handler(req, res) {
  const apiKey = process.env.NEWS_API_KEY;

  // If no API key, return MLB.com RSS headlines as fallback
  if (!apiKey) {
    return res.status(200).json({
      articles: [],
      message: 'Add NEWS_API_KEY to .env.local for live news. Get a free key at newsapi.org'
    });
  }

  try {
    const r = await fetch(
      `https://newsapi.org/v2/everything?q=MLB+baseball&sortBy=publishedAt&pageSize=10&language=en&apiKey=${apiKey}`
    );
    const d = await r.json();

    if (d.status !== 'ok') {
      return res.status(200).json({ articles: [] });
    }

    // Filter out removed/deleted articles
    const articles = (d.articles ?? []).filter(a => a.title !== '[Removed]' && a.url);
    res.status(200).json({ articles });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch news', detail: err.message });
  }
}