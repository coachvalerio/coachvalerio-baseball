// pages/api/prospects.js
// Returns curated prospect data + live minor league stats from MLB Stats API
// sportId: 11=MLB, 12=AAA, 13=AA, 14=A+, 15=A, 16=Rookie

// ── Curated Top 100 (2025 season, pre-debut or recent) ──────────────────────
const TOP_PROSPECTS = [
  // rank, id, name, pos, team, teamId, eta, level, age, tools: {hit,power,run,field,arm} (20-80)
  { rank:1,  id:694973,  name:'Paul Skenes',      pos:'SP', team:'Pirates',     teamId:134, eta:2024, level:'MLB', age:22, tools:{hit:55,power:55,run:45,field:60,arm:80}, notes:'Generational arm. Already elite at MLB level.', recentPromo:false },
  { rank:2,  id:691406,  name:'Jackson Holliday', pos:'SS', team:'Orioles',     teamId:110, eta:2024, level:'MLB', age:21, tools:{hit:65,power:55,run:60,field:60,arm:60}, notes:'Switch-hitting SS, exceptional plate discipline.', recentPromo:false },
  { rank:3,  id:694497,  name:'Jackson Chourio',  pos:'OF', team:'Brewers',     teamId:158, eta:2024, level:'MLB', age:20, tools:{hit:60,power:65,run:70,field:60,arm:65}, notes:'Five-tool talent. Speed + power combo is rare.', recentPromo:false },
  { rank:4,  id:680757,  name:'Wyatt Langford',   pos:'OF', team:'Rangers',     teamId:140, eta:2024, level:'MLB', age:23, tools:{hit:60,power:60,run:65,field:60,arm:60}, notes:'Premium athlete, plus hit tool from day one.', recentPromo:false },
  { rank:5,  id:691050,  name:'Dylan Crews',      pos:'OF', team:'Nationals',   teamId:120, eta:2024, level:'AAA', age:23, tools:{hit:60,power:55,run:65,field:65,arm:60}, notes:'LSU legend. Ready for MLB now.', recentPromo:true },
  { rank:6,  id:694192,  name:'Max Clark',        pos:'OF', team:'Tigers',      teamId:116, eta:2026, level:'A+',  age:20, tools:{hit:65,power:55,run:70,field:70,arm:65}, notes:'Near-elite athlete. Best OF tools in the system.', recentPromo:false },
  { rank:7,  id:694201,  name:'Colson Montgomery',pos:'SS', team:'White Sox',   teamId:145, eta:2025, level:'AA',  age:23, tools:{hit:60,power:55,run:50,field:55,arm:60}, notes:'Polished hitter. High OBP profile.', recentPromo:true },
  { rank:8,  id:694517,  name:'Druw Jones',       pos:'OF', team:'D-backs',     teamId:109, eta:2026, level:'A+',  age:20, tools:{hit:55,power:55,run:70,field:75,arm:65}, notes:'Son of Andruw Jones. Elite glove in CF.', recentPromo:false },
  { rank:9,  id:694003,  name:'Brady House',      pos:'SS', team:'Nationals',   teamId:120, eta:2025, level:'AA',  age:21, tools:{hit:55,power:60,run:50,field:55,arm:65}, notes:'Raw power. Physical tools off the charts.', recentPromo:true },
  { rank:10, id:694921,  name:'Chase DeLauter',   pos:'OF', team:'Guardians',   teamId:114, eta:2025, level:'AA',  age:22, tools:{hit:60,power:60,run:60,field:60,arm:60}, notes:'Plus hit/power combo. Missed time with injuries.', recentPromo:false },
  { rank:11, id:677951,  name:'Junior Caminero',  pos:'3B', team:'Rays',        teamId:139, eta:2024, level:'MLB', age:21, tools:{hit:55,power:70,run:50,field:50,arm:65}, notes:'Lightning-fast bat speed. Plus-plus raw power.', recentPromo:false },
  { rank:12, id:694484,  name:'Roki Sasaki',      pos:'SP', team:'Dodgers',     teamId:119, eta:2025, level:'MLB', age:23, tools:{hit:45,power:40,run:40,field:55,arm:80}, notes:'Japan ace. 100+ mph fastball + elite splitter.', recentPromo:false },
  { rank:13, id:694190,  name:'Bubba Chandler',   pos:'SP', team:'Pirates',     teamId:134, eta:2025, level:'AAA', age:22, tools:{hit:45,power:40,run:55,field:55,arm:75}, notes:'High ceiling SP. Electric stuff.', recentPromo:true },
  { rank:14, id:695243,  name:'Ethan Salas',      pos:'C',  team:'Padres',      teamId:135, eta:2025, level:'A+',  age:18, tools:{hit:60,power:55,run:40,field:65,arm:70}, notes:'Youngest player drafted #1 eligible. Elite bat.', recentPromo:false },
  { rank:15, id:693978,  name:'Matt Shaw',        pos:'SS', team:'Cubs',        teamId:112, eta:2025, level:'AA',  age:23, tools:{hit:60,power:55,run:55,field:55,arm:60}, notes:'College polish. Quick path to MLB.', recentPromo:true },
  { rank:16, id:695664,  name:'Hurston Waldrep',  pos:'SP', team:'Braves',      teamId:144, eta:2025, level:'AAA', age:24, tools:{hit:40,power:35,run:40,field:50,arm:70}, notes:'Nasty slider. Starter with closer ceiling.', recentPromo:true },
  { rank:17, id:694173,  name:'Kyle Manzardo',    pos:'1B', team:'Guardians',   teamId:114, eta:2024, level:'MLB', age:23, tools:{hit:65,power:65,run:35,field:55,arm:50}, notes:'Elite hit tool + power. Potential batting champ.', recentPromo:false },
  { rank:18, id:695804,  name:'Enrique Bradfield', pos:'OF',team:'Astros',      teamId:117, eta:2025, level:'AA',  age:21, tools:{hit:55,power:45,run:80,field:70,arm:60}, notes:'80-grade speed. Outfield defense is elite.', recentPromo:false },
  { rank:19, id:694739,  name:'Walker Jenkins',   pos:'OF', team:'Twins',       teamId:142, eta:2026, level:'A',   age:20, tools:{hit:65,power:55,run:60,field:60,arm:60}, notes:'Clean swing. Could be a 30-HR hitter.', recentPromo:false },
  { rank:20, id:694980,  name:'Heston Kjerstad',  pos:'OF', team:'Orioles',     teamId:110, eta:2024, level:'MLB', age:25, tools:{hit:60,power:60,run:55,field:55,arm:60}, notes:'Former #2 overall. Finally healthy and raking.', recentPromo:false },
  { rank:21, id:695858,  name:'Thomas White',     pos:'SP', team:'Red Sox',     teamId:111, eta:2026, level:'A+',  age:20, tools:{hit:40,power:35,run:45,field:55,arm:75}, notes:'Three plus pitches. High ceiling lefty.', recentPromo:false },
  { rank:22, id:695457,  name:'Cam Collier',      pos:'3B', team:'Reds',        teamId:113, eta:2026, level:'AA',  age:20, tools:{hit:60,power:60,run:50,field:55,arm:65}, notes:'Son of Lou Collier. Plus bat, plus power.', recentPromo:false },
  { rank:23, id:695168,  name:'Brice Matthews',   pos:'SS', team:'Astros',      teamId:117, eta:2026, level:'A',   age:20, tools:{hit:55,power:50,run:65,field:55,arm:60}, notes:'Athletic SS with above-average tools across board.', recentPromo:false },
  { rank:24, id:694741,  name:'Colt Keith',       pos:'2B', team:'Tigers',      teamId:116, eta:2024, level:'MLB', age:22, tools:{hit:60,power:55,run:50,field:55,arm:55}, notes:'Advanced hit tool. MLB-ready from day one.', recentPromo:false },
  { rank:25, id:693316,  name:'Marco Luciano',    pos:'SS', team:'Giants',      teamId:137, eta:2024, level:'MLB', age:22, tools:{hit:55,power:65,run:55,field:55,arm:65}, notes:'Raw power is legitimate plus-plus.', recentPromo:false },
  { rank:26, id:695538,  name:'Braden Montgomery',pos:'OF', team:'Red Sox',     teamId:111, eta:2026, level:'A+',  age:21, tools:{hit:55,power:60,run:65,field:60,arm:60}, notes:'Elite athlete. Quick ascent through system.', recentPromo:true },
  { rank:27, id:694561,  name:'Samuel Basallo',   pos:'C',  team:'Orioles',     teamId:110, eta:2026, level:'AA',  age:19, tools:{hit:60,power:65,run:40,field:60,arm:70}, notes:'Switch-hitting catcher. Rare offensive ceiling.', recentPromo:false },
  { rank:28, id:694992,  name:'Travis Bazzana',   pos:'2B', team:'Guardians',   teamId:114, eta:2025, level:'AA',  age:22, tools:{hit:65,power:55,run:60,field:60,arm:55}, notes:'2024 #1 pick. Plus-plus contact, gap power.', recentPromo:true },
  { rank:29, id:695671,  name:'Jac Caglianone',   pos:'1B', team:'Royals',      teamId:118, eta:2026, level:'A+',  age:22, tools:{hit:55,power:70,run:40,field:50,arm:55}, notes:'Monster raw power. Led NCAA in HR.', recentPromo:false },
  { rank:30, id:694547,  name:'Charlie Condon',   pos:'OF', team:'Rockies',     teamId:115, eta:2026, level:'AA',  age:22, tools:{hit:60,power:65,run:55,field:55,arm:65}, notes:'2024 #3 pick. Five-tool potential.', recentPromo:false },
  { rank:31, id:695099,  name:'Nolan Schanuel',   pos:'1B', team:'Angels',      teamId:108, eta:2023, level:'MLB', age:23, tools:{hit:65,power:55,run:40,field:55,arm:50}, notes:'Elite OBP. Near-.400 minor league OBP.', recentPromo:false },
  { rank:32, id:676475,  name:'Kevin Alcántara',  pos:'OF', team:'Cubs',        teamId:112, eta:2025, level:'AAA', age:22, tools:{hit:55,power:60,run:65,field:65,arm:65}, notes:'6-foot-6 OF. Projection still coming.', recentPromo:true },
  { rank:33, id:695200,  name:'Termarr Johnson',  pos:'2B', team:'Pirates',     teamId:134, eta:2025, level:'AA',  age:21, tools:{hit:65,power:55,run:55,field:55,arm:55}, notes:'Elite bat speed. Plus hit tool is real.', recentPromo:false },
  { rank:34, id:694569,  name:'Marcelo Mayer',    pos:'SS', team:'Red Sox',     teamId:111, eta:2025, level:'AAA', age:22, tools:{hit:60,power:55,run:55,field:60,arm:65}, notes:'Smooth SS. Could be face of a franchise.', recentPromo:true },
  { rank:35, id:695003,  name:'Mick Abel',        pos:'SP', team:'Phillies',    teamId:143, eta:2025, level:'AAA', age:23, tools:{hit:40,power:35,run:45,field:55,arm:70}, notes:'Three-pitch mix. Durable starter profile.', recentPromo:false },
  { rank:36, id:694763,  name:'Pete Crow-Armstrong',pos:'OF',team:'Cubs',       teamId:112, eta:2023, level:'MLB', age:22, tools:{hit:55,power:50,run:70,field:75,arm:65}, notes:'Electrifying in center. Gold Glove caliber.', recentPromo:false },
  { rank:37, id:695444,  name:'Hurston Waldrep',  pos:'SP', team:'Braves',      teamId:144, eta:2025, level:'AAA', age:24, tools:{hit:40,power:35,run:40,field:50,arm:70}, notes:'High-spin slider. Electric late-game option.', recentPromo:false },
  { rank:38, id:695673,  name:'Justin Crawford',  pos:'OF', team:'Phillies',    teamId:143, eta:2026, level:'A+',  age:21, tools:{hit:55,power:45,run:80,field:70,arm:60}, notes:'Son of Carl Crawford. Speed is elite.', recentPromo:false },
  { rank:39, id:695543,  name:'Estuary Ruiz',     pos:'SS', team:'Padres',      teamId:135, eta:2027, level:'A',   age:19, tools:{hit:60,power:55,run:60,field:60,arm:65}, notes:'IFA signee. Tool grades across the board.', recentPromo:false },
  { rank:40, id:694789,  name:'Jordan Westburg',  pos:'2B', team:'Orioles',     teamId:110, eta:2023, level:'MLB', age:25, tools:{hit:55,power:55,run:55,field:60,arm:60}, notes:'Well-rounded profile. Everyday player.', recentPromo:false },
];

