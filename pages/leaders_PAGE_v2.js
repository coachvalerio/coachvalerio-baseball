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

// ── Tab + stat definitions ──────────────────────────────────────────────────
const TABS = [
  { key: 'batting',  label: 'BATTING'  },
  { key: 'pitching', label: 'PITCHING' },
  { key: 'statcast', label: 'STATCAST' },
];

const BATTING_BOARDS = [
  { key: 'battingAverage',      label: 'BATTING AVERAGE', abbr: 'BA'    },
  { key: 'onBasePercentage',    label: 'ON-BASE PCT',     abbr: 'OBP'   },
  { key: 'onBasePlusSlugging',  label: 'ON-BASE + SLUG',  abbr: 'OPS'   },
  { key: 'homeRuns',            label: 'HOME RUNS',       abbr: 'HR'    },
  { key: 'runsBattedIn',        label: 'RUNS BATTED IN',  abbr: 'RBI'   },
  { key: 'stolenBases',         label: 'STOLEN BASES',    abbr: 'SB'    },
  { key: 'wrc_plus',            label: 'EXPECTED wOBA',   abbr: 'xwOBA', savant: true },
  { key: 'batter_war',          label: 'xwOBA LEADERS',   abbr: 'xwOBA', savant: true },
];

const PITCHING_BOARDS = [
  { key: 'earnedRunAverage',              label: 'EARNED RUN AVG',   abbr: 'ERA'   },
  { key: 'walksAndHitsPerInningPitched',  label: 'WHIP',             abbr: 'WHIP'  },
  { key: 'inningsPitched',                label: 'INNINGS PITCHED',  abbr: 'IP'    },
  { key: 'strikeouts',                    label: 'STRIKEOUTS',       abbr: 'K'     },
  { key: 'wins',                          label: 'WINS',             abbr: 'W'     },
  { key: 'saves',                         label: 'SAVES',            abbr: 'SV'    },
  { key: 'holds',                         label: 'HOLDS',            abbr: 'HLD'   },
  { key: 'xera',                          label: 'EXPECTED ERA',     abbr: 'xERA',  savant: true },
  { key: 'fip',                           label: 'xERA vs ERA DIFF', abbr: 'DIFF',  savant: true },
  { key: 'pitcher_war',                   label: 'BEST xERA',        abbr: 'xERA',  savant: true },
];

const STATCAST_BOARDS = [
  { key: 'velo',     label: 'AVG FASTBALL VELOCITY', abbr: 'MPH'  },
  { key: 'movement', label: 'MOST PITCH MOVEMENT',   abbr: 'IN.'  },
];

// ── Team color map ──────────────────────────────────────────────────────────
const TEAM_COLORS = {
  NYY:'#003087', LAD:'#005A9C', BOS:'#BD3039', CHC:'#0E3386', SFG:'#FD5A1E',
  ATL:'#CE1141', HOU:'#EB6E1F', NYM:'#002D72', PHI:'#E81828', STL:'#C41E3A',
  MIL:'#FFC52F', MIN:'#002B5C', SEA:'#0C2C56', TOR:'#134A8E', BAL:'#DF4601',
  DET:'#0C2340', CLE:'#00385D', TEX:'#003278', OAK:'#003831', LAA:'#BA0021',
  CWS:'#27251F', KCR:'#004687', TBR:'#092C5C', MIA:'#00A3E0', COL:'#333366',
  ARI:'#A71930', WSN:'#AB0003', SDP:'#2F241D', PIT:'#FDB827', CIN:'#C6011F',
};
const teamColor = abbr => TEAM_COLORS[abbr] ?? '#1e2028';

// ── Skeleton loader ─────────────────────────────────────────────────────────
function SkeletonBoard() {
  return (
    <div style={{ background:'#0d1117', borderRadius:'12px', overflow:'hidden', border:'1px solid #1e2028' }}>
      <div style={{ height:'52px', background:'#0a0e14', padding:'0 1rem', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div className="skeleton" style={{ width:'120px', height:'14px', borderRadius:'4px' }} />
        <div className="skeleton" style={{ width:'40px', height:'22px', borderRadius:'6px' }} />
      </div>
      {[...Array(10)].map((_, i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:'.75rem', padding:'.5rem 1rem', borderTop:'1px solid #1e2028' }}>
          <div className="skeleton" style={{ width:'22px', height:'22px', borderRadius:'50%' }} />
          <div className="skeleton" style={{ width:'32px', height:'32px', borderRadius:'50%', flexShrink:0 }} />
          <div style={{ flex:1 }}>
            <div className="skeleton" style={{ width:'60%', height:'11px', borderRadius:'3px', marginBottom:'4px' }} />
            <div className="skeleton" style={{ width:'35%', height:'9px', borderRadius:'3px' }} />
          </div>
          <div className="skeleton" style={{ width:'48px', height:'16px', borderRadius:'4px' }} />
        </div>
      ))}
    </div>
  );
}

