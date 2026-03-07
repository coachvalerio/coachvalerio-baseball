// pages/teams/[id].js

import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

const TEAM_COLORS = {
  110:'#DF4601', 111:'#BD3039', 147:'#003087', 139:'#8FBCE6', 141:'#134A8E',
  145:'#C4CED4', 114:'#E31937', 116:'#FA4616', 118:'#004687', 142:'#D31145',
  117:'#EB6E1F', 108:'#BA0021', 133:'#EFB21E', 136:'#005C5C', 140:'#C0111F',
  144:'#CE1141', 146:'#00A3E0', 121:'#FF5910', 143:'#E81828', 120:'#AB0003',
  112:'#0E3386', 113:'#C6011F', 158:'#FFC52F', 134:'#FDB827', 138:'#C41E3A',
  109:'#A71930', 115:'#8B74C4', 119:'#005A9C', 135:'#FFC425', 137:'#FD5A1E',
};

function getCurrentSeason() {
  const now = new Date();
  return now >= new Date(now.getFullYear(), 2, 20) ? now.getFullYear() : now.getFullYear() - 1;
}

function recFmt(rec) {
  if (!rec) return '—';
  return `${rec.wins ?? 0}-${rec.losses ?? 0}`;
}

function pct(w, l) {
  const t = (w ?? 0) + (l ?? 0);
  return t > 0 ? (w / t).toFixed(3) : '.000';
}

function StatBox({ label, value, sub, color }) {
  return (
    <div style={s.statBox}>
      <div style={{ ...s.statVal, color: color ?? '#f0f2f8' }}>{value ?? '—'}</div>
      <div style={s.statLabel}>{label}</div>
      {sub && <div style={s.statSub}>{sub}</div>}
    </div>
  );
}

function SplitRow({ label, rec }) {
  if (!rec) return null;
  const w = rec.wins ?? 0, l = rec.losses ?? 0;
  const winPct = parseFloat(pct(w, l));
  const barColor = winPct >= .550 ? '#00c2a8' : winPct >= .500 ? '#2ed47a' : winPct >= .450 ? '#f5a623' : '#e63535';
  return (
    <div style={s.splitRow}>
      <div style={s.splitLabel}>{label}</div>
      <div style={s.splitBar}>
        <div style={{ width: `${winPct * 100}%`, background: barColor, height: '100%', borderRadius: '3px', transition: 'width .4s' }} />
      </div>
      <div style={{ ...s.splitRecord, color: barColor }}>{w}-{l}</div>
      <div style={s.splitPct}>{pct(w, l)}</div>
    </div>
  );
}

