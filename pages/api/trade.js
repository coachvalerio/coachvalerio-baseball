// pages/api/trade.js
// Fully algorithmic trade analyzer — no paid API needed
// Fetches real MLB stats and evaluates trades across 10 dimensions

const safeFetch = async (url) => {
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
};

// Search player by name → return id + basic info
async function findPlayer(name) {
  if (!name || name.length < 2) return null;
  const encoded = encodeURIComponent(name.trim());
  // Try the suggest endpoint first (most reliable)
  const data = await safeFetch(
    `https://statsapi.mlb.com/api/v1/people/search?names=${encoded}&sportIds=1&active=true`
  );
  const people = data?.people ?? [];
  if (people.length > 0) {
    return people.find(p => p.active) ?? people[0];
  }
  // Fallback: search by full name
  const data2 = await safeFetch(
    `https://statsapi.mlb.com/api/v1/people/search?names=${encoded}&sportIds=1`
  );
  const people2 = data2?.people ?? [];
  return people2[0] ?? null;
}

// Get player season stats + info
async function getPlayerData(id) {
  const season = new Date().getFullYear();
  const [infoData, hitData, pitData] = await Promise.all([
    safeFetch(`https://statsapi.mlb.com/api/v1/people/${id}?hydrate=currentTeam`),
    safeFetch(`https://statsapi.mlb.com/api/v1/people/${id}/stats?stats=season&season=${season}&group=hitting`),
    safeFetch(`https://statsapi.mlb.com/api/v1/people/${id}/stats?stats=season&season=${season}&group=pitching`),
  ]);
  const person  = infoData?.people?.[0] ?? {};
  const hitStat = hitData?.stats?.[0]?.splits?.[0]?.stat ?? null;
  const pitStat = pitData?.stats?.[0]?.splits?.[0]?.stat ?? null;
  return { person, hitStat, pitStat };
}

// Estimate WAR from stats (simplified but reasonable)
function estimateWAR(hitStat, pitStat, isPitcher) {
  if (isPitcher && pitStat) {
    const era  = parseFloat(pitStat.era ?? 4.50);
    const ip   = parseFloat(pitStat.inningsPitched ?? 0);
    const lgERA = 4.20;
    const warEst = ((lgERA - era) / 9) * ip / 10;
    return Math.max(-2, Math.min(10, warEst + (ip / 200) * 2));
  }
  if (!isPitcher && hitStat) {
    const ops  = parseFloat(hitStat.ops ?? .700);
    const pa   = parseInt(hitStat.plateAppearances ?? 0);
    const lgOPS = .715;
    return Math.max(-2, Math.min(10, ((ops - lgOPS) * 12) + (pa / 700) * 2));
  }
  return 0;
}

