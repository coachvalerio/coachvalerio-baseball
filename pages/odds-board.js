// pages/odds-board.js
// Odds & Value Board — live moneylines, run lines, O/U cross-referenced with MLB model

import { useState, useEffect } from 'react';
import Head from 'next/head';

const TEAM_COLORS = {
  110:'#DF4601',111:'#BD3039',147:'#003087',139:'#8FBCE6',141:'#134A8E',
  145:'#C4CED4',114:'#E31937',116:'#FA4616',118:'#004687',142:'#D31145',
  117:'#EB6E1F',108:'#BA0021',133:'#EFB21E',136:'#005C5C',140:'#C0111F',
  144:'#CE1141',146:'#00A3E0',121:'#FF5910',143:'#E81828',120:'#AB0003',
  112:'#0E3386',113:'#C6011F',158:'#FFC52F',134:'#FDB827',138:'#C41E3A',
  109:'#A71930',115:'#8B74C4',119:'#005A9C',135:'#FFC425',137:'#FD5A1E',
};
const tc = id => TEAM_COLORS[id] ?? '#00c2a8';

// Format American odds with sign
const fmt = p => p === undefined || p === null ? '—' : (p > 0 ? `+${p}` : `${p}`);

function OddsCell({ price, book, highlight }) {
  const col = highlight === 'pos' ? '#2ed47a' : highlight === 'neg' ? '#e63535' : '#f0f2f8';
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize: '1.35rem', color: col, lineHeight: 1 }}>
        {fmt(price)}
      </div>
      {book && <div style={{ fontSize: '.58rem', color: '#3a3f52', marginTop: '.1rem' }}>{book}</div>}
    </div>
  );
}

function EdgeBar({ modelPct, marketPct, color }) {
  if (!modelPct || !marketPct) return (
    <div style={{ fontSize: '.7rem', color: '#3a3f52', textAlign: 'center' }}>No model data</div>
  );
  const edge   = modelPct - marketPct;
  const maxBar = 20;
  const w      = Math.min(100, Math.abs(edge) / maxBar * 100);
  const col    = edge > 0 ? '#2ed47a' : '#e63535';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.2rem' }}>
        <span style={{ fontSize: '.65rem', color: '#5c6070' }}>Market {marketPct}%</span>
        <span style={{ fontSize: '.65rem', color: color ?? '#00c2a8' }}>Model {modelPct}%</span>
      </div>
      <div style={{ height: '5px', background: '#1e2028', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ width: `${w}%`, height: '100%', background: col, borderRadius: '3px',
          marginLeft: edge < 0 ? `${100 - w}%` : 0, transition: 'width .4s' }} />
      </div>
      <div style={{ fontSize: '.65rem', color: col, textAlign: 'center', marginTop: '.2rem', fontWeight: 700 }}>
        {edge > 0 ? '+' : ''}{edge.toFixed(1)}% edge
      </div>
    </div>
  );
}

