// pages/compare.js
import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

function getCurrentSeason() {
  const now = new Date();
  return now >= new Date(now.getFullYear(), 2, 20) ? now.getFullYear() : now.getFullYear() - 1;
}

function pctColor(pct, lowerIsBetter = false) {
  if (pct === null || pct === undefined) return '#3a3f52';
  const p = lowerIsBetter ? 100 - pct : pct;
  if (p >= 90) return '#00c2a8';
  if (p >= 70) return '#2ed47a';
  if (p >= 45) return '#f5a623';
  return '#e63535';
}

const TEAM_COLORS = {
  'New York Yankees':'#003087','Boston Red Sox':'#BD3039','Los Angeles Dodgers':'#005A9C',
  'San Francisco Giants':'#FD5A1E','Chicago Cubs':'#0E3386','Chicago White Sox':'#C4CED4',
  'Houston Astros':'#EB6E1F','Atlanta Braves':'#CE1141','New York Mets':'#FF5910',
  'Philadelphia Phillies':'#E81828','Los Angeles Angels':'#BA0021','Oakland Athletics':'#EFB21E',
  'Seattle Mariners':'#005C5C','Texas Rangers':'#C0111F','Toronto Blue Jays':'#134A8E',
  'Baltimore Orioles':'#DF4601','Tampa Bay Rays':'#8FBCE6','Minnesota Twins':'#D31145',
  'Cleveland Guardians':'#E31937','Detroit Tigers':'#FA4616','Kansas City Royals':'#004687',
  'St. Louis Cardinals':'#C41E3A','Milwaukee Brewers':'#FFC52F','Pittsburgh Pirates':'#FDB827',
  'Cincinnati Reds':'#C6011F','Colorado Rockies':'#8B74C4','Arizona Diamondbacks':'#A71930',
  'San Diego Padres':'#FFC425','Miami Marlins':'#00A3E0','Washington Nationals':'#AB0003',
};
function tc(name) { return TEAM_COLORS[name] ?? '#00c2a8'; }

// Stat rows to compare — [label, statKey, savantPctKey, lowerIsBetter, format]
const BAT_ROWS = [
  ['Batting AVG',    'avg',           'avg_pct',       false, v => v],
  ['OBP',            'obp',           'obp_pct',       false, v => v],
  ['Slugging',       'slg',           'slg_pct',       false, v => v],
  ['OPS',            'ops',           'ops_pct',       false, v => v],
  ['Home Runs',      'homeRuns',      null,            false, v => v],
  ['RBI',            'rbi',           null,            false, v => v],
  ['K%',             '_kpct',         'k_pct',         true,  v => v ? v+'%' : '—'],
  ['BB%',            '_bbpct',        'bb_pct',        false, v => v ? v+'%' : '—'],
  ['xBA',            '_xba',          'xba_pct',       false, v => v],
  ['xSLG',           '_xslg',         'xslg_pct',      false, v => v],
  ['xwOBA',          '_xwoba',        'xwoba_pct',     false, v => v],
  ['Hard Hit%',      '_hard_hit',     'hard_hit_pct',  false, v => v],
  ['Barrel%',        '_barrel',       'barrel_pct',    false, v => v],
  ['Exit Velocity',  '_exit_vel',     'ev_pct',        false, v => v ? v+' mph' : '—'],
  ['Launch Angle',   '_launch_angle', 'launch_angle_pct', false, v => v],
  ['Sprint Speed',   '_sprint',       'sprint_pct',    false, v => v ? v+' ft/s':'—'],
  ['Sweet Spot%',    '_sweet_spot',   'sweet_spot_pct',false, v => v],
];

const PIT_ROWS = [
  ['ERA',           'era',              'era_pct',      true,  v => v],
  ['WHIP',          'whip',             'whip_pct',     true,  v => v],
  ['K/9',           'strikeoutsPer9Inn','k9_pct',       false, v => v],
  ['BB/9',          'baseOnBallsPer9Inn','bb9_pct',     true,  v => v],
  ['Innings',       'inningsPitched',   null,           false, v => v],
  ['Strikeouts',    'strikeOuts',       null,           false, v => v],
  ['xERA',          '_xera',            'xera_pct',     true,  v => v],
  ['Whiff%',        '_whiff',           'whiff_pct',    false, v => v],
  ['Avg Fastball',  '_avg_fb',          'velo_pct',     false, v => v ? v+' mph':'—'],
  ['Exit Vel Against','_exit_vel',      'ev_pct',       true,  v => v ? v+' mph':'—'],
  ['Hard Hit% Against','_hard_hit',     'hard_hit_pct', true,  v => v],
  ['Barrel% Against',  '_barrel',       'barrel_pct',   true,  v => v],
];

