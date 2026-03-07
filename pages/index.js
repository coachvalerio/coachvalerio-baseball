// pages/index.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

function getCurrentSeason() {
  const now = new Date();
  const year = now.getFullYear();
  return now >= new Date(year, 2, 20) ? year : year - 1;
}

export default function Home() {
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState([]);
  const [searching, setSearching] = useState(false);
  const [leaders, setLeaders]   = useState({});
  const [news, setNews]         = useState([]);
  const [loadingLeaders, setLoadingLeaders] = useState(true);
  const [loadingNews, setLoadingNews]       = useState(true);
  const [activeLeader, setActiveLeader]     = useState('battingAverage');
  const router  = useRouter();
  const SEASON  = getCurrentSeason();

  // Load league leaders
  useEffect(() => {
    fetch(`/api/leaders?season=${SEASON}`)
      .then(r => r.json())
      .then(d => { setLeaders(d); setLoadingLeaders(false); })
      .catch(() => setLoadingLeaders(false));
  }, []);

  // Load MLB news
  useEffect(() => {
    fetch('/api/news')
      .then(r => r.json())
      .then(d => { setNews(d.articles ?? []); setLoadingNews(false); })
      .catch(() => setLoadingNews(false));
  }, []);

  // Search handler
  let searchTimer;
  async function handleSearch(e) {
    const val = e.target.value;
    setQuery(val);
    if (val.length < 2) { setResults([]); return; }
    setSearching(true);
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(val)}`);
        const d = await r.json();
        setResults(d.players ?? []);
      } catch { setResults([]); }
      setSearching(false);
    }, 320);
  }

  const LEADER_CATS = [
    { id: 'battingAverage',    label: 'Batting AVG',   stat: 'avg' },
    { id: 'homeRuns',          label: 'Home Runs',     stat: 'value' },
    { id: 'rbi',               label: 'RBI',           stat: 'value' },
    { id: 'onBasePlusSlugging',label: 'OPS',           stat: 'value' },
    { id: 'stolenBases',       label: 'Stolen Bases',  stat: 'value' },
    { id: 'earnedRunAverage',  label: 'ERA (Pitchers)',stat: 'value' },
    { id: 'strikeouts',        label: 'Strikeouts',    stat: 'value' },
    { id: 'wins',              label: 'Pitcher Wins',  stat: 'value' },
  ];

  return (
    <>
      <Head>
        <title>CoachValerio — Baseball Stats, Predictions & News</title>
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@300;400;500;600&family=Barlow+Condensed:wght@400;600;700;900&display=swap" rel="stylesheet" />
        <style>{`
          *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
          body{background:#050608;color:#b8bdd0;font-family:'Barlow',sans-serif;-webkit-font-smoothing:antialiased}
          .ql-card:hover{border-color:#00c2a8!important;transform:translateY(-2px);transition:all .2s}
          .leader-row:hover{background:rgba(0,194,168,.05)!important}
          .news-card:hover{border-color:#00c2a8!important;transform:translateY(-2px);transition:all .2s}
          .cat-btn:hover{color:#f0f2f8!important}
          input:focus{border-color:#00c2a8!important;outline:none}
        `}</style>
      </Head>

      {/* NAV */}
      <nav style={s.nav}>
        <a href="/" style={s.logo}>Coach<span style={{ color: '#00c2a8' }}>Valerio</span></a>
        <div style={s.navLinks}>
          <a href="/" style={s.navLink}>Home</a>
          <a href="/scoreboard" style={s.navLink}>Scoreboard</a>
          <a href="/teams" style={s.navLink}>Teams</a>
          <a href="/transactions" style={s.navLink}>Transactions</a>
          <a href="/compare" style={s.navLink}>Compare</a>
          <a href="/trade" style={s.navLink}>Trade AI</a>
          <a href={`/leaders?season=${SEASON}`} style={s.navLink}>Leaders</a>
        </div>
      </nav>

      {/* HERO */}
      <div style={s.hero}>
        <div style={s.heroBg} />
        <div style={s.heroContent}>
          <div style={s.siteTitle}>Coach<span style={{ color: '#00c2a8' }}>Valerio</span></div>
          <div style={s.tagline}>FATHERHOOD. SPORTS. UNFILTERED.</div>
          <div style={s.heroSub}>MLB Stats · Statcast · Daily Predictions · {SEASON} Season</div>

          {/* SEARCH */}
          <div style={s.searchWrap}>
            <span style={s.searchIcon}>⌕</span>
            <input
              style={s.searchInput}
              type="text"
              placeholder="Search any MLB player — past or present…"
              value={query}
              onChange={handleSearch}
              autoComplete="off"
            />
            {results.length > 0 && (
              <div style={s.searchDrop}>
                {results.map(p => (
                  <div key={p.id} style={s.searchItem}
                    onClick={() => router.push(`/players/${p.id}`)}
                    onMouseEnter={e => e.currentTarget.style.background = '#1e2028'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <img src={`https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_60,q_auto:best/v1/people/${p.id}/headshot/67/current`}
                      alt="" style={s.searchAvatar} />
                    <div>
                      <div style={s.searchName}>{p.fullName}</div>
                      <div style={s.searchTeam}>{p.currentTeam?.name ?? p.primaryPosition?.name ?? ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {searching && <div style={s.hint}>Searching…</div>}
            {!searching && query.length > 1 && results.length === 0 && <div style={s.hint}>No players found</div>}
          </div>
        </div>
      </div>

      {/* FEATURED PLAYERS */}
      <div style={s.section}>
        <div style={s.sectionInner}>
          <div style={s.secLabel}>⚾ FEATURED PLAYERS</div>
          <div style={s.qlGrid}>
            {FEATURED.map(p => (
              <div key={p.id} className="ql-card" style={s.qlCard} onClick={() => router.push(`/players/${p.id}`)}>
                <img
                  src={`https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${p.id}/headshot/67/current`}
                  alt={p.name} style={s.qlPhoto}
                  onError={e => { e.target.src = `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${p.id}/headshot/67/current`; }}
                />
                <div style={s.qlName}>{p.name}</div>
                <div style={s.qlPos}>{p.pos}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* LEAGUE LEADERS + NEWS — two-column layout */}
      <div style={s.section}>
        <div style={{ ...s.sectionInner, display: 'grid', gridTemplateColumns: '1fr 380px', gap: '2rem', alignItems: 'start' }}>

          {/* LEAGUE LEADERS */}
          <div>
            <div style={s.secLabel}>🏆 {SEASON} LEAGUE LEADERS</div>

            {/* Category tabs */}
            <div style={s.catTabs}>
              {LEADER_CATS.map(c => (
                <button key={c.id} className="cat-btn"
                  style={{ ...s.catBtn, ...(activeLeader === c.id ? s.catBtnActive : {}) }}
                  onClick={() => setActiveLeader(c.id)}>
                  {c.label}
                </button>
              ))}
            </div>

            {/* Leaders table */}
            <div style={s.leadersCard}>
              {loadingLeaders ? (
                <div style={s.loadingText}>Loading leaders…</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1e2028' }}>
                      <th style={{ ...s.lth, textAlign: 'left', width: '36px' }}>#</th>
                      <th style={{ ...s.lth, textAlign: 'left' }}>Player</th>
                      <th style={{ ...s.lth, textAlign: 'left' }}>Team</th>
                      <th style={{ ...s.lth, textAlign: 'right', color: '#00c2a8' }}>
                        {LEADER_CATS.find(c => c.id === activeLeader)?.label}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(leaders[activeLeader] ?? []).slice(0, 10).map((row, i) => (
                      <tr key={i} className="leader-row"
                        style={{ borderBottom: '1px solid rgba(30,32,40,.7)', cursor: 'pointer' }}
                        onClick={() => router.push(`/players/${row.person?.id}`)}>
                        <td style={s.ltd}>
                          <span style={{ ...s.rank, background: i === 0 ? '#f5a623' : i === 1 ? '#C4CED4' : i === 2 ? '#CD7F32' : '#1e2028', color: i < 3 ? '#050608' : '#5c6070' }}>
                            {i + 1}
                          </span>
                        </td>
                        <td style={{ ...s.ltd, textAlign: 'left' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                            <img
                              src={`https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_60,q_auto:best/v1/people/${row.person?.id}/headshot/67/current`}
                              alt="" style={s.leaderAvatar}
                            />
                            <span style={{ color: '#f0f2f8', fontWeight: 500 }}>{row.person?.fullName ?? '—'}</span>
                          </div>
                        </td>
                        <td style={{ ...s.ltd, textAlign: 'left', color: '#5c6070', fontSize: '.8rem' }}>
                          {row.team?.name ?? '—'}
                        </td>
                        <td style={{ ...s.ltd, textAlign: 'right', color: '#00c2a8', fontFamily: "'Barlow Condensed',sans-serif", fontSize: '1.1rem', fontWeight: 700 }}>
                          {row.value ?? '—'}
                        </td>
                      </tr>
                    ))}
                    {(leaders[activeLeader] ?? []).length === 0 && (
                      <tr><td colSpan={4} style={{ textAlign: 'center', color: '#5c6070', padding: '2rem' }}>No data available yet for {SEASON}</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* MLB NEWS */}
          <div>
            <div style={s.secLabel}>📰 MLB NEWS</div>
            <div style={s.newsCol}>
              {loadingNews ? (
                <div style={s.loadingText}>Loading news…</div>
              ) : news.length === 0 ? (
                <div style={s.loadingText}>Check back soon — latest MLB headlines will appear here.</div>
              ) : (
                news.slice(0, 8).map((article, i) => (
                  <a key={i} href={article.url} target="_blank" rel="noopener" className="news-card" style={s.newsCard}>
                    {article.urlToImage && (
                      <img src={article.urlToImage} alt="" style={s.newsImg}
                        onError={e => { e.target.style.display = 'none'; }} />
                    )}
                    <div style={s.newsBody}>
                      <div style={s.newsSource}>{article.source?.name ?? 'MLB News'}</div>
                      <div style={s.newsTitle}>{article.title}</div>
                      <div style={s.newsDesc}>{article.description?.slice(0, 100)}{article.description?.length > 100 ? '…' : ''}</div>
                      <div style={s.newsDate}>{article.publishedAt ? new Date(article.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</div>
                    </div>
                  </a>
                ))
              )}

              {/* Always show MLB.com news link */}
              <a href="https://www.mlb.com/news" target="_blank" rel="noopener" style={s.moreNews}>
                View all MLB news on MLB.com →
              </a>
            </div>
          </div>

        </div>
      </div>

      <footer style={s.footer}>
        Data via <a href="https://statsapi.mlb.com" target="_blank" rel="noopener" style={{ color: '#5c6070' }}>MLB Stats API</a> ·
        <a href="https://baseballsavant.mlb.com" target="_blank" rel="noopener" style={{ color: '#5c6070' }}> Baseball Savant</a> ·
        CoachValerio.com · Updated daily
      </footer>
    </>
  );
}

const FEATURED = [
  { id: 592450,  name: 'Aaron Judge',      pos: 'OF · Yankees'    },
  { id: 660271,  name: 'Shohei Ohtani',    pos: 'DH/P · Dodgers'  },
  { id: 545361,  name: 'Mike Trout',        pos: 'OF · Angels'     },
  { id: 605141,  name: 'Mookie Betts',      pos: 'OF · Dodgers'    },
  { id: 518692,  name: 'Freddie Freeman',   pos: '1B · Dodgers'    },
  { id: 660670,  name: 'Ronald Acuña Jr.',  pos: 'OF · Braves'     },
  { id: 547180,  name: 'Bryce Harper',      pos: '1B · Phillies'   },
  { id: 543037,  name: 'Gerrit Cole',       pos: 'SP · Yankees'    },
  { id: 675911,  name: 'Spencer Strider',   pos: 'SP · Braves'     },
  { id: 665742,  name: 'Juan Soto',         pos: 'OF · Mets'       },
  { id: 607208,  name: 'Trea Turner',       pos: 'SS · Phillies'   },
  { id: 624413,  name: 'Pete Alonso',       pos: '1B · Mets'       },
];

const s = {
  nav:          { position: 'sticky', top: 0, zIndex: 200, background: 'rgba(5,6,8,.93)', backdropFilter: 'blur(16px)', borderBottom: '1px solid #1e2028', height: '54px', display: 'flex', alignItems: 'center', padding: '0 1.5rem', gap: '1rem' },
  logo:         { fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.5rem', letterSpacing: '.08em', color: '#f0f2f8', textDecoration: 'none', flexShrink: 0 },
  navLinks:     { display: 'flex', gap: '1.5rem', marginLeft: 'auto' },
  navLink:      { fontFamily: "'Barlow Condensed',sans-serif", fontSize: '.82rem', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#5c6070', textDecoration: 'none' },
  hero:         { position: 'relative', padding: '5rem 1.5rem 3.5rem', textAlign: 'center', overflow: 'hidden', background: 'linear-gradient(135deg, #050608 0%, #0a0f1a 50%, #050608 100%)' },
  heroBg:       { position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(0,194,168,.08) 0%, transparent 60%)', pointerEvents: 'none' },
  heroContent:  { position: 'relative', zIndex: 1 },
  siteTitle:    { fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(3.5rem,10vw,7rem)', letterSpacing: '.06em', color: '#f0f2f8', lineHeight: 1 },
  tagline:      { fontFamily: "'Barlow Condensed',sans-serif", fontSize: '.78rem', fontWeight: 700, letterSpacing: '.3em', color: '#5c6070', marginTop: '.5rem' },
  heroSub:      { fontSize: '.9rem', color: '#5c6070', marginTop: '.35rem', marginBottom: '2.5rem' },
  searchWrap:   { position: 'relative', width: '100%', maxWidth: '580px', margin: '0 auto' },
  searchIcon:   { position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#5c6070', fontSize: '1.1rem', pointerEvents: 'none', zIndex: 1 },
  searchInput:  { width: '100%', padding: '.9rem 1.25rem .9rem 2.8rem', background: 'rgba(255,255,255,.05)', border: '1px solid #1e2028', borderRadius: '6px', color: '#f0f2f8', fontFamily: "'Barlow',sans-serif", fontSize: '1rem', outline: 'none', transition: 'border-color .2s' },
  searchDrop:   { position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: '#111318', border: '1px solid #1e2028', borderRadius: '8px', zIndex: 100, maxHeight: '320px', overflowY: 'auto', textAlign: 'left' },
  searchItem:   { display: 'flex', alignItems: 'center', gap: '.75rem', padding: '.65rem 1rem', cursor: 'pointer', transition: 'background .15s' },
  searchAvatar: { width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', background: '#1e2028', flexShrink: 0 },
  searchName:   { fontWeight: 600, fontSize: '.9rem', color: '#f0f2f8' },
  searchTeam:   { fontSize: '.75rem', color: '#5c6070' },
  hint:         { marginTop: '.75rem', fontSize: '.82rem', color: '#5c6070' },
  section:      { padding: '0 1.5rem 3rem' },
  sectionInner: { maxWidth: '1200px', margin: '0 auto' },
  secLabel:     { fontFamily: "'Barlow Condensed',sans-serif", fontSize: '.72rem', fontWeight: 700, letterSpacing: '.22em', color: '#00c2a8', marginBottom: '1.25rem', paddingBottom: '.5rem', borderBottom: '1px solid #1e2028' },
  qlGrid:       { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px,1fr))', gap: '1rem' },
  qlCard:       { background: '#111318', border: '1px solid #1e2028', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer' },
  qlPhoto:      { width: '100%', aspectRatio: '1', objectFit: 'cover', objectPosition: 'top', display: 'block', background: '#1e2028' },
  qlName:       { fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: '.82rem', color: '#f0f2f8', padding: '.5rem .6rem .1rem' },
  qlPos:        { fontSize: '.7rem', color: '#5c6070', padding: '0 .6rem .6rem' },
  catTabs:      { display: 'flex', flexWrap: 'wrap', gap: '.4rem', marginBottom: '1rem' },
  catBtn:       { padding: '.35rem .85rem', background: '#111318', border: '1px solid #1e2028', borderRadius: '4px', fontFamily: "'Barlow Condensed',sans-serif", fontSize: '.75rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#5c6070', cursor: 'pointer', transition: 'all .2s' },
  catBtnActive: { background: 'rgba(0,194,168,.15)', borderColor: '#00c2a8', color: '#00c2a8' },
  leadersCard:  { background: '#111318', border: '1px solid #1e2028', borderRadius: '8px', overflow: 'hidden' },
  lth:          { padding: '.6rem 1rem', fontFamily: "'Barlow Condensed',sans-serif", fontSize: '.68rem', fontWeight: 700, letterSpacing: '.13em', textTransform: 'uppercase', color: '#5c6070', whiteSpace: 'nowrap' },
  ltd:          { padding: '.65rem 1rem', color: '#b8bdd0', fontSize: '.86rem', whiteSpace: 'nowrap' },
  rank:         { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '4px', fontFamily: "'Barlow Condensed',sans-serif", fontSize: '.78rem', fontWeight: 700 },
  leaderAvatar: { width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', background: '#1e2028', flexShrink: 0 },
  newsCol:      { display: 'flex', flexDirection: 'column', gap: '.75rem' },
  newsCard:     { display: 'flex', flexDirection: 'column', background: '#111318', border: '1px solid #1e2028', borderRadius: '8px', overflow: 'hidden', textDecoration: 'none', color: '#b8bdd0' },
  newsImg:      { width: '100%', height: '140px', objectFit: 'cover', display: 'block', background: '#1e2028' },
  newsBody:     { padding: '.85rem 1rem' },
  newsSource:   { fontFamily: "'Barlow Condensed',sans-serif", fontSize: '.62rem', fontWeight: 700, letterSpacing: '.15em', textTransform: 'uppercase', color: '#00c2a8', marginBottom: '.3rem' },
  newsTitle:    { fontWeight: 600, fontSize: '.86rem', color: '#f0f2f8', lineHeight: 1.4, marginBottom: '.3rem' },
  newsDesc:     { fontSize: '.75rem', color: '#5c6070', lineHeight: 1.5 },
  newsDate:     { fontSize: '.68rem', color: '#3a3f52', marginTop: '.4rem' },
  moreNews:     { display: 'block', textAlign: 'center', padding: '.75rem', background: '#111318', border: '1px solid #1e2028', borderRadius: '8px', textDecoration: 'none', fontFamily: "'Barlow Condensed',sans-serif", fontSize: '.78rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#5c6070' },
  loadingText:  { padding: '2rem', textAlign: 'center', color: '#5c6070', fontSize: '.88rem' },
  footer:       { borderTop: '1px solid #1e2028', padding: '1.4rem', textAlign: 'center', fontSize: '.74rem', color: '#5c6070' },
};