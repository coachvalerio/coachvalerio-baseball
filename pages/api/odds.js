// pages/api/odds.js
// Fetches player prop odds from The Odds API (the-odds-api.com)
// Free tier: 500 requests/month — plenty for daily use
// Add ODDS_API_KEY=yourkey to .env.local to activate
//
// To get your free key:
// 1. Go to the-odds-api.com
// 2. Sign up free
// 3. Copy API key
// 4. Add to .env.local: ODDS_API_KEY=your_key_here

export default async function handler(req, res) {
  const { playerId } = req.query;
  const apiKey = process.env.ODDS_API_KEY;

  if (!apiKey) {
    return res.status(200).json({
      available: false,
      message: 'Add ODDS_API_KEY to .env.local to enable live betting odds'
    });
  }

  try {
    // First get player info to find their name for matching props
    const playerRes = await fetch(`https://statsapi.mlb.com/api/v1/people/${playerId}`);
    const playerData = await playerRes.json();
    const playerName = playerData.people?.[0]?.fullName;
    const pos = playerData.people?.[0]?.primaryPosition?.abbreviation ?? '';
    const isPitcher = ['P', 'SP', 'RP', 'CP'].includes(pos);

    if (!playerName) return res.status(200).json({ available: false });

    // Fetch MLB player props from The Odds API
    // Markets differ by position
    const batterMarkets = 'batter_hits,batter_home_runs,batter_rbis,batter_runs_scored,batter_stolen_bases,batter_total_bases,batter_hits_runs_rbis,batter_doubles';
    const pitcherMarkets = 'pitcher_strikeouts,pitcher_innings_pitched,pitcher_walks,pitcher_earned_runs,pitcher_record_a_win,pitcher_hits_allowed';
    const markets = isPitcher ? pitcherMarkets : batterMarkets;

    const url = `https://api.the-odds-api.com/v4/sports/baseball_mlb/events/odds/?apiKey=${apiKey}&regions=us&markets=${markets}&oddsFormat=american&bookmakers=fanduel,draftkings,betmgm`;

    const oddsRes = await fetch(url);
    const oddsData = await oddsRes.json();

    if (!Array.isArray(oddsData)) {
      return res.status(200).json({ available: false, error: 'No games today' });
    }

    // Find this player's props across all today's games
    const props = [];
    const marketLabels = {
      batter_hits:           { label: 'To Get a Hit', unit: '' },
      batter_home_runs:      { label: 'Home Run',     unit: '' },
      batter_rbis:           { label: 'RBI',          unit: '' },
      batter_runs_scored:    { label: 'Run Scored',   unit: '' },
      batter_stolen_bases:   { label: 'Stolen Base',  unit: '' },
      batter_total_bases:    { label: 'Total Bases',  unit: 'O/U' },
      batter_hits_runs_rbis: { label: 'Hits+R+RBI',   unit: 'O/U' },
      batter_doubles:        { label: 'Double',        unit: '' },
      pitcher_strikeouts:    { label: 'Strikeouts',    unit: 'O/U' },
      pitcher_innings_pitched:{ label: 'Innings Pitched', unit: 'O/U' },
      pitcher_walks:         { label: 'Walks Allowed', unit: 'O/U' },
      pitcher_earned_runs:   { label: 'Earned Runs',   unit: 'O/U' },
      pitcher_record_a_win:  { label: 'Win',           unit: '' },
      pitcher_hits_allowed:  { label: 'Hits Allowed',  unit: 'O/U' },
    };

    for (const game of oddsData) {
      for (const bookmaker of (game.bookmakers ?? [])) {
        for (const market of (bookmaker.markets ?? [])) {
          const meta = marketLabels[market.key];
          if (!meta) continue;

          for (const outcome of (market.outcomes ?? [])) {
            // Match player name (fuzzy — last name match)
            const lastName = playerName.split(' ').pop().toLowerCase();
            if (!outcome.description?.toLowerCase().includes(lastName) &&
                !outcome.name?.toLowerCase().includes(lastName)) continue;

            // Find if we already have this prop
            const existing = props.find(p => p.key === market.key && p.point === outcome.point);
            if (existing) {
              // Add this bookmaker as alternative
              existing.outcomes.push({
                bookmaker: bookmaker.title,
                name: outcome.name,
                price: outcome.price,
                point: outcome.point,
              });
            } else {
              props.push({
                key: market.key,
                label: meta.label + (outcome.point ? ` ${meta.unit} ${outcome.point}` : ''),
                line: outcome.point ?? null,
                outcomes: [{
                  bookmaker: bookmaker.title,
                  name: outcome.name,
                  price: outcome.price,
                  point: outcome.point,
                }],
              });
            }
          }
        }
      }
    }

    if (props.length === 0) {
      return res.status(200).json({
        available: false,
        noGame: true,
        message: `No props found for ${playerName} today. They may not be playing or props aren't posted yet.`
      });
    }

    // Sort: best odds first (closest to even money = most interesting)
    props.sort((a, b) => {
      const aPrice = a.outcomes[0]?.price ?? -999;
      const bPrice = b.outcomes[0]?.price ?? -999;
      return Math.abs(aPrice) - Math.abs(bPrice);
    });

    res.status(200).json({
      available: true,
      playerName,
      isPitcher,
      props: props.slice(0, 8), // top 8 most interesting props
      gamesChecked: oddsData.length,
    });

  } catch (err) {
    res.status(200).json({ available: false, error: err.message });
  }
}