// pages/games/[gamePk].js
// Live Game Center — auto-refreshes every 10s when live

import { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

const TEAM_COLORS = {
  110:'#DF4601',111:'#BD3039',147:'#003087',139:'#8FBCE6',141:'#134A8E',
  145:'#C4CED4',114:'#E31937',116:'#FA4616',118:'#004687',142:'#D31145',
  117:'#EB6E1F',108:'#BA0021',133:'#EFB21E',136:'#005C5C',140:'#C0111F',
  144:'#CE1141',146:'#00A3E0',121:'#FF5910',143:'#E81828',120:'#AB0003',
  112:'#0E3386',113:'#C6011F',158:'#FFC52F',134:'#FDB827',138:'#C41E3A',
  109:'#A71930',115:'#8B74C4',119:'#005A9C',135:'#FFC425',137:'#FD5A1E',
};

// Stadium images by home team ID — using ESPN CDN which is publicly accessible
// Falls back to a team-color gradient if image fails
const STADIUM_BY_TEAM = {
  110: 'https://a.espncdn.com/i/venues/mlb/day/1.jpg',  // Orioles - Camden Yards
  111: 'https://a.espncdn.com/i/venues/mlb/day/2.jpg',  // Red Sox - Fenway
  147: 'https://a.espncdn.com/i/venues/mlb/day/3.jpg',  // Yankees - Yankee Stadium
  139: 'https://a.espncdn.com/i/venues/mlb/day/4.jpg',  // Rays - Tropicana
  141: 'https://a.espncdn.com/i/venues/mlb/day/5.jpg',  // Blue Jays - Rogers
  145: 'https://a.espncdn.com/i/venues/mlb/day/6.jpg',  // White Sox
  114: 'https://a.espncdn.com/i/venues/mlb/day/7.jpg',  // Guardians
  116: 'https://a.espncdn.com/i/venues/mlb/day/8.jpg',  // Tigers - Comerica
  118: 'https://a.espncdn.com/i/venues/mlb/day/9.jpg',  // Royals - Kauffman
  142: 'https://a.espncdn.com/i/venues/mlb/day/10.jpg', // Twins - Target Field
  117: 'https://a.espncdn.com/i/venues/mlb/day/11.jpg', // Astros - Minute Maid
  108: 'https://a.espncdn.com/i/venues/mlb/day/12.jpg', // Angels
  133: 'https://a.espncdn.com/i/venues/mlb/day/13.jpg', // Athletics
  136: 'https://a.espncdn.com/i/venues/mlb/day/14.jpg', // Mariners - T-Mobile
  140: 'https://a.espncdn.com/i/venues/mlb/day/15.jpg', // Rangers - Globe Life
  144: 'https://a.espncdn.com/i/venues/mlb/day/16.jpg', // Braves - Truist
  146: 'https://a.espncdn.com/i/venues/mlb/day/17.jpg', // Marlins - loanDepot
  121: 'https://a.espncdn.com/i/venues/mlb/day/18.jpg', // Mets - Citi Field
  143: 'https://a.espncdn.com/i/venues/mlb/day/19.jpg', // Phillies - Citizens Bank
  120: 'https://a.espncdn.com/i/venues/mlb/day/20.jpg', // Nationals Park
  112: 'https://a.espncdn.com/i/venues/mlb/day/21.jpg', // Cubs - Wrigley
  113: 'https://a.espncdn.com/i/venues/mlb/day/22.jpg', // Reds - GABP
  158: 'https://a.espncdn.com/i/venues/mlb/day/23.jpg', // Brewers
  134: 'https://a.espncdn.com/i/venues/mlb/day/24.jpg', // Pirates - PNC
  138: 'https://a.espncdn.com/i/venues/mlb/day/25.jpg', // Cardinals - Busch
  109: 'https://a.espncdn.com/i/venues/mlb/day/26.jpg', // D-backs - Chase Field
  115: 'https://a.espncdn.com/i/venues/mlb/day/27.jpg', // Rockies - Coors Field
  119: 'https://a.espncdn.com/i/venues/mlb/day/28.jpg', // Dodgers - Dodger Stadium
  135: 'https://a.espncdn.com/i/venues/mlb/day/29.jpg', // Padres - Petco
  137: 'https://a.espncdn.com/i/venues/mlb/day/30.jpg', // Giants - Oracle Park
};

function getStadiumBg(homeTeamId) {
  return STADIUM_BY_TEAM[homeTeamId] ?? null;
}

const PITCH_COLORS = {
  S: '#e63535', // Strike (called)
  C: '#e63535', // Strike (called)
  F: '#f5a623', // Foul
  T: '#f5a623', // Foul tip
  K: '#e63535', // Strikeout
  B: '#2ed47a', // Ball
  X: '#00c2a8', // In play
  L: '#f5a623', // Foul bunt
  O: '#e63535', // Foul bunt strike
};

function tc(name) {
  const map = {
    'Yankees':'#003087','Red Sox':'#BD3039','Mets':'#FF5910','Dodgers':'#005A9C',
    'Cubs':'#0E3386','Cardinals':'#C41E3A','Braves':'#CE1141','Giants':'#FD5A1E',
    'Astros':'#EB6E1F','Phillies':'#E81828','Padres':'#FFC425','Mariners':'#005C5C',
  };
  for (const [k,v] of Object.entries(map)) if (name?.includes(k)) return v;
  return '#00c2a8';
}

// ── Strike Zone SVG component
function StrikeZone({ pitches, szTop = 3.5, szBot = 1.5 }) {
  // Map pitch coordinates to SVG space
  // pX: -2 to +2 feet, pZ: 0 to 5 feet
  const W = 200, H = 220;
  const mapX = (pX) => W/2 + (pX / 2.5) * (W * 0.45);
  const mapZ = (pZ) => H - (pZ / 5.0) * H * 0.85 - 10;

  // Zone corners in SVG space
  const zL = mapX(-0.83), zR = mapX(0.83);
  const zT = mapZ(szTop), zB = mapZ(szBot);

  return (
    <svg width={W} height={H} style={{ display:'block', margin:'0 auto' }}>
      {/* Plate */}
      <polygon points={`${W/2-15},${H-8} ${W/2+15},${H-8} ${W/2+18},${H-2} ${W/2},${H} ${W/2-18},${H-2}`}
        fill="#e8e8e8" opacity="0.3" />
      {/* Strike zone box */}
      <rect x={zL} y={zT} width={zR-zL} height={zB-zT}
        fill="none" stroke="#2a2f3f" strokeWidth="1.5" strokeDasharray="4,3"/>
      {/* Zone thirds (horizontal) */}
      {[1/3, 2/3].map((f,i) => (
        <line key={i} x1={zL} x2={zR}
          y1={zT + (zB-zT)*f} y2={zT + (zB-zT)*f}
          stroke="#1e2028" strokeWidth="1"/>
      ))}
      {/* Zone thirds (vertical) */}
      {[1/3, 2/3].map((f,i) => (
        <line key={i} x1={zL + (zR-zL)*f} x2={zL + (zR-zL)*f}
          y1={zT} y2={zB}
          stroke="#1e2028" strokeWidth="1"/>
      ))}
      {/* Pitches */}
      {pitches.map((p, i) => {
        if (p.pX === null || p.pZ === null) return null;
        const cx = mapX(p.pX);
        const cy = mapZ(p.pZ);
        const col = PITCH_COLORS[p.typeCode] ?? (p.isInPlay ? '#00c2a8' : p.isStrike ? '#e63535' : '#2ed47a');
        const isLast = i === pitches.length - 1;
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r={isLast ? 9 : 7}
              fill={col} fillOpacity={isLast ? 0.9 : 0.55}
              stroke={isLast ? '#f0f2f8' : col} strokeWidth={isLast ? 1.5 : 0}/>
            <text x={cx} y={cy+4} textAnchor="middle"
              style={{ fontSize:'7px', fill:'#f0f2f8', fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700 }}>
              {p.num}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Bases diamond component
function Bases({ first, second, third }) {
  const ON = '#f5a623', OFF = '#1e2028', STROKE = '#2a2f3f';
  return (
    <svg width="80" height="80" viewBox="0 0 80 80">
      {/* Second base (top) */}
      <rect x="31" y="4" width="18" height="18" rx="2"
        transform="rotate(45 40 13)" fill={second ? ON : OFF} stroke={STROKE} strokeWidth="1.5"/>
      {/* Third base (left) */}
      <rect x="4" y="31" width="18" height="18" rx="2"
        transform="rotate(45 13 40)" fill={third ? ON : OFF} stroke={STROKE} strokeWidth="1.5"/>
      {/* First base (right) */}
      <rect x="58" y="31" width="18" height="18" rx="2"
        transform="rotate(45 67 40)" fill={first ? ON : OFF} stroke={STROKE} strokeWidth="1.5"/>
      {/* Home plate (bottom) */}
      <polygon points="40,72 32,64 32,56 48,56 48,64"
        fill={OFF} stroke={STROKE} strokeWidth="1.5"/>
    </svg>
  );
}

// ── Win probability bar
function WinProbBar({ homeWinPct, awayAbbr, homeAbbr, awayColor, homeColor }) {
  const awayPct = 100 - homeWinPct;
  return (
    <div style={{ padding:'1rem 1.5rem', borderBottom:'1px solid #1e2028' }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'.4rem' }}>
        <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.75rem', fontWeight:700, color: awayColor }}>
          {awayAbbr} {awayPct}%
        </span>
        <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.62rem', fontWeight:700, letterSpacing:'.15em', color:'#3a3f52' }}>
          WIN PROBABILITY
        </span>
        <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.75rem', fontWeight:700, color: homeColor }}>
          {homeWinPct}% {homeAbbr}
        </span>
      </div>
      <div style={{ height:'8px', borderRadius:'4px', overflow:'hidden', display:'flex' }}>
        <div style={{ width:`${awayPct}%`, background: awayColor, transition:'width .5s' }}/>
        <div style={{ width:`${homeWinPct}%`, background: homeColor, transition:'width .5s' }}/>
      </div>
    </div>
  );
}

export default function GamePage() {
  const router  = useRouter();
  const { gamePk } = router.query;

  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState('live');
  const [bsTab, setBsTab]     = useState('away'); // box score team side
  const [lastUpdate, setLastUpdate] = useState(null);
  const intervalRef = useRef(null);

  const fetchGame = useCallback(() => {
    if (!gamePk) return;
    fetch(`/api/game?gamePk=${gamePk}`)
      .then(r => r.json())
      .then(d => {
        setData(d);
        setLoading(false);
        setLastUpdate(new Date());
      })
      .catch(() => setLoading(false));
  }, [gamePk]);

  useEffect(() => {
    if (!router.isReady || !gamePk) return;
    fetchGame();
  }, [router.isReady, gamePk, fetchGame]);

  // Auto-refresh every 10s when live
  useEffect(() => {
    if (!data) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (data.gameInfo?.isLive) {
      intervalRef.current = setInterval(fetchGame, 10000);
    }
    return () => clearInterval(intervalRef.current);
  }, [data?.gameInfo?.isLive, fetchGame]);

  if (loading) return (
    <div style={{ background:'#050608', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:'#5c6070', fontFamily:"'Barlow',sans-serif" }}>
      Loading game data…
    </div>
  );

  if (data?.error || !data?.gameInfo) return (
    <div style={{ background:'#050608', minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'#5c6070', fontFamily:"'Barlow',sans-serif", gap:'1rem' }}>
      <div>Game not found.</div>
      <a href="/scoreboard" style={{ color:'#00c2a8', fontSize:'.85rem' }}>← Back to Scoreboard</a>
    </div>
  );

  const { gameInfo, linescore, bases, currentAtBat, allPlays, scoringPlays, boxScore, homeWinPct } = data;
  const homeColor = TEAM_COLORS[gameInfo.home.id] ?? '#00c2a8';
  const awayColor = TEAM_COLORS[gameInfo.away.id] ?? '#f5a623';
  const homeLead  = linescore.homeRuns > linescore.awayRuns;
  const awayLead  = linescore.awayRuns > linescore.homeRuns;

  const gameTime = gameInfo.gameDate
    ? new Date(gameInfo.gameDate).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', timeZoneName:'short' })
    : '';

  const inningLabel = linescore.currentInning
    ? `${linescore.inningHalf === 'Bottom' ? '▼' : '▲'} ${linescore.currentInning}`
    : '';

  const tabs = [
    { id:'live',    label:'⚡ Live'       },
    { id:'plays',   label:'📋 Play-by-Play'},
    { id:'boxscore',label:'📊 Box Score'  },
  ];

  return (
    <>
      <Head>
        <title>{gameInfo.away.abbr} @ {gameInfo.home.abbr} — Coach</title>
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@300;400;500;600&family=Barlow+Condensed:wght@400;600;700;900&display=swap" rel="stylesheet"/>
        <style>{`
          *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
          body{background:#03080f;color:#c8cde0;font-family:'Barlow',sans-serif;-webkit-font-smoothing:antialiased}
          table{border-collapse:collapse;width:100%}
          .play-row:hover{background:rgba(255,255,255,.025)!important}
          @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
          @keyframes spin{to{transform:rotate(360deg)}}
        `}</style>
      </Head>

      {/* NAV */}
      <nav style={s.nav}>
        <a href="/" style={s.logo}>COACH<span style={{ color:'#00c2a8' }}>.</span></a>
        <div style={s.navLinks}>
          <a href="/" style={s.navLink}>Home</a>
          <a href="/scoreboard" style={{ ...s.navLink, color:'#00c2a8' }}>Scoreboard</a>
          <a href="/teams" style={s.navLink}>Teams</a>
          <a href="/transactions" style={s.navLink}>Transactions</a>
          <a href="/compare" style={s.navLink}>Compare</a>
        </div>
      </nav>

      {/* SCORE HEADER — stadium backdrop */}
      <div style={{ ...s.header, position: 'relative', overflow: 'hidden' }}>
        {/* Stadium photo layer */}
        <div style={{ position:'absolute', inset:0, zIndex:0 }}>
          <img
            src={getStadiumBg(gameInfo.home.id)}
            alt=""
            style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center 35%', display:'block' }}
            onError={e => { e.target.style.display = 'none'; }}
          />
          <div style={{ position:'absolute', inset:0,
            background:`linear-gradient(to bottom, rgba(3,8,15,.35) 0%, rgba(3,8,15,.70) 50%, #03080f 100%), linear-gradient(135deg, ${homeColor}22 0%, transparent 60%, ${awayColor}11 100%)` }} />
        </div>

        {/* Content above backdrop */}
        <div style={{ position:'relative', zIndex:1, maxWidth:'960px', margin:'0 auto', padding:'0 1.5rem' }}>
          <div style={s.breadcrumb}>
            <a href="/scoreboard" style={{ color:'#5c6070', textDecoration:'none' }}>Scoreboard</a>
            <span style={{ color:'#3a3f52' }}> / </span>
            <span style={{ color:'#5c6070' }}>{gameInfo.away.abbr} @ {gameInfo.home.abbr}</span>
          </div>

          {/* Status badge */}
          <div style={{ display:'flex', alignItems:'center', gap:'.75rem', marginBottom:'1.25rem', flexWrap:'wrap' }}>
            {gameInfo.isLive && (
              <div style={s.liveBadge}>
                <span style={{ width:'7px', height:'7px', borderRadius:'50%', background:'#2ed47a', animation:'pulse 1.5s infinite', display:'inline-block' }}/>
                LIVE
              </div>
            )}
            {gameInfo.isFinal && <div style={s.finalBadge}>FINAL</div>}
            {gameInfo.isPreview && <div style={s.previewBadge}>{gameTime}</div>}
            {gameInfo.isLive && inningLabel && (
              <div style={s.inningBadge}>{inningLabel}</div>
            )}
            <div style={s.venueBadge}>{gameInfo.venue}</div>
            {lastUpdate && gameInfo.isLive && (
              <div style={{ fontSize:'.65rem', color:'#3a3f52', marginLeft:'auto' }}>
                Updated {lastUpdate.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',second:'2-digit'})}
              </div>
            )}
          </div>

          {/* Scoreboard row */}
          <div style={s.scoreRow}>
            {/* Away team */}
            <div style={s.teamBlock}>
              <img src={`https://www.mlbstatic.com/team-logos/${gameInfo.away.id}.svg`}
                alt={gameInfo.away.abbr} style={s.scoreLogo}
                onError={e => e.target.style.display='none'}/>
              <div>
                <div style={{ ...s.scoreTeamName, color: awayColor }}>{gameInfo.away.name}</div>
                <div style={s.scoreRecord}>{gameInfo.away.record}</div>
              </div>
              <div style={{ ...s.bigScore, color: awayLead ? '#f0f2f8' : '#5c6070', opacity: awayLead ? 1 : 0.6 }}>
                {linescore.awayRuns}
              </div>
            </div>

            {/* Middle */}
            <div style={s.scoreDivider}>
              <div style={s.scoreDash}>—</div>
              {gameInfo.isLive && (
                <div style={s.countDisplay}>
                  <span style={{ color:'#2ed47a' }}>{linescore.balls}</span>
                  <span style={{ color:'#3a3f52' }}>-</span>
                  <span style={{ color:'#e63535' }}>{linescore.strikes}</span>
                  <span style={{ color:'#3a3f52' }}> · </span>
                  <span style={{ color:'#f5a623' }}>{linescore.outs} out{linescore.outs !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>

            {/* Home team */}
            <div style={{ ...s.teamBlock, flexDirection:'row-reverse', textAlign:'right' }}>
              <img src={`https://www.mlbstatic.com/team-logos/${gameInfo.home.id}.svg`}
                alt={gameInfo.home.abbr} style={s.scoreLogo}
                onError={e => e.target.style.display='none'}/>
              <div>
                <div style={{ ...s.scoreTeamName, color: homeColor }}>{gameInfo.home.name}</div>
                <div style={s.scoreRecord}>{gameInfo.home.record}</div>
              </div>
              <div style={{ ...s.bigScore, color: homeLead ? '#f0f2f8' : '#5c6070', opacity: homeLead ? 1 : 0.6 }}>
                {linescore.homeRuns}
              </div>
            </div>
          </div>

          {/* Win probability */}
          {(gameInfo.isLive || gameInfo.isFinal) && (
            <div style={{ marginTop:'1rem' }}>
              <WinProbBar homeWinPct={homeWinPct} awayPct={100-homeWinPct}
                awayAbbr={gameInfo.away.abbr} homeAbbr={gameInfo.home.abbr}
                awayColor={awayColor} homeColor={homeColor}/>
            </div>
          )}

          {/* Inning-by-inning linescore */}
          {linescore.innings.length > 0 && (
            <div style={s.linescoreWrap}>
              <div style={{ overflowX:'auto' }}>
                <table style={{ minWidth:'400px', fontSize:'.75rem' }}>
                  <thead>
                    <tr>
                      <th style={s.lsTh}>TEAM</th>
                      {linescore.innings.map(inn => (
                        <th key={inn.num} style={{ ...s.lsTh,
                          color: inn.num === linescore.currentInning ? '#00c2a8' : '#3a3f52' }}>
                          {inn.num}
                        </th>
                      ))}
                      <th style={{ ...s.lsTh, borderLeft:'1px solid #1e2028' }}>R</th>
                      <th style={s.lsTh}>H</th>
                      <th style={s.lsTh}>E</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[['away', awayColor, gameInfo.away.abbr], ['home', homeColor, gameInfo.home.abbr]].map(([side, col, abbr]) => (
                      <tr key={side}>
                        <td style={{ ...s.lsTd, color: col, fontWeight:700 }}>{abbr}</td>
                        {linescore.innings.map(inn => (
                          <td key={inn.num} style={s.lsTd}>
                            {side === 'away' ? inn.away : inn.home}
                          </td>
                        ))}
                        <td style={{ ...s.lsTd, borderLeft:'1px solid #1e2028', fontWeight:700 }}>
                          {side === 'away' ? linescore.awayRuns : linescore.homeRuns}
                        </td>
                        <td style={s.lsTd}>{side === 'away' ? linescore.awayHits : linescore.homeHits}</td>
                        <td style={s.lsTd}>{side === 'away' ? linescore.awayErrors : linescore.homeErrors}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>{/* end content zIndex wrapper */}
      </div>{/* end header */}

      {/* TAB BAR */}
      <div style={s.tabBar}>
        <div style={s.tabInner}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ ...s.tabBtn, ...(tab === t.id ? { color:'#00c2a8', borderBottomColor:'#00c2a8' } : {}) }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* BODY */}
      <div style={s.body}>

        {/* ── LIVE TAB ── */}
        {tab === 'live' && (
          <div style={s.liveGrid}>

            {/* Left: Current at-bat + pitch zone */}
            <div>
              {gameInfo.isPreview && (
                <div style={s.previewCard}>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.4rem', color:'#f0f2f8', marginBottom:'.5rem' }}>
                    GAME PREVIEW
                  </div>
                  <div style={{ fontSize:'.86rem', color:'#5c6070' }}>
                    First pitch: {gameTime}
                  </div>
                  <div style={{ fontSize:'.82rem', color:'#5c6070', marginTop:'.35rem' }}>
                    {gameInfo.venue}
                  </div>
                </div>
              )}

              {gameInfo.isFinal && !currentAtBat && (
                <div style={s.previewCard}>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.4rem', color:'#f0f2f8' }}>FINAL</div>
                  <div style={{ fontSize:'.88rem', color:'#5c6070', marginTop:'.35rem' }}>
                    {gameInfo.away.name} {linescore.awayRuns} · {gameInfo.home.name} {linescore.homeRuns}
                  </div>
                </div>
              )}

              {currentAtBat && (
                <div style={s.atBatCard}>
                  {/* Batter vs Pitcher */}
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem', flexWrap:'wrap', gap:'.5rem' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'.6rem' }}>
                      <img src={`https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_60,q_auto:best/v1/people/${currentAtBat.batterId}/headshot/67/current`}
                        alt="" style={s.atBatAvatar} onError={e => e.target.style.display='none'}/>
                      <div>
                        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.65rem', fontWeight:700, letterSpacing:'.15em', color:'#3a3f52' }}>AT BAT</div>
                        <div style={{ fontWeight:700, color:'#f0f2f8', fontSize:'.95rem' }}>{currentAtBat.batter}</div>
                        <div style={{ fontSize:'.72rem', color:'#5c6070' }}>Bats {currentAtBat.batSide === 'R' ? 'Right' : currentAtBat.batSide === 'L' ? 'Left' : 'Switch'}</div>
                      </div>
                    </div>
                    <div style={{ color:'#3a3f52', fontSize:'1.2rem' }}>vs</div>
                    <div style={{ display:'flex', alignItems:'center', gap:'.6rem', flexDirection:'row-reverse' }}>
                      <img src={`https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_60,q_auto:best/v1/people/${currentAtBat.pitcherId}/headshot/67/current`}
                        alt="" style={s.atBatAvatar} onError={e => e.target.style.display='none'}/>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.65rem', fontWeight:700, letterSpacing:'.15em', color:'#3a3f52' }}>PITCHING</div>
                        <div style={{ fontWeight:700, color:'#f0f2f8', fontSize:'.95rem' }}>{currentAtBat.pitcher}</div>
                        <div style={{ fontSize:'.72rem', color:'#5c6070' }}>Throws {currentAtBat.pitchHand === 'R' ? 'Right' : 'Left'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Count */}
                  <div style={s.countRow}>
                    {['Balls','Strikes','Outs'].map((lbl, li) => {
                      const val  = [currentAtBat.count.balls, currentAtBat.count.strikes, currentAtBat.count.outs][li];
                      const max  = [4, 3, 3][li];
                      const col  = ['#2ed47a','#e63535','#f5a623'][li];
                      return (
                        <div key={lbl} style={{ textAlign:'center' }}>
                          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.65rem', fontWeight:700, letterSpacing:'.12em', color:'#3a3f52', marginBottom:'.3rem' }}>{lbl.toUpperCase()}</div>
                          <div style={{ display:'flex', gap:'4px', justifyContent:'center' }}>
                            {Array.from({length: max}).map((_,i) => (
                              <div key={i} style={{ width:'12px', height:'12px', borderRadius:'50%',
                                background: i < val ? col : '#1e2028',
                                border:`1px solid ${i < val ? col : '#2a2f3f'}` }}/>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pitch zone + Bases side by side */}
                  <div style={{ display:'flex', gap:'1.5rem', alignItems:'center', justifyContent:'center', marginTop:'1rem', flexWrap:'wrap' }}>
                    <div>
                      <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.65rem', fontWeight:700, letterSpacing:'.15em', color:'#3a3f52', textAlign:'center', marginBottom:'.4rem' }}>STRIKE ZONE</div>
                      <StrikeZone pitches={currentAtBat.pitches}
                        szTop={currentAtBat.pitches[0]?.szTop}
                        szBot={currentAtBat.pitches[0]?.szBot}/>
                      {/* Pitch legend */}
                      <div style={{ display:'flex', gap:'.5rem', justifyContent:'center', marginTop:'.5rem', flexWrap:'wrap' }}>
                        {[['Ball','#2ed47a'],['Strike','#e63535'],['Foul','#f5a623'],['In Play','#00c2a8']].map(([lbl,col]) => (
                          <div key={lbl} style={{ display:'flex', alignItems:'center', gap:'.25rem' }}>
                            <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:col }}/>
                            <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.62rem', color:'#5c6070' }}>{lbl}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Bases */}
                    <div style={{ textAlign:'center' }}>
                      <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.65rem', fontWeight:700, letterSpacing:'.15em', color:'#3a3f52', marginBottom:'.4rem' }}>BASES</div>
                      <Bases first={bases.first} second={bases.second} third={bases.third}/>
                      {bases.batter && (
                        <div style={{ fontSize:'.72rem', color:'#5c6070', marginTop:'.35rem' }}>🏏 {bases.batter}</div>
                      )}
                    </div>
                  </div>

                  {/* Pitch sequence + live Statcast */}
                  {currentAtBat.pitches.length > 0 && (
                    <div style={{ marginTop:'1rem', borderTop:'1px solid #1e2028', paddingTop:'1rem' }}>
                      <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.65rem', fontWeight:700, letterSpacing:'.15em', color:'#3a3f52', marginBottom:'.5rem' }}>PITCH SEQUENCE</div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:'.4rem' }}>
                        {currentAtBat.pitches.map((p,i) => {
                          const col = PITCH_COLORS[p.typeCode] ?? '#5c6070';
                          const isLast = i === currentAtBat.pitches.length - 1;
                          return (
                            <div key={i} style={{ background: isLast ? col+'18' : '#0a0b0f', border:`1px solid ${col}${isLast?'99':'44'}`, borderRadius:'6px', padding:'.4rem .7rem', minWidth:'68px', transition:'all .2s' }}>
                              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.72rem', fontWeight:700, color: col }}>{p.type}</div>
                              {p.speed && <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1rem', color:'#f0f2f8', lineHeight:1 }}>{p.speed.toFixed(1)}<span style={{fontSize:'.55rem',color:'#5c6070'}}> mph</span></div>}
                              {p.spinRate && <div style={{ fontSize:'.58rem', color:'#5c6070' }}>{Math.round(p.spinRate)} rpm</div>}
                            </div>
                          );
                        })}
                      </div>

                      {/* Live Statcast panel — shows on ball in play */}
                      {currentAtBat.pitches.some(p => p.exitVelo || p.launchAngle) && (
                        <div style={{ marginTop:'.85rem', background:'linear-gradient(135deg,#0a0f1a,#111318)', border:'1px solid #00c2a844', borderRadius:'8px', padding:'.85rem 1rem' }}>
                          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.65rem', fontWeight:700, letterSpacing:'.2em', color:'#00c2a8', marginBottom:'.6rem' }}>
                            ⚡ LIVE STATCAST
                          </div>
                          <div style={{ display:'flex', gap:'1.5rem', flexWrap:'wrap' }}>
                            {currentAtBat.pitches.filter(p => p.exitVelo).slice(-1).map((p,i) => (
                              <div key={i} style={{ display:'flex', gap:'1.5rem', flexWrap:'wrap', width:'100%' }}>
                                {p.exitVelo && (
                                  <div style={{ textAlign:'center' }}>
                                    <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.6rem', fontWeight:700, letterSpacing:'.15em', color:'#3a3f52', marginBottom:'.2rem' }}>EXIT VELO</div>
                                    <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.8rem', color: p.exitVelo >= 100 ? '#00c2a8' : p.exitVelo >= 95 ? '#2ed47a' : '#f0f2f8', lineHeight:1 }}>
                                      {p.exitVelo.toFixed(1)}<span style={{ fontSize:'.75rem', color:'#5c6070' }}> mph</span>
                                    </div>
                                  </div>
                                )}
                                {p.launchAngle !== null && p.launchAngle !== undefined && (
                                  <div style={{ textAlign:'center' }}>
                                    <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.6rem', fontWeight:700, letterSpacing:'.15em', color:'#3a3f52', marginBottom:'.2rem' }}>LAUNCH ANGLE</div>
                                    <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.8rem', color: p.launchAngle >= 10 && p.launchAngle <= 30 ? '#2ed47a' : '#f0f2f8', lineHeight:1 }}>
                                      {p.launchAngle > 0 ? '+' : ''}{p.launchAngle.toFixed(1)}<span style={{ fontSize:'.75rem', color:'#5c6070' }}>°</span>
                                    </div>
                                  </div>
                                )}
                                {p.exitVelo && p.launchAngle !== null && (
                                  <div style={{ textAlign:'center' }}>
                                    <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.6rem', fontWeight:700, letterSpacing:'.15em', color:'#3a3f52', marginBottom:'.2rem' }}>BATTED BALL</div>
                                    <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.88rem', fontWeight:700, color:'#f5a623', lineHeight:1.2 }}>
                                      {p.launchAngle < -10 ? 'Ground Ball' : p.launchAngle < 10 ? 'Line Drive' : p.launchAngle < 25 ? 'Line Drive' : p.launchAngle < 50 ? 'Fly Ball' : 'Pop Up'}
                                    </div>
                                    {p.exitVelo >= 95 && p.launchAngle >= 8 && p.launchAngle <= 32 && (
                                      <div style={{ fontSize:'.65rem', color:'#00c2a8', marginTop:'.15rem' }}>💥 Barrel!</div>
                                    )}
                                  </div>
                                )}
                                {p.description && (
                                  <div style={{ width:'100%', fontSize:'.78rem', color:'#b8bdd0', fontStyle:'italic', marginTop:'.25rem', paddingTop:'.5rem', borderTop:'1px solid #1e2028' }}>
                                    {p.description}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {currentAtBat.description && !currentAtBat.pitches.some(p => p.exitVelo) && (
                    <div style={{ marginTop:'.75rem', fontSize:'.82rem', color:'#b8bdd0', fontStyle:'italic', borderTop:'1px solid #1e2028', paddingTop:'.75rem' }}>
                      {currentAtBat.description}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right: Scoring plays */}
            <div>
              <div style={s.secLabel}>🏃 SCORING PLAYS</div>
              {scoringPlays.length === 0 ? (
                <div style={{ color:'#3a3f52', fontSize:'.85rem', padding:'1rem 0' }}>No scoring plays yet.</div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'.5rem' }}>
                  {scoringPlays.map((p,i) => (
                    <div key={i} style={s.scoringPlay}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'.25rem' }}>
                        <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.68rem', fontWeight:700, color:'#3a3f52', letterSpacing:'.1em' }}>
                          {p.halfInning?.toUpperCase()} {p.inning}
                        </span>
                        <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'.9rem', color:'#f0f2f8' }}>
                          {gameInfo.away.abbr} {p.awayScore} · {gameInfo.home.abbr} {p.homeScore}
                        </span>
                      </div>
                      <div style={{ fontSize:'.82rem', color:'#b8bdd0', lineHeight:1.5 }}>{p.description}</div>
                      {p.rbi > 0 && <div style={{ fontSize:'.7rem', color:'#00c2a8', marginTop:'.15rem' }}>{p.rbi} RBI</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── PLAY-BY-PLAY TAB ── */}
        {tab === 'plays' && (
          <div>
            <div style={s.secLabel}>PLAY-BY-PLAY</div>
            {allPlays.length === 0 ? (
              <div style={{ color:'#3a3f52', padding:'2rem', textAlign:'center' }}>No plays yet.</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'2px' }}>
                {allPlays.map((p,i) => {
                  const eventColor =
                    p.isHR          ? '#f5a623' :
                    p.isHit         ? '#2ed47a' :
                    p.isWalk        ? '#00c2a8' :
                    p.isStrikeout   ? '#e63535' :
                    p.isOut         ? '#5c6070' : '#b8bdd0';
                  return (
                    <div key={i} className="play-row" style={s.playRow}>
                      <div style={{ ...s.playInning, color: p.halfInning === 'top' ? awayColor : homeColor }}>
                        {p.halfInning === 'top' ? '▲' : '▼'}{p.inning}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:'.82rem', color:'#b8bdd0', lineHeight:1.5 }}>{p.description}</div>
                        <div style={{ display:'flex', gap:'.5rem', marginTop:'.15rem', flexWrap:'wrap' }}>
                          {p.batter && <span style={{ fontSize:'.7rem', color:'#5c6070' }}>🏏 {p.batter}</span>}
                          {p.pitcher && <span style={{ fontSize:'.7rem', color:'#5c6070' }}>⚾ {p.pitcher}</span>}
                        </div>
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'.2rem', flexShrink:0 }}>
                        {p.event && (
                          <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.68rem', fontWeight:700,
                            letterSpacing:'.06em', color: eventColor }}>
                            {p.isHR ? '💥 ' : ''}{p.event}
                          </span>
                        )}
                        <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'.85rem', color:'#3a3f52' }}>
                          {p.awayScore}-{p.homeScore}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── BOX SCORE TAB ── */}
        {tab === 'boxscore' && (
          <div>
            {/* Team toggle */}
            <div style={{ display:'flex', gap:'.5rem', marginBottom:'1.25rem' }}>
              {[['away', gameInfo.away.name, awayColor], ['home', gameInfo.home.name, homeColor]].map(([side, name, col]) => (
                <button key={side} onClick={() => setBsTab(side)}
                  style={{ ...s.subBtn, ...(bsTab === side ? { borderColor: col, color: col, background:`${col}10` } : {}) }}>
                  <img src={`https://www.mlbstatic.com/team-logos/${gameInfo[side].id}.svg`}
                    alt="" style={{ width:'16px', height:'16px', marginRight:'.4rem', verticalAlign:'middle' }}
                    onError={e=>e.target.style.display='none'}/>
                  {name}
                </button>
              ))}
            </div>

            {/* Batting */}
            <div style={s.secLabel}>BATTING</div>
            <div style={s.tableWrap}>
              <table>
                <thead>
                  <tr style={{ borderBottom:'1px solid #1e2028' }}>
                    <th style={{ ...s.bsTh, textAlign:'left', width:'40%' }}>PLAYER</th>
                    {['AB','R','H','RBI','BB','K','AVG'].map(h => (
                      <th key={h} style={s.bsTh}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(boxScore[bsTab]?.batters ?? []).map((p,i) => (
                    <tr key={i} style={{ borderBottom:'1px solid #0f1018', background: p.note ? 'rgba(0,194,168,.04)' : 'transparent' }}>
                      <td style={{ ...s.bsTd, textAlign:'left' }}>
                        <span style={{ color: (TEAM_COLORS[gameInfo[bsTab].id] ?? '#00c2a8'), fontSize:'.65rem', marginRight:'.35rem' }}>
                          {p.pos}
                        </span>
                        <a href={`/players/${p.id}`} style={{ color: p.note ? '#00c2a8' : '#f0f2f8', textDecoration:'none', fontSize:'.84rem', fontWeight: p.note ? 700 : 400 }}>
                          {p.note}{p.name}
                        </a>
                      </td>
                      <td style={s.bsTd}>{p.ab}</td>
                      <td style={s.bsTd}>{p.r}</td>
                      <td style={{ ...s.bsTd, color: p.h > 0 ? '#2ed47a' : '#b8bdd0', fontWeight: p.h > 0 ? 700 : 400 }}>{p.h}</td>
                      <td style={{ ...s.bsTd, color: p.rbi > 0 ? '#f5a623' : '#b8bdd0' }}>{p.rbi}</td>
                      <td style={s.bsTd}>{p.bb}</td>
                      <td style={{ ...s.bsTd, color: p.k > 0 ? '#e63535' : '#b8bdd0' }}>{p.k}</td>
                      <td style={s.bsTd}>{p.avg}</td>
                    </tr>
                  ))}
                  {/* Team totals */}
                  <tr style={{ borderTop:'1px solid #1e2028', background:'#080c12' }}>
                    <td style={{ ...s.bsTd, textAlign:'left', fontWeight:700, color:'#f0f2f8' }}>TOTALS</td>
                    {['atBats','runs','hits','rbi','baseOnBalls','strikeOuts'].map(k => (
                      <td key={k} style={{ ...s.bsTd, fontWeight:700, color:'#f0f2f8' }}>
                        {boxScore[bsTab]?.info?.[k] ?? 0}
                      </td>
                    ))}
                    <td style={s.bsTd}>{boxScore[bsTab]?.info?.avg ?? '—'}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Pitching */}
            <div style={{ ...s.secLabel, marginTop:'1.5rem' }}>PITCHING</div>
            <div style={s.tableWrap}>
              <table>
                <thead>
                  <tr style={{ borderBottom:'1px solid #1e2028' }}>
                    <th style={{ ...s.bsTh, textAlign:'left', width:'35%' }}>PITCHER</th>
                    {['IP','H','R','ER','BB','K','HR','PC','ERA'].map(h => (
                      <th key={h} style={s.bsTh}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(boxScore[bsTab]?.pitchers ?? []).map((p,i) => (
                    <tr key={i} style={{ borderBottom:'1px solid #0f1018', background: p.note ? 'rgba(0,194,168,.04)' : 'transparent' }}>
                      <td style={{ ...s.bsTd, textAlign:'left' }}>
                        <a href={`/players/${p.id}`} style={{ color: p.note ? '#00c2a8' : '#f0f2f8', textDecoration:'none', fontSize:'.84rem', fontWeight: p.note ? 700 : 400 }}>
                          {p.note}{p.name}
                        </a>
                        {p.decision && <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.68rem', fontWeight:700, marginLeft:'.4rem',
                          color: p.decision==='W'?'#2ed47a':p.decision==='L'?'#e63535':'#00c2a8' }}>
                          ({p.decision})
                        </span>}
                      </td>
                      <td style={s.bsTd}>{p.ip}</td>
                      <td style={s.bsTd}>{p.h}</td>
                      <td style={s.bsTd}>{p.r}</td>
                      <td style={{ ...s.bsTd, color: p.er > 3 ? '#e63535' : '#b8bdd0' }}>{p.er}</td>
                      <td style={s.bsTd}>{p.bb}</td>
                      <td style={{ ...s.bsTd, color: p.k > 5 ? '#2ed47a' : '#b8bdd0' }}>{p.k}</td>
                      <td style={s.bsTd}>{p.hr}</td>
                      <td style={s.bsTd}>{p.pc}</td>
                      <td style={{ ...s.bsTd, color: parseFloat(p.era) <= 3 ? '#2ed47a' : parseFloat(p.era) >= 6 ? '#e63535' : '#b8bdd0' }}>{p.era}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      <footer style={s.footer}>
        Live data via <a href="https://statsapi.mlb.com" style={{ color:'#5c6070' }}>MLB Stats API</a> · Coach.com
      </footer>
    </>
  );
}

const s = {
  nav:           { position:'sticky',top:0,zIndex:200,background:'rgba(3,8,15,.96)',backdropFilter:'blur(16px)',borderBottom:'1px solid #1e2028',height:'54px',display:'flex',alignItems:'center',padding:'0 1.5rem',gap:'1rem' },
  logo:          { fontFamily:"'Bebas Neue',sans-serif",fontSize:'1.5rem',letterSpacing:'.08em',color:'#f0f2f8',textDecoration:'none',flexShrink:0 },
  navLinks:      { display:'flex',gap:'1.5rem',marginLeft:'auto' },
  navLink:       { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.82rem',fontWeight:700,letterSpacing:'.12em',textTransform:'uppercase',color:'#5c6070',textDecoration:'none' },
  header:        { padding:'1.5rem 0 0',borderBottom:'1px solid #1e2028' },
  breadcrumb:    { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.72rem',fontWeight:700,letterSpacing:'.15em',marginBottom:'.75rem' },
  liveBadge:     { display:'inline-flex',alignItems:'center',gap:'.4rem',fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.72rem',fontWeight:700,letterSpacing:'.15em',color:'#2ed47a',background:'rgba(46,212,122,.1)',border:'1px solid rgba(46,212,122,.3)',borderRadius:'4px',padding:'.2rem .6rem' },
  finalBadge:    { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.72rem',fontWeight:700,letterSpacing:'.15em',color:'#f0f2f8',background:'#1e2028',borderRadius:'4px',padding:'.2rem .6rem' },
  previewBadge:  { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.72rem',fontWeight:700,letterSpacing:'.15em',color:'#5c6070',background:'#080c12',border:'1px solid #1e2028',borderRadius:'4px',padding:'.2rem .6rem' },
  inningBadge:   { fontFamily:"'Bebas Neue',sans-serif",fontSize:'.9rem',color:'#00c2a8',background:'rgba(0,194,168,.1)',border:'1px solid rgba(0,194,168,.3)',borderRadius:'4px',padding:'.15rem .6rem' },
  venueBadge:    { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.72rem',color:'#3a3f52',letterSpacing:'.08em' },
  scoreRow:      { display:'flex',alignItems:'center',justifyContent:'space-between',gap:'1rem',marginBottom:'1rem' },
  teamBlock:     { display:'flex',alignItems:'center',gap:'.85rem',flex:1 },
  scoreLogo:     { width:'56px',height:'56px',objectFit:'contain',filter:'drop-shadow(0 2px 8px rgba(0,0,0,.4))' },
  scoreTeamName: { fontFamily:"'Bebas Neue',sans-serif",fontSize:'1.4rem',letterSpacing:'.05em',lineHeight:1 },
  scoreRecord:   { fontSize:'.72rem',color:'#5c6070',marginTop:'.1rem' },
  bigScore:      { fontFamily:"'Bebas Neue',sans-serif",fontSize:'3.5rem',letterSpacing:'.02em',lineHeight:1,transition:'color .3s' },
  scoreDivider:  { textAlign:'center',flexShrink:0 },
  scoreDash:     { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'1.5rem',color:'#3a3f52' },
  countDisplay:  { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.78rem',fontWeight:700,marginTop:'.2rem' },
  linescoreWrap: { background:'#080c12',borderTop:'1px solid #1e2028',padding:'.75rem 0' },
  lsTh:          { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.62rem',fontWeight:700,letterSpacing:'.1em',color:'#3a3f52',padding:'.4rem .6rem',textAlign:'center' },
  lsTd:          { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.78rem',padding:'.4rem .6rem',textAlign:'center',color:'#b8bdd0' },
  tabBar:        { borderBottom:'1px solid #1e2028',background:'#080c12',position:'sticky',top:'54px',zIndex:100 },
  tabInner:      { maxWidth:'960px',margin:'0 auto',display:'flex',overflowX:'auto',padding:'0 1.5rem' },
  tabBtn:        { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.8rem',fontWeight:700,letterSpacing:'.1em',padding:'.85rem 1.25rem',background:'none',border:'none',borderBottom:'2px solid transparent',color:'#5c6070',cursor:'pointer',whiteSpace:'nowrap',transition:'color .15s' },
  body:          { maxWidth:'960px',margin:'0 auto',padding:'1.5rem' },
  liveGrid:      { display:'grid',gridTemplateColumns:'minmax(0,1fr) 320px',gap:'1.5rem' },
  secLabel:      { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.72rem',fontWeight:700,letterSpacing:'.22em',color:'#00c2a8',marginBottom:'1rem',paddingBottom:'.5rem',borderBottom:'1px solid #1e2028' },
  atBatCard:     { background:'#0d1117',border:'1px solid #1e2028',borderRadius:'10px',padding:'1.25rem' },
  previewCard:   { background:'#0d1117',border:'1px solid #1e2028',borderRadius:'10px',padding:'2rem',textAlign:'center',marginBottom:'1rem' },
  atBatAvatar:   { width:'44px',height:'44px',borderRadius:'50%',objectFit:'cover',background:'#1e2028',flexShrink:0 },
  countRow:      { display:'flex',justifyContent:'space-around',background:'#080c12',borderRadius:'8px',padding:'.75rem 1rem' },
  scoringPlay:   { background:'#0d1117',border:'1px solid #1e2028',borderRadius:'8px',padding:'.85rem 1rem' },
  playRow:       { display:'flex',gap:'.75rem',alignItems:'flex-start',padding:'.65rem .75rem',borderRadius:'6px',transition:'background .1s' },
  playInning:    { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.75rem',fontWeight:700,minWidth:'28px',flexShrink:0,marginTop:'.1rem' },
  tableWrap:     { background:'#0d1117',border:'1px solid #1e2028',borderRadius:'10px',overflow:'auto',marginBottom:'1rem' },
  bsTh:          { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.62rem',fontWeight:700,letterSpacing:'.1em',color:'#5c6070',padding:'.55rem .75rem',textAlign:'center',background:'#080c12',whiteSpace:'nowrap' },
  bsTd:          { padding:'.55rem .75rem',textAlign:'center',fontSize:'.82rem',color:'#b8bdd0',whiteSpace:'nowrap' },
  subBtn:        { padding:'.4rem .9rem',background:'transparent',border:'1px solid #1e2028',borderRadius:'4px',fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.78rem',fontWeight:700,letterSpacing:'.08em',color:'#5c6070',cursor:'pointer',display:'flex',alignItems:'center' },
  footer:        { borderTop:'1px solid #1e2028',padding:'1.4rem',textAlign:'center',fontSize:'.74rem',color:'#5c6070',marginTop:'3rem' },
};