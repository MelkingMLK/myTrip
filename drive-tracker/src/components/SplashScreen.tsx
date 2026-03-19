import { useEffect, useState } from 'react';

export default function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    // Inizia la transizione di scomparsa dopo 2.5 secondi
    const fadeTimer = setTimeout(() => setIsFading(true), 2500);
    
    // Distrugge il componente e mostra la mappa dopo 3 secondi
    const removeTimer = setTimeout(() => onFinish(), 3000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [onFinish]);

  return (
    <div 
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-900 transition-opacity duration-500 ${
        isFading ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Icona Vettoriale (Senza Emoji) */}
      <div className="relative flex items-center justify-center mb-6">
        {/* Cerchio pulsante di background */}
        <div className="absolute w-24 h-24 bg-blue-500/20 rounded-full animate-ping"></div>
        
        {/* Icona GPS/Strada */}
        <svg 
          className="w-20 h-20 text-blue-500 relative z-10" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={1.5} 
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" 
          />
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={1.5} 
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" 
          />
        </svg>
      </div>

      {/* Nome App: RoadRecord */}
      <h1 className="text-5xl font-black tracking-tighter text-white mb-3 shadow-sm">
        Road<span className="text-blue-500">Record</span>
      </h1>
      
      {/* Sottotitolo tecnico */}
      <p className="text-gray-400 font-medium tracking-[0.2em] text-xs uppercase">
        Calibrazione Sistemi
      </p>

      {/* Indicatore di caricamento (3 pallini sequenziali) */}
      <div className="mt-12 flex gap-3">
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
      </div>
    </div>
  );
}