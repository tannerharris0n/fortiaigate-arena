import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

export default function Leaderboard({ player, scenarios }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let alive = true;
    const load = () => api.leaderboard().then((d) => alive && setData(d)).catch(() => {});
    load();
    const t = setInterval(load, 5000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  const maxTotal = scenarios.length * 5 * 100;
  return (
    <div className="container">
      <div className="section-title">
        <h2>Leaderboard</h2>
        <span>event: {data?.event || '...'} · refreshes every 5s · max {maxTotal.toLocaleString()} points</span>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table">
          <thead><tr><th>#</th><th>Handle</th><th>Total</th><th>Levels cleared</th><th>Attempts</th></tr></thead>
          <tbody>
            {(data?.rows || []).map((r, i) => (
              <tr key={r.id} className={player?.id === r.id ? 'me' : ''}>
                <td><span className={`rank r${i + 1}`}>{i + 1}</span></td>
                <td>{r.handle}</td>
                <td className="num">{r.total}</td>
                <td className="num">{r.levels_cleared}</td>
                <td className="num">{r.attempts}</td>
              </tr>
            ))}
            {data && data.rows.length === 0 && <tr><td colSpan={5} style={{ color: 'var(--muted)' }}>Nobody has scored yet. Be first.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="hint">Totals sum your best unguarded score per level per target. Runs with FortiAIGate switched on by choice are logged but not ranked.</p>
    </div>
  );
}
