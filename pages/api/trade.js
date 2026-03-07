// pages/api/trade.js
// Calls Anthropic Claude API to evaluate MLB trade scenarios
// Requires ANTHROPIC_API_KEY in .env.local

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { teamA, teamB, teamAName, teamBName, mode, context } = req.body;
  if (!teamA || !teamB) return res.status(400).json({ error: 'Missing trade details' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const isFantasy = mode === 'fantasy';

  const systemPrompt = isFantasy
    ? `You are an elite fantasy baseball analyst and trade evaluator. You evaluate trades purely on fantasy baseball value — statistical production, positional scarcity, roster construction, and league format impact. Contracts, team payrolls, playoff positioning, prospect development timelines, and real-life team needs are IRRELEVANT. Only stats, roles, and fantasy value matter. You are direct, opinionated, and back every claim with data. Always respond in the exact JSON format requested.`
    : `You are a world-class MLB executive, analytics director, and trade evaluator with deep knowledge of MLB transactions, prospect pipelines, contract structures, WAR projections, and team-building philosophy. You evaluate every trade like a front office making a decision that impacts the next 5 years of a franchise. You are direct, opinionated, and back every claim with data. Always respond in the exact JSON format requested.`;

  const dimensions = isFantasy
    ? [
        'Statistical Production Value',
        'Positional Scarcity & Eligibility',
        'Injury Risk & Durability',
        'Age & Remaining Peak Years',
        'Role Certainty (starter vs platoon vs closer)',
        'Category Coverage (counting stats vs ratios)',
        'Bench/Reserve Value',
        'Rest-of-Season vs Dynasty Value',
        'Breakout / Bust Risk',
        'Overall Fantasy Impact',
      ]
    : [
        'WAR Projection & Peak Value',
        'Age Curve & Career Trajectory',
        'Contract Value & Financial Flexibility',
        'Prospect Grade & Ceiling (20-80 scale)',
        'Farm System & Organizational Depth Impact',
        'Playoff Window Alignment',
        'Historical Comps & Market Value',
        'Positional Need & Roster Fit',
        'Risk Assessment (injury, performance, options)',
        'Long-Term Franchise Impact',
      ];

  const userPrompt = `Evaluate this MLB trade:

${teamAName || 'Team A'} receives: ${teamA}
${teamBName || 'Team B'} receives: ${teamB}

${context ? `Additional context: ${context}` : ''}

Mode: ${isFantasy ? 'Fantasy Baseball' : 'Real-Life MLB'}

Evaluate this trade across all 10 dimensions below. For EACH dimension, give a score from 1-10 for ${teamAName || 'Team A'} AND ${teamBName || 'Team B'} separately, plus a 2-3 sentence analysis.

Dimensions to evaluate:
${dimensions.map((d, i) => `${i + 1}. ${d}`).join('\n')}

Then provide:
- Overall letter grade for ${teamAName || 'Team A'} (A+/A/A-/B+/B/B-/C+/C/C-/D/F)
- Overall letter grade for ${teamBName || 'Team B'} (A+/A/A-/B+/B/B-/C+/C/C-/D/F)
- A definitive verdict (1 sentence): who wins this trade and why
- A detailed verdict summary (3-5 sentences) with your full reasoning
- 3 key reasons ${teamAName || 'Team A'} benefits
- 3 key reasons ${teamBName || 'Team B'} benefits
- The single biggest risk in this trade
- Historical comp: what famous MLB trade does this remind you of and why

Respond ONLY with this exact JSON structure, no markdown, no preamble:
{
  "dimensions": [
    {
      "name": "dimension name",
      "teamAScore": 7,
      "teamBScore": 6,
      "analysis": "Your 2-3 sentence analysis here"
    }
  ],
  "teamAGrade": "B+",
  "teamBGrade": "B-",
  "winner": "Team A" or "Team B" or "Even",
  "verdict": "One sentence definitive verdict",
  "verdictDetail": "3-5 sentence detailed reasoning",
  "teamABenefits": ["reason 1", "reason 2", "reason 3"],
  "teamBBenefits": ["reason 1", "reason 2", "reason 3"],
  "biggestRisk": "The single biggest risk in this trade",
  "historicalComp": "The famous trade this reminds you of and why"
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: `Anthropic API error: ${response.status}`, detail: err.slice(0, 200) });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text ?? '';

    // Strip any accidental markdown fences
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json({ ...parsed, mode, teamAName, teamBName });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}