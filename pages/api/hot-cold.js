// pages/api/hot-cold.js
// Fetches game logs for star players, returns top 5 hot & top 5 cold by recent avg

const WATCH_LIST = [
  // id, name, pos, team
  { id:592450,  name:'Aaron Judge',      pos:'OF', team:'NYY' },
  { id:660271,  name:'Shohei Ohtani',    pos:'DH', team:'LAD' },
  { id:545361,  name:'Mike Trout',       pos:'OF', team:'LAA' },
  { id:605141,  name:'Mookie Betts',     pos:'OF', team:'LAD' },
  { id:518692,  name:'Freddie Freeman',  pos:'1B', team:'LAD' },
  { id:660670,  name:'Ronald Acuña Jr.', pos:'OF', team:'ATL' },
  { id:547180,  name:'Bryce Harper',     pos:'1B', team:'PHI' },
  { id:665742,  name:'Juan Soto',        pos:'OF', team:'NYM' },
  { id:607208,  name:'Trea Turner',      pos:'SS', team:'PHI' },
  { id:624413,  name:'Pete Alonso',      pos:'1B', team:'NYM' },
  { id:683002,  name:'Gunnar Henderson', pos:'SS', team:'BAL' },
  { id:671096,  name:'Bobby Witt Jr.',   pos:'SS', team:'KC'  },
  { id:670541,  name:'Yordan Alvarez',   pos:'DH', team:'HOU' },
  { id:677594,  name:'Julio Rodriguez',  pos:'OF', team:'SEA' },
  { id:682998,  name:'Corbin Carroll',   pos:'OF', team:'ARI' },
  { id:702616,  name:'Jackson Holliday', pos:'SS', team:'BAL' },
  { id:694192,  name:'Jackson Chourio',  pos:'OF', team:'MIL' },
  { id:694671,  name:'Wyatt Langford',   pos:'OF', team:'TEX' },
  { id:691406,  name:'Junior Caminero',  pos:'3B', team:'TB'  },
  { id:596019,  name:'Paul Goldschmidt', pos:'1B', team:'STL' },
  { id:641355,  name:'José Ramírez',     pos:'3B', team:'CLE' },
  { id:543760,  name:'Nolan Arenado',    pos:'3B', team:'STL' },
  { id:592518,  name:'Freddy Peralta',   pos:'SP', team:'MIL' },
  { id:621566,  name:'Gerrit Cole',      pos:'SP', team:'NYY', isPitcher:true },
  { id:656756,  name:'Zack Wheeler',     pos:'SP', team:'PHI', isPitcher:true  },
  { id:641154,  name:'Framber Valdez',   pos:'SP', team:'HOU', isPitcher:true  },
  { id:694973,  name:'Paul Skenes',      pos:'SP', team:'PIT', isPitcher:true  },
  { id:668676,  name:'Spencer Strider',  pos:'SP', team:'ATL', isPitcher:true  },
  { id:592789,  name:'Wander Franco',    pos:'SS', team:'TB'  },
  { id:645302,  name:'Rafael Devers',    pos:'3B', team:'BOS' },
];

const sf = async (url) => {
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
};

export default async function handler(req, res) {
  const season = new Date().getFullYear();

  // Fetch game logs for all players in parallel
  const fetches = WATCH_LIST.map(p =>
    sf(`https://statsapi.mlb.com/api/v1/people/${p.id}/stats?stats=gameLog&group=${p.isPitcher ? 'pitching' : 'hitting'}&season=${season}&limit=10`)
      .then(d => ({ ...p, logs: d?.stats?.[0]?.splits ?? [] }))
  );

  const results = await Promise.all(fetches);

  const processed = results
    .map(p => {
      if (!p.logs.length) return null;
      const recent = p.logs.slice(0, 10); // most recent first

      if (p.isPitcher) {
        const totalIP  = recent.reduce((a, g) => a + parseFloat(g.stat?.inningsPitched ?? 0), 0);
        const totalER  = recent.reduce((a, g) => a + parseInt(g.stat?.earnedRuns ?? 0), 0);
        const totalK   = recent.reduce((a, g) => a + parseInt(g.stat?.strikeOuts ?? 0), 0);
        const totalBB  = recent.reduce((a, g) => a + parseInt(g.stat?.baseOnBalls ?? 0), 0);
        const totalH   = recent.reduce((a, g) => a + parseInt(g.stat?.hits ?? 0), 0);
        const era      = totalIP > 0 ? (totalER / totalIP * 9).toFixed(2) : null;
        const whip     = totalIP > 0 ? ((totalH + totalBB) / totalIP).toFixed(2) : null;
        const gamesPlayed = recent.length;
        // Score: lower ERA = hotter; ERA < 2.50 is very hot
        const score = era !== null ? (5.00 - parseFloat(era)) : 0; // positive = hot
        return { ...p, gamesPlayed, era, whip, k: totalK, score, statLine: `${era} ERA · ${totalK} K · ${whip} WHIP`, type:'pitcher' };
      } else {
        const totalAB  = recent.reduce((a, g) => a + parseInt(g.stat?.atBats ?? 0), 0);
        const totalH   = recent.reduce((a, g) => a + parseInt(g.stat?.hits ?? 0), 0);
        const totalHR  = recent.reduce((a, g) => a + parseInt(g.stat?.homeRuns ?? 0), 0);
        const totalRBI = recent.reduce((a, g) => a + parseInt(g.stat?.rbi ?? 0), 0);
        const totalBB  = recent.reduce((a, g) => a + parseInt(g.stat?.baseOnBalls ?? 0), 0);
        const totalSB  = recent.reduce((a, g) => a + parseInt(g.stat?.stolenBases ?? 0), 0);
        const totalPA  = totalAB + totalBB;
        const avg      = totalAB > 0 ? (totalH / totalAB) : 0;
        const obp      = totalPA > 0 ? ((totalH + totalBB) / totalPA) : 0;
        const gamesPlayed = recent.length;
        // Multi-factor heat score
        const score    = avg + (totalHR * 0.08) + (obp * 0.5) + (totalSB * 0.015);
        const avgStr   = totalAB > 0 ? avg.toFixed(3) : null;
        return {
          ...p, gamesPlayed, avg: avgStr, hr: totalHR, rbi: totalRBI, sb: totalSB,
          score, statLine: avgStr ? `${avgStr} · ${totalHR} HR · ${totalRBI} RBI` : null,
          type: 'batter'
        };
      }
    })
    .filter(p => p && p.statLine && p.gamesPlayed >= 3);

  if (!processed.length) {
    // Off-season fallback — return empty with message
    res.setHeader('Cache-Control', 's-maxage=3600');
    return res.status(200).json({ hot: [], cold: [], offseason: true, season });
  }

  processed.sort((a, b) => b.score - a.score);

  const hot  = processed.slice(0, 5);
  const cold = processed.slice(-5).reverse();

  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=300');
  return res.status(200).json({ hot, cold, offseason: false, season });
}