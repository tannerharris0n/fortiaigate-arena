import { useEffect, useMemo, useState } from 'react';
import { api, loadPlayer, savePlayer } from './lib/api.js';
import Home from './components/Home.jsx';
import Play from './components/Play.jsx';
import Leaderboard from './components/Leaderboard.jsx';
import Admin from './components/Admin.jsx';
import JoinModal from './components/JoinModal.jsx';

// Tiny hash router: #/, #/play/<id>, #/leaderboard, #/admin
function useRoute() {
  const [hash, setHash] = useState(window.location.hash || '#/');
  useEffect(() => {
    const on = () => setHash(window.location.hash || '#/');
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const parts = hash.replace(/^#\/?/, '').split('/');
  return { page: parts[0] || 'home', param: parts[1], go: (h) => (window.location.hash = h) };
}

export default function App() {
  const route = useRoute();
  const [config, setConfig] = useState(null);
  const [scenarios, setScenarios] = useState([]);
  const [player, setPlayer] = useState(loadPlayer());
  const [progress, setProgress] = useState({});
  const [joinOpen, setJoinOpen] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    api.config().then(setConfig).catch(() => setToast('API unreachable'));
    api.scenarios().then(setScenarios).catch(() => {});
  }, []);

  // Re-register the stored player on load (also refreshes progress).
  useEffect(() => {
    if (!player?.id) return;
    api.join(player.handle, player.id).then((r) => {
      setPlayer(r.player);
      savePlayer(r.player);
      setProgress(r.progress || {});
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const join = async (handle) => {
    const r = await api.join(handle, player?.id);
    setPlayer(r.player);
    savePlayer(r.player);
    setProgress(r.progress || {});
    setJoinOpen(false);
  };

  const requirePlayer = () => {
    if (player?.id) return true;
    setJoinOpen(true);
    return false;
  };

  const scenario = useMemo(() => scenarios.find((s) => s.id === route.param), [scenarios, route.param]);

  return (
    <div className="app">
      <header className="header">
        <a className="brand" href="#/">
          <span className="mark"><i /></span>
          {config?.appName || 'FortiAIGate Arena'}
          <small>agentic AI red-team range</small>
        </a>
        <nav className="nav">
          <button className={route.page === 'home' || route.page === 'play' ? 'active' : ''} onClick={() => route.go('#/')}>Targets</button>
          <button className={route.page === 'leaderboard' ? 'active' : ''} onClick={() => route.go('#/leaderboard')}>Leaderboard</button>
        </nav>
        <div className="spacer" />
        {config && (
          <span className="pill" title={`Guard mode: ${config.guardMode}`}>
            <span className="dot" style={{ background: config.defaultProvider === 'mock' ? '#f5a623' : '#2ecc71' }} />
            {config.providers.find((p) => p.id === config.defaultProvider)?.label || 'no model'}
          </span>
        )}
        <button className="btn sm" onClick={() => setJoinOpen(true)}>{player?.handle ? `@${player.handle}` : 'Join'}</button>
      </header>

      <main className="main">
        {route.page === 'home' && <Home scenarios={scenarios} progress={progress} config={config} onPlay={(id) => route.go(`#/play/${id}`)} />}
        {route.page === 'play' && scenario && config && (
          <Play
            key={scenario.id}
            scenario={scenario}
            config={config}
            player={player}
            progress={progress[scenario.id] || {}}
            requirePlayer={requirePlayer}
            onProgress={(p) => setProgress(p)}
            onBack={() => route.go('#/')}
            toast={setToast}
          />
        )}
        {route.page === 'play' && !scenario && scenarios.length > 0 && <div className="container">Unknown target.</div>}
        {route.page === 'leaderboard' && <Leaderboard player={player} scenarios={scenarios} />}
        {route.page === 'admin' && <Admin scenarios={scenarios} />}
      </main>

      {joinOpen && <JoinModal initial={player?.handle || ''} onJoin={join} onClose={() => setJoinOpen(false)} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
