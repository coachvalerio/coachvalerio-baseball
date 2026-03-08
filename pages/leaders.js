// pages/leaders.js
import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

const CUR_YEAR = new Date().getFullYear();
const SEASONS  = Array.from({ length: CUR_YEAR - 1999 }, (_, i) => CUR_YEAR - i);

const NAV_LINKS = [
  ['/', 'Home'], ['/scoreboard', 'Scoreboard'], ['/teams', 'Teams'],
  ['/transactions', 'Transactions'], ['/compare', 'Compare'],
  ['/trade', 'Trade AI'], ['/odds-board', 'Odds Board'], ['/leaders', 'Leaders'],
];

const TABS = [
  { key: 'batting',  label: 'BATTING'  },
  { key: 'pitching', label: 'PITCHING' },
  { key: 'statcast', label: 'STATCAST' },
];

const BATTING_BOARDS = [
  { key: 'battingAverage',     label: 'BATTING AVERAGE', abbr: 'AVG' },
  { key: 'onBasePercentage',   label: 'ON-BASE PCT',     abbr: 'OBP' },
  { key: 'sluggingPercentage', label: 'SLUGGING PCT',    abbr: 'SLG' },
  { key: 'onBasePlusSlugging', label: 'ON-BASE + SLUG',  abbr: 'OPS' },
  { key: 'homeRuns',           label: 'HOME RUNS',       abbr: 'HR'  },
  { key: 'runsBattedIn',       label: 'RUNS BATTED IN',  abbr: 'RBI' },
  { key: 'stolenBases',        label: 'STOLEN BASES',    abbr: 'SB'  },
  { key: 'baseOnBalls',        label: 'WALKS',           abbr: 'BB'  },
  { key: 'hits',               label: 'HITS',            abbr: 'H'   },
  { key: 'totalBases',         label: 'TOTAL BASES',     abbr: 'TB'  },
];

const PITCHING_BOARDS = [
  { key: 'earnedRunAverage',             label: 'EARNED RUN AVG',  abbr: 'ERA'   },
  { key: 'walksAndHitsPerInningPitched', label: 'WHIP',            abbr: 'WHIP'  },
  { key: 'strikeouts',                   label: 'STRIKEOUTS',      abbr: 'K'     },
  { key: 'inningsPitched',               label: 'INNINGS PITCHED', abbr: 'IP'    },
  { key: 'wins',                         label: 'WINS',            abbr: 'W'     },
  { key: 'saves',                        label: 'SAVES',           abbr: 'SV'    },
  { key: 'holds',                        label: 'HOLDS',           abbr: 'HLD'   },
  { key: 'strikeoutsPer9Inn',            label: 'K PER 9 INN',     abbr: 'K/9'   },
  { key: 'baseOnBallsPer9Inn',           label: 'BB PER 9 INN',    abbr: 'BB/9'  },
  { key: 'strikeoutWalkRatio',           label: 'K/BB RATIO',      abbr: 'K/BB'  },
];

const STATCAST_PITCH_TYPES = [
  { key:'FF', label:'4-Seam FB' },
  { key:'SI', label:'Sinker'    },
  { key:'FC', label:'Cutter'    },
  { key:'SL', label:'Slider'    },
  { key:'ST', label:'Sweeper'   },
  { key:'CU', label:'Curveball' },
  { key:'CH', label:'Changeup'  },
  { key:'FS', label:'Split-Finger'},
];

