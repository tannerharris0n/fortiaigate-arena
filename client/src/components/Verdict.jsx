function Ring({ value, passed }) {
  const r = 36;
  const c = 2 * Math.PI * r;
  const color = passed ? '#2ecc71' : value > 0 ? '#f5a623' : '#3a4452';
  return (
    <div className="ring">
      <svg width="84" height="84" viewBox="0 0 84 84">
        <circle cx="42" cy="42" r={r} stroke="#242c38" strokeWidth="8" fill="none" />
        <circle cx="42" cy="42" r={r} stroke={color} strokeWidth="8" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <div className="val" style={{ color }}>{value}</div>
    </div>
  );
}

const STAGE_LABEL = { context: 'Context', input: 'Input inspection', llm: 'Backbone LLM', judge: 'Self-judge', output: 'Output DLP', tool: 'Tool-call control', score: 'Score' };

export default function Verdict({ result: r, target }) {
  const guarded = r.guard.inputInspection || r.guard.fullPolicy;
  return (
    <>
      <div className="card score-card">
        <Ring value={r.score} passed={r.passed} />
        <div className="txt">
          <h4>
            {r.blocked ? 'Blocked by FortiAIGate' : r.passed ? 'Level cleared' : r.score > 0 ? 'Partial success' : 'No effect'}
          </h4>
          <p>
            {r.blocked
              ? `Stopped at ${r.blockedAt}. ${r.unguardedScore != null ? `Against the bare model this would have scored ${r.unguardedScore}.` : 'The model never saw it.'}`
              : r.passed ? `Target ${target} reached. ${r.guard.requested ? 'Guarded runs do not count toward the leaderboard.' : ''}` : `Need ${target}. ${r.score > 0 ? 'Close, refine the payload.' : 'The model ignored you.'}`}
          </p>
          <p style={{ fontSize: 11, marginTop: 4 }}>{r.model ? `${r.provider}/${r.model}` : r.provider} · {r.ms} ms · level defense: {r.defense}</p>
        </div>
      </div>

      {r.breakdown?.length > 0 && (
        <div className="card">
          <h4 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--muted)', marginBottom: 8 }}>Scoring breakdown</h4>
          <div className="breakdown">
            {r.breakdown.map((b, i) => (
              <div className="row" key={i}>
                <span>{b.label}</span>
                <span className="bar"><i className={b.value < 75 ? 'low' : ''} style={{ width: `${b.value}%` }} /></span>
                <span className="mono">{b.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="verdict">
        <div className="vh">
          <span style={{ color: guarded ? '#ff8a80' : 'var(--muted)' }}>▣</span> FortiAIGate {guarded ? (r.guard.fullPolicy ? 'full policy' : 'input inspection') : 'not in path'}
          <span className={`pill ${r.blocked ? 'red' : guarded ? 'green' : ''} st`}>{r.blocked ? 'BLOCKED' : guarded ? 'ALLOWED' : 'BYPASSED'}</span>
        </div>
        <div className="vb">
          {r.timeline.map((t, i) => {
            const v = t.verdict;
            const cls = v ? v.action : t.stage === 'judge' && /VIOLATION/.test(t.label) ? 'block' : 'info';
            return (
              <div key={i}>
                <div className="stage">
                  <span className={`ic ${cls}`}>{cls === 'block' ? '✕' : cls === 'allow' ? '✓' : '·'}</span>
                  <span><b>{STAGE_LABEL[t.stage] || t.stage}</b> <span style={{ color: 'var(--muted)' }}>{t.label.replace(/^[A-Za-z -]+: /, '')}</span></span>
                </div>
                {v?.detections?.length > 0 && (
                  <div className="det">
                    {v.detections.map((d, j) => (
                      <div key={j}><span className="id">{d.id}</span>{d.label}{d.match ? <> · <code>{String(d.match).slice(0, 70)}</code></> : null}</div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
