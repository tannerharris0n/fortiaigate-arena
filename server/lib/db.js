// SQLite persistence using Node's built-in node:sqlite (Node 22+). No native
// build step, works on Railway with a mounted volume (set DATA_DIR).

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'arena.sqlite');

export const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    handle TEXT NOT NULL,
    event TEXT NOT NULL DEFAULT 'default',
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS attempts (
    id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL,
    event TEXT NOT NULL DEFAULT 'default',
    scenario_id TEXT NOT NULL,
    level INTEGER NOT NULL,
    guard INTEGER NOT NULL DEFAULT 0,
    blocked INTEGER NOT NULL DEFAULT 0,
    blocked_at TEXT,
    score INTEGER NOT NULL,
    unguarded_score INTEGER,
    attack TEXT NOT NULL,
    response TEXT,
    verdicts TEXT,
    provider TEXT,
    model TEXT,
    ms INTEGER,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_attempts_player ON attempts(player_id, scenario_id, level);
  CREATE INDEX IF NOT EXISTS idx_attempts_event ON attempts(event, created_at);
`);

export function upsertPlayer({ id, handle, event }) {
  db.prepare(`INSERT INTO players (id, handle, event, created_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET handle = excluded.handle, event = excluded.event`).run(id, handle, event, Date.now());
  return getPlayer(id);
}

export function getPlayer(id) {
  return db.prepare('SELECT * FROM players WHERE id = ?').get(id) || null;
}

export function recordAttempt(a) {
  db.prepare(`INSERT INTO attempts (id, player_id, event, scenario_id, level, guard, blocked, blocked_at, score, unguarded_score, attack, response, verdicts, provider, model, ms, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    a.id, a.playerId, a.event, a.scenarioId, a.level, a.guard ? 1 : 0, a.blocked ? 1 : 0, a.blockedAt || null, a.score, a.unguardedScore ?? null,
    a.attack, JSON.stringify(a.response || null), JSON.stringify(a.verdicts || []), a.provider || null, a.model || null, a.ms || null, Date.now(),
  );
}

// Best unguarded score per (scenario, level) for a player.
export function playerProgress(playerId) {
  const rows = db.prepare(`SELECT scenario_id, level, MAX(score) AS best, COUNT(*) AS attempts
    FROM attempts WHERE player_id = ? AND guard = 0 GROUP BY scenario_id, level`).all(playerId);
  const out = {};
  for (const r of rows) {
    out[r.scenario_id] ??= {};
    out[r.scenario_id][r.level] = { best: r.best, attempts: r.attempts };
  }
  return out;
}

export function leaderboard(event, limit = 50) {
  return db.prepare(`
    WITH best AS (
      SELECT player_id, scenario_id, level, MAX(score) AS best
      FROM attempts WHERE event = ? AND guard = 0 GROUP BY player_id, scenario_id, level
    )
    SELECT p.id, p.handle, COALESCE(SUM(b.best), 0) AS total,
           COUNT(CASE WHEN b.best >= 75 THEN 1 END) AS levels_cleared,
           (SELECT COUNT(*) FROM attempts a WHERE a.player_id = p.id) AS attempts,
           (SELECT MAX(created_at) FROM attempts a WHERE a.player_id = p.id) AS last_seen
    FROM players p LEFT JOIN best b ON b.player_id = p.id
    WHERE p.event = ?
    GROUP BY p.id ORDER BY total DESC, levels_cleared DESC, attempts ASC LIMIT ?`).all(event, event, limit);
}

export function eventStats(event) {
  const totals = db.prepare(`SELECT COUNT(*) AS attempts, SUM(CASE WHEN score >= 75 AND guard = 0 THEN 1 ELSE 0 END) AS successes,
      SUM(CASE WHEN guard = 1 THEN 1 ELSE 0 END) AS guarded_runs,
      SUM(CASE WHEN guard = 1 AND blocked = 1 THEN 1 ELSE 0 END) AS guarded_blocked,
      SUM(CASE WHEN guard = 1 AND blocked = 0 AND score >= 75 THEN 1 ELSE 0 END) AS guarded_bypassed,
      COUNT(DISTINCT player_id) AS players
    FROM attempts WHERE event = ?`).get(event);
  const byScenario = db.prepare(`SELECT scenario_id, COUNT(*) AS attempts,
      SUM(CASE WHEN guard = 0 AND score >= 75 THEN 1 ELSE 0 END) AS successes,
      SUM(CASE WHEN guard = 1 AND blocked = 1 THEN 1 ELSE 0 END) AS blocked
    FROM attempts WHERE event = ? GROUP BY scenario_id`).all(event);
  return { ...totals, byScenario };
}

export function recentAttempts(event, limit = 30) {
  return db.prepare(`SELECT a.id, a.scenario_id, a.level, a.guard, a.blocked, a.blocked_at, a.score, a.unguarded_score, a.created_at, a.provider, p.handle,
      substr(a.attack, 1, 160) AS attack_preview
    FROM attempts a JOIN players p ON p.id = a.player_id WHERE a.event = ? ORDER BY a.created_at DESC LIMIT ?`).all(event, limit);
}

export function exportAttempts(event) {
  return db.prepare(`SELECT a.*, p.handle FROM attempts a JOIN players p ON p.id = a.player_id WHERE a.event = ? ORDER BY a.created_at`).all(event)
    .map((r) => ({ ...r, response: JSON.parse(r.response || 'null'), verdicts: JSON.parse(r.verdicts || '[]') }));
}
