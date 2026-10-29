import { useState } from 'react';

export default function JoinModal({ initial, onJoin, onClose }) {
  const [handle, setHandle] = useState(initial || '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const h = handle.trim();
    if (h.length < 2) return setErr('Pick a handle with at least 2 characters.');
    setBusy(true);
    try {
      await onJoin(h);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>Join the arena</h3>
        <p>Pick a handle for the leaderboard. No account, no email. Your progress is tied to this browser.</p>
        <input className="input" autoFocus maxLength={24} placeholder="handle, e.g. packet_wrangler" value={handle} onChange={(e) => setHandle(e.target.value)} />
        {err && <div className="err" style={{ marginTop: 8 }}>{err}</div>}
        <div className="hint">Keep it work-safe; it goes on the big screen.</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={busy}>{busy ? 'Joining...' : 'Start hacking'}</button>
        </div>
      </form>
    </div>
  );
}