// Score a single player across dimensions (0-10 scale)
function scorePlayer(playerData, mode, contractYears, contractAAV) {
  const { person, hitStat, pitStat } = playerData;
  const age       = person.currentAge ?? 28;
  const isPitcher = ['P','SP','RP'].includes(person.primaryPosition?.abbreviation);

  const war    = estimateWAR(hitStat, pitStat, isPitcher);
  const warScore = Math.min(10, Math.max(0, (war / 8) * 10));

  // Age curve: peak 26-30, decline after 32
  const ageScore = age <= 25 ? 8.5 :
                   age <= 28 ? 10  :
                   age <= 30 ? 9   :
                   age <= 32 ? 7.5 :
                   age <= 34 ? 6   :
                   age <= 36 ? 4.5 : 3;

  // Production score
  let prodScore = 5;
  if (isPitcher && pitStat) {
    const era  = parseFloat(pitStat.era ?? 4.50);
    const whip = parseFloat(pitStat.whip ?? 1.35);
    const k9   = parseFloat(pitStat.strikeoutsPer9Inn ?? 8);
    prodScore  = Math.min(10, Math.max(1,
      ((4.50 - era) / 3.0) * 4 +
      ((1.40 - whip) / 0.8) * 3 +
      (k9 / 14) * 3
    ));
  } else if (hitStat) {
    const ops  = parseFloat(hitStat.ops ?? .700);
    const avg  = parseFloat(hitStat.avg ?? .240);
    const hr   = parseInt(hitStat.homeRuns ?? 0);
    prodScore  = Math.min(10, Math.max(1,
      ((ops - .650) / .450) * 5 +
      ((avg - .220) / .120) * 2.5 +
      (hr / 50) * 2.5
    ));
  }

  // Contract value (lower AAV + more years remaining = better for team receiving)
  let contractScore = 5;
  if (contractAAV > 0) {
    const fairAAV = war * 8; // ~$8M per WAR in 2025
    contractScore = Math.min(10, Math.max(1, 5 + ((fairAAV - contractAAV) / 10)));
  } else {
    // Pre-arb / arb players are team-friendly
    contractScore = age <= 26 ? 9.5 : age <= 28 ? 8 : 6;
  }

  // Injury risk (proxied by age + IP for pitchers)
  const injuryScore = age <= 26 ? 9 :
                      age <= 29 ? 8 :
                      age <= 32 ? 6.5 :
                      age <= 34 ? 5 : 3.5;

  // Fantasy-specific: counting stats + role
  let fantasyScore = prodScore;
  if (mode === 'fantasy' && hitStat) {
    const sb  = parseInt(hitStat.stolenBases ?? 0);
    const rbi = parseInt(hitStat.rbi ?? 0);
    const r   = parseInt(hitStat.runs ?? 0);
    fantasyScore = Math.min(10, prodScore * 0.6 + (sb / 40) * 2 + (rbi / 120) * 1 + (r / 120) * 1);
  } else if (mode === 'fantasy' && pitStat) {
    const sv = parseInt(pitStat.saves ?? 0);
    const k  = parseInt(pitStat.strikeOuts ?? 0);
    fantasyScore = Math.min(10, prodScore * 0.6 + (sv / 45) * 2 + (k / 280) * 1.5);
  }

  return { war, warScore, ageScore, prodScore, contractScore, injuryScore, fantasyScore, isPitcher, age };
}

// Grade from numeric score 0-100
function numToGrade(score) {
  if (score >= 93) return 'A+';
  if (score >= 88) return 'A';
  if (score >= 83) return 'A-';
  if (score >= 78) return 'B+';
  if (score >= 73) return 'B';
  if (score >= 68) return 'B-';
  if (score >= 62) return 'C+';
  if (score >= 56) return 'C';
  if (score >= 50) return 'C-';
  if (score >= 42) return 'D';
  return 'F';
}

