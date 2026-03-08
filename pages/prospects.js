// pages/prospects.js
import { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

const TOOL_COLOR = (v) => {
  if (v >= 70) return '#c8102e';
  if (v >= 60) return '#f47c7c';
  if (v >= 50) return '#f5a623';
  if (v >= 40) return '#6baed6';
  return '#2171b5';
};
const TOOL_LABEL = (v) => v >= 70 ? 'PLUS+' : v >= 60 ? 'PLUS' : v >= 55 ? 'AV+' : v >= 45 ? 'AVG' : v >= 40 ? 'BELOW' : 'POOR';
const LEVEL_COLOR = { MLB:'#00c2a8', AAA:'#f5a623', AA:'#f47c7c', 'A+':'#6baed6', A:'#9e9e9e', Rk:'#5c6070' };

const MLB_TEAMS = [
  {id:108,abbr:'LAA',name:'Angels'},{id:109,abbr:'ARI',name:'D-backs'},{id:110,abbr:'BAL',name:'Orioles'},
  {id:111,abbr:'BOS',name:'Red Sox'},{id:112,abbr:'CHC',name:'Cubs'},{id:113,abbr:'CIN',name:'Reds'},
  {id:114,abbr:'CLE',name:'Guardians'},{id:115,abbr:'COL',name:'Rockies'},{id:116,abbr:'DET',name:'Tigers'},
  {id:117,abbr:'HOU',name:'Astros'},{id:118,abbr:'KC',name:'Royals'},{id:119,abbr:'LAD',name:'Dodgers'},
  {id:120,abbr:'WSH',name:'Nationals'},{id:121,abbr:'NYM',name:'Mets'},{id:133,abbr:'OAK',name:'Athletics'},
  {id:134,abbr:'PIT',name:'Pirates'},{id:135,abbr:'SD',name:'Padres'},{id:136,abbr:'SEA',name:'Mariners'},
  {id:137,abbr:'SF',name:'Giants'},{id:138,abbr:'STL',name:'Cardinals'},{id:139,abbr:'TB',name:'Rays'},
  {id:140,abbr:'TEX',name:'Rangers'},{id:141,abbr:'TOR',name:'Blue Jays'},{id:142,abbr:'MIN',name:'Twins'},
  {id:143,abbr:'PHI',name:'Phillies'},{id:144,abbr:'ATL',name:'Braves'},{id:145,abbr:'CWS',name:'White Sox'},
  {id:147,abbr:'NYY',name:'Yankees'},{id:158,abbr:'MIL',name:'Brewers'},{id:146,abbr:'MIA',name:'Marlins'},
];

// ── Tool grade bar ─────────────────────────────────────
function ToolBar({ label, value, animate = false }) {
  const pct   = ((value - 20) / 60) * 100;
  const color = TOOL_COLOR(value);
  return (
    <div style={{ marginBottom: '.3rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.18rem' }}>
        <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: '.62rem', fontWeight: 700, letterSpacing: '.1em', color: '#5c6070' }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.3rem' }}>
          <span style={{ fontSize: '.68rem', fontWeight: 700, color, fontFamily: "'Anton',sans-serif", letterSpacing: '.04em' }}>{value}</span>
          <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: '.56rem', fontWeight: 700, color: color + '99', letterSpacing: '.08em' }}>{TOOL_LABEL(value)}</span>
        </div>
      </div>
      <div style={{ height: '4px', background: '#1e2028', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '2px', transition: 'width .6s ease' }} />
      </div>
    </div>
  );
}

// ── ETA badge ─────────────────────────────────────────
function EtaBadge({ eta, level }) {
  const now  = new Date().getFullYear();
  const diff = eta - now;
  const col  = diff <= 0 ? '#00c2a8' : diff === 1 ? '#f5a623' : diff === 2 ? '#f47c7c' : '#5c6070';
  const label = diff <= 0 ? 'MLB NOW' : diff === 1 ? `ETA ${eta}` : `ETA ${eta}`;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '.3rem', background: col + '18', border: `1px solid ${col}44`, borderRadius: '4px', padding: '.15rem .45rem' }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: col, flexShrink: 0, ...(diff <= 0 ? { animation: 'pulse 1.5s infinite' } : {}) }} />
      <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: '.65rem', fontWeight: 700, letterSpacing: '.1em', color: col }}>{label}</span>
    </div>
  );
}

// ── Stats row ─────────────────────────────────────────
function StatChip({ label, value, highlight = false }) {
  if (!value && value !== 0) return null;
  return (
    <div style={{ textAlign: 'center', minWidth: '38px' }}>
      <div style={{ fontFamily: "'Anton',sans-serif", fontSize: '.92rem', color: highlight ? '#00c2a8' : '#f0f2f8', lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: '.55rem', fontWeight: 700, letterSpacing: '.1em', color: '#3a3f52', marginTop: '.15rem' }}>{label}</div>
    </div>
  );
}

