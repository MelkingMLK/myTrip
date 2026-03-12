import { useEffect, useRef } from 'react';
import Map, { GeolocateControl, NavigationControl, Source, Layer, Marker } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useDriveTracker } from '../hooks/useDriveTracker'; // IMPORTIAMO IL TUO MOTORE!

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export default function MapOverlay() {
  // --- 1. USIAMO IL TUO HOOK (Sviluppatore 2) ---
  const {
    status,
    countdown,
    effectiveTime,
    currentSpeed,
    route,
    startCountdown,
    pauseTracking,
    resumeTracking,
    stopTracking
  } = useDriveTracker();

  const mapRef = useRef<any>(null);

  // Ricaviamo la posizione attuale dall'ultimo punto del tuo array 'route'
  const currentPos = route.length > 0 ? route[route.length - 1] : null;

  // --- 2. MUOVIAMO LA TELECAMERA DELLA MAPPA ---
  useEffect(() => {
    if (currentPos && mapRef.current) {
      mapRef.current.flyTo({
        center: [currentPos.lng, currentPos.lat],
        zoom: 16,
        essential: true,
        duration: 1000
      });
    }
  }, [currentPos]);

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // --- 3. LOGICA GEOJSON DEL TUO COLLEGA PER LA LINEA ---
  const routeGeoJSON: any = {
    type: 'FeatureCollection',
    features: route.map((point, index) => {
      if (index === 0) return null;
      const prev = route[index - 1];
      
      let segmentColor = '#10B981'; // Verde
      if (point.speed > 50) segmentColor = '#EF4444'; // Rosso
      else if (point.speed > 30) segmentColor = '#F59E0B'; // Arancione

      return {
        type: 'Feature',
        properties: { color: segmentColor },
        geometry: {
          type: 'LineString',
          coordinates: [[prev.lng, prev.lat], [point.lng, point.lat]]
        }
      };
    }).filter(Boolean)
  };

  return (
    <div className="relative h-screen w-screen bg-gray-900 overflow-hidden">
      
      {/* --- MAPPA BASE --- */}
      <Map
        ref={mapRef}
        initialViewState={{ longitude: 8.8251, latitude: 45.8206, zoom: 13 }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        mapboxAccessToken={MAPBOX_TOKEN}
      >
        <GeolocateControl positionOptions={{ enableHighAccuracy: true }} trackUserLocation showUserHeading position="bottom-right" />
        <NavigationControl position="bottom-right" />

        {route.length > 1 && (
          <Source id="route-source" type="geojson" data={routeGeoJSON}>
            <Layer 
              id="route-layer" 
              type="line" 
              layout={{ 'line-join': 'round', 'line-cap': 'round' }} 
              paint={{ 'line-color': ['get', 'color'], 'line-width': 6 }} 
            />
          </Source>
        )}

        {currentPos && (
          <Marker longitude={currentPos.lng} latitude={currentPos.lat} anchor="center">
            <div className="relative flex items-center justify-center">
              <div className="absolute h-8 w-8 animate-ping rounded-full bg-blue-400 opacity-60"></div>
              <div className="relative z-10 h-5 w-5 rounded-full bg-blue-500 border-2 border-white shadow-lg"></div>
            </div>
          </Marker>
        )}
      </Map>

      {/* --- UI OVERLAY --- */}

      {/* OVERLAY COUNTDOWN 10 SECONDI */}
      {status === 'countdown' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="flex flex-col items-center">
            <span className="text-white text-2xl font-bold tracking-widest mb-4">PARTENZA TRA</span>
            <span className="text-9xl font-black text-blue-500 animate-pulse drop-shadow-[0_0_20px_rgba(59,130,246,0.8)]">
              {countdown}
            </span>
          </div>
        </div>
      )}

      {/* HEADER DI STATO */}
      <div className="absolute top-6 left-0 right-0 flex justify-center pointer-events-none px-4 z-10">
        <div className="flex items-center gap-3 bg-gray-900/90 backdrop-blur-xl border border-white/10 p-3 rounded-2xl shadow-2xl">
          <div className={`h-2 w-2 rounded-full ${status === 'paused' ? 'bg-yellow-500 animate-pulse' : status === 'tracking' ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
          <span className={`font-medium text-sm tracking-tight uppercase ${status === 'paused' ? 'text-yellow-500' : 'text-white'}`}>
            {status === 'paused' ? 'SESSION PAUSED' : status === 'tracking' ? 'Live Tracking' : 'GPS Ready'}
          </span>
        </div>
      </div>

      {/* PANNELLO STATISTICHE */}
      {(status === 'tracking' || status === 'paused') && (
        <div className="absolute top-24 left-6 flex flex-col gap-3 z-10 transition-opacity duration-300">
           <div className={`bg-black/50 backdrop-blur-md p-4 rounded-2xl border w-24 shadow-lg transition-colors ${status === 'paused' ? 'border-yellow-500/30' : 'border-white/10'}`}>
              <p className="text-gray-400 text-[10px] font-bold uppercase">KM/H</p>
              <p className={`text-3xl font-black ${status === 'paused' ? 'text-gray-500' : 'text-white'}`}>{currentSpeed.toFixed(0)}</p>
           </div>
           <div className={`bg-black/50 backdrop-blur-md p-4 rounded-2xl border w-24 shadow-lg transition-colors ${status === 'paused' ? 'border-yellow-500/30' : 'border-white/10'}`}>
              <p className="text-gray-400 text-[10px] font-bold uppercase">TIME</p>
              <p className={`text-xl font-black tracking-wider ${status === 'paused' ? 'text-yellow-500' : 'text-blue-400'}`}>
                {formatTime(effectiveTime)}
              </p>
           </div>
        </div>
      )}

      {/* TASTI CONTROLLO */}
      <div className="absolute bottom-12 left-0 right-0 px-6 z-10 flex gap-4 justify-center">
        {status === 'idle' && (
          <button
            onClick={startCountdown}
            className="flex-1 max-w-[200px] py-5 rounded-3xl font-black text-lg text-white bg-blue-600 border-b-4 border-blue-800 hover:bg-blue-500 transition-all active:scale-95 shadow-2xl"
          >
            START JOURNEY
          </button>
        )}

        {status === 'tracking' && (
          <>
            <button
              onClick={pauseTracking}
              className="w-16 h-16 rounded-full flex items-center justify-center font-black transition-all active:scale-95 shadow-2xl border-b-4 bg-gray-800 border-gray-900 text-white"
            >
              ||
            </button>
            <button
              onClick={stopTracking}
              className="flex-1 max-w-[200px] py-5 rounded-3xl font-black text-lg text-white bg-red-600 border-b-4 border-red-800 hover:bg-red-500 transition-all active:scale-95 shadow-2xl"
            >
              STOP
            </button>
          </>
        )}

        {status === 'paused' && (
          <button
            onClick={resumeTracking}
            className="flex-1 max-w-[200px] py-5 rounded-3xl font-black text-lg text-black bg-yellow-500 border-b-4 border-yellow-700 hover:bg-yellow-400 transition-all active:scale-95 shadow-2xl"
          >
            RESUME
          </button>
        )}
      </div>
    </div>
  );
}