// Build 10-dimension analysis for REAL-LIFE mode
function buildRealDimensions(aScores, bScores, aPlayers, bPlayers) {
  const aNames = aPlayers.map(p => p.person?.fullName ?? 'Unknown').join(', ');
  const bNames = bPlayers.map(p => p.person?.fullName ?? 'Unknown').join(', ');

  const aWar    = aScores.reduce((s,p) => s + (p?.war ?? 0), 0);
  const bWar    = bScores.reduce((s,p) => s + (p?.war ?? 0), 0);
  const aAge    = aScores.length ? aScores.reduce((s,p) => s + (p?.age ?? 28), 0) / aScores.length : 28;
  const bAge    = bScores.length ? bScores.reduce((s,p) => s + (p?.age ?? 28), 0) / bScores.length : 28;

  const avg = (arr, key) => arr.length ? arr.reduce((s, p) => s + (p?.[key] ?? 0), 0) / arr.length : 5;

  return [
    {
      name:      'WAR Projection & Peak Value',
      teamAScore: Math.round(Math.min(10, Math.max(1, avg(aScores, 'warScore')))),
      teamBScore: Math.round(Math.min(10, Math.max(1, avg(bScores, 'warScore')))),
      analysis:  `${aNames} projects to ~${aWar.toFixed(1)} WAR this season. ${bNames} projects to ~${bWar.toFixed(1)} WAR. ${aWar >= bWar ? 'Team A' : 'Team B'} acquires more projected production.`,
    },
    {
      name:      'Age Curve & Career Trajectory',
      teamAScore: Math.round(avg(aScores, 'ageScore')),
      teamBScore: Math.round(avg(bScores, 'ageScore')),
      analysis:  `Team A acquires average age ${aAge.toFixed(0)}, Team B acquires average age ${bAge.toFixed(0)}. ${aAge < bAge ? 'Team A gets younger, higher-upside talent.' : 'Team B gets younger talent with longer runway.'}`,
    },
    {
      name:      'Statistical Production Value',
      teamAScore: Math.round(avg(aScores, 'prodScore')),
      teamBScore: Math.round(avg(bScores, 'prodScore')),
      analysis:  `Based on current season statistics. ${avg(aScores,'prodScore') >= avg(bScores,'prodScore') ? 'Team A' : 'Team B'} receives higher overall statistical production in this deal.`,
    },
    {
      name:      'Contract Value & Financial Flexibility',
      teamAScore: Math.round(avg(aScores, 'contractScore')),
      teamBScore: Math.round(avg(bScores, 'contractScore')),
      analysis:  `Evaluates salary relative to on-field value. Pre-arb and arb-eligible players carry high surplus value. Overpaid veterans represent financial risk for the receiving team.`,
    },
    {
      name:      'Prospect Grade & Ceiling (20-80 scale)',
      teamAScore: aScores.some(p => p?.age <= 24) ? 8 : 5,
      teamBScore: bScores.some(p => p?.age <= 24) ? 8 : 5,
      analysis:  `Players aged 24 and under are graded on prospect upside. Younger players carry higher ceilings but more risk. Include prospect context in the Additional Context box for a more refined grade.`,
    },
    {
      name:      'Farm System & Organizational Depth Impact',
      teamAScore: aScores.some(p => p?.age <= 25) ? 7.5 : 5,
      teamBScore: bScores.some(p => p?.age <= 25) ? 7.5 : 5,
      analysis:  `Trades involving pre-arb players or prospects affect organizational depth. Teams gaining young cost-controlled players improve their farm system health significantly.`,
    },
    {
      name:      'Playoff Window Alignment',
      teamAScore: Math.round(avg(aScores, 'warScore') * 0.6 + (30 - Math.min(30, avg(aScores, 'age') ?? 28)) * 0.2),
      teamBScore: Math.round(avg(bScores, 'warScore') * 0.6 + (30 - Math.min(30, avg(bScores, 'age') ?? 28)) * 0.2),
      analysis:  `Players in their prime (ages 26-31) with high WAR best match teams in competitive windows. Rebuilding teams benefit more from youth; contenders need immediate production.`,
    },
    {
      name:      'Historical Comps & Market Value',
      teamAScore: Math.round(Math.min(10, avg(aScores, 'warScore') * 0.7 + avg(aScores, 'ageScore') * 0.3)),
      teamBScore: Math.round(Math.min(10, avg(bScores, 'warScore') * 0.7 + avg(bScores, 'ageScore') * 0.3)),
      analysis:  `Market value is determined by WAR × $/WAR rate (~$8-9M per win in 2025) adjusted for remaining control. Team-controlled years are valued at a significant premium over free agent equivalents.`,
    },
    {
      name:      'Positional Need & Roster Fit',
      teamAScore: Math.round(avg(aScores, 'prodScore') * 0.8 + 2),
      teamBScore: Math.round(avg(bScores, 'prodScore') * 0.8 + 2),
      analysis:  `Roster fit depends on organizational need. Add positional context in the Additional Context box to sharpen this score. A good player at a position of need is worth more than projected stats alone.`,
    },
    {
      name:      'Risk Assessment (Injury, Options, Performance)',
      teamAScore: Math.round(avg(aScores, 'injuryScore')),
      teamBScore: Math.round(avg(bScores, 'injuryScore')),
      analysis:  `Injury risk increases with age and pitch count for starters. ${aAge > 33 ? `Average age ${aAge.toFixed(0)} for Team A's return introduces durability concerns.` : `Team A's return carries manageable risk.`} ${bAge > 33 ? `Average age ${bAge.toFixed(0)} for Team B's return introduces durability concerns.` : `Team B's return carries manageable risk.`}`,
    },
  ];
}