function buildPlayerData(stats, savant) {
  const ab = parseInt(stats?.atBats ?? 1);
  const so = parseInt(stats?.strikeOuts ?? 0);
  const bb = parseInt(stats?.baseOnBalls ?? 0);
  return {
    // MLB stat keys
    avg: stats?.avg, obp: stats?.obp, slg: stats?.slg, ops: stats?.ops,
    homeRuns: stats?.homeRuns, rbi: stats?.rbi,
    era: stats?.era, whip: stats?.whip,
    strikeoutsPer9Inn: stats?.strikeoutsPer9Inn,
    baseOnBallsPer9Inn: stats?.baseOnBallsPer9Inn,
    inningsPitched: stats?.inningsPitched,
    strikeOuts: stats?.strikeOuts,
    gamesPlayed: stats?.gamesPlayed,
    // computed
    _kpct: ab > 0 ? ((so/ab)*100).toFixed(1) : null,
    _bbpct: ab > 0 ? ((bb/ab)*100).toFixed(1) : null,
    // savant raw values
    _xba: savant?.xba, _xslg: savant?.xslg, _xwoba: savant?.xwoba,
    _hard_hit: savant?.hard_hit, _barrel: savant?.barrel,
    _exit_vel: savant?.exit_velocity, _launch_angle: savant?.launch_angle,
    _sprint: savant?.sprint_speed, _sweet_spot: savant?.sweet_spot,
    _xera: savant?.xera, _whiff: savant?.whiff, _avg_fb: savant?.avg_fastball,
    // savant pct keys (flattened onto same object for lookup)
    avg_pct: savant?.avg_pct, obp_pct: savant?.obp_pct, slg_pct: savant?.slg_pct,
    ops_pct: savant?.ops_pct, k_pct: savant?.k_pct, bb_pct: savant?.bb_pct,
    xba_pct: savant?.xba_pct, xslg_pct: savant?.xslg_pct, xwoba_pct: savant?.xwoba_pct,
    hard_hit_pct: savant?.hard_hit_pct, barrel_pct: savant?.barrel_pct,
    ev_pct: savant?.ev_pct, launch_angle_pct: savant?.launch_angle_pct,
    sprint_pct: savant?.sprint_pct, sweet_spot_pct: savant?.sweet_spot_pct,
    era_pct: savant?.era_pct, whip_pct: savant?.whip_pct,
    k9_pct: savant?.k9_pct, bb9_pct: savant?.bb9_pct,
    xera_pct: savant?.xera_pct, whiff_pct: savant?.whiff_pct, velo_pct: savant?.velo_pct,
  };
}

function usePlayerData(playerId) {
  const [info, setInfo]       = useState(null);
  const [stats, setStats]     = useState(null);
  const [savant, setSavant]   = useState(null);
  const [loading, setLoading] = useState(false);
  const SEASON = getCurrentSeason();

  useEffect(() => {
    if (!playerId) { setInfo(null); setStats(null); setSavant(null); return; }
    setLoading(true);
    Promise.all([
      fetch(`/api/player?id=${playerId}&season=${SEASON}`).then(r => r.json()).catch(() => null),
      fetch(`/api/savant?id=${playerId}`).then(r => r.json()).catch(() => null),
    ]).then(([playerData, savantData]) => {
      // player API returns: { player, season: { hitting: [...], pitching: [...] } }
      setInfo(playerData?.player ?? null);
      const hitSplits = playerData?.season?.hitting ?? [];
      const pitSplits = playerData?.season?.pitching ?? [];
      const hitStat   = hitSplits[0]?.stat ?? null;
      const pitStat   = pitSplits[0]?.stat ?? null;
      setStats(hitStat ?? pitStat ?? null);
      setSavant(savantData?.available ? savantData : null);
      setLoading(false);
    });
  }, [playerId]);

  return { info, stats, savant, loading };
}

