async function req(path, opts = {}) {
  const res = await fetch(path, { headers: { 'content-type': 'application/json' }, ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  config: () => req('/api/config'),
  scenarios: () => req('/api/scenarios'),
  join: (handle, id) => req('/api/players', { method: 'POST', body: JSON.stringify({ handle, id }) }),
  progress: (id) => req(`/api/players/${id}/progress`),
  attack: (body) => req('/api/attack', { method: 'POST', body: JSON.stringify(body) }),
  leaderboard: () => req('/api/leaderboard'),
  guardPreview: (text) => req('/api/guard/preview', { method: 'POST', body: JSON.stringify({ text }) }),
  adminStats: (key) => req(`/api/admin/stats?key=${encodeURIComponent(key)}`),
};

const KEY = 'arena.player';
export function loadPlayer() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    return null;
  }
}
export function savePlayer(p) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}
