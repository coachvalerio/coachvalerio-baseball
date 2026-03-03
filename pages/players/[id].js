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
    { id: 'savant',     label: 'Statcast / Savant' },
    { id: 'career',     label: 'Career' },
    { id: 'trends',     label: 'Trends & Odds' },
    { id: 'prediction', label: 'Prediction' },
    { id: 'links',      label: 'Links' },
  ];

  return (
    <>
      <Head>
        <title>{player.fullName} — CoachValerio</title>
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@300;400;500;600&family=Barlow+Condensed:wght@400;600;700;900&display=swap" rel="stylesheet" />
        <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js" />
        <style>{`
          *{box-sizing:border-box;margin:0;padding:0}
          body{background:#050608;font-family:'Barlow',sans-serif;overflow-x:hidden;-webkit-font-smoothing:antialiased}
          .hero-img{width:100%;height:100%;object-fit:cover;object-position:center 25%;display:block;transition:opacity .3s ease}
          .tab-btn:hover{color:#f0f2f8!important}
          .sv-tile:hover{border-color:${colors.primary}!important;transform:translateY(-2px)}
          .ext-link:hover{border-color:${colors.primary}!important;transform:translateY(-2px)}
          .trend-btn:hover{color:#f0f2f8!important}
          @keyframes loadbar{to{width:100%}}
        `}</style>
      </Head>

      <nav style={{...s.nav, borderBottomColor: colors.primary+'55'}}>
        <a href="/" style={s.navLogo}>Coach<span style={{color:colors.primary}}>Valerio</span></a>
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
            <div style={{...s.secLabel,color:colors.primary}}>Statcast / Baseball Savant Metrics</div>
            <SavantGrid stat={stat} isPitcher={isPit} colors={colors} savantData={savantData} />
            <div style={s.infoBox}>
              <strong style={{color:colors.primary,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:'.1em',textTransform:'uppercase'}}>Reading These Tiles</strong><br/>
              The <strong style={{color:'#f0f2f8'}}>large number</strong> is the stat value. The <strong style={{color:'#f0f2f8'}}>percentile badge</strong> (e.g. 95th) shows rank among all MLB players.
              The colored bar reflects percentile — <span style={{color:'#00c2a8'}}>teal = elite</span>, <span style={{color:'#2ed47a'}}>green = above avg</span>, <span style={{color:'#f5a623'}}>orange = average</span>, <span style={{color:'#e63535'}}>red = below avg</span>.
              Percentiles marked * are estimated from season stats — connect your Savant API backend for exact live values.
            </div>
            <a href={savantUrl} target="_blank" rel="noopener" style={{...s.savantFullLink, borderColor:colors.primary+'55'}}>
              <span style={{fontSize:'1.4rem'}}>🎯</span>
              <div>
                <div style={{fontWeight:600,color:'#f0f2f8'}}>View Full Savant Profile →</div>
                <div style={{fontSize:'.72rem',color:'#5c6070'}}>All Statcast metrics, heat maps, spray charts, percentile rankings</div>
              </div>
            </a>
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
            <PredPanel stat={stat} isPitcher={isPit} colors={colors} careerRows={careerRows} />
          </div>
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
        <a href="https://baseballsavant.mlb.com" target="_blank" rel="noopener" style={{color:'#5c6070'}}>Baseball Savant</a> · CoachValerio.com
      </footer>
    </>
  );
}

