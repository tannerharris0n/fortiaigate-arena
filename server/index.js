import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { nanoid } from 'nanoid';
import { SCENARIOS, LEVELS, getScenario, publicScenario } from './scenarios/index.js';
import { runAttack } from './lib/engine.js';
import { availableProviders, pickProvider } from './lib/llm.js';
import { GUARD_MODE, SIGNATURE_CATALOG, signatureScan } from './lib/guard.js';
import * as db from './lib/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '256kb' }));
app.disable('x-powered-by');

const EVENT = process.env.EVENT_CODE || 'default';
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const PORT = Number(process.env.PORT || 8080);

// Simple per-player rate limit (attacks per minute).
const RATE = Number(process.env.RATE_LIMIT_PER_MIN || 20);
const buckets = new Map();
function rateOk(key) {
  const now = Date.now();
  const b = buckets.get(key) || [];
  const recent = b.filter((t) => now - t < 60_000);
  if (recent.length >= RATE) return false;
  recent.push(now);
  buckets.set(key, recent);
  return true;
}

// ---------- public API ----------
app.get('/api/config', (_req, res) => {
  res.json({
    appName: process.env.APP_NAME || 'FortiAIGate Arena',
    event: EVENT,
    providers: availableProviders(),
    defaultProvider: pickProvider(),
    guardMode: GUARD_MODE,
    levels: LEVELS,
    maxChars: Number(process.env.ATTACK_MAX_CHARS || 10000),
  });
});

app.get('/api/scenarios', (_req, res) => {
  res.json(SCENARIOS.map(publicScenario));
});

app.get('/api/scenarios/:id', (req, res) => {
  const s = getScenario(req.params.id);
  if (!s) return res.status(404).json({ error: 'not found' });
  res.json(publicScenario(s));
});

app.post('/api/players', (req, res) => {
  const handle = String(req.body?.handle || '').trim().slice(0, 24);
  if (!handle) return res.status(400).json({ error: 'handle required' });
  const id = req.body?.id && db.getPlayer(req.body.id) ? req.body.id : nanoid(12);
  const p = db.upsertPlayer({ id, handle, event: EVENT });
  res.json({ player: p, progress: db.playerProgress(id) });
});

app.get('/api/players/:id/progress', (req, res) => {
  if (!db.getPlayer(req.params.id)) return res.status(404).json({ error: 'not found' });
  res.json(db.playerProgress(req.params.id));
});

app.post('/api/attack', async (req, res) => {
  const { playerId, scenarioId, level, attack, guard, provider } = req.body || {};
  const player = playerId ? db.getPlayer(playerId) : null;
  if (!player) return res.status(401).json({ error: 'join first' });
  if (!rateOk(player.id)) return res.status(429).json({ error: 'slow down: rate limit' });
  const scenario = getScenario(scenarioId);
  if (!scenario) return res.status(400).json({ error: 'unknown scenario' });
  const lvl = Number(level) || 1;
  // Level gating: must have cleared the previous level (unguarded) unless admin unlock.
  if (lvl > 1 && !process.env.UNLOCK_ALL) {
    const prog = db.playerProgress(player.id);
    const prev = prog[scenario.id]?.[lvl - 1]?.best ?? 0;
    if (prev < LEVELS[lvl - 2].target) return res.status(403).json({ error: `clear level ${lvl - 1} first` });
  }
  try {
    const result = await runAttack({ scenarioId, level: lvl, attack, guard: Boolean(guard), provider: pickProvider(provider) });
    if (result.error) return res.status(502).json(result);
    db.recordAttempt({
      id: nanoid(14), playerId: player.id, event: EVENT, scenarioId, level: lvl, guard: Boolean(guard), blocked: result.blocked, blockedAt: result.blockedAt,
      score: result.score, unguardedScore: result.unguardedScore, attack: String(attack).slice(0, 10000), response: result.response, verdicts: result.verdicts,
      provider: result.provider, model: result.model, ms: result.ms,
    });
    res.json({ ...result, progress: db.playerProgress(player.id) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/leaderboard', (_req, res) => {
  res.json({ event: EVENT, rows: db.leaderboard(EVENT) });
});

// Quick preview of what the signature engine sees (teaching aid; no LLM call).
app.post('/api/guard/preview', (req, res) => {
  res.json(signatureScan(String(req.body?.text || '').slice(0, 10000)));
});
app.get('/api/guard/signatures', (_req, res) => res.json(SIGNATURE_CATALOG));

// ---------- admin / facilitator ----------
function requireAdmin(req, res, next) {
  if (!ADMIN_KEY) return res.status(403).json({ error: 'ADMIN_KEY not set' });
  if (req.get('x-admin-key') !== ADMIN_KEY && req.query.key !== ADMIN_KEY) return res.status(401).json({ error: 'unauthorized' });
  next();
}
app.get('/api/admin/stats', requireAdmin, (_req, res) => res.json({ event: EVENT, stats: db.eventStats(EVENT), recent: db.recentAttempts(EVENT) }));
app.get('/api/admin/export', requireAdmin, (_req, res) => {
  res.setHeader('content-disposition', `attachment; filename="arena-${EVENT}-attacks.json"`);
  res.json(db.exportAttempts(EVENT));
});

// ---------- static client ----------
const dist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
} else {
  app.get('/', (_req, res) => res.type('text').send('FortiAIGate Arena API is up. Build the client with `npm run build`.'));
}

app.listen(PORT, () => {
  console.log(`FortiAIGate Arena listening on :${PORT} | event=${EVENT} | guard=${GUARD_MODE} | providers=${availableProviders().map((p) => p.id).join(',')}`);
});
