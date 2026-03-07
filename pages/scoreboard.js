// pages/scoreboard.js
import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

function getCurrentSeason() {
  const now = new Date();
  return now >= new Date(now.getFullYear(), 2, 20) ? now.getFullYear() : now.getFullYear() - 1;
}

const TEAM_COLORS = {
  'New York Yankees':       '#003087', 'Boston Red Sox':       '#BD3039',
  'Los Angeles Dodgers':    '#005A9C', 'San Francisco Giants':  '#FD5A1E',
  'Chicago Cubs':           '#0E3386', 'Chicago White Sox':    '#C4CED4',
  'Houston Astros':         '#EB6E1F', 'Atlanta Braves':       '#CE1141',
  'New York Mets':          '#FF5910', 'Philadelphia Phillies':'#E81828',
  'Los Angeles Angels':     '#BA0021', 'Oakland Athletics':    '#EFB21E',
  'Seattle Mariners':       '#005C5C', 'Texas Rangers':        '#C0111F',
  'Toronto Blue Jays':      '#134A8E', 'Baltimore Orioles':    '#DF4601',
  'Tampa Bay Rays':         '#8FBCE6', 'Minnesota Twins':      '#D31145',
  'Cleveland Guardians':    '#E31937', 'Detroit Tigers':       '#FA4616',
  'Kansas City Royals':     '#004687', 'St. Louis Cardinals':  '#C41E3A',
  'Milwaukee Brewers':      '#FFC52F', 'Pittsburgh Pirates':   '#FDB827',
  'Cincinnati Reds':        '#C6011F', 'Colorado Rockies':     '#8B74C4',
  'Arizona Diamondbacks':   '#A71930', 'San Diego Padres':     '#FFC425',
  'Miami Marlins':          '#00A3E0', 'Washington Nationals':  '#AB0003',
};
function tc(name) { return TEAM_COLORS[name] ?? '#00c2a8'; }

function statusBadge(game) {
  if (game.isFinal)  return { text: 'FINAL', color: '#5c6070' };
  if (game.isLive)   return { text: `${game.inningHalf?.toUpperCase() ?? ''} ${ordinal(game.inning)}`, color: '#2ed47a' };
  const dt = new Date(game.gameDate);
  const time = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  return { text: time, color: '#f5a623' };
}

