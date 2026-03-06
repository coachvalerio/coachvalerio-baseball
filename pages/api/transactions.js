// pages/api/transactions.js
// MLB transactions: trades, signings, DFAs, call-ups, releases

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');

  const days  = parseInt(req.query.days ?? '7');
  const end   = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);

  const fmt = d => d.toISOString().slice(0, 10);

  try {
    const txRes = await fetch(
      `https://statsapi.mlb.com/api/v1/transactions?startDate=${fmt(start)}&endDate=${fmt(end)}` +
      `&sportId=1&fields=transactions,id,date,effectiveDate,typeCode,typeDesc,person,fromTeam,toTeam,description`
    );
    const txData = await txRes.json();
    const raw = txData.transactions ?? [];

    // Filter to notable transaction types only
    const NOTABLE = new Set([
      'TR',  // Trade
      'SGN', // Signing
      'DFA', // Designated for Assignment
      'OU',  // Outrighted
      'REL', // Released
      'SE',  // Selected (call-up)
      'ASG', // Assignment
      'OPT', // Optional assignment (sent down)
      'RET', // Retired
      'FR',  // Free agent signing
      'DES', // Designation
    ]);

    const filtered = raw
      .filter(t => {
        const code = t.typeCode ?? '';
        return NOTABLE.has(code) || (t.description ?? '').match(/trade|sign|DFA|designat|assign|optioned|select|releas|retire/i);
      })
      .slice(0, 100); // cap at 100

    // Batch fetch player stats for players mentioned in transactions
    const playerIds = [...new Set(
      filtered.map(t => t.person?.id).filter(Boolean)
    )].slice(0, 40); // cap batch

    let playerStats = {};
    if (playerIds.length > 0) {
      try {
        const season = new Date().getFullYear();
        const pRes = await fetch(
          `https://statsapi.mlb.com/api/v1/people?personIds=${playerIds.join(',')}&hydrate=stats(group=[hitting,pitching],type=season,season=${season}),currentTeam`
        );
        const pData = await pRes.json();
        for (const p of pData.people ?? []) {
          const hitStats = p.stats?.find(s => s.group?.displayName === 'hitting')?.splits?.[0]?.stat;
          const pitStats = p.stats?.find(s => s.group?.displayName === 'pitching')?.splits?.[0]?.stat;
          playerStats[p.id] = {
            position: p.primaryPosition?.abbreviation ?? '',
            age:      p.currentAge ?? null,
            team:     p.currentTeam?.name ?? '',
            hitting:  hitStats ? {
              avg: hitStats.avg, hr: hitStats.homeRuns, rbi: hitStats.rbi,
              ops: hitStats.ops, sb: hitStats.stolenBases, g: hitStats.gamesPlayed,
            } : null,
            pitching: pitStats ? {
              era: pitStats.era, w: pitStats.wins, l: pitStats.losses,
              so: pitStats.strikeOuts, ip: pitStats.inningsPitched, whip: pitStats.whip, g: pitStats.gamesPitched,
            } : null,
          };
        }
      } catch {}
    }

    const enriched = filtered.map(t => ({
      id:          t.id,
      date:        t.date ?? t.effectiveDate,
      typeCode:    t.typeCode,
      typeDesc:    t.typeDesc ?? labelType(t.typeCode, t.description),
      description: t.description ?? '',
      person: t.person ? {
        id:   t.person.id,
        name: t.person.fullName ?? t.person.nameFirstLast ?? '',
        stats: playerStats[t.person.id] ?? null,
      } : null,
      fromTeam: t.fromTeam?.name ?? null,
      toTeam:   t.toTeam?.name ?? null,
    }));

    // Sort newest first
    enriched.sort((a, b) => new Date(b.date) - new Date(a.date));

    return res.status(200).json({ transactions: enriched, startDate: fmt(start), endDate: fmt(end) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

function labelType(code, desc = '') {
  const map = {
    TR: 'Trade', SGN: 'Signing', DFA: 'DFA', OU: 'Outrighted',
    REL: 'Released', SE: 'Called Up', ASG: 'Assignment',
    OPT: 'Optioned Down', RET: 'Retired', FR: 'Free Agent', DES: 'Designation',
  };
  if (map[code]) return map[code];
  if (/trade/i.test(desc))   return 'Trade';
  if (/sign/i.test(desc))    return 'Signing';
  if (/DFA|designat/i.test(desc)) return 'DFA';
  if (/select/i.test(desc))  return 'Called Up';
  if (/option/i.test(desc))  return 'Optioned Down';
  if (/releas/i.test(desc))  return 'Released';
  return code ?? 'Transaction';
}