function GameCard({ g, filter }) {
  const homeCol = tc(g.home.id);
  const awayCol = tc(g.away.id);
  const homeLead = g.homeScore > g.awayScore;
  const awayLead = g.awayScore > g.homeScore;

  const gameTime = g.gameDate
    ? new Date(g.gameDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
    : '';

  const statusLabel = g.isFinal ? 'FINAL'
    : g.isLive ? `▲ ${g.inning} LIVE`
    : gameTime;

  const statusColor = g.isFinal ? '#5c6070' : g.isLive ? '#2ed47a' : '#b8bdd0';

  // Decide which value tiers to show based on filter
  const showHome = !filter || filter === 'all' || (filter === 'value' && g.homeTier?.rank >= 3) || (filter === 'over' || filter === 'under');
  const showAway = !filter || filter === 'all' || (filter === 'value' && g.awayTier?.rank >= 3) || (filter === 'over' || filter === 'under');

  return (
    <div style={s.card}>
      {/* Status + venue */}
      <div style={s.cardHeader}>
        <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize: '.72rem', fontWeight: 700,
          letterSpacing: '.12em', color: statusColor }}>
          {g.isLive && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2ed47a',
            display: 'inline-block', marginRight: '.35rem', animation: 'pulse 1.5s infinite' }} />}
          {statusLabel}
        </span>
        <span style={{ fontSize: '.68rem', color: '#3a3f52' }}>{g.venue}</span>
        {g.weatherNote && <span style={{ fontSize: '.68rem', color: '#f5a623' }}>{g.weatherNote}</span>}
      </div>

      {/* Teams + score */}
      <div style={s.matchup}>
        {/* Away */}
        <div style={s.teamSide}>
          <img src={`https://www.mlbstatic.com/team-logos/${g.away.id}.svg`}
            alt={g.away.abbr} style={s.logo} onError={e => e.target.style.display = 'none'} />
          <div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight: 700,
              fontSize: '.95rem', color: awayCol }}>{g.away.abbr}</div>
            <div style={{ fontSize: '.65rem', color: '#3a3f52' }}>{g.away.record}</div>
            {g.away.pitcher && <div style={{ fontSize: '.62rem', color: '#5c6070', marginTop: '.1rem' }}>⚾ {g.away.pitcher}</div>}
          </div>
          {(g.isLive || g.isFinal) && (
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize: '2rem',
              color: awayLead ? '#f0f2f8' : '#3a3f52', marginLeft: 'auto' }}>{g.awayScore}</div>
          )}
        </div>

        <div style={{ textAlign: 'center', color: '#3a3f52', fontSize: '.8rem', padding: '0 .5rem' }}>@</div>

        {/* Home */}
        <div style={{ ...s.teamSide, flexDirection: 'row-reverse', textAlign: 'right' }}>
          <img src={`https://www.mlbstatic.com/team-logos/${g.home.id}.svg`}
            alt={g.home.abbr} style={s.logo} onError={e => e.target.style.display = 'none'} />
          <div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight: 700,
              fontSize: '.95rem', color: homeCol }}>{g.home.abbr}</div>
            <div style={{ fontSize: '.65rem', color: '#3a3f52' }}>{g.home.record}</div>
            {g.home.pitcher && <div style={{ fontSize: '.62rem', color: '#5c6070', marginTop: '.1rem' }}>{g.home.pitcher} ⚾</div>}
          </div>
          {(g.isLive || g.isFinal) && (
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize: '2rem',
              color: homeLead ? '#f0f2f8' : '#3a3f52', marginRight: 'auto' }}>{g.homeScore}</div>
          )}
        </div>
      </div>

      {/* Best bet badge */}
      {g.bestBet && (
        <div style={{ ...s.bestBetBadge, background: g.bestBet.color + '15',
          border: `1px solid ${g.bestBet.color}55`, color: g.bestBet.color }}>
          {g.bestBet.label} — {g.bestBet.side === 'home' ? g.home.abbr : g.away.abbr}
          {g.bestBet.edge && ` (${g.bestBet.edge > 0 ? '+' : ''}${g.bestBet.edge}% model edge)`}
        </div>
      )}

      {/* Odds grid */}
      {g.hasOdds ? (
        <div style={s.oddsGrid}>
          {/* Headers */}
          <div style={s.oddsCol}>
            <div style={s.oddsColHeader}>TEAM</div>
            <div style={s.oddsTeamCell}>
              <span style={{ color: awayCol }}>{g.away.abbr}</span>
            </div>
            <div style={s.oddsTeamCell}>
              <span style={{ color: homeCol }}>{g.home.abbr}</span>
            </div>
          </div>

          <div style={s.oddsCol}>
            <div style={s.oddsColHeader}>MONEYLINE</div>
            <div style={s.oddsCellWrap}>
              <OddsCell price={g.odds?.moneyline?.away?.price} book={g.odds?.moneyline?.away?.book}
                highlight={g.awayTier?.rank >= 3 ? 'pos' : null} />
            </div>
            <div style={s.oddsCellWrap}>
              <OddsCell price={g.odds?.moneyline?.home?.price} book={g.odds?.moneyline?.home?.book}
                highlight={g.homeTier?.rank >= 3 ? 'pos' : null} />
            </div>
          </div>

          <div style={s.oddsCol}>
            <div style={s.oddsColHeader}>RUN LINE</div>
            <div style={s.oddsCellWrap}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '.65rem', color: '#5c6070', marginBottom: '.1rem' }}>
                  {fmt(g.odds?.runline?.away?.point)}
                </div>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize: '1.35rem', color: '#f0f2f8', lineHeight: 1 }}>
                  {fmt(g.odds?.runline?.away?.price)}
                </div>
              </div>
            </div>
            <div style={s.oddsCellWrap}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '.65rem', color: '#5c6070', marginBottom: '.1rem' }}>
                  {fmt(g.odds?.runline?.home?.point)}
                </div>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize: '1.35rem', color: '#f0f2f8', lineHeight: 1 }}>
                  {fmt(g.odds?.runline?.home?.price)}
                </div>
              </div>
            </div>
          </div>

          <div style={s.oddsCol}>
            <div style={s.oddsColHeader}>TOTAL</div>
            <div style={s.oddsCellWrap}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '.62rem', color: '#5c6070' }}>O {g.odds?.total?.line}</div>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize: '1.35rem', color: '#f0f2f8', lineHeight: 1 }}>
                  {fmt(g.odds?.total?.over?.price)}
                </div>
              </div>
            </div>
            <div style={s.oddsCellWrap}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '.62rem', color: '#5c6070' }}>U {g.odds?.total?.line}</div>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize: '1.35rem', color: '#f0f2f8', lineHeight: 1 }}>
                  {fmt(g.odds?.total?.under?.price)}
                </div>
              </div>
            </div>
          </div>

          {/* Model vs Market edge column */}
          <div style={{ ...s.oddsCol, minWidth: '130px' }}>
            <div style={s.oddsColHeader}>MODEL EDGE</div>
            <div style={{ ...s.oddsCellWrap, padding: '.5rem .75rem' }}>
              <EdgeBar modelPct={g.model?.awayPct} marketPct={g.market?.awayPct} color={awayCol} />
            </div>
            <div style={{ ...s.oddsCellWrap, padding: '.5rem .75rem' }}>
              <EdgeBar modelPct={g.model?.homePct} marketPct={g.market?.homePct} color={homeCol} />
            </div>
          </div>
        </div>
      ) : (
        <div style={s.noOddsRow}>
          {g.isFinal ? 'Game complete.' : g.isLive ? 'Game in progress.' : 'Lines not yet posted.'}
          {!g.isFinal && !g.isLive && !process.env.NEXT_PUBLIC_HAS_ODDS_KEY &&
            <span style={{ color: '#3a3f52' }}> Add ODDS_API_KEY to enable live lines.</span>}
        </div>
      )}

      {/* Weather */}
      {g.weather?.temp && (
        <div style={s.weatherRow}>
          <span style={{ fontSize: '.7rem', color: '#5c6070' }}>
            {g.weather.temp}°F · {g.weather.wind?.speed}mph {g.weather.wind?.direction}
            {g.weather.condition && ` · ${g.weather.condition}`}
          </span>
        </div>
      )}
    </div>
  );
}

