// pages/index.js
import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function Home() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const router = useRouter();

  async function handleSearch(e) {
    const val = e.target.value;
    setQuery(val);
    if (val.length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const r = await fetch(`/api/search?q=${encodeURIComponent(val)}`);
      const d = await r.json();
      setResults(d.players ?? []);
    } catch { setResults([]); }
    setSearching(false);
  }

  return (
    <>
      <Head>
        <title>CoachValerio — Baseball Stats</title>
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@300;400;500;600&family=Barlow+Condensed:wght@400;600;700;900&display=swap" rel="stylesheet"/>
      </Head>
      <div style={styles.page}>
        <div style={styles.hero}>
          <div style={styles.logo}>Coach<span style={styles.teal}>Valerio</span></div>
          <div style={styles.tagline}>FATHERHOOD. SPORTS. UNFILTERED.</div>
          <div style={styles.sub}>MLB Player Stats, Statcast & Daily Predictions</div>
          <div style={styles.searchWrap}>
            <input
              style={styles.input}
              type="text"
              placeholder="Search any MLB player — past or present…"
              value={query}
              onChange={handleSearch}
              autoComplete="off"
            />
            {results.length > 0 && (
              <div style={styles.dropdown}>
                {results.map(p => (
                  <div
                    key={p.id}
                    style={styles.dropItem}
                    onClick={() => router.push(`/players/${p.id}`)}
                    onMouseEnter={e => e.currentTarget.style.background = '#1e2028'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <img
                      src={`https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_60,q_auto:best/v1/people/${p.id}/headshot/67/current`}
                      alt=""
                      style={styles.avatar}
                    />
                    <div>
                      <div style={styles.pname}>{p.fullName}</div>
                      <div style={styles.pteam}>{p.currentTeam?.name ?? p.primaryPosition?.name ?? ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {searching && <div style={styles.hint}>Searching…</div>}
          {!searching && query.length > 1 && results.length === 0 && (
            <div style={styles.hint}>No players found</div>
          )}
        </div>

        <div style={styles.quickLinks}>
          <div style={styles.qlTitle}>QUICK ACCESS</div>
          <div style={styles.qlGrid}>
            {FEATURED.map(p => (
              <div key={p.id} style={styles.qlCard} onClick={() => router.push(`/players/${p.id}`)}>
                <img
                  src={`https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${p.id}/headshot/67/current`}
                  alt={p.name}
                  style={styles.qlPhoto}
                />
                <div style={styles.qlName}>{p.name}</div>
                <div style={styles.qlPos}>{p.pos}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

const FEATURED = [
  { id: 592450,  name: 'Aaron Judge',     pos: 'OF · Yankees'   },
  { id: 660271,  name: 'Shohei Ohtani',   pos: 'DH · Dodgers'   },
  { id: 545361,  name: 'Mike Trout',       pos: 'OF · Angels'    },
  { id: 605141,  name: 'Mookie Betts',     pos: 'OF · Dodgers'   },
  { id: 518692,  name: 'Freddie Freeman',  pos: '1B · Dodgers'   },
  { id: 660670,  name: 'Ronald Acuña Jr.', pos: 'OF · Braves'    },
  { id: 543037,  name: 'Gerrit Cole',      pos: 'SP · Yankees'   },
  { id: 675911,  name: 'Spencer Strider',  pos: 'SP · Braves'    },
];

const styles = {
  page:       { minHeight: '100vh', background: '#050608', fontFamily: "'Barlow', sans-serif", color: '#b8bdd0' },
  hero:       { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '5rem 1.5rem 3rem', textAlign: 'center', position: 'relative' },
  logo:       { fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(3rem,8vw,6rem)', letterSpacing: '.06em', color: '#f0f2f8', lineHeight: 1 },
  teal:       { color: '#00c2a8' },
  tagline:    { fontFamily: "'Barlow Condensed', sans-serif", fontSize: '.78rem', fontWeight: 700, letterSpacing: '.3em', color: '#5c6070', marginTop: '.5rem' },
  sub:        { fontSize: '.95rem', color: '#5c6070', marginTop: '.4rem', marginBottom: '2.5rem' },
  searchWrap: { position: 'relative', width: '100%', maxWidth: '560px' },
  input:      { width: '100%', padding: '.85rem 1.25rem', background: 'rgba(255,255,255,.05)', border: '1px solid #1e2028', borderRadius: '6px', color: '#f0f2f8', fontFamily: "'Barlow', sans-serif", fontSize: '1rem', outline: 'none' },
  dropdown:   { position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: '#111318', border: '1px solid #1e2028', borderRadius: '8px', zIndex: 100, maxHeight: '320px', overflowY: 'auto' },
  dropItem:   { display: 'flex', alignItems: 'center', gap: '.75rem', padding: '.65rem 1rem', cursor: 'pointer', transition: 'background .15s' },
  avatar:     { width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', background: '#1e2028' },
  pname:      { fontWeight: 600, fontSize: '.9rem', color: '#f0f2f8' },
  pteam:      { fontSize: '.75rem', color: '#5c6070' },
  hint:       { marginTop: '.75rem', fontSize: '.82rem', color: '#5c6070' },
  quickLinks: { maxWidth: '1100px', margin: '0 auto', padding: '0 1.5rem 4rem' },
  qlTitle:    { fontFamily: "'Barlow Condensed', sans-serif", fontSize: '.72rem', fontWeight: 700, letterSpacing: '.22em', color: '#00c2a8', marginBottom: '1.25rem', paddingBottom: '.5rem', borderBottom: '1px solid #1e2028' },
  qlGrid:     { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '1rem' },
  qlCard:     { background: '#111318', border: '1px solid #1e2028', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', transition: 'border-color .2s, transform .15s' },
  qlPhoto:    { width: '100%', aspectRatio: '1', objectFit: 'cover', objectPosition: 'top', display: 'block', background: '#1e2028' },
  qlName:     { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '.82rem', color: '#f0f2f8', padding: '.5rem .6rem .1rem' },
  qlPos:      { fontSize: '.7rem', color: '#5c6070', padding: '0 .6rem .6rem' },
};