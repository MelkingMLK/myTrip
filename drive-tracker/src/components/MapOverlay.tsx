import { useEffect, useRef, useState } from 'react';
import Map, { GeolocateControl, NavigationControl, Source, Layer, Marker } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useDriveTracker } from '../hooks/useDriveTracker';
import { routeManager } from '../services/routeManager'; // <-- IMPORTIAMO IL TUO SERVIZIO CLOUD

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

type TripStats = { distance: number; maxSpeed: number; avgSpeed: number; time: number } | null;

type SavedTrip = {
  id: string;
  date: string;
  snapshot: string;
  distance: number;
  time: number;
  maxSpeed: number;
  avgSpeed: number;
};

export default function MapOverlay() {
  // Aggiunto totalTime, pauseTime e totalDistance dal tuo Hook (Sviluppatore 2)
  const {
    status, countdown, totalTime, effectiveTime, pauseTime, currentSpeed, totalDistance, route,
    startCountdown, pauseTracking, resumeTracking, stopTracking
  } = useDriveTracker();

  const mapRef = useRef<any>(null);

  const [showReport, setShowReport] = useState(false);
  const [mapSnapshot, setMapSnapshot] = useState<string | null>(null);
  const [tripStats, setTripStats] = useState<TripStats>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [history, setHistory] = useState<SavedTrip[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const currentPos = route.length > 0 ? route[route.length - 1] : null;

  useEffect(() => {
    if (currentPos && mapRef.current && !showReport && !showHistory) {
      mapRef.current.flyTo({ center: [currentPos.lng, currentPos.lat], zoom: 16, essential: true, duration: 1000 });
    }
  }, [currentPos, showReport, showHistory]);

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleEndJourney = () => {
    const mapInstance = mapRef.current?.getMap();
    
    if (mapInstance) {
      // 1. Catturiamo lo snapshot
      const snapshot = mapInstance.getCanvas().toDataURL('image/png');
      setMapSnapshot(snapshot);

      // 2. Calcoli sicuri (anche se route è vuoto o ha 1 solo punto)
      const dist = totalDistance;
      const maxS = route.length > 0 ? Math.max(...route.map((p: any) => p.speed)) : 0;
      const avgS = effectiveTime > 0 ? (dist / (effectiveTime / 3600)) : 0;

      // 3. Mostriamo il report!
      setTripStats({ distance: dist, maxSpeed: maxS, avgSpeed: avgS, time: effectiveTime });
      setShowReport(true);
    } else {
      console.error("Mappa non ancora caricata");
    }
    
    // Fermiamo il tracciamento
    stopTracking();
  };

  // --- IL TUO COLLEGAMENTO AL BACKEND (Fase 4) ---
  const handleSaveToCloud = async () => {
    if (!tripStats || !mapSnapshot) return;
    
    setIsSaving(true);

    // 1. Prepariamo l'oggetto con le statistiche esatte che si aspetta routeManager
    const statsPayload = {
      distance_km: tripStats.distance,
      avg_speed_kmh: tripStats.avgSpeed,
      max_speed_kmh: tripStats.maxSpeed,
      total_time_seconds: totalTime,
      driving_time_seconds: effectiveTime,
      pause_time_seconds: pauseTime,
      route_data: route 
    };

    // 2. Chiamiamo il VERO salvataggio su Supabase
    const result = await routeManager.saveRoute(mapSnapshot, statsPayload);
    
    setIsSaving(false);

    if (result.success) {
      // Manteniamo la logica visiva del tuo collega per aggiornare subito lo schermo
      const newTrip: SavedTrip = {
        id: Date.now().toString(),
        date: new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
        snapshot: mapSnapshot,
        ...tripStats
      };
      setHistory(prev => [newTrip, ...prev]);

      setShowReport(false);
      
      // Feedback basato sulla rete
      if (result.offline) {
        alert("Sei Offline. Il viaggio è stato salvato nel telefono e verrà caricato appena tornerà la connessione.");
      } else {
        alert("Viaggio salvato nel Cloud con successo! Controlla 'I Miei Percorsi'.");
      }
    } else {
      alert("Si è verificato un errore durante il salvataggio.");
    }
  };

  const routeGeoJSON: any = {
    type: 'FeatureCollection',
    features: route.map((point: any, index: number) => {
      if (index === 0) return null;
      const prev = route[index - 1];
      let segmentColor = '#10B981';
      if (point.speed > 50) segmentColor = '#EF4444';
      else if (point.speed > 30) segmentColor = '#F59E0B';

      return {
        type: 'Feature', properties: { color: segmentColor },
        geometry: { type: 'LineString', coordinates: [[prev.lng, prev.lat], [point.lng, point.lat]] }
      };
    }).filter(Boolean)
  };

  return (
    <div className="relative h-screen w-screen bg-gray-900 overflow-hidden">
      
      {/* Mappa */}
      <Map
        ref={mapRef}
        initialViewState={{ longitude: 8.8251, latitude: 45.8206, zoom: 13 }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        mapboxAccessToken={MAPBOX_TOKEN}
        preserveDrawingBuffer={true}
      >
        <GeolocateControl positionOptions={{ enableHighAccuracy: true }} trackUserLocation showUserHeading position="bottom-right" />
        <NavigationControl position="bottom-right" />

        {route.length > 1 && (
          <Source id="route-source" type="geojson" data={routeGeoJSON}>
            <Layer id="route-layer" type="line" layout={{ 'line-join': 'round', 'line-cap': 'round' }} paint={{ 'line-color': ['get', 'color'], 'line-width': 6 }} />
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

      {/* --- OVERLAY UI PRINCIPALE (Nascosto se c'è report o storico) --- */}
      {!showReport && !showHistory && (
        <>
          {/* Tasto Menù / Storico (Alto a Destra) */}
          <div className="absolute top-6 right-6 z-10">
            <button 
              onClick={() => setShowHistory(true)}
              className="bg-gray-900/90 backdrop-blur-xl border border-white/10 p-3 rounded-full shadow-2xl text-white hover:bg-gray-800 transition-colors active:scale-95"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
          </div>

          {/* Countdown */}
          {status === 'countdown' && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
              <div className="flex flex-col items-center">
                <span className="text-white text-2xl font-bold tracking-widest mb-4">PARTENZA TRA</span>
                <span className="text-9xl font-black text-blue-500 animate-pulse">{countdown}</span>
              </div>
            </div>
          )}

          {/* Header Stato */}
          <div className="absolute top-6 left-0 right-0 flex justify-center pointer-events-none px-4 z-10">
            <div className="flex items-center gap-3 bg-gray-900/90 backdrop-blur-xl border border-white/10 p-3 rounded-2xl shadow-2xl">
              <div className={`h-2 w-2 rounded-full ${status === 'paused' ? 'bg-yellow-500 animate-pulse' : status === 'tracking' ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
              <span className={`font-medium text-sm tracking-tight uppercase ${status === 'paused' ? 'text-yellow-500' : 'text-white'}`}>
                {status === 'paused' ? 'SESSION PAUSED' : status === 'tracking' ? 'Live Tracking' : 'GPS Ready'}
              </span>
            </div>
          </div>

          {/* Tachimetro e Timer */}
          {(status === 'tracking' || status === 'paused') && (
            <div className="absolute top-24 left-6 flex flex-col gap-3 z-10">
               <div className="bg-black/50 backdrop-blur-md p-4 rounded-2xl border w-24 shadow-lg border-white/10">
                  <p className="text-gray-400 text-[10px] font-bold uppercase">KM/H</p>
                  <p className="text-3xl font-black text-white">{currentSpeed.toFixed(0)}</p>
               </div>
               <div className="bg-black/50 backdrop-blur-md p-4 rounded-2xl border w-24 shadow-lg border-white/10">
                  <p className="text-gray-400 text-[10px] font-bold uppercase">TIME</p>
                  <p className="text-xl font-black tracking-wider text-blue-400">{formatTime(effectiveTime)}</p>
               </div>
            </div>
          )}

          {/* Tasti Controllo */}
          <div className="absolute bottom-12 left-0 right-0 px-6 z-10 flex gap-4 justify-center">
            {status === 'idle' && (
              <button onClick={startCountdown} className="flex-1 max-w-[200px] py-5 rounded-3xl font-black text-lg text-white bg-blue-600 border-b-4 border-blue-800 hover:bg-blue-500 transition-all active:scale-95 shadow-2xl">
                START JOURNEY
              </button>
            )}
            {status === 'tracking' && (
              <>
                <button onClick={pauseTracking} className="w-16 h-16 rounded-full flex items-center justify-center font-black transition-all shadow-2xl bg-gray-800 border-b-4 border-gray-900 text-white">||</button>
                <button onClick={handleEndJourney} className="flex-1 max-w-[200px] py-5 rounded-3xl font-black text-lg text-white bg-red-600 border-b-4 border-red-800 hover:bg-red-500 transition-all active:scale-95 shadow-2xl">STOP</button>
              </>
            )}
            {status === 'paused' && (
              <button onClick={resumeTracking} className="flex-1 max-w-[200px] py-5 rounded-3xl font-black text-lg text-black bg-yellow-500 border-b-4 border-yellow-700 hover:bg-yellow-400 transition-all active:scale-95 shadow-2xl">RESUME</button>
            )}
          </div>
        </>
      )}

      {/* --- SCHERMATA RESOCONTO (FASE 4) --- */}
      {showReport && tripStats && (
        <div className="absolute inset-0 z-50 bg-gray-900/95 backdrop-blur-md flex flex-col items-center justify-between p-6 animate-in fade-in zoom-in-95 duration-300">
          <div className="w-full max-w-md mt-8">
            <h2 className="text-3xl font-black text-white mb-6 text-center tracking-tight">Viaggio Completato!</h2>
            
            <div className="w-full h-48 bg-gray-800 rounded-3xl overflow-hidden shadow-2xl border border-white/10 relative">
              {mapSnapshot ? <img src={mapSnapshot} alt="Tracciato Mappa" className="w-full h-full object-cover" /> : <div className="text-gray-500">Immagine non disponibile</div>}
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="bg-gray-800/50 p-4 rounded-2xl border border-white/5">
                <p className="text-gray-400 text-xs font-bold uppercase mb-1">Distanza</p>
                <p className="text-white text-2xl font-black">{tripStats.distance.toFixed(2)} <span className="text-sm text-gray-400 font-medium">km</span></p>
              </div>
              <div className="bg-gray-800/50 p-4 rounded-2xl border border-white/5">
                <p className="text-gray-400 text-xs font-bold uppercase mb-1">Tempo</p>
                <p className="text-white text-2xl font-black">{formatTime(tripStats.time)}</p>
              </div>
              <div className="bg-gray-800/50 p-4 rounded-2xl border border-white/5">
                <p className="text-gray-400 text-xs font-bold uppercase mb-1">Media</p>
                <p className="text-white text-2xl font-black">{Math.round(tripStats.avgSpeed)} <span className="text-sm text-gray-400 font-medium">km/h</span></p>
              </div>
              <div className="bg-gray-800/50 p-4 rounded-2xl border border-white/5">
                <p className="text-gray-400 text-xs font-bold uppercase mb-1">Vel Max</p>
                <p className="text-white text-2xl font-black">{tripStats.maxSpeed.toFixed(1)} <span className="text-sm text-gray-400 font-medium">km/h</span></p>
              </div>
            </div>
          </div>

          <div className="w-full max-w-md mb-8 flex flex-col gap-3">
            <button onClick={handleSaveToCloud} disabled={isSaving} className={`w-full py-5 rounded-3xl font-black text-lg transition-all shadow-xl flex justify-center items-center gap-2 ${isSaving ? 'bg-blue-800 text-blue-300' : 'bg-blue-600 text-white hover:bg-blue-500 border-b-4 border-blue-800'}`}>
              {isSaving ? 'Salvataggio in corso...' : 'SALVA NEL CLOUD'}
            </button>
            <button onClick={() => setShowReport(false)} disabled={isSaving} className="w-full py-4 rounded-3xl font-bold text-gray-400 hover:text-white transition-colors">Scarta Viaggio</button>
          </div>
        </div>
      )}

      {/* --- SCHERMATA I MIEI PERCORSI (FASE 5) --- */}
      {showHistory && (
        <div className="absolute inset-0 z-50 bg-gray-900 flex flex-col p-6 animate-in slide-in-from-right duration-300">
          
          <div className="flex items-center justify-between mt-8 mb-6">
            <h2 className="text-3xl font-black text-white tracking-tight">I Miei Percorsi</h2>
            <button onClick={() => setShowHistory(false)} className="bg-gray-800 p-3 rounded-full text-gray-400 hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pb-10 flex flex-col gap-4">
            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4">
                <svg className="w-16 h-16 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                <p className="font-medium">Nessun viaggio salvato.</p>
              </div>
            ) : (
              history.map((trip) => (
                <div key={trip.id} className="bg-gray-800 rounded-2xl p-3 flex gap-4 border border-white/5 shadow-lg active:scale-[0.98] transition-all cursor-pointer">
                  <div className="w-24 h-24 rounded-xl overflow-hidden bg-gray-900 flex-shrink-0">
                    <img src={trip.snapshot} alt="Mappa" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex flex-col justify-center flex-1">
                    <p className="text-gray-400 text-xs font-semibold uppercase">{trip.date}</p>
                    <div className="flex items-baseline gap-1 mt-1">
                      <p className="text-white text-xl font-black">{trip.distance.toFixed(2)}</p>
                      <p className="text-gray-400 text-sm font-medium">km</p>
                    </div>
                    <div className="flex gap-4 mt-2">
                      <div className="flex items-center gap-1">
                        <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <p className="text-gray-300 text-xs font-medium">{formatTime(trip.time)}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <svg className="w-3 h-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        <p className="text-gray-300 text-xs font-medium">{trip.maxSpeed.toFixed(1)} km/h</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

    </div>
  );
}