function PlayerSearch({ label, color, onSelect, selectedId }) {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  let timer;

  async function handleSearch(e) {
    const val = e.target.value;
    setQuery(val);
    if (val.length < 2) { setResults([]); return; }
    setSearching(true);
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(val)}`);
        const d = await r.json();
        setResults(d.players ?? []);
      } catch {}
      setSearching(false);
    }, 320);
  }

  return (
    <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
      <div style={{ ...s.searchLabel, color }}>{label}</div>
      <div style={{ position: 'relative' }}>
        <input style={{ ...s.searchInput, borderColor: selectedId ? color : '#1e2028' }}
          type="text" placeholder="Search player…"
          value={query} onChange={handleSearch} autoComplete="off" />
        {results.length > 0 && (
          <div style={s.searchDrop}>
            {results.map(p => (
              <div key={p.id} style={s.searchItem}
                onClick={() => { onSelect(p.id); setQuery(p.fullName); setResults([]); }}
                onMouseEnter={e => e.currentTarget.style.background = '#1e2028'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <img src={`https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_40,q_auto:best/v1/people/${p.id}/headshot/67/current`}
                  alt="" style={s.searchAvatar} onError={e => e.target.style.display='none'} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '.86rem', color: '#f0f2f8' }}>{p.fullName}</div>
                  <div style={{ fontSize: '.72rem', color: '#5c6070' }}>{p.currentTeam?.name ?? ''}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        {searching && <div style={{ fontSize: '.75rem', color: '#5c6070', marginTop: '.3rem' }}>Searching…</div>}
      </div>
    </div>
  );
}

function StatRow({ label, val1, val2, pct1, pct2, lowerIsBetter }) {
  const p1 = typeof pct1 === 'number' ? pct1 : null;
  const p2 = typeof pct2 === 'number' ? pct2 : null;
  const c1 = pctColor(p1, lowerIsBetter);
  const c2 = pctColor(p2, lowerIsBetter);
  const hasPcts = p1 !== null || p2 !== null;

  // Who wins this stat?
  let winner = null;
  if (p1 !== null && p2 !== null && p1 !== p2) {
    winner = p1 > p2 ? 'left' : 'right';
  }

  return (
    <div style={s.statRow}>
      {/* Left value */}
      <div style={{ ...s.statCell, textAlign: 'right' }}>
        <div style={{ ...s.statVal, color: winner === 'left' ? c1 : '#f0f2f8' }}>
          {val1 ?? '—'}
          {winner === 'left' && <span style={{ marginLeft: '.25rem', color: c1 }}>▲</span>}
        </div>
        {hasPcts && p1 !== null && (
          <div style={s.pctRow}>
            <div style={{ ...s.pctBar, background: c1, width: `${Math.min(p1, 100)}%`, marginLeft: 'auto' }} />
            <span style={{ ...s.pctNum, color: c1 }}>{p1}th</span>
          </div>
        )}
      </div>

      {/* Label */}
      <div style={s.rowLabel}>{label}</div>

      {/* Right value */}
      <div style={{ ...s.statCell, textAlign: 'left' }}>
        <div style={{ ...s.statVal, color: winner === 'right' ? c2 : '#f0f2f8' }}>
          {winner === 'right' && <span style={{ marginRight: '.25rem', color: c2 }}>▲</span>}
          {val2 ?? '—'}
        </div>
        {hasPcts && p2 !== null && (
          <div style={{ ...s.pctRow, flexDirection: 'row' }}>
            <span style={{ ...s.pctNum, color: c2 }}>{p2}th</span>
            <div style={{ ...s.pctBar, background: c2, width: `${Math.min(p2, 100)}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function Compare() {
  const [id1, setId1]         = useState(null);
  const [id2, setId2]         = useState(null);
  const [activeId1, setActive1] = useState(null);
  const [activeId2, setActive2] = useState(null);
  const [compared, setCompared] = useState(false);

  const p1 = usePlayerData(activeId1);
  const p2 = usePlayerData(activeId2);

  function runCompare() {
    if (!id1 || !id2) return;
    setActive1(id1);
    setActive2(id2);
    setCompared(true);
  }

  const SEASON = getCurrentSeason();
  const color1 = p1.info ? tc(p1.info.currentTeam?.name ?? '') : '#00c2a8';
  const color2 = p2.info ? tc(p2.info.currentTeam?.name ?? '') : '#f5a623';

  // Determine if we're comparing pitchers or batters
  const isPitcher = (info) => info?.primaryPosition?.abbreviation === 'P' || info?.primaryPosition?.abbreviation === 'SP' || info?.primaryPosition?.abbreviation === 'RP';
  const rows = isPitcher(p1.info) || isPitcher(p2.info) ? PIT_ROWS : BAT_ROWS;

  const d1 = (p1.stats && id1) ? buildPlayerData(p1.stats, p1.savant) : null;
  const d2 = (p2.stats && id2) ? buildPlayerData(p2.stats, p2.savant) : null;

  const hasData = d1 || d2;

  return (
    <>
      <Head>
        <title>Player Comparison — Coach</title>
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@300;400;500;600&family=Barlow+Condensed:wght@400;600;700;900&display=swap" rel="stylesheet" />
        <style>{`
          *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
          body{background:#050608;color:#b8bdd0;font-family:'Barlow',sans-serif;-webkit-font-smoothing:antialiased}
        `}</style>
      </Head>

      {/* NAV */}
      <nav style={s.nav}>
        <a href="/" style={s.logo}>COACH<span style={{ color:"#00c2a8" }}>.</span></a>
        <div style={s.navLinks}>
          <a href="/" style={s.navLink}>Home</a>
          <a href="/scoreboard" style={s.navLink}>Scoreboard</a>
          <a href="/transactions" style={s.navLink}>Transactions</a>
          <a href="/compare" style={{ ...s.navLink, color: '#00c2a8' }}>Compare</a>
        </div>
      </nav>

      {/* HEADER */}
      <div style={s.header}>
        <div style={s.headerInner}>
          <div>
            <div style={s.pageLabel}>PLAYER COMPARISON</div>
            <div style={s.pageTitle}>{SEASON} Head-to-Head</div>
          </div>
        </div>

        {/* Search bars */}
        <div style={s.searchRow}>
          <PlayerSearch label="PLAYER 1" color={color1} onSelect={setId1} selectedId={id1} />
          <div style={s.vsChip}>VS</div>
          <PlayerSearch label="PLAYER 2" color={color2} onSelect={setId2} selectedId={id2} />
        </div>
        <div style={{ maxWidth:'1200px', margin:'.75rem auto 0', display:'flex', justifyContent:'center' }}>
          <button
            onClick={runCompare}
            disabled={!id1 || !id2}
            style={{
              ...s.compareBtn,
              opacity: (!id1 || !id2) ? 0.4 : 1,
              cursor: (!id1 || !id2) ? 'not-allowed' : 'pointer',
            }}>
            ⚖️ COMPARE PLAYERS
          </button>
        </div>
      </div>

      <div style={s.body}>
        {!compared && (
          <div style={s.emptyState}>
            <div style={s.emptyIcon}>⚖️</div>
            <div style={s.emptyTitle}>Search two players to compare</div>
            <div style={s.emptyDesc}>Side-by-side stats with Savant percentile bars. <br />Works for both batters and pitchers.</div>
          </div>
        )}

        {compared && (p1.loading || p2.loading) && (
          <div style={s.loading}>Loading player data…</div>
        )}

        {/* Player header cards */}
        {compared && hasData && !p1.loading && !p2.loading && (
          <>
            <div style={s.playerHeaders}>
              {/* Player 1 header */}
              <div style={{ ...s.playerHeader, borderColor: color1 }}>
                {id1 && <img src={`https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_120,q_auto:best/v1/people/${id1}/headshot/67/current`}
                  alt="" style={{ ...s.playerPhoto, borderColor: color1 }}
                  onError={e => e.target.style.display='none'} />}
                <div>
                  <div style={{ ...s.playerHName, color: color1 }}>{p1.info?.fullName ?? '—'}</div>
                  <div style={s.playerHTeam}>{p1.info?.currentTeam?.name ?? ''}</div>
                  <div style={s.playerHPos}>{p1.info?.primaryPosition?.name ?? ''} · {SEASON}</div>
                  {p1.savant?.season && <div style={s.savantBadge}>✓ Savant Data Available</div>}
                </div>
              </div>

              {/* VS divider */}
              <div style={s.vsDivider}>VS</div>

              {/* Player 2 header */}
              <div style={{ ...s.playerHeader, borderColor: color2, justifyContent: 'flex-end' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ ...s.playerHName, color: color2 }}>{p2.info?.fullName ?? '—'}</div>
                  <div style={s.playerHTeam}>{p2.info?.currentTeam?.name ?? ''}</div>
                  <div style={s.playerHPos}>{p2.info?.primaryPosition?.name ?? ''} · {SEASON}</div>
                  {p2.savant?.season && <div style={{ ...s.savantBadge, textAlign: 'right' }}>✓ Savant Data Available</div>}
                </div>
                {id2 && <img src={`https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_120,q_auto:best/v1/people/${id2}/headshot/67/current`}
                  alt="" style={{ ...s.playerPhoto, borderColor: color2 }}
                  onError={e => e.target.style.display='none'} />}
              </div>
            </div>

            {/* Comparison table */}
            <div style={s.compareTable}>
              {/* Column headers */}
              <div style={s.colHeaders}>
                <div style={{ flex: 1, textAlign: 'right', fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.72rem', fontWeight:700, letterSpacing:'.12em', color: color1 }}>
                  {p1.info?.lastName ?? 'PLAYER 1'}
                </div>
                <div style={{ width: '120px', textAlign: 'center', fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.65rem', fontWeight:700, letterSpacing:'.2em', color:'#3a3f52' }}>
                  STAT
                </div>
                <div style={{ flex: 1, textAlign: 'left', fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.72rem', fontWeight:700, letterSpacing:'.12em', color: color2 }}>
                  {p2.info?.lastName ?? 'PLAYER 2'}
                </div>
              </div>

              {/* Stat rows */}
              {rows.map(([label, key, pctKey, low, fmt]) => {
                const v1 = d1 ? d1[key] : null;
                const v2 = d2 ? d2[key] : null;
                const p1v = (d1 && pctKey) ? d1[pctKey] : null;
                const p2v = (d2 && pctKey) ? d2[pctKey] : null;
                return (
                  <StatRow key={label} label={label}
                    val1={v1 != null ? fmt(v1) : null}
                    val2={v2 != null ? fmt(v2) : null}
                    pct1={typeof p1v === 'number' ? p1v : null}
                    pct2={typeof p2v === 'number' ? p2v : null}
                    lowerIsBetter={low} />
                );
              })}
            </div>

            {/* View full profiles */}
            <div style={s.profileLinks}>
              {id1 && <a href={`/players/${id1}`} style={{ ...s.profileLink, borderColor: color1, color: color1 }}>
                {p1.info?.fullName ?? 'Player 1'} Full Profile →
              </a>}
              {id2 && <a href={`/players/${id2}`} style={{ ...s.profileLink, borderColor: color2, color: color2 }}>
                {p2.info?.fullName ?? 'Player 2'} Full Profile →
              </a>}
            </div>
          </>
        )}
      </div>

      <footer style={s.footer}>
        Stats via <a href="https://statsapi.mlb.com" style={{ color: '#5c6070' }}>MLB Stats API</a> ·
        Savant percentiles via <a href="https://baseballsavant.mlb.com" style={{ color: '#5c6070' }}>Baseball Savant</a> ·
        Coach.com
      </footer>
    </>
  );
}

const s = {
  nav:          { position:'sticky',top:0,zIndex:200,background:'rgba(5,6,8,.93)',backdropFilter:'blur(16px)',borderBottom:'1px solid #1e2028',height:'54px',display:'flex',alignItems:'center',padding:'0 1.5rem',gap:'1rem' },
  logo:         { fontFamily:"'Bebas Neue',sans-serif",fontSize:'1.5rem',letterSpacing:'.08em',color:'#f0f2f8',textDecoration:'none',flexShrink:0 },
  navLinks:     { display:'flex',gap:'1.5rem',marginLeft:'auto' },
  navLink:      { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.82rem',fontWeight:700,letterSpacing:'.12em',textTransform:'uppercase',color:'#5c6070',textDecoration:'none' },
  header:       { background:'#0a0b0f',borderBottom:'1px solid #1e2028',padding:'1.5rem 1.5rem 1rem' },
  headerInner:  { maxWidth:'1200px',margin:'0 auto',marginBottom:'1rem' },
  pageLabel:    { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.72rem',fontWeight:700,letterSpacing:'.25em',color:'#00c2a8' },
  pageTitle:    { fontFamily:"'Bebas Neue',sans-serif",fontSize:'2.2rem',letterSpacing:'.05em',color:'#f0f2f8' },
  searchRow:    { maxWidth:'1200px',margin:'0 auto',display:'flex',gap:'1rem',alignItems:'flex-end',flexWrap:'wrap' },
  vsChip:       { fontFamily:"'Bebas Neue',sans-serif",fontSize:'1.4rem',letterSpacing:'.1em',color:'#3a3f52',padding:'.4rem 0',flexShrink:0 },
  searchLabel:  { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.68rem',fontWeight:700,letterSpacing:'.18em',marginBottom:'.35rem' },
  searchInput:  { width:'100%',padding:'.65rem .9rem',background:'rgba(255,255,255,.05)',border:'1px solid',borderRadius:'6px',color:'#f0f2f8',fontFamily:"'Barlow',sans-serif",fontSize:'.9rem',outline:'none' },
  searchDrop:   { position:'absolute',top:'calc(100% + 4px)',left:0,right:0,background:'#111318',border:'1px solid #1e2028',borderRadius:'8px',zIndex:100,maxHeight:'280px',overflowY:'auto' },
  searchItem:   { display:'flex',alignItems:'center',gap:'.65rem',padding:'.55rem .85rem',cursor:'pointer',transition:'background .15s' },
  searchAvatar: { width:'30px',height:'30px',borderRadius:'50%',objectFit:'cover',background:'#1e2028',flexShrink:0 },
  body:         { maxWidth:'1200px',margin:'0 auto',padding:'1.5rem' },
  loading:      { textAlign:'center',color:'#5c6070',padding:'3rem',fontSize:'.9rem' },
  emptyState:   { textAlign:'center',padding:'5rem 1rem' },
  emptyIcon:    { fontSize:'3rem',marginBottom:'1rem' },
  emptyTitle:   { fontFamily:"'Bebas Neue',sans-serif",fontSize:'1.6rem',letterSpacing:'.08em',color:'#f0f2f8',marginBottom:'.5rem' },
  emptyDesc:    { color:'#5c6070',fontSize:'.88rem',lineHeight:1.6 },
  playerHeaders:{ display:'flex',gap:'1rem',alignItems:'stretch',marginBottom:'1.5rem',flexWrap:'wrap' },
  playerHeader: { flex:1,minWidth:'200px',display:'flex',gap:'1rem',alignItems:'center',background:'#111318',border:'2px solid',borderRadius:'10px',padding:'1rem' },
  playerPhoto:  { width:'64px',height:'64px',borderRadius:'50%',objectFit:'cover',border:'2px solid',flexShrink:0 },
  playerHName:  { fontFamily:"'Bebas Neue',sans-serif",fontSize:'1.35rem',letterSpacing:'.05em',lineHeight:1 },
  playerHTeam:  { fontSize:'.78rem',color:'#b8bdd0',marginTop:'.15rem' },
  playerHPos:   { fontSize:'.7rem',color:'#5c6070' },
  savantBadge:  { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.62rem',fontWeight:700,letterSpacing:'.1em',color:'#00c2a8',marginTop:'.25rem' },
  vsDivider:    { fontFamily:"'Bebas Neue',sans-serif",fontSize:'1.8rem',letterSpacing:'.15em',color:'#1e2028',display:'flex',alignItems:'center',flexShrink:0 },
  compareTable: { background:'#111318',border:'1px solid #1e2028',borderRadius:'10px',overflow:'hidden' },
  colHeaders:   { display:'flex',padding:'.6rem 1rem',borderBottom:'1px solid #1e2028',background:'#0a0b0f' },
  statRow:      { display:'flex',alignItems:'center',borderBottom:'1px solid #0f1018',padding:'.5rem 1rem',gap:'1rem' },
  statCell:     { flex:1,display:'flex',flexDirection:'column',gap:'.2rem' },
  statVal:      { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'1.05rem',fontWeight:700 },
  rowLabel:     { width:'120px',flexShrink:0,textAlign:'center',fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.7rem',fontWeight:700,letterSpacing:'.12em',color:'#5c6070' },
  pctRow:       { display:'flex',alignItems:'center',gap:'.3rem',height:'4px',marginTop:'.1rem' },
  pctBar:       { height:'4px',borderRadius:'2px',transition:'width .3s',maxWidth:'80px',minWidth:'2px' },
  pctNum:       { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.62rem',fontWeight:700,whiteSpace:'nowrap' },
  profileLinks: { display:'flex',gap:'1rem',justifyContent:'center',marginTop:'1.5rem',flexWrap:'wrap' },
  profileLink:  { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.82rem',fontWeight:700,letterSpacing:'.1em',border:'1px solid',borderRadius:'6px',padding:'.5rem 1.25rem',textDecoration:'none',transition:'all .2s' },
  compareBtn:   { marginTop:'1rem', display:'block', width:'100%', maxWidth:'360px', padding:'.75rem 2rem', background:'linear-gradient(135deg,#00c2a8,#0097a7)', border:'none', borderRadius:'8px', fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.15rem', letterSpacing:'.15em', color:'#050608', transition:'all .2s' },
  footer:       { borderTop:'1px solid #1e2028',padding:'1.4rem',textAlign:'center',fontSize:'.74rem',color:'#5c6070' },
};