// ── Prospect card ─────────────────────────────────────
function ProspectCard({ p, rank, onClick }) {
  const [hover, setHover] = useState(false);
  const lc = LEVEL_COLOR[p.level] ?? '#5c6070';
  const avg5 = p.tools ? Math.round(Object.values(p.tools).reduce((a,b) => a+b, 0) / Object.values(p.tools).length) : 50;
  const overallColor = TOOL_COLOR(avg5);

  return (
    <div
      onClick={() => onClick(p)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? '#111318' : '#0d1117',
        border: `1px solid ${hover ? '#00c2a8' : '#1e2028'}`,
        borderRadius: '12px', overflow: 'hidden', cursor: 'pointer',
        transition: 'all .2s', transform: hover ? 'translateY(-2px)' : 'none',
        boxShadow: hover ? '0 8px 24px rgba(0,194,168,.1)' : 'none',
      }}>

      {/* Top bar: rank + team color accent */}
      <div style={{ height: '3px', background: `linear-gradient(90deg, ${overallColor} 0%, ${overallColor}33 100%)` }} />

      <div style={{ padding: '.9rem' }}>
        {/* Header row */}
        <div style={{ display: 'flex', gap: '.75rem', alignItems: 'flex-start', marginBottom: '.75rem' }}>
          {/* Headshot */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <img
              src={`https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_120,q_auto:best/v1/people/${p.id}/headshot/67/current`}
              alt={p.name}
              style={{ width: '52px', height: '52px', borderRadius: '10px', objectFit: 'cover', objectPosition: 'top', background: '#1e2028', display: 'block' }} />
            {p.recentPromo && (
              <div title="Recently promoted!" style={{ position: 'absolute', top: '-6px', right: '-6px', fontSize: '.9rem', filter: 'drop-shadow(0 0 4px #ff6a00)' }}>🔥</div>
            )}
          </div>

          {/* Identity */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', flexWrap: 'wrap', marginBottom: '.2rem' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '26px', height: '20px', borderRadius: '4px', background: overallColor, padding: '0 .3rem' }}>
                <span style={{ fontFamily: "'Anton',sans-serif", fontSize: '.72rem', color: '#fff', letterSpacing: '.04em' }}>#{rank}</span>
              </div>
              <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: '.62rem', fontWeight: 700, letterSpacing: '.1em', color: lc, background: lc + '18', padding: '.1rem .3rem', borderRadius: '3px' }}>{p.level}</span>
              {p.recentPromo && <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: '.58rem', fontWeight: 700, letterSpacing: '.08em', color: '#ff6a00', background: '#ff6a0018', padding: '.1rem .3rem', borderRadius: '3px' }}>PROMOTED</span>}
            </div>
            <div style={{ fontFamily: "'Anton',sans-serif", fontSize: '1.05rem', color: '#f0f2f8', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
            <div style={{ fontSize: '.7rem', color: '#5c6070', marginTop: '.15rem' }}>{p.pos} · {p.team} · Age {p.age}</div>
          </div>

          {/* ETA */}
          <div style={{ flexShrink: 0 }}>
            <EtaBadge eta={p.eta} level={p.level} />
          </div>
        </div>

        {/* Stats strip */}
        {p.stats && (
          <div style={{ display: 'flex', gap: '.5rem', justifyContent: 'space-around', background: '#080c12', borderRadius: '8px', padding: '.5rem', marginBottom: '.75rem' }}>
            {p.isPitcher ? (
              <>
                <StatChip label="ERA"  value={p.stats.era}  highlight />
                <StatChip label="WHIP" value={p.stats.whip} />
                <StatChip label="IP"   value={p.stats.ip}   />
                <StatChip label="K"    value={p.stats.k}    highlight />
                <StatChip label="LVL"  value={p.statLevel}  />
              </>
            ) : (
              <>
                <StatChip label="AVG"  value={p.stats.avg}  highlight />
                <StatChip label="OPS"  value={p.stats.ops}  highlight />
                <StatChip label="HR"   value={p.stats.hr}   />
                <StatChip label="RBI"  value={p.stats.rbi}  />
                <StatChip label="LVL"  value={p.statLevel}  />
              </>
            )}
          </div>
        )}
        {!p.stats && (
          <div style={{ fontSize: '.7rem', color: '#3a3f52', textAlign: 'center', padding: '.4rem', marginBottom: '.75rem' }}>Season stats pending</div>
        )}

        {/* Tool grades */}
        {p.tools && (
          <div>
            <ToolBar label="HIT"   value={p.tools.hit}   />
            <ToolBar label="POWER" value={p.tools.power} />
            <ToolBar label="RUN"   value={p.tools.run}   />
            <ToolBar label="FIELD" value={p.tools.field} />
            <ToolBar label="ARM"   value={p.tools.arm}   />
          </div>
        )}

        {/* Scouting note */}
        <div style={{ marginTop: '.65rem', fontSize: '.72rem', color: '#5c6070', lineHeight: 1.5, fontStyle: 'italic', borderTop: '1px solid #1e2028', paddingTop: '.55rem' }}>
          "{p.notes}"
        </div>
      </div>
    </div>
  );
}