export default function TeamPage() {
  const router  = useRouter();
  const { id }  = router.query;
  const isReady = router.isReady;
  const SEASON  = getCurrentSeason();

  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState('roster');    // roster | hitting | pitching | splits | news
  const [rosterTab, setRosterTab] = useState('batters'); // batters | pitchers
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    if (!isReady || !id) return;
    setLoading(true);
    fetch(`/api/team?id=${id}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(err => { setData({ error: err.message }); setLoading(false); });
  }, [isReady, id]);

  if (loading) return (
    <div style={{ background:'#050608', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:'#5c6070', fontFamily:"'Barlow',sans-serif" }}>
      Loading team data…
    </div>
  );

  if (!data?.team) return (
    <div style={{ background:'#050608', minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'#5c6070', fontFamily:"'Barlow',sans-serif", gap:'1rem' }}>
      <div style={{ fontSize:'1.1rem' }}>Team not found.</div>
      {data?.error && <div style={{ fontSize:'.8rem', color:'#e63535', maxWidth:'500px', textAlign:'center' }}>{data.error}</div>}
      <a href="/teams" style={{ color:'#00c2a8', fontSize:'.85rem' }}>← Back to all teams</a>
    </div>
  );

  const { team, standing, roster, batting, pitching, transactions, season } = data;
  const color  = TEAM_COLORS[parseInt(id)] ?? '#00c2a8';
  const colorA = color + '22';

  // Sort roster
  const batters  = roster.filter(p => !['SP','RP','CP'].includes(p.pos));
  const pitchers = roster.filter(p => ['SP','RP','CP'].includes(p.pos));

  function sortedRoster(list, statGroup) {
    if (!sortKey) return list;
    return [...list].sort((a, b) => {
      const av = parseFloat(a[statGroup]?.[sortKey] ?? (sortDir === 'desc' ? -Infinity : Infinity));
      const bv = parseFloat(b[statGroup]?.[sortKey] ?? (sortDir === 'desc' ? -Infinity : Infinity));
      return sortDir === 'desc' ? bv - av : av - bv;
    });
  }

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  const SortTh = ({ label, k, style }) => (
    <th style={{ ...s.th, cursor: 'pointer', color: sortKey === k ? color : '#5c6070', ...style }}
      onClick={() => toggleSort(k)}>
      {label}{sortKey === k ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
    </th>
  );

  const tabs = [
    { id: 'roster',   label: '📋 Roster'    },
    { id: 'hitting',  label: '🏏 Hitting'   },
    { id: 'pitching', label: '⚾ Pitching'  },
    { id: 'splits',   label: '📊 Splits'    },
    { id: 'news',     label: '📰 News'      },
  ];

  const runDiff = standing?.runDiff ?? 0;
  const rdColor = runDiff > 0 ? '#2ed47a' : runDiff < 0 ? '#e63535' : '#5c6070';

  return (
    <>
      <Head>
        <title>{team.name} — CoachValerio</title>
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@300;400;500;600&family=Barlow+Condensed:wght@400;600;700;900&display=swap" rel="stylesheet" />
        <style>{`
          *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
          body{background:#050608;color:#b8bdd0;font-family:'Barlow',sans-serif;-webkit-font-smoothing:antialiased}
          table{border-collapse:collapse;width:100%}
          .roster-row:hover{background:rgba(255,255,255,.03)!important;cursor:pointer}
          .tab-btn:hover{color:#f0f2f8!important}
        `}</style>
      </Head>

      {/* NAV */}
      <nav style={s.nav}>
        <a href="/" style={s.logo}>Coach<span style={{ color: '#00c2a8' }}>Valerio</span></a>
        <div style={s.navLinks}>
          <a href="/" style={s.navLink}>Home</a>
          <a href="/scoreboard" style={s.navLink}>Scoreboard</a>
          <a href="/teams" style={{ ...s.navLink, color: '#00c2a8' }}>Teams</a>
          <a href="/transactions" style={s.navLink}>Transactions</a>
          <a href="/compare" style={s.navLink}>Compare</a>
        </div>
      </nav>

      {/* TEAM HERO */}
      <div style={{ ...s.hero, background: `linear-gradient(135deg, #050608 0%, ${color}18 50%, #050608 100%)` }}>
        <div style={s.heroBg} />
        <div style={s.heroContent}>
          <div style={s.breadcrumb}>
            <a href="/teams" style={{ color: '#5c6070', textDecoration: 'none' }}>Teams</a>
            <span style={{ color: '#3a3f52' }}> / </span>
            <span style={{ color }}>{team.division}</span>
          </div>
          <div style={s.heroRow}>
            <img src={`https://www.mlbstatic.com/team-logos/${id}.svg`} alt={team.name}
              style={s.heroLogo} onError={e => e.target.style.display = 'none'} />
            <div>
              <div style={{ ...s.heroName, color }}>{team.name}</div>
              <div style={s.heroMeta}>{team.venue} · Est. {team.founded} · {team.league}</div>
            </div>
          </div>

          {/* Quick record bar */}
          {standing && (
            <div style={s.recordBar}>
              <div style={s.recordChip}>
                <span style={{ ...s.recordBig, color }}>{standing.wins}-{standing.losses}</span>
                <span style={s.recordSub}>Record</span>
              </div>
              <div style={s.recordDivider} />
              <div style={s.recordChip}>
                <span style={s.recordBig}>{standing.pct}</span>
                <span style={s.recordSub}>Win %</span>
              </div>
              <div style={s.recordDivider} />
              <div style={s.recordChip}>
                <span style={{ ...s.recordBig, color: rdColor }}>
                  {runDiff > 0 ? '+' : ''}{runDiff}
                </span>
                <span style={s.recordSub}>Run Diff</span>
              </div>
              <div style={s.recordDivider} />
              <div style={s.recordChip}>
                <span style={s.recordBig}>{standing.divRank}</span>
                <span style={s.recordSub}>{standing.divName?.replace('Division', 'Div')}</span>
              </div>
              <div style={s.recordDivider} />
              <div style={s.recordChip}>
                <span style={s.recordBig}>{standing.gb === '0' || !standing.gb ? '—' : standing.gb}</span>
                <span style={s.recordSub}>GB</span>
              </div>
              <div style={s.recordDivider} />
              <div style={s.recordChip}>
                <span style={{ ...s.recordBig, color: standing.streak?.startsWith('W') ? '#2ed47a' : '#e63535' }}>
                  {standing.streak}
                </span>
                <span style={s.recordSub}>Streak</span>
              </div>
              <div style={s.recordDivider} />
              <div style={s.recordChip}>
                <span style={s.recordBig}>{standing.last10 ?? '—'}</span>
                <span style={s.recordSub}>Last 10</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* TAB BAR */}
      <div style={s.tabBar}>
        <div style={s.tabInner}>
          {tabs.map(t => (
            <button key={t.id} className="tab-btn"
              onClick={() => setTab(t.id)}
              style={{ ...s.tabBtn, ...(tab === t.id ? { ...s.tabActive, borderBottomColor: color, color } : {}) }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* BODY */}
      <div style={s.body}>

        {/* ── ROSTER TAB ── */}
        {tab === 'roster' && (
          <div>
            <div style={s.subTabs}>
              {[['batters',`Position Players (${batters.length})`],['pitchers',`Pitchers (${pitchers.length})`]].map(([v,lbl]) => (
                <button key={v} onClick={() => { setRosterTab(v); setSortKey(null); }}
                  style={{ ...s.subBtn, ...(rosterTab === v ? { ...s.subBtnActive, borderColor: color, color } : {}) }}>
                  {lbl}
                </button>
              ))}
            </div>

            {rosterTab === 'batters' && (
              <div style={s.tableWrap}>
                <table>
                  <thead>
                    <tr style={{ borderBottom: `1px solid #1e2028` }}>
                      <th style={s.th}>#</th>
                      <th style={{ ...s.th, textAlign: 'left' }}>PLAYER</th>
                      <th style={s.th}>POS</th>
                      <SortTh label="G"   k="g"   />
                      <SortTh label="AVG" k="avg" />
                      <SortTh label="HR"  k="hr"  />
                      <SortTh label="RBI" k="rbi" />
                      <SortTh label="OPS" k="ops" />
                      <SortTh label="SB"  k="sb"  />
                      <SortTh label="H"   k="h"   />
                      <SortTh label="BB"  k="bb"  />
                      <SortTh label="K"   k="k"   />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRoster(batters, 'hitting').map(p => (
                      <tr key={p.id} className="roster-row"
                        onClick={() => router.push(`/players/${p.id}`)}
                        style={{ borderBottom: '1px solid #0f1018' }}>
                        <td style={{ ...s.td, color: '#3a3f52', fontSize: '.78rem' }}>{p.number}</td>
                        <td style={{ ...s.td, textAlign: 'left' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                            <img src={`https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_40,q_auto:best/v1/people/${p.id}/headshot/67/current`}
                              alt="" style={s.avatar} onError={e => e.target.style.display = 'none'} />
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '.86rem', color: '#f0f2f8' }}>{p.name}</div>
                              {p.status !== 'Active' && <div style={{ fontSize: '.62rem', color: '#e63535' }}>{p.status}</div>}
                            </div>
                          </div>
                        </td>
                        <td style={{ ...s.td, color }}>{p.pos}</td>
                        <td style={s.td}>{p.hitting?.g ?? '—'}</td>
                        <td style={{ ...s.td, color: parseFloat(p.hitting?.avg) >= .280 ? '#2ed47a' : '#b8bdd0' }}>{p.hitting?.avg ?? '—'}</td>
                        <td style={s.td}>{p.hitting?.hr ?? '—'}</td>
                        <td style={s.td}>{p.hitting?.rbi ?? '—'}</td>
                        <td style={{ ...s.td, color: parseFloat(p.hitting?.ops) >= .850 ? '#2ed47a' : '#b8bdd0' }}>{p.hitting?.ops ?? '—'}</td>
                        <td style={s.td}>{p.hitting?.sb ?? '—'}</td>
                        <td style={s.td}>{p.hitting?.h ?? '—'}</td>
                        <td style={s.td}>{p.hitting?.bb ?? '—'}</td>
                        <td style={s.td}>{p.hitting?.k ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {rosterTab === 'pitchers' && (
              <div style={s.tableWrap}>
                <table>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1e2028' }}>
                      <th style={s.th}>#</th>
                      <th style={{ ...s.th, textAlign: 'left' }}>PLAYER</th>
                      <th style={s.th}>POS</th>
                      <SortTh label="G"    k="g"    />
                      <SortTh label="W"    k="w"    />
                      <SortTh label="L"    k="l"    />
                      <SortTh label="ERA"  k="era"  />
                      <SortTh label="IP"   k="ip"   />
                      <SortTh label="K"    k="so"   />
                      <SortTh label="BB"   k="bb"   />
                      <SortTh label="WHIP" k="whip" />
                      <SortTh label="SV"   k="sv"   />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRoster(pitchers, 'pitching').map(p => (
                      <tr key={p.id} className="roster-row"
                        onClick={() => router.push(`/players/${p.id}`)}
                        style={{ borderBottom: '1px solid #0f1018' }}>
                        <td style={{ ...s.td, color: '#3a3f52', fontSize: '.78rem' }}>{p.number}</td>
                        <td style={{ ...s.td, textAlign: 'left' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                            <img src={`https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_40,q_auto:best/v1/people/${p.id}/headshot/67/current`}
                              alt="" style={s.avatar} onError={e => e.target.style.display = 'none'} />
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '.86rem', color: '#f0f2f8' }}>{p.name}</div>
                              {p.status !== 'Active' && <div style={{ fontSize: '.62rem', color: '#e63535' }}>{p.status}</div>}
                            </div>
                          </div>
                        </td>
                        <td style={{ ...s.td, color }}>{p.pos}</td>
                        <td style={s.td}>{p.pitching?.g ?? '—'}</td>
                        <td style={s.td}>{p.pitching?.w ?? '—'}</td>
                        <td style={s.td}>{p.pitching?.l ?? '—'}</td>
                        <td style={{ ...s.td, color: parseFloat(p.pitching?.era) <= 3.00 ? '#2ed47a' : parseFloat(p.pitching?.era) <= 4.00 ? '#f5a623' : '#e63535' }}>{p.pitching?.era ?? '—'}</td>
                        <td style={s.td}>{p.pitching?.ip ?? '—'}</td>
                        <td style={s.td}>{p.pitching?.so ?? '—'}</td>
                        <td style={s.td}>{p.pitching?.bb ?? '—'}</td>
                        <td style={{ ...s.td, color: parseFloat(p.pitching?.whip) <= 1.10 ? '#2ed47a' : '#b8bdd0' }}>{p.pitching?.whip ?? '—'}</td>
                        <td style={s.td}>{p.pitching?.sv ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── HITTING TAB ── */}
        {tab === 'hitting' && (
          <div>
            <div style={s.secLabel}>TEAM BATTING — {season}</div>
            <div style={s.statGrid}>
              <StatBox label="Batting AVG"  value={batting.avg}          color={color} />
              <StatBox label="OBP"          value={batting.obp}          />
              <StatBox label="Slugging"     value={batting.slg}          />
              <StatBox label="OPS"          value={batting.ops}          color={parseFloat(batting.ops) >= .750 ? '#2ed47a' : undefined} />
              <StatBox label="Home Runs"    value={batting.homeRuns}     color={color} />
              <StatBox label="RBI"          value={batting.rbi}          />
              <StatBox label="Runs Scored"  value={batting.runs}         />
              <StatBox label="Hits"         value={batting.hits}         />
              <StatBox label="Doubles"      value={batting.doubles}      />
              <StatBox label="Triples"      value={batting.triples}      />
              <StatBox label="Stolen Bases" value={batting.stolenBases}  />
              <StatBox label="Walks"        value={batting.baseOnBalls}  />
              <StatBox label="Strikeouts"   value={batting.strikeOuts}   />
              <StatBox label="Games Played" value={batting.gamesPlayed}  />
            </div>
          </div>
        )}

        {/* ── PITCHING TAB ── */}
        {tab === 'pitching' && (
          <div>
            <div style={s.secLabel}>TEAM PITCHING — {season}</div>
            <div style={s.statGrid}>
              <StatBox label="ERA"          value={pitching.era}              color={parseFloat(pitching.era) <= 3.80 ? '#2ed47a' : color} />
              <StatBox label="WHIP"         value={pitching.whip}             />
              <StatBox label="K/9"          value={pitching.strikeoutsPer9Inn}color={color} />
              <StatBox label="BB/9"         value={pitching.walksPer9Inn}     />
              <StatBox label="H/9"          value={pitching.hitsPer9Inn}      />
              <StatBox label="HR/9"         value={pitching.homeRunsPer9}     />
              <StatBox label="Strikeouts"   value={pitching.strikeOuts}       />
              <StatBox label="Walks"        value={pitching.baseOnBalls}      />
              <StatBox label="Saves"        value={pitching.saves}            />
              <StatBox label="Holds"        value={pitching.holds}            />
              <StatBox label="Innings Pitched" value={pitching.inningsPitched}/>
              <StatBox label="Runs Allowed" value={pitching.runs}             />
              <StatBox label="Earned Runs"  value={pitching.earnedRuns}       />
              <StatBox label="Complete Games" value={pitching.completeGames}  />
            </div>
          </div>
        )}

        {/* ── SPLITS TAB ── */}
        {tab === 'splits' && standing && (
          <div>
            <div style={s.secLabel}>WIN/LOSS SPLITS — {season}</div>
            <div style={s.splitsGrid}>
              <div style={s.splitsCard}>
                <div style={s.splitsCardTitle}>BY LOCATION</div>
                <SplitRow label="Home"  rec={standing.homeRecord} />
                <SplitRow label="Away"  rec={standing.awayRecord} />
              </div>
              <div style={s.splitsCard}>
                <div style={s.splitsCardTitle}>BY OPPONENT STARTER</div>
                <SplitRow label="vs LHP" rec={standing.vsLeft} />
                <SplitRow label="vs RHP" rec={standing.vsRight} />
              </div>
              <div style={s.splitsCard}>
                <div style={s.splitsCardTitle}>BY TIME OF DAY</div>
                <SplitRow label="Day Games"   rec={standing.day} />
                <SplitRow label="Night Games" rec={standing.night} />
              </div>
              <div style={s.splitsCard}>
                <div style={s.splitsCardTitle}>BY SURFACE</div>
                <SplitRow label="Grass" rec={standing.grass} />
                <SplitRow label="Turf"  rec={standing.turf} />
              </div>
            </div>

            {/* Run differential breakdown */}
            <div style={{ ...s.secLabel, marginTop: '2rem' }}>RUN DIFFERENTIAL</div>
            <div style={s.statGrid}>
              <StatBox label="Runs Scored"  value={standing.runsScored}  color="#2ed47a" />
              <StatBox label="Runs Allowed" value={standing.runsAllowed} color="#e63535" />
              <StatBox label="Run Diff"     value={(runDiff > 0 ? '+' : '') + runDiff} color={rdColor} />
              <StatBox label="Runs/Game"    value={standing.runsScored && standing.wins != null ? ((standing.runsScored / Math.max(1, standing.wins + standing.losses)).toFixed(2)) : '—'} />
            </div>
          </div>
        )}

        {/* ── NEWS / TRANSACTIONS TAB ── */}
        {tab === 'news' && (
          <div>
            <div style={s.secLabel}>RECENT TRANSACTIONS & MOVES</div>
            {transactions.length === 0 && (
              <div style={{ color: '#5c6070', padding: '2rem', textAlign: 'center' }}>No recent transactions found.</div>
            )}
            <div style={s.txList}>
              {transactions.map((t, i) => (
                <div key={i} style={s.txRow}>
                  <div style={{ ...s.txType, color: txColor(t.type), borderColor: txColor(t.type) }}>{t.type}</div>
                  <div style={{ flex: 1 }}>
                    {t.player && <span style={{ fontWeight: 600, color: '#f0f2f8', marginRight: '.4rem' }}>{t.player}</span>}
                    <span style={{ color: '#b8bdd0', fontSize: '.84rem' }}>{t.desc}</span>
                  </div>
                  <div style={s.txDate}>{t.date ? new Date(t.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      <footer style={s.footer}>
        Data via <a href="https://statsapi.mlb.com" style={{ color: '#5c6070' }}>MLB Stats API</a> · CoachValerio.com
      </footer>
    </>
  );
}

function txColor(type) {
  if (!type) return '#5c6070';
  if (/trade/i.test(type))              return '#00c2a8';
  if (/sign|free agent/i.test(type))    return '#2ed47a';
  if (/DFA|designat/i.test(type))       return '#e63535';
  if (/call.?up|select/i.test(type))    return '#f5a623';
  if (/option|assign/i.test(type))      return '#8b74c4';
  return '#5c6070';
}

const s = {
  nav:            { position:'sticky',top:0,zIndex:200,background:'rgba(5,6,8,.93)',backdropFilter:'blur(16px)',borderBottom:'1px solid #1e2028',height:'54px',display:'flex',alignItems:'center',padding:'0 1.5rem',gap:'1rem' },
  logo:           { fontFamily:"'Bebas Neue',sans-serif",fontSize:'1.5rem',letterSpacing:'.08em',color:'#f0f2f8',textDecoration:'none',flexShrink:0 },
  navLinks:       { display:'flex',gap:'1.5rem',marginLeft:'auto' },
  navLink:        { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.82rem',fontWeight:700,letterSpacing:'.12em',textTransform:'uppercase',color:'#5c6070',textDecoration:'none' },
  hero:           { position:'relative',padding:'2.5rem 1.5rem 2rem',overflow:'hidden' },
  heroBg:         { position:'absolute',inset:0,backgroundImage:'radial-gradient(ellipse at 50% 0%, rgba(0,0,0,.4) 0%, transparent 70%)',pointerEvents:'none' },
  heroContent:    { position:'relative',zIndex:1,maxWidth:'1200px',margin:'0 auto' },
  breadcrumb:     { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.72rem',fontWeight:700,letterSpacing:'.15em',marginBottom:'.75rem' },
  heroRow:        { display:'flex',alignItems:'center',gap:'1.25rem',marginBottom:'1.5rem' },
  heroLogo:       { width:'72px',height:'72px',objectFit:'contain',filter:'drop-shadow(0 2px 8px rgba(0,0,0,.5))' },
  heroName:       { fontFamily:"'Bebas Neue',sans-serif",fontSize:'clamp(2rem,5vw,3.5rem)',letterSpacing:'.05em',lineHeight:1 },
  heroMeta:       { fontSize:'.82rem',color:'#5c6070',marginTop:'.25rem' },
  recordBar:      { display:'flex',alignItems:'center',gap:0,background:'rgba(0,0,0,.3)',border:'1px solid #1e2028',borderRadius:'10px',padding:'.75rem 1.25rem',flexWrap:'wrap',gap:'0' },
  recordChip:     { display:'flex',flexDirection:'column',alignItems:'center',padding:'0 1.25rem',flex:'0 0 auto' },
  recordBig:      { fontFamily:"'Bebas Neue',sans-serif",fontSize:'1.5rem',letterSpacing:'.05em',lineHeight:1 },
  recordSub:      { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.62rem',fontWeight:700,letterSpacing:'.15em',color:'#3a3f52',marginTop:'.1rem' },
  recordDivider:  { width:'1px',height:'40px',background:'#1e2028',margin:'0 .25rem' },
  tabBar:         { borderBottom:'1px solid #1e2028',background:'#0a0b0f',position:'sticky',top:'54px',zIndex:100 },
  tabInner:       { maxWidth:'1200px',margin:'0 auto',display:'flex',overflowX:'auto',padding:'0 1.5rem' },
  tabBtn:         { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.8rem',fontWeight:700,letterSpacing:'.1em',padding:'.85rem 1.25rem',background:'none',border:'none',borderBottom:'2px solid transparent',color:'#5c6070',cursor:'pointer',whiteSpace:'nowrap',transition:'color .15s' },
  tabActive:      { borderBottomWidth:'2px',borderBottomStyle:'solid' },
  body:           { maxWidth:'1200px',margin:'0 auto',padding:'1.5rem' },
  secLabel:       { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.72rem',fontWeight:700,letterSpacing:'.22em',color:'#00c2a8',marginBottom:'1.25rem',paddingBottom:'.5rem',borderBottom:'1px solid #1e2028' },
  subTabs:        { display:'flex',gap:'.5rem',marginBottom:'1.25rem',flexWrap:'wrap' },
  subBtn:         { padding:'.35rem .85rem',background:'transparent',border:'1px solid #1e2028',borderRadius:'4px',fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.75rem',fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:'#5c6070',cursor:'pointer' },
  subBtnActive:   { background:'rgba(0,194,168,.05)' },
  tableWrap:      { background:'#111318',border:'1px solid #1e2028',borderRadius:'10px',overflow:'auto' },
  th:             { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.65rem',fontWeight:700,letterSpacing:'.13em',color:'#5c6070',padding:'.6rem .85rem',textAlign:'center',whiteSpace:'nowrap',background:'#0a0b0f' },
  td:             { padding:'.6rem .85rem',textAlign:'center',fontSize:'.84rem',color:'#b8bdd0',whiteSpace:'nowrap' },
  avatar:         { width:'28px',height:'28px',borderRadius:'50%',objectFit:'cover',background:'#1e2028',flexShrink:0 },
  statGrid:       { display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',gap:'.75rem' },
  statBox:        { background:'#111318',border:'1px solid #1e2028',borderRadius:'8px',padding:'.85rem 1rem',textAlign:'center' },
  statVal:        { fontFamily:"'Bebas Neue',sans-serif",fontSize:'1.6rem',letterSpacing:'.04em',lineHeight:1 },
  statLabel:      { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.65rem',fontWeight:700,letterSpacing:'.15em',color:'#5c6070',marginTop:'.2rem' },
  statSub:        { fontSize:'.68rem',color:'#3a3f52',marginTop:'.1rem' },
  splitsGrid:     { display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:'1rem' },
  splitsCard:     { background:'#111318',border:'1px solid #1e2028',borderRadius:'8px',padding:'1rem 1.25rem' },
  splitsCardTitle:{ fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.68rem',fontWeight:700,letterSpacing:'.2em',color:'#3a3f52',marginBottom:'.85rem' },
  splitRow:       { display:'flex',alignItems:'center',gap:'.6rem',marginBottom:'.55rem' },
  splitLabel:     { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.75rem',fontWeight:700,letterSpacing:'.08em',color:'#b8bdd0',minWidth:'60px' },
  splitBar:       { flex:1,height:'6px',background:'#1e2028',borderRadius:'3px',overflow:'hidden' },
  splitRecord:    { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.78rem',fontWeight:700,minWidth:'42px',textAlign:'right' },
  splitPct:       { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.7rem',color:'#5c6070',minWidth:'36px',textAlign:'right' },
  txList:         { display:'flex',flexDirection:'column',gap:'.5rem' },
  txRow:          { display:'flex',alignItems:'flex-start',gap:'.75rem',padding:'.75rem 1rem',background:'#111318',border:'1px solid #1e2028',borderRadius:'8px',flexWrap:'wrap' },
  txType:         { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.68rem',fontWeight:700,letterSpacing:'.08em',border:'1px solid',borderRadius:'4px',padding:'.15rem .45rem',whiteSpace:'nowrap',flexShrink:0 },
  txDate:         { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.72rem',color:'#3a3f52',flexShrink:0 },
  footer:         { borderTop:'1px solid #1e2028',padding:'1.4rem',textAlign:'center',fontSize:'.74rem',color:'#5c6070',marginTop:'3rem' },
};