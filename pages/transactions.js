// pages/transactions.js
import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

const TYPE_COLORS = {
  'Trade':        { color: '#00c2a8', bg: 'rgba(0,194,168,.1)'   },
  'Signing':      { color: '#2ed47a', bg: 'rgba(46,212,122,.1)'  },
  'Free Agent':   { color: '#2ed47a', bg: 'rgba(46,212,122,.1)'  },
  'Called Up':    { color: '#f5a623', bg: 'rgba(245,166,35,.1)'  },
  'DFA':          { color: '#e63535', bg: 'rgba(230,53,53,.1)'   },
  'Designation':  { color: '#e63535', bg: 'rgba(230,53,53,.1)'   },
  'Released':     { color: '#e63535', bg: 'rgba(230,53,53,.1)'   },
  'Optioned Down':{ color: '#8b74c4', bg: 'rgba(139,116,196,.1)' },
  'Assignment':   { color: '#8b74c4', bg: 'rgba(139,116,196,.1)' },
  'Outrighted':   { color: '#8b74c4', bg: 'rgba(139,116,196,.1)' },
  'Retired':      { color: '#5c6070', bg: 'rgba(92,96,112,.1)'   },
};
function txStyle(type) {
  return TYPE_COLORS[type] ?? { color: '#5c6070', bg: 'rgba(92,96,112,.1)' };
}

