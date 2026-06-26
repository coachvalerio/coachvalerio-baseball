// pages/api/daily-card.js
// Powers the homepage "Lineup Card" — one API for:
//   #5  Daily lineup card (best matchup, hottest hitter)
//   #11 Statcast outlier alerts (velo drops, xBA-BA luck gaps)
//   #12 Milestone tracker (players approaching round numbers)

const TIMEOUT = (ms) => AbortSignal.timeout(ms);

// ── "Today" in baseball terms: Eastern time, rolling over at 4:00 AM ET ──
// Before 4 AM ET the slate still belongs to the previous calendar day
// (covers West Coast games that end after midnight Eastern). This also
// fixes the UTC bug where evening ET = next-day UTC.
function getBaseballToday() {
  const now = new Date();
  // Get current time as it is in America/New_York
  const etString = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
  const et = new Date(etString);
  // If it's before 4 AM ET, treat it as the previous day
  if (et.getHours() < 4) {
    et.setDate(et.getDate() - 1);
  }
  // Format YYYY-MM-DD from the Eastern date parts
  const y = et.getFullYear();
  const m = String(et.getMonth() + 1).padStart(2, '0');
  const d = String(et.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

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
  const today = getBaseballToday();
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
  const season = new Date().getFullYear();
  const results = [];
  const cats = [
    { cat: 'homeRuns',   group: 'hitting',  targets: [300, 400, 500, 600, 700], label: 'HR' },
    { cat: 'hits',       group: 'hitting',  targets: [2000, 2500, 3000],        label: 'Hits' },
    { cat: 'strikeouts', group: 'pitching', targets: [2000, 2500, 3000],        label: 'K' },
    { cat: 'wins',       group: 'pitching', targets: [200, 250, 300],           label: 'Wins' },
    { cat: 'saves',      group: 'pitching', targets: [300, 400, 500],           label: 'Saves' },
  ];

  // Step 1: gather candidates from career leaders (includes retired players)
  const candidates = [];
  await Promise.all(cats.map(async ({ cat, group, targets, label }) => {
    const d = await fetchJSON(
      `https://statsapi.mlb.com/api/v1/stats/leaders?leaderCategories=${cat}&statType=career&season=${season}&limit=80&sportId=1&statGroup=${group}&playerPool=all`
    );
    const leaders = d?.leagueLeaders?.[0]?.leaders ?? [];
    for (const l of leaders) {
      const val = parseInt(l.value, 10);
      if (isNaN(val) || !l.person?.id) continue;
      for (const t of targets) {
        const remaining = t - val;
        const window = (label === 'HR' || label === 'Wins' || label === 'Saves') ? 30 : 200;
        if (remaining > 0 && remaining <= window) {
          candidates.push({
            playerId: l.person.id, name: l.person.fullName,
            team: l.team?.abbreviation ?? '',
            current: val, target: t, remaining, label,
          });
          break;
        }
      }
    }
  }));

  if (candidates.length === 0) return [];

  // Step 2: verify each candidate is an ACTIVE player.
  // MLB people endpoint returns `active` boolean + currentTeam only for active players.
  const uniqueIds = [...new Set(candidates.map(c => c.playerId))];
  const activeMap = {};
  await Promise.all(uniqueIds.map(async (pid) => {
    const p = await fetchJSON(`https://statsapi.mlb.com/api/v1/people/${pid}`);
    const person = p?.people?.[0];
    if (!person) { activeMap[pid] = false; return; }
    // Must be flagged active AND have a current team (retired players lack this)
    activeMap[pid] = person.active === true && !!person.currentTeam?.id;
  }));

  // Step 3: keep only active players, and confirm they've actually played THIS season.
  // Pull current-season game counts to drop players who are active-rostered but injured/not playing.
  const activeCandidates = candidates.filter(c => activeMap[c.playerId]);

  const verified = [];
  await Promise.all(activeCandidates.map(async (c) => {
    const grp = (c.label === 'K' || c.label === 'Wins' || c.label === 'Saves') ? 'pitching' : 'hitting';
    const s = await fetchJSON(
      `https://statsapi.mlb.com/api/v1/people/${c.playerId}/stats?stats=season&season=${season}&group=${grp}`
    );
    const games = parseInt(s?.stats?.[0]?.splits?.[0]?.stat?.gamesPlayed ?? 0, 10);
    // Must have appeared in at least 1 game this season to be "on pace"
    if (games > 0) {
      // Refresh team from current-season split if available
      const teamAbbr = s?.stats?.[0]?.splits?.[0]?.team?.abbreviation ?? c.team;
      verified.push({ ...c, team: teamAbbr, gamesThisSeason: games });
    }
  }));

  // Sort by closest to milestone (fewest remaining as % of target)
  verified.sort((a, b) => (a.remaining / a.target) - (b.remaining / b.target));
  return verified.slice(0, 8);
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
  // 10-min edge cache keeps it fresh enough that the 4 AM ET rollover
  // is reflected within minutes, without hammering the APIs.
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=300');
  const season = new Date().getFullYear();

  const [matchup, outliers, milestones, hottest] = await Promise.all([
    getBestMatchup(),
    getOutliers(season),
    getMilestones(),
    getHottestHitter(),
  ]);

  res.status(200).json({
    date: getBaseballToday(),
    matchup, outliers, milestones, hottest,
  });
}