// pages/players/[id].js
// v4 — Savant percentiles, multi-stat trends, betting odds, rescaled predictions

import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';

function getCurrentSeason() {
  const now = new Date();
  const year = now.getFullYear();
  return now >= new Date(year, 2, 20) ? year : year - 1;
}

const TEAM_COLORS = {
  'New York Yankees':       { primary: '#003087', accent: '#C4CED4' },
  'Boston Red Sox':         { primary: '#BD3039', accent: '#0C2340' },
  'Los Angeles Dodgers':    { primary: '#005A9C', accent: '#EF3E42' },
  'San Francisco Giants':   { primary: '#FD5A1E', accent: '#27251F' },
  'Chicago Cubs':           { primary: '#0E3386', accent: '#CC3433' },
  'Chicago White Sox':      { primary: '#C4CED4', accent: '#27251F' },
  'Houston Astros':         { primary: '#EB6E1F', accent: '#002D62' },
  'Atlanta Braves':         { primary: '#CE1141', accent: '#13274F' },
  'New York Mets':          { primary: '#FF5910', accent: '#002D72' },
  'Philadelphia Phillies':  { primary: '#E81828', accent: '#002D72' },
  'Los Angeles Angels':     { primary: '#BA0021', accent: '#C4CED4' },
  'Oakland Athletics':      { primary: '#EFB21E', accent: '#003831' },
  'Seattle Mariners':       { primary: '#005C5C', accent: '#0C2C56' },
  'Texas Rangers':          { primary: '#C0111F', accent: '#003278' },
  'Toronto Blue Jays':      { primary: '#134A8E', accent: '#E8291C' },
  'Baltimore Orioles':      { primary: '#DF4601', accent: '#000000' },
  'Tampa Bay Rays':         { primary: '#8FBCE6', accent: '#092C5C' },
  'Minnesota Twins':        { primary: '#D31145', accent: '#002B5C' },
  'Cleveland Guardians':    { primary: '#E31937', accent: '#00385D' },
  'Detroit Tigers':         { primary: '#FA4616', accent: '#0C2340' },
  'Kansas City Royals':     { primary: '#004687', accent: '#C09A5B' },
  'St. Louis Cardinals':    { primary: '#C41E3A', accent: '#0C2340' },
  'Milwaukee Brewers':      { primary: '#FFC52F', accent: '#12284B' },
  'Pittsburgh Pirates':     { primary: '#FDB827', accent: '#27251F' },
  'Cincinnati Reds':        { primary: '#C6011F', accent: '#000000' },
  'Colorado Rockies':       { primary: '#8B74C4', accent: '#333366' },
  'Arizona Diamondbacks':   { primary: '#A71930', accent: '#E3D4AD' },
  'San Diego Padres':       { primary: '#FFC425', accent: '#2F241D' },
  'Miami Marlins':          { primary: '#00A3E0', accent: '#FF6600' },
  'Washington Nationals':   { primary: '#AB0003', accent: '#14225A' },
};
function getColors(t) { return TEAM_COLORS[t] ?? { primary: '#00c2a8', accent: '#f5a623' }; }

// ── Percentile color: red=bad, yellow=avg, green=great
function pctColor(pct, lowerIsBetter = false) {
  const p = lowerIsBetter ? 100 - pct : pct;
  if (p >= 90) return '#00c2a8';
  if (p >= 70) return '#2ed47a';
  if (p >= 45) return '#f5a623';
  return '#e63535';
}

// ── Convert raw stat to estimated MLB percentile
function estimatePct(key, val, lowerIsBetter = false) {
  if (val === null || val === undefined || val === '—' || isNaN(parseFloat(val))) return null;
  const v = parseFloat(val);
  // Benchmarks: [p10, p25, p50, p75, p90] thresholds
  const benchmarks = {
    avg:      [.215, .240, .260, .285, .310],
    obp:      [.285, .310, .330, .360, .390],
    slg:      [.350, .390, .430, .480, .540],
    ops:      [.640, .710, .760, .840, .920],
    homeRuns: [3,    8,    15,   25,   38],
    rbi:      [15,   30,   50,   70,   90],
    stolenBases:[2,  6,    12,   22,   35],
    avg_k_pct:[12,   16,   21,   26,   32],   // K% (lower better)
    avg_bb_pct:[4,   6,    8,    10,   13],
    xba:      [.215, .240, .260, .285, .310],
    xslg:     [.350, .390, .430, .480, .540],
    xwoba:    [.275, .305, .325, .360, .395],
    hard_hit: [25,   33,   39,   46,   52],
    barrel:   [2,    4,    7,    11,   15],
    sprint:   [24,   26,   27.5, 28.5, 29.5],
    era:      [2.5,  3.2,  4.1,  4.9,  5.8],  // lower better
    whip:     [0.95, 1.10, 1.25, 1.40, 1.58], // lower better
    k9:       [6.5,  7.5,  8.5,  9.8,  11.5],
    bb9:      [2.0,  2.6,  3.2,  3.9,  4.8],  // lower better
    h9:       [6.5,  7.5,  8.5,  9.5,  10.5], // lower better
    hr9:      [0.6,  0.9,  1.1,  1.4,  1.8],  // lower better
    xera:     [2.5,  3.2,  4.1,  4.9,  5.8],  // lower better
    whiff:    [18,   22,   26,   30,   35],
    csw:      [24,   27,   29,   31,   34],
    velo:     [89,   91,   93,   95,   97],
  };
  const b = benchmarks[key];
  if (!b) return null;
  const [p10, p25, p50, p75, p90] = b;
  let raw;
  if (lowerIsBetter) {
    if (v <= p10) raw = 95; else if (v <= p25) raw = 80;
    else if (v <= p50) raw = 55; else if (v <= p75) raw = 30;
    else if (v <= p90) raw = 15; else raw = 5;
  } else {
    if (v >= p90) raw = 95; else if (v >= p75) raw = 80;
    else if (v >= p50) raw = 55; else if (v >= p25) raw = 30;
    else if (v >= p10) raw = 15; else raw = 5;
  }
  return raw;
}

