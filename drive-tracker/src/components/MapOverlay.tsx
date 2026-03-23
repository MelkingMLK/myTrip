import { useEffect, useRef, useState } from 'react';
import Map, { GeolocateControl, NavigationControl, Source, Layer, Marker } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useDriveTracker } from '../hooks/useDriveTracker';

import { userManager } from '../services/userManager';
import { spotifyManager } from '../services/spotifyManager';

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

  const [activeView, setActiveView] = useState<'map' | 'menu' | 'history' | 'settings' | 'tripDetail' | 'stats' | 'garage'>('map');
  const [selectedTrip, setSelectedTrip] = useState<SavedTrip | null>(null);

  const [showReport, setShowReport] = useState(false);
  const [mapSnapshot, setMapSnapshot] = useState<string | null>(null);
  const [tripStats, setTripStats] = useState<TripStats>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [history, setHistory] = useState<SavedTrip[]>([]);

  const [isDarkMode, setIsDarkMode] = useState(true);

  const [globalStats, setGlobalStats] = useState<any>(null);

  const [carIcon, setCarIcon] = useState<'dot' | 'arrow' | 'sport'>('arrow');
  const [carColor, setCarColor] = useState('#3b82f6'); 

  const [enableSpotify, setEnableSpotify] = useState(true);
  const [currentSong, setCurrentSong] = useState<any>(null);
  const spotifyToken = localStorage.getItem('spotifyToken'); 

  const currentPos = route.length > 0 ? route[route.length - 1] : null;

  // Caricamento Preferenze Garage (Fix TypeScript con 'any')
  useEffect(() => {
    userManager.getPreferences().then((prefs: any) => {
      if (prefs) {
        if (prefs.icon) setCarIcon(prefs.icon);
        if (prefs.color) setCarColor(prefs.color);
      }
    });
  }, []);

  useEffect(() => {
    if (activeView === 'stats') {
      userManager.getUserRecords().then(data => setGlobalStats(data));
    }
  }, [activeView]);

  useEffect(() => {
    let interval: any;
    if ((status === 'tracking' || status === 'paused') && enableSpotify && spotifyToken) {
      const fetchSong = async () => {
        try {
          const song = await spotifyManager.getCurrentlyPlaying(spotifyToken);
          setCurrentSong(song);
        } catch (e) { console.error("Errore Spotify", e); }
      };
      fetchSong(); 
      interval = setInterval(fetchSong, 5000); 
    } else {
      setCurrentSong(null); 
    }
    return () => clearInterval(interval);
  }, [status, enableSpotify, spotifyToken]);

  const handleCarIconChange = async (icon: string) => {
    setCarIcon(icon as any);
    await userManager.savePreferences(icon, carColor);
  };

  const handleCarColorChange = async (color: string) => {
    setCarColor(color);
    await userManager.savePreferences(carIcon, color);
  };

  useEffect(() => {
    if (currentPos && mapRef.current && activeView === 'map' && !showReport) {
      mapRef.current.flyTo({ center: [currentPos.lng, currentPos.lat], zoom: 16, essential: true, duration: 1000 });
    }
  }, [currentPos, activeView, showReport]);

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
  };

  const handleCancelCountdown = () => stopTracking();

  const handleEndJourney = () => {
    const mapInstance = mapRef.current?.getMap();
    if (mapInstance && route.length > 1) {
      const bounds = route.reduce(
        (acc: number[], point: any) => [
          Math.min(acc[0], point.lng), Math.min(acc[1], point.lat),
          Math.max(acc[2], point.lng), Math.max(acc[3], point.lat)
        ],
        [180, 90, -180, -90]
      );
      mapInstance.fitBounds([[bounds[0], bounds[1]], [bounds[2], bounds[3]]], { padding: 50, duration: 1000 });

      setTimeout(() => {
        const snapshot = mapInstance.getCanvas().toDataURL('image/png');
        setMapSnapshot(snapshot);
        const dist = calculateDistance(route);
        const avgS = effectiveTime > 0 ? (dist / (effectiveTime / 3600)) : 0;
        
        let maxS = 0;
        if (route.length > 0) maxS = route[0].speed;
        for (let i = 1; i < route.length; i++) {
          const delta = Math.abs(route[i].speed - route[i - 1].speed);
          if (delta <= 20) { if (route[i].speed > maxS) maxS = route[i].speed; }
        }
        
        setTripStats({ distance: dist, maxSpeed: maxS, avgSpeed: avgS, time: effectiveTime });
        setShowReport(true);
      }, 1200);

    } else {
      resetForNewTrip();
    }
    stopTracking();
  };

  const resetForNewTrip = () => {
    setShowReport(false); setTripStats(null); setMapSnapshot(null); setActiveView('map'); stopTracking();
  };

  const handleDiscard = () => {
    if(window.confirm("Sicuro di voler scartare questo viaggio?")) resetForNewTrip();
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
      resetForNewTrip();
      setActiveView('history'); 
    }, 1000);
  };

  const handleDeleteTrip = () => {
    if (selectedTrip && window.confirm("Eliminare definitivamente questo percorso?")) {
      setHistory(prev => prev.filter(t => t.id !== selectedTrip.id));
      setActiveView('history');
      setSelectedTrip(null);
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
      return { type: 'Feature', properties: { color: segmentColor }, geometry: { type: 'LineString', coordinates: [[prev.lng, prev.lat], [point.lng, point.lat]] } };
    }).filter(Boolean)
  };

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
            <div className="relative flex items-center justify-center transition-transform duration-300 drop-shadow-xl" style={{ color: carColor }}>
              {carIcon === 'dot' && (
                <>
                  <div className="absolute h-8 w-8 animate-ping rounded-full opacity-60" style={{ backgroundColor: carColor }}></div>
                  <div className="relative z-10 h-5 w-5 rounded-full border-2 border-white shadow-lg" style={{ backgroundColor: carColor }}></div>
                </>
              )}
              {carIcon === 'arrow' && (
                <svg className="w-8 h-8 drop-shadow-lg transform -rotate-45" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 10.5L21 3L13.5 21L11.5 13.5L3 10.5Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
                </svg>
              )}
              {carIcon === 'sport' && (
                <svg className="w-10 h-10 drop-shadow-xl" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5H6.5C5.84 5 5.28 5.42 5.08 6.01L3 12V20C3 20.55 3.45 21 4 21H5C5.55 21 6 20.55 6 20V19H18V20C18 20.55 18.45 21 19 21H20C20.55 21 21 20.55 21 20V12L18.92 6.01ZM6.5 6.5H17.5L18.5 9.5H5.5L6.5 6.5ZM7.5 16.5C6.67 16.5 6 15.83 6 15C6 14.17 6.67 13.5 7.5 13.5C8.33 13.5 9 14.17 9 15C9 15.83 8.33 16.5 7.5 16.5ZM16.5 16.5C15.67 16.5 15 15.83 15 15C15 14.17 15.67 13.5 16.5 13.5C17.33 13.5 18 14.17 18 15C18 15.83 17.33 16.5 16.5 16.5Z" />
                </svg>
              )}
            </div>
          </Marker>
        )}
      </Map>

      {activeView === 'map' && !showReport && (
        <>
          <div className="absolute top-6 right-6 z-10 mt-[env(safe-area-inset-top)]">
            <button onClick={() => setActiveView('menu')} className={`${themeGlass} backdrop-blur-xl border p-3 rounded-full transition-all active:scale-95`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
          </div>

          {status === 'countdown' && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
              <div className="flex flex-col items-center">
                <span className="text-2xl font-bold tracking-widest mb-4 text-white">PARTENZA TRA</span>
                <span className="text-9xl font-black text-blue-500 animate-pulse">{countdown}</span>
                <button onClick={handleCancelCountdown} className="mt-12 px-8 py-3 rounded-full border-2 border-white/20 text-gray-300 hover:bg-white/10 hover:text-white font-bold tracking-widest uppercase transition-all active:scale-95">Annulla Partenza</button>
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

          {enableSpotify && (status === 'tracking' || status === 'paused') && (
            <div className={`absolute bottom-32 left-6 right-6 md:left-1/2 md:-translate-x-1/2 md:w-96 z-10 ${themeGlass} backdrop-blur-xl p-3 rounded-3xl border flex items-center gap-4 shadow-2xl animate-in slide-in-from-bottom-10 fade-in duration-500`}>
              {currentSong ? (
                <>
                  <div className="relative w-12 h-12 flex-shrink-0 rounded-xl overflow-hidden shadow-lg border border-white/10 bg-gray-800">
                    <img src={currentSong.image} alt="Album Cover" className={`w-full h-full object-cover transition-transform duration-[10s] ${currentSong.is_playing ? 'scale-110' : 'scale-100 grayscale'}`} />
                    <div className="absolute top-1 left-1 bg-black/50 rounded-full p-0.5"><svg className="w-3 h-3 text-[#1DB954]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.24 1.021zM18.84 14.4c-.3.42-.84.54-1.26.24-3.36-2.04-8.52-2.64-12.54-1.44-.48.12-1.02-.12-1.14-.6-.12-.48.12-1.02.6-1.14 4.56-1.32 10.32-.66 14.1 1.68.42.24.54.84.24 1.26zm.12-3.12c-4.02-2.4-10.56-2.64-14.4-1.44-.6.18-1.2-.18-1.38-.78-.18-.6.18-1.2.78-1.38 4.44-1.32 11.64-1.02 16.2 1.26.54.3.72 1.02.42 1.56-.3.54-1.02.72-1.62.42z"/></svg></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-black truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{currentSong.title}</p>
                    <p className={`text-xs font-medium truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{currentSong.artist}</p>
                  </div>
                </>
              ) : !spotifyToken ? (
                <div className="flex-1 min-w-0 px-2 flex items-center gap-3">
                  <div className="p-2 bg-[#1DB954]/20 rounded-full text-[#1DB954]"><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.24 1.021zM18.84 14.4c-.3.42-.84.54-1.26.24-3.36-2.04-8.52-2.64-12.54-1.44-.48.12-1.02-.12-1.14-.6-.12-.48.12-1.02.6-1.14 4.56-1.32 10.32-.66 14.1 1.68.42.24.54.84.24 1.26zm.12-3.12c-4.02-2.4-10.56-2.64-14.4-1.44-.6.18-1.2-.18-1.38-.78-.18-.6.18-1.2.78-1.38 4.44-1.32 11.64-1.02 16.2 1.26.54.3.72 1.02.42 1.56-.3.54-1.02.72-1.62.42z"/></svg></div>
                  <p className={`text-sm font-bold ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Accedi da Settings</p>
                </div>
              ) : (
                <div className="flex-1 min-w-0 px-2 flex items-center gap-3">
                  <div className="p-2 bg-gray-500/20 rounded-full text-gray-500"><svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>
                  <p className={`text-sm font-bold ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>In attesa di brani...</p>
                </div>
              )}
            </div>
          )}

          <div className="absolute bottom-8 left-0 right-0 px-6 z-10 flex gap-4 justify-center mb-[env(safe-area-inset-bottom)]">
            {status === 'idle' && (
              <button onClick={startCountdown} className="flex-1 max-w-[200px] py-5 rounded-3xl font-black text-lg text-white bg-blue-600 border-b-4 border-blue-800 hover:bg-blue-500 active:scale-95 shadow-2xl tracking-wide transition-all">START</button>
            )}
            {status === 'tracking' && (
              <>
                <button onClick={pauseTracking} className="w-16 h-16 rounded-full flex items-center justify-center font-black shadow-2xl bg-gray-800 border-b-4 border-gray-900 text-white active:scale-95 transition-all"><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg></button>
                <button onClick={handleEndJourney} className="flex-1 max-w-[200px] py-5 rounded-3xl font-black text-lg bg-red-600 border-b-4 border-red-800 text-white hover:bg-red-500 active:scale-95 shadow-2xl tracking-wide transition-all">STOP</button>
              </>
            )}
            {status === 'paused' && (
              <button onClick={resumeTracking} className="flex-1 max-w-[200px] py-5 rounded-3xl font-black text-lg text-black bg-yellow-500 border-b-4 border-yellow-700 hover:bg-yellow-400 active:scale-95 shadow-2xl tracking-wide transition-all">RESUME</button>
            )}
          </div>
        </>
      )}

      {/* --- SCHERMATA RESOCONTO (POST VIAGGIO) --- */}
      {showReport && tripStats && (
        <div className={`absolute inset-0 z-50 ${isDarkMode ? 'bg-gray-900/95' : 'bg-gray-100/95'} backdrop-blur-md flex flex-col items-center justify-between p-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] animate-in fade-in zoom-in-95 duration-300`}>
          <div className="w-full max-w-md mt-8">
            <h2 className="text-3xl font-black mb-6 text-center tracking-tight">Viaggio Completato!</h2>
            <div className="w-full h-48 bg-gray-800 rounded-3xl overflow-hidden shadow-2xl border border-white/10 relative">
              {mapSnapshot ? <img src={mapSnapshot} alt="Snapshot" className="w-full h-full object-cover" /> : null}
            </div>
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className={`${themeCard} p-4 rounded-2xl border`}><p className="text-gray-400 text-xs font-bold uppercase mb-1">Distanza</p><p className="text-2xl font-black">{tripStats.distance.toFixed(2)} <span className="text-sm font-medium">km</span></p></div>
              <div className={`${themeCard} p-4 rounded-2xl border`}><p className="text-gray-400 text-xs font-bold uppercase mb-1">Tempo</p><p className="text-2xl font-black">{formatTime(tripStats.time)}</p></div>
              <div className={`${themeCard} p-4 rounded-2xl border`}><p className="text-gray-400 text-xs font-bold uppercase mb-1">Media</p><p className="text-2xl font-black">{Math.round(tripStats.avgSpeed)} <span className="text-sm font-medium">km/h</span></p></div>
              <div className={`${themeCard} p-4 rounded-2xl border`}><p className="text-gray-400 text-xs font-bold uppercase mb-1">Vel Max</p><p className="text-2xl font-black text-red-500">{tripStats.maxSpeed.toFixed(1)} <span className="text-sm text-gray-500">km/h</span></p></div>
            </div>
          </div>
          <div className="w-full max-w-md mb-8 flex flex-col gap-3">
            <button onClick={handleSaveToCloud} disabled={isSaving} className={`w-full py-5 rounded-3xl font-black text-lg transition-all shadow-xl flex justify-center items-center gap-2 ${isSaving ? 'bg-blue-800 text-blue-300' : 'bg-blue-600 text-white hover:bg-blue-500 border-b-4 border-blue-800'}`}>
              {isSaving ? 'INVIO DATI...' : 'SALVA NEL CLOUD'}
            </button>
            <button onClick={handleDiscard} disabled={isSaving} className="w-full py-4 rounded-3xl font-bold text-gray-500 hover:text-red-500 transition-colors">Scarta Dati e Azzera</button>
          </div>
        </div>
      )}

      {/* --- MENU LATERALE --- */}
      {activeView === 'menu' && (
        <div className={`absolute inset-0 z-50 ${isDarkMode ? 'bg-gray-900/98' : 'bg-white/98'} flex flex-col p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] animate-in slide-in-from-right duration-300`}>
          <div className="flex justify-between items-center mb-10">
            <h2 className="text-4xl font-black tracking-tighter text-blue-500">Road<span className={themeText}>Record</span></h2>
            <button onClick={() => setActiveView('map')} className={`p-2 ${themeCard} rounded-full transition-colors active:scale-95`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
          </div>
          
          <div className="flex flex-col gap-4">
            <button onClick={() => setActiveView('stats')} className={`flex items-center gap-4 ${themeCard} p-5 rounded-2xl border active:scale-95 transition-all text-left`}>
              <div className="p-2 bg-yellow-500/20 rounded-lg text-yellow-500"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg></div>
              <span className="font-bold text-lg">Record Personali</span>
            </button>
            <button onClick={() => setActiveView('garage')} className={`flex items-center gap-4 ${themeCard} p-5 rounded-2xl border active:scale-95 transition-all text-left`}>
              <div className="p-2 bg-purple-500/20 rounded-lg text-purple-500"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg></div>
              <span className="font-bold text-lg">Garage e Icona</span>
            </button>
            <button onClick={() => setActiveView('history')} className={`flex items-center gap-4 ${themeCard} p-5 rounded-2xl border active:scale-95 transition-all text-left`}>
              <div className="p-2 bg-blue-500/20 rounded-lg text-blue-500"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg></div>
              <span className="font-bold text-lg">I Miei Percorsi</span>
            </button>
            <button onClick={() => setActiveView('settings')} className={`flex items-center gap-4 ${themeCard} p-5 rounded-2xl border active:scale-95 transition-all text-left`}>
              <div className="p-2 bg-gray-500/20 rounded-lg text-gray-500"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg></div>
              <span className="font-bold text-lg">Settings</span>
            </button>
          </div>
        </div>
      )}

      {/* --- SCHERMATE SOTTOPAGINE --- */}
      {activeView === 'stats' && (
        <div className={`absolute inset-0 z-50 ${themeBg} flex flex-col p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] animate-in slide-in-from-right duration-300`}>
          <div className="flex items-center gap-4 mb-8">
            <button onClick={() => setActiveView('menu')} className={`p-2 ${themeCard} rounded-full transition-colors active:scale-95`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg></button>
            <h2 className="text-2xl font-black">I Tuoi Record</h2>
          </div>
          <div className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)] flex flex-col gap-4">
            {globalStats ? (
              <>
                <div className={`p-8 rounded-3xl ${isDarkMode ? 'bg-gradient-to-br from-blue-900 to-gray-900 border border-blue-500/30' : 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'} shadow-2xl`}>
                  <p className={`${isDarkMode ? 'text-blue-300' : 'text-blue-100'} text-sm font-bold uppercase mb-2 tracking-widest`}>Distanza Totale</p>
                  <div className="flex items-baseline gap-2"><span className="text-6xl font-black tracking-tighter">{globalStats.total_distance?.toFixed(1) || '0.0'}</span><span className="text-xl font-bold opacity-70">km</span></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className={`${themeCard} p-5 rounded-2xl border shadow-lg flex flex-col justify-center`}><p className="text-gray-400 text-[10px] font-bold uppercase mb-1">Velocità Massima</p><p className="text-2xl font-black text-red-500">{globalStats.max_speed?.toFixed(1) || '0.0'} <span className="text-sm text-gray-500">km/h</span></p></div>
                  <div className={`${themeCard} p-5 rounded-2xl border shadow-lg flex flex-col justify-center`}><p className="text-gray-400 text-[10px] font-bold uppercase mb-1">Media Globale</p><p className="text-2xl font-black text-blue-500">{globalStats.avg_speed?.toFixed(0) || '0'} <span className="text-sm text-gray-500">km/h</span></p></div>
                  <div className={`${themeCard} p-5 rounded-2xl border shadow-lg flex flex-col justify-center`}><p className="text-gray-400 text-[10px] font-bold uppercase mb-1">Viaggio più lungo</p><p className="text-2xl font-black">{globalStats.longest_trip?.toFixed(1) || '0.0'} <span className="text-sm text-gray-500">km</span></p></div>
                  <div className={`${themeCard} p-5 rounded-2xl border shadow-lg flex flex-col justify-center`}><p className="text-gray-400 text-[10px] font-bold uppercase mb-1">Tempo al volante</p><p className="text-2xl font-black">{formatTime(globalStats.total_time || 0)}</p></div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <svg className="animate-spin w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              </div>
            )}
          </div>
        </div>
      )}

      {activeView === 'garage' && (
        <div className={`absolute inset-0 z-50 ${themeBg} flex flex-col p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] animate-in slide-in-from-right duration-300`}>
          <div className="flex items-center gap-4 mb-8">
            <button onClick={() => setActiveView('menu')} className={`p-2 ${themeCard} rounded-full transition-colors active:scale-95`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg></button>
            <h2 className="text-2xl font-black">Garage</h2>
          </div>
          <div className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)] flex flex-col gap-8">
            <div>
              <p className="text-sm font-bold uppercase text-gray-500 mb-4 tracking-wider">Icona sulla Mappa</p>
              <div className="grid grid-cols-3 gap-4">
                <button onClick={() => handleCarIconChange('arrow')} className={`flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all ${carIcon === 'arrow' ? 'border-blue-500 bg-blue-500/10' : `border-transparent ${themeCard}`}`}><svg className="w-8 h-8 text-gray-400 transform -rotate-45" viewBox="0 0 24 24" fill="currentColor"><path d="M3 10.5L21 3L13.5 21L11.5 13.5L3 10.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg><span className="text-xs font-bold">Navigatore</span></button>
                <button onClick={() => handleCarIconChange('sport')} className={`flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all ${carIcon === 'sport' ? 'border-blue-500 bg-blue-500/10' : `border-transparent ${themeCard}`}`}><svg className="w-8 h-8 text-gray-400" viewBox="0 0 24 24" fill="currentColor"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5H6.5C5.84 5 5.28 5.42 5.08 6.01L3 12V20C3 20.55 3.45 21 4 21H5C5.55 21 6 20.55 6 20V19H18V20C18 20.55 18.45 21 19 21H20C20.55 21 21 20.55 21 20V12L18.92 6.01ZM6.5 6.5H17.5L18.5 9.5H5.5L6.5 6.5ZM7.5 16.5C6.67 16.5 6 15.83 6 15C6 14.17 6.67 13.5 7.5 13.5C8.33 13.5 9 14.17 9 15C9 15.83 8.33 16.5 7.5 16.5ZM16.5 16.5C15.67 16.5 15 15.83 15 15C15 14.17 15.67 13.5 16.5 13.5C17.33 13.5 18 14.17 18 15C18 15.83 17.33 16.5 16.5 16.5Z" /></svg><span className="text-xs font-bold">Sportiva</span></button>
                <button onClick={() => handleCarIconChange('dot')} className={`flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all ${carIcon === 'dot' ? 'border-blue-500 bg-blue-500/10' : `border-transparent ${themeCard}`}`}><div className="w-8 h-8 rounded-full bg-gray-400"></div><span className="text-xs font-bold">Classico</span></button>
              </div>
            </div>
            <div>
              <p className="text-sm font-bold uppercase text-gray-500 mb-4 tracking-wider">Colore LED</p>
              <div className="flex justify-between px-2">
                {['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'].map(color => (
                  <button key={color} onClick={() => handleCarColorChange(color)} className={`w-10 h-10 rounded-full shadow-lg transition-transform active:scale-90 ${carColor === color ? 'scale-110 ring-4 ring-white/50' : 'opacity-70'}`} style={{ backgroundColor: color }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeView === 'history' && (
        <div className={`absolute inset-0 z-50 ${themeBg} flex flex-col p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] animate-in slide-in-from-right duration-300`}>
          <div className="flex items-center gap-4 mb-6">
            <button onClick={() => setActiveView('menu')} className={`p-2 ${themeCard} rounded-full transition-colors active:scale-95`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg></button>
            <h2 className="text-2xl font-black">Archivio Viaggi</h2>
          </div>
          <div className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)] flex flex-col gap-4">
            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-2"><p className="font-medium text-lg text-gray-400">L'archivio è vuoto.</p></div>
            ) : (
              history.map((trip) => (
                <div key={trip.id} onClick={() => { setSelectedTrip(trip); setActiveView('tripDetail'); }} className={`${themeCard} rounded-2xl p-3 flex gap-4 border shadow-lg active:scale-[0.98] transition-all cursor-pointer`}>
                  <div className="w-24 h-24 rounded-xl overflow-hidden bg-gray-900 flex-shrink-0 border border-black/10"><img src={trip.snapshot} alt="Mappa" className="w-full h-full object-cover" /></div>
                  <div className="flex flex-col justify-center flex-1">
                    <p className="text-gray-500 text-xs font-semibold uppercase">{trip.date}</p>
                    <div className="flex items-baseline gap-1 mt-1"><p className="text-xl font-black">{trip.distance.toFixed(2)}</p><p className="text-gray-500 text-sm font-medium">km</p></div>
                    <div className="flex gap-4 mt-2">
                      <div className="flex items-center gap-1 text-blue-500"><p className="text-xs font-medium">{formatTime(trip.time)}</p></div>
                      <div className="flex items-center gap-1 text-red-500"><p className="text-xs font-medium">{trip.maxSpeed.toFixed(1)} km/h</p></div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeView === 'settings' && (
        <div className={`absolute inset-0 z-50 ${themeBg} flex flex-col p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] animate-in slide-in-from-right duration-300`}>
          <div className="flex items-center gap-4 mb-8">
            <button onClick={() => setActiveView('menu')} className={`p-2 ${themeCard} rounded-full transition-colors active:scale-95`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg></button>
            <h2 className="text-2xl font-black">Settings</h2>
          </div>
          <div className="flex flex-col gap-4">
            <div className={`${themeCard} p-5 rounded-2xl flex justify-between items-center border`}>
              <div><p className="font-bold">Tema Scuro</p><p className="text-xs text-gray-500">Mappa e Interfaccia</p></div>
              <input type="checkbox" checked={isDarkMode} onChange={() => setIsDarkMode(!isDarkMode)} className="w-6 h-6 accent-blue-500 rounded-md" />
            </div>
            <div className={`${themeCard} p-5 rounded-2xl flex justify-between items-center border`}>
              <div><p className="font-bold">Widget Spotify</p><p className="text-xs text-gray-500">Mostra musica in viaggio</p></div>
              <div className="flex items-center gap-3">
                {!spotifyToken && <button onClick={() => spotifyManager.login()} className="px-3 py-1.5 bg-[#1DB954] text-white rounded-lg font-bold text-xs shadow-md">Collega</button>}
                <input type="checkbox" checked={enableSpotify} onChange={() => setEnableSpotify(!enableSpotify)} className="w-6 h-6 accent-green-500 rounded-md" />
              </div>
            </div>
          </div>
        </div>
      )}

      {activeView === 'tripDetail' && selectedTrip && (
        <div className={`absolute inset-0 z-50 ${themeBg} flex flex-col animate-in zoom-in-95 duration-200`}>
          <div className="relative h-[45%] w-full bg-black">
            <img src={selectedTrip.snapshot} alt="Dettaglio Mappa" className="w-full h-full object-cover opacity-80" />
            <div className="absolute top-0 left-0 right-0 p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] bg-gradient-to-b from-black/80 to-transparent flex justify-between">
              <button onClick={() => setActiveView('history')} className="p-3 bg-gray-900/80 backdrop-blur-md rounded-full text-white shadow-lg active:scale-95 transition-all"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg></button>
              <button onClick={handleDeleteTrip} className="p-3 bg-red-600/90 hover:bg-red-500 backdrop-blur-md rounded-full text-white shadow-lg active:scale-95 transition-all"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
            </div>
            <div className={`absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t ${isDarkMode ? 'from-gray-900' : 'from-gray-50'} to-transparent`}></div>
          </div>
          <div className="flex-1 p-6 -mt-8 relative z-10 flex flex-col gap-4 pb-[env(safe-area-inset-bottom)]">
            <div className={`${themeCard} p-6 rounded-3xl border shadow-2xl flex flex-col gap-6`}>
              <div className={`flex justify-between items-end border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} pb-6`}>
                <div><p className="text-gray-500 text-sm font-bold uppercase mb-1">Distanza Percorsa</p><p className="text-5xl font-black">{selectedTrip.distance.toFixed(2)} <span className="text-xl text-gray-500 font-bold">km</span></p></div>
                <div className="text-right"><p className="text-gray-500 text-sm font-bold uppercase mb-1">Tempo</p><p className="text-2xl font-bold text-blue-500">{formatTime(selectedTrip.time)}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div><p className="text-gray-500 text-xs font-bold uppercase mb-1">Velocità Media</p><p className="text-2xl font-black">{Math.round(selectedTrip.avgSpeed)} <span className="text-sm text-gray-500 font-bold">km/h</span></p></div>
                 <div><p className="text-gray-500 text-xs font-bold uppercase mb-1">Vel. Massima</p><p className="text-2xl font-black text-red-500">{selectedTrip.maxSpeed.toFixed(1)} <span className="text-sm text-gray-500 font-bold">km/h</span></p></div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}