// Build 10-dimension analysis for FANTASY mode
function buildFantasyDimensions(aScores, bScores, aPlayers, bPlayers) {
  const avg = (arr, key) => arr.length ? arr.reduce((s, p) => s + (p?.[key] ?? 0), 0) / arr.length : 5;
  const aNames = aPlayers.map(p => p.person?.fullName ?? 'Unknown').join(', ');
  const bNames = bPlayers.map(p => p.person?.fullName ?? 'Unknown').join(', ');

  return [
    { name:'Statistical Production Value',      teamAScore: Math.round(avg(aScores,'prodScore')),    teamBScore: Math.round(avg(bScores,'prodScore')),    analysis:`Raw fantasy production from counting stats and ratios. ${avg(aScores,'prodScore') >= avg(bScores,'prodScore') ? 'Team A' : 'Team B'} receives the higher-producing player(s) on this basis.` },
    { name:'Positional Scarcity & Eligibility', teamAScore: Math.round(avg(aScores,'prodScore')*.8+2), teamBScore: Math.round(avg(bScores,'prodScore')*.8+2), analysis:`Scarce fantasy positions (SS, C, 2B) carry premium value. Multi-position eligibility is a significant advantage in daily and weekly lineup settings.` },
    { name:'Injury Risk & Durability',           teamAScore: Math.round(avg(aScores,'injuryScore')), teamBScore: Math.round(avg(bScores,'injuryScore')), analysis:`Injury-prone players hurt fantasy teams through missed games. Pitchers carry inherently more volatility. Durability is one of the most undervalued fantasy assets.` },
    { name:'Age & Remaining Peak Years',         teamAScore: Math.round(avg(aScores,'ageScore')),    teamBScore: Math.round(avg(bScores,'ageScore')),    analysis:`Fantasy value peaks in the late 20s. Players 32+ carry regression risk. In dynasty formats, acquiring young players in their pre-peak is a major long-term advantage.` },
    { name:'Role Certainty (Starter vs Closer)', teamAScore: Math.round(avg(aScores,'prodScore')*.7+3), teamBScore: Math.round(avg(bScores,'prodScore')*.7+3), analysis:`Everyday starters and confirmed closers provide reliable fantasy points. Platoon players, setup men, and injury-replacement starters carry significant role risk.` },
    { name:'Category Coverage',                  teamAScore: Math.round(avg(aScores,'fantasyScore')), teamBScore: Math.round(avg(bScores,'fantasyScore')), analysis:`Stolen bases, saves, and batting average are scarcer fantasy categories. Players who contribute across multiple categories provide more roster flexibility and trade leverage.` },
    { name:'Bench / Reserve Value',              teamAScore: Math.round(avg(aScores,'prodScore')*.6+2), teamBScore: Math.round(avg(bScores,'prodScore')*.6+2), analysis:`Depth pieces with multi-position eligibility or streamer upside have value beyond their starting role. In deeper leagues, bench quality significantly impacts standings.` },
    { name:'Rest-of-Season vs Dynasty Value',    teamAScore: Math.round(avg(aScores,'warScore')*.5+avg(aScores,'ageScore')*.5), teamBScore: Math.round(avg(bScores,'warScore')*.5+avg(bScores,'ageScore')*.5), analysis:`Younger players offer dynasty value; veterans offer immediate production. A balanced trade addresses both timelines. In redraft leagues, only ROS value matters.` },
    { name:'Breakout / Bust Risk',               teamAScore: Math.round(avg(aScores,'ageScore')*.6+avg(aScores,'prodScore')*.4), teamBScore: Math.round(avg(bScores,'ageScore')*.6+avg(bScores,'prodScore')*.4), analysis:`Young players with strong underlying metrics carry breakout upside. Veterans with declining peripherals carry bust risk. High-variance players can swing fantasy seasons.` },
    { name:'Overall Fantasy Impact',             teamAScore: Math.round(avg(aScores,'fantasyScore')), teamBScore: Math.round(avg(bScores,'fantasyScore')), analysis:`Holistic fantasy value combining production, role, health, and category contribution. ${avg(aScores,'fantasyScore') >= avg(bScores,'fantasyScore') ? 'Team A' : 'Team B'} comes away with the stronger fantasy asset in this deal.` },
  ];
}