// Fetch minor league stats
const sf = async (url) => {
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 4500);
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
};

async function getProspectStats(id, isPitcher = false) {
  const season = new Date().getFullYear();
  const group  = isPitcher ? 'pitching' : 'hitting';
  // Try each level: MLB first, then AAA, AA, A+, A
  const sportIds = [1, 11, 12, 13, 14, 15];
  for (const sid of sportIds) {
    const d = await sf(`https://statsapi.mlb.com/api/v1/people/${id}/stats?stats=season&group=${group}&season=${season}&sportId=${sid}`);
    const splits = d?.stats?.[0]?.splits ?? [];
    if (splits.length) {
      const s = splits[0].stat;
      return isPitcher
        ? { era: s.era, whip: s.whip, ip: s.inningsPitched, k: s.strikeOuts, bb: s.baseOnBalls, w: s.wins, l: s.losses, level: sid }
        : { avg: s.avg, ops: s.ops, hr: s.homeRuns, rbi: s.rbi, sb: s.stolenBases, h: s.hits, ab: s.atBats, bb: s.baseOnBalls, obp: s.obp, slg: s.slugging, level: sid };
    }
  }
  return null;
}

const SPORT_LABEL = { 1:'MLB', 11:'AAA', 12:'AAA', 13:'AA', 14:'A+', 15:'A', 16:'Rk' };

export default async function handler(req, res) {
  const { team, limit = 100 } = req.query;

  let list = [...TOP_PROSPECTS];
  if (team) list = list.filter(p => p.teamId === parseInt(team));
  list = list.slice(0, parseInt(limit));

  // Fetch stats in parallel
  const withStats = await Promise.all(
    list.map(async p => {
      const isPitcher = ['SP','RP','CP'].includes(p.pos);
      const stats = await getProspectStats(p.id, isPitcher);
      return {
        ...p,
        stats,
        statLevel: stats ? (SPORT_LABEL[stats.level] ?? p.level) : null,
        isPitcher,
      };
    })
  );

  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
  return res.status(200).json({
    prospects: withStats,
    total: withStats.length,
    season: new Date().getFullYear(),
  });
}