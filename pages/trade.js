// pages/trade.js
import { useState } from 'react';
import Head from 'next/head';

const GRADE_COLOR = {
  'A+':'#00c2a8','A':'#00c2a8','A-':'#2ed47a',
  'B+':'#2ed47a','B':'#2ed47a','B-':'#8fd47a',
  'C+':'#f5a623','C':'#f5a623','C-':'#e08020',
  'D':'#e63535','F':'#b00020',
};

const MLB_TEAMS = [
  'Arizona Diamondbacks','Atlanta Braves','Baltimore Orioles','Boston Red Sox',
  'Chicago Cubs','Chicago White Sox','Cincinnati Reds','Cleveland Guardians',
  'Colorado Rockies','Detroit Tigers','Houston Astros','Kansas City Royals',
  'Los Angeles Angels','Los Angeles Dodgers','Miami Marlins','Milwaukee Brewers',
  'Minnesota Twins','New York Mets','New York Yankees','Oakland Athletics',
  'Philadelphia Phillies','Pittsburgh Pirates','San Diego Padres','San Francisco Giants',
  'Seattle Mariners','St. Louis Cardinals','Tampa Bay Rays','Texas Rangers',
  'Toronto Blue Jays','Washington Nationals',
];

function GradeCircle({ grade, label, color }) {
  const col = GRADE_COLOR[grade] ?? '#5c6070';
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: '90px', height: '90px', borderRadius: '50%',
        border: `3px solid ${col}`, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', margin: '0 auto',
        background: col + '15', boxShadow: `0 0 24px ${col}30`,
      }}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '2.2rem', color: col, lineHeight: 1 }}>{grade ?? '—'}</div>
      </div>
      <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: '.72rem', fontWeight: 700, letterSpacing: '.15em', color, marginTop: '.5rem' }}>{label}</div>
    </div>
  );
}

function ScoreBar({ scoreA, scoreB, label, analysis, colorA, colorB }) {
  const maxS = Math.max(scoreA, scoreB, 1);
  const aWins = scoreA > scoreB;
  const bWins = scoreB > scoreA;
  return (
    <div style={ds.dimRow}>
      <div style={ds.dimLabel}>{label}</div>
      <div style={ds.dimBars}>
        {/* Team A bar */}
        <div style={ds.barWrap}>
          <div style={{ ...ds.barTrack, flexDirection: 'row-reverse' }}>
            <div style={{ width: `${(scoreA / 10) * 100}%`, background: aWins ? colorA : colorA + '88', borderRadius: '3px 0 0 3px', height: '100%', transition: 'width .6s', minWidth: scoreA > 0 ? '4px' : 0 }} />
          </div>
          <div style={{ ...ds.barScore, color: aWins ? colorA : '#5c6070' }}>{scoreA}</div>
        </div>
        {/* Team B bar */}
        <div style={ds.barWrap}>
          <div style={ds.barTrack}>
            <div style={{ width: `${(scoreB / 10) * 100}%`, background: bWins ? colorB : colorB + '88', borderRadius: '0 3px 3px 0', height: '100%', transition: 'width .6s', minWidth: scoreB > 0 ? '4px' : 0 }} />
          </div>
          <div style={{ ...ds.barScore, color: bWins ? colorB : '#5c6070' }}>{scoreB}</div>
        </div>
      </div>
      {analysis && <div style={ds.dimAnalysis}>{analysis}</div>}
    </div>
  );
}

function PlayerInput({ value, onChange, placeholder, color }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={5}
      style={{
        width: '100%', background: '#0a0b0f', border: `1px solid ${color}44`,
        borderRadius: '8px', color: '#f0f2f8', fontFamily: "'Barlow',sans-serif",
        fontSize: '.86rem', padding: '.85rem 1rem', resize: 'vertical',
        outline: 'none', lineHeight: 1.6, transition: 'border-color .2s',
      }}
      onFocus={e => e.target.style.borderColor = color}
      onBlur={e => e.target.style.borderColor = color + '44'}
    />
  );
}