function formatDate(str) {
  if (!str) return '';
  const d = new Date(str + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function Transactions() {
  const router = useRouter();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);
  const [filter, setFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');
  const [teamSearch, setTeamSearch] = useState('');
  const [showTeamPicker, setShowTeamPicker] = useState(false);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    setLoading(true);
    fetch(`/api/transactions?days=${days}`)
      .then(r => r.json())
      .then(d => { setTransactions(d.transactions ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [days]);

  const displayed = transactions.filter(t => {
    const typeMatch = filter === 'all' || t.typeDesc === filter;
    const teamMatch = teamFilter === 'all' || 
      t.fromTeam === teamFilter || 
      t.toTeam === teamFilter ||
      t.person?.stats?.team === teamFilter;
    return typeMatch && teamMatch;
  });

  // Build sorted unique team list from all transactions
  const allTeams = [...new Set([
    ...transactions.map(t => t.fromTeam).filter(Boolean),
    ...transactions.map(t => t.toTeam).filter(Boolean),
  ])].sort();

  const filteredTeams = allTeams.filter(t =>
    t.toLowerCase().includes(teamSearch.toLowerCase())
  );

  const typeOptions = ['all', ...new Set(transactions.map(t => t.typeDesc))].filter(Boolean);

  const toggleExpand = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  return (
    <>
      <Head>
        <title>Transactions — CoachValerio</title>
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@300;400;500;600&family=Barlow+Condensed:wght@400;600;700;900&display=swap" rel="stylesheet" />
        <style>{`
          *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
          body{background:#050608;color:#b8bdd0;font-family:'Barlow',sans-serif;-webkit-font-smoothing:antialiased}
          .tx-row:hover{background:rgba(255,255,255,.02)!important;cursor:pointer}
        `}</style>
      </Head>

      {/* NAV */}
      <nav style={s.nav}>
        <a href="/" style={s.logo}>Coach<span style={{ color: '#00c2a8' }}>Valerio</span></a>
        <div style={s.navLinks}>
          <a href="/" style={s.navLink}>Home</a>
          <a href="/scoreboard" style={s.navLink}>Scoreboard</a>
          <a href="/transactions" style={{ ...s.navLink, color: '#00c2a8' }}>Transactions</a>
          <a href="/compare" style={s.navLink}>Compare</a>
        </div>
      </nav>

      {/* HEADER */}
      <div style={s.header}>
        <div style={s.headerInner}>
          <div>
            <div style={s.pageLabel}>MLB TRANSACTIONS</div>
            <div style={s.pageTitle}>Hot Stove Feed</div>
          </div>
          <div style={s.controls}>
            <span style={s.daysLabel}>Show last:</span>
            {[3, 7, 14, 30].map(d => (
              <button key={d} onClick={() => setDays(d)}
                style={{ ...s.dayBtn, ...(days === d ? s.dayBtnActive : {}) }}>
                {d}d
              </button>
            ))}
          </div>
        </div>

        {/* Type filter tabs */}
        <div style={s.filterScroll}>
          {typeOptions.slice(0, 10).map(t => {
            const ts = txStyle(t);
            const isActive = filter === t;
            return (
              <button key={t} onClick={() => setFilter(t)}
                style={{ ...s.fBtn, ...(isActive ? { borderColor: ts.color, color: ts.color, background: ts.bg } : {}) }}>
                {t === 'all' ? 'All' : t}
              </button>
            );
          })}
        </div>

        {/* Team filter */}
        <div style={{ maxWidth:'1200px', margin:'.5rem auto 0', display:'flex', alignItems:'center', gap:'.75rem', flexWrap:'wrap' }}>
          <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.72rem', fontWeight:700, letterSpacing:'.15em', color:'#5c6070' }}>TEAM:</span>
          <div style={{ position:'relative' }}>
            <button
              onClick={() => setShowTeamPicker(p => !p)}
              style={{ ...s.fBtn, color: teamFilter !== 'all' ? '#00c2a8' : '#5c6070', borderColor: teamFilter !== 'all' ? '#00c2a8' : '#1e2028', minWidth:'180px', display:'flex', justifyContent:'space-between', alignItems:'center', gap:'.5rem' }}>
              <span>{teamFilter === 'all' ? 'All Teams' : teamFilter}</span>
              <span style={{ fontSize:'.6rem' }}>▼</span>
            </button>
            {showTeamPicker && (
              <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, zIndex:200, background:'#111318', border:'1px solid #1e2028', borderRadius:'8px', width:'240px', maxHeight:'300px', overflow:'hidden', display:'flex', flexDirection:'column' }}>
                <div style={{ padding:'.5rem' }}>
                  <input
                    style={{ width:'100%', padding:'.45rem .7rem', background:'rgba(255,255,255,.05)', border:'1px solid #1e2028', borderRadius:'5px', color:'#f0f2f8', fontFamily:"'Barlow',sans-serif", fontSize:'.82rem', outline:'none' }}
                    placeholder="Search teams…"
                    value={teamSearch}
                    onChange={e => setTeamSearch(e.target.value)}
                    autoFocus
                  />
                </div>
                <div style={{ overflowY:'auto', maxHeight:'240px' }}>
                  <div
                    onClick={() => { setTeamFilter('all'); setShowTeamPicker(false); setTeamSearch(''); }}
                    style={{ padding:'.45rem .85rem', cursor:'pointer', fontSize:'.82rem', color: teamFilter === 'all' ? '#00c2a8' : '#b8bdd0', background: teamFilter === 'all' ? 'rgba(0,194,168,.08)' : 'transparent', fontWeight: teamFilter === 'all' ? 700 : 400 }}>
                    All Teams
                  </div>
                  {filteredTeams.map(team => (
                    <div key={team}
                      onClick={() => { setTeamFilter(team); setShowTeamPicker(false); setTeamSearch(''); }}
                      style={{ padding:'.42rem .85rem', cursor:'pointer', fontSize:'.8rem', color: teamFilter === team ? '#00c2a8' : '#b8bdd0', background: teamFilter === team ? 'rgba(0,194,168,.08)' : 'transparent', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#1e2028'}
                      onMouseLeave={e => e.currentTarget.style.background = teamFilter === team ? 'rgba(0,194,168,.08)' : 'transparent'}>
                      {team}
                    </div>
                  ))}
                  {filteredTeams.length === 0 && (
                    <div style={{ padding:'.65rem .85rem', color:'#3a3f52', fontSize:'.78rem' }}>No teams found</div>
                  )}
                </div>
              </div>
            )}
          </div>
          {teamFilter !== 'all' && (
            <button onClick={() => setTeamFilter('all')}
              style={{ background:'none', border:'none', color:'#e63535', fontFamily:"'Barlow Condensed',sans-serif", fontSize:'.72rem', fontWeight:700, cursor:'pointer', letterSpacing:'.08em' }}>
              ✕ Clear Team
            </button>
          )}
        </div>
      </div>

      <div style={s.body}>
        {loading && <div style={s.loading}>Loading transactions…</div>}
        {!loading && displayed.length === 0 && (
          <div style={s.loading}>No transactions found for this period.</div>
        )}

        {!loading && displayed.length > 0 && (
          <div style={s.table}>
            {/* Header */}
            <div style={s.tableHeader}>
              <div style={{ ...s.th, flex: '0 0 80px' }}>DATE</div>
              <div style={{ ...s.th, flex: '0 0 110px' }}>TYPE</div>
              <div style={{ ...s.th, flex: 1 }}>PLAYER / DESCRIPTION</div>
              <div style={{ ...s.th, flex: '0 0 80px', textAlign: 'right' }}>STATS</div>
            </div>

            {displayed.map(tx => {
              const ts    = txStyle(tx.typeDesc);
              const isExp = expanded[tx.id];
              const stats = tx.person?.stats;
              const hit   = stats?.hitting;
              const pit   = stats?.pitching;
              const hasStats = hit || pit;

              return (
                <div key={tx.id} className="tx-row"
                  onClick={() => hasStats && toggleExpand(tx.id)}
                  style={{ ...s.row, background: isExp ? 'rgba(255,255,255,.02)' : 'transparent' }}>
                  {/* Main row */}
                  <div style={s.rowMain}>
                    <div style={{ ...s.td, flex: '0 0 80px' }}>
                      <span style={s.dateText}>{formatDate(tx.date)}</span>
                    </div>

                    <div style={{ ...s.td, flex: '0 0 110px' }}>
                      <span style={{ ...s.typeBadge, color: ts.color, background: ts.bg, borderColor: ts.color }}>
                        {tx.typeDesc}
                      </span>
                    </div>

                    <div style={{ ...s.td, flex: 1, flexDirection: 'column', alignItems: 'flex-start', gap: '.15rem' }}>
                      {tx.person?.name && (
                        <div style={s.playerName}
                          onClick={(e) => { e.stopPropagation(); router.push(`/players/${tx.person.id}`); }}>
                          <img
                            src={`https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_40,q_auto:best/v1/people/${tx.person.id}/headshot/67/current`}
                            alt="" style={s.avatar}
                            onError={e => e.target.style.display = 'none'} />
                          <div>
                            <div style={s.pName}>{tx.person.name}</div>
                            {stats?.position && <div style={s.pPos}>{stats.position}{stats.age ? ` · Age ${stats.age}` : ''}</div>}
                          </div>
                        </div>
                      )}
                      <div style={s.txDesc}>{tx.description}</div>
                      {(tx.fromTeam || tx.toTeam) && (
                        <div style={s.txTeams}>
                          {tx.fromTeam && <span style={s.txFrom}>FROM: {tx.fromTeam}</span>}
                          {tx.fromTeam && tx.toTeam && <span style={{ color: '#3a3f52' }}>→</span>}
                          {tx.toTeam && <span style={s.txTo}>TO: {tx.toTeam}</span>}
                        </div>
                      )}
                    </div>

                    <div style={{ ...s.td, flex: '0 0 80px', justifyContent: 'flex-end' }}>
                      {hasStats && (
                        <span style={s.expandBtn}>{isExp ? '▲' : '▼'} Stats</span>
                      )}
                    </div>
                  </div>

                  {/* Expanded stats */}
                  {isExp && hasStats && (
                    <div style={s.statsExpand}>
                      {hit && (
                        <div style={s.statsGrid}>
                          {[
                            ['G', hit.g], ['AVG', hit.avg], ['HR', hit.hr],
                            ['RBI', hit.rbi], ['OPS', hit.ops], ['SB', hit.sb],
                          ].map(([lbl, val]) => (
                            <div key={lbl} style={s.statCell}>
                              <div style={s.statLbl}>{lbl}</div>
                              <div style={s.statVal}>{val ?? '—'}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {pit && (
                        <div style={s.statsGrid}>
                          {[
                            ['G', pit.g], ['W-L', `${pit.w}-${pit.l}`], ['ERA', pit.era],
                            ['IP', pit.ip], ['K', pit.so], ['WHIP', pit.whip],
                          ].map(([lbl, val]) => (
                            <div key={lbl} style={s.statCell}>
                              <div style={s.statLbl}>{lbl}</div>
                              <div style={s.statVal}>{val ?? '—'}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ textAlign: 'right', marginTop: '.4rem' }}>
                        <span style={s.viewProfile}
                          onClick={(e) => { e.stopPropagation(); router.push(`/players/${tx.person.id}`); }}>
                          Full Player Profile →
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <footer style={s.footer}>
        Transactions via <a href="https://statsapi.mlb.com" style={{ color: '#5c6070' }}>MLB Stats API</a> ·
        CoachValerio.com
      </footer>
    </>
  );
}

const s = {
  nav:          { position:'sticky',top:0,zIndex:200,background:'rgba(5,6,8,.93)',backdropFilter:'blur(16px)',borderBottom:'1px solid #1e2028',height:'54px',display:'flex',alignItems:'center',padding:'0 1.5rem',gap:'1rem' },
  logo:         { fontFamily:"'Bebas Neue',sans-serif",fontSize:'1.5rem',letterSpacing:'.08em',color:'#f0f2f8',textDecoration:'none',flexShrink:0 },
  navLinks:     { display:'flex',gap:'1.5rem',marginLeft:'auto' },
  navLink:      { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.82rem',fontWeight:700,letterSpacing:'.12em',textTransform:'uppercase',color:'#5c6070',textDecoration:'none' },
  header:       { background:'#0a0b0f',borderBottom:'1px solid #1e2028',padding:'1.5rem 1.5rem .75rem' },
  headerInner:  { maxWidth:'1200px',margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'1rem',marginBottom:'1rem' },
  pageLabel:    { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.72rem',fontWeight:700,letterSpacing:'.25em',color:'#00c2a8' },
  pageTitle:    { fontFamily:"'Bebas Neue',sans-serif",fontSize:'2.2rem',letterSpacing:'.05em',color:'#f0f2f8' },
  controls:     { display:'flex',gap:'.5rem',alignItems:'center' },
  daysLabel:    { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.75rem',fontWeight:700,letterSpacing:'.1em',color:'#5c6070' },
  dayBtn:       { padding:'.3rem .65rem',background:'transparent',border:'1px solid #1e2028',borderRadius:'4px',fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.78rem',fontWeight:700,color:'#5c6070',cursor:'pointer' },
  dayBtnActive: { borderColor:'#00c2a8',color:'#00c2a8',background:'rgba(0,194,168,.08)' },
  filterScroll: { maxWidth:'1200px',margin:'0 auto',display:'flex',gap:'.4rem',flexWrap:'wrap',paddingBottom:'.25rem' },
  fBtn:         { padding:'.28rem .75rem',background:'transparent',border:'1px solid #1e2028',borderRadius:'4px',fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.72rem',fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',color:'#5c6070',cursor:'pointer',transition:'all .15s' },
  body:         { maxWidth:'1200px',margin:'0 auto',padding:'1.5rem' },
  loading:      { textAlign:'center',color:'#5c6070',padding:'3rem',fontSize:'.9rem' },
  table:        { background:'#111318',border:'1px solid #1e2028',borderRadius:'10px',overflow:'hidden' },
  tableHeader:  { display:'flex',padding:'.5rem 1rem',borderBottom:'1px solid #1e2028',background:'#0a0b0f' },
  th:           { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.65rem',fontWeight:700,letterSpacing:'.15em',color:'#3a3f52',textTransform:'uppercase' },
  row:          { borderBottom:'1px solid #1e2028',transition:'background .15s' },
  rowMain:      { display:'flex',alignItems:'center',padding:'.65rem 1rem',gap:'.75rem' },
  td:           { display:'flex',alignItems:'center',fontSize:'.84rem',color:'#b8bdd0' },
  dateText:     { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.75rem',color:'#5c6070',whiteSpace:'nowrap' },
  typeBadge:    { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.68rem',fontWeight:700,letterSpacing:'.08em',border:'1px solid',borderRadius:'4px',padding:'.18rem .45rem',whiteSpace:'nowrap' },
  playerName:   { display:'flex',alignItems:'center',gap:'.5rem',cursor:'pointer' },
  avatar:       { width:'28px',height:'28px',borderRadius:'50%',objectFit:'cover',background:'#1e2028',flexShrink:0 },
  pName:        { fontWeight:600,fontSize:'.86rem',color:'#f0f2f8' },
  pPos:         { fontSize:'.68rem',color:'#5c6070' },
  txDesc:       { fontSize:'.75rem',color:'#5c6070',lineHeight:1.4 },
  txTeams:      { display:'flex',gap:'.35rem',alignItems:'center',fontSize:'.7rem' },
  txFrom:       { color:'#e63535' },
  txTo:         { color:'#2ed47a' },
  expandBtn:    { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.68rem',fontWeight:700,letterSpacing:'.05em',color:'#3a3f52',whiteSpace:'nowrap',cursor:'pointer' },
  statsExpand:  { padding:'.65rem 1rem .85rem',borderTop:'1px solid #1e2028',background:'rgba(0,0,0,.2)' },
  statsGrid:    { display:'flex',gap:'1rem',flexWrap:'wrap',marginBottom:'.35rem' },
  statCell:     { textAlign:'center',minWidth:'42px' },
  statLbl:      { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.62rem',fontWeight:700,letterSpacing:'.12em',color:'#3a3f52',marginBottom:'.1rem' },
  statVal:      { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'1rem',fontWeight:700,color:'#f0f2f8' },
  viewProfile:  { fontFamily:"'Barlow Condensed',sans-serif",fontSize:'.72rem',fontWeight:700,letterSpacing:'.1em',color:'#00c2a8',cursor:'pointer' },
  footer:       { borderTop:'1px solid #1e2028',padding:'1.4rem',textAlign:'center',fontSize:'.74rem',color:'#5c6070' },
};