export default function Home({ scenarios, progress, config, onPlay }) {
  const levels = config?.levels || [];
  return (
    <div className="container">
      <section className="hero">
        <div>
          <h1>Break the agent.<br />Then watch <span>FortiAIGate</span> stop you.</h1>
          <p className="lede">
            Twelve enterprise AI agents, each with a real job and a real weakness. Hack them with prompt injection,
            poisoned documents, rogue MCP tools, and plain social engineering. Score 75 to unlock the next level.
            Flip the guard on at any time to see the same attack hit an inline AI gateway.
          </p>
          <div className="actions">
            <button className="btn primary" onClick={() => document.getElementById('targets')?.scrollIntoView({ behavior: 'smooth' })}>Pick a target</button>
            <a className="btn" href="#/leaderboard">Leaderboard</a>
          </div>
        </div>
        <div className="card" style={{ padding: 18 }}>
          <h4 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--muted)' }}>Defense ladder</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {levels.map((l) => (
              <div key={l.n} style={{ display: 'grid', gridTemplateColumns: '92px 1fr', gap: 10, fontSize: 13 }}>
                <b style={{ color: l.n >= 4 ? '#ff8a80' : 'inherit' }}>L{l.n} {l.name}</b>
                <span style={{ color: 'var(--muted)' }}>{l.summary}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="howto">
        <div className="card"><h4><span className="num">1</span> Attack objective</h4><p>Each level has one goal: leak a secret, slip in a link, trigger a tool, hijack the output. The scorer measures how close you got, 0 to 100, no LLM judge to sweet-talk.</p></div>
        <div className="card"><h4><span className="num">2</span> Attack vector</h4><p>Direct: you type into the chat. Indirect: you plant text in something the agent reads later (a webpage, a PDF, a rules file, a memory entry, an MCP tool description, a change ticket).</p></div>
        <div className="card"><h4><span className="num">3</span> FortiAIGate toggle</h4><p>Guard off: you fight the model alone. Guard on: your payload passes through input inspection, output DLP, and tool-call control. Blocked attacks still show the score you would have had.</p></div>
      </section>

      <div className="section-title" id="targets">
        <h2>Targets</h2>
        <span>{scenarios.length} agents, {levels.length} levels each</span>
      </div>
      <div className="grid">
        {scenarios.map((s) => {
          const p = progress[s.id] || {};
          const cleared = levels.filter((l) => (p[l.n]?.best ?? 0) >= l.target).length;
          return (
            <div className="scard" key={s.id}>
              <div className="top">
                <div className="icon">{s.icon}</div>
                <div>
                  <h3>{s.name}</h3>
                  <div className="meta">
                    <span className={`tag ${s.vector}`}>{s.vector}</span>
                    <span className="tag">{s.taskType}</span>
                  </div>
                </div>
              </div>
              <p>{s.tagline}</p>
              <div className="foot">
                <div className="levels-dots" title={`${cleared}/${levels.length} levels cleared`}>
                  {levels.map((l) => {
                    const best = p[l.n]?.best ?? 0;
                    return <i key={l.n} className={best >= l.target ? 'done' : best > 0 ? 'partial' : ''} />;
                  })}
                </div>
                <button className="btn sm primary" onClick={() => onPlay(s.id)}>Hack →</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
