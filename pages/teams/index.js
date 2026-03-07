// pages/teams/index.js  — browse all 30 MLB teams by division

import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

const DIVISIONS = [
  {
    name: 'AL East', teams: [
      { id: 110, name: 'Baltimore Orioles',    abbr: 'BAL', color: '#DF4601' },
      { id: 111, name: 'Boston Red Sox',       abbr: 'BOS', color: '#BD3039' },
      { id: 147, name: 'New York Yankees',     abbr: 'NYY', color: '#003087' },
      { id: 139, name: 'Tampa Bay Rays',       abbr: 'TB',  color: '#8FBCE6' },
      { id: 141, name: 'Toronto Blue Jays',    abbr: 'TOR', color: '#134A8E' },
    ]
  },
  {
    name: 'AL Central', teams: [
      { id: 145, name: 'Chicago White Sox',    abbr: 'CWS', color: '#C4CED4' },
      { id: 114, name: 'Cleveland Guardians',  abbr: 'CLE', color: '#E31937' },
      { id: 116, name: 'Detroit Tigers',       abbr: 'DET', color: '#FA4616' },
      { id: 118, name: 'Kansas City Royals',   abbr: 'KC',  color: '#004687' },
      { id: 142, name: 'Minnesota Twins',      abbr: 'MIN', color: '#D31145' },
    ]
  },
  {
    name: 'AL West', teams: [
      { id: 117, name: 'Houston Astros',       abbr: 'HOU', color: '#EB6E1F' },
      { id: 108, name: 'Los Angeles Angels',   abbr: 'LAA', color: '#BA0021' },
      { id: 133, name: 'Oakland Athletics',    abbr: 'OAK', color: '#EFB21E' },
      { id: 136, name: 'Seattle Mariners',     abbr: 'SEA', color: '#005C5C' },
      { id: 140, name: 'Texas Rangers',        abbr: 'TEX', color: '#C0111F' },
    ]
  },
  {
    name: 'NL East', teams: [
      { id: 144, name: 'Atlanta Braves',       abbr: 'ATL', color: '#CE1141' },
      { id: 146, name: 'Miami Marlins',        abbr: 'MIA', color: '#00A3E0' },
      { id: 121, name: 'New York Mets',        abbr: 'NYM', color: '#FF5910' },
      { id: 143, name: 'Philadelphia Phillies',abbr: 'PHI', color: '#E81828' },
      { id: 120, name: 'Washington Nationals', abbr: 'WSH', color: '#AB0003' },
    ]
  },
  {
    name: 'NL Central', teams: [
      { id: 112, name: 'Chicago Cubs',         abbr: 'CHC', color: '#0E3386' },
      { id: 113, name: 'Cincinnati Reds',      abbr: 'CIN', color: '#C6011F' },
      { id: 158, name: 'Milwaukee Brewers',    abbr: 'MIL', color: '#FFC52F' },
      { id: 134, name: 'Pittsburgh Pirates',   abbr: 'PIT', color: '#FDB827' },
      { id: 138, name: 'St. Louis Cardinals',  abbr: 'STL', color: '#C41E3A' },
    ]
  },
  {
    name: 'NL West', teams: [
      { id: 109, name: 'Arizona Diamondbacks', abbr: 'ARI', color: '#A71930' },
      { id: 115, name: 'Colorado Rockies',     abbr: 'COL', color: '#8B74C4' },
      { id: 119, name: 'Los Angeles Dodgers',  abbr: 'LAD', color: '#005A9C' },
      { id: 135, name: 'San Diego Padres',     abbr: 'SD',  color: '#FFC425' },
      { id: 137, name: 'San Francisco Giants', abbr: 'SF',  color: '#FD5A1E' },
    ]
  },
];