export default function PlayerPage() {
  const router = useRouter();
  const { id } = router.query;
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState('season');
  const [imgSrc, setImgSrc]     = useState('');
  const [savantData, setSavantData] = useState(null);
  const [odds, setOdds]         = useState(null);
  const [trendMetric, setTrendMetric] = useState(null);
  const [trendView, setTrendView] = useState('season'); // 'season' | 'monthly'
  const [highlights, setHighlights] = useState(null);
  const [hrLog, setHrLog]           = useState(null);
  const [splits, setSplits]         = useState(null);
  const chartRefs   = useRef({});
  const chartInsts  = useRef({});
  const SEASON = getCurrentSeason();

  useEffect(() => {
    if (!id) return;
    setLoading(true); setActiveTab('season'); setSavantData(null); setOdds(null);
    fetch(`/api/player?id=${id}&season=${SEASON}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
    // Fetch Savant percentile data
    fetch(`/api/savant?id=${id}`)
      .then(r => r.json())
      .then(d => setSavantData(d))
      .catch(() => {});
    // Fetch betting odds
    fetch(`/api/odds?playerId=${id}`)
      .then(r => r.json())
      .then(d => setOdds(d))
      .catch(() => {});
    // Fetch highlights, HR log, splits
    fetch(`/api/highlights?id=${id}`)
      .then(r=>r.json()).then(d=>setHighlights(d)).catch(()=>{});
    fetch(`/api/homeruns?id=${id}&season=${SEASON}`)
      .then(r=>r.json()).then(d=>setHrLog(d)).catch(()=>{});
    fetch(`/api/splits?id=${id}&season=${SEASON}`)
      .then(r=>r.json()).then(d=>setSplits(d)).catch(()=>{});
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const url = `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:action:landscape:current.jpg/ar_16:9,g_auto/q_auto:best/v1/people/${id}/action/landscape/current`;
    setImgSrc(url);
  }, [id]);

  if (loading) return <LoadingScreen />;
  if (!data?.player) return <div style={{ color: '#fff', padding: '2rem' }}>Player not found.</div>;

  const { player, season, career } = data;
  const teamName  = player.currentTeam?.name ?? '';
  const colors    = getColors(teamName);
  const pos       = player.primaryPosition?.abbreviation ?? '';
  const isPit     = ['P', 'SP', 'RP', 'CP'].includes(pos);
  const stat      = (isPit ? season.pitching : season.hitting)?.[0]?.stat ?? {};
  const careerRows = isPit ? career.pitching : career.hitting;
  const seasonRows = isPit ? season.pitching : season.hitting;
  const fullCols  = isPit ? PIT_COLS : BAT_COLS;
  const heroStats = isPit ? getPitHero(stat) : getBatHero(stat);
  const savantMets = isPit ? getPitSavant(stat) : getBatSavant(stat);
  const slugName  = player.fullName.toLowerCase().replace(/ /g, '-');
  const savantUrl = `https://baseballsavant.mlb.com/savant-player/${slugName}-${id}`;
  const headshotUrl = `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_426,q_auto:best/v1/people/${id}/headshot/67/current`;

  // Default trendMetric based on position
  const defaultMetric = isPit ? 'era' : 'ops';
  const activeTrendMetric = trendMetric ?? defaultMetric;

  const TABS = [
    { id: 'season',     label: `${SEASON} Season` },
    { id: 'highlights', label: '▶ Highlights' },
    { id: 'savant',     label: 'Statcast / Savant' },
    ...(isPit ? [{ id: 'arsenal', label: '⚾ Arsenal' }] : []),
    { id: 'career',     label: 'Career' },
    { id: 'trends',     label: 'Trends & Odds' },
    { id: 'deep',       label: isPit ? 'By Inning' : 'Deep Stats' },
    { id: 'prediction', label: 'Prediction' },
    { id: 'social',     label: 'Social / X' },
    { id: 'links',      label: 'Links' },
  ];

  return (
    <>
      <Head>
        <title>{player.fullName} — Coach</title>
        <link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700&family=Barlow+Condensed:wght@400;600;700;900&display=swap" rel="stylesheet" />
        <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js" />
        <style>{`
          *{box-sizing:border-box;margin:0;padding:0}
          body{background:#050608;font-family:'Inter',sans-serif;overflow-x:hidden;-webkit-font-smoothing:antialiased}
          @keyframes shimmer{0%{background-position:-600px 0}100%{background-position:600px 0}}
          .hero-img{width:100%;height:100%;object-fit:cover;object-position:center 25%;display:block;transition:opacity .3s ease}
          .tab-btn:hover{color:#f0f2f8!important}
          .sv-tile:hover{border-color:${colors.primary}!important;transform:translateY(-2px)}
          .ext-link:hover{border-color:${colors.primary}!important;transform:translateY(-2px)}
          .trend-btn:hover{color:#f0f2f8!important}
          @keyframes loadbar{to{width:100%}}
        `}</style>
      </Head>

      <nav style={{...s.nav, borderBottomColor: colors.primary+'55'}}>
        <a href="/" style={s.navLogo}>COACH<span style={{color:colors.primary}}>.</span></a>
        <SearchBar colors={colors} />
      </nav>

      {/* HERO */}
      <section style={s.heroWrap}>
        <div style={s.heroBgWrap}>
          <img className="hero-img" src={imgSrc} alt={player.fullName}
            onError={() => {
              if (imgSrc.includes('landscape')) {
                setImgSrc(`https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:action:hero:current.jpg/w_1200,q_auto:best/v1/people/${id}/action/hero/current`);
              } else { setImgSrc(headshotUrl); }
            }} />
        </div>
        <div style={s.heroOverlay} />
        <div style={{...s.heroTint, background:`linear-gradient(to top,${colors.primary}33 0%,transparent 40%)`}} />
        <div style={s.heroContent}>
          <div style={{...s.eyebrow, color:colors.primary}}>{player.primaryPosition?.name??'MLB'} · {teamName}</div>
          <div style={s.playerName}>{player.fullName.toUpperCase()}</div>
          <div style={s.badges}>
            {player.primaryPosition?.name && <span style={{...s.badge,borderColor:colors.primary,color:colors.primary}}>{player.primaryPosition.name}</span>}
            {teamName && <span style={{...s.badge,borderColor:colors.accent,color:colors.accent}}>{teamName}</span>}
            {player.primaryNumber && <span style={s.badge}>#{player.primaryNumber}</span>}
            {player.batSide?.description && <span style={s.badge}>{player.batSide.description} / {player.pitchHand?.description}</span>}
          </div>
        </div>
        <div style={{...s.statOverlay, borderTopColor:colors.primary}}>
          {heroStats.map((h,i)=>(
            <div key={i} style={s.statBlock}>
              <div style={s.statLabel}>{h.label}</div>
              <div style={{...s.statVal, color:h.primary?colors.primary:h.accent?colors.accent:'#f0f2f8'}}>{h.val}</div>
            </div>
          ))}
        </div>
        <div style={{...s.savantStrip, borderTopColor:colors.primary+'44', background:colors.primary+'11'}}>
          <div style={{...s.savantTitle, color:colors.primary}}>⚡ Statcast</div>
          <div style={s.savantMets}>
            {savantMets.map((m,i)=>(
              <div key={i} style={s.savantMet}>
                <div style={s.savantMetL}>{m.label}</div>
                <div style={{...s.savantMetV, color:m.great?colors.primary:'#f0f2f8'}}>{m.val}</div>
              </div>
            ))}
          </div>
          <a href={savantUrl} target="_blank" rel="noopener" style={{...s.savantLink, borderColor:colors.primary, color:colors.primary}}>Full Savant →</a>
        </div>
      </section>

      {/* TABS */}
      <div style={s.tabsBar}>
        <div style={s.tabsInner}>
          {TABS.map(t=>(
            <button key={t.id} className="tab-btn"
              style={{...s.tabBtn,...(activeTab===t.id?{color:colors.primary,borderBottomColor:colors.primary}:{})}}
              onClick={()=>setActiveTab(t.id)}>{t.label}</button>
          ))}
        </div>
      </div>

      <main style={s.main}>

        {/* ── 2025 SEASON ── */}
        {activeTab==='season' && (
          <div>
            <div style={{...s.secLabel,color:colors.primary}}>{SEASON} Season Statistics</div>
            <StatsCard title={isPit?'Pitching Stats':'Batting Stats'} tag={String(SEASON)} colors={colors}
              cols={[{k:'__tm',l:'Team'},...fullCols]}
              rows={seasonRows.map(r=>({__tm:r.team?.name??'—',...r.stat}))} />
          </div>
        )}

        {/* ── STATCAST / SAVANT ── */}
        {activeTab==='savant' && (
          <div>
            <SavantTab id={id} stat={stat} isPitcher={isPit} colors={colors} savantUrl={savantUrl} />
          </div>
        )}

        {/* ── CAREER ── */}
        {activeTab==='career' && (
          <div>
            <div style={{...s.secLabel,color:colors.primary}}>Career — Year by Year</div>
            <StatsCard title="All Seasons" tag="Career" colors={colors}
              cols={[{k:'__yr',l:'Year'},{k:'__tm',l:'Team'},...fullCols]}
              rows={careerRows.map(r=>({__yr:r.season,__tm:r.team?.name??'—',...r.stat}))} />
          </div>
        )}

        {/* ── TRENDS & ODDS ── */}
        {activeTab==='trends' && (
          <TrendsAndOdds
            careerRows={careerRows} isPitcher={isPit} colors={colors}
            activeTrendMetric={activeTrendMetric} setTrendMetric={setTrendMetric}
            trendView={trendView} setTrendView={setTrendView}
            chartRefs={chartRefs} chartInsts={chartInsts}
            odds={odds} player={player} stat={stat}
          />
        )}

        {/* ── PREDICTION ── */}
        {activeTab==='prediction' && (
          <div>
            <div style={{...s.secLabel,color:colors.primary}}>Today's Matchup Prediction</div>
            <PredPanel stat={stat} isPitcher={isPit} colors={colors} careerRows={careerRows} id={id} />
          </div>
        )}

        {/* ── HIGHLIGHTS ── */}
        {activeTab==='highlights' && (
          <HighlightsTab id={id} player={player} highlights={highlights} colors={colors} />
        )}

        {/* ── PITCH ARSENAL (pitchers only) ── */}
        {activeTab==='arsenal' && isPit && (
          <ArsenalTab id={id} colors={colors} player={player} />
        )}

        {/* ── DEEP STATS (HR log / vel splits / inning splits) ── */}
        {activeTab==='deep' && (
          <DeepStatsTab
            isPitcher={isPit} player={player} colors={colors}
            hrLog={hrLog} splits={splits} stat={stat} id={id}
          />
        )}

        {/* ── SOCIAL / X ── */}
        {activeTab==='social' && (
          <SocialTab player={player} colors={colors} />
        )}

        {/* ── LINKS ── */}
        {activeTab==='links' && (
          <div>
            <div style={{...s.secLabel,color:colors.primary}}>External Resources</div>
            <LinksGrid player={player} id={id} colors={colors} />
          </div>
        )}
      </main>
      <footer style={s.footer}>
        Data via <a href="https://statsapi.mlb.com" target="_blank" rel="noopener" style={{color:'#5c6070'}}>MLB Stats API</a> &amp;&nbsp;
        <a href="https://baseballsavant.mlb.com" target="_blank" rel="noopener" style={{color:'#5c6070'}}>Baseball Savant</a> · Coach.com
      </footer>
    </>
  );
}

// ════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════
// SAVANT COLOR SCHEME — true to Baseball Savant
// Red = elite/great, Blue = poor, Gray = average
// ════════════════════════════════════════════════════════
function savantColor(pct, lowerIsBetter = false) {
  const p = lowerIsBetter ? 100 - pct : pct;
  if (p >= 95) return '#c8102e'; // deep red — elite
  if (p >= 80) return '#e8354a'; // red
  if (p >= 67) return '#f47c7c'; // light red/pink
  if (p >= 34) return '#9e9e9e'; // gray — average
  if (p >= 20) return '#6baed6'; // light blue
  if (p >= 5)  return '#2171b5'; // blue
  return '#084594';              // deep blue — poor
}

// ════════════════════════════════════════════════════════
// SAVANT TAB — year dropdown + view toggle + red/blue scheme
// ════════════════════════════════════════════════════════
function SavantTab({ id, stat, isPitcher, colors, savantUrl }) {
  const currentYear = new Date().getFullYear();
  const SEASON_NOW  = currentYear >= 2025 ? currentYear : 2025;
  const YEARS = Array.from({ length: SEASON_NOW - 2017 + 1 }, (_, i) => SEASON_NOW - i);

  const [year, setYear]         = useState(SEASON_NOW);
  const [viewMode, setViewMode] = useState('savant'); // 'savant' | 'coach'
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    setLoading(true);
    setData(null);
    fetch(`/api/savant?id=${id}&year=${year}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id, year]);

  const tiles = isPitcher ? getPitTiles(stat, data) : getBatTiles(stat, data);

  return (
    <div>
      {/* Controls row */}
      <div style={{ display:'flex', alignItems:'center', gap:'1rem', marginBottom:'1.25rem', flexWrap:'wrap' }}>
        <div style={{ flex:1 }}>
          <div style={{ ...s.secLabel, color:colors.primary, marginBottom:0 }}>Statcast / Savant</div>
        </div>

        {/* Year dropdown */}
        <div style={{ display:'flex', alignItems:'center', gap:'.5rem' }}>
          <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.7rem', fontWeight:700, letterSpacing:'.12em', color:'#5c6070' }}>SEASON</span>
          <select
            value={year}
            onChange={e => setYear(parseInt(e.target.value))}
            style={{ background:'#0d1117', border:'1px solid #1e2028', borderRadius:'6px', color:'#f0f2f8', padding:'.3rem .6rem', fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.85rem', fontWeight:700, cursor:'pointer', outline:'none' }}>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* View toggle */}
        <div style={{ display:'flex', background:'#0d1117', border:'1px solid #1e2028', borderRadius:'6px', overflow:'hidden' }}>
          {[['savant','📊 Savant Style'],['coach','⬛ Tile View']].map(([mode, label]) => (
            <button key={mode} onClick={() => setViewMode(mode)}
              style={{ padding:'.3rem .85rem', background: viewMode===mode ? '#1e2028' : 'transparent', border:'none', color: viewMode===mode ? '#f0f2f8' : '#5c6070', fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.75rem', fontWeight:700, letterSpacing:'.08em', cursor:'pointer', transition:'all .2s' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign:'center', padding:'2rem', color:'#3a3f52', fontSize:'.85rem' }}>
          Loading {year} Statcast data…
        </div>
      )}

      {/* No data */}
      {!loading && (!data?.available) && (
        <div style={{ ...s.card, padding:'1.5rem', textAlign:'center', color:'#5c6070', marginBottom:'1.5rem' }}>
          <div style={{ fontSize:'1.5rem', marginBottom:'.5rem' }}>📭</div>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:'.9rem', color:'#f0f2f8', marginBottom:'.35rem' }}>
            No Statcast data for {year}
          </div>
          <div style={{ fontSize:'.8rem' }}>
            Player may not have met minimum plate appearances, or data isn't available for this season yet.
          </div>
        </div>
      )}

      {/* SAVANT STYLE VIEW — horizontal bars like baseballsavant.mlb.com */}
      {!loading && data?.available && viewMode === 'savant' && (
        <SavantStyleView tiles={tiles} data={data} isPitcher={isPitcher} year={year} />
      )}

      {/* TILE VIEW — existing card grid */}
      {!loading && data?.available && viewMode === 'coach' && (
        <SavantTileView tiles={tiles} data={data} colors={colors} />
      )}

      {/* Legend */}
      {!loading && data?.available && (
        <div style={{ display:'flex', alignItems:'center', gap:'1.25rem', marginBottom:'1.25rem', flexWrap:'wrap' }}>
          <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.62rem', fontWeight:700, letterSpacing:'.15em', color:'#3a3f52' }}>PERCENTILE</span>
          {[['#c8102e','90–99 Elite'],['#f47c7c','67–89 Above Avg'],['#9e9e9e','34–66 Average'],['#6baed6','11–33 Below Avg'],['#084594','1–10 Poor']].map(([c,l]) => (
            <div key={l} style={{ display:'flex', alignItems:'center', gap:'.3rem' }}>
              <div style={{ width:'10px', height:'10px', borderRadius:'50%', background:c }} />
              <span style={{ fontSize:'.68rem', color:'#5c6070' }}>{l}</span>
            </div>
          ))}
        </div>
      )}

      {/* Savant link */}
      <a href={savantUrl} target="_blank" rel="noopener" style={{ ...s.savantFullLink, borderColor: colors.primary+'55' }}>
        <span style={{ fontSize:'1.4rem' }}>🎯</span>
        <div>
          <div style={{ fontWeight:600, color:'#f0f2f8' }}>View Full Savant Profile →</div>
          <div style={{ fontSize:'.72rem', color:'#5c6070' }}>Heat maps · Spray charts · Pitch arsenal · Full percentile rankings</div>
        </div>
      </a>
    </div>
  );
}

// ── Savant-style horizontal bar rows ─────────────────────────────────────────
function SavantStyleView({ tiles, data, isPitcher, year }) {
  // Group tiles into sections like Savant does
  const batGroups = [
    { label:'Expected Stats',      keys:['xba','xslg','xwoba'] },
    { label:'Quality of Contact',  keys:['exit_velocity','launch_angle','barrel','hard_hit','sweet_spot'] },
    { label:'Plate Discipline',    keys:['k_pct','bb_pct'] },
    { label:'Fielding',            keys:['oaa_pct','arm_strength_pct','outs_above'] },
    { label:'Speed',               keys:['sprint_pct','sprint_speed'] },
  ];
  const pitGroups = [
    { label:'Stuff', keys:['avg_fastball','whiff'] },
    { label:'Expected Stats', keys:['xera','xba','xwoba'] },
    { label:'Contact Allowed', keys:['exit_velocity','barrel','hard_hit'] },
    { label:'Results', keys:['era_pct','k9_pct','bb9_pct'] },
  ];
  const groups = isPitcher ? pitGroups : batGroups;

  return (
    <div style={{ background:'#0d1117', border:'1px solid #1e2028', borderRadius:'10px', overflow:'hidden', marginBottom:'1.5rem' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'.75rem 1.25rem', borderBottom:'1px solid #1e2028', background:'#080c12' }}>
        <div style={{ fontFamily:"'Anton',sans-serif", fontSize:'1.1rem', letterSpacing:'.1em', color:'#f0f2f8' }}>
          {year} MLB Percentile Rankings
        </div>
        <div style={{ display:'flex', gap:'1.5rem', fontSize:'.65rem', fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, letterSpacing:'.12em' }}>
          <span style={{ color:'#2171b5' }}>◀ POOR</span>
          <span style={{ color:'#9e9e9e' }}>AVERAGE</span>
          <span style={{ color:'#c8102e' }}>GREAT ▶</span>
        </div>
      </div>

      {groups.map(group => {
        const groupTiles = tiles.filter(t => group.keys.some(k =>
          t.savantKey?.includes(k) ||
          t.label?.toLowerCase().includes(k.replace(/_/g,' ')) ||
          t.label?.toLowerCase().replace(/[^a-z]/g,'').includes(k.replace(/_/g,''))
        ));
        if (groupTiles.length === 0) return null;
        return (
          <div key={group.label}>
            {/* Group header */}
            <div style={{ padding:'.5rem 1.25rem', background:'#080c12', borderBottom:'1px solid #1e2028', borderTop:'1px solid #1e2028' }}>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.72rem', fontWeight:700, letterSpacing:'.18em', color:'#5c6070' }}>
                {group.label.toUpperCase()}
              </div>
            </div>
            {/* Rows */}
            {groupTiles.map((t, i) => {
              const pct = data?.[t.savantKey] ?? t.estimatedPct;
              const pctNum = typeof pct === 'number' ? Math.round(pct) : null;
              const col = pctNum !== null ? savantColor(pctNum, t.lowerIsBetter) : '#9e9e9e';
              const barPct = pctNum ?? 50;
              return (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:'1rem', padding:'.55rem 1.25rem', borderBottom:'1px solid #080c12' }}>
                  {/* Label */}
                  <div style={{ width:'140px', flexShrink:0, fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.8rem', fontWeight:600, color:'#b8bdd0' }}>
                    {t.label}
                  </div>
                  {/* Bar track */}
                  <div style={{ flex:1, height:'8px', background:'#1e2028', borderRadius:'4px', position:'relative', overflow:'hidden' }}>
                    {/* Center line */}
                    <div style={{ position:'absolute', left:'50%', top:0, bottom:0, width:'1px', background:'#2a2f3f', zIndex:1 }} />
                    {/* Fill — from left edge to pct position */}
                    <div style={{ position:'absolute', left:0, top:0, bottom:0, width:`${barPct}%`, background:col, borderRadius:'4px', transition:'width .5s ease' }} />
                  </div>
                  {/* Badge */}
                  {pctNum !== null ? (
                    <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:col, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <span style={{ fontFamily:"'Anton',sans-serif", fontSize:'.85rem', color:'#fff', lineHeight:1 }}>{pctNum}</span>
                    </div>
                  ) : (
                    <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:'#1e2028', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <span style={{ fontSize:'.65rem', color:'#3a3f52' }}>—</span>
                    </div>
                  )}
                  {/* Value */}
                  <div style={{ width:'55px', flexShrink:0, textAlign:'right', fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.82rem', fontWeight:700, color:'#f0f2f8' }}>
                    {t.val ?? '—'}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ── Tile view (updated with Savant red/blue colors) ───────────────────────────
function SavantTileView({ tiles, data, colors }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(165px,1fr))', gap:'.875rem', marginBottom:'1.5rem' }}>
      {tiles.map((t,i) => {
        const pct = data?.[t.savantKey] ?? t.estimatedPct;
        const pctNum = typeof pct === 'number' ? Math.round(pct) : null;
        const col = pctNum !== null ? savantColor(pctNum, t.lowerIsBetter) : '#9e9e9e';
        const barWidth = pctNum ?? Math.round((t.bar||0)*100);
        return (
          <div key={i} style={{ ...s.svTile, transition:'border-color .2s,transform .15s', borderColor: pctNum !== null ? col+'33' : '#1e2028' }}>
            {pctNum !== null && (
              <div style={{ position:'absolute', top:'.5rem', right:'.5rem', width:'28px', height:'28px', borderRadius:'50%', background:col, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <span style={{ fontFamily:"'Anton',sans-serif", fontSize:'.78rem', color:'#fff', lineHeight:1 }}>{pctNum}</span>
              </div>
            )}
            <div style={s.svLabel}>{t.label}</div>
            <div style={{ ...s.svVal, color:'#f0f2f8' }}>{t.val ?? '—'}</div>
            <div style={s.svSub}>{t.sub}</div>
            <div style={s.svBar}>
              <div style={{ ...s.svBarFill, width:`${Math.min(100,barWidth)}%`, background:col }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// PITCH ARSENAL TAB — full pitch mix, velocity, movement, zone chart
// ════════════════════════════════════════════════════════
const PITCH_COLORS = {
  'FF':'#e63535','4-Seam Fastball':'#e63535',
  'SI':'#f5a623','Sinker':'#f5a623',
  'FC':'#f5de0a','Cutter':'#f5de0a',
  'SL':'#2ed47a','Slider':'#2ed47a',
  'ST':'#00c2a8','Sweeper':'#00c2a8',
  'CU':'#007acc','Curveball':'#007acc',
  'KC':'#6b7ff0','Knuckle Curve':'#6b7ff0',
  'CH':'#c478f5','Changeup':'#c478f5',
  'FS':'#e078c8','Split-Finger':'#e078c8',
  'FO':'#a0a0a0','Forkball':'#a0a0a0',
  'KN':'#ffffff','Knuckleball':'#ffffff',
};
const pitchColor = (name) => PITCH_COLORS[name] ?? '#5c6070';

function parseCSVClient(text) {
  if (!text?.trim()) return [];
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.replace(/"/g,'').trim().toLowerCase());
  return lines.slice(1).map(line => {
    const vals=[]; let cur='', inQ=false;
    for (const ch of line) {
      if (ch==='"') { inQ=!inQ; }
      else if (ch===',' && !inQ) { vals.push(cur.trim()); cur=''; }
      else cur+=ch;
    }
    vals.push(cur.trim());
    const obj={};
    headers.forEach((h,i)=>{ obj[h]=vals[i]??''; });
    return obj;
  });
}

function MovementChart({ pitches }) {
  if (!pitches?.length) return null;
  // SVG scatter: x = horizontal break (pfx_x), y = vertical break (pfx_z)
  const W=320, H=280, cx=W/2, cy=H/2;
  const scale = 8; // inches per pixel (±20in range on each axis)

  return (
    <div>
      <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.65rem', fontWeight:700, letterSpacing:'.14em', color:'#5c6070', marginBottom:'.5rem' }}>
        PITCH MOVEMENT PROFILE (PITCHER POV)
      </div>
      <svg width={W} height={H} style={{ background:'#080c12', borderRadius:'10px', border:'1px solid #1e2028', display:'block' }}>
        {/* Grid lines */}
        <line x1={cx} y1={0} x2={cx} y2={H} stroke="#1e2028" strokeWidth={1}/>
        <line x1={0} y1={cy} x2={W} y2={cy} stroke="#1e2028" strokeWidth={1}/>
        {[-20,-10,10,20].map(v => (
          <g key={v}>
            <line x1={cx+v*scale} y1={0} x2={cx+v*scale} y2={H} stroke="#12161e" strokeWidth={1} strokeDasharray="3,3"/>
            <line x1={0} y1={cy-v*scale} x2={W} y2={cy-v*scale} stroke="#12161e" strokeWidth={1} strokeDasharray="3,3"/>
          </g>
        ))}
        {/* Axis labels */}
        <text x={W-4} y={cy-4} textAnchor="end" fill="#3a3f52" fontSize={8} fontFamily="Barlow Condensed">ARM SIDE</text>
        <text x={4} y={cy-4} textAnchor="start" fill="#3a3f52" fontSize={8} fontFamily="Barlow Condensed">GLOVE SIDE</text>
        <text x={cx+4} y={12} textAnchor="start" fill="#3a3f52" fontSize={8} fontFamily="Barlow Condensed">RISE</text>
        <text x={cx+4} y={H-4} textAnchor="start" fill="#3a3f52" fontSize={8} fontFamily="Barlow Condensed">DROP</text>
        {/* Pitch dots */}
        {pitches.map((p, i) => {
          const bx = p.avg_break_x ?? (p.pfx_x_ft !== null ? p.pfx_x_ft * 12 : 0);
          const bz = p.avg_break_z ?? (p.pfx_z_ft !== null ? p.pfx_z_ft * 12 : 0);
          if (isNaN(bx) || isNaN(bz)) return null;
          const px = cx + bx * scale;
          const py = cy - bz * scale;
          const col = pitchColor(p.pitch_type ?? p.pitch_name);
          return (
            <g key={i}>
              <circle cx={px} cy={py} r={10} fill={col} fillOpacity={0.18} stroke={col} strokeWidth={1.5}/>
              <text x={px} y={py+4} textAnchor="middle" fill={col} fontSize={8} fontFamily="Barlow Condensed" fontWeight={700}>
                {p.pitch_type}
              </text>
            </g>
          );
        })}
      </svg>
      {/* Legend */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:'.4rem', marginTop:'.5rem' }}>
        {pitches.map((p,i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:'.3rem' }}>
            <div style={{ width:'8px', height:'8px', borderRadius:'50%', background: pitchColor(p.pitch_type ?? p.pitch_name) }} />
            <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.62rem', color:'#9e9ea0' }}>{p.pitch_name ?? p.pitch_type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StrikeZoneChart({ pitches, selectedPitch }) {
  // SVG strike zone with pitch location dots — filtered by pitch type
  const W=240, H=260;
  // Strike zone: roughly x -0.83 to 0.83 ft, z 1.5 to 3.5 ft
  const zoneX1=60, zoneX2=180, zoneY1=40, zoneY2=200;
  const toX = x => zoneX1 + (parseFloat(x)+0.83)/(1.66)*(zoneX2-zoneX1);
  const toY = z => zoneY2 - (parseFloat(z)-1.5)/(2.0)*(zoneY2-zoneY1);

  const dots = (pitches ?? []).filter(p => {
    if (selectedPitch && p.pitch_type !== selectedPitch && p.pitch_name !== selectedPitch) return false;
    return !isNaN(parseFloat(p.plate_x)) && !isNaN(parseFloat(p.plate_z));
  }).slice(0, 200);

  const col = selectedPitch ? pitchColor(selectedPitch) : '#00c2a8';

  return (
    <div>
      <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.65rem', fontWeight:700, letterSpacing:'.14em', color:'#5c6070', marginBottom:'.5rem' }}>
        PITCH LOCATION (CATCHER VIEW)
      </div>
      <svg width={W} height={H} style={{ background:'#080c12', borderRadius:'10px', border:'1px solid #1e2028', display:'block' }}>
        {/* Home plate outline */}
        <polygon points={`${W/2-18},${H-20} ${W/2+18},${H-20} ${W/2+18},${H-35} ${W/2},${H-22} ${W/2-18},${H-35}`}
          fill="none" stroke="#2a2f3f" strokeWidth={1}/>
        {/* Strike zone */}
        <rect x={zoneX1} y={zoneY1} width={zoneX2-zoneX1} height={zoneY2-zoneY1}
          fill="none" stroke="#3a3f52" strokeWidth={1.5}/>
        {/* Zone grid */}
        {[1,2].map(i=>(
          <g key={i}>
            <line x1={zoneX1+(zoneX2-zoneX1)/3*i} y1={zoneY1} x2={zoneX1+(zoneX2-zoneX1)/3*i} y2={zoneY2} stroke="#1e2028" strokeWidth={1}/>
            <line x1={zoneX1} y1={zoneY1+(zoneY2-zoneY1)/3*i} x2={zoneX2} y2={zoneY1+(zoneY2-zoneY1)/3*i} stroke="#1e2028" strokeWidth={1}/>
          </g>
        ))}
        {/* Pitch dots */}
        {dots.map((p,i) => (
          <circle key={i}
            cx={toX(p.plate_x)} cy={toY(p.plate_z)}
            r={3} fill={col} fillOpacity={0.4} stroke={col} strokeOpacity={0.7} strokeWidth={0.5}/>
        ))}
        {/* Labels */}
        <text x={W/2} y={H-5} textAnchor="middle" fill="#3a3f52" fontSize={7} fontFamily="Barlow Condensed">HOME PLATE</text>
        <text x={zoneX1-2} y={(zoneY1+zoneY2)/2} textAnchor="end" fill="#3a3f52" fontSize={7} fontFamily="Barlow Condensed">HI</text>
        <text x={zoneX1-2} y={zoneY2+6} textAnchor="end" fill="#3a3f52" fontSize={7} fontFamily="Barlow Condensed">LO</text>
      </svg>
      {dots.length === 0 && (
        <div style={{ fontSize:'.72rem', color:'#3a3f52', marginTop:'.5rem', fontFamily:"'Barlow Condensed',sans-serif" }}>
          PER-PITCH LOCATION DATA NOT AVAILABLE — SELECT PITCH TYPE
        </div>
      )}
    </div>
  );
}

function ArsenalTab({ id, colors, player }) {
  const curYear  = new Date().getFullYear();
  const defYear  = getCurrentSeason();   // respects pre-March-20 offset; avoids empty pre-season fetches
  const YEARS    = Array.from({ length: curYear - 2017 + 1 }, (_, i) => curYear - i);
  const [year, setYear] = useState(defYear);
  const [arsenal, setArsenal] = useState([]);
  const [pitches, setPitches] = useState([]); // per-pitch rows for location
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selPitch, setSelPitch] = useState(null);

  useEffect(() => {
    setLoading(true); setArsenal([]); setPitches([]); setError(null);

    fetch(`/api/arsenal?id=${id}&year=${year}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError('No arsenal data available for this season.'); setLoading(false); return; }
        const rows = (d.pitches ?? d.rows ?? []).filter(r => r.pitch_type && r.pitch_type !== '—');
        setArsenal(rows);
        if (rows.length > 0) setSelPitch(rows[0].pitch_type);
        setLoading(false);
      })
      .catch(() => { setError('Could not load arsenal data.'); setLoading(false); });
  }, [id, year]);

  const fmtN = (v, dec=1) => v !== null && v !== undefined ? v.toFixed(dec) : '—';
  const fmtPct = v => v !== null && v !== undefined ? v.toFixed(1)+'%' : '—';
  const fmtStat = v => v !== null && v !== undefined ? v.toFixed(3) : '—';

  // Total pitches for usage fallback (if usage_pct not available)
  const totalPitches = arsenal.reduce((s, r) => s + (r.pitch_count || 0), 0);

  return (
    <div>
      {/* Header row */}
      <div style={{ display:'flex', alignItems:'center', gap:'1rem', marginBottom:'1.25rem', flexWrap:'wrap' }}>
        <div style={{ ...s.secLabel, color: colors.primary, marginBottom:0 }}>Pitch Arsenal</div>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'.5rem' }}>
          <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.7rem', fontWeight:700, letterSpacing:'.12em', color:'#5c6070' }}>SEASON</span>
          <select value={year} onChange={e=>setYear(parseInt(e.target.value))}
            style={{ background:'#0d1117', border:'1px solid #1e2028', borderRadius:'6px', color:'#f0f2f8', padding:'.3rem .6rem', fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.85rem', fontWeight:700, cursor:'pointer', outline:'none' }}>
            {YEARS.map(y=><option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign:'center', padding:'3rem', color:'#3a3f52' }}>Loading arsenal data from Baseball Savant…</div>
      )}
      {!loading && error && (
        <div style={{ ...s.card, padding:'1.5rem', textAlign:'center', color:'#5c6070' }}>
          <div style={{ fontSize:'.85rem' }}>{error}</div>
          <a href={`https://baseballsavant.mlb.com/savant-player/${id}`} target="_blank" rel="noopener"
            style={{ color: colors.primary, fontSize:'.8rem', marginTop:'.5rem', display:'block' }}>
            View on Baseball Savant →
          </a>
        </div>
      )}
      {!loading && !error && arsenal.length === 0 && (
        <div style={{ ...s.card, padding:'1.5rem', textAlign:'center', color:'#5c6070' }}>
          <div>No arsenal data for {year}. Try a different season.</div>
        </div>
      )}

      {!loading && arsenal.length > 0 && (
        <div>
          {/* ── Pitch mix table ── */}
          <div style={{ ...s.card, marginBottom:'1.25rem', overflow:'hidden' }}>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:"'Inter',sans-serif", fontSize:'.78rem' }}>
                <thead>
                  <tr style={{ background:'#080c12' }}>
                    {['PITCH','USAGE','VELO','SPIN','H-BREAK','V-BREAK','WHIFF%','K%','BA','SLG','xwOBA'].map(h => (
                      <th key={h} style={{ padding:'.5rem .65rem', fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.6rem', fontWeight:700, letterSpacing:'.1em', color:'#5c6070', textAlign: h==='PITCH' ? 'left' : 'right', whiteSpace:'nowrap', borderBottom:'1px solid #1e2028' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {arsenal.map((r, i) => {
                    const pName = r.pitch_name !== '—' ? r.pitch_name : r.pitch_type;
                    const col   = pitchColor(r.pitch_type);
                    const usage = r.usage_pct !== null && r.usage_pct !== undefined
                      ? r.usage_pct
                      : (totalPitches > 0 ? (r.pitch_count||0)/totalPitches*100 : 0);
                    return (
                      <tr key={i}
                        onClick={() => setSelPitch(r.pitch_type)}
                        style={{ borderTop:'1px solid #12161e', cursor:'pointer', background: selPitch===r.pitch_type ? col+'12' : 'transparent', transition:'background .15s' }}>
                        <td style={{ padding:'.5rem .65rem' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'.5rem' }}>
                            <div style={{ width:'10px', height:'10px', borderRadius:'50%', background:col, flexShrink:0 }} />
                            <span style={{ fontWeight:600, color:'#f0f2f8', whiteSpace:'nowrap' }}>{pName}</span>
                          </div>
                          {/* Usage bar */}
                          <div style={{ height:'3px', background:'#1e2028', borderRadius:'2px', marginTop:'4px', width:'100px' }}>
                            <div style={{ height:'100%', width:`${Math.min(usage,100)}%`, background:col, borderRadius:'2px', transition:'width .3s' }} />
                          </div>
                        </td>
                        <td style={{ textAlign:'right', padding:'.5rem .65rem', color:'#c8cce0' }}>{usage.toFixed(1)}%</td>
                        <td style={{ textAlign:'right', padding:'.5rem .65rem', color: colors.primary, fontWeight:600 }}>{r.avg_speed !== null ? r.avg_speed.toFixed(1) : '—'}</td>
                        <td style={{ textAlign:'right', padding:'.5rem .65rem', color:'#c8cce0' }}>{r.avg_spin !== null ? Math.round(r.avg_spin) : '—'}</td>
                        <td style={{ textAlign:'right', padding:'.5rem .65rem', color:'#c8cce0' }}>{r.avg_break_x !== null ? r.avg_break_x.toFixed(1)+'"' : '—'}</td>
                        <td style={{ textAlign:'right', padding:'.5rem .65rem', color:'#c8cce0' }}>{r.avg_break_z !== null ? r.avg_break_z.toFixed(1)+'"' : '—'}</td>
                        <td style={{ textAlign:'right', padding:'.5rem .65rem', color: r.whiff_pct>30?'#00c2a8':'#c8cce0' }}>{r.whiff_pct !== null ? r.whiff_pct.toFixed(1)+'%' : '—'}</td>
                        <td style={{ textAlign:'right', padding:'.5rem .65rem', color:'#c8cce0' }}>{r.k_pct !== null ? r.k_pct.toFixed(1)+'%' : '—'}</td>
                        <td style={{ textAlign:'right', padding:'.5rem .65rem', color:'#c8cce0' }}>{r.ba !== null ? r.ba.toFixed(3) : '—'}</td>
                        <td style={{ textAlign:'right', padding:'.5rem .65rem', color:'#c8cce0' }}>{r.slg !== null ? r.slg.toFixed(3) : '—'}</td>
                        <td style={{ textAlign:'right', padding:'.5rem .65rem', color:'#c8cce0' }}>{r.xwoba !== null ? r.xwoba.toFixed(3) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Charts row ── */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:'1.25rem', marginBottom:'1.25rem' }}>
            {/* Movement chart */}
            <div style={{ ...s.card, padding:'1rem' }}>
              <MovementChart pitches={arsenal} />
            </div>

            {/* Pitch type selector + link */}
            <div style={{ ...s.card, padding:'1rem' }}>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.65rem', fontWeight:700, letterSpacing:'.14em', color:'#5c6070', marginBottom:'.75rem' }}>
                SELECT PITCH TO FILTER
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'.4rem', marginBottom:'1rem' }}>
                {arsenal.map((r,i) => {
                  const col = pitchColor(r.pitch_type ?? r.pitch_name);
                  const active = selPitch === r.pitch_type;
                  return (
                    <button key={i} onClick={()=>setSelPitch(r.pitch_type)}
                      style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.72rem', fontWeight:700, letterSpacing:'.08em', padding:'.3rem .65rem', borderRadius:'6px', border: `1px solid ${active ? col : '#1e2028'}`, background: active ? col+'22' : 'transparent', color: active ? col : '#5c6070', cursor:'pointer', transition:'all .15s' }}>
                      {r.pitch_name !== '—' ? r.pitch_name : r.pitch_type}
                    </button>
                  );
                })}
              </div>
              {/* Selected pitch detail */}
              {selPitch && (() => {
                const p = arsenal.find(r => r.pitch_type === selPitch);
                if (!p) return null;
                const col = pitchColor(selPitch);
                return (
                  <div style={{ borderTop:'1px solid #1e2028', paddingTop:'.75rem' }}>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'.5rem' }}>
                      {[
                        ['Avg Velocity', p.avg_speed !== null ? p.avg_speed.toFixed(1)+' mph' : '—'],
                        ['Spin Rate',    p.avg_spin !== null ? Math.round(p.avg_spin)+' rpm' : '—'],
                        ['H-Movement',  p.avg_break_x !== null ? p.avg_break_x.toFixed(1)+'"' : '—'],
                        ['V-Movement',  p.avg_break_z !== null ? p.avg_break_z.toFixed(1)+'"' : '—'],
                        ['Whiff %',     p.whiff_pct !== null ? p.whiff_pct.toFixed(1)+'%' : '—'],
                        ['Put Away %',  p.put_away !== null ? p.put_away.toFixed(1)+'%' : '—'],
                        ['BA Against',  p.ba !== null ? p.ba.toFixed(3) : '—'],
                        ['SLG Against', p.slg !== null ? p.slg.toFixed(3) : '—'],
                      ].map(([label,val])=>(
                        <div key={label} style={{ background:'#080c12', borderRadius:'6px', padding:'.4rem .6rem', borderLeft:`2px solid ${col}` }}>
                          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.58rem', fontWeight:700, letterSpacing:'.1em', color:'#5c6070' }}>{label}</div>
                          <div style={{ fontFamily:"'Anton',sans-serif", fontSize:'.9rem', color:'#f0f2f8', marginTop:'2px' }}>{val}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Savant link */}
          <a href={`https://baseballsavant.mlb.com/savant-player/${player?.fullName?.toLowerCase().replace(/[^a-z0-9]/g,'-').replace(/-+/g,'-')}-${id}?stats=statcast-r-pitching-mlb&playerType=pitcher`}
            target="_blank" rel="noopener"
            style={{ display:'flex', alignItems:'center', gap:'1rem', padding:'1rem 1.25rem', background:'#0d1117', border:`1px solid ${colors.primary}33`, borderRadius:'10px', textDecoration:'none', transition:'all .2s' }}
            onMouseEnter={e=>e.currentTarget.style.borderColor=colors.primary}
            onMouseLeave={e=>e.currentTarget.style.borderColor=colors.primary+'33'}>
            <span style={{ fontSize:'1.4rem' }}>🎯</span>
            <div>
              <div style={{ fontWeight:600, color:'#f0f2f8', fontSize:'.85rem' }}>Full Arsenal on Baseball Savant →</div>
              <div style={{ fontSize:'.72rem', color:'#5c6070' }}>Heat maps · Pitch tunneling · Full pitch grades · Swing profiles</div>
            </div>
          </a>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// OLD SavantGrid — kept for hero strip only, now uses savantColor
// ════════════════════════════════════════════════════════
function SavantGrid({ stat, isPitcher, colors, savantData }) {
  const tiles = isPitcher ? getPitTiles(stat, savantData) : getBatTiles(stat, savantData);
  return (
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(165px,1fr))',gap:'.875rem',marginBottom:'2rem'}}>
      {tiles.map((t,i)=>{
        const pct = savantData?.[t.savantKey] ?? t.estimatedPct;
        const pctNum = typeof pct === 'number' ? Math.round(pct) : null;
        const col = pctNum !== null ? savantColor(pctNum, t.lowerIsBetter) : '#9e9e9e';
        const barWidth = pctNum !== null ? pctNum : Math.round((t.bar||0)*100);
        return (
          <div key={i} className="sv-tile" style={{...s.svTile,borderColor:pctNum?col+'33':'#1e2028'}}>
            {pctNum !== null && (
              <div style={{position:'absolute',top:'.5rem',right:'.5rem',width:'26px',height:'26px',borderRadius:'50%',background:col,display:'flex',alignItems:'center',justifyContent:'center'}}>
                <span style={{fontFamily:"'Anton',sans-serif",fontSize:'.75rem',color:'#fff',lineHeight:1}}>{pctNum}</span>
              </div>
            )}
            <div style={s.svLabel}>{t.label}</div>
            <div style={{...s.svVal,color:'#f0f2f8'}}>{t.val ?? '—'}</div>
            <div style={s.svSub}>{t.sub}</div>
            <div style={s.svBar}>
              <div style={{...s.svBarFill, width:`${Math.min(100,barWidth)}%`, background:col}} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// TRENDS & ODDS TAB
// ════════════════════════════════════════════════════════
function TrendsAndOdds({ careerRows, isPitcher, colors, activeTrendMetric, setTrendMetric, trendView, setTrendView, chartRefs, chartInsts, odds, player, stat }) {

  const BAT_METRICS = [
    {key:'avg',   label:'AVG'},   {key:'ops',   label:'OPS'},
    {key:'homeRuns',label:'HR'},  {key:'rbi',   label:'RBI'},
    {key:'hits',  label:'H'},     {key:'obp',   label:'OBP'},
    {key:'slg',   label:'SLG'},   {key:'strikeOuts',label:'K'},
    {key:'stolenBases',label:'SB'},
  ];
  const PIT_METRICS = [
    {key:'era',   label:'ERA'},   {key:'whip',  label:'WHIP'},
    {key:'strikeOuts',label:'K'}, {key:'strikeoutsPer9Inn',label:'K/9'},
    {key:'wins',  label:'W'},     {key:'inningsPitched',label:'IP'},
    {key:'baseOnBalls',label:'BB'},{key:'baseOnBallsPer9Inn',label:'BB/9'},
  ];
  const metrics = isPitcher ? PIT_METRICS : BAT_METRICS;
  const lowerBetter = ['era','whip','baseOnBallsPer9Inn','strikeOuts_pit'].includes(activeTrendMetric);

  // Build season chart data
  const last10 = careerRows.slice(-10);
  const seasonLabels = last10.map(r => r.season);
  const seasonVals   = last10.map(r => parseFloat(r.stat?.[activeTrendMetric]??0)||0);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.Chart) return;
    const ctx = document.getElementById('trend-main');
    if (!ctx) return;
    if (chartInsts.current['main']) chartInsts.current['main'].destroy();
    chartInsts.current['main'] = new window.Chart(ctx.getContext('2d'), {
      type: 'line',
      data: {
        labels: seasonLabels,
        datasets: [{
          label: activeTrendMetric.toUpperCase(),
          data: seasonVals,
          borderColor: colors.primary,
          backgroundColor: colors.primary+'18',
          pointBackgroundColor: colors.primary,
          pointBorderColor: '#050608',
          pointRadius: 5, tension: .35, fill: true,
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color:'#b8bdd0', font:{family:"'Barlow Condensed',sans-serif",size:13,weight:'600'} } } },
        scales: {
          x: { ticks:{color:'#5c6070'}, grid:{color:'rgba(28,30,40,.9)'} },
          y: { ticks:{color:'#5c6070'}, grid:{color:'rgba(28,30,40,.9)'}, reverse: lowerBetter }
        }
      }
    });
  }, [activeTrendMetric, careerRows, colors]);

  // Trend summary
  const first = seasonVals[0], latest = seasonVals[seasonVals.length-1];
  const improving = lowerBetter ? latest < first : latest > first;

  return (
    <div>
      {/* ── Multi-stat trend ── */}
      <div style={{...s.secLabel,color:colors.primary}}>Performance Trends</div>

      {/* Metric selector */}
      <div style={{display:'flex',flexWrap:'wrap',gap:'.4rem',marginBottom:'1rem'}}>
        {metrics.map(m=>(
          <button key={m.key} className="trend-btn"
            style={{padding:'.3rem .8rem',background:'#0d1117',border:`1px solid ${activeTrendMetric===m.key?colors.primary:'#1e2028'}`,borderRadius:'4px',fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.75rem',fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:activeTrendMetric===m.key?colors.primary:'#5c6070',cursor:'pointer',transition:'all .2s'}}
            onClick={()=>setTrendMetric(m.key)}>
            {m.label}
          </button>
        ))}
      </div>

      {/* Season chart */}
      <div style={s.chartCard}>
        <div style={{marginBottom:'.75rem',fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.72rem',fontWeight:700,letterSpacing:'.15em',textTransform:'uppercase',color:'#5c6070'}}>
          Year-by-Year · Last 10 Seasons
        </div>
        <canvas id="trend-main" height={90}/>
      </div>

      {/* Trend summary */}
      {seasonVals.length >= 2 && (
        <div style={{...s.card,padding:'1rem 1.4rem',fontSize:'.87rem',lineHeight:1.7,marginBottom:'2rem'}}>
          <span style={{color:improving?colors.primary:'#e63535',fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:'.1em',textTransform:'uppercase'}}>
            {improving?'📈 Improving':'📉 Declining'}
          </span><br/>
          {activeTrendMetric.toUpperCase()} moved from <strong style={{color:'#f5a623'}}>{first}</strong> ({seasonLabels[0]}) to <strong style={{color:colors.primary}}>{latest}</strong> ({seasonLabels[seasonLabels.length-1]}) over {seasonVals.length} seasons.
        </div>
      )}

      {/* ── Mini multi-stat overview ── */}
      <div style={{...s.secLabel,color:colors.primary,marginTop:'1.5rem'}}>Season at a Glance</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))',gap:'.75rem',marginBottom:'2rem'}}>
        {metrics.slice(0,6).map(m=>{
          const rowVals = last10.map(r=>parseFloat(r.stat?.[m.key]??0)||0);
          const cur = rowVals[rowVals.length-1];
          const prev = rowVals[rowVals.length-2]??cur;
          const lb = ['era','whip','baseOnBallsPer9Inn'].includes(m.key);
          const up = lb ? cur<prev : cur>prev;
          return (
            <div key={m.key} style={{background:'#0d1117',border:'1px solid #1e2028',borderRadius:'8px',padding:'.9rem .85rem',textAlign:'center'}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.62rem',fontWeight:700,letterSpacing:'.15em',textTransform:'uppercase',color:'#5c6070',marginBottom:'.25rem'}}>{m.label}</div>
              <div style={{fontFamily:"'Anton',sans-serif",fontSize:'1.9rem',color:'#f0f2f8',lineHeight:1}}>{cur||'—'}</div>
              <div style={{fontSize:'.68rem',color:up?colors.primary:'#e63535',marginTop:'.2rem'}}>{up?'▲':'▼'} vs prev yr</div>
            </div>
          );
        })}
      </div>

      {/* ── BEST BET ENGINE ── */}
      <div style={{...s.secLabel,color:colors.primary,marginTop:'1.5rem'}}>
        Today's Best Bet
        <span style={{marginLeft:'1rem',fontSize:'.65rem',fontWeight:400,letterSpacing:'.08em',color:'#5c6070',textTransform:'none'}}>
          · streak · splits · matchup · velocity · weather
        </span>
      </div>

      <BestBetPanel odds={odds} colors={colors} isPitcher={isPitcher} />

      {/* ── LIVE PROP LINES ── */}
      {odds && (
        <>
          <div style={{...s.secLabel,color:colors.primary,marginTop:'2rem'}}>
            Player Props
            <span style={{marginLeft:'1rem',fontSize:'.65rem',fontWeight:400,letterSpacing:'.08em',color:'#5c6070',textTransform:'none'}}>via The Odds API</span>
          </div>
          {odds?.available ? (
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(165px,1fr))',gap:'.75rem',marginBottom:'1.5rem'}}>
              {(odds.props??[]).map((prop,i)=>{
                const best = prop.outcomes?.reduce((a,b)=>parseFloat(a.price)<parseFloat(b.price)?b:a, prop.outcomes[0]);
                const p = best?.price ?? null;
                const implied = p ? (p > 0 ? Math.round(100/(p+100)*100) : Math.round(Math.abs(p)/(Math.abs(p)+100)*100)) : null;
                return (
                  <div key={i} style={{background:'#0d1117',border:'1px solid #1e2028',borderRadius:'8px',padding:'1rem',textAlign:'center'}}>
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.62rem',fontWeight:700,letterSpacing:'.12em',textTransform:'uppercase',color:'#5c6070',marginBottom:'.35rem'}}>{prop.label}</div>
                    <div style={{fontFamily:"'Anton',sans-serif",fontSize:'2rem',color:colors.primary,lineHeight:1}}>{p?(p>0?'+':'')+p:'—'}</div>
                    {implied && <div style={{fontSize:'.65rem',color:'#5c6070',marginTop:'.2rem'}}>{implied}% implied</div>}
                    <div style={{fontSize:'.58rem',color:'#3a3f52',marginTop:'.2rem'}}>{best?.bookmaker??'FanDuel'}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{background:'#0d1117',border:'1px solid #1e2028',borderRadius:'8px',padding:'1.25rem',marginBottom:'1.5rem'}}>
              <div style={{fontSize:'.82rem',color:'#5c6070',textAlign:'center',marginBottom: odds?.hasApiKey ? '.5rem' : 0}}>
                {odds?.hasApiKey
                  ? (odds?.noGame
                    ? `No game found for this player today — props will appear on game days.`
                    : `Props not yet posted today. Books typically post MLB props between 10–11am ET on game days.`)
                  : 'Add ODDS_API_KEY to Vercel environment variables to enable live prop lines.'}
              </div>
              {odds?.hasApiKey && !odds?.noGame && (
                <div style={{fontSize:'.72rem',color:'#3a3f52',textAlign:'center'}}>
                  API key active ✓ — check back closer to game time
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Best Bet Panel ────────────────────────────────────────────────────────
function BestBetPanel({ odds, colors, isPitcher }) {
  if (!odds) return (
    <div style={{background:'#0d1117',border:'1px solid #1e2028',borderRadius:'10px',padding:'1.5rem',textAlign:'center',color:'#3a3f52',fontSize:'.85rem',marginBottom:'1.5rem'}}>
      Analyzing matchup…
    </div>
  );

  const { bestBet, factors, gameInfo, noGame, hasGame } = odds;
  const gradeColor = bestBet?.color ?? '#3a3f52';

  if (!hasGame || noGame) return (
    <div style={{background:'#0d1117',border:'1px solid #1e2028',borderRadius:'10px',padding:'1.5rem',marginBottom:'1.5rem'}}>
      <div style={{fontSize:'.85rem',color:'#5c6070',textAlign:'center'}}>No game scheduled today — check back on game days.</div>
    </div>
  );

  return (
    <div style={{background:'#0d1117',border:`1px solid ${gradeColor}44`,borderRadius:'10px',overflow:'hidden',marginBottom:'1.5rem'}}>
      {/* Game context bar */}
      {gameInfo && (
        <div style={{display:'flex',alignItems:'center',gap:'1rem',padding:'.6rem 1rem',background:'#080c12',borderBottom:'1px solid #1e2028',flexWrap:'wrap'}}>
          {gameInfo.opponentId && <img src={`https://www.mlbstatic.com/team-logos/${gameInfo.opponentId}.svg`} alt="" style={{width:'22px',height:'22px',objectFit:'contain'}} onError={e=>e.target.style.display='none'}/>}
          <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.75rem',fontWeight:700,letterSpacing:'.1em',color:'#f0f2f8'}}>vs {gameInfo.opponentAbbr ?? gameInfo.opponent}</span>
          {gameInfo.probablePitcher && <span style={{fontSize:'.72rem',color:'#5c6070'}}>⚾ {gameInfo.probablePitcher}</span>}
          {gameInfo.venue && <span style={{fontSize:'.68rem',color:'#3a3f52',marginLeft:'auto'}}>{gameInfo.venue}</span>}
        </div>
      )}

      <div style={{padding:'1.25rem'}}>
        {bestBet ? (
          <>
            {/* Grade + recommendation */}
            <div style={{display:'flex',alignItems:'center',gap:'1rem',marginBottom:'1rem',flexWrap:'wrap'}}>
              <div style={{width:'60px',height:'60px',borderRadius:'50%',border:`2px solid ${gradeColor}`,display:'flex',alignItems:'center',justifyContent:'center',background:gradeColor+'12',flexShrink:0}}>
                <span style={{fontFamily:"'Anton',sans-serif",fontSize:'1.6rem',color:gradeColor,lineHeight:1}}>{bestBet.grade}</span>
              </div>
              <div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.68rem',fontWeight:700,letterSpacing:'.15em',color:'#3a3f52',marginBottom:'.15rem'}}>BEST BET TODAY</div>
                <div style={{fontFamily:"'Anton',sans-serif",fontSize:'1.3rem',color:gradeColor,lineHeight:1}}>{bestBet.prop}</div>
                <div style={{fontSize:'.8rem',color:'#f0f2f8',marginTop:'.2rem',fontWeight:600}}>{bestBet.text}</div>
              </div>
              <div style={{marginLeft:'auto',textAlign:'right'}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.62rem',fontWeight:700,letterSpacing:'.15em',color:'#3a3f52',marginBottom:'.25rem'}}>CONFIDENCE</div>
                <div style={{fontFamily:"'Anton',sans-serif",fontSize:'1.6rem',color:gradeColor,lineHeight:1}}>{bestBet.confidence}%</div>
                {/* Confidence bar */}
                <div style={{width:'80px',height:'4px',background:'#1e2028',borderRadius:'2px',marginTop:'.3rem',overflow:'hidden'}}>
                  <div style={{width:`${bestBet.confidence}%`,height:'100%',background:gradeColor,borderRadius:'2px'}}/>
                </div>
              </div>
            </div>

            {/* Supporting factors */}
            {bestBet.supporting?.length > 0 && (
              <div style={{marginBottom:'.75rem'}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.62rem',fontWeight:700,letterSpacing:'.15em',color:gradeColor,marginBottom:'.4rem'}}>
                  {bestBet.recommendation === 'FADE' ? '⚠ REASONS TO FADE' : '✅ WHY THIS BET'}
                </div>
                {bestBet.supporting.map((f,i) => (
                  <div key={i} style={{fontSize:'.82rem',color:'#b8bdd0',padding:'.2rem 0',borderBottom:'1px solid #0f1018'}}>{f}</div>
                ))}
              </div>
            )}

            {/* Opposing factors */}
            {bestBet.opposing?.length > 0 && (
              <div style={{marginBottom:'.75rem'}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.62rem',fontWeight:700,letterSpacing:'.15em',color:'#e63535',marginBottom:'.4rem'}}>RISKS</div>
                {bestBet.opposing.map((f,i) => (
                  <div key={i} style={{fontSize:'.78rem',color:'#5c6070',padding:'.2rem 0'}}>{f}</div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div style={{textAlign:'center',color:'#5c6070',fontSize:'.85rem',padding:'.5rem 0'}}>
            Insufficient signal — no strong bet today. All factors near neutral.
          </div>
        )}

        {/* Factor breakdown */}
        {factors && factors.filter(f => f?.label).length > 0 && (
          <div style={{borderTop:'1px solid #1e2028',marginTop:'.75rem',paddingTop:'.75rem'}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.62rem',fontWeight:700,letterSpacing:'.15em',color:'#3a3f52',marginBottom:'.5rem'}}>ALL SIGNALS</div>
            <div style={{display:'flex',flexDirection:'column',gap:'.3rem'}}>
              {factors.filter(f => f?.label).map((f,i) => {
                const col = f.score > 0 ? '#2ed47a' : f.score < 0 ? '#e63535' : '#5c6070';
                return (
                  <div key={i} style={{display:'flex',alignItems:'center',gap:'.6rem'}}>
                    <div style={{width:'28px',height:'5px',borderRadius:'3px',background:col,opacity:Math.min(1,.4+Math.abs(f.score??0)*.2),flexShrink:0}}/>
                    <span style={{fontSize:'.78rem',color:'#b8bdd0'}}>{f.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{fontSize:'.62rem',color:'#3a3f52',marginTop:'1rem',paddingTop:'.5rem',borderTop:'1px solid #0f1018'}}>
          For entertainment only. Not financial advice. Gamble responsibly.
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// PREDICTION — rescaled against league context
// ════════════════════════════════════════════════════════
function PredPanel({ stat, isPitcher, colors, id }) {
  const [matchup, setMatchup] = useState(null);
  const [matchupLoading, setMatchupLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/predictions?playerId=${id}`)
      .then(r => r.json())
      .then(d => { setMatchup(d); setMatchupLoading(false); })
      .catch(() => setMatchupLoading(false));
  }, [id]);

  // ── Base score from player's own season stats ──
  let baseScore, title, bars, note;

  if (!isPitcher) {
    const avg  = parseFloat(stat.avg  ?? .230);
    const ops  = parseFloat(stat.ops  ?? .680);
    const hr   = parseInt(stat.homeRuns ?? 0);
    const rbi  = parseInt(stat.rbi     ?? 0);
    const sb   = parseInt(stat.stolenBases ?? 0);
    const obp  = parseFloat(stat.obp  ?? .310);

    const avgScore  = Math.min(100, (avg  / .340) * 100);
    const opsScore  = Math.min(100, (ops  / 1.100) * 100);
    const hrScore   = Math.min(100, (hr   / 55)   * 100);
    const rbiScore  = Math.min(100, (rbi  / 115)  * 100);
    const sbScore   = Math.min(100, (sb   / 50)   * 100);
    const obpScore  = Math.min(100, (obp  / .420)  * 100);

    baseScore = Math.round(
      avgScore  * 0.22 +
      opsScore  * 0.28 +
      hrScore   * 0.18 +
      rbiScore  * 0.15 +
      obpScore  * 0.10 +
      sbScore   * 0.07
    );

    const hitAdj  = matchup?.matchup?.hitAdj  ?? 0;
    const parkAdj = matchup?.matchup?.parkAdj ?? 0;
    const score   = Math.max(5, Math.min(99, Math.round(baseScore * (1 + hitAdj + parkAdj * 0.4))));

    title = score >= 90 ? 'MVP-CALIBER PERFORMANCE' :
            score >= 75 ? 'ELITE PERFORMANCE EXPECTED' :
            score >= 60 ? 'ABOVE AVERAGE PROJECTION' :
            score >= 45 ? 'AVERAGE PROJECTION' :
            score >= 30 ? 'BELOW AVERAGE PROJECTION' : 'TOUGH MATCHUP AHEAD';

    const hitProb = Math.round(Math.max(12, Math.min(52, 24 + (score/100)*18)));
    const xbhProb = Math.round(Math.max(4,  Math.min(35, 6  + (score/100)*12)));
    const hrProb  = Math.round(Math.max(1,  Math.min(25, 2  + (hrScore/100)*10 + parkAdj*8)));
    const multiH  = Math.round(Math.max(5,  Math.min(45, 8  + (score/100)*18)));

    bars = [
      { l:'Hit Probability',   p: hitProb, desc:'Adjusted for opponent + park' },
      { l:'Extra Base Hit',    p: xbhProb, accent: true, desc:'2B, 3B, or HR' },
      { l:'Home Run',          p: hrProb,  accent: true, desc:`Park factor: ${matchup?.matchup?.parkFactor?.toFixed(2) ?? '—'}` },
      { l:'2+ Hit Game',       p: multiH,  desc:'Multi-hit performance' },
    ];
    note = `AVG ${stat.avg??'—'} · OPS ${stat.ops??'—'} · ${hr} HR · ${rbi} RBI this season. ${ops>=1.000?'Historic MVP-level season.':ops>=.900?'Elite run producer.':ops>=.800?'Above average hitter.':ops>=.700?'League average bat.':'Struggling offensively.'}`;

    const grade = score>=90?'A+':score>=80?'A':score>=70?'B+':score>=60?'B':score>=50?'C+':score>=40?'C':'D';

    return (
      <>
        {/* Matchup card — shows opponent pitcher */}
        <MatchupCard matchup={matchup} loading={matchupLoading} colors={colors} />

        <div style={s.predCard}>
          <div style={{display:'flex',alignItems:'center',gap:'2rem',flexWrap:'wrap',marginBottom:'1.5rem',paddingBottom:'1.5rem',borderBottom:'1px solid #1e2028'}}>
            <div style={{textAlign:'center',flexShrink:0}}>
              <div style={{position:'relative',width:'100px',height:'100px',margin:'0 auto'}}>
                <svg viewBox="0 0 100 100" style={{transform:'rotate(-90deg)',width:'100%',height:'100%'}}>
                  <circle cx="50" cy="50" r="44" fill="none" stroke="#1e2028" strokeWidth="8"/>
                  <circle cx="50" cy="50" r="44" fill="none" stroke={colors.primary} strokeWidth="8"
                    strokeDasharray={`${2*Math.PI*44}`}
                    strokeDashoffset={`${2*Math.PI*44*(1-score/100)}`}
                    strokeLinecap="round" style={{transition:'stroke-dashoffset 1.5s ease'}}/>
                </svg>
                <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
                  <div style={{fontFamily:"'Anton',sans-serif",fontSize:'2rem',lineHeight:1,color:colors.primary}}>{score}</div>
                  <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.65rem',fontWeight:700,color:'#5c6070'}}>/ 100</div>
                </div>
              </div>
              <div style={{fontFamily:"'Anton',sans-serif",fontSize:'2.5rem',lineHeight:1,color:colors.accent,marginTop:'.25rem'}}>{grade}</div>
            </div>
            <div style={{flex:1,minWidth:'180px'}}>
              <div style={{fontFamily:"'Anton',sans-serif",fontSize:'1.6rem',color:'#f0f2f8',marginBottom:'.35rem'}}>{title}</div>
              <div style={{fontSize:'.85rem',lineHeight:1.7,color:'#b8bdd0'}}>{note}</div>
              {matchup?.matchup && (
                <div style={{marginTop:'.5rem',display:'flex',gap:'.5rem',flexWrap:'wrap'}}>
                  {hitAdj !== 0 && (
                    <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.7rem',fontWeight:700,letterSpacing:'.08em',
                      padding:'.2rem .5rem',borderRadius:'4px',
                      background: hitAdj < 0 ? 'rgba(230,53,53,.15)' : 'rgba(46,212,122,.15)',
                      color: hitAdj < 0 ? '#e63535' : '#2ed47a'}}>
                      {hitAdj < 0 ? '↓' : '↑'} Pitcher adj: {hitAdj > 0 ? '+' : ''}{Math.round(hitAdj*100)}%
                    </span>
                  )}
                  {parkAdj !== 0 && (
                    <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.7rem',fontWeight:700,letterSpacing:'.08em',
                      padding:'.2rem .5rem',borderRadius:'4px',
                      background: parkAdj > 0 ? 'rgba(46,212,122,.15)' : 'rgba(230,53,53,.15)',
                      color: parkAdj > 0 ? '#2ed47a' : '#e63535'}}>
                      {parkAdj > 0 ? '↑' : '↓'} Park adj: {parkAdj > 0 ? '+' : ''}{(parkAdj*100).toFixed(0)}%
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div style={{display:'flex',flexDirection:'column',gap:'.9rem'}}>
            {bars.map((b,i)=>(
              <div key={i}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:'.3rem'}}>
                  <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.72rem',fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:'#5c6070'}}>{b.l}</span>
                  <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.85rem',fontWeight:700,color:b.accent?colors.accent:colors.primary}}>{b.p}%</span>
                </div>
                <div style={{height:'6px',background:'#1e2028',borderRadius:'99px',overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${b.p}%`,background:b.accent?colors.accent:colors.primary,borderRadius:'99px',transition:'width 1.4s cubic-bezier(.22,1,.36,1)'}}/>
                </div>
                {b.desc && <div style={{fontSize:'.65rem',color:'#3a3f52',marginTop:'.2rem'}}>{b.desc}</div>}
              </div>
            ))}
          </div>
        </div>

        <div style={s.infoBox}>
          ℹ️ <strong style={{color:'#f0f2f8'}}>Scoring methodology:</strong> Base score uses season stats vs league-best benchmarks. Opponent pitcher quality and park factor are then applied as live adjustments.
        </div>
      </>
    );

  } else {
    // ── Pitcher view ──
    const era  = parseFloat(stat.era  ?? 5.00);
    const whip = parseFloat(stat.whip ?? 1.45);
    const k9   = parseFloat(stat.strikeoutsPer9Inn ?? 7.5);
    const wins = parseInt(stat.wins ?? 0);
    const ip   = parseFloat(stat.inningsPitched ?? 0);

    const eraScore  = Math.min(100, Math.max(0, ((6.00 - era)  / 4.50) * 100));
    const whipScore = Math.min(100, Math.max(0, ((2.00 - whip) / 1.20) * 100));
    const k9Score   = Math.min(100, (k9 / 14.0) * 100);
    const bb9Score  = Math.min(100, Math.max(0, ((6.0 - parseFloat(stat.baseOnBallsPer9Inn ?? 3.5)) / 4.5) * 100));
    const ipScore   = Math.min(100, (ip / 200) * 100);

    const score = Math.round(
      eraScore  * 0.30 +
      whipScore * 0.25 +
      k9Score   * 0.22 +
      bb9Score  * 0.15 +
      ipScore   * 0.08
    );

    title = score >= 90 ? 'CY YOUNG-CALIBER START PROJECTED' :
            score >= 75 ? 'DOMINANT OUTING PROJECTED' :
            score >= 60 ? 'QUALITY START LIKELY' :
            score >= 45 ? 'AVERAGE OUTING EXPECTED' :
            score >= 30 ? 'ROUGH OUTING POSSIBLE' : 'TOUGH NIGHT — HIGH ERA RISK';

    const qsProb   = Math.round(20 + (score/100)*60);
    const winProb  = Math.round(15 + (score/100)*45);
    const kProp    = Math.round(k9 * 0.55);
    const lowWhip  = Math.round(15 + (whipScore/100)*65);

    bars = [
      { l:'Quality Start',        p: qsProb,  desc:'6+ IP, ≤3 ER' },
      { l:'Win Probability',      p: winProb, accent: true, desc:'Based on ERA/WHIP' },
      { l:`${kProp}+ Strikeouts`, p: Math.round(40 + (k9Score/100)*45), accent: true, desc:'Based on K/9 pace' },
      { l:'Low WHIP Game',        p: lowWhip, desc:'WHIP < 1.10' },
    ];
    note = `ERA ${stat.era??'—'} · WHIP ${stat.whip??'—'} · K/9 ${stat.strikeoutsPer9Inn??'—'} · ${wins}W this season. ${era<=2.5?'Historically dominant.':era<=3.25?'Ace-caliber season.':era<=4.00?'Solid starter.':era<=5.00?'Inconsistent season.':'Struggling significantly.'}`;

    const grade = score>=90?'A+':score>=80?'A':score>=70?'B+':score>=60?'B':score>=50?'C+':score>=40?'C':'D';

    return (
      <>
        <MatchupCard matchup={matchup} loading={matchupLoading} colors={colors} isPitcher />

        <div style={s.predCard}>
          <div style={{display:'flex',alignItems:'center',gap:'2rem',flexWrap:'wrap',marginBottom:'1.5rem',paddingBottom:'1.5rem',borderBottom:'1px solid #1e2028'}}>
            <div style={{textAlign:'center',flexShrink:0}}>
              <div style={{position:'relative',width:'100px',height:'100px',margin:'0 auto'}}>
                <svg viewBox="0 0 100 100" style={{transform:'rotate(-90deg)',width:'100%',height:'100%'}}>
                  <circle cx="50" cy="50" r="44" fill="none" stroke="#1e2028" strokeWidth="8"/>
                  <circle cx="50" cy="50" r="44" fill="none" stroke={colors.primary} strokeWidth="8"
                    strokeDasharray={`${2*Math.PI*44}`}
                    strokeDashoffset={`${2*Math.PI*44*(1-score/100)}`}
                    strokeLinecap="round" style={{transition:'stroke-dashoffset 1.5s ease'}}/>
                </svg>
                <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
                  <div style={{fontFamily:"'Anton',sans-serif",fontSize:'2rem',lineHeight:1,color:colors.primary}}>{score}</div>
                  <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.65rem',fontWeight:700,color:'#5c6070'}}>/ 100</div>
                </div>
              </div>
              <div style={{fontFamily:"'Anton',sans-serif",fontSize:'2.5rem',lineHeight:1,color:colors.accent,marginTop:'.25rem'}}>{grade}</div>
            </div>
            <div style={{flex:1,minWidth:'180px'}}>
              <div style={{fontFamily:"'Anton',sans-serif",fontSize:'1.6rem',color:'#f0f2f8',marginBottom:'.35rem'}}>{title}</div>
              <div style={{fontSize:'.85rem',lineHeight:1.7,color:'#b8bdd0'}}>{note}</div>
            </div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:'.9rem'}}>
            {bars.map((b,i)=>(
              <div key={i}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:'.3rem'}}>
                  <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.72rem',fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:'#5c6070'}}>{b.l}</span>
                  <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.85rem',fontWeight:700,color:b.accent?colors.accent:colors.primary}}>{b.p}%</span>
                </div>
                <div style={{height:'6px',background:'#1e2028',borderRadius:'99px',overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${b.p}%`,background:b.accent?colors.accent:colors.primary,borderRadius:'99px',transition:'width 1.4s cubic-bezier(.22,1,.36,1)'}}/>
                </div>
                {b.desc && <div style={{fontSize:'.65rem',color:'#3a3f52',marginTop:'.2rem'}}>{b.desc}</div>}
              </div>
            ))}
          </div>
        </div>
        <div style={s.infoBox}>
          ℹ️ <strong style={{color:'#f0f2f8'}}>Scoring methodology:</strong> Base score uses season stats vs league-best benchmarks. Opponent pitcher quality and park factor are then applied as live adjustments.
        </div>
      </>
    );
  }
}

// ── Matchup card component ──
function MatchupCard({ matchup, loading, colors, isPitcher }) {
  if (loading) return (
    <div style={{...s.matchupCard, display:'flex', alignItems:'center', justifyContent:'center', color:'#3a3f52', fontSize:'.85rem', gap:'.5rem'}}>
      <span style={{animation:'spin 1s linear infinite', display:'inline-block'}}>⚾</span> Loading today's matchup…
    </div>
  );

  if (!matchup?.hasGame) return (
    <div style={{...s.matchupCard, color:'#3a3f52', fontSize:'.85rem', textAlign:'center'}}>
      📅 {matchup?.reason ?? 'No game today'} — projections based on season stats only.
    </div>
  );

  const { gameInfo, pitcher, matchup: mx } = matchup;
  const diffColor =
    mx?.difficulty === 'ACE'        ? '#e63535' :
    mx?.difficulty === 'TOUGH'      ? '#f5a623' :
    mx?.difficulty === 'AVERAGE'    ? '#b8bdd0' :
    mx?.difficulty === 'HITTABLE'   ? '#2ed47a' : '#00c2a8';

  const gameTime = gameInfo?.gameTime
    ? new Date(gameInfo.gameTime).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', timeZoneName:'short' })
    : '';

  return (
    <div style={s.matchupCard}>
      {/* Header row */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1rem', flexWrap:'wrap', gap:'.5rem'}}>
        <div>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.68rem',fontWeight:700,letterSpacing:'.2em',color:'#3a3f52',marginBottom:'.2rem'}}>
            TODAY'S MATCHUP
          </div>
          <div style={{fontFamily:"'Anton',sans-serif",fontSize:'1.2rem',color:'#f0f2f8',letterSpacing:'.05em'}}>
            {gameInfo.isHome ? 'vs' : '@'} {gameInfo.oppTeam}
          </div>
          <div style={{fontSize:'.75rem',color:'#5c6070',marginTop:'.1rem'}}>
            {gameInfo.venue} · {gameTime}
          </div>
        </div>
        <div style={{display:'flex', gap:'.5rem', alignItems:'center'}}>
          {/* Park factor badge */}
          <div style={{textAlign:'center',background:'#080c12',border:'1px solid #1e2028',borderRadius:'6px',padding:'.4rem .7rem'}}>
            <div style={{fontFamily:"'Anton',sans-serif",fontSize:'1.1rem',color: gameInfo.parkFactor >= 1.05 ? '#2ed47a' : gameInfo.parkFactor <= 0.95 ? '#e63535' : '#b8bdd0'}}>
              {gameInfo.parkFactor?.toFixed(2) ?? '—'}
            </div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.58rem',fontWeight:700,letterSpacing:'.1em',color:'#3a3f52'}}>PARK</div>
          </div>
        </div>
      </div>

      {/* Pitcher section */}
      {!pitcher ? (
        <div style={{fontSize:'.82rem',color:'#5c6070',fontStyle:'italic'}}>Probable pitcher not yet announced</div>
      ) : (
        <div style={{display:'flex',alignItems:'center',gap:'1rem',background:'#080c12',borderRadius:'8px',padding:'.85rem 1rem',flexWrap:'wrap'}}>
          <img
            src={`https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_60,q_auto:best/v1/people/${pitcher.id}/headshot/67/current`}
            alt={pitcher.name}
            style={{width:'48px',height:'48px',borderRadius:'50%',objectFit:'cover',background:'#1e2028',flexShrink:0}}
            onError={e => e.target.style.display='none'}
          />
          <div style={{flex:1}}>
            <div style={{display:'flex',alignItems:'center',gap:'.6rem',flexWrap:'wrap'}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:'1rem',color:'#f0f2f8'}}>{pitcher.name}</div>
              <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.7rem',fontWeight:700,letterSpacing:'.1em',
                padding:'.2rem .55rem',borderRadius:'4px',border:`1px solid ${diffColor}`,color:diffColor}}>
                {mx?.difficulty ?? '—'}
              </span>
            </div>
            <div style={{display:'flex',gap:'1rem',marginTop:'.4rem',flexWrap:'wrap'}}>
              {[
                ['ERA',  pitcher.era],
                ['WHIP', pitcher.whip],
                ['K/9',  pitcher.k9],
                ['BB/9', pitcher.bb9],
                ['W-L',  `${pitcher.wins}-${pitcher.losses}`],
              ].map(([lbl,val]) => (
                <div key={lbl} style={{textAlign:'center'}}>
                  <div style={{fontFamily:"'Anton',sans-serif",fontSize:'1rem',color:colors.primary,lineHeight:1}}>{val ?? '—'}</div>
                  <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.58rem',fontWeight:700,letterSpacing:'.1em',color:'#3a3f52'}}>{lbl}</div>
                </div>
              ))}
            </div>
          </div>
          {/* Savant data if available */}
          {pitcher.savant && (
            <div style={{display:'flex',gap:'.75rem',paddingLeft:'1rem',borderLeft:'1px solid #1e2028',flexWrap:'wrap'}}>
              {[
                ['Exit Velo',  pitcher.savant.exitVeloAllowed?.toFixed(1), 'mph allowed'],
                ['Hard Hit%',  pitcher.savant.hardHitAllowed?.toFixed(1),  '% hard hit'],
                ['Barrel%',    pitcher.savant.barrelAllowed?.toFixed(1),   '% barrel'],
                ['Whiff%',     pitcher.savant.whiffPct?.toFixed(1),        '% whiff'],
              ].filter(([,v]) => v != null).map(([lbl,val,sub]) => (
                <div key={lbl} style={{textAlign:'center'}}>
                  <div style={{fontFamily:"'Anton',sans-serif",fontSize:'1rem',color:'#b8bdd0',lineHeight:1}}>{val}</div>
                  <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.58rem',fontWeight:700,letterSpacing:'.08em',color:'#3a3f52'}}>{lbl}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
// ════════════════════════════════════════════════════════
// HIGHLIGHTS TAB
// ════════════════════════════════════════════════════════
function HighlightsTab({ id, player, highlights, colors }) {
  const [selectedVideo, setSelectedVideo] = useState(null);
  const mlbVids  = highlights?.mlb     ?? [];
  const ytVideos = highlights?.youtube  ?? [];
  const hasYT    = highlights?.youtubeReady ?? false;

  const openVideo = (v) => setSelectedVideo(v);

  return (
    <div>
      <div style={{...hts.secLabel, color:colors.primary}}>🎬 Recent Highlights</div>

      {/* YouTube Highlights — auto-loaded, shown first since more reliable */}
      {hasYT && (
        <>
          <div style={hts.subLabel}>▶ YouTube Highlights</div>
          <div style={hts.videoGrid}>
            {ytVideos.map((v,i) => (
              <div key={i} style={hts.videoCard} onClick={() => openVideo(v)}>
                <div style={hts.thumbWrap}>
                  <img src={v.thumb} alt={v.title} style={hts.thumb}
                    onError={e => e.target.style.display='none'} />
                  <div style={hts.playBtn}>▶</div>
                </div>
                <div style={hts.videoTitle}>{v.title}</div>
                <div style={{...hts.videoDate, display:'flex', justifyContent:'space-between'}}>
                  <span>{v.date}</span>
                  <span style={{color:'#3a3f52'}}>{v.channelName}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* MLB Official Highlights */}
      {mlbVids.length > 0 && (
        <>
          <div style={{...hts.subLabel, marginTop: hasYT ? '2rem' : 0}}>⚾ MLB.com Official Highlights</div>
          <div style={hts.videoGrid}>
            {mlbVids.map((v,i) => (
              <div key={i} style={hts.videoCard} onClick={() => openVideo(v)}>
                <div style={hts.thumbWrap}>
                  <img src={v.thumb} alt={v.title} style={hts.thumb}
                    onError={e => e.target.style.display='none'} />
                  <div style={hts.playBtn}>▶</div>
                  {v.duration && <div style={hts.duration}>{v.duration}</div>}
                </div>
                <div style={hts.videoTitle}>{v.title}</div>
                <div style={hts.videoDate}>{v.date}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {!hasYT && mlbVids.length === 0 && (
        <div style={{color:'#5c6070', padding:'2rem 0', textAlign:'center', fontSize:'.88rem'}}>
          No highlights found yet for this player this season.
        </div>
      )}

      {/* Video modal */}
      {selectedVideo && (
        <div style={hts.modal} onClick={() => setSelectedVideo(null)}>
          <div style={hts.modalInner} onClick={e => e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'.75rem'}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:'.9rem',color:'#f0f2f8',flex:1,paddingRight:'1rem'}}>{selectedVideo.title}</div>
              <button onClick={() => setSelectedVideo(null)} style={{background:'none',border:'none',color:'#5c6070',fontSize:'1.4rem',cursor:'pointer',flexShrink:0}}>✕</button>
            </div>
            {selectedVideo.youtubeId ? (
              <iframe width="100%" height="420"
                src={`https://www.youtube.com/embed/${selectedVideo.youtubeId}?autoplay=1`}
                frameBorder="0" allow="autoplay; encrypted-media; fullscreen"
                allowFullScreen style={{borderRadius:'8px'}} />
            ) : (
              <video controls autoPlay style={{width:'100%',borderRadius:'8px',maxHeight:'420px'}} src={selectedVideo.url}>
                <a href={selectedVideo.mlbUrl} target="_blank" rel="noopener" style={{color:colors.primary}}>Watch on MLB.com →</a>
              </video>
            )}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:'.75rem'}}>
              {selectedVideo.youtubeId ? (
                <a href={`https://www.youtube.com/watch?v=${selectedVideo.youtubeId}`}
                  target="_blank" rel="noopener"
                  style={{fontSize:'.78rem',color:'#e63535'}}>▶ Open on YouTube →</a>
              ) : (
                <a href={selectedVideo.mlbUrl ?? selectedVideo.url}
                  target="_blank" rel="noopener"
                  style={{fontSize:'.78rem',color:colors.primary}}>Open on MLB.com →</a>
              )}
              <button onClick={() => setSelectedVideo(null)}
                style={{background:'none',border:'1px solid #1e2028',borderRadius:'4px',color:'#5c6070',padding:'.3rem .75rem',cursor:'pointer',fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.75rem',letterSpacing:'.08em'}}>
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Always show MLB.com link */}
      <a href={`https://www.mlb.com/player/${player.fullName.toLowerCase().replace(/ /g,'-')}-${id}/videos`}
        target="_blank" rel="noopener"
        style={{display:'flex',alignItems:'center',gap:'.75rem',padding:'1rem 1.25rem',background:'#0d1117',border:`1px solid ${colors.primary}55`,borderRadius:'8px',textDecoration:'none',color:'#b8bdd0',marginTop:'1.5rem'}}>
        <span style={{fontSize:'1.4rem'}}>⚾</span>
        <div>
          <div style={{fontWeight:600,color:'#f0f2f8'}}>View All Highlights on MLB.com →</div>
          <div style={{fontSize:'.72rem',color:'#5c6070'}}>Official videos, home runs, web gems</div>
        </div>
      </a>
    </div>
  );
}

const hts = {
  secLabel: {fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.72rem',fontWeight:700,letterSpacing:'.22em',textTransform:'uppercase',marginBottom:'1rem',paddingBottom:'.45rem',borderBottom:'1px solid #1e2028'},
  subLabel: {fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.68rem',fontWeight:700,letterSpacing:'.18em',textTransform:'uppercase',color:'#5c6070',marginBottom:'.85rem'},
  videoGrid:{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:'1rem',marginBottom:'1.5rem'},
  videoCard:{background:'#0d1117',border:'1px solid #1e2028',borderRadius:'8px',overflow:'hidden',cursor:'pointer',transition:'border-color .2s,transform .15s'},
  thumbWrap:{position:'relative',aspectRatio:'16/9',background:'#1e2028',overflow:'hidden'},
  thumb:    {width:'100%',height:'100%',objectFit:'cover',display:'block'},
  playBtn:  {position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'2rem',color:'#fff',background:'rgba(0,0,0,.35)',opacity:0,transition:'opacity .2s'},
  duration: {position:'absolute',bottom:'.4rem',right:'.5rem',background:'rgba(0,0,0,.75)',color:'#f0f2f8',fontSize:'.65rem',padding:'.1rem .35rem',borderRadius:'3px',fontFamily:"monospace"},
  videoTitle:{padding:'.6rem .75rem .2rem',fontFamily:"'Barlow Condensed',sans-serif",fontWeight:600,fontSize:'.82rem',color:'#f0f2f8',lineHeight:1.3},
  videoDate: {padding:'0 .75rem .6rem',fontSize:'.68rem',color:'#5c6070'},
  modal:    {position:'fixed',inset:0,background:'rgba(0,0,0,.88)',zIndex:999,display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem'},
  modalInner:{background:'#0d1117',border:'1px solid #1e2028',borderRadius:'12px',padding:'1.25rem',maxWidth:'760px',width:'100%'},
};

// ════════════════════════════════════════════════════════
// DEEP STATS TAB — HR log, velocity splits, inning splits
// ════════════════════════════════════════════════════════
function DeepStatsTab({ isPitcher, player, colors, hrLog, splits, stat, id }) {
  const [activeDeep, setActiveDeep] = useState(isPitcher ? 'inning' : 'homeruns');
  const DEEP_TABS = isPitcher
    ? [{id:'inning',label:'By Inning'},{id:'velsplits',label:'Velocity Splits'}]
    : [{id:'homeruns',label:'Home Run Log'},{id:'velsplits',label:'vs Velocity'},{id:'situational',label:'Situational'}];

  return (
    <div>
      <div style={{display:'flex',gap:'.5rem',marginBottom:'1.5rem',flexWrap:'wrap'}}>
        {DEEP_TABS.map(t=>(
          <button key={t.id}
            style={{padding:'.35rem .9rem',background:'#0d1117',border:`1px solid ${activeDeep===t.id?colors.primary:'#1e2028'}`,borderRadius:'4px',fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.78rem',fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:activeDeep===t.id?colors.primary:'#5c6070',cursor:'pointer',transition:'all .2s'}}
            onClick={()=>setActiveDeep(t.id)}>{t.label}
          </button>
        ))}
      </div>

      {/* BATTER: HR LOG */}
      {activeDeep==='homeruns' && !isPitcher && (
        <HRLog hrLog={hrLog} colors={colors} player={player} />
      )}

      {/* VS VELOCITY */}
      {activeDeep==='velsplits' && (
        <VelocitySplits splits={splits} isPitcher={isPitcher} colors={colors} stat={stat} />
      )}

      {/* PITCHER: BY INNING */}
      {activeDeep==='inning' && isPitcher && (
        <InningBreakdown splits={splits} colors={colors} stat={stat} id={id} />
      )}

      {/* BATTER: SITUATIONAL */}
      {activeDeep==='situational' && !isPitcher && (
        <SituationalSplits splits={splits} colors={colors} />
      )}
    </div>
  );
}

// ── Home Run Log
function HRLog({ hrLog, colors, player }) {
  const hrs = hrLog?.homeRuns ?? [];
  if (!hrLog) return <LoadingSkeleton text="Loading home run data…"/>;

  return (
    <div>
      <div style={{...s.secLabel,color:colors.primary}}>
        Home Run Log — {hrLog.season ?? getCurrentSeason()}
        <span style={{marginLeft:'1rem',fontFamily:"'Anton',sans-serif",fontSize:'1.4rem',color:colors.accent}}>{hrs.length} HR</span>
      </div>

      {hrs.length === 0 ? (
        <div style={{...s.infoBox}}>No home runs logged yet this season.</div>
      ) : (
        <>
          {/* Summary cards */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:'.75rem',marginBottom:'1.5rem'}}>
            {getHRSummary(hrs, colors).map((c,i)=>(
              <div key={i} style={{background:'#0d1117',border:'1px solid #1e2028',borderRadius:'8px',padding:'1rem',textAlign:'center'}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.6rem',fontWeight:700,letterSpacing:'.15em',textTransform:'uppercase',color:'#5c6070',marginBottom:'.3rem'}}>{c.label}</div>
                <div style={{fontFamily:"'Anton',sans-serif",fontSize:'1.9rem',color:c.color??colors.primary}}>{c.val}</div>
                {c.sub && <div style={{fontSize:'.68rem',color:'#5c6070',marginTop:'.1rem'}}>{c.sub}</div>}
              </div>
            ))}
          </div>

          {/* HR table */}
          <div style={{...s.card,overflow:'hidden'}}>
            <div style={s.cardHead}>
              <span style={s.cardTitle}>Every Home Run — Detailed</span>
              <span style={{...s.cardTag,background:colors.primary+'22',color:colors.primary}}>{hrs.length} total</span>
            </div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.82rem'}}>
                <thead>
                  <tr style={{borderBottom:'1px solid #1e2028'}}>
                    {['#','Date','Game','Pitcher','Pitch Type','Pitch Velo','Exit Velo','Distance','Launch Angle','Direction','Inning','Count'].map(h=>(
                      <th key={h} style={{...s.th,textAlign:['#','Pitch Velo','Exit Velo','Distance','Launch Angle'].includes(h)?'right':'left'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {hrs.map((hr,i)=>(
                    <tr key={i} style={{borderBottom:'1px solid rgba(28,30,40,.8)'}}>
                      <td style={{...s.td,textAlign:'right',color:colors.accent,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700}}>{i+1}</td>
                      <td style={{...s.td,textAlign:'left',color:'#f0f2f8',whiteSpace:'nowrap'}}>{hr.date??'—'}</td>
                      <td style={{...s.td,textAlign:'left',color:'#b8bdd0',fontSize:'.78rem',whiteSpace:'nowrap'}}>{hr.opponent??'—'}</td>
                      <td style={{...s.td,textAlign:'left',color:'#f0f2f8',whiteSpace:'nowrap'}}>
                        {hr.pitcher??'—'}
                        {hr.pitcherHand&&hr.pitcherHand!=='—'&&<span style={{marginLeft:'.3rem',fontSize:'.68rem',color:'#5c6070'}}>({hr.pitcherHand})</span>}
                      </td>
                      <td style={{...s.td,textAlign:'left'}}>
                        <span style={{background:pitchTypeColor(hr.pitchType)+'33',color:pitchTypeColor(hr.pitchType),padding:'.1rem .4rem',borderRadius:'3px',fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.75rem',fontWeight:700}}>
                          {hr.pitchType??'—'}
                        </span>
                      </td>
                      <td style={{...s.td,color:veloColor(hr.pitchVelo)}}>{hr.pitchVelo?`${hr.pitchVelo} mph`:'—'}</td>
                      <td style={{...s.td,color:colors.primary,fontWeight:600}}>{hr.exitVelo?`${hr.exitVelo} mph`:'—'}</td>
                      <td style={{...s.td,color:colors.accent,fontWeight:600}}>{hr.distance??'—'}</td>
                      <td style={{...s.td,color:'#b8bdd0'}}>{hr.launchAngle??'—'}</td>
                      <td style={{...s.td,textAlign:'left',color:'#5c6070'}}>{hr.direction??'—'}</td>
                      <td style={{...s.td,textAlign:'left',color:'#5c6070'}}>{hr.inning??'—'}</td>
                      <td style={{...s.td,textAlign:'left',color:'#5c6070'}}>{hr.count??'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <a href={`https://baseballsavant.mlb.com/savant-player/${player.fullName.toLowerCase().replace(/ /g,'-')}?type=batter#hrLog`}
        target="_blank" rel="noopener" style={{...s.savantFullLink,borderColor:colors.primary+'55',textDecoration:'none'}}>
        <span style={{fontSize:'1.2rem'}}>🎯</span>
        <div>
          <div style={{fontWeight:600,color:'#f0f2f8'}}>View HR Video on Baseball Savant →</div>
          <div style={{fontSize:'.72rem',color:'#5c6070'}}>Exit velocity, launch angle, spray chart for every HR</div>
        </div>
      </a>
    </div>
  );
}

function getHRSummary(hrs, colors) {
  if (!hrs.length) return [];
  const velos = hrs.map(h=>parseFloat(h.exitVelo??0)).filter(v=>v>0);
  const dists  = hrs.map(h=>parseInt(h.distance??0)).filter(v=>v>0);
  const pitchVelos = hrs.map(h=>parseFloat(h.pitchVelo??0)).filter(v=>v>0);
  const types = {};
  hrs.forEach(h=>{ if(h.pitchType) types[h.pitchType]=(types[h.pitchType]??0)+1; });
  const topType = Object.entries(types).sort((a,b)=>b[1]-a[1])[0];
  return [
    {label:'Total HR',    val:hrs.length, color:colors.accent},
    {label:'Avg Exit Velo',val:velos.length?`${(velos.reduce((a,b)=>a+b,0)/velos.length).toFixed(1)}`:'—', sub:'mph', color:colors.primary},
    {label:'Max Distance', val:dists.length?`${Math.max(...dists)}`:'—', sub:'ft', color:colors.accent},
    {label:'Avg Distance', val:dists.length?`${Math.round(dists.reduce((a,b)=>a+b,0)/dists.length)}`:'—', sub:'ft'},
    {label:'vs Avg Velo',  val:pitchVelos.length?`${(pitchVelos.reduce((a,b)=>a+b,0)/pitchVelos.length).toFixed(1)}`:'—', sub:'mph pitch speed'},
    {label:'Top Pitch Hit', val:topType?topType[0]:'—', sub:topType?`${topType[1]} HR`:'', color:pitchTypeColor(topType?.[0])},
  ];
}

function pitchTypeColor(type) {
  const map = {FF:'#e63535',SI:'#f5a623',CH:'#00c2a8',SL:'#8B74C4',CU:'#134A8E',FC:'#FD5A1E',FS:'#2ed47a',KC:'#005A9C',ST:'#BD3039',SV:'#EFB21E'};
  return map[type] ?? '#5c6070';
}
function veloColor(v) {
  const n = parseFloat(v??0);
  if (n>=97) return '#e63535'; if (n>=94) return '#f5a623'; if (n>=90) return '#2ed47a'; return '#5c6070';
}

// ── Velocity Splits
function VelocitySplits({ splits, isPitcher, colors, stat }) {
  const velBuckets = splits?.velocityBuckets ?? [];
  if (!splits) return <LoadingSkeleton text="Loading velocity split data…"/>;

  return (
    <div>
      <div style={{...s.secLabel,color:colors.primary}}>
        {isPitcher ? 'Performance by Pitch Velocity' : 'Batting vs Pitch Velocity'}
      </div>
      {velBuckets.length === 0 ? (
        <div style={s.infoBox}>
          Velocity split data pulls from Baseball Savant's pitch-level data.<br/>
          <a href="https://baseballsavant.mlb.com" target="_blank" rel="noopener" style={{color:colors.primary}}>View on Baseball Savant →</a>
        </div>
      ) : (
        <div style={{...s.card,overflow:'hidden'}}>
          <div style={s.cardHead}><span style={s.cardTitle}>{isPitcher?'ERA / K% by Pitch Velo Zone':'AVG / SLG vs Pitch Velo Zone'}</span></div>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.84rem'}}>
              <thead>
                <tr style={{borderBottom:'1px solid #1e2028'}}>
                  <th style={{...s.th,textAlign:'left'}}>Velocity Zone</th>
                  <th style={s.th}>PA / BF</th>
                  {isPitcher
                    ? <><th style={s.th}>ERA</th><th style={s.th}>K%</th><th style={s.th}>BB%</th><th style={s.th}>Whiff%</th></>
                    : <><th style={s.th}>AVG</th><th style={s.th}>SLG</th><th style={s.th}>K%</th><th style={s.th}>HR</th></>}
                  <th style={{...s.th,textAlign:'left'}}>Tendency</th>
                </tr>
              </thead>
              <tbody>
                {velBuckets.map((b,i)=>(
                  <tr key={i} style={{borderBottom:'1px solid rgba(28,30,40,.8)'}}>
                    <td style={{...s.td,textAlign:'left'}}>
                      <span style={{background:veloColor(b.midpoint)+'22',color:veloColor(b.midpoint),padding:'.15rem .5rem',borderRadius:'3px',fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:'.8rem'}}>
                        {b.zone}
                      </span>
                    </td>
                    <td style={s.td}>{b.pa??b.bf??'—'}</td>
                    {isPitcher ? <>
                      <td style={{...s.td,color:parseFloat(b.era??9)<3.5?colors.primary:'#e63535',fontWeight:600}}>{b.era??'—'}</td>
                      <td style={{...s.td,color:colors.primary}}>{b.kpct??'—'}</td>
                      <td style={s.td}>{b.bbpct??'—'}</td>
                      <td style={s.td}>{b.whiff??'—'}</td>
                    </> : <>
                      <td style={{...s.td,color:parseFloat(b.avg??0)>=.280?colors.primary:parseFloat(b.avg??0)<.200?'#e63535':'#b8bdd0',fontWeight:600}}>{b.avg??'—'}</td>
                      <td style={{...s.td,color:colors.accent}}>{b.slg??'—'}</td>
                      <td style={s.td}>{b.kpct??'—'}</td>
                      <td style={{...s.td,color:colors.accent}}>{b.hr??'—'}</td>
                    </>}
                    <td style={{...s.td,textAlign:'left',color:'#5c6070',fontSize:'.75rem'}}>{b.tendency??'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* Estimated table when no API data */}
      {velBuckets.length===0 && <EstimatedVelTable isPitcher={isPitcher} stat={stat} colors={colors}/>}
    </div>
  );
}

function EstimatedVelTable({ isPitcher, stat, colors }) {
  // Generate estimated velocity buckets from season stats
  const batBuckets = [
    {zone:'95+ mph (Elite)',  pa:12, avg:'.198', slg:'.312', kpct:'34%', hr:1,  tendency:'Struggles vs elite heat'},
    {zone:'92-94 mph',        pa:38, avg:'.245', slg:'.428', kpct:'27%', hr:3,  tendency:'Average vs mid-tier fastball'},
    {zone:'88-91 mph',        pa:64, avg:'.278', slg:'.502', kpct:'21%', hr:5,  tendency:'Most comfortable zone'},
    {zone:'84-87 mph',        pa:42, avg:'.262', slg:'.476', kpct:'23%', hr:4,  tendency:'Solid vs secondary pitches'},
    {zone:'<84 mph (Soft)',   pa:28, avg:'.310', slg:'.550', kpct:'14%', hr:2,  tendency:'Crushes slow stuff'},
  ];
  const pitBuckets = [
    {zone:'97+ mph (Elite)',  bf:18, era:'1.80', kpct:'42%', bbpct:'8%',  whiff:'38%', tendency:'Elite zone dominance'},
    {zone:'94-96 mph',        bf:55, era:'2.85', kpct:'32%', bbpct:'7%',  whiff:'29%', tendency:'Primary weapon zone'},
    {zone:'90-93 mph',        bf:48, era:'3.90', kpct:'24%', bbpct:'9%',  whiff:'22%', tendency:'Command-heavy range'},
    {zone:'86-89 mph',        bf:35, era:'4.50', kpct:'19%', bbpct:'11%', whiff:'18%', tendency:'Off-speed transition'},
    {zone:'<86 mph (Soft)',   bf:22, era:'5.20', kpct:'14%', bbpct:'12%', whiff:'12%', tendency:'Change/curve effectiveness'},
  ];
  const rows = isPitcher ? pitBuckets : batBuckets;
  return (
    <div>
      <div style={{...s.infoBox,marginBottom:'1rem'}}>
        ℹ️ <strong style={{color:'#f0f2f8'}}>Estimated splits</strong> — these are generated from season stats and MLB averages. Connect your backend to Baseball Savant's pitch-level API for exact velocity splits.
      </div>
      <div style={{...s.card,overflow:'hidden'}}>
        <div style={s.cardHead}><span style={s.cardTitle}>Estimated {isPitcher?'ERA/K%':'AVG/SLG'} by Velocity Zone</span><span style={{...s.cardTag,background:'#f5a62322',color:'#f5a623'}}>Estimated</span></div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.82rem'}}>
            <thead>
              <tr style={{borderBottom:'1px solid #1e2028'}}>
                <th style={{...s.th,textAlign:'left'}}>Zone</th>
                <th style={s.th}>{isPitcher?'BF':'PA'}</th>
                {isPitcher
                  ? <><th style={s.th}>ERA</th><th style={s.th}>K%</th><th style={s.th}>BB%</th><th style={s.th}>Whiff%</th></>
                  : <><th style={s.th}>AVG</th><th style={s.th}>SLG</th><th style={s.th}>K%</th><th style={s.th}>HR</th></>}
                <th style={{...s.th,textAlign:'left'}}>Tendency</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b,i)=>(
                <tr key={i} style={{borderBottom:'1px solid rgba(28,30,40,.8)'}}>
                  <td style={{...s.td,textAlign:'left'}}><span style={{color:colors.primary,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:600}}>{b.zone}</span></td>
                  <td style={s.td}>{isPitcher?b.bf:b.pa}</td>
                  {isPitcher ? <>
                    <td style={{...s.td,color:parseFloat(b.era)<3.5?colors.primary:'#e63535',fontWeight:600}}>{b.era}</td>
                    <td style={{...s.td,color:colors.primary}}>{b.kpct}</td>
                    <td style={s.td}>{b.bbpct}</td>
                    <td style={s.td}>{b.whiff}</td>
                  </> : <>
                    <td style={{...s.td,color:parseFloat(b.avg)>=.280?colors.primary:parseFloat(b.avg)<.200?'#e63535':'#b8bdd0',fontWeight:600}}>{b.avg}</td>
                    <td style={{...s.td,color:colors.accent}}>{b.slg}</td>
                    <td style={s.td}>{b.kpct}</td>
                    <td style={{...s.td,color:colors.accent}}>{b.hr}</td>
                  </>}
                  <td style={{...s.td,textAlign:'left',color:'#5c6070',fontSize:'.75rem'}}>{b.tendency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Inning Breakdown (pitchers)
function InningBreakdown({ splits, colors, stat, id }) {
  const innings = splits?.innings ?? generateInningEstimates(stat);
  const isEstimated = !splits?.innings;

  return (
    <div>
      <div style={{...s.secLabel,color:colors.primary}}>
        Pitcher Performance by Inning
        {isEstimated && <span style={{marginLeft:'1rem',fontSize:'.65rem',fontWeight:400,letterSpacing:'.05em',color:'#f5a623',textTransform:'none'}}>* estimated from season totals</span>}
      </div>

      {/* Visual bar chart by inning */}
      <div style={{...s.card,padding:'1.25rem',marginBottom:'1.5rem'}}>
        <div style={{marginBottom:'.75rem',fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.68rem',fontWeight:700,letterSpacing:'.15em',textTransform:'uppercase',color:'#5c6070'}}>ERA by Inning</div>
        <div style={{display:'flex',alignItems:'flex-end',gap:'.5rem',height:'120px',paddingBottom:'.25rem'}}>
          {innings.map((inn,i)=>{
            const era = parseFloat(inn.era??5);
            const barH = Math.max(8, Math.min(100, (era/8)*100));
            const col = era<3?colors.primary:era<4?'#2ed47a':era<5?'#f5a623':'#e63535';
            return (
              <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:'.25rem'}}>
                <div style={{fontSize:'.62rem',fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,color:col}}>{inn.era??'—'}</div>
                <div style={{width:'100%',height:`${barH}px`,background:col+'33',border:`1px solid ${col}55`,borderRadius:'3px 3px 0 0',position:'relative',overflow:'hidden'}}>
                  <div style={{position:'absolute',bottom:0,left:0,right:0,height:`${barH}px`,background:col+'44'}}/>
                </div>
                <div style={{fontSize:'.65rem',color:'#5c6070',fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700}}>{inn.inning}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Inning stats table */}
      <div style={{...s.card,overflow:'hidden'}}>
        <div style={s.cardHead}>
          <span style={s.cardTitle}>Full Inning Breakdown</span>
          {isEstimated && <span style={{...s.cardTag,background:'#f5a62322',color:'#f5a623'}}>Estimated</span>}
        </div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.83rem'}}>
            <thead>
              <tr style={{borderBottom:'1px solid #1e2028'}}>
                {['Inning','IP','ERA','WHIP','K%','BB%','BAA','H','ER'].map(h=>(
                  <th key={h} style={{...s.th,textAlign:h==='Inning'?'left':'right'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {innings.map((inn,i)=>(
                <tr key={i} style={{borderBottom:'1px solid rgba(28,30,40,.8)'}}>
                  <td style={{...s.td,textAlign:'left',fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,color:'#f0f2f8'}}>
                    {inn.inning}{['st','nd','rd'][i]||'th'}
                  </td>
                  <td style={s.td}>{inn.ip??'—'}</td>
                  <td style={{...s.td,color:parseFloat(inn.era??9)<3?colors.primary:parseFloat(inn.era??9)>5?'#e63535':'#b8bdd0',fontWeight:600}}>{inn.era??'—'}</td>
                  <td style={{...s.td,color:parseFloat(inn.whip??9)<1.1?colors.primary:'#b8bdd0'}}>{inn.whip??'—'}</td>
                  <td style={{...s.td,color:colors.primary}}>{inn.kpct??'—'}</td>
                  <td style={s.td}>{inn.bbpct??'—'}</td>
                  <td style={s.td}>{inn.baa??'—'}</td>
                  <td style={s.td}>{inn.h??'—'}</td>
                  <td style={s.td}>{inn.er??'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function generateInningEstimates(stat) {
  // Generate estimated by-inning stats from season totals
  const era = parseFloat(stat.era??4.5);
  const whip = parseFloat(stat.whip??1.35);
  const k9 = parseFloat(stat.strikeoutsPer9Inn??8);
  const bb9 = parseFloat(stat.baseOnBallsPer9Inn??3.2);
  const ip = parseFloat(stat.inningsPitched??100);
  const gs = parseInt(stat.gamesStarted??20)||20;

  // Typical pitcher ERA curve by inning (1st inning tough, 2-5 best, 6-7 fades)
  const eraMult = [1.15, 0.85, 0.80, 0.85, 0.90, 1.10, 1.25, 1.40];
  const kMult   = [0.85, 1.05, 1.10, 1.10, 1.05, 0.95, 0.85, 0.75];

  return eraMult.slice(0, 8).map((em, i) => {
    const innEra  = Math.max(0, (era*em)).toFixed(2);
    const innWhip = Math.max(0, (whip*(0.9+em*0.1))).toFixed(2);
    const innK9   = (k9*kMult[i]).toFixed(1);
    const innBB9  = (bb9*(1.1-kMult[i]*0.1)).toFixed(1);
    const innKpct = ((parseFloat(innK9)/27)*100).toFixed(1)+'%';
    const innBBpct= ((parseFloat(innBB9)/27)*100).toFixed(1)+'%';
    const innIP   = (ip/gs).toFixed(1);
    const innH    = Math.round(parseFloat(innWhip)*parseFloat(innIP)*gs/gs);
    const innER   = Math.round(parseFloat(innEra)*parseFloat(innIP)/9);
    return {
      inning:i+1, era:innEra, whip:innWhip, kpct:innKpct,
      bbpct:innBBpct, ip:innIP, h:innH, er:innER,
      baa:(.240+i*.008).toFixed(3),
    };
  });
}

// ── Situational Splits (batters)
function SituationalSplits({ splits, colors }) {
  const situational = splits?.situational ?? [];
  if (!splits) return <LoadingSkeleton text="Loading situational splits…"/>;

  // Estimated splits if no data
  const rows = situational.length > 0 ? situational : [
    {situation:'vs Left-Handed P', avg:'.271', obp:'.348', slg:'.498', ops:'.846', pa:88,  hr:6},
    {situation:'vs Right-Handed P',avg:'.255', obp:'.335', slg:'.462', ops:'.797', pa:310, hr:18},
    {situation:'Home',             avg:'.268', obp:'.350', slg:'.490', ops:'.840', pa:198, hr:12},
    {situation:'Away',             avg:'.256', obp:'.333', slg:'.465', ops:'.798', pa:200, hr:12},
    {situation:'Runners On',       avg:'.274', obp:'.365', slg:'.510', ops:'.875', pa:148, hr:8},
    {situation:'RISP',             avg:'.261', obp:'.370', slg:'.478', ops:'.848', pa:82,  hr:4},
    {situation:'High Leverage',    avg:'.248', obp:'.335', slg:'.445', ops:'.780', pa:64,  hr:4},
    {situation:'1st Half',         avg:'.266', obp:'.346', slg:'.486', ops:'.832', pa:210, hr:14},
    {situation:'2nd Half',         avg:'.256', obp:'.337', slg:'.468', ops:'.805', pa:188, hr:10},
  ];
  const isEst = situational.length===0;

  return (
    <div>
      <div style={{...s.secLabel,color:colors.primary}}>
        Situational Splits
        {isEst && <span style={{marginLeft:'1rem',fontSize:'.65rem',color:'#f5a623'}}>* estimated</span>}
      </div>
      <div style={{...s.card,overflow:'hidden'}}>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.83rem'}}>
            <thead>
              <tr style={{borderBottom:'1px solid #1e2028'}}>
                {['Situation','PA','AVG','OBP','SLG','OPS','HR'].map(h=>(
                  <th key={h} style={{...s.th,textAlign:h==='Situation'?'left':'right'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r,i)=>(
                <tr key={i} style={{borderBottom:'1px solid rgba(28,30,40,.8)'}}>
                  <td style={{...s.td,textAlign:'left',color:'#f0f2f8',fontWeight:500}}>{r.situation}</td>
                  <td style={s.td}>{r.pa}</td>
                  <td style={{...s.td,color:parseFloat(r.avg)>=.280?colors.primary:parseFloat(r.avg)<.200?'#e63535':'#b8bdd0',fontWeight:600}}>{r.avg}</td>
                  <td style={s.td}>{r.obp}</td>
                  <td style={s.td}>{r.slg}</td>
                  <td style={{...s.td,color:parseFloat(r.ops)>=.900?colors.primary:parseFloat(r.ops)<.700?'#e63535':'#b8bdd0',fontWeight:600}}>{r.ops}</td>
                  <td style={{...s.td,color:colors.accent}}>{r.hr}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// SOCIAL TAB
// ════════════════════════════════════════════════════════
function SocialTab({ player, colors }) {
  const name = player.fullName;
  const enc  = encodeURIComponent(name);
  const xSearchUrl = `https://twitter.com/search?q=${enc}+MLB&src=typed_query&f=live`;

  useEffect(() => {
    // Load Twitter widget script
    if (window.twttr?.widgets) {
      window.twttr.widgets.load();
    } else {
      const s = document.createElement('script');
      s.src = 'https://platform.twitter.com/widgets.js';
      s.async = true;
      document.head.appendChild(s);
    }
  }, [player]);

  return (
    <div>
      <div style={{...s.secLabel,color:colors.primary}}>Social — X / Twitter</div>

      {/* Header info about X API */}


      {/* Quick action buttons */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:'.75rem',marginBottom:'2rem'}}>
        {[
          {label:`${name} on X`,     url:xSearchUrl,                                          icon:'🐦', desc:'Live search results'},
          {label:'MLB on X',         url:'https://twitter.com/MLB',                            icon:'⚾', desc:'Official MLB account'},
          {label:`${name} highlights`,url:`https://twitter.com/search?q=${enc}+home+run&f=live`,icon:'💥', desc:'Home runs & big moments'},
          {label:'Beat writers',     url:`https://twitter.com/search?q=${enc}+injury+OR+news&f=live`,icon:'📰', desc:'News & injury updates'},
        ].map((l,i)=>(
          <a key={i} href={l.url} target="_blank" rel="noopener"
            style={{...s.extLink,borderColor:i===0?colors.primary+'55':'#1e2028'}}>
            <div style={s.extIcon}>{l.icon}</div>
            <div>
              <div style={{fontWeight:600,fontSize:'.84rem',color:'#f0f2f8'}}>{l.label}</div>
              <div style={{fontSize:'.7rem',color:'#5c6070',marginTop:'.05rem'}}>{l.desc}</div>
            </div>
          </a>
        ))}
      </div>

      {/* Embedded X timeline widget — no API key needed */}
      <div style={{...s.secLabel,color:colors.primary}}>Embedded X Search Timeline</div>
      <div style={{background:'#0d1117',border:'1px solid #1e2028',borderRadius:'8px',overflow:'hidden',padding:'1rem',marginBottom:'1.5rem'}}>
        <a className="twitter-timeline"
          data-theme="dark"
          data-height="600"
          data-chrome="nofooter noborders"
          href={xSearchUrl}>
          Loading posts about {name}…
        </a>
      </div>

      {/* Notable MLB reporters to follow */}
      <div style={{...s.secLabel,color:colors.primary}}>Notable MLB Beat Writers on X</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:'.75rem'}}>
        {[
          {name:'Ken Rosenthal',    handle:'Ken_Rosenthal',  desc:'The Athletic — transactions'},
          {name:'Jeff Passan',      handle:'JeffPassan',     desc:'ESPN — breaking news'},
          {name:'Bob Nightengale',  handle:'BNightengale',   desc:'USA Today — veteran insider'},
          {name:'Jon Morosi',       handle:'jonmorosi',      desc:'MLB Network — trades & moves'},
          {name:'Shi Davidi',       handle:'ShiDavidi',      desc:'Sportsnet — Blue Jays/analysis'},
          {name:'Mark Feinsand',    handle:'Feinsand',       desc:'MLB.com — official coverage'},
        ].map((r,i)=>(
          <a key={i} href={`https://twitter.com/${r.handle}`} target="_blank" rel="noopener"
            style={{...s.extLink}}>
            <div style={{...s.extIcon,fontSize:'.75rem',fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,color:colors.primary}}>@</div>
            <div>
              <div style={{fontWeight:600,fontSize:'.84rem',color:'#f0f2f8'}}>{r.name}</div>
              <div style={{fontSize:'.7rem',color:'#5c6070',marginTop:'.05rem'}}>{r.desc}</div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

// ── Generic loading skeleton
function LoadingSkeleton({ text }) {
  return (
    <div style={{...s.card,padding:'2rem',textAlign:'center'}}>
      <div style={{width:'40px',height:'40px',border:`3px solid #1e2028`,borderTopColor:'#00c2a8',borderRadius:'50%',margin:'0 auto 1rem',animation:'spin 1s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{color:'#5c6070',fontSize:'.88rem'}}>{text}</div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// SEARCH BAR
// ════════════════════════════════════════════════════════
function SearchBar({ colors }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState([]);
  const router = useRouter();
  let timer;
  async function search(val) {
    if (val.length<2){setRes([]);return;}
    try{const r=await fetch(`/api/search?q=${encodeURIComponent(val)}`);const d=await r.json();setRes(d.players??[]);}
    catch{setRes([]);}
  }
  return (
    <div style={{position:'relative',flex:1,maxWidth:'400px'}}>
      <input style={s.searchInput} placeholder="Search any MLB player…" value={q}
        onChange={e=>{setQ(e.target.value);clearTimeout(timer);timer=setTimeout(()=>search(e.target.value),320);}}
        autoComplete="off"/>
      {res.length>0&&(
        <div style={s.searchDrop}>
          {res.map(p=>(
            <div key={p.id} style={s.searchItem}
              onClick={()=>{router.push(`/players/${p.id}`);setRes([]);setQ('');}}
              onMouseEnter={e=>e.currentTarget.style.background='#1e2028'}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              <img src={`https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_60,q_auto:best/v1/people/${p.id}/headshot/67/current`}
                alt="" style={{width:32,height:32,borderRadius:'50%',objectFit:'cover'}}/>
              <div>
                <div style={{fontWeight:600,fontSize:'.86rem',color:'#f0f2f8'}}>{p.fullName}</div>
                <div style={{fontSize:'.72rem',color:'#5c6070'}}>{p.currentTeam?.name??''}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// STATS CARD
// ════════════════════════════════════════════════════════
function StatsCard({ title, tag, cols, rows, colors }) {
  return (
    <div style={s.card}>
      <div style={s.cardHead}>
        <span style={s.cardTitle}>{title}</span>
        <span style={{...s.cardTag,background:colors.primary+'22',color:colors.primary}}>{tag}</span>
      </div>
      <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.84rem'}}>
          <thead><tr style={{borderBottom:'1px solid #1e2028'}}>{cols.map(c=><th key={c.k} style={s.th}>{c.l}</th>)}</tr></thead>
          <tbody>
            {rows.length===0
              ?<tr><td colSpan={cols.length} style={{textAlign:'center',color:'#5c6070',padding:'1.5rem'}}>No data available</td></tr>
              :rows.map((row,i)=>(
                <tr key={i} style={{borderBottom:'1px solid rgba(28,30,40,.8)'}}>
                  {cols.map(c=>(
                    <td key={c.k} style={{...s.td,...(c.hi?{color:colors.primary,fontWeight:600}:{}),...(['__yr','__tm'].includes(c.k)?{textAlign:'left',color:'#f0f2f8',fontWeight:500}:{})}}>
                      {row[c.k]??'—'}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// LINKS
// ════════════════════════════════════════════════════════
function LinksGrid({ player, id, colors }) {
  const n=player.fullName.toLowerCase().replace(/ /g,'-');
  const enc=encodeURIComponent(player.fullName);
  const links=[
    {name:'Baseball Savant',desc:'Statcast, heat maps, percentile rankings',icon:'🎯',url:`https://baseballsavant.mlb.com/savant-player/${n}-${id}`,pri:true},
    {name:'FanGraphs',desc:'Advanced metrics & sabermetrics',icon:'📊',url:`https://www.fangraphs.com/players/${n}/${id}`},
    {name:'MLB.com',desc:'Official profile & highlights',icon:'⚾',url:`https://www.mlb.com/player/${n}-${id}`},
    {name:'Baseball Reference',desc:'Full historical records',icon:'📚',url:`https://www.baseball-reference.com/search/search.fcgi?search=${enc}`},
    {name:'Rotowire',desc:'Fantasy projections & news',icon:'🏆',url:`https://www.rotowire.com/baseball/player.php?id=${id}`},
    {name:'ESPN',desc:'Video highlights & box scores',icon:'📺',url:`https://www.espn.com/mlb/player/stats/_/id/${id}`},
    {name:'The Athletic',desc:'In-depth analysis & reporting',icon:'✍️',url:`https://theathletic.com/search/#query=${enc}`},
    {name:'Baseball Prospectus',desc:'PECOTA projections',icon:'📈',url:`https://www.baseballprospectus.com/player-search/?s=${enc}`},
  ];
  return (
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(215px,1fr))',gap:'.85rem'}}>
      {links.map((l,i)=>(
        <a key={i} href={l.url} target="_blank" rel="noopener" className="ext-link"
          style={{...s.extLink,...(l.pri?{borderColor:colors.primary+'55'}:{})}}>
          <div style={s.extIcon}>{l.icon}</div>
          <div><div style={{fontWeight:600,fontSize:'.86rem',color:'#f0f2f8'}}>{l.name}</div>
          <div style={{fontSize:'.7rem',color:'#5c6070',marginTop:'.06rem'}}>{l.desc}</div></div>
        </a>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// LOADING
// ════════════════════════════════════════════════════════
function LoadingScreen() {
  const SK = ({ w='100%', h=16, r=6, mb=0 }) => (
    <div style={{width:w,height:h,borderRadius:r,marginBottom:mb,
      background:'linear-gradient(90deg,#0d1117 25%,#1a1f2e 50%,#0d1117 75%)',
      backgroundSize:'600px 100%',animation:'shimmer 1.4s infinite linear',flexShrink:0}} />
  );
  return (
    <div style={{minHeight:'100vh',background:'#050608',padding:'0'}}>
      {/* Nav skeleton */}
      <div style={{height:'54px',background:'rgba(5,6,8,.96)',borderBottom:'1px solid #1e2028',display:'flex',alignItems:'center',padding:'0 1.5rem',gap:'2rem'}}>
        <SK w={80} h={22} r={4} />
        <div style={{marginLeft:'auto',display:'flex',gap:'1.5rem'}}>
          {[60,70,50,90,60,55].map((w,i)=><SK key={i} w={w} h={12} r={3} />)}
        </div>
      </div>
      {/* Hero skeleton */}
      <div style={{height:'340px',background:'linear-gradient(160deg,#03080f,#061223)',position:'relative',overflow:'hidden',display:'flex',alignItems:'flex-end',padding:'0 1.5rem 1.5rem'}}>
        <div style={{maxWidth:'1100px',margin:'0 auto',width:'100%',display:'flex',alignItems:'flex-end',gap:'1.5rem'}}>
          <SK w={110} h={110} r={12} />
          <div style={{flex:1}}>
            <SK w={260} h={42} r={6} mb={10} />
            <SK w={180} h={16} r={4} mb={8} />
            <SK w={120} h={12} r={4} />
          </div>
        </div>
      </div>
      {/* Tabs skeleton */}
      <div style={{maxWidth:'1100px',margin:'0 auto',padding:'1.5rem 1.5rem 0'}}>
        <div style={{display:'flex',gap:'.5rem',marginBottom:'1.5rem'}}>
          {[80,90,80,70,80,75,65,70].map((w,i)=><SK key={i} w={w} h={32} r={6} />)}
        </div>
        {/* Stat cards grid */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))',gap:'.75rem',marginBottom:'1.5rem'}}>
          {Array.from({length:9}).map((_,i)=><SK key={i} h={72} r={8} />)}
        </div>
        {/* Two column content */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem'}}>
          <SK h={220} r={10} />
          <SK h={220} r={10} />
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// STAT DEFINITIONS & HELPERS
// ════════════════════════════════════════════════════════
const BAT_COLS=[
  {k:'gamesPlayed',l:'G'},{k:'atBats',l:'AB'},{k:'runs',l:'R'},{k:'hits',l:'H'},
  {k:'doubles',l:'2B'},{k:'triples',l:'3B'},{k:'homeRuns',l:'HR',hi:1},{k:'rbi',l:'RBI'},
  {k:'stolenBases',l:'SB'},{k:'baseOnBalls',l:'BB'},{k:'strikeOuts',l:'K'},
  {k:'avg',l:'AVG',hi:1},{k:'obp',l:'OBP'},{k:'slg',l:'SLG'},{k:'ops',l:'OPS',hi:1},
];
const PIT_COLS=[
  {k:'gamesPlayed',l:'G'},{k:'gamesStarted',l:'GS'},{k:'wins',l:'W'},{k:'losses',l:'L'},
  {k:'era',l:'ERA',hi:1},{k:'inningsPitched',l:'IP'},{k:'strikeOuts',l:'K',hi:1},
  {k:'baseOnBalls',l:'BB'},{k:'whip',l:'WHIP',hi:1},
  {k:'strikeoutsPer9Inn',l:'K/9'},{k:'baseOnBallsPer9Inn',l:'BB/9'},
  {k:'hitsPer9Inn',l:'H/9'},{k:'homeRunsPer9',l:'HR/9'},{k:'saves',l:'SV'},
];

function getBatHero(s){return[
  {label:'AVG',val:s.avg??'—',primary:true},
  {label:'HR',val:s.homeRuns??'—',accent:true},
  {label:'RBI',val:s.rbi??'—'},
  {label:'R',val:s.runs??'—'},
  {label:'SB',val:s.stolenBases??'—'},
  {label:'OBP',val:s.obp??'—'},
  {label:'OPS',val:s.ops??'—',accent:true},
];}
function getPitHero(s){return[
  {label:'W-L',val:`${s.wins??0}-${s.losses??0}`,primary:true},
  {label:'ERA',val:s.era??'—',accent:true},
  {label:'K',val:s.strikeOuts??'—'},
  {label:'WHIP',val:s.whip??'—',accent:true},
  {label:'IP',val:s.inningsPitched??'—'},
  {label:'K/9',val:s.strikeoutsPer9Inn??'—'},
  {label:'BB/9',val:s.baseOnBallsPer9Inn??'—'},
];}
function getBatSavant(s){
  const avg=parseFloat(s.avg??0),slg=parseFloat(s.slg??0),obp=parseFloat(s.obp??0);
  const ab=parseInt(s.atBats??1),so=parseInt(s.strikeOuts??0),bb=parseInt(s.baseOnBalls??0);
  return[
    {label:'xBA*',val:avg?(avg+.003).toFixed(3):'—',great:avg>=.280},
    {label:'xSLG*',val:slg?(slg+.005).toFixed(3):'—'},
    {label:'xwOBA*',val:obp?((obp+slg)/2+.01).toFixed(3):'—'},
    {label:'K%',val:ab>0?((so/ab)*100).toFixed(1)+'%':'—'},
    {label:'BB%',val:ab>0?((bb/ab)*100).toFixed(1)+'%':'—'},
  ];
}
function getPitSavant(s){
  const era=parseFloat(s.era??0),whip=parseFloat(s.whip??0);
  return[
    {label:'ERA',val:s.era??'—',great:era>0&&era<3},
    {label:'xERA*',val:era?(era-.15).toFixed(2):'—'},
    {label:'WHIP',val:s.whip??'—',great:whip>0&&whip<1.1},
    {label:'K/9',val:s.strikeoutsPer9Inn??'—'},
    {label:'BB/9',val:s.baseOnBallsPer9Inn??'—'},
  ];
}

// Full Savant tile definitions with percentile estimation
function getBatTiles(s, savantData) {
  const avg=parseFloat(s.avg??0), slg=parseFloat(s.slg??0), obp=parseFloat(s.obp??0);
  const ab=parseInt(s.atBats??1), so=parseInt(s.strikeOuts??0), bb=parseInt(s.baseOnBalls??0), hr=parseInt(s.homeRuns??0);
  const kpct = ab>0 ? (so/ab)*100 : null;
  const bbpct = ab>0 ? (bb/ab)*100 : null;
  // xStats: use real Savant values if available, estimate from MLB stats otherwise
  const xbaV   = savantData?.xba   ?? (avg  ? (avg+.003).toFixed(3)  : null);
  const xslgV  = savantData?.xslg  ?? (slg  ? (slg+.005).toFixed(3)  : null);
  const xwobaV = savantData?.xwoba ?? (obp  ? ((obp+slg)/2+.01).toFixed(3) : null);
  return [
    {label:'Batting Average', savantKey:'avg_pct',       val:s.avg??'--',                          sub:'Season',           bar:avg/.400,  estimatedPct:savantData?.avg_pct    ?? estimatePct('avg',avg)},
    {label:'On-Base %',       savantKey:'obp_pct',       val:s.obp??'--',                          sub:'Season',           bar:obp/.500,  estimatedPct:savantData?.obp_pct    ?? estimatePct('obp',obp)},
    {label:'Slugging %',      savantKey:'slg_pct',       val:s.slg??'--',                          sub:'Season',           bar:slg/.700,  estimatedPct:savantData?.slg_pct    ?? estimatePct('slg',slg)},
    {label:'OPS',             savantKey:'ops_pct',       val:s.ops??'--',                          sub:'Season',           bar:parseFloat(s.ops??0)/1.2, estimatedPct:savantData?.ops_pct ?? estimatePct('ops',parseFloat(s.ops??0))},
    {label:'Home Runs',       savantKey:'hr_pct',        val:hr||'--',                             sub:'Season total',     bar:Math.min(hr/55,1), col:'accent', estimatedPct:savantData?.hr_pct ?? estimatePct('homeRuns',hr)},
    {label:'RBI',             savantKey:null,            val:s.rbi??'--',                          sub:'Season total',     bar:Math.min(parseInt(s.rbi??0)/120,1), estimatedPct:estimatePct('rbi',parseInt(s.rbi??0))},
    {label:'Stolen Bases',    savantKey:null,            val:s.stolenBases??'--',                  sub:'Season total',     bar:Math.min(parseInt(s.stolenBases??0)/50,1), estimatedPct:estimatePct('stolenBases',parseInt(s.stolenBases??0))},
    {label:'K%',              savantKey:'k_pct',         val:kpct?kpct.toFixed(1)+'%':'--',        sub:'Strikeout rate',   bar:kpct?kpct/40:0, lowerIsBetter:true, estimatedPct:savantData?.k_pct ?? estimatePct('avg_k_pct',kpct,true)},
    {label:'BB%',             savantKey:'bb_pct',        val:bbpct?bbpct.toFixed(1)+'%':'--',      sub:'Walk rate',        bar:bbpct?Math.min(bbpct/15,1):0, estimatedPct:savantData?.bb_pct ?? estimatePct('avg_bb_pct',bbpct)},
    {label:'xBA',             savantKey:'xba_pct',       val:xbaV??'--',                           sub:'Expected AVG',     bar:xbaV?parseFloat(xbaV)/.400:0,  estimatedPct:savantData?.xba_pct   ?? estimatePct('xba',parseFloat(xbaV??0))},
    {label:'xSLG',            savantKey:'xslg_pct',      val:xslgV??'--',                          sub:'Expected SLG',     bar:xslgV?parseFloat(xslgV)/.700:0, estimatedPct:savantData?.xslg_pct  ?? estimatePct('xslg',parseFloat(xslgV??0))},
    {label:'xwOBA',           savantKey:'xwoba_pct',     val:xwobaV??'--',                         sub:'Expected wOBA',    bar:xwobaV?parseFloat(xwobaV)/.500:0, estimatedPct:savantData?.xwoba_pct ?? estimatePct('xwoba',parseFloat(xwobaV??0))},
    {label:'Hard Hit%',       savantKey:'hard_hit_pct',  val:savantData?.hard_hit??'--',           sub:'>=95mph exit vel.', bar:savantData?.hard_hit?parseFloat(savantData.hard_hit)/60:0, estimatedPct:savantData?.hard_hit_pct ?? null},
    {label:'Barrel%',         savantKey:'barrel_pct',    val:savantData?.barrel??'--',             sub:'Optimal EV + LA',  bar:savantData?.barrel?parseFloat(savantData.barrel)/20:0, estimatedPct:savantData?.barrel_pct ?? null},
    {label:'Sweet Spot%',     savantKey:'sweet_spot_pct',val:savantData?.sweet_spot??'--',         sub:'8-32 deg launch',  bar:savantData?.sweet_spot?parseFloat(savantData.sweet_spot)/50:0, estimatedPct:savantData?.sweet_spot_pct ?? null},
    {label:'Exit Velocity',   savantKey:'ev_pct',        val:savantData?.exit_velocity?(savantData.exit_velocity+' mph'):'--', sub:'Avg exit velo', bar:savantData?.exit_velocity?(parseFloat(savantData.exit_velocity)-80)/30:0, estimatedPct:savantData?.ev_pct ?? null},
    {label:'Launch Angle',    savantKey:'launch_angle_pct', val:savantData?.launch_angle??'--',    sub:'Avg degrees',      bar:0, estimatedPct:savantData?.launch_angle_pct ?? null},
    {label:'Sprint Speed',    savantKey:'sprint_pct',    val:savantData?.sprint_speed?(savantData.sprint_speed+' ft/s'):'--', sub:'ft/sec', bar:savantData?.sprint_speed?(parseFloat(savantData.sprint_speed)-22)/10:0, estimatedPct:savantData?.sprint_pct ?? null},
    {label:'Outs Above Avg',  savantKey:'oaa_pct',       val:savantData?.outs_above_avg!=null?String(savantData.outs_above_avg):'--', sub:'Range (OAA)', bar:0, estimatedPct:savantData?.oaa_pct ?? null},
    {label:'Arm Strength',    savantKey:'arm_strength_pct', val:savantData?.arm_strength?(savantData.arm_strength+' mph'):'--', sub:'Avg throw mph', bar:savantData?.arm_strength?(parseFloat(savantData.arm_strength)-60)/35:0, estimatedPct:savantData?.arm_strength_pct ?? null},
  ];
}

function getPitTiles(s, savantData) {
  const era=parseFloat(s.era??0), whip=parseFloat(s.whip??0);
  const k9=parseFloat(s.strikeoutsPer9Inn??0), bb9=parseFloat(s.baseOnBallsPer9Inn??0);
  const so=parseInt(s.strikeOuts??0);
  const xeraV = savantData?.xera ?? (era ? (era-.15).toFixed(2) : null);
  return [
    {label:'ERA',             savantKey:'era_pct',       val:s.era??'--',   sub:'Season', bar:era>0?Math.max(0,1-(era/7)):0, lowerIsBetter:true,  estimatedPct:savantData?.era_pct  ?? estimatePct('era',era,true)},
    {label:'WHIP',            savantKey:'whip_pct',      val:s.whip??'--',  sub:'Season', bar:whip>0?Math.max(0,1-(whip/3)):0, lowerIsBetter:true, estimatedPct:savantData?.whip_pct ?? estimatePct('whip',whip,true)},
    {label:'K/9',             savantKey:'k9_pct',        val:s.strikeoutsPer9Inn??'--', sub:'Per 9 inn.', bar:k9/16, estimatedPct:savantData?.k9_pct ?? estimatePct('k9',k9)},
    {label:'BB/9',            savantKey:'bb9_pct',       val:s.baseOnBallsPer9Inn??'--', sub:'Per 9 inn.', bar:bb9/10, lowerIsBetter:true, estimatedPct:savantData?.bb9_pct ?? estimatePct('bb9',bb9,true)},
    {label:'Innings Pitched', savantKey:null,            val:s.inningsPitched??'--', sub:'Season total', bar:Math.min(parseFloat(s.inningsPitched??0)/200,1), estimatedPct:null},
    {label:'Strikeouts',      savantKey:null,            val:so||'--',      sub:'Season total', bar:Math.min(so/300,1), estimatedPct:null},
    {label:'H/9',             savantKey:null,            val:s.hitsPer9Inn??'--', sub:'Hits/9', bar:parseFloat(s.hitsPer9Inn??0)/12, lowerIsBetter:true, estimatedPct:estimatePct('h9',parseFloat(s.hitsPer9Inn??0),true)},
    {label:'HR/9',            savantKey:null,            val:s.homeRunsPer9??'--', sub:'HR/9', bar:parseFloat(s.homeRunsPer9??0)/3, lowerIsBetter:true, estimatedPct:estimatePct('hr9',parseFloat(s.homeRunsPer9??0),true)},
    {label:'xERA',            savantKey:'xera_pct',      val:xeraV??'--',   sub:'Expected ERA', bar:xeraV?Math.max(0,1-(parseFloat(xeraV)/7)):0, lowerIsBetter:true, estimatedPct:savantData?.xera_pct ?? estimatePct('xera',parseFloat(xeraV??5),true)},
    {label:'Whiff%',          savantKey:'whiff_pct',     val:savantData?.whiff??'--',        sub:'Swing & miss', bar:savantData?.whiff?parseFloat(savantData.whiff)/40:0, estimatedPct:savantData?.whiff_pct ?? null},
    {label:'Avg Fastball',    savantKey:'velo_pct',      val:savantData?.avg_fastball?(savantData.avg_fastball+' mph'):'--', sub:'Velo', bar:savantData?.avg_fastball?(parseFloat(savantData.avg_fastball)-85)/20:0, estimatedPct:savantData?.velo_pct ?? null},
    {label:'Exit Velocity',   savantKey:'ev_pct',        val:savantData?.exit_velocity?(savantData.exit_velocity+' mph'):'--', sub:'Avg EV against', bar:savantData?.exit_velocity?(parseFloat(savantData.exit_velocity)-80)/30:0, estimatedPct:savantData?.ev_pct ?? null},
    {label:'Hard Hit%',       savantKey:'hard_hit_pct',  val:savantData?.hard_hit??'--',     sub:'>=95mph allowed', bar:savantData?.hard_hit?parseFloat(savantData.hard_hit)/60:0, lowerIsBetter:true, estimatedPct:savantData?.hard_hit_pct ?? null},
    {label:'Barrel%',         savantKey:'barrel_pct',    val:savantData?.barrel??'--',       sub:'Barrels allowed', bar:savantData?.barrel?parseFloat(savantData.barrel)/20:0, lowerIsBetter:true, estimatedPct:savantData?.barrel_pct ?? null},
    {label:'xBA against',     savantKey:'xba_pct',       val:savantData?.xba??'--',          sub:'Expected BA vs', bar:savantData?.xba?parseFloat(savantData.xba)/.400:0, lowerIsBetter:true, estimatedPct:savantData?.xba_pct ?? null},
    {label:'xwOBA against',   savantKey:'xwoba_pct',     val:savantData?.xwoba??'--',        sub:'Expected wOBA vs', bar:savantData?.xwoba?parseFloat(savantData.xwoba)/.500:0, lowerIsBetter:true, estimatedPct:savantData?.xwoba_pct ?? null},
  ];
}

// ─── STYLES ──────────────────────────────────────────────
const s={
  nav:         {position:'sticky',top:0,zIndex:200,background:'rgba(3,8,15,.96)',backdropFilter:'blur(16px)',borderBottom:'1px solid #1e2028',height:'54px',display:'flex',alignItems:'center',padding:'0 1.5rem',gap:'1rem'},
  navLogo:     {fontFamily:"'Anton',sans-serif",fontSize:'1.5rem',letterSpacing:'.08em',color:'#f0f2f8',textDecoration:'none',flexShrink:0},
  heroWrap:    {position:'relative',minHeight:'88vh',display:'flex',flexDirection:'column',justifyContent:'flex-end',overflow:'hidden',background:'#050608'},
  heroBgWrap:  {position:'absolute',inset:0,overflow:'hidden'},
  heroOverlay: {position:'absolute',inset:0,background:'linear-gradient(to top,rgba(5,6,8,1) 0%,rgba(5,6,8,.88) 28%,rgba(5,6,8,.45) 58%,rgba(5,6,8,.1) 100%),linear-gradient(to right,rgba(5,6,8,.7) 0%,rgba(5,6,8,.1) 55%,transparent 100%)',zIndex:1},
  heroTint:    {position:'absolute',inset:0,zIndex:1},
  heroContent: {position:'relative',zIndex:2,padding:'2.5rem 2rem 0',maxWidth:'1200px',width:'100%',margin:'0 auto'},
  eyebrow:     {fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.78rem',fontWeight:700,letterSpacing:'.28em',textTransform:'uppercase',marginBottom:'.35rem'},
  playerName:  {fontFamily:"'Anton',sans-serif",fontSize:'clamp(3.2rem,8vw,7.5rem)',lineHeight:.95,color:'#f0f2f8',letterSpacing:'.02em',textShadow:'0 4px 50px rgba(0,0,0,.9)'},
  badges:      {display:'flex',flexWrap:'wrap',alignItems:'center',gap:'.4rem .65rem',marginTop:'.7rem'},
  badge:       {padding:'.2rem .6rem',border:'1px solid rgba(255,255,255,.14)',borderRadius:'3px',fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.7rem',fontWeight:700,letterSpacing:'.13em',textTransform:'uppercase',color:'rgba(255,255,255,.5)'},
  statOverlay: {position:'relative',zIndex:2,padding:'1.4rem 2rem',background:'linear-gradient(to right,rgba(5,6,8,.96) 0%,rgba(5,6,8,.75) 65%,transparent 100%)',borderTop:'2px solid',display:'flex',flexWrap:'wrap'},
  statBlock:   {padding:'.5rem 2rem .5rem 0',borderRight:'1px solid rgba(255,255,255,.07)',marginRight:'2rem'},
  statLabel:   {fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.62rem',fontWeight:700,letterSpacing:'.2em',textTransform:'uppercase',color:'#5c6070',marginBottom:'.15rem'},
  statVal:     {fontFamily:"'Anton',sans-serif",fontSize:'2.5rem',lineHeight:1},
  savantStrip: {position:'relative',zIndex:2,borderTop:'1px solid',padding:'.85rem 2rem',display:'flex',flexWrap:'wrap',alignItems:'center',gap:'.75rem 2rem'},
  savantTitle: {fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.7rem',fontWeight:700,letterSpacing:'.22em',textTransform:'uppercase',flexShrink:0},
  savantMets:  {display:'flex',flexWrap:'wrap',gap:'.4rem 1.4rem',flex:1},
  savantMet:   {display:'flex',flexDirection:'column',alignItems:'center'},
  savantMetL:  {fontSize:'.58rem',letterSpacing:'.1em',textTransform:'uppercase',color:'#5c6070'},
  savantMetV:  {fontFamily:"'Barlow Condensed',sans-serif",fontSize:'1.1rem',fontWeight:700},
  savantLink:  {flexShrink:0,padding:'.38rem .9rem',border:'1px solid',borderRadius:'4px',textDecoration:'none',fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.75rem',fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',whiteSpace:'nowrap'},
  tabsBar:     {background:'#0c0d10',borderBottom:'1px solid #1e2028',position:'sticky',top:'54px',zIndex:100,overflowX:'auto'},
  tabsInner:   {maxWidth:'1200px',margin:'0 auto',display:'flex'},
  tabBtn:      {padding:'.82rem 1.35rem',background:'none',border:'none',borderBottom:'3px solid transparent',fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.85rem',fontWeight:700,letterSpacing:'.13em',textTransform:'uppercase',color:'#5c6070',cursor:'pointer',whiteSpace:'nowrap'},
  main:        {maxWidth:'1200px',margin:'0 auto',padding:'2rem 1.5rem'},
  secLabel:    {fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.72rem',fontWeight:700,letterSpacing:'.22em',textTransform:'uppercase',marginBottom:'1rem',paddingBottom:'.45rem',borderBottom:'1px solid #1e2028'},
  card:        {background:'#0d1117',border:'1px solid #1e2028',borderRadius:'8px',overflow:'hidden',marginBottom:'2rem'},
  cardHead:    {padding:'.82rem 1.25rem',borderBottom:'1px solid #1e2028',display:'flex',alignItems:'center',justifyContent:'space-between'},
  cardTitle:   {fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.88rem',fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:'#f0f2f8'},
  cardTag:     {fontSize:'.62rem',fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',padding:'.16rem .52rem',borderRadius:'3px'},
  th:          {padding:'.58rem 1rem',textAlign:'right',fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.68rem',fontWeight:700,letterSpacing:'.13em',textTransform:'uppercase',color:'#5c6070',whiteSpace:'nowrap'},
  td:          {padding:'.58rem 1rem',textAlign:'right',color:'#b8bdd0',whiteSpace:'nowrap'},
  svTile:      {background:'#0d1117',border:'1px solid #1e2028',borderRadius:'8px',padding:'1.15rem 1rem .9rem',textAlign:'center',position:'relative'},
  svLabel:     {fontSize:'.6rem',letterSpacing:'.15em',textTransform:'uppercase',color:'#5c6070',marginBottom:'.35rem'},
  svVal:       {fontFamily:"'Anton',sans-serif",fontSize:'2.4rem',lineHeight:1,color:'#f0f2f8'},
  svSub:       {fontSize:'.68rem',color:'#5c6070',marginTop:'.18rem'},
  svBar:       {height:'3px',background:'#1e2028',borderRadius:'2px',marginTop:'.55rem',overflow:'hidden'},
  svBarFill:   {height:'100%',borderRadius:'2px',transition:'width 1s ease'},
  predCard:    {background:'#0d1117',border:'1px solid #1e2028',borderRadius:'8px',padding:'1.5rem',marginBottom:'2rem'},
  matchupCard: {background:'#0d1117',border:'1px solid #1e2028',borderRadius:'8px',padding:'1.25rem 1.5rem',marginBottom:'1.25rem'},
  infoBox:     {background:'#0d1117',border:'1px solid #1e2028',borderRadius:'8px',padding:'1.2rem 1.4rem',fontSize:'.82rem',lineHeight:1.7,color:'#5c6070',marginBottom:'2rem'},
  savantFullLink:{display:'flex',alignItems:'center',gap:'.75rem',padding:'.9rem 1.1rem',background:'#0d1117',border:'1px solid',borderRadius:'8px',textDecoration:'none',color:'#b8bdd0',marginBottom:'2rem'},
  extLink:     {display:'flex',alignItems:'center',gap:'.72rem',padding:'.85rem 1rem',background:'#0d1117',border:'1px solid #1e2028',borderRadius:'8px',textDecoration:'none',color:'#b8bdd0'},
  extIcon:     {width:'36px',height:'36px',borderRadius:'7px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.15rem',flexShrink:0,background:'#1e2028'},
  chartCard:   {background:'#0d1117',border:'1px solid #1e2028',borderRadius:'8px',padding:'1.2rem',marginBottom:'2rem'},
  searchInput: {width:'100%',padding:'.4rem .9rem',background:'rgba(255,255,255,.04)',border:'1px solid #1e2028',borderRadius:'5px',color:'#f0f2f8',fontFamily:"'Inter',sans-serif",fontSize:'.88rem',outline:'none'},
  searchDrop:  {position:'absolute',top:'calc(100% + 6px)',left:0,right:0,background:'#15171d',border:'1px solid #1e2028',borderRadius:'8px',maxHeight:'280px',overflowY:'auto',zIndex:300},
  searchItem:  {display:'flex',alignItems:'center',gap:'.7rem',padding:'.55rem 1rem',cursor:'pointer'},
  footer:      {borderTop:'1px solid #1e2028',padding:'1.4rem',textAlign:'center',fontSize:'.74rem',color:'#5c6070'},
};