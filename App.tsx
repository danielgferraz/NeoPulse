import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Link } from 'react-router-dom';
import { db } from './services/db';
import HomeView from './views/HomeView';
import TrainingEditView from './views/TrainingEditView';
import SessionView from './views/SessionView';
import SummaryView from './views/SummaryView';
import SettingsView from './views/SettingsView';
import { LocalNotifications } from '@capacitor/local-notifications';
import { ThemeProvider } from './contexts/ThemeContext';

const App: React.FC = () => {
  const [isDbReady, setIsDbReady] = useState(false);

  useEffect(() => {
    // Inicialização
    const init = async () => {
      await db.seed();
      setIsDbReady(true);

      // Solicitar permissão de notificação no start (opcional)
      try {
        const perm = await LocalNotifications.checkPermissions();
        if (perm.display !== 'granted') {
          await LocalNotifications.requestPermissions();
        }
      } catch (e) {
        console.log("Notificações não suportadas ou erro:", e);
      }
    };
    init();
  }, []);

  if (!isDbReady) {
    return <div className="h-screen bg-black flex items-center justify-center text-[#00FF41] animate-pulse">Iniciando NeoPulse...</div>
  }

  return (
    <ThemeProvider>
      <HashRouter>
        <div className="min-h-screen bg-black flex flex-col items-center text-white overflow-hidden font-sans select-none">

          {/* Global Header */}
          <header className="w-full max-w-md p-6 pb-2 flex justify-between items-center z-50">
            <Link to="/" className="flex items-center gap-3 active:scale-95 transition-transform">
              <div className="w-9 h-9 bg-[#00FF41] rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(0,255,65,0.4)]">
                <i className="fa-solid fa-bolt-lightning text-black text-sm"></i>
              </div>
              <h1 className="text-xl font-black italic tracking-tighter text-[#00FF41]">NEOPULSE</h1>
            </Link>
            <Link to="/settings" className="w-9 h-9 rounded-full bg-zinc-900 flex items-center justify-center active:scale-95 transition-transform">
              <i className="fa-solid fa-gear text-zinc-500 text-xs"></i>
            </Link>
          </header>

          {/* Content */}
          <div className="w-full flex-1 flex flex-col items-center p-4 overflow-y-auto">
            <Routes>
              <Route path="/" element={<HomeView />} />
              <Route path="/training/:id" element={<TrainingEditView />} />
              <Route path="/session/:id" element={<SessionView />} />
              <Route path="/summary" element={<SummaryView />} />
              <Route path="/settings" element={<SettingsView />} />
            </Routes>
          </div>

        </div>
      </HashRouter>
    </ThemeProvider>
  );
};

export default App;