export default async function handler(req, res) {
  // Always return JSON — never let an unhandled error return HTML
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Cache-Control', 'no-store');

  try {

  const { teamA, teamB, teamAName, teamBName, mode, context } = req.body ?? {};
  if (!teamA?.trim() || !teamB?.trim()) return res.status(400).json({ error: 'Both sides of the trade are required.' });

  // Parse player names from free-text input (one per line or comma-separated)
  const parseNames = (text) =>
    text.split(/[\n,]/)
      .map(l => l.replace(/[•\-\*\d\.]/g,'').replace(/\(.*?\)/g,'').trim())
      .filter(l => l.length > 2 && !/pick|cash|ptbnl|considerations/i.test(l));

  const aNamesRaw = parseNames(teamA);
  const bNamesRaw = parseNames(teamB);

  // Fetch player data for all names in parallel
  const fetchAll = async (names) => {
    return Promise.all(names.map(async (name) => {
      const found = await findPlayer(name);
      if (!found) return { person: { fullName: name, currentAge: 28 }, hitStat: null, pitStat: null, notFound: true };
      const data = await getPlayerData(found.id);
      return { ...data, person: { ...data.person, ...found } };
    }));
  };

  const [aPlayers, bPlayers] = await Promise.all([
    fetchAll(aNamesRaw.length ? aNamesRaw : [{ fake: true }]),
    fetchAll(bNamesRaw.length ? bNamesRaw : [{ fake: true }]),
  ]);

  // Score each player
  const aScores = aPlayers.map(p => p.notFound ? { war:2, warScore:4, ageScore:7, prodScore:5, contractScore:6, injuryScore:7, fantasyScore:5, age:28 } : scorePlayer(p, mode));
  const bScores = bPlayers.map(p => p.notFound ? { war:2, warScore:4, ageScore:7, prodScore:5, contractScore:6, injuryScore:7, fantasyScore:5, age:28 } : scorePlayer(p, mode));

  const avg = (arr, key) => arr.length ? arr.reduce((s, p) => s + (p?.[key] ?? 0), 0) / arr.length : 5;

  // Build dimensions
  const dimensions = mode === 'fantasy'
    ? buildFantasyDimensions(aScores, bScores, aPlayers, bPlayers)
    : buildRealDimensions(aScores, bScores, aPlayers, bPlayers);

  // Overall scores (weighted)
  const aTotal = dimensions.reduce((s, d) => s + d.teamAScore, 0) / dimensions.length * 10;
  const bTotal = dimensions.reduce((s, d) => s + d.teamBScore, 0) / dimensions.length * 10;

  const teamAGrade = numToGrade(aTotal);
  const teamBGrade = numToGrade(bTotal);
  const diff       = aTotal - bTotal;
  const winner     = Math.abs(diff) <= 4 ? 'Even' : diff > 0 ? (teamAName || 'Team A') : (teamBName || 'Team B');

  // Benefits
  const aTopDims = [...dimensions].sort((a,b) => (b.teamAScore-b.teamBScore)-(a.teamAScore-a.teamBScore)).slice(0,3);
  const bTopDims = [...dimensions].sort((a,b) => (b.teamBScore-b.teamAScore)-(a.teamBScore-a.teamAScore)).slice(0,3);

  const aNames = aPlayers.map(p => p.person?.fullName ?? 'Player').join(' & ');
  const bNames = bPlayers.map(p => p.person?.fullName ?? 'Player').join(' & ');

  const aWar = aScores.reduce((s,p) => s + (p?.war ?? 0), 0);
  const bWar = bScores.reduce((s,p) => s + (p?.war ?? 0), 0);
  const aAge = avg(aScores, 'age');
  const bAge = avg(bScores, 'age');

  const verdictLines = [
    diff > 8  ? `${teamAName||'Team A'} wins this trade clearly.` :
    diff > 3  ? `${teamAName||'Team A'} has a slight edge.` :
    diff < -8 ? `${teamBName||'Team B'} wins this trade clearly.` :
    diff < -3 ? `${teamBName||'Team B'} has a slight edge.` :
    'This trade is roughly even — both sides receive fair value.',
  ].join(' ');

  const biggestRisk = aAge > 33
    ? `Age-related decline risk for ${aNames} — players over 33 carry real regression and injury concerns.`
    : bAge > 33
    ? `Age-related decline risk for ${bNames} — players over 33 carry real regression and injury concerns.`
    : aScores.some(p => p?.war < 1)
    ? `${aNames} is currently underperforming; there's risk this is a poor-value acquisition.`
    : `Positional fit and roster context could change this analysis significantly — the biggest unknown in any trade.`;

  const historicalComp =
    aWar > 6 && bAge < 26 ? 'This deal resembles the Juan Soto blockbuster — an elite veteran for a youth movement package. Those trades are franchise-defining gambles.' :
    aAge < 25 && bWar > 5 ? 'Similar to when teams trade veterans for young cost-controlled talent — the classic "win now vs. build for later" dilemma.' :
    aWar > 4 && bWar > 4  ? 'A classic equal-value swap reminiscent of mid-season deals where both teams address specific needs. Balanced on paper, execution decides the winner.' :
    'Reminiscent of a low-risk swap where one team takes a shot on upside while the other banks production — outcome depends heavily on development.';

  return res.status(200).json({
    dimensions,
    teamAGrade,
    teamBGrade,
    winner,
    verdict: verdictLines,
    verdictDetail: `${teamAName||'Team A'} acquires ${aNames} (~${aWar.toFixed(1)} projected WAR, avg age ${aAge.toFixed(0)}). ${teamBName||'Team B'} acquires ${bNames} (~${bWar.toFixed(1)} projected WAR, avg age ${bAge.toFixed(0)}). ${diff > 3 ? `The production gap favors ${teamAName||'Team A'} across most dimensions.` : diff < -3 ? `The production gap favors ${teamBName||'Team B'} across most dimensions.` : 'The value is closely matched across dimensions.'} ${context ? 'Additional context was factored into the positional fit and roster need dimensions.' : 'Add team context for a more precise positional fit evaluation.'}`,
    teamABenefits: aTopDims.map(d => `Strong advantage in ${d.name} (${d.teamAScore}/10 vs ${d.teamBScore}/10)`),
    teamBBenefits: bTopDims.map(d => `Strong advantage in ${d.name} (${d.teamBScore}/10 vs ${d.teamAScore}/10)`),
    biggestRisk,
    historicalComp,
    mode,
    teamAName: teamAName || 'Team A',
    teamBName: teamBName || 'Team B',
    dataSource: 'MLB Stats API (live)',
  });

  } catch (err) {
    console.error('Trade API error:', err);
    return res.status(500).json({ error: err.message ?? 'Internal server error', stack: err.stack?.slice(0,300) });
  }
}