export default function OddsBoardPage() {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('all');
  const [sortBy, setSortBy]     = useState('value'); // value | time

  useEffect(() => {
    fetch('/api/odds-board')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const games = data?.games ?? [];
  const filtered = games.filter(g => {
    if (filter === 'value') return g.bestBet?.rank >= 3;
    if (filter === 'live')  return g.isLive;
    return true;
  });
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'value') {
      const aR = Math.max(a.homeTier?.rank ?? 0, a.awayTier?.rank ?? 0);
      const bR = Math.max(b.homeTier?.rank ?? 0, b.awayTier?.rank ?? 0);
      if (bR !== aR) return bR - aR;
    }
    return new Date(a.gameDate) - new Date(b.gameDate);
  });

  const valueCount = games.filter(g => g.bestBet?.rank >= 3).length;
  const strongCount = games.filter(g => g.bestBet?.rank >= 4).length;

  return (
    <>
      <Head>
        <title>Odds & Value Board — Coach</title>
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@300;400;500;600&family=Barlow+Condensed:wght@400;600;700;900&display=swap" rel="stylesheet" />
        <style>{`
          *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
          body{background:#03080f;color:#c8cde0;font-family:'Barlow',sans-serif;-webkit-font-smoothing:antialiased}
          @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        `}</style>
      </Head>

      {/* NAV */}
      <nav style={s.nav}>
        <a href="/" style={s.logo}>COACH<span style={{ color:"#00c2a8" }}>.</span></a>
        <div style={s.navLinks}>
          <a href="/" style={s.navLink}>Home</a>
          <a href="/scoreboard" style={s.navLink}>Scoreboard</a>
          <a href="/teams" style={s.navLink}>Teams</a>
          <a href="/transactions" style={s.navLink}>Transactions</a>
          <a href="/compare" style={s.navLink}>Compare</a>
          <a href="/trade" style={s.navLink}>Trade AI</a>
          <a href="/odds-board" style={{ ...s.navLink, color: '#00c2a8' }}>Odds Board</a>
        </div>
      </nav>

      {/* HERO */}
      <div style={s.hero}>
        <div style={s.heroLabel}>MLB</div>
        <div style={s.heroTitle}>Odds & Value Board</div>
        <div style={s.heroSub}>
          Live moneylines, run lines & totals cross-referenced with the MLB win probability model
        </div>

        {/* Summary chips */}
        {data && (
          <div style={s.chipRow}>
            <div style={s.chip}>{games.length} Games Today</div>
            {data.gamesWithOdds > 0 && <div style={s.chip}>{data.gamesWithOdds} Lines Posted</div>}
            {valueCount > 0 && <div style={{ ...s.chip, background: 'rgba(46,212,122,.12)', border: '1px solid rgba(46,212,122,.3)', color: '#2ed47a' }}>
              {valueCount} Value Spots
            </div>}
            {strongCount > 0 && <div style={{ ...s.chip, background: 'rgba(0,194,168,.12)', border: '1px solid rgba(0,194,168,.3)', color: '#00c2a8' }}>
              🔥 {strongCount} Strong Value
            </div>}
            {!data.hasApiKey && (
              <div style={{ ...s.chip, background: 'rgba(245,166,35,.08)', border: '1px solid rgba(245,166,35,.25)', color: '#f5a623' }}>
                ⚠ Add ODDS_API_KEY for live lines
              </div>
            )}
          </div>
        )}
      </div>

      {/* FILTERS */}
      <div style={s.filterBar}>
        <div style={s.filterInner}>
          <div style={{ display: 'flex', gap: '.4rem' }}>
            {[['all', 'All Games'], ['value', '✅ Value Only'], ['live', '⚡ Live']].map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)}
                style={{ ...s.filterBtn, ...(filter === k ? s.filterBtnActive : {}) }}>{l}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '.4rem', marginLeft: 'auto' }}>
            <span style={{ fontSize: '.7rem', color: '#3a3f52', alignSelf: 'center' }}>Sort:</span>
            {[['value', 'Value First'], ['time', 'Game Time']].map(([k, l]) => (
              <button key={k} onClick={() => setSortBy(k)}
                style={{ ...s.filterBtn, ...(sortBy === k ? s.filterBtnActive : {}) }}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      {/* API KEY NOTICE */}
      {data && !data.hasApiKey && (
        <div style={s.keyNotice}>
          <strong style={{ color: '#f5a623' }}>To enable live odds:</strong> Get a free API key at{' '}
          <a href="https://the-odds-api.com" target="_blank" rel="noopener noreferrer"
            style={{ color: '#00c2a8' }}>the-odds-api.com</a> (free tier: 500 requests/month){' '}
          → add <code style={{ background: '#1e2028', padding: '.1rem .4rem', borderRadius: '3px' }}>ODDS_API_KEY=yourkey</code>{' '}
          to Vercel Environment Variables → Redeploy.
        </div>
      )}
      {data && data.hasApiKey && data.oddsRawCount === 0 && (
        <div style={s.keyNotice}>
          <strong style={{ color: '#f5a623' }}>⚠ API key found but no odds returned.</strong>{' '}
          {data.oddsError
            ? <span>Error: <code style={{ background: '#1e2028', padding: '.1rem .4rem', borderRadius: '3px' }}>{data.oddsError}</code></span>
            : <span>Spring training lines may not be posted yet for today's games — check back closer to first pitch, or visit{' '}
                <a href="/api/odds-debug" target="_blank" style={{ color: '#00c2a8' }}>/api/odds-debug</a> to diagnose.</span>
          }
        </div>
      )}
      {data && data.hasApiKey && data.oddsRawCount > 0 && data.gamesWithOdds === 0 && (
        <div style={s.keyNotice}>
          <strong style={{ color: '#f5a623' }}>⚠ Odds fetched ({data.oddsRawCount} events) but no games matched today's schedule.</strong>{' '}
          Visit <a href="/api/odds-debug" target="_blank" style={{ color: '#00c2a8' }}>/api/odds-debug</a> to see raw API data.
        </div>
      )}

      {/* LEGEND */}
      <div style={s.legendRow}>
        {[
          ['🔥 Strong Value', '#00c2a8', '8%+ model edge over market'],
          ['✅ Lean Value',   '#2ed47a', '4-7% edge'],
          ['👀 Slight Edge',  '#f5a623', '2-3% edge'],
          ['⚠ Fading',       '#e63535', 'Market strongly disagrees with model'],
        ].map(([label, col, desc]) => (
          <div key={label} style={s.legendItem}>
            <span style={{ color: col, fontWeight: 700, fontSize: '.78rem' }}>{label}</span>
            <span style={{ color: '#3a3f52', fontSize: '.68rem' }}>{desc}</span>
          </div>
        ))}
      </div>

      {/* GAMES */}
      <div style={s.body}>
        {loading ? (
          <div style={s.loading}>Loading today's games…</div>
        ) : sorted.length === 0 ? (
          <div style={s.loading}>
            {filter === 'value' ? 'No value spots found today.' : filter === 'live' ? 'No live games right now.' : 'No games today.'}
          </div>
        ) : (
          <div style={s.grid}>
            {sorted.map(g => <GameCard key={g.gamePk} g={g} filter={filter} />)}
          </div>
        )}
      </div>

      {/* DISCLAIMER */}
      <div style={s.disclaimer}>
        This is for informational and entertainment purposes only. Not financial or betting advice.
        Odds via <a href="https://the-odds-api.com" style={{ color: '#3a3f52' }}>The Odds API</a> ·
        Model via <a href="https://statsapi.mlb.com" style={{ color: '#3a3f52' }}>MLB Stats API</a>
      </div>
    </>
  );
}

const s = {
  nav:           { position:'sticky',top:0,zIndex:200,background:'rgba(3,8,15,.96)',backdropFilter:'blur(16px)',borderBottom:'1px solid #1e2028',height:'54px',display:'flex',alignItems:'center',padding:'0 1.5rem',gap:'1rem' },
  logo:          { fontFamily:"'Bebas Neue',sans-serif",fontSize:'1.5rem',letterSpacing:'.08em',color:'#f0f2f8',textDecoration:'none',flexShrink:0 },
  navLinks:      { display:'flex',gap:'1.5rem',marginLeft:'auto' },
  navLink:       { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.82rem',fontWeight:700,letterSpacing:'.12em',textTransform:'uppercase',color:'#5c6070',textDecoration:'none' },
  hero:          { textAlign:'center',padding:'2.5rem 1.5rem 1.5rem',background:'linear-gradient(180deg,#0a0f1a 0%,#050608 100%)' },
  heroLabel:     { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.72rem',fontWeight:700,letterSpacing:'.3em',color:'#00c2a8',marginBottom:'.3rem' },
  heroTitle:     { fontFamily:"'Bebas Neue',sans-serif",fontSize:'clamp(2.5rem,6vw,4rem)',letterSpacing:'.06em',color:'#f0f2f8',lineHeight:1 },
  heroSub:       { fontSize:'.86rem',color:'#5c6070',marginTop:'.4rem',maxWidth:'550px',margin:'.4rem auto 1rem' },
  chipRow:       { display:'flex',flexWrap:'wrap',gap:'.5rem',justifyContent:'center',marginTop:'.75rem' },
  chip:          { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.72rem',fontWeight:700,letterSpacing:'.1em',padding:'.25rem .75rem',background:'#0d1117',border:'1px solid #1e2028',borderRadius:'20px',color:'#5c6070' },
  filterBar:     { borderBottom:'1px solid #1e2028',background:'#080c12',position:'sticky',top:'54px',zIndex:99 },
  filterInner:   { maxWidth:'1200px',margin:'0 auto',padding:'.5rem 1.5rem',display:'flex',alignItems:'center',gap:'.5rem',flexWrap:'wrap' },
  filterBtn:     { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.75rem',fontWeight:700,letterSpacing:'.1em',padding:'.35rem .85rem',background:'transparent',border:'1px solid #1e2028',borderRadius:'4px',color:'#5c6070',cursor:'pointer' },
  filterBtnActive:{ borderColor:'#00c2a8',color:'#00c2a8',background:'rgba(0,194,168,.08)' },
  keyNotice:     { maxWidth:'1200px',margin:'1rem auto',padding:'.75rem 1.25rem',background:'rgba(245,166,35,.06)',border:'1px solid rgba(245,166,35,.2)',borderRadius:'8px',fontSize:'.82rem',color:'#b8bdd0' },
  legendRow:     { maxWidth:'1200px',margin:'.75rem auto',padding:'0 1.5rem',display:'flex',flexWrap:'wrap',gap:'1.25rem 2rem' },
  legendItem:    { display:'flex',flexDirection:'column',gap:'.1rem' },
  body:          { maxWidth:'1200px',margin:'0 auto',padding:'1rem 1.5rem 3rem' },
  grid:          { display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(560px,1fr))',gap:'1rem' },
  loading:       { textAlign:'center',color:'#3a3f52',padding:'4rem',fontSize:'.9rem' },
  card:          { background:'#0d1117',border:'1px solid #1e2028',borderRadius:'10px',overflow:'hidden' },
  cardHeader:    { display:'flex',alignItems:'center',gap:'1rem',padding:'.55rem 1rem',background:'#080c12',borderBottom:'1px solid #1e2028',flexWrap:'wrap' },
  matchup:       { display:'flex',alignItems:'center',padding:'.85rem 1rem',gap:'.5rem' },
  teamSide:      { display:'flex',alignItems:'center',gap:'.6rem',flex:1 },
  logo:          { width:'36px',height:'36px',objectFit:'contain' },
  bestBetBadge:  { margin:'0 1rem .65rem',padding:'.3rem .85rem',borderRadius:'4px',fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.72rem',fontWeight:700,letterSpacing:'.1em',textAlign:'center' },
  oddsGrid:      { display:'flex',borderTop:'1px solid #1e2028',overflowX:'auto' },
  oddsCol:       { flex:1,minWidth:'75px',borderRight:'1px solid #1e2028' },
  oddsColHeader: { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.6rem',fontWeight:700,letterSpacing:'.15em',color:'#3a3f52',padding:'.35rem .5rem',textAlign:'center',background:'#080c12',borderBottom:'1px solid #1e2028' },
  oddsTeamCell:  { padding:'.55rem .5rem',textAlign:'center',borderBottom:'1px solid #0f1018',fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.8rem',fontWeight:700 },
  oddsCellWrap:  { padding:'.55rem .5rem',borderBottom:'1px solid #0f1018' },
  noOddsRow:     { padding:'.75rem 1rem',fontSize:'.78rem',color:'#3a3f52',textAlign:'center',borderTop:'1px solid #1e2028' },
  weatherRow:    { padding:'.4rem 1rem',borderTop:'1px solid #0f1018',background:'#080c12' },
  disclaimer:    { textAlign:'center',padding:'1.5rem',fontSize:'.72rem',color:'#3a3f52',borderTop:'1px solid #1e2028',marginTop:'1rem' },
};