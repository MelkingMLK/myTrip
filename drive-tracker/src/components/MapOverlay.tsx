import { useEffect, useRef, useState } from 'react';
import Map, { GeolocateControl, NavigationControl, Source, Layer, Marker } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useDriveTracker } from '../hooks/useDriveTracker';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

type TripStats = { distance: number; maxSpeed: number; avgSpeed: number; time: number } | null;
type SavedTrip = { id: string; date: string; snapshot: string; distance: number; time: number; maxSpeed: number; avgSpeed: number; };

const calculateDistance = (route: any[]) => {
  let totalDist = 0;
  for (let i = 1; i < route.length; i++) {
    const p1 = route[i - 1]; const p2 = route[i];
    const R = 6371;
    const dLat = (p2.lat - p1.lat) * (Math.PI / 180); const dLon = (p2.lng - p1.lng) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(p1.lat * (Math.PI / 180)) * Math.cos(p2.lat * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    totalDist += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return totalDist;
};

export default function MapOverlay() {
  const {
    status, countdown, effectiveTime, currentSpeed, route,
    startCountdown, pauseTracking, resumeTracking, stopTracking
  } = useDriveTracker();

  const mapRef = useRef<any>(null);

  const [activeView, setActiveView] = useState<'map' | 'menu' | 'history' | 'settings' | 'tripDetail'>('map');
  const [selectedTrip, setSelectedTrip] = useState<SavedTrip | null>(null);

  const [showReport, setShowReport] = useState(false);
  const [mapSnapshot, setMapSnapshot] = useState<string | null>(null);
  const [tripStats, setTripStats] = useState<TripStats>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [history, setHistory] = useState<SavedTrip[]>([]);

  // 6.1.3 STATO TEMA SCURO/CHIARO
  const [isDarkMode, setIsDarkMode] = useState(true);

  const currentPos = route.length > 0 ? route[route.length - 1] : null;

  useEffect(() => {
    if (currentPos && mapRef.current && activeView === 'map' && !showReport) {
      mapRef.current.flyTo({ center: [currentPos.lng, currentPos.lat], zoom: 16, essential: true, duration: 1000 });
    }
  }, [currentPos, activeView, showReport]);

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleEndJourney = () => {
    const mapInstance = mapRef.current?.getMap();
    if (mapInstance && route.length > 1) {
      const snapshot = mapInstance.getCanvas().toDataURL('image/png');
      setMapSnapshot(snapshot);
      const dist = calculateDistance(route);
      const maxS = Math.max(...route.map((p: any) => p.speed));
      const avgS = effectiveTime > 0 ? (dist / (effectiveTime / 3600)) : 0;
      setTripStats({ distance: dist, maxSpeed: maxS, avgSpeed: avgS, time: effectiveTime });
      setShowReport(true);
    }
    stopTracking();
  };

  const handleSaveToCloud = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      if (tripStats && mapSnapshot) {
        const newTrip: SavedTrip = {
          id: Date.now().toString(),
          date: new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
          snapshot: mapSnapshot,
          ...tripStats
        };
        setHistory(prev => [newTrip, ...prev]);
      }
      setShowReport(false);
      setActiveView('history'); 
    }, 2000);
  };

  const routeGeoJSON: any = {
    type: 'FeatureCollection',
    features: route.map((point: any, index: number) => {
      if (index === 0) return null;
      const prev = route[index - 1];
      let segmentColor = '#10B981';
      if (point.speed > 50) segmentColor = '#EF4444';
      else if (point.speed > 30) segmentColor = '#F59E0B';
      return { type: 'Feature', properties: { color: segmentColor }, geometry: { type: 'LineString', coordinates: [[prev.lng, prev.lat], [point.lng, point.lat]] } };
    }).filter(Boolean)
  };

  // Classi dinamiche per il tema
  const themeBg = isDarkMode ? 'bg-gray-900' : 'bg-gray-50';
  const themeText = isDarkMode ? 'text-white' : 'text-gray-900';
  const themeCard = isDarkMode ? 'bg-gray-800 border-white/5' : 'bg-white border-gray-200 shadow-xl';
  const themeGlass = isDarkMode ? 'bg-gray-900/90 border-white/10' : 'bg-white/90 border-gray-200 shadow-xl';

  return (
    <div className={`relative h-screen w-screen overflow-hidden transition-colors duration-500 ${themeBg} ${themeText}`}>
      
      <Map
        ref={mapRef}
        initialViewState={{ longitude: 8.8251, latitude: 45.8206, zoom: 13 }}
        mapStyle={isDarkMode ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/light-v11"}
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

      {/* --- VISTA PRINCIPALE (MAPPA ATTIVA) --- */}
      {activeView === 'map' && !showReport && (
        <>
          {/* 6.1.1 Safe Area (mt-[env(safe-area-inset-top)]) */}
          <div className="absolute top-6 right-6 z-10 mt-[env(safe-area-inset-top)]">
            <button 
              onClick={() => setActiveView('menu')}
              className={`${themeGlass} backdrop-blur-xl border p-3 rounded-full transition-all active:scale-95`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
          </div>

          {status === 'countdown' && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
              <div className="flex flex-col items-center">
                <span className="text-2xl font-bold tracking-widest mb-4 text-white">PARTENZA TRA</span>
                <span className="text-9xl font-black text-blue-500 animate-pulse">{countdown}</span>
              </div>
            </div>
          )}

          <div className="absolute top-6 left-0 right-0 flex justify-center pointer-events-none px-4 z-10 mt-[env(safe-area-inset-top)]">
            <div className={`flex items-center gap-3 ${themeGlass} backdrop-blur-xl border p-3 rounded-2xl transition-all`}>
              <div className={`h-2 w-2 rounded-full ${status === 'paused' ? 'bg-yellow-500 animate-pulse' : status === 'tracking' ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
              <span className={`font-medium text-sm tracking-tight uppercase ${status === 'paused' ? 'text-yellow-500' : ''}`}>
                {status === 'paused' ? 'SESSION PAUSED' : status === 'tracking' ? 'LIVE TRACKING' : 'ONLINE'}
              </span>
            </div>
          </div>

          {(status === 'tracking' || status === 'paused') && (
            <div className="absolute top-24 left-6 flex flex-col gap-3 z-10 mt-[env(safe-area-inset-top)]">
               <div className={`${isDarkMode ? 'bg-black/50 border-white/10 text-white' : 'bg-white/80 border-gray-200 text-gray-900 shadow-xl'} backdrop-blur-md p-4 rounded-2xl border w-24 transition-colors`}>
                  <p className="text-gray-400 text-[10px] font-bold uppercase">KM/H</p>
                  <p className="text-3xl font-black">{currentSpeed.toFixed(0)}</p>
               </div>
               <div className={`${isDarkMode ? 'bg-black/50 border-white/10' : 'bg-white/80 border-gray-200 shadow-xl'} backdrop-blur-md p-4 rounded-2xl border w-24 transition-colors`}>
                  <p className="text-gray-400 text-[10px] font-bold uppercase">TIME</p>
                  <p className="text-xl font-black tracking-wider text-blue-500">{formatTime(effectiveTime)}</p>
               </div>
            </div>
          )}

          {/* 6.1.1 Safe Area Bottom (mb-[env(safe-area-inset-bottom)]) */}
          <div className="absolute bottom-8 left-0 right-0 px-6 z-10 flex gap-4 justify-center mb-[env(safe-area-inset-bottom)]">
            {status === 'idle' && (
              <button onClick={startCountdown} className="flex-1 max-w-[200px] py-5 rounded-3xl font-black text-lg text-white bg-blue-600 border-b-4 border-blue-800 hover:bg-blue-500 active:scale-95 shadow-2xl tracking-wide transition-all">
                START
              </button>
            )}
            {status === 'tracking' && (
              <>
                <button onClick={pauseTracking} className="w-16 h-16 rounded-full flex items-center justify-center font-black shadow-2xl bg-gray-800 border-b-4 border-gray-900 text-white active:scale-95 transition-all">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>
                </button>
                <button onClick={handleEndJourney} className="flex-1 max-w-[200px] py-5 rounded-3xl font-black text-lg bg-red-600 border-b-4 border-red-800 text-white hover:bg-red-500 active:scale-95 shadow-2xl tracking-wide transition-all">STOP</button>
              </>
            )}
            {status === 'paused' && (
              <button onClick={resumeTracking} className="flex-1 max-w-[200px] py-5 rounded-3xl font-black text-lg text-black bg-yellow-500 border-b-4 border-yellow-700 hover:bg-yellow-400 active:scale-95 shadow-2xl tracking-wide transition-all">RESUME</button>
            )}
          </div>
        </>
      )}

      {/* --- SCHERMATA RESOCONTO DI FINE VIAGGIO --- */}
      {showReport && tripStats && (
        <div className={`absolute inset-0 z-50 ${isDarkMode ? 'bg-gray-900/95' : 'bg-gray-100/95'} backdrop-blur-md flex flex-col items-center justify-between p-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] animate-in fade-in zoom-in-95 duration-300`}>
          <div className="w-full max-w-md mt-8">
            <h2 className="text-3xl font-black mb-6 text-center tracking-tight">Viaggio Completato!</h2>
            <div className="w-full h-48 bg-gray-800 rounded-3xl overflow-hidden shadow-2xl border border-white/10 relative">
              {mapSnapshot ? <img src={mapSnapshot} alt="Snapshot" className="w-full h-full object-cover" /> : null}
            </div>
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className={`${themeCard} p-4 rounded-2xl border`}>
                <p className="text-gray-400 text-xs font-bold uppercase mb-1">Distanza</p>
                <p className="text-2xl font-black">{tripStats.distance.toFixed(2)} <span className="text-sm font-medium">km</span></p>
              </div>
              <div className={`${themeCard} p-4 rounded-2xl border`}>
                <p className="text-gray-400 text-xs font-bold uppercase mb-1">Tempo</p>
                <p className="text-2xl font-black">{formatTime(tripStats.time)}</p>
              </div>
              <div className={`${themeCard} p-4 rounded-2xl border`}>
                <p className="text-gray-400 text-xs font-bold uppercase mb-1">Media</p>
                <p className="text-2xl font-black">{Math.round(tripStats.avgSpeed)} <span className="text-sm font-medium">km/h</span></p>
              </div>
              <div className={`${themeCard} p-4 rounded-2xl border`}>
                <p className="text-gray-400 text-xs font-bold uppercase mb-1">Vel Max</p>
                <p className="text-2xl font-black">{tripStats.maxSpeed.toFixed(1)} <span className="text-sm font-medium">km/h</span></p>
              </div>
            </div>
          </div>
          <div className="w-full max-w-md mb-8 flex flex-col gap-3">
            <button onClick={handleSaveToCloud} disabled={isSaving} className={`w-full py-5 rounded-3xl font-black text-lg transition-all shadow-xl flex justify-center items-center gap-2 ${isSaving ? 'bg-blue-800 text-blue-300' : 'bg-blue-600 text-white hover:bg-blue-500 border-b-4 border-blue-800'}`}>
              {isSaving ? 'INVIO DATI...' : 'SALVA NEL CLOUD'}
            </button>
            <button onClick={() => setShowReport(false)} disabled={isSaving} className="w-full py-4 rounded-3xl font-bold text-gray-500 hover:text-gray-400 transition-colors">Scarta Dati</button>
          </div>
        </div>
      )}

      {/* --- MENU LATERALE --- */}
      {activeView === 'menu' && (
        <div className={`absolute inset-0 z-50 ${isDarkMode ? 'bg-gray-900/98' : 'bg-white/98'} flex flex-col p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] animate-in slide-in-from-right duration-300`}>
          <div className="flex justify-between items-center mb-10">
            <h2 className="text-4xl font-black tracking-tighter text-blue-500">Road<span className={themeText}>Record</span></h2>
            <button onClick={() => setActiveView('map')} className={`p-2 ${themeCard} rounded-full transition-colors active:scale-95`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          
          <div className="flex flex-col gap-4">
            <button onClick={() => setActiveView('history')} className={`flex items-center gap-4 ${themeCard} p-5 rounded-2xl border active:scale-95 transition-all text-left`}>
              <div className="p-2 bg-blue-500/20 rounded-lg text-blue-500">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
              </div>
              <span className="font-bold text-lg">I Miei Percorsi</span>
            </button>
            <button onClick={() => setActiveView('settings')} className={`flex items-center gap-4 ${themeCard} p-5 rounded-2xl border active:scale-95 transition-all text-left`}>
              <div className="p-2 bg-gray-500/20 rounded-lg text-gray-500">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </div>
              <span className="font-bold text-lg">Settings</span>
            </button>
          </div>
        </div>
      )}

      {/* --- 5.1.1 IMPOSTAZIONI --- */}
      {activeView === 'settings' && (
        <div className={`absolute inset-0 z-50 ${themeBg} flex flex-col p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] animate-in slide-in-from-right duration-300`}>
          <div className="flex items-center gap-4 mb-8">
            <button onClick={() => setActiveView('menu')} className={`p-2 ${themeCard} rounded-full transition-colors active:scale-95`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <h2 className="text-2xl font-black">Settings</h2>
          </div>
          
          <div className="flex flex-col gap-4">
            <div className={`${themeCard} p-5 rounded-2xl flex justify-between items-center border`}>
              <div>
                <p className="font-bold">Tema Scuro</p>
                <p className="text-xs text-gray-500">Mappa e Interfaccia</p>
              </div>
              {/* 6.1.3 TOGGLE DARK MODE FUNZIONANTE */}
              <input 
                type="checkbox" 
                checked={isDarkMode} 
                onChange={() => setIsDarkMode(!isDarkMode)} 
                className="w-6 h-6 accent-blue-500 rounded-md" 
              />
            </div>
            <div className={`${themeCard} p-5 rounded-2xl flex justify-between items-center border`}>
              <div>
                <p className="font-bold">Alta Precisione GPS</p>
                <p className="text-xs text-gray-500">Consuma più batteria</p>
              </div>
              <input type="checkbox" defaultChecked className="w-6 h-6 accent-blue-500 rounded-md" />
            </div>
          </div>
        </div>
      )}

      {/* --- 5.1.2 I MIEI PERCORSI (LISTA) --- */}
      {activeView === 'history' && (
        <div className={`absolute inset-0 z-50 ${themeBg} flex flex-col p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] animate-in slide-in-from-right duration-300`}>
          <div className="flex items-center gap-4 mb-6">
            <button onClick={() => setActiveView('menu')} className={`p-2 ${themeCard} rounded-full transition-colors active:scale-95`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <h2 className="text-2xl font-black">Archivio Viaggi</h2>
          </div>

          <div className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)] flex flex-col gap-4">
            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-2">
                <svg className="w-16 h-16 opacity-50 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                <p className="font-medium text-lg text-gray-400">L'archivio è vuoto.</p>
              </div>
            ) : (
              history.map((trip) => (
                <div key={trip.id} onClick={() => { setSelectedTrip(trip); setActiveView('tripDetail'); }} className={`${themeCard} rounded-2xl p-3 flex gap-4 border shadow-lg active:scale-[0.98] transition-all cursor-pointer`}>
                  <div className="w-24 h-24 rounded-xl overflow-hidden bg-gray-900 flex-shrink-0 border border-black/10">
                    <img src={trip.snapshot} alt="Mappa" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex flex-col justify-center flex-1">
                    <p className="text-gray-500 text-xs font-semibold uppercase">{trip.date}</p>
                    <div className="flex items-baseline gap-1 mt-1">
                      <p className="text-xl font-black">{trip.distance.toFixed(2)}</p>
                      <p className="text-gray-500 text-sm font-medium">km</p>
                    </div>
                    <div className="flex gap-4 mt-2">
                      <div className="flex items-center gap-1 text-blue-500">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <p className="text-xs font-medium">{formatTime(trip.time)}</p>
                      </div>
                      <div className="flex items-center gap-1 text-red-500">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        <p className="text-xs font-medium">{trip.maxSpeed.toFixed(1)} km/h</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* --- 5.1.3 DETTAGLIO STORICO (FULL SCREEN) --- */}
      {activeView === 'tripDetail' && selectedTrip && (
        <div className={`absolute inset-0 z-50 ${themeBg} flex flex-col animate-in zoom-in-95 duration-200`}>
          <div className="relative h-[45%] w-full bg-black">
            <img src={selectedTrip.snapshot} alt="Dettaglio Mappa" className="w-full h-full object-cover opacity-80" />
            <div className="absolute top-0 left-0 right-0 p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] bg-gradient-to-b from-black/80 to-transparent flex justify-between">
              <button onClick={() => setActiveView('history')} className="p-3 bg-gray-900/80 backdrop-blur-md rounded-full text-white shadow-lg active:scale-95 transition-all">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              </button>
              <div className="bg-blue-600/90 backdrop-blur-md px-4 py-2 rounded-full font-bold shadow-lg text-white">
                {selectedTrip.date}
              </div>
            </div>
            <div className={`absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t ${isDarkMode ? 'from-gray-900' : 'from-gray-50'} to-transparent`}></div>
          </div>

          <div className="flex-1 p-6 -mt-8 relative z-10 flex flex-col gap-4 pb-[env(safe-area-inset-bottom)]">
            <div className={`${themeCard} p-6 rounded-3xl border shadow-2xl flex flex-col gap-6`}>
              <div className={`flex justify-between items-end border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} pb-6`}>
                <div>
                  <p className="text-gray-500 text-sm font-bold uppercase mb-1">Distanza Percorsa</p>
                  <p className="text-5xl font-black">{selectedTrip.distance.toFixed(2)} <span className="text-xl text-gray-500 font-bold">km</span></p>
                </div>
                <div className="text-right">
                  <p className="text-gray-500 text-sm font-bold uppercase mb-1">Tempo</p>
                  <p className="text-2xl font-bold text-blue-500">{formatTime(selectedTrip.time)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                   <p className="text-gray-500 text-xs font-bold uppercase mb-1">Velocità Media</p>
                   <p className="text-2xl font-black">{Math.round(selectedTrip.avgSpeed)} <span className="text-sm text-gray-500 font-bold">km/h</span></p>
                 </div>
                 <div>
                   <p className="text-gray-500 text-xs font-bold uppercase mb-1">Vel. Massima</p>
                   <p className="text-2xl font-black text-red-500">{selectedTrip.maxSpeed.toFixed(1)} <span className="text-sm text-gray-500 font-bold">km/h</span></p>
                 </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}