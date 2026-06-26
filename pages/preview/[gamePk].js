// pages/preview/[gamePk].js
// #10 Auto-generated game preview — probables, arsenals, hot/cold, prediction
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

function PitcherCard({ pitcher, accent }) {
  const [arsenal, setArsenal] = useState(null);

  useEffect(() => {
    if (!pitcher?.id) return;
    fetch(`/api/arsenal?id=${pitcher.id}&year=${new Date().getFullYear()}`)
      .then(r => r.json())
      .then(d => setArsenal(d.pitches ?? []))
      .catch(() => {});
  }, [pitcher?.id]);

  if (!pitcher) return (
    <div style={{ background:'#0d1117', border:'1px solid #1e2028', borderRadius:'12px', padding:'1.25rem', textAlign:'center', color:'#3a3f52' }}>
      Probable starter TBD
    </div>
  );

  return (
    <div style={{ background:'#0d1117', border:`1px solid ${accent}33`, borderRadius:'12px', padding:'1.25rem' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'.9rem', marginBottom:'1rem' }}>
        <img src={`https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_120,q_auto:best/v1/people/${pitcher.id}/headshot/67/current`}
          width={56} height={56} style={{ borderRadius:'50%', objectFit:'cover', border:`2px solid ${accent}` }} />
        <div>
          <a href={`/players/${pitcher.id}`} style={{ fontFamily:"'Inter',sans-serif", fontWeight:700, color:'#f0f2f8', fontSize:'1rem', textDecoration:'none' }}>
            {pitcher.fullName}
          </a>
          <div style={{ display:'flex', gap:'.8rem', marginTop:'.2rem' }}>
            {pitcher.era && <span style={{ fontFamily:"'Anton',sans-serif", fontSize:'.85rem', color:accent }}>{pitcher.era} ERA</span>}
            {pitcher.record && <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.75rem', color:'#5c6070' }}>{pitcher.record}</span>}
          </div>
        </div>
      </div>

      {/* Mini arsenal strip */}
      {arsenal && arsenal.length > 0 && (
        <div>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.58rem', fontWeight:700, letterSpacing:'.12em', color:'#5c6070', marginBottom:'.45rem' }}>
            ARSENAL
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'.4rem' }}>
            {arsenal.slice(0, 6).map((p, i) => (
              <div key={i} style={{ background:'#080c12', border:'1px solid #1e2028', borderRadius:'6px', padding:'.3rem .55rem' }}>
                <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.65rem', fontWeight:700, color:'#c8cce0' }}>{p.pitch_type}</span>
                <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.62rem', color:'#5c6070', marginLeft:'.3rem' }}>
                  {p.usage_pct !== null ? `${p.usage_pct.toFixed(0)}%` : ''}{p.avg_speed ? ` · ${p.avg_speed.toFixed(0)}mph` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function GamePreview() {
  const router = useRouter();
  const { gamePk } = router.query;
  const [game, setGame] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!gamePk) return;
    setLoading(true);

    // Game data from MLB schedule with probables
    fetch(`https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`)
      .then(r => r.json())
      .then(d => {
        const g = d.gameData;
        const awayProb = g?.probablePitchers?.away;
        const homeProb = g?.probablePitchers?.home;
        setGame({
          away: { name: g?.teams?.away?.name, abbr: g?.teams?.away?.abbreviation, id: g?.teams?.away?.id },
          home: { name: g?.teams?.home?.name, abbr: g?.teams?.home?.abbreviation, id: g?.teams?.home?.id },
          venue: g?.venue?.name,
          dateTime: g?.datetime?.dateTime,
          probAway: awayProb ? { id: awayProb.id, fullName: awayProb.fullName } : null,
          probHome: homeProb ? { id: homeProb.id, fullName: homeProb.fullName } : null,
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Prediction if available
    fetch(`/api/predictions?gamePk=${gamePk}`)
      .then(r => r.json())
      .then(d => setPrediction(d?.prediction ?? d))
      .catch(() => {});
  }, [gamePk]);

  return (
    <>
      <Head>
        <title>{game ? `${game.away?.abbr} @ ${game.home?.abbr} Preview — Coach` : 'Game Preview — Coach'}</title>
        {game && (
          <meta property="og:image" content={`https://www.coachvalerio.com/api/og?title=${encodeURIComponent(`${game.away?.abbr} @ ${game.home?.abbr}`)}&subtitle=${encodeURIComponent('Game Preview on COACH')}`} />
        )}
        <link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700&family=Barlow+Condensed:wght@400;600;700;900&display=swap" rel="stylesheet" />
        <style>{`
          *{box-sizing:border-box;margin:0;padding:0}
          body{background:#03080f;color:#c8cde0;font-family:'Inter',sans-serif;-webkit-font-smoothing:antialiased}
        `}</style>
      </Head>

      <nav style={{ display:'flex', alignItems:'center', gap:'1.5rem', padding:'1rem 2rem', background:'#03080f', borderBottom:'1px solid #12161e' }}>
        <a href="/" style={{ fontFamily:"'Anton',sans-serif", fontSize:'1.3rem', color:'#fff', textDecoration:'none', letterSpacing:'.05em' }}>COACH<span style={{ color:'#00c2a8' }}>.</span></a>
        <div style={{ display:'flex', gap:'1.2rem', marginLeft:'auto' }}>
          {[['Home','/'],['Scoreboard','/scoreboard'],['Leaders','/leaders']].map(([l,h]) => (
            <a key={h} href={h} style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.78rem', fontWeight:700, letterSpacing:'.12em', color:'#5c6070', textDecoration:'none', textTransform:'uppercase' }}>{l}</a>
          ))}
        </div>
      </nav>

      <div style={{ maxWidth:'1000px', margin:'0 auto', padding:'2rem 1.5rem' }}>
        {loading && <div style={{ textAlign:'center', padding:'4rem', color:'#3a3f52' }}>Building scouting card…</div>}

        {!loading && game && (
          <>
            {/* Header */}
            <div style={{ textAlign:'center', marginBottom:'2rem' }}>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.7rem', fontWeight:700, letterSpacing:'.2em', color:'#00c2a8' }}>GAME PREVIEW</div>
              <h1 style={{ fontFamily:"'Anton',sans-serif", fontSize:'2.4rem', color:'#fff', letterSpacing:'.03em' }}>
                {game.away?.abbr} @ {game.home?.abbr}
              </h1>
              <div style={{ fontSize:'.8rem', color:'#5c6070' }}>
                {game.venue} {game.dateTime && `· ${new Date(game.dateTime).toLocaleString('en-US',{ weekday:'short', month:'short', day:'numeric', hour:'numeric', minute:'2-digit' })}`}
              </div>
            </div>

            {/* Probables + arsenals */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.25rem', marginBottom:'1.25rem' }}>
              <div>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.62rem', fontWeight:700, letterSpacing:'.14em', color:'#00c2a8', marginBottom:'.5rem' }}>
                  {game.away?.name?.toUpperCase()} · PROBABLE
                </div>
                <PitcherCard pitcher={game.probAway} accent="#00c2a8" />
              </div>
              <div>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.62rem', fontWeight:700, letterSpacing:'.14em', color:'#f5a623', marginBottom:'.5rem' }}>
                  {game.home?.name?.toUpperCase()} · PROBABLE
                </div>
                <PitcherCard pitcher={game.probHome} accent="#f5a623" />
              </div>
            </div>

            {/* Prediction strip if engine returns one */}
            {prediction?.winner && (
              <div style={{ background:'#0d1117', border:'1px solid #00c2a833', borderRadius:'12px', padding:'1.25rem', textAlign:'center', marginBottom:'1.25rem' }}>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.62rem', fontWeight:700, letterSpacing:'.14em', color:'#00c2a8', marginBottom:'.4rem' }}>
                  COACH PREDICTION
                </div>
                <div style={{ fontFamily:"'Anton',sans-serif", fontSize:'1.4rem', color:'#f0f2f8' }}>
                  {prediction.winner} {prediction.confidence && <span style={{ color:'#00c2a8' }}>({prediction.confidence}%)</span>}
                </div>
              </div>
            )}

            {/* Links */}
            <div style={{ display:'flex', gap:'1rem', justifyContent:'center' }}>
              <a href={`/games/${gamePk}`} style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.72rem', fontWeight:700, letterSpacing:'.1em', color:'#00c2a8', textDecoration:'none', border:'1px solid #00c2a855', borderRadius:'8px', padding:'.6rem 1.2rem' }}>
                LIVE GAME CENTER →
              </a>
              {game.probAway && game.probHome && (
                <a href={`/matchup?pitcher=${game.probHome.id}`} style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.72rem', fontWeight:700, letterSpacing:'.1em', color:'#f5a623', textDecoration:'none', border:'1px solid #f5a62355', borderRadius:'8px', padding:'.6rem 1.2rem' }}>
                  BvP MATCHUPS →
                </a>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}