// ── Full detail modal ──────────────────────────────────
function ProspectModal({ p, onClose, onNavigate }) {
  if (!p) return null;
  const avg5   = p.tools ? Math.round(Object.values(p.tools).reduce((a,b) => a+b,0)/5) : 50;
  const oc     = TOOL_COLOR(avg5);
  const season = new Date().getFullYear();

  return (
    <div style={{ position:'fixed', inset:0, zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}
      onClick={onClose}>
      <div style={{ position:'absolute', inset:0, background:'rgba(3,8,15,.92)', backdropFilter:'blur(12px)' }} />
      <div style={{ position:'relative', zIndex:1, width:'100%', maxWidth:'600px', maxHeight:'90vh', overflowY:'auto', background:'#0d1117', border:'1px solid #1e2028', borderRadius:'16px', animation:'fadeIn .18s ease' }}
        onClick={e => e.stopPropagation()}>

        {/* Color accent bar */}
        <div style={{ height: '4px', background: `linear-gradient(90deg, ${oc}, transparent)` }} />

        {/* Hero */}
        <div style={{ position:'relative', height:'160px', overflow:'hidden', background:'#080c12' }}>
          <img src={`https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:action:landscape:current.jpg/ar_16:9,g_auto/q_auto:best/v1/people/${p.id}/action/landscape/current`}
            alt="" style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'top center', opacity:0.6 }}
            onError={e => e.target.style.display='none'} />
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(to bottom, transparent 20%, #0d1117)' }} />
          <button onClick={onClose} style={{ position:'absolute', top:'.75rem', right:'.75rem', background:'rgba(0,0,0,.6)', border:'1px solid #1e2028', borderRadius:'50%', width:'28px', height:'28px', color:'#9e9e9e', cursor:'pointer', fontSize:'.85rem', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        </div>

        <div style={{ padding:'0 1.5rem 1.5rem' }}>
          {/* Identity */}
          <div style={{ display:'flex', alignItems:'flex-end', gap:'1rem', marginTop:'-44px', marginBottom:'1rem' }}>
            <img src={`https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${p.id}/headshot/67/current`}
              alt={p.name} style={{ width:'72px', height:'72px', borderRadius:'12px', objectFit:'cover', border:'3px solid #0d1117', background:'#1e2028', flexShrink:0 }} />
            <div style={{ paddingBottom:'.4rem', flex:1 }}>
              <div style={{ fontFamily:"'Anton',sans-serif", fontSize:'1.6rem', color:'#f0f2f8', lineHeight:1 }}>
                {p.name}
                {p.recentPromo && <span style={{ marginLeft:'.5rem', fontSize:'1rem' }} title="Recently promoted">🔥</span>}
              </div>
              <div style={{ fontSize:'.75rem', color:'#5c6070', marginTop:'.2rem' }}>{p.pos} · {p.team} · Age {p.age}</div>
            </div>
            <div style={{ paddingBottom:'.5rem', textAlign:'right' }}>
              <div style={{ fontFamily:"'Anton',sans-serif", fontSize:'2rem', color: oc, lineHeight:1 }}>#{p.rank}</div>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.6rem', fontWeight:700, letterSpacing:'.1em', color:'#3a3f52' }}>TOP PROSPECT</div>
            </div>
          </div>

          {/* ETA timeline */}
          <div style={{ background:'#080c12', borderRadius:'10px', padding:'1rem', marginBottom:'1rem' }}>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.65rem', fontWeight:700, letterSpacing:'.15em', color:'#5c6070', marginBottom:'.65rem' }}>MLB ARRIVAL TIMELINE</div>
            <div style={{ display:'flex', alignItems:'center', gap:'.5rem', position:'relative' }}>
              {[-1,0,1,2,3].map(offset => {
                const yr = season + offset;
                const isEta = yr === p.eta;
                const isPast = yr < p.eta;
                return (
                  <div key={yr} style={{ flex:1, textAlign:'center' }}>
                    <div style={{ height:'8px', borderRadius:'4px', background: isEta ? oc : isPast ? '#1e2028' : '#1e2028', border: isEta ? `2px solid ${oc}` : '1px solid #1e2028', marginBottom:'.35rem', position:'relative' }}>
                      {isEta && <div style={{ position:'absolute', top:'-3px', left:'50%', transform:'translateX(-50%)', width:'14px', height:'14px', borderRadius:'50%', background:oc, border:'2px solid #080c12' }} />}
                    </div>
                    <div style={{ fontSize:'.65rem', fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, letterSpacing:'.06em', color: isEta ? oc : '#3a3f52' }}>{yr}</div>
                    {isEta && <div style={{ fontSize:'.55rem', color:oc, marginTop:'.1rem', fontWeight:700 }}>ETA</div>}
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop:'.65rem', display:'flex', gap:'.5rem', flexWrap:'wrap' }}>
              <EtaBadge eta={p.eta} level={p.level} />
              <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.65rem', fontWeight:700, color: LEVEL_COLOR[p.level]??'#5c6070', background:(LEVEL_COLOR[p.level]??'#5c6070')+'18', padding:'.15rem .45rem', borderRadius:'4px' }}>
                CURRENT: {p.level}
              </span>
            </div>
          </div>

          {/* Stats + Tools side by side */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom:'1rem' }}>
            {/* Stats */}
            <div style={{ background:'#080c12', borderRadius:'10px', padding:'1rem' }}>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.65rem', fontWeight:700, letterSpacing:'.15em', color:'#5c6070', marginBottom:'.75rem' }}>{season} STATS {p.statLevel ? `· ${p.statLevel}` : ''}</div>
              {p.stats ? (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'.6rem' }}>
                  {(p.isPitcher
                    ? [['ERA',p.stats.era,true],['WHIP',p.stats.whip,true],['IP',p.stats.ip,false],['K',p.stats.k,true],['BB',p.stats.bb,false],['W-L',`${p.stats.w??'?'}-${p.stats.l??'?'}`,false]]
                    : [['AVG',p.stats.avg,true],['OPS',p.stats.ops,true],['HR',p.stats.hr,false],['RBI',p.stats.rbi,false],['SB',p.stats.sb,false],['OBP',p.stats.obp,true]]
                  ).map(([lbl,val,hi]) => (
                    <div key={lbl}>
                      <div style={{ fontFamily:"'Anton',sans-serif", fontSize:'1.1rem', color:hi?'#00c2a8':'#f0f2f8', lineHeight:1 }}>{val??'—'}</div>
                      <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.58rem', fontWeight:700, letterSpacing:'.1em', color:'#3a3f52' }}>{lbl}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize:'.75rem', color:'#3a3f52' }}>Stats not yet available</div>
              )}
            </div>

            {/* Tools */}
            {p.tools && (
              <div style={{ background:'#080c12', borderRadius:'10px', padding:'1rem' }}>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.65rem', fontWeight:700, letterSpacing:'.15em', color:'#5c6070', marginBottom:'.75rem' }}>TOOL GRADES (20-80)</div>
                <ToolBar label="HIT"   value={p.tools.hit}   />
                <ToolBar label="POWER" value={p.tools.power} />
                <ToolBar label="RUN"   value={p.tools.run}   />
                <ToolBar label="FIELD" value={p.tools.field} />
                <ToolBar label="ARM"   value={p.tools.arm}   />
                <div style={{ marginTop:'.65rem', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.6rem', fontWeight:700, letterSpacing:'.1em', color:'#3a3f52' }}>OVERALL</span>
                  <span style={{ fontFamily:"'Anton',sans-serif", fontSize:'1rem', color:oc }}>{avg5}</span>
                </div>
              </div>
            )}
          </div>

          {/* Scout note */}
          <div style={{ background:'#080c12', borderRadius:'10px', padding:'1rem', marginBottom:'1rem', borderLeft:`3px solid ${oc}` }}>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.62rem', fontWeight:700, letterSpacing:'.12em', color:'#5c6070', marginBottom:'.4rem' }}>SCOUTING REPORT</div>
            <div style={{ fontSize:'.82rem', color:'#b8bdd0', lineHeight:1.6 }}>{p.notes}</div>
          </div>

          {/* CTA */}
          <button onClick={() => onNavigate(p.id)}
            style={{ width:'100%', padding:'.85rem', background:'linear-gradient(135deg,#00c2a8 0%,#0077cc 100%)', border:'none', borderRadius:'10px', fontFamily:"'Anton',sans-serif", fontSize:'1rem', letterSpacing:'.1em', color:'#fff', cursor:'pointer' }}>
            FULL MLB PLAYER PROFILE →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Radar / tool spider for a prospect ────────────────
function ToolRadar({ tools, color }) {
  if (!tools) return null;
  const keys = ['HIT','PWR','RUN','FLD','ARM'];
  const vals  = [tools.hit, tools.power, tools.run, tools.field, tools.arm];
  const cx = 70, cy = 70, r = 52;
  const points = keys.map((_, i) => {
    const angle = (i / keys.length) * Math.PI * 2 - Math.PI / 2;
    const norm  = (vals[i] - 20) / 60;
    return { x: cx + Math.cos(angle) * r * norm, y: cy + Math.sin(angle) * r * norm, lx: cx + Math.cos(angle) * (r + 14), ly: cy + Math.sin(angle) * (r + 14) };
  });
  const poly    = points.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <svg width={140} height={140} viewBox="0 0 140 140">
      {[.25,.5,.75,1].map(s => (
        <polygon key={s} points={keys.map((_,i)=>{const a=(i/keys.length)*Math.PI*2-Math.PI/2;return `${cx+Math.cos(a)*r*s},${cy+Math.sin(a)*r*s}`;}).join(' ')}
          fill="none" stroke="#1e2028" strokeWidth={1} />
      ))}
      {keys.map((_,i) => { const a=(i/keys.length)*Math.PI*2-Math.PI/2; return <line key={i} x1={cx} y1={cy} x2={cx+Math.cos(a)*r} y2={cy+Math.sin(a)*r} stroke="#1e2028" strokeWidth={1} />; })}
      <polygon points={poly} fill={color + '33'} stroke={color} strokeWidth={1.5} />
      {points.map((p,i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={3} fill={color} />
          <text x={p.lx} y={p.ly} textAnchor="middle" dominantBaseline="middle" fill="#5c6070" fontSize={8} fontFamily="Barlow Condensed, sans-serif" fontWeight={700}>{keys[i]}</text>
        </g>
      ))}
    </svg>
  );
}

// ── Main page ──────────────────────────────────────────
export default function ProspectsPage() {
  const [prospects, setProspects]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [selected, setSelected]       = useState(null);
  const [teamFilter, setTeamFilter]   = useState(null);
  const [posFilter, setPosFilter]     = useState(null);
  const [view, setView]               = useState('cards'); // 'cards' | 'table' | 'radar'
  const [search, setSearch]           = useState('');
  const [sortBy, setSortBy]           = useState('rank');
  const router = useRouter();

  useEffect(() => {
    setLoading(true);
    fetch('/api/prospects?limit=40')
      .then(r => r.json())
      .then(d => { setProspects(d.prospects ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = [...prospects];
    if (teamFilter) list = list.filter(p => p.teamId === teamFilter);
    if (posFilter)  list = list.filter(p => posFilter === 'P' ? ['SP','RP'].includes(p.pos) : !['SP','RP'].includes(p.pos));
    if (search)     list = list.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.team.toLowerCase().includes(search.toLowerCase()));
    if (sortBy === 'rank')     list.sort((a,b) => a.rank - b.rank);
    else if (sortBy === 'eta') list.sort((a,b) => a.eta - b.eta);
    else if (sortBy === 'age') list.sort((a,b) => a.age - b.age);
    return list;
  }, [prospects, teamFilter, posFilter, search, sortBy]);

  // System strength by team (count of top 40)
  const teamCounts = useMemo(() => {
    const counts = {};
    prospects.forEach(p => { counts[p.teamId] = (counts[p.teamId] ?? 0) + 1; });
    return counts;
  }, [prospects]);

  const SK = ({ w='100%', h=16, r=6 }) => (
    <div style={{ width:w, height:h, borderRadius:r, background:'linear-gradient(90deg,#0d1117 25%,#1a1f2e 50%,#0d1117 75%)', backgroundSize:'600px 100%', animation:'shimmer 1.4s infinite linear' }} />
  );

  const promoCount = prospects.filter(p => p.recentPromo).length;

  return (
    <>
      <Head>
        <title>Prospects — COACH.</title>
        <link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700&family=Barlow+Condensed:wght@400;600;700;900&display=swap" rel="stylesheet" />
        <style>{`
          *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
          body{background:#03080f;color:#c8cde0;font-family:'Inter',sans-serif;-webkit-font-smoothing:antialiased}
          @keyframes shimmer{0%{background-position:-600px 0}100%{background-position:600px 0}}
          @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
          @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
          @keyframes fire{0%,100%{filter:drop-shadow(0 0 3px #ff6a00)}50%{filter:drop-shadow(0 0 8px #ff6a00)}}
          .fire-badge{animation:fire 1.4s infinite}
          a{text-decoration:none;color:inherit}
          ::-webkit-scrollbar{width:6px;height:6px}
          ::-webkit-scrollbar-track{background:#080c12}
          ::-webkit-scrollbar-thumb{background:#1e2028;border-radius:3px}
          .team-chip:hover{border-color:#00c2a8!important;color:#00c2a8!important}
          .sort-btn:hover{color:#f0f2f8!important}
          .view-btn:hover{border-color:#00c2a8!important}
        `}</style>
      </Head>

      {selected && <ProspectModal p={selected} onClose={() => setSelected(null)} onNavigate={id => { setSelected(null); router.push(`/players/${id}`); }} />}

      {/* NAV */}
      <nav style={sn.nav}>
        <a href="/" style={sn.logo}>COACH<span style={{color:'#00c2a8'}}>.</span></a>
        <div style={sn.links}>
          {[['/', 'Home'],['/scoreboard','Scoreboard'],['/teams','Teams'],['/prospects','Prospects']].map(([href,label])=>(
            <a key={href} href={href} style={{...sn.link, ...(href==='/prospects'?{color:'#00c2a8'}:{})}}>{label}</a>
          ))}
        </div>
      </nav>

      {/* HERO */}
      <div style={{ position:'relative', background:'linear-gradient(160deg,#03080f 0%,#061223 40%,#03080f 100%)', padding:'3.5rem 1.5rem 2rem', overflow:'hidden', borderBottom:'1px solid #1e2028' }}>
        <div style={{ position:'absolute', inset:0, backgroundImage:'radial-gradient(ellipse at 30% 50%,rgba(0,194,168,.12) 0%,transparent 55%),radial-gradient(ellipse at 80% 20%,rgba(245,166,35,.06) 0%,transparent 40%)', pointerEvents:'none' }} />
        <div style={{ maxWidth:'1200px', margin:'0 auto', position:'relative', zIndex:1 }}>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.7rem', fontWeight:700, letterSpacing:'.25em', color:'#00c2a8', marginBottom:'.5rem' }}>PIPELINE INTEL</div>
          <div style={{ fontFamily:"'Anton',sans-serif", fontSize:'clamp(2.5rem,6vw,5rem)', color:'#f0f2f8', lineHeight:.9, marginBottom:'1rem' }}>
            MLB PROSPECTS<br/><span style={{color:'#00c2a8'}}>TOP 100</span>
          </div>
          <div style={{ display:'flex', gap:'1.5rem', flexWrap:'wrap', marginTop:'1rem' }}>
            {[
              { label:'PROSPECTS RANKED', value:prospects.length || '—' },
              { label:'RECENT PROMOTIONS', value:promoCount || '—', fire:true },
              { label:'AVG MLB ETA', value: prospects.length ? Math.round(prospects.reduce((a,p)=>a+p.eta,0)/prospects.length) : '—' },
              { label:'TEAMS REPRESENTED', value: new Set(prospects.map(p=>p.teamId)).size || '—' },
            ].map(item => (
              <div key={item.label} style={{ background:'rgba(255,255,255,.03)', border:'1px solid #1e2028', borderRadius:'10px', padding:'.75rem 1.25rem' }}>
                <div style={{ fontFamily:"'Anton',sans-serif", fontSize:'1.6rem', color: item.fire ? '#ff6a00' : '#00c2a8', lineHeight:1 }}>
                  {item.fire && <span className="fire-badge" style={{marginRight:'.3rem'}}>🔥</span>}{item.value}
                </div>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.6rem', fontWeight:700, letterSpacing:'.15em', color:'#3a3f52', marginTop:'.2rem' }}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:'1200px', margin:'0 auto', padding:'1.5rem 1.5rem 4rem' }}>

        {/* Controls bar */}
        <div style={{ display:'flex', gap:'.75rem', flexWrap:'wrap', marginBottom:'1.5rem', alignItems:'center' }}>
          {/* Search */}
          <input
            value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Search prospects…"
            style={{ padding:'.45rem .85rem', background:'#0d1117', border:'1px solid #1e2028', borderRadius:'8px', color:'#f0f2f8', fontFamily:"'Inter',sans-serif", fontSize:'.85rem', outline:'none', width:'180px' }} />

          {/* Position filter */}
          {[{v:null,l:'All'},{v:'B',l:'Batters'},{v:'P',l:'Pitchers'}].map(f=>(
            <button key={f.l} onClick={()=>setPosFilter(f.v)}
              style={{ padding:'.4rem .85rem', background: posFilter===f.v ? 'rgba(0,194,168,.12)' : '#0d1117', border:`1px solid ${posFilter===f.v?'#00c2a8':'#1e2028'}`, borderRadius:'6px', fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.75rem', fontWeight:700, letterSpacing:'.1em', color:posFilter===f.v?'#00c2a8':'#5c6070', cursor:'pointer' }}>
              {f.l}
            </button>
          ))}

          {/* Sort */}
          <select value={sortBy} onChange={e=>setSortBy(e.target.value)}
            style={{ padding:'.4rem .85rem', background:'#0d1117', border:'1px solid #1e2028', borderRadius:'6px', color:'#f0f2f8', fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.75rem', fontWeight:700, letterSpacing:'.1em', cursor:'pointer', outline:'none' }}>
            <option value="rank">Sort: Rank</option>
            <option value="eta">Sort: ETA</option>
            <option value="age">Sort: Age</option>
          </select>

          {/* View toggle */}
          <div style={{ marginLeft:'auto', display:'flex', gap:'.4rem' }}>
            {[['cards','⊞ Cards'],['table','≡ Table'],['radar','◎ Radar']].map(([v,l])=>(
              <button key={v} className="view-btn" onClick={()=>setView(v)}
                style={{ padding:'.4rem .75rem', background: view===v ? 'rgba(0,194,168,.12)' : '#0d1117', border:`1px solid ${view===v?'#00c2a8':'#1e2028'}`, borderRadius:'6px', fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.72rem', fontWeight:700, letterSpacing:'.08em', color:view===v?'#00c2a8':'#5c6070', cursor:'pointer' }}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Team filter chips */}
        <div style={{ display:'flex', gap:'.4rem', flexWrap:'wrap', marginBottom:'1.5rem' }}>
          <button className="team-chip" onClick={()=>setTeamFilter(null)}
            style={{ padding:'.25rem .65rem', background: !teamFilter ? 'rgba(0,194,168,.12)' : '#0d1117', border:`1px solid ${!teamFilter?'#00c2a8':'#1e2028'}`, borderRadius:'6px', fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.68rem', fontWeight:700, letterSpacing:'.1em', color:!teamFilter?'#00c2a8':'#5c6070', cursor:'pointer', transition:'all .15s' }}>
            ALL TEAMS
          </button>
          {MLB_TEAMS.sort((a,b)=>(teamCounts[b.id]??0)-(teamCounts[a.id]??0)).filter(t=>teamCounts[t.id]).map(t=>(
            <button key={t.id} className="team-chip" onClick={()=>setTeamFilter(t.id===teamFilter?null:t.id)}
              style={{ padding:'.25rem .65rem', background: teamFilter===t.id ? 'rgba(0,194,168,.12)' : '#0d1117', border:`1px solid ${teamFilter===t.id?'#00c2a8':'#1e2028'}`, borderRadius:'6px', fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.68rem', fontWeight:700, letterSpacing:'.1em', color:teamFilter===t.id?'#00c2a8':'#5c6070', cursor:'pointer', transition:'all .15s' }}>
              {t.abbr} <span style={{color:'#3a3f52'}}>·{teamCounts[t.id]}</span>
            </button>
          ))}
        </div>

        {/* Count */}
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.7rem', fontWeight:700, letterSpacing:'.15em', color:'#3a3f52', marginBottom:'1rem' }}>
          SHOWING {filtered.length} PROSPECT{filtered.length !== 1 ? 'S' : ''}
          {teamFilter && ` · ${MLB_TEAMS.find(t=>t.id===teamFilter)?.name?.toUpperCase()}`}
        </div>

        {/* ── CARDS VIEW ── */}
        {view === 'cards' && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(290px,1fr))', gap:'1rem' }}>
            {loading
              ? Array.from({length:8}).map((_,i)=>(
                <div key={i} style={{background:'#0d1117',border:'1px solid #1e2028',borderRadius:'12px',padding:'.9rem',display:'flex',flexDirection:'column',gap:'.65rem'}}>
                  <div style={{display:'flex',gap:'.75rem'}}>
                    <SK w={52} h={52} r={10} />
                    <div style={{flex:1,display:'flex',flexDirection:'column',gap:'.4rem',paddingTop:'.2rem'}}>
                      <SK w="75%" h={18} r={4} />
                      <SK w="50%" h={12} r={3} />
                    </div>
                  </div>
                  <SK h={56} r={8} />
                  <div style={{display:'flex',flexDirection:'column',gap:'.35rem'}}>
                    {Array.from({length:5}).map((_,j)=><SK key={j} h={12} r={2} />)}
                  </div>
                </div>
              ))
              : filtered.map(p => (
                <ProspectCard key={p.id} p={p} rank={p.rank} onClick={setSelected} />
              ))
            }
          </div>
        )}

        {/* ── TABLE VIEW ── */}
        {view === 'table' && (
          <div style={{ background:'#0d1117', border:'1px solid #1e2028', borderRadius:'12px', overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ borderBottom:'1px solid #1e2028' }}>
                  {['#','Player','Pos','Team','Lvl','ETA','Age','HIT','PWR','RUN','FLD','ARM','OVR','Stats'].map(h=>(
                    <th key={h} style={{ padding:'.6rem .75rem', fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.65rem', fontWeight:700, letterSpacing:'.12em', color:'#5c6070', textAlign:h==='#'||h==='Age'||h==='HIT'||h==='PWR'||h==='RUN'||h==='FLD'||h==='ARM'||h==='OVR'?'center':'left', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p,i) => {
                  const avg5 = p.tools ? Math.round(Object.values(p.tools).reduce((a,b)=>a+b,0)/5) : 50;
                  const oc   = TOOL_COLOR(avg5);
                  return (
                    <tr key={p.id} onClick={()=>setSelected(p)}
                      style={{ borderBottom:'1px solid rgba(30,32,40,.7)', cursor:'pointer', transition:'background .15s' }}
                      onMouseEnter={e=>e.currentTarget.style.background='rgba(0,194,168,.04)'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <td style={{ padding:'.5rem .75rem', textAlign:'center' }}>
                        <span style={{ fontFamily:"'Anton',sans-serif", fontSize:'.85rem', color:'#5c6070' }}>{p.rank}</span>
                      </td>
                      <td style={{ padding:'.5rem .75rem' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'.6rem' }}>
                          <img src={`https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_60,q_auto:best/v1/people/${p.id}/headshot/67/current`}
                            alt="" style={{ width:'28px', height:'28px', borderRadius:'6px', objectFit:'cover', background:'#1e2028', flexShrink:0 }} />
                          <div>
                            <span style={{ fontFamily:"'Inter',sans-serif", fontWeight:600, fontSize:'.84rem', color:'#f0f2f8' }}>{p.name}</span>
                            {p.recentPromo && <span style={{marginLeft:'.35rem'}} title="Recently promoted">🔥</span>}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding:'.5rem .75rem', color:'#5c6070', fontSize:'.8rem' }}>{p.pos}</td>
                      <td style={{ padding:'.5rem .75rem', color:'#5c6070', fontSize:'.8rem', whiteSpace:'nowrap' }}>{p.team}</td>
                      <td style={{ padding:'.5rem .75rem', textAlign:'center' }}>
                        <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.68rem', fontWeight:700, color:LEVEL_COLOR[p.level]??'#5c6070' }}>{p.level}</span>
                      </td>
                      <td style={{ padding:'.5rem .75rem', textAlign:'center' }}>
                        <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.72rem', fontWeight:700, color: p.eta <= new Date().getFullYear() ? '#00c2a8' : '#f5a623' }}>{p.eta <= new Date().getFullYear() ? 'NOW' : p.eta}</span>
                      </td>
                      <td style={{ padding:'.5rem .75rem', textAlign:'center', color:'#5c6070', fontSize:'.8rem' }}>{p.age}</td>
                      {['hit','power','run','field','arm'].map(tool=>(
                        <td key={tool} style={{ padding:'.5rem .5rem', textAlign:'center' }}>
                          <span style={{ fontFamily:"'Anton',sans-serif", fontSize:'.82rem', color:TOOL_COLOR(p.tools?.[tool]??50) }}>{p.tools?.[tool]??'—'}</span>
                        </td>
                      ))}
                      <td style={{ padding:'.5rem .5rem', textAlign:'center' }}>
                        <div style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:'28px', height:'20px', borderRadius:'4px', background:oc }}>
                          <span style={{ fontFamily:"'Anton',sans-serif", fontSize:'.72rem', color:'#fff' }}>{avg5}</span>
                        </div>
                      </td>
                      <td style={{ padding:'.5rem .75rem', fontSize:'.75rem', color:'#5c6070', whiteSpace:'nowrap' }}>
                        {p.stats ? (p.isPitcher ? `${p.stats.era??'—'} ERA` : `${p.stats.avg??'—'} / ${p.stats.ops??'—'}`) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── RADAR VIEW ── */}
        {view === 'radar' && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:'1rem' }}>
            {filtered.map(p => {
              const avg5 = p.tools ? Math.round(Object.values(p.tools).reduce((a,b)=>a+b,0)/5) : 50;
              const oc   = TOOL_COLOR(avg5);
              return (
                <div key={p.id} onClick={()=>setSelected(p)} style={{ background:'#0d1117', border:'1px solid #1e2028', borderRadius:'12px', padding:'1rem', cursor:'pointer', transition:'all .2s', display:'flex', flexDirection:'column', alignItems:'center', gap:'.5rem' }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor='#00c2a8';e.currentTarget.style.transform='translateY(-2px)'}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor='#1e2028';e.currentTarget.style.transform='none'}}>
                  <div style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <div style={{ fontFamily:"'Anton',sans-serif", fontSize:'.95rem', color:'#f0f2f8' }}>{p.name}</div>
                      <div style={{ fontSize:'.68rem', color:'#5c6070' }}>{p.pos} · {p.team}</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontFamily:"'Anton',sans-serif", fontSize:'1.1rem', color:oc }}>{avg5}</div>
                      {p.recentPromo && <span title="Recently promoted" style={{fontSize:'.9rem'}} className="fire-badge">🔥</span>}
                    </div>
                  </div>
                  <ToolRadar tools={p.tools} color={oc} />
                  <EtaBadge eta={p.eta} level={p.level} />
                </div>
              );
            })}
          </div>
        )}

        {/* System strength chart */}
        {!teamFilter && !loading && (
          <div style={{ marginTop:'3rem' }}>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.72rem', fontWeight:700, letterSpacing:'.22em', color:'#00c2a8', marginBottom:'1.25rem', paddingBottom:'.5rem', borderBottom:'1px solid #1e2028' }}>
              🏆 FARM SYSTEM STRENGTH — TOP 40 DISTRIBUTION
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'.6rem' }}>
              {MLB_TEAMS.filter(t=>teamCounts[t.id]).sort((a,b)=>(teamCounts[b.id]??0)-(teamCounts[a.id]??0)).map(t=>{
                const count = teamCounts[t.id] ?? 0;
                const pct   = (count / Math.max(...Object.values(teamCounts))) * 100;
                const grade = count >= 5 ? '#c8102e' : count >= 3 ? '#f5a623' : count >= 2 ? '#f47c7c' : '#6baed6';
                return (
                  <div key={t.id} style={{ background:'#0d1117', border:'1px solid #1e2028', borderRadius:'8px', padding:'.65rem .85rem', cursor:'pointer' }}
                    onClick={()=>setTeamFilter(t.id===teamFilter?null:t.id)}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'.4rem' }}>
                      <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.78rem', fontWeight:700, color:'#f0f2f8' }}>{t.abbr}</span>
                      <span style={{ fontFamily:"'Anton',sans-serif", fontSize:'.85rem', color:grade }}>{count}</span>
                    </div>
                    <div style={{ height:'4px', background:'#1e2028', borderRadius:'2px', overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${pct}%`, background:grade, borderRadius:'2px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      <footer style={{ borderTop:'1px solid #1e2028', padding:'1.4rem', textAlign:'center', fontSize:'.74rem', color:'#5c6070' }}>
        Prospect data via MLB Pipeline & Baseball America · Stats via <a href="https://statsapi.mlb.com" target="_blank" rel="noopener" style={{color:'#5c6070'}}>MLB Stats API</a> · Coach.com
      </footer>
    </>
  );
}

const sn = {
  nav:   {position:'sticky',top:0,zIndex:200,background:'rgba(3,8,15,.96)',backdropFilter:'blur(16px)',borderBottom:'1px solid #1e2028',height:'54px',display:'flex',alignItems:'center',padding:'0 1.5rem',gap:'1rem'},
  logo:  {fontFamily:"'Anton',sans-serif",fontSize:'1.5rem',letterSpacing:'.08em',color:'#f0f2f8',textDecoration:'none',flexShrink:0},
  links: {display:'flex',gap:'1.5rem',marginLeft:'auto'},
  link:  {fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.82rem',fontWeight:700,letterSpacing:'.12em',textTransform:'uppercase',color:'#5c6070',textDecoration:'none'},
};