function parseCSVBrowser(text) {
  if (!text?.trim()) return [];
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.replace(/"/g,'').trim().toLowerCase());
  return lines.slice(1).map(line => {
    const vals=[]; let cur='', inQ=false;
    for (const ch of line) {
      if (ch==='"'){ inQ=!inQ; }
      else if (ch===',' && !inQ){ vals.push(cur.trim()); cur=''; }
      else cur+=ch;
    }
    vals.push(cur.trim());
    const obj={};
    headers.forEach((h,i)=>{ obj[h]=vals[i]??''; });
    return obj;
  });
}

function parseSavantName(r) {
  if (r['last_name'] && r['first_name']) return `${r['first_name'].trim()} ${r['last_name'].trim()}`;
  const raw = r['player_name']??'';
  if (raw.includes(',')){ const[l,f]=raw.split(',').map(s=>s.trim()); return `${f} ${l}`; }
  return raw||'—';
}

function StatcastLeaders({ season, onPlayer }) {
  const [veloData,   setVeloData]   = useState([]);
  const [moveData,   setMoveData]   = useState([]);
  const [pitchType,  setPitchType]  = useState('FF');
  const [loadingV,   setLoadingV]   = useState(true);
  const [loadingM,   setLoadingM]   = useState(true);
  const [errorV,     setErrorV]     = useState(false);
  const [errorM,     setErrorM]     = useState(false);

  // Velocity — pitch arsenals leaderboard, sorted by avg fastball velo
  useEffect(() => {
    if (season < 2017) { setVeloData([]); setLoadingV(false); return; }
    setLoadingV(true); setErrorV(false);
    fetch(`https://baseballsavant.mlb.com/leaderboard/pitch-arsenals?season=${season}&position=&team=&min=50&csv=true`)
      .then(r => r.ok ? r.text() : Promise.reject())
      .then(text => {
        const rows = parseCSVBrowser(text)
          .filter(r => parseFloat(r['avg_speed']??r['velo']) > 0)
          .sort((a,b) => parseFloat((b['avg_speed']??b['velo'])??0) - parseFloat((a['avg_speed']??a['velo'])??0))
          .slice(0,10)
          .map((r,i) => ({
            rank: i+1,
            name: parseSavantName(r),
            team: r['team_name_abbrev']??'—',
            playerId: r['player_id'] ? parseInt(r['player_id']) : null,
            value: `${parseFloat(r['avg_speed']??r['velo']).toFixed(1)} mph`,
            sub: r['pitch_name']??r['pitch_type']??'',
          }));
        setVeloData(rows); setLoadingV(false);
      })
      .catch(() => { setErrorV(true); setLoadingV(false); });
  }, [season]);

  // Movement — pitch-movement leaderboard, filterable by pitch type
  useEffect(() => {
    if (season < 2017) { setMoveData([]); setLoadingM(false); return; }
    setLoadingM(true); setErrorM(false);
    fetch(`https://baseballsavant.mlb.com/leaderboard/pitch-movement?season=${season}&team=&min=250&type=pitcher&pitch_type=${pitchType}&hand=&csv=true`)
      .then(r => r.ok ? r.text() : Promise.reject())
      .then(text => {
        const rows = parseCSVBrowser(text)
          .filter(r => parseFloat((r['avg_break']??r['pitcher_break_z'])??0) !== 0)
          .sort((a,b) => Math.abs(parseFloat((b['avg_break']??b['pitcher_break_z'])??0)) - Math.abs(parseFloat((a['avg_break']??a['pitcher_break_z'])??0)))
          .slice(0,10)
          .map((r,i) => ({
            rank: i+1,
            name: parseSavantName(r),
            team: r['team_name_abbrev']??'—',
            playerId: r['player_id'] ? parseInt(r['player_id']) : null,
            value: `${Math.abs(parseFloat(r['avg_break']??r['pitcher_break_z']??0)).toFixed(1)}"`,
            sub: STATCAST_PITCH_TYPES.find(p=>p.key===pitchType)?.label??pitchType,
          }));
        setMoveData(rows); setLoadingM(false);
      })
      .catch(() => { setErrorM(true); setLoadingM(false); });
  }, [season, pitchType]);

  if (season < 2017) {
    return (
      <div style={{ textAlign:'center', padding:'3rem', color:'#3a3f52', fontFamily:"'Barlow Condensed',sans-serif", fontSize:'1rem', letterSpacing:'.1em' }}>
        STATCAST DATA AVAILABLE FROM 2017
      </div>
    );
  }

  return (
    <div>
      {/* Velo board */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:'1rem' }}>
        <LeaderBoard
          board={{ key:'velo', label:'AVG FASTBALL VELOCITY', abbr:'MPH' }}
          leaders={loadingV ? null : veloData}
          loading={loadingV}
          error={errorV}
          onPlayer={onPlayer}
        />

        {/* Movement board with pitch type filter */}
        <div style={{ background:'#0d1117', borderRadius:'12px', overflow:'hidden', border:'1px solid #1e2028' }}>
          <div style={{ background:'#080c12', padding:'.65rem 1rem', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid #1e2028', flexWrap:'wrap', gap:'.5rem' }}>
            <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.63rem', fontWeight:700, letterSpacing:'.14em', color:'#5c6070' }}>
              MOST PITCH MOVEMENT
            </span>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'.25rem' }}>
              {STATCAST_PITCH_TYPES.map(pt => (
                <button key={pt.key} onClick={() => setPitchType(pt.key)}
                  style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.6rem', fontWeight:700, letterSpacing:'.06em', padding:'.18rem .4rem', borderRadius:'4px', border:`1px solid ${pitchType===pt.key?'#00c2a8':'#1e2028'}`, background: pitchType===pt.key?'#00c2a822':'transparent', color: pitchType===pt.key?'#00c2a8':'#5c6070', cursor:'pointer', transition:'all .15s' }}>
                  {pt.label}
                </button>
              ))}
            </div>
          </div>
          {loadingM ? (
            [...Array(10)].map((_,i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:'.6rem', padding:'.45rem .9rem', borderTop: i>0?'1px solid #1e2028':'none' }}>
                <div className="skeleton" style={{ width:'18px', height:'18px', borderRadius:'50%' }} />
                <div className="skeleton" style={{ width:'32px', height:'32px', borderRadius:'50%' }} />
                <div style={{ flex:1 }}>
                  <div className="skeleton" style={{ width:'65%', height:'10px', borderRadius:'3px', marginBottom:'4px' }} />
                  <div className="skeleton" style={{ width:'30%', height:'9px', borderRadius:'3px' }} />
                </div>
                <div className="skeleton" style={{ width:'44px', height:'14px', borderRadius:'4px' }} />
              </div>
            ))
          ) : errorM ? (
            <div style={{ padding:'2rem', textAlign:'center', color:'#3a3f52', fontSize:'.75rem' }}>
              Could not load from Baseball Savant
            </div>
          ) : moveData.length === 0 ? (
            <div style={{ padding:'2rem', textAlign:'center', color:'#3a3f52', fontSize:'.75rem' }}>
              No data for {pitchType} in {season}
            </div>
          ) : moveData.map((p,i) => (
            <div key={i}
              onClick={() => p.playerId && onPlayer(p.playerId)}
              style={{ display:'flex', alignItems:'center', gap:'.55rem', padding:'.4rem .85rem', borderTop: i>0?'1px solid #12161e':'none', cursor: p.playerId?'pointer':'default', transition:'background .12s' }}
              onMouseEnter={e=>{ if(p.playerId) e.currentTarget.style.background='#13171f'; }}
              onMouseLeave={e=>{ e.currentTarget.style.background='transparent'; }}>
              <span style={{ fontFamily:"'Anton',sans-serif", fontSize:'.72rem', color: i===0?'#00c2a8':'#3a3f52', width:'16px', textAlign:'center', flexShrink:0 }}>{p.rank}</span>
              <div style={{ width:'32px', height:'32px', borderRadius:'50%', overflow:'hidden', flexShrink:0, background:'#1e2028', border: i===0?'2px solid #00c2a8':'2px solid #1e2028' }}>
                {p.playerId ? (
                  <img src={`https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_32,q_auto:best/v1/people/${p.playerId}/headshot/67/current`}
                    width={32} height={32} style={{ objectFit:'cover', width:'100%', height:'100%' }}
                    onError={e=>e.target.style.opacity=0} />
                ) : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.6rem', color:'#3a3f52' }}>?</div>}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:"'Inter',sans-serif", fontSize:'.77rem', fontWeight:600, color:'#e8ebf5', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.name}</div>
                <div style={{ display:'flex', alignItems:'center', gap:'.25rem', marginTop:'1px' }}>
                  {p.team && p.team!=='—' && <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.58rem', fontWeight:700, color:'#fff', background: TEAM_COLORS[p.team]??'#1e2028', padding:'0 .28rem', borderRadius:'3px' }}>{p.team}</span>}
                  {p.sub && <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.57rem', color:'#3a3f52' }}>{p.sub}</span>}
                </div>
              </div>
              <span style={{ fontFamily:"'Anton',sans-serif", fontSize: i===0?'.95rem':'.82rem', color: i===0?'#00c2a8':'#c8cce0', flexShrink:0, minWidth:'42px', textAlign:'right' }}>{p.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop:'1rem', padding:'.6rem 1rem', background:'#0a0e14', borderRadius:'8px', border:'1px solid #1e2028' }}>
        <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.62rem', fontWeight:700, letterSpacing:'.1em', color:'#3a3f52' }}>
          DATA VIA BASEBALL SAVANT · FETCHED LIVE IN YOUR BROWSER · MIN 50 PITCHES (VELO) / 250 PITCHES (MOVEMENT)
        </span>
      </div>
    </div>
  );
}

const TEAM_COLORS = {
  NYY:'#003087',LAD:'#005A9C',BOS:'#BD3039',CHC:'#0E3386',SFG:'#FD5A1E',
  ATL:'#CE1141',HOU:'#EB6E1F',NYM:'#002D72',PHI:'#E81828',STL:'#C41E3A',
  MIL:'#FFC52F',MIN:'#002B5C',SEA:'#0C2C56',TOR:'#134A8E',BAL:'#DF4601',
  DET:'#0C2340',CLE:'#00385D',TEX:'#003278',OAK:'#003831',LAA:'#BA0021',
  CWS:'#27251F',KCR:'#004687',TBR:'#092C5C',MIA:'#00A3E0',COL:'#333366',
  ARI:'#A71930',WSN:'#AB0003',SDP:'#2F241D',PIT:'#FDB827',CIN:'#C6011F',
};
const teamColor = a => TEAM_COLORS[a] ?? '#1e2028';

function SkeletonBoard() {
  return (
    <div style={{ background:'#0d1117', borderRadius:'12px', overflow:'hidden', border:'1px solid #1e2028' }}>
      <div style={{ height:'48px', background:'#080c12', padding:'0 1rem', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div className="skeleton" style={{ width:'110px', height:'12px', borderRadius:'4px' }} />
        <div className="skeleton" style={{ width:'38px', height:'20px', borderRadius:'6px' }} />
      </div>
      {[...Array(10)].map((_, i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:'.6rem', padding:'.45rem .9rem', borderTop:'1px solid #1e2028' }}>
          <div className="skeleton" style={{ width:'18px', height:'18px', borderRadius:'50%', flexShrink:0 }} />
          <div className="skeleton" style={{ width:'32px', height:'32px', borderRadius:'50%', flexShrink:0 }} />
          <div style={{ flex:1 }}>
            <div className="skeleton" style={{ width:'65%', height:'10px', borderRadius:'3px', marginBottom:'4px' }} />
            <div className="skeleton" style={{ width:'30%', height:'9px', borderRadius:'3px' }} />
          </div>
          <div className="skeleton" style={{ width:'44px', height:'14px', borderRadius:'4px' }} />
        </div>
      ))}
    </div>
  );
}

function LeaderBoard({ board, leaders, loading, onPlayer }) {
  const isEmpty = !loading && (!leaders || leaders.length === 0);
  const accent  = '#00c2a8';
  return (
    <div style={{ background:'#0d1117', borderRadius:'12px', overflow:'hidden', border:'1px solid #1e2028', display:'flex', flexDirection:'column' }}>
      <div style={{ background:'#080c12', padding:'.65rem 1rem', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid #1e2028' }}>
        <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.63rem', fontWeight:700, letterSpacing:'.14em', color:'#5c6070' }}>
          {board.label}
        </span>
        <span style={{ fontFamily:"'Anton',sans-serif", fontSize:'.9rem', letterSpacing:'.06em', color: accent, background: accent + '18', padding:'.12rem .45rem', borderRadius:'6px' }}>
          {board.abbr}
        </span>
      </div>
      {isEmpty ? (
        <div style={{ padding:'1.75rem 1rem', textAlign:'center', color:'#3a3f52', fontSize:'.72rem', fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:'.08em' }}>
          NO DATA AVAILABLE FOR THIS SEASON
        </div>
      ) : leaders.map((p, i) => (
        <div key={i}
          onClick={() => p.playerId && onPlayer(p.playerId)}
          style={{ display:'flex', alignItems:'center', gap:'.55rem', padding:'.4rem .85rem', borderTop: i > 0 ? '1px solid #12161e' : 'none', cursor: p.playerId ? 'pointer' : 'default', transition:'background .12s' }}
          onMouseEnter={e => { if (p.playerId) e.currentTarget.style.background = '#13171f'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          <span style={{ fontFamily:"'Anton',sans-serif", fontSize:'.72rem', color: i === 0 ? accent : '#3a3f52', width:'16px', textAlign:'center', flexShrink:0 }}>
            {p.rank ?? i+1}
          </span>
          <div style={{ width:'32px', height:'32px', borderRadius:'50%', overflow:'hidden', flexShrink:0, background:'#1e2028', border: i === 0 ? `2px solid ${accent}` : '2px solid #1e2028' }}>
            {p.playerId ? (
              <img
                src={`https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_32,q_auto:best/v1/people/${p.playerId}/headshot/67/current`}
                width={32} height={32} alt={p.name}
                style={{ objectFit:'cover', width:'100%', height:'100%' }}
                onError={e => { e.target.style.opacity=0; }}
              />
            ) : (
              <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.6rem', color:'#3a3f52' }}>?</div>
            )}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontFamily:"'Inter',sans-serif", fontSize:'.77rem', fontWeight:600, color:'#e8ebf5', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {p.name}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'.25rem', marginTop:'1px' }}>
              {p.team && p.team !== '—' && (
                <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.58rem', fontWeight:700, letterSpacing:'.08em', color:'#fff', background: teamColor(p.team), padding:'0 .28rem', borderRadius:'3px' }}>
                  {p.team}
                </span>
              )}
              {p.sub && <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.57rem', color:'#3a3f52' }}>{p.sub}</span>}
            </div>
          </div>
          <span style={{ fontFamily:"'Anton',sans-serif", fontSize: i === 0 ? '.95rem' : '.82rem', color: i === 0 ? accent : '#c8cce0', flexShrink:0, minWidth:'42px', textAlign:'right' }}>
            {p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function LeadersPage() {
  const router  = useRouter();
  const [season,  setSeason]  = useState(CUR_YEAR);
  const [tab,     setTab]     = useState('batting');
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (router.isReady) {
      const s = parseInt(router.query.season ?? CUR_YEAR, 10);
      setSeason(s);
    }
  }, [router.isReady, router.query.season]);

  const load = useCallback((yr) => {
    setLoading(true);
    setData(null);
    fetch(`/api/leaders?season=${yr}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(season); }, [season, load]);

  const changeSeason = yr => {
    setSeason(yr);
    router.push(`/leaders?season=${yr}`, undefined, { shallow: true });
  };

  const goPlayer = id => router.push(`/players/${id}`);

  const boards = tab === 'batting' ? BATTING_BOARDS : PITCHING_BOARDS;
  const gridCols = 'repeat(auto-fill,minmax(280px,1fr))';

  return (
    <>
      <Head>
        <title>League Leaders {season} - COACH.</title>
      </Head>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:#080c12;color:#f0f2f8;font-family:'Inter',sans-serif}
        @keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
        .skeleton{background:linear-gradient(90deg,#1a1f2e 25%,#242938 50%,#1a1f2e 75%);background-size:400px 100%;animation:shimmer 1.4s infinite}
        a{color:inherit;text-decoration:none}
        select{appearance:none;-webkit-appearance:none}
      `}</style>

      {/* NAV */}
      <nav style={{ position:'sticky', top:0, zIndex:200, background:'rgba(3,8,15,.97)', backdropFilter:'blur(16px)', borderBottom:'1px solid #1e2028', height:'54px', display:'flex', alignItems:'center', padding:'0 1.5rem', gap:'1rem' }}>
        <a href="/" style={{ fontFamily:"'Anton',sans-serif", fontSize:'1.5rem', letterSpacing:'.08em', color:'#f0f2f8', flexShrink:0 }}>COACH.</a>
        <div style={{ display:'flex', gap:'1.5rem', marginLeft:'auto' }}>
          {NAV_LINKS.map(([href, label]) => (
            <a key={href} href={href}
              style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.82rem', fontWeight:700, letterSpacing:'.12em', textTransform:'uppercase', color: href === '/leaders' ? '#00c2a8' : '#5c6070' }}
              onMouseEnter={e => e.target.style.color='#f0f2f8'}
              onMouseLeave={e => e.target.style.color= href==='/leaders' ? '#00c2a8' : '#5c6070'}
            >{label}</a>
          ))}
        </div>
      </nav>

      {/* HERO */}
      <div style={{ borderBottom:'1px solid #1e2028', padding:'2.5rem 1.5rem 2rem', textAlign:'center' }}>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.7rem', fontWeight:700, letterSpacing:'.22em', color:'#00c2a8', marginBottom:'.5rem' }}>MLB</div>
        <h1 style={{ fontFamily:"'Anton',sans-serif", fontSize:'clamp(2.4rem,6vw,4rem)', letterSpacing:'.04em', lineHeight:1.05, marginBottom:'1.25rem' }}>LEAGUE LEADERS</h1>
        <div style={{ display:'inline-flex', alignItems:'center', gap:'.75rem', background:'#0d1117', border:'1px solid #1e2028', borderRadius:'10px', padding:'.5rem 1rem' }}>
          <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.7rem', fontWeight:700, letterSpacing:'.12em', color:'#5c6070' }}>SEASON</span>
          <div style={{ position:'relative' }}>
            <select value={season} onChange={e => changeSeason(parseInt(e.target.value))}
              style={{ background:'transparent', border:'none', color:'#f0f2f8', fontFamily:"'Anton',sans-serif", fontSize:'1.1rem', letterSpacing:'.06em', cursor:'pointer', paddingRight:'1.25rem', outline:'none' }}>
              {SEASONS.map(yr => <option key={yr} value={yr} style={{ background:'#0d1117' }}>{yr}</option>)}
            </select>
            <span style={{ position:'absolute', right:0, top:'50%', transform:'translateY(-50%)', color:'#5c6070', fontSize:'.6rem', pointerEvents:'none' }}>v</span>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div style={{ position:'sticky', top:'54px', zIndex:100, background:'rgba(8,12,21,.97)', backdropFilter:'blur(12px)', borderBottom:'1px solid #1e2028' }}>
        <div style={{ maxWidth:'1400px', margin:'0 auto', padding:'0 1.5rem', display:'flex', alignItems:'center' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ fontFamily:"'Anton',sans-serif", fontSize:'.85rem', letterSpacing:'.1em', color: tab===t.key ? '#00c2a8' : '#3a3f52', background:'transparent', border:'none', borderBottom: tab===t.key ? '2px solid #00c2a8' : '2px solid transparent', padding:'.9rem 1.5rem', cursor:'pointer', transition:'all .2s' }}>
              {t.label}
            </button>
          ))}
          {tab === 'statcast' && data && !data.savantAvailable && (
            <span style={{ marginLeft:'auto', fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.65rem', fontWeight:700, letterSpacing:'.1em', color:'#f5a623' }}>
              STATCAST AVAILABLE FROM 2017
            </span>
          )}
        </div>
      </div>

      {/* BOARDS */}
      <div style={{ maxWidth:'1400px', margin:'0 auto', padding:'1.5rem' }}>
        {loading ? (
          <div style={{ display:'grid', gridTemplateColumns: gridCols, gap:'1rem' }}>
            {[...Array(boards.length)].map((_, i) => <SkeletonBoard key={i} />)}
          </div>
        ) : !data ? (
          <div style={{ textAlign:'center', color:'#3a3f52', fontFamily:"'Barlow Condensed',sans-serif", fontSize:'1rem', letterSpacing:'.1em', padding:'4rem' }}>
            FAILED TO LOAD
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns: gridCols, gap:'1rem' }}>
            {tab === 'statcast' ? (
              <div style={{ gridColumn:'1/-1' }}>
                <StatcastLeaders season={season} onPlayer={goPlayer} />
              </div>
            ) : boards.map(board => (
              <LeaderBoard key={board.key} board={board} leaders={data[board.key] ?? []} onPlayer={goPlayer} />
            ))}
          </div>
        )}
      </div>

      <div style={{ borderTop:'1px solid #1e2028', padding:'1.5rem', textAlign:'center', marginTop:'2rem' }}>
        <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.62rem', fontWeight:700, letterSpacing:'.14em', color:'#3a3f52' }}>
          STATS VIA MLB STATS API + BASEBALL SAVANT · COACH. {CUR_YEAR}
        </span>
      </div>
    </>
  );
}