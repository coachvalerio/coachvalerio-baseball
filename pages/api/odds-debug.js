// pages/api/odds-debug.js
// Visit /api/odds-debug to see raw Odds API response
// DELETE this file after debugging is done

const safeFetch = async (url) => {
  try {
    const r = await fetch(url);
    const text = await r.text();
    return { status: r.status, ok: r.ok, body: text.slice(0, 3000) };
  } catch (e) {
    return { error: e.message };
  }
};

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  const apiKey = process.env.ODDS_API_KEY;

  if (!apiKey) {
    return res.status(200).json({ error: 'ODDS_API_KEY not set in environment variables' });
  }

  const results = {};

  // Test 1: Check available sports (validates key works at all)
  results.sportsCheck = await safeFetch(
    `https://api.the-odds-api.com/v4/sports?apiKey=${apiKey}`
  );

  // Test 2: Check MLB game lines (h2h)
  results.mlbGameLines = await safeFetch(
    `https://api.the-odds-api.com/v4/sports/baseball_mlb/odds/?apiKey=${apiKey}&regions=us&markets=h2h&oddsFormat=american&bookmakers=fanduel,draftkings`
  );

  // Test 3: Check what events exist today for MLB
  results.mlbEvents = await safeFetch(
    `https://api.the-odds-api.com/v4/sports/baseball_mlb/events?apiKey=${apiKey}`
  );

  // Test 4: Try player props (batter hits) - this requires a specific event ID
  // First parse event IDs from mlbEvents
  let eventIds = [];
  try {
    const eventsData = JSON.parse(results.mlbEvents.body);
    if (Array.isArray(eventsData)) {
      eventIds = eventsData.slice(0, 3).map(e => e.id);
      results.eventIdsSample = eventIds;
      results.allEvents = eventsData.map(e => ({
        id: e.id,
        home: e.home_team,
        away: e.away_team,
        commence: e.commence_time,
      }));
    }
  } catch {}

  // Test 5: If we have event IDs, try fetching props for first event
  if (eventIds.length > 0) {
    results.propTestEventId = eventIds[0];
    results.batterPropsTest = await safeFetch(
      `https://api.the-odds-api.com/v4/sports/baseball_mlb/events/${eventIds[0]}/odds?apiKey=${apiKey}&regions=us&markets=batter_hits,batter_total_bases&oddsFormat=american&bookmakers=fanduel,draftkings`
    );
    results.pitcherPropsTest = await safeFetch(
      `https://api.the-odds-api.com/v4/sports/baseball_mlb/events/${eventIds[0]}/odds?apiKey=${apiKey}&regions=us&markets=pitcher_strikeouts&oddsFormat=american&bookmakers=fanduel,draftkings`
    );
  }

  // Test 6: Check quota
  const quotaCheck = await fetch(
    `https://api.the-odds-api.com/v4/sports?apiKey=${apiKey}`
  );
  results.quota = {
    remaining: quotaCheck.headers.get('x-requests-remaining'),
    used: quotaCheck.headers.get('x-requests-used'),
  };

  return res.status(200).json(results);
}