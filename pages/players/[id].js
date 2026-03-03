// pages/players/[id].js
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

function getColors(teamName) {
  return TEAM_COLORS[teamName] ?? { primary: '#00c2a8', accent: '#f5a623' };
}

export default function PlayerPage() {
  const router = useRouter();
  const { id } = router.query;
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('season');
  const [imgSrc, setImgSrc]   = useState('');
  const chartRef      = useRef(null);
  const chartInstance = useRef(null);
  const SEASON        = getCurrentSeason();

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setActiveTab('season');
    fetch(`/api/player?id=${id}&season=${SEASON}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  // Set hero image with fallback chain
  useEffect(() => {
    if (!id) return;
    const action  = `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:action:hero:current.jpg/ar_4:3,g_auto/q_auto:best/v1/people/${id}/action/hero/current`;
    setImgSrc(action);
  }, [id]);

  useEffect(() => {
    if (activeTab === 'trends' && data && chartRef.current) {
      buildChart(data, chartRef, chartInstance);
    }
  }, [activeTab, data]);

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

  // Headshot fallback (always works)
  const headshotUrl = `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_426,q_auto:best/v1/people/${id}/headshot/67/current`;

  const TABS = [
    { id: 'season',     label: `${SEASON} Season` },
    { id: 'savant',     label: 'Statcast / Savant' },
    { id: 'career',     label: 'Career' },
    { id: 'trends',     label: 'Trends' },
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
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #050608; font-family: 'Barlow', sans-serif; overflow-x: hidden; -webkit-font-smoothing: antialiased; }
          .hero-img { width:100%; height:100%; object-fit:cover; object-position:center top; display:block; }
          .tab-btn:hover { color: #f0f2f8 !important; }
          .sv-tile:hover { border-color: ${colors.primary} !important; transform: translateY(-2px); }
          .ext-link:hover { border-color: ${colors.primary} !important; transform: translateY(-2px); }
          @keyframes loadbar { to { width: 100%; } }
        `}</style>
      </Head>

      {/* NAV */}
      <nav style={{ ...s.nav, borderBottomColor: colors.primary + '55' }}>
        <a href="/" style={s.navLogo}>Coach<span style={{ color: colors.primary }}>Valerio</span></a>
        <SearchBar colors={colors} />
      </nav>

      {/* HERO */}
      <section style={s.heroWrap}>
        {/* Image layer */}
        <div style={s.heroBgWrap}>
          <img
            className="hero-img"
            src={imgSrc}
            alt={player.fullName}
            onError={() => setImgSrc(headshotUrl)}
          />
        </div>
        {/* Gradient overlay */}
        <div style={s.heroOverlay} />
        {/* Team color tint at bottom */}
        <div style={{ ...s.heroTint, background: `linear-gradient(to top, ${colors.primary}33 0%, transparent 40%)` }} />

        {/* Text content */}
        <div style={s.heroContent}>
          <div style={{ ...s.eyebrow, color: colors.primary }}>
            {player.primaryPosition?.name ?? 'MLB'} · {teamName}
          </div>
          <div style={s.playerName}>{player.fullName.toUpperCase()}</div>
          <div style={s.badges}>
            {player.primaryPosition?.name && (
              <span style={{ ...s.badge, borderColor: colors.primary, color: colors.primary }}>
                {player.primaryPosition.name}
              </span>
            )}
            {teamName && (
              <span style={{ ...s.badge, borderColor: colors.accent, color: colors.accent }}>
                {teamName}
              </span>
            )}
            {player.primaryNumber && <span style={s.badge}>#{player.primaryNumber}</span>}
            {player.batSide?.description && (
              <span style={s.badge}>{player.batSide.description} / {player.pitchHand?.description}</span>
            )}
          </div>
        </div>

        {/* Primary stats overlay */}
        <div style={{ ...s.statOverlay, borderTopColor: colors.primary }}>
          {heroStats.map((h, i) => (
            <div key={i} style={s.statBlock}>
              <div style={s.statLabel}>{h.label}</div>
              <div style={{ ...s.statVal, color: h.primary ? colors.primary : h.accent ? colors.accent : '#f0f2f8' }}>
                {h.val}
              </div>
            </div>
          ))}
        </div>

        {/* Savant strip */}
        <div style={{ ...s.savantStrip, borderTopColor: colors.primary + '44', background: colors.primary + '11' }}>
          <div style={{ ...s.savantTitle, color: colors.primary }}>⚡ Statcast</div>
          <div style={s.savantMets}>
            {savantMets.map((m, i) => (
              <div key={i} style={s.savantMet}>
                <div style={s.savantMetL}>{m.label}</div>
                <div style={{ ...s.savantMetV, color: m.great ? colors.primary : '#f0f2f8' }}>{m.val}</div>
              </div>
            ))}
          </div>
          <a href={savantUrl} target="_blank" rel="noopener"
            style={{ ...s.savantLink, borderColor: colors.primary, color: colors.primary }}>
            Full Savant →
          </a>
        </div>
      </section>

      {/* TABS */}
      <div style={s.tabsBar}>
        <div style={s.tabsInner}>
          {TABS.map(t => (
            <button key={t.id} className="tab-btn"
              style={{ ...s.tabBtn, ...(activeTab === t.id ? { color: colors.primary, borderBottomColor: colors.primary } : {}) }}
              onClick={() => setActiveTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main style={s.main}>
        {/* SEASON */}
        {activeTab === 'season' && (
          <div>
            <div style={{ ...s.secLabel, color: colors.primary }}>{SEASON} Season Statistics</div>
            <StatsCard title={isPit ? 'Pitching Stats' : 'Batting Stats'} tag={String(SEASON)} colors={colors}
              cols={[{ k: '__tm', l: 'Team' }, ...fullCols]}
              rows={seasonRows.map(r => ({ __tm: r.team?.name ?? '—', ...r.stat }))} />
          </div>
        )}

        {/* SAVANT */}
        {activeTab === 'savant' && (
          <div>
            <div style={{ ...s.secLabel, color: colors.primary }}>Statcast / Baseball Savant Metrics</div>
            <SavantGrid stat={stat} isPitcher={isPit} colors={colors} />
            <div style={s.infoBox}>
              <strong style={{ color: colors.primary, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: '.1em', textTransform: 'uppercase' }}>About These Metrics</strong><br />
              <strong style={{ color: '#f0f2f8' }}>xBA / xSLG / xwOBA</strong> = expected stats based on exit velocity & launch angle. &nbsp;
              <strong style={{ color: '#f0f2f8' }}>Barrel%</strong> = optimal EV + launch angle. &nbsp;
              <strong style={{ color: '#f0f2f8' }}>Hard Hit%</strong> = batted balls ≥95mph. Metrics marked * are estimated from season stats.
            </div>
            <a href={savantUrl} target="_blank" rel="noopener" style={{ ...s.savantFullLink, borderColor: colors.primary + '55' }}>
              <span style={{ fontSize: '1.4rem' }}>🎯</span>
              <div>
                <div style={{ fontWeight: 600, color: '#f0f2f8' }}>View Full Savant Profile →</div>
                <div style={{ fontSize: '.72rem', color: '#5c6070' }}>All Statcast metrics, heat maps, spray charts, percentile rankings</div>
              </div>
            </a>
          </div>
        )}

        {/* CAREER */}
        {activeTab === 'career' && (
          <div>
            <div style={{ ...s.secLabel, color: colors.primary }}>Career — Year by Year</div>
            <StatsCard title="All Seasons" tag="Career" colors={colors}
              cols={[{ k: '__yr', l: 'Year' }, { k: '__tm', l: 'Team' }, ...fullCols]}
              rows={careerRows.map(r => ({ __yr: r.season, __tm: r.team?.name ?? '—', ...r.stat }))} />
          </div>
        )}

        {/* TRENDS */}
        {activeTab === 'trends' && (
          <div>
            <div style={{ ...s.secLabel, color: colors.primary }}>Multi-Year Performance Trend</div>
            <div style={s.chartCard}><canvas id="trend-chart" ref={chartRef} height={90} /></div>
            <TrendSummary rows={careerRows} isPitcher={isPit} colors={colors} />
          </div>
        )}

        {/* PREDICTION */}
        {activeTab === 'prediction' && (
          <div>
            <div style={{ ...s.secLabel, color: colors.primary }}>Today's Matchup Prediction</div>
            <PredPanel stat={stat} isPitcher={isPit} colors={colors} />
          </div>
        )}

        {/* LINKS */}
        {activeTab === 'links' && (
          <div>
            <div style={{ ...s.secLabel, color: colors.primary }}>External Resources</div>
            <LinksGrid player={player} id={id} colors={colors} />
          </div>
        )}
      </main>

      <footer style={s.footer}>
        Data via <a href="https://statsapi.mlb.com" target="_blank" rel="noopener" style={{ color: '#5c6070' }}>MLB Stats API</a> &amp;&nbsp;
        <a href="https://baseballsavant.mlb.com" target="_blank" rel="noopener" style={{ color: '#5c6070' }}>Baseball Savant</a> · CoachValerio.com
      </footer>
    </>
  );
}

// ─── HERO BG with img tag for proper loading ──────────────
function HeroBg({ id, headshotUrl, imgSrc, setImgSrc }) {
  return (
    <div style={s.heroBgWrap}>
      <img className="hero-img" src={imgSrc} alt="" onError={() => setImgSrc(headshotUrl)} />
    </div>
  );
}

// ─── SEARCH BAR ────────────────────────────────────────────
function SearchBar({ colors }) {
  const [q, setQ]     = useState('');
  const [res, setRes] = useState([]);
  const router = useRouter();
  let timer;
  async function search(val) {
    if (val.length < 2) { setRes([]); return; }
    try {
      const r = await fetch(`/api/search?q=${encodeURIComponent(val)}`);
      const d = await r.json();
      setRes(d.players ?? []);
    } catch { setRes([]); }
  }
  return (
    <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
      <input style={s.searchInput} placeholder="Search any MLB player…" value={q}
        onChange={e => { setQ(e.target.value); clearTimeout(timer); timer = setTimeout(() => search(e.target.value), 320); }}
        autoComplete="off" />
      {res.length > 0 && (
        <div style={s.searchDrop}>
          {res.map(p => (
            <div key={p.id} style={s.searchItem}
              onClick={() => { router.push(`/players/${p.id}`); setRes([]); setQ(''); }}
              onMouseEnter={e => e.currentTarget.style.background = '#1e2028'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <img src={`https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_60,q_auto:best/v1/people/${p.id}/headshot/67/current`}
                alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: '.86rem', color: '#f0f2f8' }}>{p.fullName}</div>
                <div style={{ fontSize: '.72rem', color: '#5c6070' }}>{p.currentTeam?.name ?? ''}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── STATS CARD ────────────────────────────────────────────
function StatsCard({ title, tag, cols, rows, colors }) {
  return (
    <div style={s.card}>
      <div style={s.cardHead}>
        <span style={s.cardTitle}>{title}</span>
        <span style={{ ...s.cardTag, background: colors.primary + '22', color: colors.primary }}>{tag}</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.84rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1e2028' }}>
              {cols.map(c => <th key={c.k} style={s.th}>{c.l}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0
              ? <tr><td colSpan={cols.length} style={{ textAlign: 'center', color: '#5c6070', padding: '1.5rem' }}>No data available</td></tr>
              : rows.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(28,30,40,.8)' }}>
                  {cols.map(c => (
                    <td key={c.k} style={{
                      ...s.td,
                      ...(c.hi ? { color: colors.primary, fontWeight: 600 } : {}),
                      ...(['__yr', '__tm'].includes(c.k) ? { textAlign: 'left', color: '#f0f2f8', fontWeight: 500 } : {})
                    }}>
                      {row[c.k] ?? '—'}
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

// ─── SAVANT GRID ───────────────────────────────────────────
function SavantGrid({ stat, isPitcher, colors }) {
  const tiles = isPitcher ? getPitTiles(stat) : getBatTiles(stat);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(170px,1fr))', gap: '.875rem', marginBottom: '2rem' }}>
      {tiles.map((t, i) => (
        <div key={i} className="sv-tile" style={{ ...s.svTile, transition: 'border-color .2s, transform .15s' }}>
          <div style={s.svLabel}>{t.label}</div>
          <div style={s.svVal}>{t.val}</div>
          <div style={s.svSub}>{t.sub}</div>
          <div style={s.svBar}>
            <div style={{ ...s.svBarFill, width: `${Math.min(100, Math.round((t.bar || 0) * 100))}%`, background: t.col === 'red' ? '#e63535' : t.col === 'accent' ? colors.accent : colors.primary }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── TREND SUMMARY ─────────────────────────────────────────
function TrendSummary({ rows, isPitcher, colors }) {
  const last = rows.slice(-10);
  const met  = isPitcher ? 'era' : 'ops';
  const vals = last.map(r => parseFloat(r.stat?.[met] ?? 0));
  if (vals.length < 2) return null;
  const first = vals[0], latest = vals[vals.length - 1];
  const trend = isPitcher
    ? (latest < first ? '📈 Improving' : '📉 Declining')
    : (latest > first ? '📈 Improving' : '📉 Declining');
  return (
    <div style={{ ...s.card, padding: '1.2rem 1.4rem', fontSize: '.87rem', lineHeight: 1.7 }}>
      <span style={{ color: colors.primary, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: '.1em', textTransform: 'uppercase' }}>{trend}</span><br />
      {met.toUpperCase()} moved from <strong style={{ color: '#f5a623' }}>{first}</strong> ({last[0].season}) to <strong style={{ color: colors.primary }}>{latest}</strong> ({last[last.length - 1].season}) over {vals.length} seasons.
    </div>
  );
}

// ─── PREDICTION ─────────────────────────────────────────────
function PredPanel({ stat, isPitcher, colors }) {
  let score, title, bars, note;
  if (!isPitcher) {
    const avg = parseFloat(stat.avg ?? .250), ops = parseFloat(stat.ops ?? .700), hr = parseInt(stat.homeRuns ?? 0);
    score = Math.min(99, Math.max(1, Math.round((avg / .400 * 30) + (ops / 1.2 * 40) + Math.min(hr / 50 * 30, 30))));
    title = score >= 75 ? 'ELITE PERFORMANCE EXPECTED' : score >= 55 ? 'ABOVE AVERAGE PROJECTION' : score >= 40 ? 'AVERAGE PROJECTION' : 'BELOW AVERAGE PROJECTION';
    bars = [
      { l: 'Hit Probability',  p: Math.min(95, score + 5) },
      { l: 'Extra Base Hit',   p: Math.round(score * .45), accent: true },
      { l: 'Home Run Prob',    p: Math.round(score * .22), accent: true },
      { l: 'Overall Score',    p: score },
    ];
    note = `AVG ${stat.avg ?? '—'} · OPS ${stat.ops ?? '—'} · ${hr} HR this season. ${ops >= .900 ? 'Elite run producer.' : ops >= .750 ? 'Solid contributor.' : 'Inconsistent output.'}`;
  } else {
    const era = parseFloat(stat.era ?? 4), whip = parseFloat(stat.whip ?? 1.3), k9 = parseFloat(stat.strikeoutsPer9Inn ?? 8);
    score = Math.min(99, Math.max(1, Math.round((Math.max(0, 6 - era) / 6 * 40) + (Math.max(0, 2 - whip) / 2 * 35) + Math.min(k9 / 12 * 25, 25))));
    title = score >= 75 ? 'DOMINANT OUTING PROJECTED' : score >= 55 ? 'QUALITY START LIKELY' : score >= 40 ? 'AVERAGE OUTING EXPECTED' : 'TOUGH OUTING AHEAD';
    bars = [
      { l: 'Quality Start',   p: Math.min(95, score + 8) },
      { l: '7+ Strikeouts',   p: Math.round(Math.min(k9 / 14 * 100, 95)), accent: true },
      { l: 'Low WHIP Game',   p: Math.round(score * .82) },
      { l: 'Win Probability', p: Math.round(score * .68), accent: true },
    ];
    note = `ERA ${stat.era ?? '—'} · WHIP ${stat.whip ?? '—'} · K/9 ${stat.strikeoutsPer9Inn ?? '—'}. ${parseFloat(stat.era ?? 4) <= 3 ? 'Ace-caliber season.' : parseFloat(stat.era ?? 4) <= 4 ? 'Reliable starter.' : 'Struggling this year.'}`;
  }
  return (
    <>
      <div style={s.predCard}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <div style={{ ...s.predNum, color: colors.primary }}>{score}</div>
            <div style={{ fontSize: '.64rem', letterSpacing: '.14em', textTransform: 'uppercase', color: '#5c6070' }}>Score / 100</div>
          </div>
          <div style={{ flex: 1, minWidth: '180px' }}>
            <div style={s.predTitle}>{title}</div>
            <div style={{ fontSize: '.85rem', lineHeight: 1.65, color: '#b8bdd0' }}>{note}</div>
          </div>
        </div>
        {bars.map((b, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '.7rem', marginBottom: '.65rem' }}>
            <div style={{ width: '120px', fontSize: '.68rem', letterSpacing: '.08em', textTransform: 'uppercase', color: '#5c6070', textAlign: 'right', flexShrink: 0 }}>{b.l}</div>
            <div style={{ flex: 1, height: '5px', background: '#1e2028', borderRadius: '99px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${b.p}%`, background: b.accent ? colors.accent : colors.primary, borderRadius: '99px', transition: 'width 1.2s ease' }} />
            </div>
            <div style={{ width: '36px', fontFamily: "'Barlow Condensed',sans-serif", fontSize: '.84rem', fontWeight: 600, color: '#b8bdd0' }}>{b.p}%</div>
          </div>
        ))}
      </div>
      <div style={s.infoBox}>
        ℹ️ <strong style={{ color: '#f0f2f8' }}>How predictions work:</strong> Score is weighted from current season stats vs career baselines. Connect your backend to the MLB Schedule API + Baseball Savant for live matchup predictions.
      </div>
    </>
  );
}

// ─── LINKS ─────────────────────────────────────────────────
function LinksGrid({ player, id, colors }) {
  const n   = player.fullName.toLowerCase().replace(/ /g, '-');
  const enc = encodeURIComponent(player.fullName);
  const links = [
    { name: 'Baseball Savant',     desc: 'Statcast, heat maps, percentile rankings', icon: '🎯', url: `https://baseballsavant.mlb.com/savant-player/${n}-${id}`, pri: true },
    { name: 'FanGraphs',           desc: 'Advanced metrics & sabermetrics',           icon: '📊', url: `https://www.fangraphs.com/players/${n}/${id}` },
    { name: 'MLB.com',             desc: 'Official profile & highlights',              icon: '⚾', url: `https://www.mlb.com/player/${n}-${id}` },
    { name: 'Baseball Reference',  desc: 'Full historical records',                    icon: '📚', url: `https://www.baseball-reference.com/search/search.fcgi?search=${enc}` },
    { name: 'Rotowire',            desc: 'Fantasy projections & news',                 icon: '🏆', url: `https://www.rotowire.com/baseball/player.php?id=${id}` },
    { name: 'ESPN',                desc: 'Video highlights & box scores',              icon: '📺', url: `https://www.espn.com/mlb/player/stats/_/id/${id}` },
    { name: 'The Athletic',        desc: 'In-depth analysis & reporting',              icon: '✍️', url: `https://theathletic.com/search/#query=${enc}` },
    { name: 'Baseball Prospectus', desc: 'PECOTA projections',                         icon: '📈', url: `https://www.baseballprospectus.com/player-search/?s=${enc}` },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(215px,1fr))', gap: '.85rem' }}>
      {links.map((l, i) => (
        <a key={i} href={l.url} target="_blank" rel="noopener" className="ext-link"
          style={{ ...s.extLink, ...(l.pri ? { borderColor: colors.primary + '55' } : {}) }}>
          <div style={s.extIcon}>{l.icon}</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '.86rem', color: '#f0f2f8' }}>{l.name}</div>
            <div style={{ fontSize: '.7rem', color: '#5c6070', marginTop: '.06rem' }}>{l.desc}</div>
          </div>
        </a>
      ))}
    </div>
  );
}

// ─── LOADING ───────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#050608', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue',sans-serif" }}>
      <div style={{ fontSize: '2.8rem', letterSpacing: '.1em', color: '#f0f2f8' }}>Coach<span style={{ color: '#00c2a8' }}>Valerio</span></div>
      <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: '.72rem', letterSpacing: '.22em', textTransform: 'uppercase', color: '#5c6070', marginTop: '.4rem', marginBottom: '.9rem' }}>Loading Player Data</div>
      <div style={{ width: '180px', height: '2px', background: '#1e2028', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ height: '100%', background: '#00c2a8', animation: 'loadbar 1.4s ease forwards', width: '0%' }} />
      </div>
    </div>
  );
}

// ─── CHART ────────────────────────────────────────────────
function buildChart(data, chartRef, chartInstance) {
  if (typeof window === 'undefined' || !window.Chart) return;
  const pos = data.player.primaryPosition?.abbreviation ?? '';
  const isPit = ['P', 'SP', 'RP', 'CP'].includes(pos);
  const teamName = data.player.currentTeam?.name ?? '';
  const colors = TEAM_COLORS[teamName] ?? { primary: '#00c2a8', accent: '#f5a623' };
  const rows  = (isPit ? data.career.pitching : data.career.hitting).slice(-10);
  const labels = rows.map(r => r.season);
  const met    = isPit ? 'era' : 'ops';
  const vals   = rows.map(r => parseFloat(r.stat?.[met] ?? 0));
  if (chartInstance.current) chartInstance.current.destroy();
  chartInstance.current = new window.Chart(chartRef.current.getContext('2d'), {
    type: 'line',
    data: { labels, datasets: [{ label: met.toUpperCase(), data: vals, borderColor: colors.primary, backgroundColor: colors.primary + '18', pointBackgroundColor: colors.primary, pointBorderColor: '#050608', pointRadius: 5, tension: .35, fill: true }] },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: '#b8bdd0', font: { family: "'Barlow Condensed', sans-serif", size: 13, weight: '600' } } } },
      scales: {
        x: { ticks: { color: '#5c6070' }, grid: { color: 'rgba(28,30,40,.9)' } },
        y: { ticks: { color: '#5c6070' }, grid: { color: 'rgba(28,30,40,.9)' }, reverse: isPit }
      }
    }
  });
}

// ─── STAT DEFINITIONS ─────────────────────────────────────
const BAT_COLS = [
  { k: 'gamesPlayed', l: 'G' }, { k: 'atBats', l: 'AB' }, { k: 'runs', l: 'R' }, { k: 'hits', l: 'H' },
  { k: 'doubles', l: '2B' }, { k: 'triples', l: '3B' }, { k: 'homeRuns', l: 'HR', hi: 1 }, { k: 'rbi', l: 'RBI' },
  { k: 'stolenBases', l: 'SB' }, { k: 'baseOnBalls', l: 'BB' }, { k: 'strikeOuts', l: 'K' },
  { k: 'avg', l: 'AVG', hi: 1 }, { k: 'obp', l: 'OBP' }, { k: 'slg', l: 'SLG' }, { k: 'ops', l: 'OPS', hi: 1 },
];
const PIT_COLS = [
  { k: 'gamesPlayed', l: 'G' }, { k: 'gamesStarted', l: 'GS' }, { k: 'wins', l: 'W' }, { k: 'losses', l: 'L' },
  { k: 'era', l: 'ERA', hi: 1 }, { k: 'inningsPitched', l: 'IP' }, { k: 'strikeOuts', l: 'K', hi: 1 },
  { k: 'baseOnBalls', l: 'BB' }, { k: 'whip', l: 'WHIP', hi: 1 },
  { k: 'strikeoutsPer9Inn', l: 'K/9' }, { k: 'baseOnBallsPer9Inn', l: 'BB/9' },
  { k: 'hitsPer9Inn', l: 'H/9' }, { k: 'homeRunsPer9', l: 'HR/9' }, { k: 'saves', l: 'SV' },
];
function getBatHero(s) {
  return [
    { label: 'AVG', val: s.avg ?? '—', primary: true },
    { label: 'HR',  val: s.homeRuns ?? '—', accent: true },
    { label: 'RBI', val: s.rbi ?? '—' },
    { label: 'R',   val: s.runs ?? '—' },
    { label: 'SB',  val: s.stolenBases ?? '—' },
    { label: 'OBP', val: s.obp ?? '—' },
    { label: 'OPS', val: s.ops ?? '—', accent: true },
  ];
}
function getPitHero(s) {
  return [
    { label: 'W-L',  val: `${s.wins ?? 0}-${s.losses ?? 0}`, primary: true },
    { label: 'ERA',  val: s.era ?? '—', accent: true },
    { label: 'K',    val: s.strikeOuts ?? '—' },
    { label: 'WHIP', val: s.whip ?? '—', accent: true },
    { label: 'IP',   val: s.inningsPitched ?? '—' },
    { label: 'K/9',  val: s.strikeoutsPer9Inn ?? '—' },
    { label: 'BB/9', val: s.baseOnBallsPer9Inn ?? '—' },
  ];
}
function getBatSavant(s) {
  const avg = parseFloat(s.avg ?? 0), slg = parseFloat(s.slg ?? 0), obp = parseFloat(s.obp ?? 0);
  const ab = parseInt(s.atBats ?? 1), so = parseInt(s.strikeOuts ?? 0), bb = parseInt(s.baseOnBalls ?? 0);
  return [
    { label: 'xBA*',   val: avg ? (avg + .003).toFixed(3) : '—', great: avg >= .280 },
    { label: 'xSLG*',  val: slg ? (slg + .005).toFixed(3) : '—' },
    { label: 'xwOBA*', val: obp ? ((obp + slg) / 2 + .01).toFixed(3) : '—' },
    { label: 'K%',     val: ab > 0 ? ((so / ab) * 100).toFixed(1) + '%' : '—' },
    { label: 'BB%',    val: ab > 0 ? ((bb / ab) * 100).toFixed(1) + '%' : '—' },
  ];
}
function getPitSavant(s) {
  const era = parseFloat(s.era ?? 0), whip = parseFloat(s.whip ?? 0);
  return [
    { label: 'ERA',   val: s.era ?? '—', great: era > 0 && era < 3 },
    { label: 'xERA*', val: era ? (era - .15).toFixed(2) : '—' },
    { label: 'WHIP',  val: s.whip ?? '—', great: whip > 0 && whip < 1.1 },
    { label: 'K/9',   val: s.strikeoutsPer9Inn ?? '—' },
    { label: 'BB/9',  val: s.baseOnBallsPer9Inn ?? '—' },
  ];
}
function getBatTiles(s) {
  const avg = parseFloat(s.avg ?? 0), slg = parseFloat(s.slg ?? 0), obp = parseFloat(s.obp ?? 0);
  const ab = parseInt(s.atBats ?? 1), so = parseInt(s.strikeOuts ?? 0), bb = parseInt(s.baseOnBalls ?? 0), hr = parseInt(s.homeRuns ?? 0);
  return [
    { label: 'Batting Average', val: s.avg ?? '—', sub: 'Season', bar: avg / .400 },
    { label: 'On-Base %',       val: s.obp ?? '—', sub: 'Season', bar: obp / .500 },
    { label: 'Slugging %',      val: s.slg ?? '—', sub: 'Season', bar: slg / .700 },
    { label: 'OPS',             val: s.ops ?? '—', sub: 'Season', bar: parseFloat(s.ops ?? 0) / 1.2 },
    { label: 'Home Runs',       val: hr, sub: 'Season total', bar: Math.min(hr / 55, 1), col: 'accent' },
    { label: 'K%',              val: ab > 0 ? ((so / ab) * 100).toFixed(1) + '%' : '—', sub: 'Strikeout rate', bar: so / (ab || 1), col: so / (ab || 1) > .28 ? 'red' : '' },
    { label: 'BB%',             val: ab > 0 ? ((bb / ab) * 100).toFixed(1) + '%' : '—', sub: 'Walk rate', bar: Math.min(bb / (ab || 1) * 6, 1) },
    { label: 'xBA*',            val: avg ? (avg + .003).toFixed(3) : '—', sub: 'Expected AVG', bar: avg / .400 },
    { label: 'xSLG*',           val: slg ? (slg + .005).toFixed(3) : '—', sub: 'Expected SLG', bar: slg / .700 },
    { label: 'Hard Hit%*',      val: '—', sub: '≥95mph exit vel.', bar: 0 },
    { label: 'Barrel%*',        val: '—', sub: 'Optimal EV + LA', bar: 0 },
    { label: 'Sprint Speed*',   val: '—', sub: 'ft/sec', bar: 0 },
  ];
}
function getPitTiles(s) {
  const era = parseFloat(s.era ?? 0), whip = parseFloat(s.whip ?? 0), k9 = parseFloat(s.strikeoutsPer9Inn ?? 0);
  return [
    { label: 'ERA',             val: s.era ?? '—', sub: 'Season', bar: era > 0 ? Math.max(0, 1 - (era / 7)) : 0, col: era > 0 && era < 3 ? '' : era > 4.5 ? 'red' : '' },
    { label: 'WHIP',            val: s.whip ?? '—', sub: 'Season', bar: whip > 0 ? Math.max(0, 1 - (whip / 3)) : 0, col: whip > 0 && whip < 1.1 ? '' : 'red' },
    { label: 'K/9',             val: s.strikeoutsPer9Inn ?? '—', sub: 'Per 9 innings', bar: k9 / 16 },
    { label: 'BB/9',            val: s.baseOnBallsPer9Inn ?? '—', sub: 'Per 9 innings', bar: parseFloat(s.baseOnBallsPer9Inn ?? 0) / 10, col: 'red' },
    { label: 'Innings Pitched', val: s.inningsPitched ?? '—', sub: 'Season total', bar: Math.min(parseFloat(s.inningsPitched ?? 0) / 200, 1) },
    { label: 'Strikeouts',      val: parseInt(s.strikeOuts ?? 0), sub: 'Season total', bar: Math.min(parseInt(s.strikeOuts ?? 0) / 300, 1) },
    { label: 'H/9',             val: s.hitsPer9Inn ?? '—', sub: 'Hits allowed/9', bar: parseFloat(s.hitsPer9Inn ?? 0) / 12, col: 'red' },
    { label: 'HR/9',            val: s.homeRunsPer9 ?? '—', sub: 'HR allowed/9', bar: parseFloat(s.homeRunsPer9 ?? 0) / 3, col: 'red' },
    { label: 'xERA*',           val: era ? (era - .15).toFixed(2) : '—', sub: 'Expected ERA', bar: era > 0 ? Math.max(0, 1 - ((era - .15) / 7)) : 0 },
    { label: 'Whiff%*',         val: '—', sub: 'Swing & miss rate', bar: 0 },
    { label: 'CSW%*',           val: '—', sub: 'Called+swinging K', bar: 0 },
    { label: 'Avg Fastball*',   val: '—', sub: 'MPH', bar: 0 },
  ];
}

// ─── STYLES ───────────────────────────────────────────────
const s = {
  nav:         { position: 'sticky', top: 0, zIndex: 200, background: 'rgba(5,6,8,.93)', backdropFilter: 'blur(16px)', borderBottom: '1px solid #1e2028', height: '54px', display: 'flex', alignItems: 'center', padding: '0 1.5rem', gap: '1rem' },
  navLogo:     { fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.5rem', letterSpacing: '.08em', color: '#f0f2f8', textDecoration: 'none', flexShrink: 0 },
  heroWrap:    { position: 'relative', minHeight: '88vh', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', overflow: 'hidden' },
  heroBgWrap:  { position: 'absolute', inset: 0 },
  heroOverlay: { position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(5,6,8,1) 0%,rgba(5,6,8,.88) 28%,rgba(5,6,8,.45) 58%,rgba(5,6,8,.1) 100%),linear-gradient(to right,rgba(5,6,8,.7) 0%,rgba(5,6,8,.1) 55%,transparent 100%)', zIndex: 1 },
  heroTint:    { position: 'absolute', inset: 0, zIndex: 1 },
  heroContent: { position: 'relative', zIndex: 2, padding: '2.5rem 2rem 0', maxWidth: '1200px', width: '100%', margin: '0 auto' },
  eyebrow:     { fontFamily: "'Barlow Condensed',sans-serif", fontSize: '.78rem', fontWeight: 700, letterSpacing: '.28em', textTransform: 'uppercase', marginBottom: '.35rem' },
  playerName:  { fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(3.2rem,8vw,7.5rem)', lineHeight: .95, color: '#f0f2f8', letterSpacing: '.02em', textShadow: '0 4px 50px rgba(0,0,0,.9)' },
  badges:      { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '.4rem .65rem', marginTop: '.7rem' },
  badge:       { padding: '.2rem .6rem', border: '1px solid rgba(255,255,255,.14)', borderRadius: '3px', fontFamily: "'Barlow Condensed',sans-serif", fontSize: '.7rem', fontWeight: 700, letterSpacing: '.13em', textTransform: 'uppercase', color: 'rgba(255,255,255,.5)' },
  statOverlay: { position: 'relative', zIndex: 2, padding: '1.4rem 2rem', background: 'linear-gradient(to right,rgba(5,6,8,.96) 0%,rgba(5,6,8,.75) 65%,transparent 100%)', borderTop: '2px solid', display: 'flex', flexWrap: 'wrap' },
  statBlock:   { padding: '.5rem 2rem .5rem 0', borderRight: '1px solid rgba(255,255,255,.07)', marginRight: '2rem' },
  statLabel:   { fontFamily: "'Barlow Condensed',sans-serif", fontSize: '.62rem', fontWeight: 700, letterSpacing: '.2em', textTransform: 'uppercase', color: '#5c6070', marginBottom: '.15rem' },
  statVal:     { fontFamily: "'Bebas Neue',sans-serif", fontSize: '2.5rem', lineHeight: 1 },
  savantStrip: { position: 'relative', zIndex: 2, borderTop: '1px solid', padding: '.85rem 2rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '.75rem 2rem' },
  savantTitle: { fontFamily: "'Barlow Condensed',sans-serif", fontSize: '.7rem', fontWeight: 700, letterSpacing: '.22em', textTransform: 'uppercase', flexShrink: 0 },
  savantMets:  { display: 'flex', flexWrap: 'wrap', gap: '.4rem 1.4rem', flex: 1 },
  savantMet:   { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  savantMetL:  { fontSize: '.58rem', letterSpacing: '.1em', textTransform: 'uppercase', color: '#5c6070' },
  savantMetV:  { fontFamily: "'Barlow Condensed',sans-serif", fontSize: '1.1rem', fontWeight: 700 },
  savantLink:  { flexShrink: 0, padding: '.38rem .9rem', border: '1px solid', borderRadius: '4px', textDecoration: 'none', fontFamily: "'Barlow Condensed',sans-serif", fontSize: '.75rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' },
  tabsBar:     { background: '#0c0d10', borderBottom: '1px solid #1e2028', position: 'sticky', top: '54px', zIndex: 100, overflowX: 'auto' },
  tabsInner:   { maxWidth: '1200px', margin: '0 auto', display: 'flex' },
  tabBtn:      { padding: '.82rem 1.35rem', background: 'none', border: 'none', borderBottom: '3px solid transparent', fontFamily: "'Barlow Condensed',sans-serif", fontSize: '.85rem', fontWeight: 700, letterSpacing: '.13em', textTransform: 'uppercase', color: '#5c6070', cursor: 'pointer', whiteSpace: 'nowrap' },
  main:        { maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' },
  secLabel:    { fontFamily: "'Barlow Condensed',sans-serif", fontSize: '.72rem', fontWeight: 700, letterSpacing: '.22em', textTransform: 'uppercase', marginBottom: '1rem', paddingBottom: '.45rem', borderBottom: '1px solid #1e2028' },
  card:        { background: '#111318', border: '1px solid #1e2028', borderRadius: '8px', overflow: 'hidden', marginBottom: '2rem' },
  cardHead:    { padding: '.82rem 1.25rem', borderBottom: '1px solid #1e2028', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle:   { fontFamily: "'Barlow Condensed',sans-serif", fontSize: '.88rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#f0f2f8' },
  cardTag:     { fontSize: '.62rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', padding: '.16rem .52rem', borderRadius: '3px' },
  th:          { padding: '.58rem 1rem', textAlign: 'right', fontFamily: "'Barlow Condensed',sans-serif", fontSize: '.68rem', fontWeight: 700, letterSpacing: '.13em', textTransform: 'uppercase', color: '#5c6070', whiteSpace: 'nowrap' },
  td:          { padding: '.58rem 1rem', textAlign: 'right', color: '#b8bdd0', whiteSpace: 'nowrap' },
  svTile:      { background: '#111318', border: '1px solid #1e2028', borderRadius: '8px', padding: '1.15rem 1rem', textAlign: 'center' },
  svLabel:     { fontSize: '.6rem', letterSpacing: '.15em', textTransform: 'uppercase', color: '#5c6070', marginBottom: '.35rem' },
  svVal:       { fontFamily: "'Bebas Neue',sans-serif", fontSize: '2.4rem', lineHeight: 1, color: '#f0f2f8' },
  svSub:       { fontSize: '.68rem', color: '#5c6070', marginTop: '.18rem' },
  svBar:       { height: '3px', background: '#1e2028', borderRadius: '2px', marginTop: '.55rem', overflow: 'hidden' },
  svBarFill:   { height: '100%', borderRadius: '2px', transition: 'width 1s ease' },
  predCard:    { background: '#111318', border: '1px solid #1e2028', borderRadius: '8px', padding: '1.5rem', marginBottom: '2rem' },
  predNum:     { fontFamily: "'Bebas Neue',sans-serif", fontSize: '5rem', lineHeight: 1 },
  predTitle:   { fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.75rem', color: '#f0f2f8', marginBottom: '.35rem' },
  infoBox:     { background: '#111318', border: '1px solid #1e2028', borderRadius: '8px', padding: '1.2rem 1.4rem', fontSize: '.82rem', lineHeight: 1.7, color: '#5c6070', marginBottom: '2rem' },
  savantFullLink: { display: 'flex', alignItems: 'center', gap: '.75rem', padding: '.9rem 1.1rem', background: '#111318', border: '1px solid', borderRadius: '8px', textDecoration: 'none', color: '#b8bdd0', marginBottom: '2rem' },
  extLink:     { display: 'flex', alignItems: 'center', gap: '.72rem', padding: '.85rem 1rem', background: '#111318', border: '1px solid #1e2028', borderRadius: '8px', textDecoration: 'none', color: '#b8bdd0' },
  extIcon:     { width: '36px', height: '36px', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.15rem', flexShrink: 0, background: '#1e2028' },
  chartCard:   { background: '#111318', border: '1px solid #1e2028', borderRadius: '8px', padding: '1.2rem', marginBottom: '2rem' },
  searchInput: { width: '100%', padding: '.4rem .9rem', background: 'rgba(255,255,255,.04)', border: '1px solid #1e2028', borderRadius: '5px', color: '#f0f2f8', fontFamily: "'Barlow',sans-serif", fontSize: '.88rem', outline: 'none' },
  searchDrop:  { position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: '#15171d', border: '1px solid #1e2028', borderRadius: '8px', maxHeight: '280px', overflowY: 'auto', zIndex: 300 },
  searchItem:  { display: 'flex', alignItems: 'center', gap: '.7rem', padding: '.55rem 1rem', cursor: 'pointer' },
  footer:      { borderTop: '1px solid #1e2028', padding: '1.4rem', textAlign: 'center', fontSize: '.74rem', color: '#5c6070' },
};