function ordinal(n) {
  const s = ['th','st','nd','rd'], v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

function hrBoostLabel(boost) {
  if (boost >= 1.20) return { label: '🚀 HR Surge', color: '#00c2a8' };
  if (boost >= 1.10) return { label: '⬆ HR Friendly', color: '#2ed47a' };
  if (boost >= 0.95) return { label: '≈ Neutral', color: '#5c6070' };
  if (boost >= 0.85) return { label: '⬇ Pitcher Friendly', color: '#f5a623' };
  return { label: '🔒 HR Suppressor', color: '#e63535' };
}

function windArrow(deg) {
  // rotate arrow to show wind direction
  return <span style={{ display: 'inline-block', transform: `rotate(${deg}deg)`, fontSize: '1rem' }}>↑</span>;
}

export default function Scoreboard() {
  const router  = useRouter();
  const SEASON  = getCurrentSeason();
  const [games, setGames]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate]       = useState(new Date().toISOString().slice(0, 10));
  const [filter, setFilter]   = useState('all'); // all | live | upcoming | final
  const [oddsMap, setOddsMap] = useState({});

  useEffect(() => {
    setLoading(true);
    fetch(`/api/scoreboard?date=${date}`)
      .then(r => r.json())
      .then(d => { setGames(d.games ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [date]);

  // Fetch game-level odds (moneyline/runline/total) for today only
  useEffect(() => {
    if (date !== new Date().toISOString().slice(0, 10)) return;
    fetch('/api/odds-board')
      .then(r => r.json())
      .then(d => {
        const map = {};
        (d.games ?? []).forEach(g => { map[g.gamePk] = g; });
        setOddsMap(map);
      })
      .catch(() => {});
  }, [date]);

  const displayed = games.filter(g => {
    if (filter === 'live')     return g.isLive;
    if (filter === 'upcoming') return !g.isLive && !g.isFinal;
    if (filter === 'final')    return g.isFinal;
    if (filter === 'spring')   return g.gameTypeLabel === 'Spring Training';
    if (filter === 'wbc')      return g.gameTypeLabel === 'World Baseball Classic';
    return true;
  });

  const navToPlayer = (id) => { if (id) router.push(`/players/${id}`); };

  return (
    <>
      <Head>
        <title>Scoreboard — Coach</title>
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@300;400;500;600&family=Barlow+Condensed:wght@400;600;700;900&display=swap" rel="stylesheet" />
        <style>{`
          *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
          body{background:#03080f;color:#c8cde0;font-family:'Barlow',sans-serif;-webkit-font-smoothing:antialiased}
          .game-card:hover{border-color:#2a2f3f!important;transform:translateY(-1px);transition:all .2s}
        `}</style>
      </Head>

      {/* NAV */}
      <nav style={s.nav}>
        <a href="/" style={s.logo}>COACH<span style={{ color:"#00c2a8" }}>.</span></a>
        <div style={s.navLinks}>
          <a href="/" style={s.navLink}>Home</a>
          <a href="/scoreboard" style={{ ...s.navLink, color: '#00c2a8' }}>Scoreboard</a>
          <a href="/transactions" style={s.navLink}>Transactions</a>
          <a href="/compare" style={s.navLink}>Compare</a>
        </div>
      </nav>

      {/* HEADER */}
      <div style={s.header}>
        <div style={s.headerInner}>
          <div>
            <div style={s.pageLabel}>SCOREBOARD</div>
            <div style={s.pageTitle}>{SEASON} MLB Games</div>
          </div>
          <div style={s.controls}>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              style={s.dateInput} />
          </div>
        </div>
        {/* Filter tabs */}
        <div style={s.filterRow}>
          {[['all','All Games'],['live','🔴 Live'],['upcoming','Upcoming'],['final','Final'],['spring','⚾ Spring Training'],['wbc','🌍 WBC']].map(([v, lbl]) => (
            <button key={v} onClick={() => setFilter(v)}
              style={{ ...s.fBtn, ...(filter === v ? s.fBtnActive : {}) }}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      <div style={s.body}>
        {loading && <div style={s.loading}>Loading games…</div>}
        {!loading && displayed.length === 0 && (
          <div style={s.loading}>No games found for {date}</div>
        )}

        <div style={s.grid}>
          {displayed.map(game => {
            const badge = statusBadge(game);
            const boost = hrBoostLabel(game.hrBoost);
            const homeColor = tc(game.home.name);
            const awayColor = tc(game.away.name);
            const homeLead  = game.home.score > game.away.score;
            const awayLead  = game.away.score > game.home.score;
            const gameOdds  = oddsMap[game.gamePk];

            return (
              <div key={game.gamePk} className="game-card" style={{ ...s.card, cursor:'pointer' }}
                onClick={() => router.push(`/games/${game.gamePk}`)}>
                {/* Status bar */}
                <div style={{ ...s.statusBar, background: game.isLive ? 'rgba(46,212,122,.08)' : 'transparent', borderBottom: '1px solid #1e2028' }}>
                  <div style={{ display:'flex', flexDirection:'column', gap:'.1rem' }}>
                    <span style={{ ...s.statusBadge, color: badge.color }}>{badge.text}</span>
                    {game.gameTypeLabel && (
                      <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.62rem', fontWeight:700, letterSpacing:'.1em', color:'#8b74c4' }}>
                        {game.gameTypeLabel.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span style={s.venue}>{game.venue}</span>
                </div>

                {/* Teams + Score */}
                <div style={s.matchup}>
                  {/* Away team */}
                  <div style={s.teamRow}>
                    <img src={`https://www.mlbstatic.com/team-logos/${game.away.id}.svg`}
                      alt={game.away.abbr} style={s.teamLogo}
                      onError={e => e.target.style.display = 'none'} />
                    <div style={s.teamInfo}>
                      <div style={{ ...s.teamName, color: awayColor }}>{game.away.abbr}</div>
                      <div style={s.teamRecord}>{game.away.record}</div>
                    </div>
                    <div style={{ ...s.score, fontWeight: awayLead ? 800 : 400, color: awayLead ? '#f0f2f8' : '#5c6070' }}>
                      {game.isFinal || game.isLive ? game.away.score : '—'}
                    </div>
                  </div>

                  <div style={s.vs}>vs</div>

                  {/* Home team */}
                  <div style={s.teamRow}>
                    <img src={`https://www.mlbstatic.com/team-logos/${game.home.id}.svg`}
                      alt={game.home.abbr} style={s.teamLogo}
                      onError={e => e.target.style.display = 'none'} />
                    <div style={s.teamInfo}>
                      <div style={{ ...s.teamName, color: homeColor }}>{game.home.abbr}</div>
                      <div style={s.teamRecord}>{game.home.record}</div>
                    </div>
                    <div style={{ ...s.score, fontWeight: homeLead ? 800 : 400, color: homeLead ? '#f0f2f8' : '#5c6070' }}>
                      {game.isFinal || game.isLive ? game.home.score : '—'}
                    </div>
                  </div>
                </div>

                {/* Win Probability Bar */}
                {(game.isLive || game.isFinal) && (
                  <div style={s.wpSection}>
                    <div style={s.wpLabel}>
                      <span style={{ color: awayColor }}>{game.away.abbr} {100 - game.homeWinPct}%</span>
                      <span style={s.wpTitle}>WIN PROB</span>
                      <span style={{ color: homeColor }}>{game.homeWinPct}% {game.home.abbr}</span>
                    </div>
                    <div style={s.wpBar}>
                      <div style={{ width: `${100 - game.homeWinPct}%`, background: awayColor, height: '100%', borderRadius: '3px 0 0 3px', transition: 'width .4s' }} />
                      <div style={{ width: `${game.homeWinPct}%`, background: homeColor, height: '100%', borderRadius: '0 3px 3px 0', transition: 'width .4s' }} />
                    </div>
                  </div>
                )}

                {/* Probable Pitchers */}
                {(game.home.pitcher || game.away.pitcher) && (
                  <div style={s.pitchers}>
                    <div style={s.pitcherRow}>
                      <span style={s.pitcherLabel}>AWAY SP</span>
                      <span style={s.pitcherName}>{game.away.pitcher ?? 'TBD'}</span>
                    </div>
                    <div style={s.pitcherRow}>
                      <span style={s.pitcherLabel}>HOME SP</span>
                      <span style={s.pitcherName}>{game.home.pitcher ?? 'TBD'}</span>
                    </div>
                  </div>
                )}

                {/* ── Live Odds Strip ── */}
                {gameOdds?.hasOdds && (
                  <div style={{ borderTop:'1px solid #1e2028', display:'flex', alignItems:'stretch' }}>
                    {/* Moneyline */}
                    <div style={{ flex:1, padding:'.5rem .75rem', borderRight:'1px solid #1e2028', textAlign:'center' }}>
                      <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.55rem', fontWeight:700, letterSpacing:'.15em', color:'#3a3f52', marginBottom:'.25rem' }}>MONEYLINE</div>
                      <div style={{ display:'flex', justifyContent:'space-around' }}>
                        <div>
                          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.6rem', color: awayColor }}>{game.away.abbr}</div>
                          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.05rem', color: gameOdds.awayTier?.rank >= 3 ? '#2ed47a' : '#f0f2f8', lineHeight:1 }}>
                            {gameOdds.odds?.moneyline?.away?.price > 0 ? '+' : ''}{gameOdds.odds?.moneyline?.away?.price ?? '—'}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.6rem', color: homeColor }}>{game.home.abbr}</div>
                          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.05rem', color: gameOdds.homeTier?.rank >= 3 ? '#2ed47a' : '#f0f2f8', lineHeight:1 }}>
                            {gameOdds.odds?.moneyline?.home?.price > 0 ? '+' : ''}{gameOdds.odds?.moneyline?.home?.price ?? '—'}
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Run Line */}
                    <div style={{ flex:1, padding:'.5rem .75rem', borderRight:'1px solid #1e2028', textAlign:'center' }}>
                      <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.55rem', fontWeight:700, letterSpacing:'.15em', color:'#3a3f52', marginBottom:'.25rem' }}>RUN LINE</div>
                      <div style={{ display:'flex', justifyContent:'space-around' }}>
                        {['away','home'].map(side => (
                          <div key={side}>
                            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.58rem', color:'#5c6070' }}>
                              {gameOdds.odds?.runline?.[side]?.point > 0 ? '+' : ''}{gameOdds.odds?.runline?.[side]?.point}
                            </div>
                            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.05rem', color:'#f0f2f8', lineHeight:1 }}>
                              {gameOdds.odds?.runline?.[side]?.price > 0 ? '+' : ''}{gameOdds.odds?.runline?.[side]?.price ?? '—'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Total */}
                    <div style={{ flex:1, padding:'.5rem .75rem', textAlign:'center' }}>
                      <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.55rem', fontWeight:700, letterSpacing:'.15em', color:'#3a3f52', marginBottom:'.25rem' }}>O/U {gameOdds.odds?.total?.line}</div>
                      <div style={{ display:'flex', justifyContent:'space-around' }}>
                        <div>
                          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.58rem', color:'#5c6070' }}>Over</div>
                          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.05rem', color:'#f0f2f8', lineHeight:1 }}>
                            {gameOdds.odds?.total?.over?.price > 0 ? '+' : ''}{gameOdds.odds?.total?.over?.price ?? '—'}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.58rem', color:'#5c6070' }}>Under</div>
                          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.05rem', color:'#f0f2f8', lineHeight:1 }}>
                            {gameOdds.odds?.total?.under?.price > 0 ? '+' : ''}{gameOdds.odds?.total?.under?.price ?? '—'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Weather + HR Boost */}
                <div style={s.weatherSection}>
                  {game.weather?.temp ? (
                    <div style={s.weatherRow}>
                      <span style={s.weatherIcon}>
                        {game.weather.condition === 'Clear' ? '☀️' :
                         game.weather.condition === 'Clouds' ? '☁️' :
                         game.weather.condition === 'Rain' ? '🌧️' :
                         game.weather.condition === 'Snow' ? '❄️' :
                         game.weather.condition === 'Thunderstorm' ? '⛈️' : '🌤️'}
                      </span>
                      <span style={s.weatherText}>
                        {game.weather.temp}°F · {game.weather.windSpeed}mph {game.weather.windDir}
                      </span>
                      <span style={{ ...s.hrBoostBadge, color: boost.color, borderColor: boost.color }}>
                        {boost.label}
                      </span>
                    </div>
                  ) : (
                    <div style={s.weatherRow}>
                      <span style={s.weatherText}>{game.weather?.note ?? 'Weather N/A'}</span>
                      {game.hrBoost && (
                        <span style={{ ...s.hrBoostBadge, color: boost.color, borderColor: boost.color }}>
                          {boost.label}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div style={s.legend}>
          <div style={s.legendTitle}>HR ENVIRONMENT GUIDE</div>
          <div style={s.legendRow}>
            {[
              ['🚀 HR Surge', '#00c2a8', 'Hot weather + wind blowing out + hitter park (≥1.20x)'],
              ['⬆ HR Friendly', '#2ed47a', 'Favorable conditions for power (1.10–1.19x)'],
              ['≈ Neutral', '#5c6070', 'Average conditions (0.95–1.09x)'],
              ['⬇ Pitcher Friendly', '#f5a623', 'Suppressed power environment (0.85–0.94x)'],
              ['🔒 HR Suppressor', '#e63535', 'Cold/dome/wind-in + pitcher park (<0.85x)'],
            ].map(([lbl, col, desc]) => (
              <div key={lbl} style={s.legendItem}>
                <span style={{ color: col, fontWeight: 700 }}>{lbl}</span>
                <span style={{ color: '#5c6070', fontSize: '.75rem', marginLeft: '.4rem' }}>{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <footer style={s.footer}>
        Weather via <a href="https://openweathermap.org" style={{ color: '#5c6070' }}>OpenWeatherMap</a> ·
        Scores via <a href="https://statsapi.mlb.com" style={{ color: '#5c6070' }}>MLB Stats API</a> ·
        Coach.com
      </footer>
    </>
  );
}

const s = {
  nav:          { position:'sticky',top:0,zIndex:200,background:'rgba(3,8,15,.96)',backdropFilter:'blur(16px)',borderBottom:'1px solid #1e2028',height:'54px',display:'flex',alignItems:'center',padding:'0 1.5rem',gap:'1rem' },
  logo:         { fontFamily:"'Bebas Neue',sans-serif",fontSize:'1.5rem',letterSpacing:'.08em',color:'#f0f2f8',textDecoration:'none',flexShrink:0 },
  navLinks:     { display:'flex',gap:'1.5rem',marginLeft:'auto' },
  navLink:      { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.82rem',fontWeight:700,letterSpacing:'.12em',textTransform:'uppercase',color:'#5c6070',textDecoration:'none' },
  header:       { background:'#080c12',borderBottom:'1px solid #1e2028',padding:'1.5rem 1.5rem .75rem' },
  headerInner:  { maxWidth:'1200px',margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'1rem',marginBottom:'1rem' },
  pageLabel:    { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.72rem',fontWeight:700,letterSpacing:'.25em',color:'#00c2a8' },
  pageTitle:    { fontFamily:"'Bebas Neue',sans-serif",fontSize:'2.2rem',letterSpacing:'.05em',color:'#f0f2f8' },
  controls:     { display:'flex',gap:'.75rem',alignItems:'center' },
  dateInput:    { background:'#0d1117',border:'1px solid #1e2028',borderRadius:'6px',color:'#f0f2f8',padding:'.45rem .75rem',fontFamily:"'Barlow',sans-serif",fontSize:'.85rem',cursor:'pointer' },
  filterRow:    { maxWidth:'1200px',margin:'0 auto',display:'flex',gap:'.5rem',flexWrap:'wrap' },
  fBtn:         { padding:'.3rem .85rem',background:'transparent',border:'1px solid #1e2028',borderRadius:'4px',fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.75rem',fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:'#5c6070',cursor:'pointer' },
  fBtnActive:   { borderColor:'#00c2a8',color:'#00c2a8',background:'rgba(0,194,168,.08)' },
  body:         { maxWidth:'1200px',margin:'0 auto',padding:'1.5rem' },
  loading:      { textAlign:'center',color:'#5c6070',padding:'3rem',fontSize:'.9rem' },
  grid:         { display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))',gap:'1rem',marginBottom:'2rem' },
  card:         { background:'#0d1117',border:'1px solid #1e2028',borderRadius:'10px',overflow:'hidden',transition:'all .2s' },
  statusBar:    { display:'flex',alignItems:'center',justifyContent:'space-between',padding:'.5rem .85rem' },
  statusBadge:  { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.72rem',fontWeight:700,letterSpacing:'.15em' },
  venue:        { fontSize:'.7rem',color:'#3a3f52',maxWidth:'55%',textAlign:'right',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' },
  matchup:      { padding:'.75rem 1rem' },
  teamRow:      { display:'flex',alignItems:'center',gap:'.65rem',padding:'.2rem 0' },
  teamLogo:     { width:'28px',height:'28px',objectFit:'contain',flexShrink:0 },
  teamInfo:     { flex:1 },
  teamName:     { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'1rem',fontWeight:700,letterSpacing:'.05em' },
  teamRecord:   { fontSize:'.68rem',color:'#3a3f52' },
  score:        { fontFamily:"'Bebas Neue',sans-serif",fontSize:'2rem',letterSpacing:'.05em',minWidth:'2.5rem',textAlign:'right' },
  vs:           { textAlign:'center',color:'#1e2028',fontSize:'.7rem',fontWeight:700,letterSpacing:'.1em',padding:'.1rem 0' },
  wpSection:    { padding:'.5rem 1rem .6rem',borderTop:'1px solid #1e2028' },
  wpLabel:      { display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'.35rem',fontSize:'.72rem',fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,letterSpacing:'.08em' },
  wpTitle:      { color:'#3a3f52',fontSize:'.65rem',letterSpacing:'.15em' },
  wpBar:        { display:'flex',height:'6px',borderRadius:'3px',overflow:'hidden',background:'#1e2028' },
  pitchers:     { padding:'.5rem 1rem',borderTop:'1px solid #1e2028',display:'flex',flexDirection:'column',gap:'.2rem' },
  pitcherRow:   { display:'flex',gap:'.5rem',alignItems:'center' },
  pitcherLabel: { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.62rem',fontWeight:700,letterSpacing:'.12em',color:'#3a3f52',minWidth:'48px' },
  pitcherName:  { fontSize:'.78rem',color:'#b8bdd0' },
  weatherSection:{ padding:'.5rem 1rem .65rem',borderTop:'1px solid #1e2028' },
  weatherRow:   { display:'flex',alignItems:'center',gap:'.5rem',flexWrap:'wrap' },
  weatherIcon:  { fontSize:'.9rem' },
  weatherText:  { fontSize:'.75rem',color:'#5c6070',flex:1 },
  hrBoostBadge: { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.68rem',fontWeight:700,letterSpacing:'.08em',border:'1px solid',borderRadius:'4px',padding:'.15rem .4rem',whiteSpace:'nowrap' },
  legend:       { background:'#080c12',border:'1px solid #1e2028',borderRadius:'8px',padding:'1rem 1.25rem',marginTop:'1rem' },
  legendTitle:  { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.68rem',fontWeight:700,letterSpacing:'.2em',color:'#5c6070',marginBottom:'.65rem' },
  legendRow:    { display:'flex',flexDirection:'column',gap:'.35rem' },
  legendItem:   { display:'flex',alignItems:'center',flexWrap:'wrap',gap:'.25rem' },
  footer:       { borderTop:'1px solid #1e2028',padding:'1.4rem',textAlign:'center',fontSize:'.74rem',color:'#5c6070' },
};