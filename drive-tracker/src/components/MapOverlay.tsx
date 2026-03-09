import { useState, useRef, useEffect } from 'react';
import Map, { GeolocateControl, NavigationControl } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export default function MapOverlay() {
  const [isTracking, setIsTracking] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0); // Stato per il timer (in secondi)
  
  const mapRef = useRef<any>(null);
  const watchId = useRef<number | null>(null);

  // --- LOGICA DEL CRONOMETRO ---
  useEffect(() => {
    let interval: number | undefined;
    if (isTracking) {
      // Se stiamo tracciando, aumenta i secondi ogni 1000ms (1 secondo)
      interval = window.setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    } else {
      // Se fermiamo il tracciamento, puliamo l'intervallo
      window.clearInterval(interval);
    }
    return () => window.clearInterval(interval);
  }, [isTracking]);

  // Funzione per trasformare i secondi in formato MM:SS
  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  const handleToggleTracking = () => {
    if (!isTracking) {
      if ("geolocation" in navigator) {
        setIsTracking(true);
        setElapsedTime(0); // Azzera il timer alla partenza
        
        watchId.current = navigator.geolocation.watchPosition(
          (position) => {
            const { latitude, longitude, speed: mps } = position.coords;
            
            // Aggiorna Tachimetro
            setSpeed(Math.round((mps || 0) * 3.6));

            // Vola sulle coordinate attuali
            mapRef.current?.flyTo({
              center: [longitude, latitude],
              zoom: 16,
              essential: true,
              duration: 2000
            });
          },
          (error) => {
            console.error("Errore GPS:", error);
            setIsTracking(false);
          },
          { enableHighAccuracy: true }
        );
      }
    } else {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      setIsTracking(false);
      setSpeed(0);
    }
  };

  return (
    <div className="relative h-screen w-screen bg-gray-900">
      <Map
        ref={mapRef}
        initialViewState={{
          longitude: 8.8251, // Varese!
          latitude: 45.8206,
          zoom: 13
        }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        mapboxAccessToken={MAPBOX_TOKEN}
      >
        <GeolocateControl 
          positionOptions={{ enableHighAccuracy: true }} 
          trackUserLocation={true}
          showUserLocation={true}
          showUserHeading={true}
          position="bottom-right"
        />
        <NavigationControl position="bottom-right" />
      </Map>

      {/* --- UI OVERLAY --- */}

      {/* 1. Header di Stato (Centro) */}
      <div className="absolute top-6 left-0 right-0 flex justify-center pointer-events-none px-4 z-10">
        <div className="flex items-center gap-3 bg-gray-900/90 backdrop-blur-xl border border-white/10 p-3 rounded-2xl shadow-2xl">
          <div className={`h-2 w-2 rounded-full ${isTracking ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
          <span className="text-white font-medium text-sm tracking-tight uppercase">
            {isTracking ? 'Live Tracking' : 'GPS Ready'}
          </span>
        </div>
      </div>

      {/* 2. Menù Impostazioni (Alto a Destra) */}
      <div className="absolute top-6 right-6 z-10">
        <button className="bg-gray-900/90 backdrop-blur-xl border border-white/10 p-3 rounded-full shadow-2xl text-white hover:bg-gray-800 transition-colors active:scale-95">
          {/* Icona SVG Hamburger Menu */}
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* 3. Pannello Statistiche Reali (Sinistra) */}
      {isTracking && (
        <div className="absolute top-24 left-6 flex flex-col gap-3 z-10">
           {/* Velocità */}
           <div className="bg-black/50 backdrop-blur-md p-4 rounded-2xl border border-white/10 w-24 shadow-lg">
              <p className="text-gray-400 text-[10px] font-bold uppercase">KM/H</p>
              <p className="text-white text-3xl font-black">{speed}</p>
           </div>
           
           {/* Timer */}
           <div className="bg-black/50 backdrop-blur-md p-4 rounded-2xl border border-white/10 w-24 shadow-lg">
              <p className="text-gray-400 text-[10px] font-bold uppercase">TIME</p>
              <p className="text-white text-xl font-black tracking-wider text-blue-400">
                {formatTime(elapsedTime)}
              </p>
           </div>
        </div>
      )}

      {/* 4. TASTONE START / STOP (Basso) */}
      <div className="absolute bottom-12 left-0 right-0 flex justify-center px-6 z-10">
        <button
          onClick={handleToggleTracking}
          className={`w-full max-w-xs py-5 rounded-3xl font-black text-lg transition-all active:scale-95 shadow-2xl border-b-4 
            ${isTracking 
              ? 'bg-red-600 border-red-800 text-white shadow-red-500/20' 
              : 'bg-blue-600 border-blue-800 text-white shadow-blue-500/20'}`}
        >
          {isTracking ? 'STOP TRACKING' : 'START JOURNEY'}
        </button>
      </div>
    </div>
  );
}