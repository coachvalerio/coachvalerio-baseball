// pages/matchup.js
// #9 Batter vs Pitcher matchup tool — career BvP + arsenal context
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

function PlayerSearch({ label, accent, onPick, picked }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  let timer;

  const search = (val) => {
    setQ(val);
    if (val.length < 2) { setResults([]); return; }
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        const d = await fetch(`/api/search?q=${encodeURIComponent(val)}`).then(r=>r.json());
        setResults(d.players ?? []);
      } catch { setResults([]); }
    }, 300);
  };

  if (picked) {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:'.75rem', background:'#0d1117', border:`1px solid ${accent}55`, borderRadius:'12px', padding:'.75rem 1rem' }}>
        <img src={`https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_80,q_auto:best/v1/people/${picked.id}/headshot/67/current`}
          width={44} height={44} style={{ borderRadius:'50%', objectFit:'cover' }} />
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:"'Inter',sans-serif", fontWeight:600, color:'#f0f2f8', fontSize:'.9rem' }}>{picked.name}</div>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.65rem', color:'#5c6070', letterSpacing:'.08em' }}>{label}</div>
        </div>
        <button onClick={() => onPick(null)}
          style={{ background:'transparent', border:'1px solid #3a3f52', borderRadius:'6px', color:'#5c6070', padding:'.3rem .6rem', cursor:'pointer', fontSize:'.7rem' }}>
          CHANGE
        </button>
      </div>
    );
  }

  return (
    <div style={{ position:'relative' }}>
      <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.65rem', fontWeight:700, letterSpacing:'.14em', color:accent, marginBottom:'.4rem' }}>{label}</div>
      <input value={q} onChange={e=>search(e.target.value)} placeholder="Search player…"
        style={{ width:'100%', background:'#0d1117', border:'1px solid #1e2028', borderRadius:'10px', color:'#f0f2f8', padding:'.7rem 1rem', fontFamily:"'Inter',sans-serif", fontSize:'.9rem', outline:'none' }} />
      {results.length > 0 && (
        <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:20, background:'#0d1117', border:'1px solid #1e2028', borderRadius:'10px', marginTop:'.25rem', maxHeight:'260px', overflowY:'auto' }}>
          {results.slice(0,8).map(p => (
            <div key={p.id} onClick={() => { onPick({ id:p.id, name:p.fullName ?? p.name }); setQ(''); setResults([]); }}
              style={{ display:'flex', alignItems:'center', gap:'.6rem', padding:'.5rem .8rem', cursor:'pointer', borderBottom:'1px solid #12161e' }}
              onMouseEnter={e=>e.currentTarget.style.background='#13171f'}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              <img src={`https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_60,q_auto:best/v1/people/${p.id}/headshot/67/current`}
                width={32} height={32} style={{ borderRadius:'50%', objectFit:'cover' }} />
              <div>
                <div style={{ fontFamily:"'Inter',sans-serif", fontSize:'.8rem', fontWeight:600, color:'#e8ebf5' }}>{p.fullName ?? p.name}</div>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.6rem', color:'#5c6070' }}>{p.team ?? p.currentTeam?.name ?? ''} · {p.position ?? p.primaryPosition?.abbreviation ?? ''}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, accent }) {
  return (
    <div style={{ background:'#080c12', borderRadius:'8px', padding:'.7rem', textAlign:'center', borderTop:`2px solid ${accent ?? '#1e2028'}` }}>
      <div style={{ fontFamily:"'Anton',sans-serif", fontSize:'1.3rem', color:'#f0f2f8' }}>{value ?? '—'}</div>
      <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.6rem', fontWeight:700, letterSpacing:'.1em', color:'#5c6070', marginTop:'2px' }}>{label}</div>
    </div>
  );
}

export default function Matchup() {
  const router = useRouter();
  const [batter, setBatter]   = useState(null);
  const [pitcher, setPitcher] = useState(null);
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);

  // URL state: /matchup?batter=592450&pitcher=554430
  useEffect(() => {
    if (!router.isReady) return;
    const { batter: qb, pitcher: qp } = router.query;
    if (qb && /^\d+$/.test(qb) && !batter) setBatter({ id: parseInt(qb), name: '…' });
    if (qp && /^\d+$/.test(qp) && !pitcher) setPitcher({ id: parseInt(qp), name: '…' });
  }, [router.isReady]);

  useEffect(() => {
    if (!batter?.id || !pitcher?.id) { setData(null); return; }
    setLoading(true);
    fetch(`/api/bvp?batter=${batter.id}&pitcher=${pitcher.id}`)
      .then(r => r.json())
      .then(d => {
        setData(d);
        setLoading(false);
        // hydrate names if they came from URL
        if (batter.name === '…' && d.batter?.name) setBatter({ id: batter.id, name: d.batter.name });
        if (pitcher.name === '…' && d.pitcher?.name) setPitcher({ id: pitcher.id, name: d.pitcher.name });
        router.replace({ pathname:'/matchup', query:{ batter: batter.id, pitcher: pitcher.id } }, undefined, { shallow:true });
      })
      .catch(() => setLoading(false));
  }, [batter?.id, pitcher?.id]);

  const c = data?.bvp?.career;
  const s = data?.bvp?.season;

  return (
    <>
      <Head>
        <title>Batter vs Pitcher — Coach</title>
        <meta property="og:title" content={data ? `${data.batter.name} vs ${data.pitcher.name} — COACH.` : 'Batter vs Pitcher — COACH.'} />
        <meta property="og:image" content={data ? `https://www.coachvalerio.com/api/og?title=${encodeURIComponent(`${data.batter.name.split(' ').pop()} vs ${data.pitcher.name.split(' ').pop()}`)}&subtitle=${encodeURIComponent('Career Matchup on COACH')}` : ''} />
        <link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700&family=Barlow+Condensed:wght@400;600;700;900&display=swap" rel="stylesheet" />
        <style>{`
          *{box-sizing:border-box;margin:0;padding:0}
          body{background:#03080f;color:#c8cde0;font-family:'Inter',sans-serif;-webkit-font-smoothing:antialiased}
        `}</style>
      </Head>

      {/* NAV */}
      <nav style={{ display:'flex', alignItems:'center', gap:'1.5rem', padding:'1rem 2rem', background:'#03080f', borderBottom:'1px solid #12161e' }}>
        <a href="/" style={{ fontFamily:"'Anton',sans-serif", fontSize:'1.3rem', color:'#fff', textDecoration:'none', letterSpacing:'.05em' }}>COACH<span style={{ color:'#00c2a8' }}>.</span></a>
        <div style={{ display:'flex', gap:'1.2rem', marginLeft:'auto', flexWrap:'wrap' }}>
          {[['Home','/'],['Scoreboard','/scoreboard'],['Compare','/compare'],['Matchup','/matchup'],['Leaders','/leaders']].map(([l,h]) => (
            <a key={h} href={h} style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.78rem', fontWeight:700, letterSpacing:'.12em', color: h==='/matchup'?'#00c2a8':'#5c6070', textDecoration:'none', textTransform:'uppercase' }}>{l}</a>
          ))}
        </div>
      </nav>

      <div style={{ maxWidth:'1000px', margin:'0 auto', padding:'2rem 1.5rem' }}>
        <div style={{ textAlign:'center', marginBottom:'2rem' }}>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.7rem', fontWeight:700, letterSpacing:'.2em', color:'#00c2a8' }}>HEAD TO HEAD</div>
          <h1 style={{ fontFamily:"'Anton',sans-serif", fontSize:'2.6rem', color:'#fff', letterSpacing:'.03em' }}>BATTER vs PITCHER</h1>
          <div style={{ fontSize:'.8rem', color:'#5c6070' }}>Career matchup history · the page bettors and front offices live in</div>
        </div>

        {/* Pickers */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:'1rem', alignItems:'center', marginBottom:'2rem' }}>
          <PlayerSearch label="BATTER" accent="#00c2a8" onPick={setBatter} picked={batter} />
          <div style={{ fontFamily:"'Anton',sans-serif", fontSize:'1.4rem', color:'#3a3f52' }}>VS</div>
          <PlayerSearch label="PITCHER" accent="#f5a623" onPick={setPitcher} picked={pitcher} />
        </div>

        {loading && <div style={{ textAlign:'center', padding:'3rem', color:'#3a3f52' }}>Loading matchup history…</div>}

        {!loading && data && (
          <>
            {/* Career BvP */}
            <div style={{ background:'#0d1117', border:'1px solid #1e2028', borderRadius:'12px', padding:'1.25rem', marginBottom:'1.25rem' }}>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.65rem', fontWeight:700, letterSpacing:'.14em', color:'#00c2a8', marginBottom:'.9rem' }}>
                CAREER · {data.batter.name?.toUpperCase()} vs {data.pitcher.name?.toUpperCase()}
              </div>
              {c ? (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(90px,1fr))', gap:'.6rem' }}>
                  <StatBox label="AB"   value={c.atBats} />
                  <StatBox label="H"    value={c.hits} />
                  <StatBox label="AVG"  value={c.avg} accent="#00c2a8" />
                  <StatBox label="HR"   value={c.homeRuns} accent="#e63535" />
                  <StatBox label="RBI"  value={c.rbi} />
                  <StatBox label="BB"   value={c.baseOnBalls} />
                  <StatBox label="K"    value={c.strikeOuts} accent="#f5a623" />
                  <StatBox label="OPS"  value={c.ops} accent="#00c2a8" />
                </div>
              ) : (
                <div style={{ textAlign:'center', color:'#3a3f52', padding:'1.5rem', fontSize:'.85rem' }}>
                  No career matchup history — these two have never faced each other.
                </div>
              )}
            </div>

            {/* This season BvP */}
            {s && (
              <div style={{ background:'#0d1117', border:'1px solid #1e2028', borderRadius:'12px', padding:'1.25rem', marginBottom:'1.25rem' }}>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.65rem', fontWeight:700, letterSpacing:'.14em', color:'#f5a623', marginBottom:'.9rem' }}>
                  THIS SEASON
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(90px,1fr))', gap:'.6rem' }}>
                  <StatBox label="AB"  value={s.atBats} />
                  <StatBox label="H"   value={s.hits} />
                  <StatBox label="AVG" value={s.avg} accent="#00c2a8" />
                  <StatBox label="HR"  value={s.homeRuns} accent="#e63535" />
                  <StatBox label="K"   value={s.strikeOuts} accent="#f5a623" />
                  <StatBox label="OPS" value={s.ops} accent="#00c2a8" />
                </div>
              </div>
            )}

            {/* Season context cards */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.25rem' }}>
              <div style={{ background:'#0d1117', border:'1px solid #00c2a833', borderRadius:'12px', padding:'1.25rem' }}>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.62rem', fontWeight:700, letterSpacing:'.12em', color:'#00c2a8', marginBottom:'.7rem' }}>
                  {data.batter.name?.toUpperCase()} · {new Date().getFullYear()} {data.batter.bats && `· BATS ${data.batter.bats}`}
                </div>
                {data.batter.seasonStats ? (
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'.5rem' }}>
                    <StatBox label="AVG" value={data.batter.seasonStats.avg} />
                    <StatBox label="HR"  value={data.batter.seasonStats.homeRuns} />
                    <StatBox label="OPS" value={data.batter.seasonStats.ops} />
                  </div>
                ) : <div style={{ color:'#3a3f52', fontSize:'.8rem' }}>No season stats</div>}
                <a href={`/players/${data.batter.id}`} style={{ display:'block', marginTop:'.75rem', fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.68rem', fontWeight:700, letterSpacing:'.1em', color:'#00c2a8', textDecoration:'none' }}>
                  FULL PROFILE →
                </a>
              </div>

              <div style={{ background:'#0d1117', border:'1px solid #f5a62333', borderRadius:'12px', padding:'1.25rem' }}>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.62rem', fontWeight:700, letterSpacing:'.12em', color:'#f5a623', marginBottom:'.7rem' }}>
                  {data.pitcher.name?.toUpperCase()} · {new Date().getFullYear()} {data.pitcher.throws && `· THROWS ${data.pitcher.throws}`}
                </div>
                {data.pitcher.seasonStats ? (
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'.5rem' }}>
                    <StatBox label="ERA"  value={data.pitcher.seasonStats.era} />
                    <StatBox label="K"    value={data.pitcher.seasonStats.strikeOuts} />
                    <StatBox label="WHIP" value={data.pitcher.seasonStats.whip} />
                  </div>
                ) : <div style={{ color:'#3a3f52', fontSize:'.8rem' }}>No season stats</div>}
                <a href={`/players/${data.pitcher.id}`} style={{ display:'block', marginTop:'.75rem', fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.68rem', fontWeight:700, letterSpacing:'.1em', color:'#f5a623', textDecoration:'none' }}>
                  FULL PROFILE + ARSENAL →
                </a>
              </div>
            </div>
          </>
        )}

        {!loading && !data && (!batter || !pitcher) && (
          <div style={{ textAlign:'center', padding:'3rem', color:'#3a3f52', fontSize:'.85rem' }}>
            Pick a batter and a pitcher to see their head-to-head history.
          </div>
        )}
      </div>
    </>
  );
}