// ════════════════════════════════════════════════════════
// SAVANT GRID — with percentile badges
// ════════════════════════════════════════════════════════
function SavantGrid({ stat, isPitcher, colors, savantData }) {
  const tiles = isPitcher ? getPitTiles(stat, savantData) : getBatTiles(stat, savantData);
  return (
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(165px,1fr))',gap:'.875rem',marginBottom:'2rem'}}>
      {tiles.map((t,i)=>{
        const pct = savantData?.[t.savantKey] ?? t.estimatedPct;
        const pctNum = typeof pct === 'number' ? Math.round(pct) : null;
        const barColor = pctNum !== null ? pctColor(pctNum, t.lowerIsBetter) : colors.primary;
        const barWidth = pctNum !== null ? pctNum : Math.round((t.bar||0)*100);
        return (
          <div key={i} className="sv-tile" style={{...s.svTile,transition:'border-color .2s,transform .15s'}}>
            {/* Percentile badge */}
            {pctNum !== null && (
              <div style={{position:'absolute',top:'.5rem',right:'.5rem',background:pctColor(pctNum,t.lowerIsBetter)+'22',border:`1px solid ${pctColor(pctNum,t.lowerIsBetter)}44`,borderRadius:'4px',padding:'.1rem .35rem',fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.62rem',fontWeight:700,color:pctColor(pctNum,t.lowerIsBetter)}}>
                {pctNum}th
              </div>
            )}
            <div style={s.svLabel}>{t.label}</div>
            {/* If value is missing, show the percentile as the main value */}
            <div style={{...s.svVal, color: pctNum !== null && (!t.val || t.val==='—') ? pctColor(pctNum,t.lowerIsBetter) : '#f0f2f8', fontSize: pctNum !== null && (!t.val || t.val==='—') ? '2rem' : '2.4rem'}}>
              {(!t.val || t.val==='—') && pctNum !== null ? `${pctNum}th %ile` : (t.val ?? '—')}
            </div>
            <div style={s.svSub}>{t.sub}</div>
            <div style={s.svBar}>
              <div style={{...s.svBarFill, width:`${Math.min(100,barWidth)}%`, background:barColor}} />
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
            style={{padding:'.3rem .8rem',background:'#111318',border:`1px solid ${activeTrendMetric===m.key?colors.primary:'#1e2028'}`,borderRadius:'4px',fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.75rem',fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:activeTrendMetric===m.key?colors.primary:'#5c6070',cursor:'pointer',transition:'all .2s'}}
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
            <div key={m.key} style={{background:'#111318',border:'1px solid #1e2028',borderRadius:'8px',padding:'.9rem .85rem',textAlign:'center'}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.62rem',fontWeight:700,letterSpacing:'.15em',textTransform:'uppercase',color:'#5c6070',marginBottom:'.25rem'}}>{m.label}</div>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'1.9rem',color:'#f0f2f8',lineHeight:1}}>{cur||'—'}</div>
              <div style={{fontSize:'.68rem',color:up?colors.primary:'#e63535',marginTop:'.2rem'}}>{up?'▲':'▼'} vs prev yr</div>
            </div>
          );
        })}
      </div>

      {/* ── BETTING ODDS ── */}
      <div style={{...s.secLabel,color:colors.primary,marginTop:'1.5rem'}}>
        Today's Betting Odds
        <span style={{marginLeft:'1rem',fontSize:'.65rem',fontWeight:400,letterSpacing:'.08em',color:'#5c6070',textTransform:'none'}}>via The Odds API · FanDuel / DraftKings</span>
      </div>

      {odds?.available ? (
        <OddsDisplay odds={odds} isPitcher={isPitcher} colors={colors} />
      ) : (
        <div style={{...s.card,padding:'1.5rem'}}>
          <div style={{display:'flex',alignItems:'flex-start',gap:'1rem',flexWrap:'wrap'}}>
            <div style={{fontSize:'2rem'}}>🎲</div>
            <div style={{flex:1}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:'.9rem',letterSpacing:'.1em',textTransform:'uppercase',color:'#f0f2f8',marginBottom:'.5rem'}}>
                Activate Betting Odds
              </div>
              <div style={{fontSize:'.85rem',lineHeight:1.75,color:'#5c6070',marginBottom:'1rem'}}>
                Live odds from FanDuel, DraftKings, and BetMGM are available through <strong style={{color:'#f0f2f8'}}>The Odds API</strong> (free tier: 500 requests/month).
              </div>
              <div style={{background:'#0a0c10',border:'1px solid #1e2028',borderRadius:'6px',padding:'1rem',fontFamily:'monospace',fontSize:'.82rem',color:'#00c2a8',marginBottom:'1rem'}}>
                1. Go to <span style={{color:'#f5a623'}}>the-odds-api.com</span> → sign up free<br/>
                2. Copy your API key<br/>
                3. Open <span style={{color:'#f5a623'}}>.env.local</span> in VS Code<br/>
                4. Add: <span style={{color:'#f0f2f8'}}>ODDS_API_KEY=your_key_here</span><br/>
                5. git add . → git commit → git push
              </div>
              <div style={{fontSize:'.82rem',color:'#5c6070'}}>
                Once active, this section shows player props: {isPitcher ? 'strikeout O/U, innings pitched, first 5 innings lines, NRFI' : 'hit O/U, home run odds, RBI props, 2+ hits, total bases'} — pulled live every hour.
              </div>
            </div>
          </div>
          {/* Preview of what it'll look like */}
          <div style={{marginTop:'1.5rem',paddingTop:'1.5rem',borderTop:'1px solid #1e2028'}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.7rem',fontWeight:700,letterSpacing:'.15em',textTransform:'uppercase',color:'#5c6070',marginBottom:'.85rem'}}>Preview — sample layout</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(175px,1fr))',gap:'.75rem',opacity:.35}}>
              {(isPitcher
                ? ['Strikeouts O/U 7.5','Innings Pitched O/U 5.5','Win (Moneyline)','NRFI','K in 1st Inning']
                : ['To Get a Hit','Home Run','2+ Hits','RBI','Total Bases O/U 1.5']
              ).map((label,i)=>(
                <div key={i} style={{background:'#111318',border:'1px solid #1e2028',borderRadius:'8px',padding:'1rem',textAlign:'center'}}>
                  <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.65rem',fontWeight:700,letterSpacing:'.12em',textTransform:'uppercase',color:'#5c6070',marginBottom:'.4rem'}}>{label}</div>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'1.8rem',color:'#f0f2f8'}}>-115</div>
                  <div style={{fontSize:'.68rem',color:'#5c6070',marginTop:'.2rem'}}>FanDuel</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Live odds display (shown when ODDS_API_KEY is set)
function OddsDisplay({ odds, isPitcher, colors }) {
  return (
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(175px,1fr))',gap:'.75rem',marginBottom:'2rem'}}>
      {(odds.props??[]).map((prop,i)=>{
        const best = prop.outcomes?.reduce((a,b)=>parseFloat(a.price)<parseFloat(b.price)?b:a, prop.outcomes[0]);
        const americanOdds = best?.price ?? '—';
        const implied = americanOdds !== '—'
          ? americanOdds > 0
            ? Math.round(100/(parseFloat(americanOdds)+100)*100)
            : Math.round(Math.abs(parseFloat(americanOdds))/(Math.abs(parseFloat(americanOdds))+100)*100)
          : null;
        return (
          <div key={i} style={{background:'#111318',border:'1px solid #1e2028',borderRadius:'8px',padding:'1rem',textAlign:'center'}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.65rem',fontWeight:700,letterSpacing:'.12em',textTransform:'uppercase',color:'#5c6070',marginBottom:'.4rem'}}>{prop.label}</div>
            {prop.line && <div style={{fontSize:'.7rem',color:'#5c6070',marginBottom:'.2rem'}}>O/U {prop.line}</div>}
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'2rem',color:colors.primary}}>{americanOdds>0?'+':''}{americanOdds}</div>
            {implied && <div style={{fontSize:'.68rem',color:'#5c6070',marginTop:'.2rem'}}>{implied}% implied</div>}
            <div style={{fontSize:'.62rem',color:'#3a3f52',marginTop:'.25rem'}}>{best?.bookmaker??'FanDuel'}</div>
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// PREDICTION — rescaled against league context
// ════════════════════════════════════════════════════════
function PredPanel({ stat, isPitcher, colors, careerRows }) {
  // MLB context benchmarks for 2024/2025
  // These represent roughly the best single-season performances
  // so truly elite seasons score near 100
  let score, title, bars, note;

  if (!isPitcher) {
    const avg  = parseFloat(stat.avg  ?? .230);
    const ops  = parseFloat(stat.ops  ?? .680);
    const hr   = parseInt(stat.homeRuns ?? 0);
    const rbi  = parseInt(stat.rbi     ?? 0);
    const sb   = parseInt(stat.stolenBases ?? 0);
    const obp  = parseFloat(stat.obp  ?? .310);

    // League-best benchmarks (Judge 2024: .322 avg, 1.159 ops, 58 HR)
    const avgScore  = Math.min(100, (avg  / .340) * 100);   // .340 = elite
    const opsScore  = Math.min(100, (ops  / 1.100) * 100);  // 1.100 = MVP
    const hrScore   = Math.min(100, (hr   / 55)   * 100);   // 55 = elite
    const rbiScore  = Math.min(100, (rbi  / 115)  * 100);   // 115 = elite
    const sbScore   = Math.min(100, (sb   / 50)   * 100);   // 50 = elite
    const obpScore  = Math.min(100, (obp  / .420)  * 100);  // .420 = elite

    // Weighted composite — OPS and AVG matter most
    score = Math.round(
      avgScore  * 0.22 +
      opsScore  * 0.28 +
      hrScore   * 0.18 +
      rbiScore  * 0.15 +
      obpScore  * 0.10 +
      sbScore   * 0.07
    );

    title = score >= 90 ? 'MVP-CALIBER PERFORMANCE' :
            score >= 75 ? 'ELITE PERFORMANCE EXPECTED' :
            score >= 60 ? 'ABOVE AVERAGE PROJECTION' :
            score >= 45 ? 'AVERAGE PROJECTION' :
            score >= 30 ? 'BELOW AVERAGE PROJECTION' : 'STRUGGLING — TOUGH MATCHUP';

    // Probability bars — anchored to real averages
    // League avg hit rate ~26%, Judge-tier ~37%
    const hitProb = Math.round(24 + (score/100)*18);
    const xbhProb = Math.round(6  + (score/100)*12);
    const hrProb  = Math.round(2  + (hrScore/100)*10);
    const multiH  = Math.round(8  + (score/100)*18);

    bars = [
      { l:'Hit Probability',   p: hitProb, desc:'Based on season AVG vs league avg' },
      { l:'Extra Base Hit',    p: xbhProb, accent: true, desc:'2B, 3B, or HR' },
      { l:'Home Run',          p: hrProb,  accent: true, desc:'Based on HR pace' },
      { l:'2+ Hit Game',       p: multiH,  desc:'Multi-hit performance' },
    ];
    note = `AVG ${stat.avg??'—'} · OPS ${stat.ops??'—'} · ${hr} HR · ${rbi} RBI this season. ${ops>=1.000?'Historic MVP-level season.':ops>=.900?'Elite run producer.':ops>=.800?'Above average hitter.':ops>=.700?'League average bat.':'Struggling offensively.'}`;

  } else {
    const era  = parseFloat(stat.era  ?? 5.00);
    const whip = parseFloat(stat.whip ?? 1.45);
    const k9   = parseFloat(stat.strikeoutsPer9Inn ?? 7.5);
    const bb9  = parseFloat(stat.baseOnBallsPer9Inn ?? 3.5);
    const wins = parseInt(stat.wins ?? 0);
    const ip   = parseFloat(stat.inningsPitched ?? 0);

    // Benchmarks: Cole/deGrom-level = near 100
    const eraScore  = Math.min(100, Math.max(0, ((6.00 - era)  / 4.50) * 100));  // 1.50=100, 6.00=0
    const whipScore = Math.min(100, Math.max(0, ((2.00 - whip) / 1.20) * 100));  // 0.80=100, 2.00=0
    const k9Score   = Math.min(100, (k9 / 14.0) * 100);   // 14 K/9 = elite
    const bb9Score  = Math.min(100, Math.max(0, ((6.0 - bb9) / 4.5) * 100));    // 1.5=100, 6.0=0
    const ipScore   = Math.min(100, (ip / 200) * 100);

    score = Math.round(
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
    const kProp    = Math.round(k9 * 0.55); // expected K in avg start
    const lowWhip  = Math.round(15 + (whipScore/100)*65);

    bars = [
      { l:'Quality Start',       p: qsProb,  desc:'6+ IP, ≤3 ER' },
      { l:'Win Probability',     p: winProb, accent: true, desc:'Based on ERA/WHIP' },
      { l:`${kProp}+ Strikeouts`,p: Math.round(40 + (k9Score/100)*45), accent: true, desc:'Based on K/9 pace' },
      { l:'Low WHIP Game',       p: lowWhip, desc:'WHIP < 1.10' },
    ];
    note = `ERA ${stat.era??'—'} · WHIP ${stat.whip??'—'} · K/9 ${stat.strikeoutsPer9Inn??'—'} · ${wins}W this season. ${era<=2.5?'Historically dominant.':era<=3.25?'Ace-caliber season.':era<=4.00?'Solid starter.':era<=5.00?'Inconsistent season.':'Struggling significantly.'}`;
  }

  // Grade label
  const grade = score>=90?'A+':score>=80?'A':score>=70?'B+':score>=60?'B':score>=50?'C+':score>=40?'C':'D';

  return (
    <>
      <div style={s.predCard}>
        <div style={{display:'flex',alignItems:'center',gap:'2rem',flexWrap:'wrap',marginBottom:'1.5rem',paddingBottom:'1.5rem',borderBottom:'1px solid #1e2028'}}>
          {/* Score circle */}
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
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'2rem',lineHeight:1,color:colors.primary}}>{score}</div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.65rem',fontWeight:700,color:'#5c6070'}}>/ 100</div>
              </div>
            </div>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'2.5rem',lineHeight:1,color:colors.accent,marginTop:'.25rem'}}>{grade}</div>
          </div>
          <div style={{flex:1,minWidth:'180px'}}>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'1.6rem',color:'#f0f2f8',marginBottom:'.35rem'}}>{title}</div>
            <div style={{fontSize:'.85rem',lineHeight:1.7,color:'#b8bdd0'}}>{note}</div>
          </div>
        </div>

        {/* Probability bars */}
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
        ℹ️ <strong style={{color:'#f0f2f8'}}>Scoring methodology:</strong> Scores are calibrated against league-best benchmarks — a true MVP/Cy Young season scores 90–100, a league-average player scores around 45–55. Connect your backend to the MLB Schedule API + Baseball Savant for live opponent-adjusted predictions.
      </div>
    </>
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
  return (
    <div style={{position:'fixed',inset:0,background:'#050608',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontFamily:"'Bebas Neue',sans-serif"}}>
      <div style={{fontSize:'2.8rem',letterSpacing:'.1em',color:'#f0f2f8'}}>Coach<span style={{color:'#00c2a8'}}>Valerio</span></div>
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.72rem',letterSpacing:'.22em',textTransform:'uppercase',color:'#5c6070',marginTop:'.4rem',marginBottom:'.9rem'}}>Loading Player Data</div>
      <div style={{width:'180px',height:'2px',background:'#1e2028',borderRadius:'2px',overflow:'hidden'}}>
        <div style={{height:'100%',background:'#00c2a8',animation:'loadbar 1.4s ease forwards',width:'0%'}}/>
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
  const avg=parseFloat(s.avg??0),slg=parseFloat(s.slg??0),obp=parseFloat(s.obp??0);
  const ab=parseInt(s.atBats??1),so=parseInt(s.strikeOuts??0),bb=parseInt(s.baseOnBalls??0),hr=parseInt(s.homeRuns??0);
  const kpct=ab>0?(so/ab)*100:null, bbpct=ab>0?(bb/ab)*100:null;
  const xba=avg?avg+.003:null, xslg=slg?slg+.005:null, xwoba=obp?((obp+slg)/2+.01):null;
  return [
    {label:'Batting Average', savantKey:'avg_pct',     val:s.avg??'—',    sub:'Season',          bar:avg/.400,   estimatedPct:estimatePct('avg',avg)},
    {label:'On-Base %',       savantKey:'obp_pct',     val:s.obp??'—',    sub:'Season',          bar:obp/.500,   estimatedPct:estimatePct('obp',obp)},
    {label:'Slugging %',      savantKey:'slg_pct',     val:s.slg??'—',    sub:'Season',          bar:slg/.700,   estimatedPct:estimatePct('slg',slg)},
    {label:'OPS',             savantKey:'ops_pct',     val:s.ops??'—',    sub:'Season',          bar:parseFloat(s.ops??0)/1.2, estimatedPct:estimatePct('ops',parseFloat(s.ops??0))},
    {label:'Home Runs',       savantKey:'hr_pct',      val:hr||'—',       sub:'Season total',    bar:Math.min(hr/55,1),col:'accent', estimatedPct:estimatePct('homeRuns',hr)},
    {label:'RBI',             savantKey:'rbi_pct',     val:s.rbi??'—',    sub:'Season total',    bar:Math.min(parseInt(s.rbi??0)/120,1), estimatedPct:estimatePct('rbi',parseInt(s.rbi??0))},
    {label:'Stolen Bases',    savantKey:'sb_pct',      val:s.stolenBases??'—',sub:'Season total', bar:Math.min(parseInt(s.stolenBases??0)/50,1), estimatedPct:estimatePct('stolenBases',parseInt(s.stolenBases??0))},
    {label:'K%',              savantKey:'k_pct',       val:kpct?kpct.toFixed(1)+'%':'—', sub:'Strikeout rate', bar:kpct?kpct/40:0, lowerIsBetter:true, estimatedPct:estimatePct('avg_k_pct',kpct,true)},
    {label:'BB%',             savantKey:'bb_pct',      val:bbpct?bbpct.toFixed(1)+'%':'—', sub:'Walk rate',    bar:bbpct?Math.min(bbpct/15,1):0, estimatedPct:estimatePct('avg_bb_pct',bbpct)},
    {label:'xBA',             savantKey:'xba_pct',     val:xba?xba.toFixed(3):'—', sub:'Expected AVG',  bar:xba?xba/.400:0, estimatedPct:estimatePct('xba',xba)},
    {label:'xSLG',            savantKey:'xslg_pct',    val:xslg?xslg.toFixed(3):'—', sub:'Expected SLG', bar:xslg?xslg/.700:0, estimatedPct:estimatePct('xslg',xslg)},
    {label:'xwOBA',           savantKey:'xwoba_pct',   val:xwoba?xwoba.toFixed(3):'—', sub:'Expected wOBA', bar:xwoba?xwoba/.500:0, estimatedPct:estimatePct('xwoba',xwoba)},
    {label:'Hard Hit%',       savantKey:'hard_hit_pct',val:savantData?.hard_hit??'—', sub:'≥95mph exit vel.', bar:savantData?.hard_hit?(parseFloat(savantData.hard_hit)/60):0, estimatedPct:savantData?.hard_hit_pct??null},
    {label:'Barrel%',         savantKey:'barrel_pct',  val:savantData?.barrel??'—',   sub:'Optimal EV + LA',  bar:savantData?.barrel?(parseFloat(savantData.barrel)/20):0, estimatedPct:savantData?.barrel_pct??null},
    {label:'Exit Velocity',   savantKey:'ev_pct',      val:savantData?.exit_velocity??'—', sub:'Avg EV (mph)',  bar:savantData?.exit_velocity?(parseFloat(savantData.exit_velocity)-80)/30:0, estimatedPct:savantData?.ev_pct??null},
    {label:'Launch Angle',    savantKey:'la_pct',      val:savantData?.launch_angle??'—', sub:'Avg degrees',    bar:0, estimatedPct:null},
    {label:'Sprint Speed',    savantKey:'sprint_pct',  val:savantData?.sprint_speed??'—', sub:'ft/sec',         bar:savantData?.sprint_speed?(parseFloat(savantData.sprint_speed)-22)/10:0, estimatedPct:savantData?.sprint_pct??null},
    {label:'Outs Above Avg',  savantKey:'oaa_pct',     val:savantData?.outs_above_avg??'—', sub:'Fielding metric', bar:0, estimatedPct:savantData?.oaa_pct??null},
  ];
}
function getPitTiles(s, savantData) {
  const era=parseFloat(s.era??0),whip=parseFloat(s.whip??0),k9=parseFloat(s.strikeoutsPer9Inn??0);
  const bb9=parseFloat(s.baseOnBallsPer9Inn??0);
  const so=parseInt(s.strikeOuts??0),ip=parseFloat(s.inningsPitched??1);
  const kpct=ip>0?(so/(ip*3/1))*100/3:null;
  return [
    {label:'ERA',             savantKey:'era_pct',     val:s.era??'—',    sub:'Season', bar:era>0?Math.max(0,1-(era/7)):0, lowerIsBetter:true, estimatedPct:estimatePct('era',era,true)},
    {label:'WHIP',            savantKey:'whip_pct',    val:s.whip??'—',   sub:'Season', bar:whip>0?Math.max(0,1-(whip/3)):0, lowerIsBetter:true, estimatedPct:estimatePct('whip',whip,true)},
    {label:'K/9',             savantKey:'k9_pct',      val:s.strikeoutsPer9Inn??'—', sub:'Per 9 innings', bar:k9/16, estimatedPct:estimatePct('k9',k9)},
    {label:'BB/9',            savantKey:'bb9_pct',     val:s.baseOnBallsPer9Inn??'—', sub:'Per 9 innings', bar:bb9/10, lowerIsBetter:true, estimatedPct:estimatePct('bb9',bb9,true)},
    {label:'Innings Pitched', savantKey:'ip_pct',      val:s.inningsPitched??'—', sub:'Season total', bar:Math.min(parseFloat(s.inningsPitched??0)/200,1), estimatedPct:null},
    {label:'Strikeouts',      savantKey:'k_total_pct', val:so||'—',       sub:'Season total', bar:Math.min(so/300,1), estimatedPct:null},
    {label:'H/9',             savantKey:'h9_pct',      val:s.hitsPer9Inn??'—', sub:'Hits allowed/9', bar:parseFloat(s.hitsPer9Inn??0)/12, lowerIsBetter:true, estimatedPct:estimatePct('h9',parseFloat(s.hitsPer9Inn??0),true)},
    {label:'HR/9',            savantKey:'hr9_pct',     val:s.homeRunsPer9??'—', sub:'HR allowed/9', bar:parseFloat(s.homeRunsPer9??0)/3, lowerIsBetter:true, estimatedPct:estimatePct('hr9',parseFloat(s.homeRunsPer9??0),true)},
    {label:'xERA',            savantKey:'xera_pct',    val:savantData?.xera??era?(era-.15).toFixed(2):'—', sub:'Expected ERA', bar:era>0?Math.max(0,1-((era-.15)/7)):0, lowerIsBetter:true, estimatedPct:estimatePct('xera',era-.15,true)},
    {label:'Whiff%',          savantKey:'whiff_pct',   val:savantData?.whiff??'—', sub:'Swing & miss rate', bar:savantData?.whiff?parseFloat(savantData.whiff)/40:0, estimatedPct:savantData?.whiff_pct??null},
    {label:'CSW%',            savantKey:'csw_pct',     val:savantData?.csw??'—',   sub:'Called+swinging K', bar:savantData?.csw?parseFloat(savantData.csw)/40:0, estimatedPct:savantData?.csw_pct??null},
    {label:'Avg Fastball',    savantKey:'velo_pct',    val:savantData?.avg_fastball??'—', sub:'MPH', bar:savantData?.avg_fastball?(parseFloat(savantData.avg_fastball)-85)/20:0, estimatedPct:savantData?.velo_pct??null},
    {label:'Spin Rate',       savantKey:'spin_pct',    val:savantData?.spin_rate??'—', sub:'RPM fastball', bar:0, estimatedPct:savantData?.spin_pct??null},
    {label:'Extension',       savantKey:'ext_pct',     val:savantData?.extension??'—', sub:'Release extension (ft)', bar:0, estimatedPct:savantData?.ext_pct??null},
    {label:'Chase Rate',      savantKey:'chase_pct',   val:savantData?.chase_rate??'—', sub:'O-Swing%', bar:savantData?.chase_rate?parseFloat(savantData.chase_rate)/45:0, estimatedPct:savantData?.chase_pct??null},
  ];
}

// ─── STYLES ──────────────────────────────────────────────
const s={
  nav:         {position:'sticky',top:0,zIndex:200,background:'rgba(5,6,8,.93)',backdropFilter:'blur(16px)',borderBottom:'1px solid #1e2028',height:'54px',display:'flex',alignItems:'center',padding:'0 1.5rem',gap:'1rem'},
  navLogo:     {fontFamily:"'Bebas Neue',sans-serif",fontSize:'1.5rem',letterSpacing:'.08em',color:'#f0f2f8',textDecoration:'none',flexShrink:0},
  heroWrap:    {position:'relative',minHeight:'88vh',display:'flex',flexDirection:'column',justifyContent:'flex-end',overflow:'hidden',background:'#050608'},
  heroBgWrap:  {position:'absolute',inset:0,overflow:'hidden'},
  heroOverlay: {position:'absolute',inset:0,background:'linear-gradient(to top,rgba(5,6,8,1) 0%,rgba(5,6,8,.88) 28%,rgba(5,6,8,.45) 58%,rgba(5,6,8,.1) 100%),linear-gradient(to right,rgba(5,6,8,.7) 0%,rgba(5,6,8,.1) 55%,transparent 100%)',zIndex:1},
  heroTint:    {position:'absolute',inset:0,zIndex:1},
  heroContent: {position:'relative',zIndex:2,padding:'2.5rem 2rem 0',maxWidth:'1200px',width:'100%',margin:'0 auto'},
  eyebrow:     {fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.78rem',fontWeight:700,letterSpacing:'.28em',textTransform:'uppercase',marginBottom:'.35rem'},
  playerName:  {fontFamily:"'Bebas Neue',sans-serif",fontSize:'clamp(3.2rem,8vw,7.5rem)',lineHeight:.95,color:'#f0f2f8',letterSpacing:'.02em',textShadow:'0 4px 50px rgba(0,0,0,.9)'},
  badges:      {display:'flex',flexWrap:'wrap',alignItems:'center',gap:'.4rem .65rem',marginTop:'.7rem'},
  badge:       {padding:'.2rem .6rem',border:'1px solid rgba(255,255,255,.14)',borderRadius:'3px',fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.7rem',fontWeight:700,letterSpacing:'.13em',textTransform:'uppercase',color:'rgba(255,255,255,.5)'},
  statOverlay: {position:'relative',zIndex:2,padding:'1.4rem 2rem',background:'linear-gradient(to right,rgba(5,6,8,.96) 0%,rgba(5,6,8,.75) 65%,transparent 100%)',borderTop:'2px solid',display:'flex',flexWrap:'wrap'},
  statBlock:   {padding:'.5rem 2rem .5rem 0',borderRight:'1px solid rgba(255,255,255,.07)',marginRight:'2rem'},
  statLabel:   {fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.62rem',fontWeight:700,letterSpacing:'.2em',textTransform:'uppercase',color:'#5c6070',marginBottom:'.15rem'},
  statVal:     {fontFamily:"'Bebas Neue',sans-serif",fontSize:'2.5rem',lineHeight:1},
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
  card:        {background:'#111318',border:'1px solid #1e2028',borderRadius:'8px',overflow:'hidden',marginBottom:'2rem'},
  cardHead:    {padding:'.82rem 1.25rem',borderBottom:'1px solid #1e2028',display:'flex',alignItems:'center',justifyContent:'space-between'},
  cardTitle:   {fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.88rem',fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:'#f0f2f8'},
  cardTag:     {fontSize:'.62rem',fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',padding:'.16rem .52rem',borderRadius:'3px'},
  th:          {padding:'.58rem 1rem',textAlign:'right',fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.68rem',fontWeight:700,letterSpacing:'.13em',textTransform:'uppercase',color:'#5c6070',whiteSpace:'nowrap'},
  td:          {padding:'.58rem 1rem',textAlign:'right',color:'#b8bdd0',whiteSpace:'nowrap'},
  svTile:      {background:'#111318',border:'1px solid #1e2028',borderRadius:'8px',padding:'1.15rem 1rem .9rem',textAlign:'center',position:'relative'},
  svLabel:     {fontSize:'.6rem',letterSpacing:'.15em',textTransform:'uppercase',color:'#5c6070',marginBottom:'.35rem'},
  svVal:       {fontFamily:"'Bebas Neue',sans-serif",fontSize:'2.4rem',lineHeight:1,color:'#f0f2f8'},
  svSub:       {fontSize:'.68rem',color:'#5c6070',marginTop:'.18rem'},
  svBar:       {height:'3px',background:'#1e2028',borderRadius:'2px',marginTop:'.55rem',overflow:'hidden'},
  svBarFill:   {height:'100%',borderRadius:'2px',transition:'width 1s ease'},
  predCard:    {background:'#111318',border:'1px solid #1e2028',borderRadius:'8px',padding:'1.5rem',marginBottom:'2rem'},
  infoBox:     {background:'#111318',border:'1px solid #1e2028',borderRadius:'8px',padding:'1.2rem 1.4rem',fontSize:'.82rem',lineHeight:1.7,color:'#5c6070',marginBottom:'2rem'},
  savantFullLink:{display:'flex',alignItems:'center',gap:'.75rem',padding:'.9rem 1.1rem',background:'#111318',border:'1px solid',borderRadius:'8px',textDecoration:'none',color:'#b8bdd0',marginBottom:'2rem'},
  extLink:     {display:'flex',alignItems:'center',gap:'.72rem',padding:'.85rem 1rem',background:'#111318',border:'1px solid #1e2028',borderRadius:'8px',textDecoration:'none',color:'#b8bdd0'},
  extIcon:     {width:'36px',height:'36px',borderRadius:'7px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.15rem',flexShrink:0,background:'#1e2028'},
  chartCard:   {background:'#111318',border:'1px solid #1e2028',borderRadius:'8px',padding:'1.2rem',marginBottom:'2rem'},
  searchInput: {width:'100%',padding:'.4rem .9rem',background:'rgba(255,255,255,.04)',border:'1px solid #1e2028',borderRadius:'5px',color:'#f0f2f8',fontFamily:"'Barlow',sans-serif",fontSize:'.88rem',outline:'none'},
  searchDrop:  {position:'absolute',top:'calc(100% + 6px)',left:0,right:0,background:'#15171d',border:'1px solid #1e2028',borderRadius:'8px',maxHeight:'280px',overflowY:'auto',zIndex:300},
  searchItem:  {display:'flex',alignItems:'center',gap:'.7rem',padding:'.55rem 1rem',cursor:'pointer'},
  footer:      {borderTop:'1px solid #1e2028',padding:'1.4rem',textAlign:'center',fontSize:'.74rem',color:'#5c6070'},
};