// ── Single leaderboard card ─────────────────────────────────────────────────
function LeaderBoard({ board, leaders, onPlayer }) {
  const isEmpty = !leaders || leaders.length === 0;
  const accentColor = board.savant ? '#a78bfa' : '#00c2a8';

  return (
    <div style={{ background:'#0d1117', borderRadius:'12px', overflow:'hidden', border:'1px solid #1e2028', display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <div style={{ background:'#080c12', padding:'.75rem 1rem', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid #1e2028' }}>
        <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.65rem', fontWeight:700, letterSpacing:'.14em', color:'#5c6070', textTransform:'uppercase' }}>
          {board.label}
        </span>
        <span style={{ fontFamily:"'Anton',sans-serif", fontSize:'.95rem', letterSpacing:'.06em', color: accentColor, background: accentColor + '18', padding:'.15rem .5rem', borderRadius:'6px' }}>
          {board.abbr}
        </span>
      </div>

      {/* Rows */}
      {isEmpty ? (
        <div style={{ padding:'2rem 1rem', textAlign:'center', color:'#3a3f52', fontSize:'.78rem', fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:'.08em' }}>
          {board.savant ? 'STATCAST DATA NOT AVAILABLE FOR THIS SEASON' : 'NO DATA AVAILABLE'}
        </div>
      ) : (
        leaders.map((p, i) => (
          <div key={i}
            onClick={() => p.playerId && onPlayer(p.playerId)}
            style={{ display:'flex', alignItems:'center', gap:'.6rem', padding:'.42rem .9rem', borderTop: i > 0 ? '1px solid #12161e' : 'none', cursor: p.playerId ? 'pointer' : 'default', transition:'background .15s' }}
            onMouseEnter={e => { if (p.playerId) e.currentTarget.style.background = '#13171f'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            {/* Rank */}
            <span style={{ fontFamily:"'Anton',sans-serif", fontSize:'.75rem', color: i === 0 ? accentColor : '#3a3f52', width:'18px', textAlign:'center', flexShrink:0 }}>
              {p.rank ?? i + 1}
            </span>

            {/* Headshot */}
            <div style={{ width:'32px', height:'32px', borderRadius:'50%', overflow:'hidden', flexShrink:0, background:'#1e2028', border: i === 0 ? `2px solid ${accentColor}` : '2px solid #1e2028' }}>
              {p.playerId ? (
                <img
                  src={`https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_32,q_auto:best/v1/people/${p.playerId}/headshot/67/current`}
                  width={32} height={32} alt={p.name}
                  style={{ objectFit:'cover', width:'100%', height:'100%' }}
                  onError={e => { e.target.style.opacity = 0; }}
                />
              ) : (
                <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.6rem', color:'#3a3f52' }}>?</div>
              )}
            </div>

            {/* Name + team */}
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontFamily:"'Inter',sans-serif", fontSize:'.78rem', fontWeight:600, color:'#e8ebf5', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                {p.name}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:'.3rem', marginTop:'1px' }}>
                {p.team && (
                  <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.6rem', fontWeight:700, letterSpacing:'.08em', color:'#fff', background: teamColor(p.team), padding:'0 .3rem', borderRadius:'3px' }}>
                    {p.team}
                  </span>
                )}
                {p.sub && (
                  <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.58rem', color:'#3a3f52', letterSpacing:'.05em' }}>{p.sub}</span>
                )}
              </div>
            </div>

            {/* Value */}
            <span style={{ fontFamily:"'Anton',sans-serif", fontSize: i === 0 ? '1rem' : '.85rem', color: i === 0 ? accentColor : '#c8cce0', flexShrink:0, minWidth:'44px', textAlign:'right' }}>
              {p.value}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function LeadersPage() {
  const router  = useRouter();
  const qSeason = parseInt(router.query.season ?? CUR_YEAR, 10);
  const [season,  setSeason]  = useState(qSeason || CUR_YEAR);
  const [tab,     setTab]     = useState('batting');
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback((yr) => {
    setLoading(true);
    setData(null);
    fetch(`/api/leaders?season=${yr}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(season); }, [season, load]);

  const changeSeason = (yr) => {
    setSeason(yr);
    router.push(`/leaders?season=${yr}`, undefined, { shallow: true });
  };

  const goPlayer = (id) => router.push(`/players/${id}`);

  const boards = tab === 'batting' ? BATTING_BOARDS : tab === 'pitching' ? PITCHING_BOARDS : STATCAST_BOARDS;

  return (
    <>
      <Head>
        <title>League Leaders {season} · COACH.</title>
        <meta name="description" content={`MLB batting, pitching and Statcast league leaders for ${season}`} />
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
        <div style={{ display:'flex', gap:'1.5rem', marginLeft:'auto', flexWrap:'wrap' }}>
          {NAV_LINKS.map(([href, label]) => (
            <a key={href} href={href}
              style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.82rem', fontWeight:700, letterSpacing:'.12em', textTransform:'uppercase', color: href === '/leaders' ? '#00c2a8' : '#5c6070', transition:'color .2s' }}
              onMouseEnter={e => e.target.style.color = '#f0f2f8'}
              onMouseLeave={e => e.target.style.color = href === '/leaders' ? '#00c2a8' : '#5c6070'}
            >{label}</a>
          ))}
        </div>
      </nav>

      {/* HERO */}
      <div style={{ background:'linear-gradient(180deg,#0a0e14 0%,#080c12 100%)', borderBottom:'1px solid #1e2028', padding:'2.5rem 1.5rem 2rem', textAlign:'center' }}>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.7rem', fontWeight:700, letterSpacing:'.22em', color:'#00c2a8', marginBottom:'.5rem' }}>MLB</div>
        <h1 style={{ fontFamily:"'Anton',sans-serif", fontSize:'clamp(2.4rem,6vw,4rem)', letterSpacing:'.04em', color:'#f0f2f8', lineHeight:1.05, marginBottom:'1.25rem' }}>
          LEAGUE LEADERS
        </h1>

        {/* Season selector */}
        <div style={{ display:'inline-flex', alignItems:'center', gap:'.75rem', background:'#0d1117', border:'1px solid #1e2028', borderRadius:'10px', padding:'.5rem 1rem' }}>
          <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.72rem', fontWeight:700, letterSpacing:'.12em', color:'#5c6070' }}>SEASON</span>
          <div style={{ position:'relative' }}>
            <select
              value={season}
              onChange={e => changeSeason(parseInt(e.target.value))}
              style={{ background:'transparent', border:'none', color:'#f0f2f8', fontFamily:"'Anton',sans-serif", fontSize:'1.1rem', letterSpacing:'.06em', cursor:'pointer', paddingRight:'1.25rem', outline:'none' }}
            >
              {SEASONS.map(yr => <option key={yr} value={yr} style={{ background:'#0d1117' }}>{yr}</option>)}
            </select>
            <span style={{ position:'absolute', right:0, top:'50%', transform:'translateY(-50%)', color:'#5c6070', fontSize:'.6rem', pointerEvents:'none' }}>▼</span>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div style={{ position:'sticky', top:'54px', zIndex:100, background:'rgba(8,12,21,.97)', backdropFilter:'blur(12px)', borderBottom:'1px solid #1e2028' }}>
        <div style={{ maxWidth:'1400px', margin:'0 auto', padding:'0 1.5rem', display:'flex', gap:0 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ fontFamily:"'Anton',sans-serif", fontSize:'.85rem', letterSpacing:'.1em', color: tab === t.key ? '#00c2a8' : '#3a3f52', background:'transparent', border:'none', borderBottom: tab === t.key ? '2px solid #00c2a8' : '2px solid transparent', padding:'.9rem 1.5rem', cursor:'pointer', transition:'all .2s' }}
            >{t.label}</button>
          ))}
          {data && !loading && (
            <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'.5rem' }}>
              {tab === 'statcast' && !data.savantAvailable && (
                <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.65rem', fontWeight:700, letterSpacing:'.1em', color:'#f5a623' }}>
                  ⚠ STATCAST AVAILABLE FROM 2015
                </span>
              )}
              {tab === 'statcast' && data.savantAvailable && (
                <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.65rem', fontWeight:700, letterSpacing:'.1em', color:'#a78bfa' }}>
                  ⚡ POWERED BY BASEBALL SAVANT
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ maxWidth:'1400px', margin:'0 auto', padding:'1.5rem' }}>

        {/* Savant notice for batting/pitching advanced stats */}
        {data && !data.savantAvailable && (tab === 'batting' || tab === 'pitching') && (
          <div style={{ background:'rgba(247,166,35,.07)', border:'1px solid rgba(247,166,35,.2)', borderRadius:'8px', padding:'.6rem 1rem', marginBottom:'1.25rem', fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.72rem', fontWeight:700, letterSpacing:'.1em', color:'#f5a623' }}>
            ⚠ wRC+, WAR, xERA and FIP require 2015+ (Statcast era). Standard stats shown for {season}.
          </div>
        )}

        {loading ? (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(290px,1fr))', gap:'1rem' }}>
            {[...Array(tab === 'statcast' ? 2 : tab === 'pitching' ? 10 : 8)].map((_, i) => <SkeletonBoard key={i} />)}
          </div>
        ) : !data ? (
          <div style={{ textAlign:'center', color:'#3a3f52', fontFamily:"'Barlow Condensed',sans-serif", fontSize:'1rem', letterSpacing:'.1em', padding:'4rem' }}>
            FAILED TO LOAD — CHECK CONNECTION
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(290px,1fr))', gap:'1rem' }}>
            {boards.map(board => (
              <LeaderBoard
                key={board.key}
                board={board}
                leaders={data[board.key] ?? []}
                onPlayer={goPlayer}
              />
            ))}
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div style={{ borderTop:'1px solid #1e2028', padding:'1.5rem', textAlign:'center', marginTop:'2rem' }}>
        <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.62rem', fontWeight:700, letterSpacing:'.14em', color:'#3a3f52' }}>
          STATS VIA MLB STATS API · ADVANCED METRICS VIA BASEBALL SAVANT · COACH. {CUR_YEAR}
        </span>
      </div>
    </>
  );
}
