// pages/index.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

function getCurrentSeason() {
  const now = new Date(), year = now.getFullYear();
  return now >= new Date(year, 2, 20) ? year : year - 1;
}

// ── Skeleton shimmer block ─────────────────────────────
function Sk({ w = '100%', h = 18, r = 6, mb = 0 }) {
  return (
    <div className="skeleton" style={{ width: w, height: h, borderRadius: r, marginBottom: mb, flexShrink: 0 }} />
  );
}

function LeadersSkeleton() {
  return (
    <div style={{ padding: '0 1rem' }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '.75rem', padding: '.75rem 0', borderBottom: '1px solid #1e2028' }}>
          <Sk w={22} h={22} r={4} />
          <Sk w={28} h={28} r={14} />
          <Sk w={`${80 + (i % 4) * 28}px`} h={13} />
          <div style={{ marginLeft: 'auto' }}><Sk w={42} h={16} /></div>
        </div>
      ))}
    </div>
  );
}

function NewsSkeleton() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={{ background: '#0d1117', border: '1px solid #1e2028', borderRadius: '10px', overflow: 'hidden', marginBottom: '.75rem' }}>
          <Sk w="100%" h={120} r={0} />
          <div style={{ padding: '.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '.45rem' }}>
            <Sk w={80} h={9} />
            <Sk w="92%" h={14} />
            <Sk w="68%" h={11} />
          </div>
        </div>
      ))}
    </>
  );
}

function FeaturedSkeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: '1rem' }}>
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} style={{ background: '#0d1117', border: '1px solid #1e2028', borderRadius: '10px', overflow: 'hidden' }}>
          <Sk w="100%" h={130} r={0} />
          <div style={{ padding: '.6rem .7rem .75rem', display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
            <Sk w="80%" h={12} />
            <Sk w="52%" h={10} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Featured player spotlight modal ───────────────────
function PlayerSpotlight({ player, onClose, onNavigate }) {
  const [data, setData]       = useState(null);
  const [savant, setSavant]   = useState(null);
  const [loading, setLoading] = useState(true);
  const SEASON = getCurrentSeason();

  useEffect(() => {
    if (!player) return;
    setLoading(true); setData(null); setSavant(null);
    Promise.all([
      fetch(`/api/player?id=${player.id}&season=${SEASON}`).then(r => r.json()).catch(() => null),
      fetch(`/api/savant?id=${player.id}`).then(r => r.json()).catch(() => null),
    ]).then(([pd, sv]) => { setData(pd); setSavant(sv); setLoading(false); });
  }, [player?.id]);

  if (!player) return null;

  const stat     = data?.season?.stat ?? {};
  const p        = data?.player ?? {};
  const isPit    = ['P','SP','RP'].includes(p.primaryPosition?.abbreviation);
  const teamName = p.currentTeam?.name ?? '';

  const statItems = isPit
    ? [['ERA', stat.era], ['WHIP', stat.whip], ['K/9', stat.strikeoutsPer9Inn], ['IP', stat.inningsPitched], ['W', stat.wins], ['K', stat.strikeOuts]]
    : [['AVG', stat.avg], ['OPS', stat.ops], ['HR', stat.homeRuns], ['RBI', stat.rbi], ['SB', stat.stolenBases], ['K%', stat.strikeOuts && stat.atBats ? ((parseInt(stat.strikeOuts)/Math.max(parseInt(stat.atBats),1))*100).toFixed(1)+'%' : '--']];

  const svItems = savant?.available ? (isPit
    ? [['xERA', savant.xera, savant.xera_pct], ['Whiff%', savant.whiff, savant.whiff_pct], ['Velo', savant.avg_fastball ? savant.avg_fastball+' mph' : null, savant.velo_pct]]
    : [['xwOBA', savant.xwoba, savant.xwoba_pct], ['Exit Velo', savant.exit_velocity ? savant.exit_velocity+' mph' : null, savant.ev_pct], ['Barrel%', savant.barrel, savant.barrel_pct]]
  ) : [];

  const pctCol = (pct) => !pct ? '#3a3f52' : pct >= 90 ? '#c8102e' : pct >= 67 ? '#f47c7c' : pct >= 34 ? '#9e9e9e' : pct >= 10 ? '#6baed6' : '#2171b5';

  return (
    <div style={{ position:'fixed', inset:0, zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}
      onClick={onClose}>
      <div style={{ position:'absolute', inset:0, background:'rgba(3,8,15,.9)', backdropFilter:'blur(10px)' }} />
      <div style={{ position:'relative', zIndex:1, width:'100%', maxWidth:'520px', background:'#0d1117', border:'1px solid #1e2028', borderRadius:'16px', overflow:'hidden', animation:'fadeIn .18s ease' }}
        onClick={e => e.stopPropagation()}>

        {/* Hero action photo */}
        <div style={{ position:'relative', height:'170px', overflow:'hidden', background:'#080c12' }}>
          <img
            src={`https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:action:landscape:current.jpg/ar_16:9,g_auto/q_auto:best/v1/people/${player.id}/action/landscape/current`}
            alt="" style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'top center' }}
            onError={e => e.target.style.display='none'} />
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(to bottom, rgba(3,8,15,.15) 0%, #0d1117 100%)' }} />
          <button onClick={onClose} style={{ position:'absolute', top:'.75rem', right:'.75rem', background:'rgba(3,8,15,.7)', border:'1px solid #1e2028', borderRadius:'50%', width:'28px', height:'28px', color:'#9e9e9e', cursor:'pointer', fontSize:'.85rem', display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}>✕</button>
        </div>

        {/* Identity row */}
        <div style={{ display:'flex', alignItems:'flex-end', gap:'1rem', padding:'0 1.25rem', marginTop:'-48px', position:'relative', zIndex:1 }}>
          <img
            src={`https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${player.id}/headshot/67/current`}
            alt={player.name}
            style={{ width:'76px', height:'76px', borderRadius:'12px', objectFit:'cover', border:'3px solid #0d1117', background:'#1e2028', flexShrink:0 }} />
          <div style={{ paddingBottom:'.5rem', flex:1, minWidth:0 }}>
            <div style={{ fontFamily:"'Anton',sans-serif", fontSize:'1.5rem', color:'#f0f2f8', lineHeight:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{player.name}</div>
            <div style={{ fontSize:'.73rem', color:'#5c6070', marginTop:'.2rem' }}>{player.pos}{teamName ? ` · ${teamName}` : ''}</div>
          </div>
          {savant?.season && (
            <div style={{ paddingBottom:'.6rem', flexShrink:0, textAlign:'right' }}>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.58rem', fontWeight:700, letterSpacing:'.15em', color:'#3a3f52' }}>SEASON</div>
              <div style={{ fontFamily:"'Anton',sans-serif", fontSize:'1.1rem', color:'#00c2a8' }}>{savant.season}</div>
            </div>
          )}
        </div>

        <div style={{ padding:'1rem 1.25rem 1.25rem' }}>
          {loading ? (
            <div style={{ display:'flex', flexDirection:'column', gap:'.65rem' }}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:'.35rem' }}>
                {Array.from({length:6}).map((_,i) => <Sk key={i} h={54} r={8} />)}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'.5rem' }}>
                {Array.from({length:3}).map((_,i) => <Sk key={i} h={58} r={8} />)}
              </div>
              <Sk h={44} r={10} />
            </div>
          ) : (
            <>
              {/* Season stats */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:'.35rem', marginBottom:'1rem' }}>
                {statItems.map(([label, val]) => (
                  <div key={label} style={{ background:'#080c12', borderRadius:'8px', padding:'.5rem .3rem', textAlign:'center' }}>
                    <div style={{ fontFamily:"'Anton',sans-serif", fontSize:'1.05rem', color:'#f0f2f8', lineHeight:1 }}>{val ?? '—'}</div>
                    <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.56rem', fontWeight:700, letterSpacing:'.1em', color:'#3a3f52', marginTop:'.2rem' }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Savant percentiles */}
              {svItems.length > 0 && (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'.5rem', marginBottom:'1rem' }}>
                  {svItems.map(([label, val, pct]) => {
                    const pn  = typeof pct === 'number' ? Math.round(pct) : null;
                    const col = pctCol(pn);
                    return (
                      <div key={label} style={{ background:'#080c12', border:`1px solid ${col}33`, borderRadius:'8px', padding:'.6rem .7rem', display:'flex', alignItems:'center', gap:'.5rem' }}>
                        {pn !== null && (
                          <div style={{ width:'28px', height:'28px', borderRadius:'50%', background:col, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                            <span style={{ fontFamily:"'Anton',sans-serif", fontSize:'.72rem', color:'#fff', lineHeight:1 }}>{pn}</span>
                          </div>
                        )}
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.65rem', fontWeight:700, letterSpacing:'.1em', color:'#5c6070' }}>{label}</div>
                          <div style={{ fontSize:'.8rem', fontWeight:600, color:'#f0f2f8', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{val ?? '—'}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Quick bio */}
              {p.birthDate && (
                <div style={{ display:'flex', gap:'.85rem', flexWrap:'wrap', marginBottom:'.9rem', fontSize:'.73rem', color:'#5c6070' }}>
                  <span>🎂 {new Date(p.birthDate).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>
                  {p.height && <span>📏 {p.height}</span>}
                  {p.weight && <span>⚖️ {p.weight} lbs</span>}
                  {p.batSide?.description && <span>🏏 Bats {p.batSide.description}</span>}
                  {p.pitchHand?.description && <span>🤚 Throws {p.pitchHand.description}</span>}
                </div>
              )}

              {/* CTA button */}
              <button
                onClick={() => onNavigate(player.id)}
                style={{ width:'100%', padding:'.85rem', background:'linear-gradient(135deg,#00c2a8 0%,#0077cc 100%)', border:'none', borderRadius:'10px', fontFamily:"'Anton',sans-serif", fontSize:'1rem', letterSpacing:'.1em', color:'#fff', cursor:'pointer' }}>
                FULL PLAYER PROFILE →
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────
export default function Home() {
  const [query, setQuery]           = useState('');
  const [results, setResults]       = useState([]);
  const [searching, setSearching]   = useState(false);
  const [leaders, setLeaders]       = useState({});
  const [news, setNews]             = useState([]);
  const [loadingLeaders, setLL]     = useState(true);
  const [loadingNews, setLN]        = useState(true);
  const [activeLeader, setActive]   = useState('battingAverage');
  const [spotlight, setSpotlight]   = useState(null);
  const [hotCold, setHotCold]       = useState(null);
  const [loadingHC, setLoadingHC]   = useState(true);
  const router  = useRouter();
  const SEASON  = getCurrentSeason();

  useEffect(() => {
    fetch(`/api/leaders?season=${SEASON}`).then(r=>r.json()).then(d=>{setLeaders(d);setLL(false);}).catch(()=>setLL(false));
  }, []);

  useEffect(() => {
    fetch('/api/news').then(r=>r.json()).then(d=>{setNews(d.articles??[]);setLN(false);}).catch(()=>setLN(false));
  }, []);

  useEffect(() => {
    fetch('/api/hot-cold').then(r=>r.json()).then(d=>{ setHotCold(d); setLoadingHC(false); }).catch(()=>setLoadingHC(false));
  }, []);

  let st;
  async function handleSearch(e) {
    const val = e.target.value; setQuery(val);
    if (val.length < 2) { setResults([]); return; }
    setSearching(true); clearTimeout(st);
    st = setTimeout(async () => {
      try { const d = await fetch(`/api/search?q=${encodeURIComponent(val)}`).then(r=>r.json()); setResults(d.players??[]); }
      catch { setResults([]); }
      setSearching(false);
    }, 320);
  }

  const CATS = [
    { id:'battingAverage',    label:'AVG'      },
    { id:'homeRuns',          label:'HR'       },
    { id:'rbi',               label:'RBI'      },
    { id:'onBasePlusSlugging',label:'OPS'      },
    { id:'stolenBases',       label:'SB'       },
    { id:'earnedRunAverage',  label:'ERA'      },
    { id:'strikeouts',        label:'SO'       },
    { id:'wins',              label:'Wins'     },
  ];

  return (
    <>
      <Head>
        <title>Coach — Baseball Stats, Predictions & News</title>
        <style>{`
          .ql-card:hover{border-color:#00c2a8!important;transform:translateY(-3px);box-shadow:0 10px 28px rgba(0,194,168,.14);transition:all .2s}
          .leader-row:hover{background:rgba(0,194,168,.04)!important}
          .news-card:hover{border-color:#00c2a8!important;transform:translateY(-2px);transition:all .2s}
          .cat-btn:hover{color:#f0f2f8!important}
          input:focus{border-color:#00c2a8!important;outline:none}
          @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
          @keyframes shimmer{0%{background-position:-600px 0}100%{background-position:600px 0}}
          .skeleton{background:linear-gradient(90deg,#0d1117 25%,#1a1f2e 50%,#0d1117 75%);background-size:600px 100%;animation:shimmer 1.4s infinite linear}
        `}</style>
      </Head>

      {spotlight && (
        <PlayerSpotlight player={spotlight} onClose={()=>setSpotlight(null)}
          onNavigate={id=>{setSpotlight(null);router.push(`/players/${id}`);}} />
      )}

      {/* NAV */}
      <nav style={s.nav}>
        <a href="/" style={s.logo}>COACH<span style={{color:'#00c2a8'}}>.</span></a>
        <div style={s.navLinks}>
          {[['/', 'Home'],['/scoreboard','Scoreboard'],['/teams','Teams'],['/transactions','Transactions'],
            ['/compare','Compare'],['/trade','Trade AI'],['/odds-board','Odds Board'],[`/leaders?season=${SEASON}`,'Leaders']
          ].map(([href,label])=>(
            <a key={href} href={href} style={s.navLink}>{label}</a>
          ))}
        </div>
      </nav>

      {/* HERO */}
      <div style={s.hero}>
        <div style={s.heroBg} />
        <div style={s.heroContent}>
          <div style={s.siteTitle}>COACH<span style={{color:'#00c2a8'}}>.</span></div>
          <div style={s.tagline}>DIG DEEP</div>
          <div style={s.heroSub}>MLB Stats · Statcast · Live Scores · Daily Predictions</div>
          <div style={s.searchWrap}>
            <span style={s.searchIcon}>⌕</span>
            <input style={s.searchInput} type="text" placeholder="Search any MLB player — past or present…"
              value={query} onChange={handleSearch} autoComplete="off" />
            {results.length > 0 && (
              <div style={s.searchDrop}>
                {results.map(p=>(
                  <div key={p.id} style={s.searchItem}
                    onClick={()=>router.push(`/players/${p.id}`)}
                    onMouseEnter={e=>e.currentTarget.style.background='#1e2028'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <img src={`https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_60,q_auto:best/v1/people/${p.id}/headshot/67/current`}
                      alt="" style={s.searchAvatar} />
                    <div>
                      <div style={s.searchName}>{p.fullName}</div>
                      <div style={s.searchTeam}>{p.currentTeam?.name??p.primaryPosition?.name??''}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {searching && <div style={s.hint}>Searching…</div>}
            {!searching && query.length>1 && results.length===0 && <div style={s.hint}>No players found</div>}
          </div>
        </div>
      </div>

      {/* FEATURED */}
      <div style={s.section}>
        <div style={s.sectionInner}>
          <div style={s.secLabel}>
            ⚾ FEATURED PLAYERS
            <span style={{color:'#3a3f52',fontSize:'.6rem',letterSpacing:'.1em',marginLeft:'.75rem',fontWeight:400}}>— CLICK FOR SPOTLIGHT</span>
          </div>
          {loadingLeaders ? <FeaturedSkeleton /> : (
            <div style={s.qlGrid}>
              {FEATURED.map(p=>(
                <div key={p.id} className="ql-card" style={s.qlCard} onClick={()=>setSpotlight(p)}>
                  <div style={{position:'relative',overflow:'hidden'}}>
                    <img
                      src={`https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${p.id}/headshot/67/current`}
                      alt={p.name} style={s.qlPhoto} />
                    <div style={{position:'absolute',bottom:'.4rem',right:'.4rem',background:'#00c2a8',borderRadius:'4px',padding:'.1rem .32rem',fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.56rem',fontWeight:700,letterSpacing:'.08em',color:'#03080f'}}>
                      VIEW
                    </div>
                  </div>
                  <div style={{padding:'.55rem .7rem .7rem'}}>
                    <div style={s.qlName}>{p.name}</div>
                    <div style={s.qlPos}>{p.pos}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* HOT / COLD — last 10 games */}
      <div style={s.section}>
        <div style={s.sectionInner}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem' }}>

            {/* WHO'S HOT */}
            <div>
              <div style={{ ...s.secLabel, color:'#ff6a00', borderBottomColor:'#ff6a0033' }}>
                🔥 WHO'S HOT <span style={{ color:'#3a3f52', fontSize:'.6rem', letterSpacing:'.1em', fontWeight:400, marginLeft:'.5rem' }}>LAST 10 GAMES</span>
              </div>
              {loadingHC ? (
                <div style={{ display:'flex', flexDirection:'column', gap:'.5rem' }}>
                  {Array.from({length:5}).map((_,i)=>(
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:'.75rem', padding:'.6rem', background:'#0d1117', borderRadius:'8px', border:'1px solid #1e2028' }}>
                      <div className="skeleton" style={{ width:'34px', height:'34px', borderRadius:'50%' }} />
                      <div style={{ flex:1, display:'flex', flexDirection:'column', gap:'.3rem' }}>
                        <div className="skeleton" style={{ width:'120px', height:'12px', borderRadius:'3px' }} />
                        <div className="skeleton" style={{ width:'80px', height:'10px', borderRadius:'3px' }} />
                      </div>
                      <div className="skeleton" style={{ width:'60px', height:'16px', borderRadius:'4px' }} />
                    </div>
                  ))}
                </div>
              ) : hotCold?.offseason ? (
                <div style={{ padding:'1.5rem', background:'#0d1117', border:'1px solid #1e2028', borderRadius:'10px', textAlign:'center' }}>
                  <div style={{ fontSize:'1.5rem', marginBottom:'.5rem' }}>⚾</div>
                  <div style={{ fontFamily:"'Anton',sans-serif", fontSize:'.95rem', color:'#f0f2f8', marginBottom:'.3rem' }}>SEASON PREVIEW</div>
                  <div style={{ fontSize:'.78rem', color:'#5c6070' }}>Live hot/cold tracking begins opening day</div>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'.4rem' }}>
                  {(hotCold?.hot ?? []).map((p, i) => (
                    <div key={p.id} onClick={()=>router.push(`/players/${p.id}`)}
                      style={{ display:'flex', alignItems:'center', gap:'.75rem', padding:'.65rem .85rem', background:'#0d1117', borderRadius:'10px', border:'1px solid rgba(255,106,0,.15)', cursor:'pointer', transition:'all .15s' }}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor='#ff6a00';e.currentTarget.style.background='rgba(255,106,0,.06)'}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(255,106,0,.15)';e.currentTarget.style.background='#0d1117'}}>
                      <div style={{ fontFamily:"'Anton',sans-serif", fontSize:'.85rem', color:'#ff6a00', width:'18px', textAlign:'center', flexShrink:0 }}>{i+1}</div>
                      <img src={`https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_60,q_auto:best/v1/people/${p.id}/headshot/67/current`}
                        alt="" style={{ width:'34px', height:'34px', borderRadius:'50%', objectFit:'cover', background:'#1e2028', flexShrink:0 }} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontFamily:"'Inter',sans-serif", fontWeight:700, fontSize:'.85rem', color:'#f0f2f8', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.name}</div>
                        <div style={{ fontSize:'.68rem', color:'#5c6070' }}>{p.pos} · {p.team}</div>
                      </div>
                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        <div style={{ fontFamily:"'Anton',sans-serif", fontSize:'.9rem', color:'#ff6a00' }}>{p.type==='pitcher' ? p.era+' ERA' : p.avg}</div>
                        <div style={{ fontSize:'.62rem', color:'#5c6070', marginTop:'.1rem' }}>{p.type==='pitcher' ? `${p.k} K` : `${p.hr} HR · ${p.rbi} RBI`}</div>
                      </div>
                      <span style={{ fontSize:'1rem', flexShrink:0 }}>🔥</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* WHO'S NOT */}
            <div>
              <div style={{ ...s.secLabel, color:'#6baed6', borderBottomColor:'#6baed633' }}>
                🧊 WHO'S NOT <span style={{ color:'#3a3f52', fontSize:'.6rem', letterSpacing:'.1em', fontWeight:400, marginLeft:'.5rem' }}>LAST 10 GAMES</span>
              </div>
              {loadingHC ? (
                <div style={{ display:'flex', flexDirection:'column', gap:'.5rem' }}>
                  {Array.from({length:5}).map((_,i)=>(
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:'.75rem', padding:'.6rem', background:'#0d1117', borderRadius:'8px', border:'1px solid #1e2028' }}>
                      <div className="skeleton" style={{ width:'34px', height:'34px', borderRadius:'50%' }} />
                      <div style={{ flex:1, display:'flex', flexDirection:'column', gap:'.3rem' }}>
                        <div className="skeleton" style={{ width:'120px', height:'12px', borderRadius:'3px' }} />
                        <div className="skeleton" style={{ width:'80px', height:'10px', borderRadius:'3px' }} />
                      </div>
                      <div className="skeleton" style={{ width:'60px', height:'16px', borderRadius:'4px' }} />
                    </div>
                  ))}
                </div>
              ) : hotCold?.offseason ? (
                <div style={{ padding:'1.5rem', background:'#0d1117', border:'1px solid #1e2028', borderRadius:'10px', textAlign:'center' }}>
                  <div style={{ fontSize:'1.5rem', marginBottom:'.5rem' }}>📅</div>
                  <div style={{ fontFamily:"'Anton',sans-serif", fontSize:'.95rem', color:'#f0f2f8', marginBottom:'.3rem' }}>CHECK BACK SOON</div>
                  <div style={{ fontSize:'.78rem', color:'#5c6070' }}>Cold tracking begins when the season starts</div>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'.4rem' }}>
                  {(hotCold?.cold ?? []).map((p, i) => (
                    <div key={p.id} onClick={()=>router.push(`/players/${p.id}`)}
                      style={{ display:'flex', alignItems:'center', gap:'.75rem', padding:'.65rem .85rem', background:'#0d1117', borderRadius:'10px', border:'1px solid rgba(107,174,214,.12)', cursor:'pointer', transition:'all .15s' }}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor='#6baed6';e.currentTarget.style.background='rgba(107,174,214,.05)'}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(107,174,214,.12)';e.currentTarget.style.background='#0d1117'}}>
                      <div style={{ fontFamily:"'Anton',sans-serif", fontSize:'.85rem', color:'#6baed6', width:'18px', textAlign:'center', flexShrink:0 }}>{i+1}</div>
                      <img src={`https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_60,q_auto:best/v1/people/${p.id}/headshot/67/current`}
                        alt="" style={{ width:'34px', height:'34px', borderRadius:'50%', objectFit:'cover', background:'#1e2028', flexShrink:0 }} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontFamily:"'Inter',sans-serif", fontWeight:700, fontSize:'.85rem', color:'#f0f2f8', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.name}</div>
                        <div style={{ fontSize:'.68rem', color:'#5c6070' }}>{p.pos} · {p.team}</div>
                      </div>
                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        <div style={{ fontFamily:"'Anton',sans-serif", fontSize:'.9rem', color:'#6baed6' }}>{p.type==='pitcher' ? p.era+' ERA' : p.avg}</div>
                        <div style={{ fontSize:'.62rem', color:'#5c6070', marginTop:'.1rem' }}>{p.type==='pitcher' ? `${p.k} K` : `${p.hr} HR · ${p.rbi} RBI`}</div>
                      </div>
                      <span style={{ fontSize:'1rem', flexShrink:0 }}>🧊</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>


      <div style={s.section}>
        <div style={{...s.sectionInner,display:'grid',gridTemplateColumns:'1fr 380px',gap:'2rem',alignItems:'start'}}>

          <div>
            <div style={s.secLabel}>🏆 LEAGUE LEADERS</div>
            <div style={s.catTabs}>
              {CATS.map(c=>(
                <button key={c.id} className="cat-btn"
                  style={{...s.catBtn,...(activeLeader===c.id?s.catBtnActive:{})}}
                  onClick={()=>setActive(c.id)}>{c.label}</button>
              ))}
            </div>
            <div style={s.leadersCard}>
              {loadingLeaders ? <LeadersSkeleton /> : (
                <table>
                  <thead>
                    <tr style={{borderBottom:'1px solid #1e2028'}}>
                      <th style={{...s.lth,textAlign:'left',width:'36px'}}>#</th>
                      <th style={{...s.lth,textAlign:'left'}}>Player</th>
                      <th style={{...s.lth,textAlign:'left'}}>Team</th>
                      <th style={{...s.lth,textAlign:'right',color:'#00c2a8'}}>{CATS.find(c=>c.id===activeLeader)?.label}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(leaders[activeLeader]??[]).slice(0,10).map((row,i)=>(
                      <tr key={i} className="leader-row"
                        style={{borderBottom:'1px solid rgba(30,32,40,.7)',cursor:'pointer'}}
                        onClick={()=>router.push(`/players/${row.person?.id}`)}>
                        <td style={s.ltd}>
                          <span style={{...s.rank,background:i===0?'#f5a623':i===1?'#C4CED4':i===2?'#CD7F32':'#1e2028',color:i<3?'#050608':'#5c6070'}}>{i+1}</span>
                        </td>
                        <td style={{...s.ltd,textAlign:'left'}}>
                          <div style={{display:'flex',alignItems:'center',gap:'.6rem'}}>
                            <img src={`https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_60,q_auto:best/v1/people/${row.person?.id}/headshot/67/current`}
                              alt="" style={s.leaderAvatar} />
                            <span style={{color:'#f0f2f8',fontWeight:600}}>{row.person?.fullName??'—'}</span>
                          </div>
                        </td>
                        <td style={{...s.ltd,textAlign:'left',color:'#5c6070',fontSize:'.8rem'}}>{row.team?.name??'—'}</td>
                        <td style={{...s.ltd,textAlign:'right',color:'#00c2a8',fontFamily:"'Barlow Condensed',sans-serif",fontSize:'1.1rem',fontWeight:700}}>{row.value??'—'}</td>
                      </tr>
                    ))}
                    {(leaders[activeLeader]??[]).length===0 && (
                      <tr><td colSpan={4} style={{textAlign:'center',color:'#5c6070',padding:'2rem',fontSize:'.85rem'}}>No data available yet for {SEASON}</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div>
            <div style={s.secLabel}>📰 MLB NEWS</div>
            <div style={s.newsCol}>
              {loadingNews ? <NewsSkeleton /> : news.length===0 ? (
                <div style={s.loadingText}>Check back soon — latest MLB headlines will appear here.</div>
              ) : (
                news.slice(0,8).map((article,i)=>(
                  <a key={i} href={article.url} target="_blank" rel="noopener" className="news-card" style={s.newsCard}>
                    {article.urlToImage && <img src={article.urlToImage} alt="" style={s.newsImg} onError={e=>{e.target.style.display='none'}} />}
                    <div style={s.newsBody}>
                      <div style={s.newsSource}>{article.source?.name??'MLB News'}</div>
                      <div style={s.newsTitle}>{article.title}</div>
                      <div style={s.newsDesc}>{article.description?.slice(0,100)}{article.description?.length>100?'…':''}</div>
                      <div style={s.newsDate}>{article.publishedAt?new Date(article.publishedAt).toLocaleDateString('en-US',{month:'short',day:'numeric'}):''}</div>
                    </div>
                  </a>
                ))
              )}
              <a href="https://www.mlb.com/news" target="_blank" rel="noopener" style={s.moreNews}>View all MLB news →</a>
            </div>
          </div>

        </div>
      </div>

      <footer style={s.footer}>
        Data via <a href="https://statsapi.mlb.com" target="_blank" rel="noopener" style={{color:'#5c6070'}}>MLB Stats API</a> ·
        <a href="https://baseballsavant.mlb.com" target="_blank" rel="noopener" style={{color:'#5c6070'}}> Baseball Savant</a> · Coach.com
      </footer>
    </>
  );
}

const FEATURED = [
  // Row 1 — the immortals
  { id:592450,  name:'Aaron Judge',       pos:'OF · Yankees'    },
  { id:660271,  name:'Shohei Ohtani',     pos:'DH/P · Dodgers'  },
  { id:545361,  name:'Mike Trout',        pos:'OF · Angels'     },
  { id:605141,  name:'Mookie Betts',      pos:'OF · Dodgers'    },
  { id:518692,  name:'Freddie Freeman',   pos:'1B · Dodgers'    },
  { id:660670,  name:'Ronald Acuña Jr.',  pos:'OF · Braves'     },
  { id:547180,  name:'Bryce Harper',      pos:'1B · Phillies'   },
  { id:665742,  name:'Juan Soto',         pos:'OF · Mets'       },
  // Row 2 — All-Stars
  { id:607208,  name:'Trea Turner',       pos:'SS · Phillies'   },
  { id:624413,  name:'Pete Alonso',       pos:'1B · Mets'       },
  { id:683002,  name:'Gunnar Henderson',  pos:'SS · Orioles'    },
  { id:677951,  name:'Bobby Witt Jr.',    pos:'SS · Royals'     },
  { id:670541,  name:'Yordan Alvarez',    pos:'DH · Astros'     },
  { id:677594,  name:'Julio Rodriguez',   pos:'OF · Mariners'   },
  { id:682998,  name:'Corbin Carroll',    pos:'OF · D-backs'    },
  { id:608070,  name:'José Ramírez',      pos:'3B · Guardians'  },
  // Row 3 — Elite arms + rising stars
  { id:694973,  name:'Paul Skenes',       pos:'SP · Pirates'    },
  { id:675911,  name:'Spencer Strider',   pos:'SP · Braves'     },
  { id:543037,  name:'Gerrit Cole',       pos:'SP · Yankees'    },
  { id:554430,  name:'Zack Wheeler',      pos:'SP · Phillies'   },
  { id:694192,  name:'Jackson Chourio',   pos:'OF · Brewers'    },
  { id:702616,  name:'Jackson Holliday',  pos:'SS · Orioles'    },
  { id:691406,  name:'Junior Caminero',   pos:'3B · Rays'       },
  { id:694671,  name:'Wyatt Langford',    pos:'OF · Rangers'    },
];

const s = {
  nav:          {position:'sticky',top:0,zIndex:200,background:'rgba(3,8,15,.96)',backdropFilter:'blur(16px)',borderBottom:'1px solid #1e2028',height:'54px',display:'flex',alignItems:'center',padding:'0 1.5rem',gap:'1rem'},
  logo:         {fontFamily:"'Anton',sans-serif",fontSize:'1.5rem',letterSpacing:'.08em',color:'#f0f2f8',textDecoration:'none',flexShrink:0},
  navLinks:     {display:'flex',gap:'1.5rem',marginLeft:'auto'},
  navLink:      {fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.82rem',fontWeight:700,letterSpacing:'.12em',textTransform:'uppercase',color:'#5c6070',textDecoration:'none'},
  hero:         {position:'relative',padding:'5rem 1.5rem 3.5rem',textAlign:'center',overflow:'hidden',background:'linear-gradient(160deg,#03080f 0%,#061223 40%,#040d18 70%,#050608 100%)'},
  heroBg:       {position:'absolute',inset:0,backgroundImage:'radial-gradient(ellipse at 50% -10%,rgba(0,194,168,.18) 0%,transparent 55%),radial-gradient(ellipse at 20% 100%,rgba(0,80,200,.10) 0%,transparent 50%),radial-gradient(ellipse at 80% 80%,rgba(245,166,35,.06) 0%,transparent 40%)',pointerEvents:'none'},
  heroContent:  {position:'relative',zIndex:1},
  siteTitle:    {fontFamily:"'Anton',sans-serif",fontSize:'clamp(5rem,14vw,10rem)',letterSpacing:'.04em',color:'#f0f2f8',lineHeight:.9,textShadow:'0 0 80px rgba(0,194,168,.25)'},
  tagline:      {fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.95rem',fontWeight:700,letterSpacing:'.55em',color:'#00c2a8',marginTop:'.75rem',textTransform:'uppercase'},
  heroSub:      {fontSize:'.88rem',color:'#5c6070',marginTop:'.5rem',marginBottom:'2.5rem',letterSpacing:'.04em'},
  searchWrap:   {position:'relative',width:'100%',maxWidth:'580px',margin:'0 auto'},
  searchIcon:   {position:'absolute',left:'1rem',top:'50%',transform:'translateY(-50%)',color:'#5c6070',fontSize:'1.1rem',pointerEvents:'none',zIndex:1},
  searchInput:  {width:'100%',padding:'.9rem 1.25rem .9rem 2.8rem',background:'rgba(255,255,255,.05)',border:'1px solid #1e2028',borderRadius:'10px',color:'#f0f2f8',fontFamily:"'Inter',sans-serif",fontSize:'1rem',outline:'none',transition:'border-color .2s'},
  searchDrop:   {position:'absolute',top:'calc(100% + 6px)',left:0,right:0,background:'#111318',border:'1px solid #1e2028',borderRadius:'10px',zIndex:100,maxHeight:'320px',overflowY:'auto',textAlign:'left',boxShadow:'0 8px 32px rgba(0,0,0,.5)'},
  searchItem:   {display:'flex',alignItems:'center',gap:'.75rem',padding:'.65rem 1rem',cursor:'pointer',transition:'background .15s'},
  searchAvatar: {width:'36px',height:'36px',borderRadius:'50%',objectFit:'cover',background:'#1e2028',flexShrink:0},
  searchName:   {fontWeight:600,fontSize:'.9rem',color:'#f0f2f8'},
  searchTeam:   {fontSize:'.75rem',color:'#5c6070'},
  hint:         {marginTop:'.75rem',fontSize:'.82rem',color:'#5c6070'},
  section:      {padding:'0 1.5rem 3rem'},
  sectionInner: {maxWidth:'1200px',margin:'0 auto'},
  secLabel:     {fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.72rem',fontWeight:700,letterSpacing:'.22em',color:'#00c2a8',marginBottom:'1.25rem',paddingBottom:'.5rem',borderBottom:'1px solid #1e2028',display:'flex',alignItems:'center'},
  qlGrid:       {display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',gap:'1rem'},
  qlCard:       {background:'#0d1117',border:'1px solid #1e2028',borderRadius:'10px',overflow:'hidden',cursor:'pointer',transition:'all .2s'},
  qlPhoto:      {width:'100%',aspectRatio:'1',objectFit:'cover',objectPosition:'top',display:'block',background:'#1e2028'},
  qlName:       {fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:'.82rem',color:'#f0f2f8'},
  qlPos:        {fontSize:'.68rem',color:'#5c6070',marginTop:'.15rem'},
  catTabs:      {display:'flex',flexWrap:'wrap',gap:'.4rem',marginBottom:'1rem'},
  catBtn:       {padding:'.35rem .85rem',background:'#0d1117',border:'1px solid #1e2028',borderRadius:'6px',fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.75rem',fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:'#5c6070',cursor:'pointer',transition:'all .2s'},
  catBtnActive: {background:'rgba(0,194,168,.12)',borderColor:'#00c2a8',color:'#00c2a8'},
  leadersCard:  {background:'#0d1117',border:'1px solid #1e2028',borderRadius:'10px',overflow:'hidden'},
  lth:          {padding:'.65rem 1rem',fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.68rem',fontWeight:700,letterSpacing:'.13em',textTransform:'uppercase',color:'#5c6070',whiteSpace:'nowrap'},
  ltd:          {padding:'.65rem 1rem',color:'#b8bdd0',fontSize:'.86rem',whiteSpace:'nowrap'},
  rank:         {display:'inline-flex',alignItems:'center',justifyContent:'center',width:'22px',height:'22px',borderRadius:'4px',fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.78rem',fontWeight:700},
  leaderAvatar: {width:'28px',height:'28px',borderRadius:'50%',objectFit:'cover',background:'#1e2028',flexShrink:0},
  newsCol:      {display:'flex',flexDirection:'column',gap:'.75rem'},
  newsCard:     {display:'flex',flexDirection:'column',background:'#0d1117',border:'1px solid #1e2028',borderRadius:'10px',overflow:'hidden',textDecoration:'none',color:'#b8bdd0',transition:'all .2s'},
  newsImg:      {width:'100%',height:'140px',objectFit:'cover',display:'block',background:'#1e2028'},
  newsBody:     {padding:'.85rem 1rem'},
  newsSource:   {fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.62rem',fontWeight:700,letterSpacing:'.15em',textTransform:'uppercase',color:'#00c2a8',marginBottom:'.3rem'},
  newsTitle:    {fontWeight:600,fontSize:'.86rem',color:'#f0f2f8',lineHeight:1.4,marginBottom:'.3rem'},
  newsDesc:     {fontSize:'.75rem',color:'#5c6070',lineHeight:1.5},
  newsDate:     {fontSize:'.68rem',color:'#3a3f52',marginTop:'.4rem'},
  moreNews:     {display:'block',textAlign:'center',padding:'.75rem',background:'#0d1117',border:'1px solid #1e2028',borderRadius:'10px',textDecoration:'none',fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.78rem',fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:'#5c6070'},
  loadingText:  {padding:'2rem',textAlign:'center',color:'#5c6070',fontSize:'.85rem'},
  footer:       {borderTop:'1px solid #1e2028',padding:'1.4rem',textAlign:'center',fontSize:'.74rem',color:'#5c6070'},
};