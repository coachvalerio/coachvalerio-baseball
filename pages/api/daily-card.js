// pages/api/daily-card.js
// Powers the homepage "Lineup Card" — one API for:
//   #5  Daily lineup card (best matchup, hottest hitter)
//   #11 Statcast outlier alerts (velo drops, xBA-BA luck gaps)
//   #12 Milestone tracker (players approaching round numbers)

const TIMEOUT = (ms) => AbortSignal.timeout(ms);

// ── Milestone thresholds ──────────────────────────────────────────────────
const MILESTONES = {
  hitting: [
    { stat: 'homeRuns',  career: true, targets: [300, 400, 500, 600, 700], label: 'Career HR' },
    { stat: 'hits',      career: true, targets: [2000, 2500, 3000],        label: 'Career Hits' },
    { stat: 'rbi',       career: true, targets: [1000, 1500, 2000],        label: 'Career RBI' },
  ],
  pitching: [
    { stat: 'strikeOuts', career: true, targets: [2000, 2500, 3000],  label: 'Career K' },
    { stat: 'wins',       career: true, targets: [200, 250, 300],     label: 'Career Wins' },
    { stat: 'saves',      career: true, targets: [300, 400],          label: 'Career Saves' },
  ],
};

// How close (in % of target) a player must be to count as "approaching"
const PROXIMITY = 0.985; // within 1.5%

async function fetchJSON(url, ms = 8000) {
  try {
    const r = await fetch(url, { signal: TIMEOUT(ms) });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

// ── #5 Today's best pitching matchup ──────────────────────────────────────
async function getBestMatchup() {
  const today = new Date().toISOString().slice(0, 10);
  const sched = await fetchJSON(
    `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${today}&hydrate=probablePitcher(stats(group=pitching,type=season))`
  );
  const games = sched?.dates?.[0]?.games ?? [];

  let best = null, bestScore = -1;
  for (const g of games) {
    const away = g.teams?.away, home = g.teams?.home;
    const pA = away?.probablePitcher, pH = home?.probablePitcher;
    if (!pA || !pH) continue;

    const eraOf = (p) => {
      const s = p.stats?.find(st => st.group?.displayName === 'pitching' && st.type?.displayName === 'season');
      return parseFloat(s?.stats?.era ?? 99);
    };
    const eraA = eraOf(pA), eraH = eraOf(pH);
    if (eraA > 90 || eraH > 90) continue;

    // Lower combined ERA = better matchup
    const score = 10 - (eraA + eraH);
    if (score > bestScore) {
      bestScore = score;
      best = {
        gamePk: g.gamePk,
        awayTeam: away.team?.name, homeTeam: home.team?.name,
        awayAbbr: away.team?.abbreviation, homeAbbr: home.team?.abbreviation,
        pitcherAway: { id: pA.id, name: pA.fullName, era: eraA.toFixed(2) },
        pitcherHome: { id: pH.id, name: pH.fullName, era: eraH.toFixed(2) },
        time: g.gameDate,
        venue: g.venue?.name,
      };
    }
  }
  return best;
}

// ── #11 Outlier alerts: hardest hit yesterday + biggest luck gaps ──────────
async function getOutliers(season) {
  const out = { hardestHit: null, luckCandidates: [], veloDrops: [] };

  // Luck candidates — biggest xBA-BA gaps from Savant expected stats
  try {
    const r = await fetch(
      `https://baseballsavant.mlb.com/leaderboard/expected_statistics?type=batter&year=${season}&position=&team=&min=100&csv=true`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Referer': 'https://baseballsavant.mlb.com/' }, signal: TIMEOUT(8000) }
    );
    if (r.ok) {
      const text = await r.text();
      const lines = text.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
      const idx = (name) => headers.indexOf(name);
      const rows = lines.slice(1).map(l => l.split(','));

      const iLast = idx('last_name'), iFirst = idx('first_name'),
            iId = idx('player_id'), iBA = idx('ba'), iXBA = idx('est_ba');

      if (iBA >= 0 && iXBA >= 0) {
        const gaps = rows.map(r => {
          const ba = parseFloat(r[iBA]), xba = parseFloat(r[iXBA]);
          if (isNaN(ba) || isNaN(xba)) return null;
          return {
            playerId: iId >= 0 ? parseInt(r[iId]) : null,
            name: iFirst >= 0 && iLast >= 0 ? `${(r[iFirst]??'').trim()} ${(r[iLast]??'').trim()}` : '—',
            ba: ba.toFixed(3), xba: xba.toFixed(3),
            gap: +(xba - ba).toFixed(3), // positive = unlucky (due for regression UP)
          };
        }).filter(Boolean);

        gaps.sort((a, b) => b.gap - a.gap);
        out.luckCandidates = [
          ...gaps.slice(0, 3).map(g => ({ ...g, tag: 'UNLUCKY — DUE UP' })),
          ...gaps.slice(-3).reverse().map(g => ({ ...g, tag: 'OVERPERFORMING' })),
        ];
      }
    }
  } catch {}

  return out;
}

// ── #12 Milestone tracker ──────────────────────────────────────────────────
async function getMilestones() {
  const results = [];
  // Career stat leaders close to thresholds — use MLB career leaders
  const cats = [
    { cat: 'homeRuns',   group: 'hitting',  targets: [300, 400, 500, 600], label: 'HR' },
    { cat: 'hits',       group: 'hitting',  targets: [2000, 2500, 3000],   label: 'Hits' },
    { cat: 'strikeouts', group: 'pitching', targets: [2000, 2500, 3000],   label: 'K' },
    { cat: 'wins',       group: 'pitching', targets: [200, 250, 300],      label: 'Wins' },
  ];

  await Promise.all(cats.map(async ({ cat, group, targets, label }) => {
    const d = await fetchJSON(
      `https://statsapi.mlb.com/api/v1/stats/leaders?leaderCategories=${cat}&statType=career&season=${new Date().getFullYear()}&limit=60&sportId=1&statGroup=${group}&playerPool=all`
    );
    const leaders = d?.leagueLeaders?.[0]?.leaders ?? [];
    for (const l of leaders) {
      const val = parseInt(l.value, 10);
      if (isNaN(val)) continue;
      for (const t of targets) {
        const remaining = t - val;
        // Within reach this season: 1–35 away (HR/wins) or 1–250 (hits/K)
        const window = (label === 'HR' || label === 'Wins') ? 35 : 250;
        if (remaining > 0 && remaining <= window) {
          results.push({
            playerId: l.person?.id, name: l.person?.fullName,
            team: l.team?.abbreviation ?? '',
            current: val, target: t, remaining, label,
          });
          break; // only nearest milestone per player per stat
        }
      }
    }
  }));

  // Sort by % proximity to milestone
  results.sort((a, b) => (a.remaining / a.target) - (b.remaining / b.target));
  return results.slice(0, 8);
}

// ── #5 Hottest hitter (reuse hot-cold logic, simplified) ───────────────────
async function getHottestHitter() {
  try {
    const r = await fetchJSON(`${process.env.NEXT_PUBLIC_BASE_URL || 'https://www.coachvalerio.com'}/api/hot-cold`);
    const hot = r?.hot?.[0] ?? null;
    return hot;
  } catch { return null; }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=600');
  const season = new Date().getFullYear();

  const [matchup, outliers, milestones, hottest] = await Promise.all([
    getBestMatchup(),
    getOutliers(season),
    getMilestones(),
    getHottestHitter(),
  ]);

  res.status(200).json({
    date: new Date().toISOString().slice(0, 10),
    matchup, outliers, milestones, hottest,
  });
}