import { useEffect, useRef } from 'react';

function Greeting({ scenario }) {
  const g = {
    chat: `Hi, I'm ${scenario.victim.appName}. How can I help?`,
    report: 'Upload a vendor document and I will return a structured risk assessment.',
    review: 'Waiting for a pull request to review.',
  }[scenario.victim.kind] || 'Ready.';
  return <div className="bubble bot">{g}</div>;
}

export default function Preview({ scenario, result, busy }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' });
  }, [result, busy]);

  const userMsg = scenario.victim.userMessage;
  const r = result;
  const resp = r?.response;
  const showJson = resp?.json && Object.keys(resp.json).length > 0;
  const blockedTools = r?.blocked && r.blockedAt === 'tool' ? (r.rawResponse?.toolCalls || []).filter((tc) => !(resp?.toolCalls || []).some((k) => JSON.stringify(k) === JSON.stringify(tc))) : [];

  return (
    <div className="phone">
      <div className="screen">
        <div className="sbar"><span>9:41</span><span>●●● 5G</span></div>
        <div className="appbar"><span className="avatar">{scenario.icon}</span>{scenario.victim.appName}</div>
        <div className="msgs" ref={ref}>
          <Greeting scenario={scenario} />
          {(busy || r) && userMsg && <div className="bubble user">{userMsg}</div>}
          {(busy || r) && !userMsg && <div className="bubble sys">(your message was sent as the user)</div>}
          {scenario.vector === 'indirect' && (busy || r) && <div className="bubble sys">agent reads: {scenario.surface.title}</div>}
          {busy && <div className="bubble bot"><span className="typing"><i /><i /><i /></span></div>}

          {r && r.blockedAt === 'input' && (
            <div className="bubble blocked">
              <b>FortiAIGate blocked this request.</b>
              <div style={{ fontSize: 12, marginTop: 4 }}>Policy {r.verdicts.find((v) => v.stage === 'input')?.policy}. The content never reached the model.</div>
            </div>
          )}

          {r && r.blockedAt !== 'input' && (
            <>
              {blockedTools.map((tc, i) => (
                <div key={`b${i}`} className="bubble tool blocked-tool">{tc.name}({JSON.stringify(tc.args)})</div>
              ))}
              {(resp?.toolCalls || []).map((tc, i) => (
                <div key={i} className="bubble tool">▶ {tc.name}({JSON.stringify(tc.args, null, 0)})</div>
              ))}
              {r.blockedAt === 'tool' && <div className="bubble blocked"><b>FortiAIGate blocked the tool call.</b><div style={{ fontSize: 12, marginTop: 4 }}>Policy AI-Agent-Tool-Control. The action was not executed.</div></div>}
              {showJson && r.blockedAt !== 'output' && <div className="bubble json"><pre>{JSON.stringify(resp.json, null, 2)}</pre></div>}
              {!showJson && resp?.text && (
                <div className={`bubble ${r.blockedAt === 'output' ? 'blocked' : 'bot'}`}>{resp.text}</div>
              )}
              {showJson && r.blockedAt === 'output' && <div className="bubble blocked">{resp.text}</div>}
              {!resp?.text && !showJson && !(resp?.toolCalls || []).length && !r.blocked && <div className="bubble sys">(empty response)</div>}
            </>
          )}

          {r && r.blocked && r.rawResponse && (r.rawResponse.text || r.rawResponse.toolCalls?.length > 0) && (
            <details className="details" style={{ alignSelf: 'stretch' }}>
              <summary>What the model actually produced (withheld)</summary>
              <pre>{r.rawResponse.text}{r.rawResponse.toolCalls?.length ? `\n\nTool calls: ${JSON.stringify(r.rawResponse.toolCalls, null, 1)}` : ''}</pre>
            </details>
          )}
          {r && <div className="bubble sys">Score: {r.score}{r.blocked && r.unguardedScore != null ? ` (unguarded: ${r.unguardedScore})` : ''}</div>}
        </div>
      </div>
    </div>
  );
}
