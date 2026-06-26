// pages/api/accuracy.js
// #6 Prediction accuracy tracker
// GET           → returns season record (wins/losses/pct)
// GET ?grade=1  → grades ungraded predictions vs final scores (call via cron)
// POST          → logs a new prediction { gamePk, gameDate, predicted, confidence }
//
// Env vars needed in Vercel:
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY

import { createClient } from '@supabase/supabase-js';

const supabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  const sb = supabase();

  // ── POST: log a prediction ────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { gamePk, gameDate, predicted, confidence } = req.body ?? {};
    if (!gamePk || !predicted) return res.status(400).json({ error: 'gamePk and predicted required' });

    const { error } = await sb.from('predictions').upsert({
      game_pk: gamePk,
      game_date: gameDate ?? new Date().toISOString().slice(0, 10),
      predicted,
      confidence: confidence ?? null,
    }, { onConflict: 'game_pk' });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  // ── GET ?grade=1: grade ungraded predictions ──────────────────────────────
  if (req.query.grade) {
    const { data: ungraded } = await sb
      .from('predictions')
      .select('*')
      .is('correct', null)
      .lt('game_date', new Date().toISOString().slice(0, 10));

    let graded = 0;
    for (const p of (ungraded ?? [])) {
      try {
        const r = await fetch(`https://statsapi.mlb.com/api/v1.1/game/${p.game_pk}/feed/live`, { signal: AbortSignal.timeout(7000) });
        if (!r.ok) continue;
        const d = await r.json();
        if (d.gameData?.status?.abstractGameState !== 'Final') continue;

        const awayScore = d.liveData?.linescore?.teams?.away?.runs ?? 0;
        const homeScore = d.liveData?.linescore?.teams?.home?.runs ?? 0;
        const winner = homeScore > awayScore
          ? d.gameData?.teams?.home?.abbreviation
          : d.gameData?.teams?.away?.abbreviation;

        await sb.from('predictions').update({
          actual: winner,
          correct: winner === p.predicted,
          graded_at: new Date().toISOString(),
        }).eq('game_pk', p.game_pk);
        graded++;
      } catch {}
    }
    return res.status(200).json({ graded });
  }

  // ── GET: season record ────────────────────────────────────────────────────
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=600');
  const seasonStart = `${new Date().getFullYear()}-01-01`;

  const { data, error } = await sb
    .from('predictions')
    .select('correct')
    .gte('game_date', seasonStart)
    .not('correct', 'is', null);

  if (error) return res.status(500).json({ error: error.message });

  const wins = (data ?? []).filter(p => p.correct).length;
  const total = (data ?? []).length;

  res.status(200).json({
    wins,
    losses: total - wins,
    total,
    pct: total > 0 ? +((wins / total) * 100).toFixed(1) : null,
  });
}