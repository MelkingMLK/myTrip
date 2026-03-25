import { useEffect, useState } from 'react';

export default function SplashScreen({ onFinish }: { onFinish: () => void }) {
  // --- LETTURA TEMA GLOBALE DA MEMORIA ---
  const [isDarkMode] = useState(() => localStorage.getItem('rr_dark') !== 'false');
  const [appTheme] = useState(() => localStorage.getItem('rr_theme') || 'blue');
  const [customPrimary] = useState(() => localStorage.getItem('rr_custom1') || '#10b981');
  const [customAccent] = useState(() => localStorage.getItem('rr_custom2') || '#f59e0b');

  const getThemeColors = () => {
    let hexPrimary = '#3b82f6'; let hexAccent = '#60a5fa';
    switch (appTheme) {
      case 'black-white': hexPrimary = isDarkMode ? '#ffffff' : '#000000'; hexAccent = isDarkMode ? '#9ca3af' : '#4b5563'; break;
      case 'black-orange': hexPrimary = isDarkMode ? '#ffffff' : '#000000'; hexAccent = '#f97316'; break;
      case 'purple-yellow': hexPrimary = '#9611fe'; hexAccent = '#facc15'; break;
      case 'red-white': hexPrimary = '#ef4444'; hexAccent = isDarkMode ? '#ffffff' : '#000000'; break;
      case 'custom': hexPrimary = customPrimary; hexAccent = customAccent; break;
    }
    return { hexPrimary, hexAccent };
  };

  const { hexPrimary, hexAccent } = getThemeColors();
  const bgClass = isDarkMode ? 'bg-black' : 'bg-gray-100';

  useEffect(() => {
    const timer = setTimeout(() => {
      onFinish();
    }, 2500); // Rimane sullo schermo 2.5 secondi, poi sparisce
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div className={`h-screen w-screen flex flex-col items-center justify-center relative overflow-hidden transition-colors duration-500 ${bgClass}`}>
      
      {/* Sfondo sfocato luminoso */}
      <div className="absolute w-96 h-96 rounded-full blur-[100px] animate-pulse opacity-20" style={{ backgroundColor: hexPrimary }}></div>

      <div className="relative z-10 flex flex-col items-center animate-in zoom-in duration-1000">
        
        {/* Icona Mappa che rimbalza */}
        <div className="w-24 h-24 rounded-3xl flex items-center justify-center mb-6 shadow-2xl animate-bounce" style={{ backgroundColor: isDarkMode ? '#111' : '#fff' }}>
          <svg className="w-12 h-12" style={{ color: hexPrimary }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        </div>
        
        <h1 className="text-5xl font-black tracking-tighter drop-shadow-lg">
          <span style={{ color: hexPrimary }}>Road</span>
          <span style={{ color: hexAccent }}>Record</span>
        </h1>
        
        {/* Puntino di caricamento */}
        <div className="mt-8 flex gap-2">
          <div className="w-3 h-3 rounded-full animate-ping" style={{ backgroundColor: hexAccent }}></div>
        </div>

      </div>
    </div>
  );
}