export default function TradePage() {
  const [mode, setMode]         = useState('reallife'); // reallife | fantasy
  const [teamAName, setTeamAName] = useState('');
  const [teamBName, setTeamBName] = useState('');
  const [teamAGets, setTeamAGets] = useState('');
  const [teamBGets, setTeamBGets] = useState('');
  const [context, setContext]   = useState('');
  const [result, setResult]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [expanded, setExpanded] = useState({});

  const colorA = '#00c2a8';
  const colorB = '#f5a623';

  async function analyze() {
    if (!teamAGets.trim() || !teamBGets.trim()) {
      setError('Please fill in both sides of the trade.');
      return;
    }
    setError('');
    setLoading(true);
    setResult(null);
    try {
      const r = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamA: teamAGets,
          teamB: teamBGets,
          teamAName: teamAName || 'Team A',
          teamBName: teamBName || 'Team B',
          mode,
          context,
        }),
      });
      const d = await r.json();
      if (d.error) { 
        setError(d.stack ? `${d.error}\n\n${d.stack}` : d.error); 
        setLoading(false); 
        return; 
      }
      setResult(d);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  function reset() {
    setResult(null);
    setTeamAGets('');
    setTeamBGets('');
    setContext('');
    setError('');
  }

  const nameA = teamAName || 'Team A';
  const nameB = teamBName || 'Team B';

  const winnerColor =
    result?.winner === nameA ? colorA :
    result?.winner === nameB ? colorB :
    result?.winner === 'Team A' ? colorA :
    result?.winner === 'Team B' ? colorB : '#b8bdd0';

  return (
    <>
      <Head>
        <title>AI Trade Analyzer — Coach</title>
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@300;400;500;600&family=Barlow+Condensed:wght@400;600;700;900&display=swap" rel="stylesheet" />
        <style>{`
          *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
          body{background:#03080f;color:#c8cde0;font-family:'Barlow',sans-serif;-webkit-font-smoothing:antialiased}
          select{appearance:none}
          @keyframes spin{to{transform:rotate(360deg)}}
          @keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
          .dim-row:hover{background:rgba(255,255,255,.02)!important}
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
          <a href="/trade" style={{ ...s.navLink, color: '#00c2a8' }}>Trade Analyzer</a>
        </div>
      </nav>

      {/* HERO */}
      <div style={s.hero}>
        <div style={s.heroBg} />
        <div style={s.heroContent}>
          <div style={s.heroLabel}>AI-POWERED</div>
          <div style={s.heroTitle}>Trade Analyzer</div>
          <div style={s.heroSub}>
            Powered by Claude AI — evaluates trades across 10 dimensions simultaneously
          </div>

          {/* Mode toggle */}
          <div style={s.modeWrap}>
            <button onClick={() => setMode('reallife')}
              style={{ ...s.modeBtn, ...(mode === 'reallife' ? s.modeBtnActive : {}) }}>
              <span style={{ fontSize: '1.1rem' }}>⚾</span>
              <div>
                <div style={{ fontWeight: 700 }}>Real-Life</div>
                <div style={{ fontSize: '.7rem', opacity: .7 }}>WAR, contracts, prospects, windows</div>
              </div>
            </button>
            <button onClick={() => setMode('fantasy')}
              style={{ ...s.modeBtn, ...(mode === 'fantasy' ? { ...s.modeBtnActive, borderColor: '#8b74c4', background: 'rgba(139,116,196,.12)', color: '#f0f2f8' } : {}) }}>
              <span style={{ fontSize: '1.1rem' }}>🎮</span>
              <div>
                <div style={{ fontWeight: 700 }}>Fantasy</div>
                <div style={{ fontSize: '.7rem', opacity: .7 }}>Stats, roles, positional scarcity</div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* INPUT AREA */}
      {!result && (
        <div style={s.inputSection}>
          <div style={s.inputGrid}>

            {/* Team A */}
            <div style={s.tradeBox}>
              <div style={{ ...s.tradeBoxHeader, borderColor: colorA }}>
                <div style={{ ...s.tradeBoxLabel, color: colorA }}>TEAM A RECEIVES</div>
                <select value={teamAName} onChange={e => setTeamAName(e.target.value)}
                  style={{ ...s.teamSelect, borderColor: colorA + '44', color: teamAName ? '#f0f2f8' : '#5c6070' }}>
                  <option value="">Select team (optional)</option>
                  {MLB_TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <PlayerInput
                value={teamAGets} onChange={setTeamAGets} color={colorA}
                placeholder={`Type any players, prospects, or picks...\n\nExamples:\n• Bryce Harper (1B/OF, 32, $27M/yr)\n• Dylan Crews (Top prospect)\n• 2026 1st round pick\n\nNo dropdown — just type freely!`}
              />
            </div>

            {/* Swap arrow */}
            <div style={s.swapCol}>
              <div style={s.swapIcon}>⇄</div>
            </div>

            {/* Team B */}
            <div style={s.tradeBox}>
              <div style={{ ...s.tradeBoxHeader, borderColor: colorB }}>
                <div style={{ ...s.tradeBoxLabel, color: colorB }}>TEAM B RECEIVES</div>
                <select value={teamBName} onChange={e => setTeamBName(e.target.value)}
                  style={{ ...s.teamSelect, borderColor: colorB + '44', color: teamBName ? '#f0f2f8' : '#5c6070' }}>
                  <option value="">Select team (optional)</option>
                  {MLB_TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <PlayerInput
                value={teamBGets} onChange={setTeamBGets} color={colorB}
                placeholder={`Type any players, prospects, or picks...\n\nExamples:\n• Aaron Judge (OF, 33, $40M/yr)\n• 2025 1st round pick\n• Cash considerations\n\nNo dropdown — just type freely!`}
              />
            </div>
          </div>

          {/* Context */}
          <div style={s.contextWrap}>
            <div style={s.contextLabel}>ADDITIONAL CONTEXT <span style={{ color:'#3a3f52', fontWeight:400, letterSpacing:0 }}>(optional)</span></div>
            <textarea
              value={context} onChange={e => setContext(e.target.value)}
              placeholder="Add any relevant context: team's playoff positioning, salary cap situation, prospect rankings, injury history, league type (if fantasy: H2H, roto, keeper, dynasty), scoring settings..."
              rows={3}
              style={{ width:'100%', background:'#080c12', border:'1px solid #1e2028', borderRadius:'8px', color:'#f0f2f8', fontFamily:"'Barlow',sans-serif", fontSize:'.84rem', padding:'.75rem 1rem', resize:'vertical', outline:'none', lineHeight:1.6 }}
            />
          </div>

          {error && <div style={s.errorBox}>{error}</div>}

          <button onClick={analyze} disabled={loading} style={{ ...s.analyzeBtn, opacity: loading ? .6 : 1, cursor: loading ? 'wait' : 'pointer' }}>
            {loading ? (
              <span style={{ display:'flex', alignItems:'center', gap:'.75rem', justifyContent:'center' }}>
                <span style={{ width:'18px', height:'18px', border:'2px solid #050608', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 1s linear infinite', display:'inline-block' }}/>
                Analyzing trade across {mode === 'fantasy' ? 'fantasy' : 'real-life'} dimensions…
              </span>
            ) : (
              `⚡ Analyze Trade — ${mode === 'fantasy' ? 'Fantasy Mode' : 'Real-Life Mode'}`
            )}
          </button>

          {loading && (
            <div style={{ textAlign:'center', color:'#3a3f52', fontSize:'.8rem', marginTop:'.75rem' }}>
              Claude is evaluating WAR projections, contract values, prospect grades, and more…
            </div>
          )}
        </div>
      )}

      {/* RESULTS */}
      {result && (
        <div style={s.results}>

          {/* Winner banner */}
          <div style={{ ...s.winnerBanner, borderColor: winnerColor, background: winnerColor + '10' }}>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.72rem', fontWeight:700, letterSpacing:'.2em', color:'#3a3f52', marginBottom:'.3rem' }}>
              {mode === 'fantasy' ? '🎮 FANTASY BASEBALL' : '⚾ REAL-LIFE'} ANALYSIS
            </div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'clamp(1.4rem,4vw,2rem)', color: winnerColor, letterSpacing:'.05em' }}>
              {result.verdict}
            </div>
            <div style={{ fontSize:'.88rem', color:'#b8bdd0', marginTop:'.6rem', lineHeight:1.7, maxWidth:'700px', margin:'.6rem auto 0' }}>
              {result.verdictDetail}
            </div>
          </div>

          {/* Grade cards */}
          <div style={s.gradeRow}>
            <div style={s.gradeCard}>
              <GradeCircle grade={result.teamAGrade} label={nameA} color={colorA} />
              <div style={{ marginTop:'1.25rem' }}>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.68rem', fontWeight:700, letterSpacing:'.15em', color: colorA, marginBottom:'.6rem' }}>
                  WHY {nameA.toUpperCase()} BENEFITS
                </div>
                {(result.teamABenefits ?? []).map((b, i) => (
                  <div key={i} style={s.benefitRow}>
                    <span style={{ color: colorA, flexShrink:0 }}>✓</span>
                    <span style={{ fontSize:'.84rem', color:'#b8bdd0' }}>{b}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={s.riskCard}>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.68rem', fontWeight:700, letterSpacing:'.2em', color:'#e63535', marginBottom:'.5rem' }}>
                ⚠ BIGGEST RISK
              </div>
              <div style={{ fontSize:'.86rem', color:'#b8bdd0', lineHeight:1.6 }}>{result.biggestRisk}</div>
              <div style={{ borderTop:'1px solid #1e2028', marginTop:'1rem', paddingTop:'1rem' }}>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.68rem', fontWeight:700, letterSpacing:'.2em', color:'#8b74c4', marginBottom:'.5rem' }}>
                  📜 HISTORICAL COMP
                </div>
                <div style={{ fontSize:'.84rem', color:'#b8bdd0', lineHeight:1.6, fontStyle:'italic' }}>{result.historicalComp}</div>
              </div>
            </div>

            <div style={s.gradeCard}>
              <GradeCircle grade={result.teamBGrade} label={nameB} color={colorB} />
              <div style={{ marginTop:'1.25rem' }}>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.68rem', fontWeight:700, letterSpacing:'.15em', color: colorB, marginBottom:'.6rem' }}>
                  WHY {nameB.toUpperCase()} BENEFITS
                </div>
                {(result.teamBBenefits ?? []).map((b, i) => (
                  <div key={i} style={s.benefitRow}>
                    <span style={{ color: colorB, flexShrink:0 }}>✓</span>
                    <span style={{ fontSize:'.84rem', color:'#b8bdd0' }}>{b}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 10-dimension breakdown */}
          <div style={s.dimSection}>
            <div style={s.secLabel}>
              10-DIMENSION BREAKDOWN
              <span style={{ color:'#3a3f52', fontWeight:400, letterSpacing:0, fontSize:'.72rem', marginLeft:'.75rem' }}>
                Click any row to expand analysis
              </span>
            </div>

            {/* Header row */}
            <div style={s.dimHeader}>
              <div style={{ flex:1 }} />
              <div style={{ ...s.dimTeamLabel, color: colorA }}>{nameA}</div>
              <div style={{ width:'1px', background:'#1e2028' }} />
              <div style={{ ...s.dimTeamLabel, color: colorB }}>{nameB}</div>
            </div>

            {(result.dimensions ?? []).map((dim, i) => {
              const isOpen = expanded[i];
              const aWins  = dim.teamAScore > dim.teamBScore;
              const bWins  = dim.teamBScore > dim.teamAScore;
              return (
                <div key={i} className="dim-row"
                  onClick={() => setExpanded(p => ({ ...p, [i]: !p[i] }))}
                  style={{ ...ds.dimRow, cursor:'pointer', borderBottom:'1px solid #0f1018' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'.5rem', marginBottom:'.5rem' }}>
                    <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.68rem', fontWeight:700, letterSpacing:'.12em', color:'#00c2a8', background:'rgba(0,194,168,.08)', borderRadius:'3px', padding:'.1rem .4rem' }}>
                      {String(i+1).padStart(2,'0')}
                    </span>
                    <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:'.88rem', color:'#f0f2f8' }}>
                      {dim.name}
                    </span>
                    <span style={{ marginLeft:'auto', color:'#3a3f52', fontSize:'.75rem' }}>{isOpen ? '▲' : '▼'}</span>
                  </div>
                  <ScoreBar
                    scoreA={dim.teamAScore} scoreB={dim.teamBScore}
                    colorA={colorA} colorB={colorB}
                  />
                  {isOpen && (
                    <div style={{ marginTop:'.75rem', fontSize:'.84rem', color:'#b8bdd0', lineHeight:1.7, padding:'.75rem 1rem', background:'#080c12', borderRadius:'6px', animation:'fadeIn .2s ease' }}>
                      {dim.analysis}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Analyze another */}
          <div style={{ textAlign:'center', marginTop:'2rem' }}>
            <button onClick={reset} style={s.resetBtn}>
              ↩ Analyze Another Trade
            </button>
          </div>
        </div>
      )}

      <footer style={s.footer}>
        Powered by <span style={{ color:'#00c2a8' }}>Claude AI</span> · Data via MLB Stats API · Coach.com
      </footer>
    </>
  );
}

const s = {
  nav:           { position:'sticky',top:0,zIndex:200,background:'rgba(3,8,15,.96)',backdropFilter:'blur(16px)',borderBottom:'1px solid #1e2028',height:'54px',display:'flex',alignItems:'center',padding:'0 1.5rem',gap:'1rem' },
  logo:          { fontFamily:"'Bebas Neue',sans-serif",fontSize:'1.5rem',letterSpacing:'.08em',color:'#f0f2f8',textDecoration:'none',flexShrink:0 },
  navLinks:      { display:'flex',gap:'1.5rem',marginLeft:'auto' },
  navLink:       { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.82rem',fontWeight:700,letterSpacing:'.12em',textTransform:'uppercase',color:'#5c6070',textDecoration:'none' },
  hero:          { position:'relative',padding:'3.5rem 1.5rem 3rem',textAlign:'center',overflow:'hidden',background:'linear-gradient(135deg,#050608 0%,#0a0f1a 50%,#050608 100%)' },
  heroBg:        { position:'absolute',inset:0,backgroundImage:'radial-gradient(ellipse at 50% 0%,rgba(0,194,168,.07) 0%,transparent 60%)',pointerEvents:'none' },
  heroContent:   { position:'relative',zIndex:1 },
  heroLabel:     { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.72rem',fontWeight:700,letterSpacing:'.3em',color:'#00c2a8',marginBottom:'.4rem' },
  heroTitle:     { fontFamily:"'Bebas Neue',sans-serif",fontSize:'clamp(3rem,8vw,5.5rem)',letterSpacing:'.06em',color:'#f0f2f8',lineHeight:1 },
  heroSub:       { fontSize:'.9rem',color:'#5c6070',marginTop:'.4rem',marginBottom:'2rem' },
  modeWrap:      { display:'inline-flex',gap:'.75rem',background:'#080c12',border:'1px solid #1e2028',borderRadius:'10px',padding:'.5rem' },
  modeBtn:       { display:'flex',alignItems:'center',gap:'.65rem',padding:'.65rem 1.1rem',borderRadius:'7px',border:'1px solid transparent',background:'transparent',color:'#5c6070',cursor:'pointer',fontFamily:"'Barlow',sans-serif",fontSize:'.84rem',transition:'all .2s',textAlign:'left' },
  modeBtnActive: { borderColor:'#00c2a8',background:'rgba(0,194,168,.1)',color:'#f0f2f8' },
  inputSection:  { maxWidth:'960px',margin:'0 auto',padding:'2rem 1.5rem' },
  inputGrid:     { display:'grid',gridTemplateColumns:'1fr 40px 1fr',gap:'0',marginBottom:'1rem',alignItems:'start' },
  tradeBox:      { background:'#0d1117',border:'1px solid #1e2028',borderRadius:'10px',overflow:'hidden' },
  tradeBoxHeader:{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'.75rem 1rem',borderBottom:'1px solid',flexWrap:'wrap',gap:'.5rem' },
  tradeBoxLabel: { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.72rem',fontWeight:700,letterSpacing:'.22em' },
  teamSelect:    { background:'#050608',border:'1px solid',borderRadius:'4px',color:'#f0f2f8',fontFamily:"'Barlow',sans-serif",fontSize:'.78rem',padding:'.3rem .6rem',cursor:'pointer',outline:'none',maxWidth:'200px' },
  swapCol:       { display:'flex',alignItems:'center',justifyContent:'center',paddingTop:'3.5rem' },
  swapIcon:      { fontFamily:"'Bebas Neue',sans-serif",fontSize:'1.4rem',color:'#3a3f52' },
  contextWrap:   { marginBottom:'1.25rem' },
  contextLabel:  { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.68rem',fontWeight:700,letterSpacing:'.2em',color:'#3a3f52',marginBottom:'.4rem' },
  analyzeBtn:    { display:'block',width:'100%',padding:'1rem',background:'linear-gradient(135deg,#00c2a8,#00a896)',border:'none',borderRadius:'8px',color:'#050608',fontFamily:"'Bebas Neue',sans-serif",fontSize:'1.1rem',letterSpacing:'.1em',cursor:'pointer',transition:'opacity .2s',marginTop:'.5rem' },
  resetBtn:      { padding:'.65rem 1.5rem',background:'transparent',border:'1px solid #1e2028',borderRadius:'6px',color:'#5c6070',fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.82rem',fontWeight:700,letterSpacing:'.1em',cursor:'pointer',transition:'all .2s' },
  errorBox:      { background:'rgba(230,53,53,.1)',border:'1px solid rgba(230,53,53,.3)',borderRadius:'6px',padding:'.75rem 1rem',color:'#e63535',fontSize:'.84rem',marginBottom:'1rem' },
  results:       { maxWidth:'960px',margin:'0 auto',padding:'2rem 1.5rem',animation:'fadeIn .3s ease' },
  winnerBanner:  { border:'1px solid',borderRadius:'12px',padding:'1.5rem 2rem',textAlign:'center',marginBottom:'1.5rem' },
  gradeRow:      { display:'grid',gridTemplateColumns:'1fr 1.2fr 1fr',gap:'1rem',marginBottom:'1.5rem' },
  gradeCard:     { background:'#0d1117',border:'1px solid #1e2028',borderRadius:'10px',padding:'1.25rem' },
  riskCard:      { background:'#0d1117',border:'1px solid #e6353544',borderRadius:'10px',padding:'1.25rem',borderTopColor:'#e63535' },
  benefitRow:    { display:'flex',gap:'.5rem',alignItems:'flex-start',marginBottom:'.4rem' },
  secLabel:      { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.72rem',fontWeight:700,letterSpacing:'.22em',color:'#00c2a8',marginBottom:'1rem',paddingBottom:'.5rem',borderBottom:'1px solid #1e2028' },
  dimSection:    { background:'#0d1117',border:'1px solid #1e2028',borderRadius:'10px',overflow:'hidden' },
  dimHeader:     { display:'flex',alignItems:'center',padding:'.5rem 1rem',background:'#080c12',borderBottom:'1px solid #1e2028',gap:'1rem' },
  dimTeamLabel:  { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.7rem',fontWeight:700,letterSpacing:'.12em',minWidth:'80px',textAlign:'center' },
  footer:        { borderTop:'1px solid #1e2028',padding:'1.4rem',textAlign:'center',fontSize:'.74rem',color:'#5c6070',marginTop:'3rem' },
};

// Sub-styles for dimension rows
const ds = {
  dimRow:      { padding:'1rem',borderBottom:'1px solid #0f1018',transition:'background .1s' },
  dimLabel:    { fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:'.82rem',color:'#f0f2f8',marginBottom:'.4rem' },
  dimBars:     { display:'grid',gridTemplateColumns:'1fr 1fr',gap:'2px' },
  barWrap:     { display:'flex',alignItems:'center',gap:'.5rem' },
  barTrack:    { flex:1,height:'6px',background:'#1e2028',borderRadius:'3px',overflow:'hidden',display:'flex' },
  barScore:    { fontFamily:"'Bebas Neue',sans-serif",fontSize:'.95rem',minWidth:'16px',textAlign:'center',flexShrink:0 },
  dimAnalysis: { fontSize:'.8rem',color:'#5c6070',marginTop:'.35rem',lineHeight:1.6,fontStyle:'italic' },
};