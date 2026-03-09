import { useState, useRef, useEffect } from 'react';
import Map, { GeolocateControl, NavigationControl, Source, Layer, Marker } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Recuperiamo il token in modo sicuro dalle variabili d'ambiente
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

// Definiamo i tipi per Typescript
type TrackPoint = { lng: number; lat: number; speed: number };
type CurrentPos = { lng: number; lat: number } | null;

export default function MapOverlay() {
  // --- STATI DELL'APPLICAZIONE ---
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  const [route, setRoute] = useState<TrackPoint[]>([]);
  const [currentPos, setCurrentPos] = useState<CurrentPos>(null);
  
  // --- REFERENZE (Per controllare la mappa e il GPS) ---
  const mapRef = useRef<any>(null);
  const watchId = useRef<number | null>(null);
  const isPausedRef = useRef(false);

  // Manteniamo aggiornata la ref della pausa per usarla dentro il GPS
  useEffect(() => { 
    isPausedRef.current = isPaused; 
  }, [isPaused]);

  // --- LOGICA TIMER ---
  useEffect(() => {
    let interval: number | undefined;
    if (isTracking && !isPaused) {
      interval = window.setInterval(() => setElapsedTime(prev => prev + 1), 1000);
    } else {
      window.clearInterval(interval);
    }
    return () => window.clearInterval(interval);
  }, [isTracking, isPaused]);

  // Funzione di formattazione tempo (MM:SS)
  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // --- GESTIONE START / STOP GPS ---
  const handleToggleTracking = () => {
    if (!isTracking) {
      if ("geolocation" in navigator) {
        setIsTracking(true);
        setIsPaused(false);
        setElapsedTime(0);
        setRoute([]); // Svuota il vecchio percorso
        
        watchId.current = navigator.geolocation.watchPosition(
          (position) => {
            const { latitude, longitude, speed: mps } = position.coords;
            const currentSpeed = Math.round((mps || 0) * 3.6);
            
            // 1. Aggiorna tachimetro e posizione attuale (Pallino Blu)
            setSpeed(currentSpeed);
            setCurrentPos({ lng: longitude, lat: latitude });

            // 2. Muovi la telecamera della mappa fluidamente
            mapRef.current?.flyTo({ 
              center: [longitude, latitude], 
              zoom: 16, 
              essential: true, 
              duration: 2000 
            });

            // 3. Se NON siamo in pausa, disegna la scia
            if (!isPausedRef.current) {
              setRoute(prev => [...prev, { lng: longitude, lat: latitude, speed: currentSpeed }]);
            }
          },
          (error) => {
            console.error("Errore GPS:", error);
            alert("Assicurati di aver dato i permessi di localizzazione al browser!");
          },
          { enableHighAccuracy: true, maximumAge: 1000 }
        );
      }
    } else {
      // Spegni tutto
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      setIsTracking(false);
      setIsPaused(false);
      setSpeed(0);
      setCurrentPos(null);
    }
  };

  // --- LOGICA GEOJSON PER LA LINEA (Colori in base alla velocità) ---
  const routeGeoJSON: any = {
    type: 'FeatureCollection',
    features: route.map((point, index) => {
      if (index === 0) return null; // Salta il primo punto isolato
      const prev = route[index - 1];
      
      let segmentColor = '#10B981'; // Verde (0-30 km/h)
      if (point.speed > 50) segmentColor = '#EF4444'; // Rosso (>50 km/h)
      else if (point.speed > 30) segmentColor = '#F59E0B'; // Arancione (30-50 km/h)

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
        initialViewState={{ longitude: 8.8251, latitude: 45.8206, zoom: 13 }} // Varese
        mapStyle="mapbox://styles/mapbox/dark-v11"
        mapboxAccessToken={MAPBOX_TOKEN}
      >
        <GeolocateControl positionOptions={{ enableHighAccuracy: true }} trackUserLocation showUserHeading position="bottom-right" />
        <NavigationControl position="bottom-right" />

        {/* --- LINEA DEL PERCORSO --- */}
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

        {/* --- IL NOSTRO PALLINO BLU PERSONALIZZATO --- */}
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

      {/* HEADER DI STATO */}
      <div className="absolute top-6 left-0 right-0 flex justify-center pointer-events-none px-4 z-10">
        <div className="flex items-center gap-3 bg-gray-900/90 backdrop-blur-xl border border-white/10 p-3 rounded-2xl shadow-2xl transition-all">
          <div className={`h-2 w-2 rounded-full ${isPaused ? 'bg-yellow-500 animate-pulse' : isTracking ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
          <span className={`font-medium text-sm tracking-tight uppercase ${isPaused ? 'text-yellow-500' : 'text-white'}`}>
            {isPaused ? 'SESSION PAUSED' : isTracking ? 'Live Tracking' : 'GPS Ready'}
          </span>
        </div>
      </div>

      {/* MENU ALTO A DESTRA */}
      <div className="absolute top-6 right-6 z-10">
        <button className="bg-gray-900/90 backdrop-blur-xl border border-white/10 p-3 rounded-full shadow-2xl text-white hover:bg-gray-800 transition-colors active:scale-95">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* PANNELLO STATISTICHE */}
      {isTracking && (
        <div className="absolute top-24 left-6 flex flex-col gap-3 z-10 transition-opacity duration-300">
           <div className={`bg-black/50 backdrop-blur-md p-4 rounded-2xl border w-24 shadow-lg transition-colors ${isPaused ? 'border-yellow-500/30' : 'border-white/10'}`}>
              <p className="text-gray-400 text-[10px] font-bold uppercase">KM/H</p>
              <p className={`text-3xl font-black ${isPaused ? 'text-gray-500' : 'text-white'}`}>{speed}</p>
           </div>
           <div className={`bg-black/50 backdrop-blur-md p-4 rounded-2xl border w-24 shadow-lg transition-colors ${isPaused ? 'border-yellow-500/30' : 'border-white/10'}`}>
              <p className="text-gray-400 text-[10px] font-bold uppercase">TIME</p>
              <p className={`text-xl font-black tracking-wider ${isPaused ? 'text-yellow-500' : 'text-blue-400'}`}>
                {formatTime(elapsedTime)}
              </p>
           </div>
        </div>
      )}

      {/* TASTI CONTROLLO */}
      <div className="absolute bottom-12 left-0 right-0 px-6 z-10 flex gap-4 justify-center">
        {isTracking && (
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`w-16 h-16 rounded-full flex items-center justify-center font-black transition-all active:scale-95 shadow-2xl border-b-4 ${
              isPaused ? 'bg-yellow-500 border-yellow-700 text-black' : 'bg-gray-800 border-gray-900 text-white'
            }`}
          >
            {isPaused ? '▶' : '||'}
          </button>
        )}
        <button
          onClick={handleToggleTracking}
          className={`flex-1 max-w-[200px] py-5 rounded-3xl font-black text-lg transition-all active:scale-95 shadow-2xl border-b-4 
            ${isTracking 
              ? 'bg-red-600 border-red-800 text-white hover:bg-red-500' 
              : 'bg-blue-600 border-blue-800 text-white hover:bg-blue-500'}`}
        >
          {isTracking ? 'STOP' : 'START JOURNEY'}
        </button>
      </div>
    </div>
  );
}