export default function TeamsIndex() {
  const router = useRouter();
  const [league, setLeague] = useState('all'); // all | AL | NL

  const shown = DIVISIONS.filter(d =>
    league === 'all' || d.name.startsWith(league)
  );

  return (
    <>
      <Head>
        <title>Teams — CoachValerio</title>
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@300;400;500;600&family=Barlow+Condensed:wght@400;600;700;900&display=swap" rel="stylesheet" />
        <style>{`
          *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
          body{background:#050608;color:#b8bdd0;font-family:'Barlow',sans-serif;-webkit-font-smoothing:antialiased}
          .team-card:hover{transform:translateY(-3px);border-color:#2a2f3f!important;transition:all .2s}
        `}</style>
      </Head>

      <nav style={s.nav}>
        <a href="/" style={s.logo}>Coach<span style={{ color: '#00c2a8' }}>Valerio</span></a>
        <div style={s.navLinks}>
          <a href="/" style={s.navLink}>Home</a>
          <a href="/scoreboard" style={s.navLink}>Scoreboard</a>
          <a href="/teams" style={{ ...s.navLink, color: '#00c2a8' }}>Teams</a>
          <a href="/transactions" style={s.navLink}>Transactions</a>
          <a href="/compare" style={s.navLink}>Compare</a>
        </div>
      </nav>

      <div style={s.header}>
        <div style={s.headerInner}>
          <div>
            <div style={s.pageLabel}>MLB TEAMS</div>
            <div style={s.pageTitle}>All 30 Teams</div>
          </div>
          <div style={s.leagueTabs}>
            {[['all','All'],['AL','American League'],['NL','National League']].map(([v,lbl]) => (
              <button key={v} onClick={() => setLeague(v)}
                style={{ ...s.lTab, ...(league === v ? s.lTabActive : {}) }}>
                {lbl}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={s.body}>
        {shown.map(div => (
          <div key={div.name} style={s.divSection}>
            <div style={s.divLabel}>{div.name}</div>
            <div style={s.teamGrid}>
              {div.teams.map(team => (
                <div key={team.id} className="team-card"
                  style={{ ...s.teamCard, borderColor: team.color + '33' }}
                  onClick={() => router.push(`/teams/${team.id}`)}>
                  {/* Team logo */}
                  <div style={{ ...s.logoWrap, background: team.color + '15' }}>
                    <img
                      src={`https://www.mlbstatic.com/team-logos/${team.id}.svg`}
                      alt={team.name}
                      style={s.teamLogo}
                      onError={e => e.target.style.display = 'none'}
                    />
                  </div>
                  <div style={s.teamInfo}>
                    <div style={{ ...s.teamAbbr, color: team.color }}>{team.abbr}</div>
                    <div style={s.teamName}>{team.name}</div>
                  </div>
                  <div style={{ ...s.arrow, color: team.color }}>→</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <footer style={s.footer}>
        Data via <a href="https://statsapi.mlb.com" style={{ color: '#5c6070' }}>MLB Stats API</a> · CoachValerio.com
      </footer>
    </>
  );
}

const s = {
  nav:         { position:'sticky',top:0,zIndex:200,background:'rgba(5,6,8,.93)',backdropFilter:'blur(16px)',borderBottom:'1px solid #1e2028',height:'54px',display:'flex',alignItems:'center',padding:'0 1.5rem',gap:'1rem' },
  logo:        { fontFamily:"'Bebas Neue',sans-serif",fontSize:'1.5rem',letterSpacing:'.08em',color:'#f0f2f8',textDecoration:'none',flexShrink:0 },
  navLinks:    { display:'flex',gap:'1.5rem',marginLeft:'auto' },
  navLink:     { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.82rem',fontWeight:700,letterSpacing:'.12em',textTransform:'uppercase',color:'#5c6070',textDecoration:'none' },
  header:      { background:'#0a0b0f',borderBottom:'1px solid #1e2028',padding:'1.5rem' },
  headerInner: { maxWidth:'1200px',margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'1rem' },
  pageLabel:   { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.72rem',fontWeight:700,letterSpacing:'.25em',color:'#00c2a8' },
  pageTitle:   { fontFamily:"'Bebas Neue',sans-serif",fontSize:'2.2rem',letterSpacing:'.05em',color:'#f0f2f8' },
  leagueTabs:  { display:'flex',gap:'.5rem' },
  lTab:        { padding:'.35rem .9rem',background:'transparent',border:'1px solid #1e2028',borderRadius:'4px',fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.78rem',fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:'#5c6070',cursor:'pointer' },
  lTabActive:  { borderColor:'#00c2a8',color:'#00c2a8',background:'rgba(0,194,168,.08)' },
  body:        { maxWidth:'1200px',margin:'0 auto',padding:'2rem 1.5rem' },
  divSection:  { marginBottom:'2.5rem' },
  divLabel:    { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.72rem',fontWeight:700,letterSpacing:'.22em',color:'#00c2a8',marginBottom:'1rem',paddingBottom:'.5rem',borderBottom:'1px solid #1e2028' },
  teamGrid:    { display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:'.75rem' },
  teamCard:    { display:'flex',alignItems:'center',gap:'.85rem',background:'#111318',border:'1px solid',borderRadius:'10px',padding:'.85rem 1rem',cursor:'pointer',transition:'all .2s' },
  logoWrap:    { width:'48px',height:'48px',borderRadius:'8px',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 },
  teamLogo:    { width:'36px',height:'36px',objectFit:'contain' },
  teamInfo:    { flex:1,minWidth:0 },
  teamAbbr:    { fontFamily:"'Bebas Neue',sans-serif",fontSize:'1.1rem',letterSpacing:'.08em',lineHeight:1 },
  teamName:    { fontSize:'.75rem',color:'#5c6070',marginTop:'.1rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' },
  arrow:       { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'1rem',fontWeight:700,flexShrink:0 },
  footer:      { borderTop:'1px solid #1e2028',padding:'1.4rem',textAlign:'center',fontSize:'.74rem',color:'#5c6070' },
};