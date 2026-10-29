import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import Surface from './Surface.jsx';
import Preview from './Preview.jsx';
import Verdict from './Verdict.jsx';

export default function Play({ scenario, config, player, progress, requirePlayer, onProgress, onBack, toast }) {
  const levels = config.levels;
  const unlockedMax = useMemo(() => {
    let max = 1;
    for (const l of levels) if ((progress[l.n]?.best ?? 0) >= l.target) max = Math.max(max, l.n + 1);
    return Math.min(max, levels.length);
  }, [progress, levels]);

  const [level, setLevel] = useState(1);
  const [attack, setAttack] = useState('');
  const [guard, setGuard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [sigs, setSigs] = useState(null);
  const [showLevels, setShowLevels] = useState(true);
  const sigTimer = useRef(null);

  const lvl = levels.find((l) => l.n === level);
  const guardForced = lvl.defense === 'aigate-input' || lvl.defense === 'aigate-full';
  const guardOn = guard || guardForced;

  // Signature preview (debounced), only when the guard is on.
  useEffect(() => {
    clearTimeout(sigTimer.current);
    if (!guardOn || !attack.trim()) return setSigs(null);
    sigTimer.current = setTimeout(() => api.guardPreview(attack).then(setSigs).catch(() => {}), 350);
    return () => clearTimeout(sigTimer.current);
  }, [attack, guardOn]);

  const run = async () => {
    if (!requirePlayer()) return;
    if (!attack.trim()) return toast('Write your attack first.');
    setBusy(true);
    setResult(null);
    try {
      const r = await api.attack({ playerId: player.id, scenarioId: scenario.id, level, attack, guard, provider: config.defaultProvider });
      setResult(r);
      if (r.progress) onProgress(r.progress);
      if (!guard && r.passed && level < levels.length && (progress[level]?.best ?? 0) < lvl.target) toast(`Level ${level} cleared. Level ${level + 1} unlocked.`);
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="play">
      {/* ---------- info ---------- */}
      <aside className="col col-info">
        <button className="back" onClick={onBack}>← All targets</button>
        <h2><span style={{ fontSize: 24 }}>{scenario.icon}</span> {scenario.name} <span className="pill">L{level} {lvl.name}</span></h2>
        <div className="objective">
          <h4>Attack objective</h4>
          <p>{scenario.objective}</p>
        </div>
        <div className="info-block">{scenario.agentDescription}</div>
        <div className="info-block"><b>Scenario:</b> {scenario.scenario}</div>
        <div className="info-block"><b>Vector:</b> {scenario.vectorText}</div>
        <dl className="kv">
          <dt>Category</dt><dd>{scenario.objectiveCategory}</dd>
          <dt>Task type</dt><dd className="mono">{scenario.taskType}</dd>
          {scenario.tools?.length > 0 && <><dt>Agent tools</dt><dd className="mono">{scenario.tools.join(', ')}</dd></>}
        </dl>

        <button className="btn sm ghost block" style={{ marginTop: 14 }} onClick={() => setShowLevels((v) => !v)}>{showLevels ? 'Collapse levels' : 'View all levels'}</button>
        {showLevels && (
          <div className="level-list">
            {levels.map((l) => {
              const best = progress[l.n]?.best ?? 0;
              const locked = l.n > unlockedMax;
              return (
                <button key={l.n} className={`level ${l.n === level ? 'active' : ''} ${locked ? 'locked' : ''}`} disabled={locked} onClick={() => { setLevel(l.n); setResult(null); }}>
                  <span className="ln">Level {l.n}</span>
                  <span className="badge">{l.name.toUpperCase()}</span>
                  <span className={`score ${best >= l.target ? 'pass' : ''}`}>{locked ? 'Locked' : `${best}/100`}</span>
                </button>
              );
            })}
          </div>
        )}
        <p className="level-desc"><b style={{ color: 'var(--text)' }}>Defense at this level:</b> {lvl.summary} Target score {lvl.target}.</p>

        <div className="playbook" style={{ marginTop: 16 }}>
          <h4>Fortinet playbook</h4>
          <div><b>OWASP:</b> <span style={{ color: 'var(--muted)' }}>{scenario.fortinet.owasp}</span></div>
          <div><b>Agentic:</b> <span style={{ color: 'var(--muted)' }}>{scenario.fortinet.agentic}</span></div>
          <div style={{ marginTop: 6 }}><b>Controls</b></div>
          <ul>{scenario.fortinet.controls.map((c, i) => <li key={i}>{c}</li>)}</ul>
          <div className="tt">"{scenario.fortinet.talkTrack}"</div>
        </div>
      </aside>

      {/* ---------- attack ---------- */}
      <section className="col col-attack">
        <div className="surface-head">
          <div>
            <h3>Your attack</h3>
            <p>{scenario.vector === 'direct' ? 'Typed straight into the app as the user.' : 'Planted in content the agent will read.'}</p>
          </div>
          <div className={`guard-toggle ${guardOn ? 'on' : ''} ${guardForced ? 'forced' : ''}`} onClick={() => !guardForced && setGuard((v) => !v)} title={guardForced ? 'This level always runs behind FortiAIGate' : 'Toggle the inline AI gateway'}>
            <span className="sw" />
            <span className="lab">FortiAIGate {guardOn ? 'ON' : 'OFF'}<small>{guardForced ? 'enforced by this level' : guardOn ? 'full policy, score not ranked' : 'you vs. the model'}</small></span>
          </div>
        </div>

        <Surface scenario={scenario} value={attack} onChange={setAttack} max={config.maxChars} />

        <div className="sig-preview">
          {guardOn && sigs && sigs.detections.length > 0 && <>
            <span>Signatures would fire:</span>
            {sigs.detections.map((d) => <span key={d.id} className={`s ${d.weight >= 0.5 ? 'hi' : ''}`} title={d.label}>{d.id}</span>)}
            <span>risk {sigs.risk.toFixed(2)}</span>
          </>}
          {guardOn && sigs && sigs.detections.length === 0 && attack.trim() && <span>No signature hits. The ML classifier still gets a look.</span>}
        </div>

        <div className="attack-foot">
          <span className="count">{attack.length.toLocaleString()}/{config.maxChars.toLocaleString()}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn ghost sm" onClick={() => { setAttack(''); setResult(null); }} disabled={busy}>Clear</button>
            <button className="btn primary" onClick={run} disabled={busy}>{busy ? 'Attacking...' : guardOn ? 'Attack through FortiAIGate' : 'Initiate attack'}</button>
          </div>
        </div>
      </section>

      {/* ---------- preview ---------- */}
      <aside className="col col-preview">
        <div>
          <h3 style={{ fontSize: 15 }}>Victim's view</h3>
          <p style={{ margin: '2px 0 0', color: 'var(--muted)', fontSize: 13 }}>What the user of {scenario.name} sees when your attack lands.</p>
        </div>
        <Preview scenario={scenario} result={result} busy={busy} />
        {result && <Verdict result={result} target={lvl.target} />}
      </aside>
    </div>
  );
}
