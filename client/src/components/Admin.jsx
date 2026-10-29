import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

// Facilitator view: #/admin?key=ADMIN_KEY (or type it in). Live feed of attacks
// and guard stats for the big screen between rounds.
export default function Admin({ scenarios }) {
  const [key, setKey] = useState(() => new URLSearchParams(window.location.hash.split('?')[1] || '').get('key') || sessionStorage.getItem('arena.admin') || '');
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!key) return;
    let alive = true;
    const load = () => api.adminStats(key).then((d) => { if (alive) { setData(d); setErr(''); sessionStorage.setItem('arena.admin', key); } }).catch((e) => alive && setErr(e.message));
    load();
    const t = setInterval(load, 4000);
    return () => { alive = false; clearInterval(t); };
  }, [key]);

  const name = (id) => scenarios.find((s) => s.id === id)?.name || id;
  const s = data?.stats;
  const blockRate = s?.guarded_runs ? Math.round((s.guarded_blocked / s.guarded_runs) * 100) : null;

  return (
    <div className="container">
      <div className="section-title"><h2>Facilitator console</h2><span>event: {data?.event || '...'}</span></div>
      {!data && (
        <div className="card" style={{ maxWidth: 420 }}>
          <p>Enter the ADMIN_KEY configured on the server.</p>
          <input className="input" type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="admin key" />
          {err && <div className="err" style={{ marginTop: 8 }}>{err}</div>}
        </div>
      )}
      {s && (
        <>
          <div className="stats">
            <div className="stat"><div className="v">{s.players || 0}</div><div className="l">players</div></div>
            <div className="stat"><div className="v">{s.attempts || 0}</div><div className="l">attacks launched</div></div>
            <div className="stat"><div className="v">{s.successes || 0}</div><div className="l">unguarded successes (75+)</div></div>
            <div className="stat"><div className="v">{s.guarded_runs || 0}</div><div className="l">runs through FortiAIGate</div></div>
            <div className="stat"><div className="v" style={{ color: '#2ecc71' }}>{blockRate == null ? '–' : `${blockRate}%`}</div><div className="l">gateway block rate</div></div>
            <div className="stat"><div className="v" style={{ color: '#ff8a80' }}>{s.guarded_bypassed || 0}</div><div className="l">gateway bypasses (75+)</div></div>
          </div>

          <div className="section-title"><h2 style={{ fontSize: 16 }}>By target</h2></div>
          <div className="card" style={{ padding: 0, marginBottom: 18 }}>
            <table className="table">
              <thead><tr><th>Target</th><th>Attempts</th><th>Successes</th><th>Blocked by gateway</th></tr></thead>
              <tbody>
                {s.byScenario.map((r) => (
                  <tr key={r.scenario_id}><td>{name(r.scenario_id)}</td><td className="num">{r.attempts}</td><td className="num">{r.successes}</td><td className="num">{r.blocked}</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="section-title"><h2 style={{ fontSize: 16 }}>Live feed</h2><a className="btn sm" href={`/api/admin/export?key=${encodeURIComponent(key)}`}>Export attacks (JSON)</a></div>
          <div className="feed">
            {data.recent.map((a) => (
              <div className="it" key={a.id}>
                <span style={{ fontWeight: 700 }}>{a.handle}</span>
                <span className="atk" title={a.attack_preview}>{name(a.scenario_id)} L{a.level} · {a.attack_preview}</span>
                <span className={`pill ${a.blocked ? 'red' : a.score >= 75 ? 'green' : ''}`}>{a.blocked ? `blocked@${a.blocked_at}` : a.guard ? 'guarded' : 'unguarded'}</span>
                <span className="mono" style={{ textAlign: 'right' }}>{a.score}{a.blocked && a.unguarded_score != null ? ` (${a.unguarded_score})` : ''}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
