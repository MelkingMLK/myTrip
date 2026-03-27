import { useEffect, useRef, useState } from 'react';
import Map, { GeolocateControl, NavigationControl, Source, Layer, Marker } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useDriveTracker } from '../hooks/useDriveTracker';
import { userManager } from '../services/userManager';
import { spotifyManager } from '../services/spotifyManager';
import { routeManager } from '../services/routeManager';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const CAR_BRANDS = ['Base', 'Mercedes', 'Audi', 'Toyota', 'Citroen', 'BMW', 'Jeep', 'Tesla', 'Alfa', 'KTM'];

const BRAND_SLUGS: Record<string, string> = {
  'Mercedes': 'mercedes', 'Audi': 'audi', 'Toyota': 'toyota', 'Citroen': 'citroen',
  'BMW': 'bmw', 'Jeep': 'jeep', 'Tesla': 'tesla', 'Alfa': 'alfaromeo'
};

const DEFAULT_ARROW = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/></svg>`;

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

const CustomToggle = ({ checked, onChange, activeColor }: { checked: boolean, onChange: () => void, activeColor: string }) => (
  <div onClick={onChange} className="w-12 h-6 rounded-full p-1 cursor-pointer transition-colors duration-300 ease-in-out flex items-center shadow-inner" style={{ backgroundColor: checked ? activeColor : '#3f3f46' }}>
    <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${checked ? 'translate-x-6' : 'translate-x-0'}`} />
  </div>
);

const DefaultAvatar = ({ color, className }: { color: string, className?: string }) => (
  <div className={`flex items-center justify-center bg-zinc-800 ${className}`} style={{ color: color }}>
    <svg fill="currentColor" viewBox="0 0 24 24" className="w-3/5 h-3/5 opacity-80">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
    </svg>
  </div>
);

/// PIANO A: Loghi SVG colorabili (SimpleIcons)
const getBrandLogoUrl = (brand: string, hexColor: string) => {
  const slugs: Record<string, string> = {
    'Mercedes': 'mercedes',
    'Audi': 'audi',
    'Toyota': 'toyota',
    'Citroen': 'citroen',
    'BMW': 'bmw',
    'Jeep': 'jeep',
    'Tesla': 'tesla',
    'KTM': 'ktm'
  };
  const slug = slugs[brand];
  if (!slug) return null; // Forza il passaggio al Piano B
  const cleanColor = hexColor.replace('#', '');
  return `https://cdn.simpleicons.org/${slug}/${cleanColor}`;
};

// PIANO B: Loghi PNG reali (Fallback per Alfa Romeo e altri)
const getFallbackLogoUrl = (brand: string) => {
  const slugs: Record<string, string> = {
    'Mercedes': 'mercedes-benz',
    'Alfa': 'alfa-romeo',
    'KTM': 'ktm'
  };
  const finalSlug = slugs[brand] || brand.toLowerCase();
  return `https://raw.githubusercontent.com/filippofilip95/car-logos-dataset/master/logos/optimized/${finalSlug}.png`;
};

export default function MapOverlay({ onLogout }: { onLogout?: () => void }) {
  const { status, countdown, effectiveTime, pauseTime, currentSpeed, route, startCountdown, pauseTracking, resumeTracking, stopTracking } = useDriveTracker();

  const mapRef = useRef<any>(null);
  const geoControlRef = useRef<any>(null);
  const [activeView, setActiveView] = useState<'map' | 'menu' | 'history' | 'settings' | 'tripDetail' | 'stats' | 'garage' | 'leaderboard' | 'profile'>('map');
  const [selectedTrip, setSelectedTrip] = useState<any | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [mapSnapshot, setMapSnapshot] = useState<string | null>(null);
  const [tripStats, setTripStats] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('rr_dark') !== 'false');
  const [appTheme, setAppTheme] = useState<'blue' | 'black-white' | 'black-orange' | 'purple-yellow' | 'red-white' | 'custom'>(() => localStorage.getItem('rr_theme') as any || 'blue');
  const [customPrimary, setCustomPrimary] = useState(() => localStorage.getItem('rr_custom1') || '#10b981');
  const [customAccent, setCustomAccent] = useState(() => localStorage.getItem('rr_custom2') || '#f59e0b');
  
  const [carBrand, setCarBrand] = useState(() => localStorage.getItem('rr_carBrand') || 'Base');
  const [carColor, setCarColor] = useState(() => localStorage.getItem('rr_carColor') || '#3b82f6');
  const [carLogo, setCarLogo] = useState(() => localStorage.getItem('rr_carLogo') || DEFAULT_ARROW);
  
  const [myNickname, setMyNickname] = useState(() => localStorage.getItem('rr_nickname') || 'Pilota');
  const [avatarUrl, setAvatarUrl] = useState(() => localStorage.getItem('rr_avatar') || '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [enableSpotify, setEnableSpotify] = useState(true);
  const [currentSong, setCurrentSong] = useState<any>(null);
  const spotifyToken = localStorage.getItem('spotifyToken');

  const [globalStats, setGlobalStats] = useState<any>(null);
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);
  const [leaderboardFilter, setLeaderboardFilter] = useState<'distance' | 'maxSpeed' | 'longestTrip'>('distance');

  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [tripStartLoc, setTripStartLoc] = useState<string>(''); 
  const [tripEndLoc, setTripEndLoc] = useState<string>(''); 
  const [activeFilterTags, setActiveFilterTags] = useState<string[]>([]); 
  const [activeTagInput, setActiveTagInput] = useState<'start' | 'end'>('start');

  const extractLocations = () => {
    const locs = new Set(['Casa', 'Lavoro', 'Università', 'Palestra', 'Supermercato']);
    history.forEach(trip => {
      if (trip.tag) {
        const parts = trip.tag.split(' ➔ ');
        parts.forEach((p: string) => { if (p.trim()) locs.add(p.trim()); });
      }
    });
    return Array.from(locs).slice(0, 10); 
  };
  const suggestedLocations = extractLocations();

  const availableFilterTags = Array.from(new Set(history.map(t => t.tag).filter(Boolean)));

  const currentPos = route.length > 0 ? route[route.length - 1] : null;
  const [livePos, setLivePos] = useState<any>(null); // Salva la posizione da fermi
  const markerPos = (status === 'tracking' || status === 'paused') ? (currentPos || livePos) : livePos;
  // NUOVO: Accende il pallino blu in automatico all'avvio
  useEffect(() => {
    // Aspetta 1 secondo che la mappa si carichi, poi "preme" il pulsante del GPS
    const timer = setTimeout(() => {
      geoControlRef.current?.trigger();
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const loadUserData = async () => {
      const prefs = await userManager.getPreferences();
      if (prefs) {
        if (prefs.nickname) { setMyNickname(prefs.nickname); localStorage.setItem('rr_nickname', prefs.nickname); }
        if (prefs.avatar_url) { setAvatarUrl(prefs.avatar_url); localStorage.setItem('rr_avatar', prefs.avatar_url); }
        if (prefs.car_color) { setCarColor(prefs.car_color); localStorage.setItem('rr_carColor', prefs.car_color); }
        if (prefs.car_icon) { setCarLogo(prefs.car_icon); localStorage.setItem('rr_carLogo', prefs.car_icon); }
      }
    };
    loadUserData();
  }, []);

  const handleBrandChange = async (brand: string) => {
    setCarBrand(brand);
    localStorage.setItem('rr_carBrand', brand);
    const slug = BRAND_SLUGS[brand];
    const cachedKey = `rr_logo_${slug}`;
    const cachedLogo = localStorage.getItem(cachedKey);

    if (cachedLogo) {
      setCarLogo(cachedLogo);
      localStorage.setItem('rr_carLogo', cachedLogo);
      return;
    }

    if (navigator.onLine) {
      try {
        const res = await fetch(`https://cdn.simpleicons.org/${slug}`);
        if (res.ok) {
          const svgText = await res.text();
          localStorage.setItem(cachedKey, svgText);
          setCarLogo(svgText);
          localStorage.setItem('rr_carLogo', svgText);
          return;
        }
      } catch (error) { console.warn("Download logo fallito", error); }
    }
    setCarLogo(DEFAULT_ARROW);
    localStorage.setItem('rr_carLogo', DEFAULT_ARROW);
  };

  useEffect(() => { if (carLogo === DEFAULT_ARROW && navigator.onLine) handleBrandChange(carBrand); }, []);

  useEffect(() => {
    localStorage.setItem('rr_dark', isDarkMode.toString());
    localStorage.setItem('rr_theme', appTheme);
    localStorage.setItem('rr_custom1', customPrimary);
    localStorage.setItem('rr_custom2', customAccent);
    localStorage.setItem('rr_carColor', carColor);
    localStorage.setItem('rr_nickname', myNickname);
  }, [isDarkMode, appTheme, customPrimary, customAccent, carColor, myNickname]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const base64Img = event.target.result as string;
          setAvatarUrl(base64Img);
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  useEffect(() => {
    if (activeView === 'stats') {
      userManager.getUserRecords?.().then((data: any) => setGlobalStats(data)).catch(() => {});
    }
    if (activeView === 'leaderboard') {
      setIsLoadingLeaderboard(true);
      userManager.getLeaderboard?.().then((data: any) => { 
        setLeaderboardData(data || []); 
        setIsLoadingLeaderboard(false); 
      }).catch(() => setIsLoadingLeaderboard(false));
    }
    // --- NUOVO: Scarica i viaggi veri dal database! ---
    if (activeView === 'history') {
      routeManager.getRoutes().then((data: any) => {
        // Mappiamo i dati del DB nel formato che la UI si aspetta
        const formattedHistory = data.map((route: any) => ({
          id: route.id,
          date: new Date(route.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
          snapshot: route.snapshot_url,
          distance: route.distance_km,
          time: route.total_time_seconds,
          maxSpeed: route.max_speed_kmh,
          avgSpeed: route.avg_speed_kmh
        }));
        setHistory(formattedHistory);
      });
    }
  }, [activeView]);

  useEffect(() => {
    let interval: any;
    if ((status === 'tracking' || status === 'paused') && enableSpotify && spotifyToken) {
      const fetchSong = async () => { try { const song = await spotifyManager.getCurrentlyPlaying(spotifyToken); setCurrentSong(song); } catch (e) { } };
      fetchSong(); interval = setInterval(fetchSong, 5000); 
    } else { setCurrentSong(null); }
    return () => clearInterval(interval);
  }, [status, enableSpotify, spotifyToken]);

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      let finalAvatarUrl = avatarUrl;
      if (avatarUrl.startsWith('data:image')) {
        const uploadedUrl = await userManager.uploadAvatar(avatarUrl);
        if (uploadedUrl) {
          finalAvatarUrl = uploadedUrl;
          setAvatarUrl(uploadedUrl); 
          localStorage.setItem('rr_avatar', uploadedUrl); 
        } else {
          alert("Upload dell'immagine fallito! Controlla le Policies del bucket 'avatars' su Supabase.");
          setIsSavingProfile(false);
          return; 
        }
      }
      const profileOk = await userManager.updateProfile(myNickname, finalAvatarUrl);
      const prefsOk = await userManager.savePreferences(carLogo, carColor);

      if (!profileOk || !prefsOk) {
         alert("Salvataggio rifiutato dal Database. Controlla le regole RLS della tabella!");
         return;
      }

      alert("Profilo e Garage sincronizzati nel Cloud! ☁️🏁");
      setActiveView('settings');
    } catch (error: any) {
      console.error("ERRORE CRITICO JS:", error);
      alert(`Errore fatale: ${error.message}`);
    } finally {
      setIsSavingProfile(false);
    }
  };

  useEffect(() => {
    if (currentPos && mapRef.current && activeView === 'map' && !showReport) {
      mapRef.current.flyTo({ center: [currentPos.lng, currentPos.lat], zoom: 16, essential: true, duration: 1000 });
    }
  }, [currentPos, activeView, showReport]);

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600); const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0'); const s = (totalSeconds % 60).toString().padStart(2, '0');
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
  };

  const handleEndJourney = () => {
    const mapInstance = mapRef.current?.getMap();
    if (mapInstance && route.length > 1) { 
      const bounds = route.reduce((acc: number[], point: any) => [Math.min(acc[0], point.lng), Math.min(acc[1], point.lat), Math.max(acc[2], point.lng), Math.max(acc[3], point.lat)], [180, 90, -180, -90]);
      mapInstance.fitBounds([[bounds[0], bounds[1]], [bounds[2], bounds[3]]], { padding: 50, duration: 1000, maxZoom: 16 });
    }
    
    setTimeout(() => {
      let snapshot = null;
      try { if (mapInstance) snapshot = mapInstance.getCanvas().toDataURL('image/png'); } catch(e) {}
      setMapSnapshot(snapshot);
      
      // Protezioni Anti-Crash sui calcoli
      const dist = (route && route.length > 1) ? calculateDistance(route) : 0; 
      const avgS = effectiveTime > 0 ? (dist / (effectiveTime / 3600)) : 0;
      let maxS = (route && route.length > 0) ? (route[0].speed || 0) : 0;
      
      if (route && route.length > 1) {
        for (let i = 1; i < route.length; i++) { 
          if (Math.abs(route[i].speed - route[i - 1].speed) <= 20 && route[i].speed > maxS) maxS = route[i].speed; 
        }
      }
      
      // Aggiunto pauseTime per il cloud!
      setTripStats({ distance: dist, maxSpeed: maxS, avgSpeed: avgS, time: effectiveTime, pause: pauseTime });
      setShowReport(true);
    }, route.length > 1 ? 1200 : 100); 
    
    stopTracking();
  };

  const resetForNewTrip = () => { 
    setShowReport(false); 
    setTripStats(null); 
    setMapSnapshot(null); 
    setTripStartLoc(''); 
    setTripEndLoc(''); 
    setActiveView('map'); 
    stopTracking(); 
  };
  
  const handleDiscard = () => { if(window.confirm("Sicuro di voler scartare questo viaggio?")) resetForNewTrip(); };
  
  const handleSaveToCloud = async () => {
    
    if (!tripStats || !mapSnapshot) return;
    setIsSaving(true);
    try {
      await routeManager.saveRoute(mapSnapshot, {
        distance_km: tripStats.distance,
        avg_speed_kmh: tripStats.avgSpeed,
        max_speed_kmh: tripStats.maxSpeed,
        total_time_seconds: tripStats.time,
        driving_time_seconds: tripStats.time,
        pause_time_seconds: tripStats.pause
      });
      resetForNewTrip();
      setActiveView('history');
      setShowReport(false);
    } catch (error) {
      console.error("Salvataggio fallito", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTrip = async () => { 
    if (selectedTrip && window.confirm("Eliminare definitivamente questo viaggio?")) { 
      try {
        await routeManager.deleteRoute(selectedTrip.id);
        setHistory(prev => prev.filter(t => t.id !== selectedTrip.id)); 
        setActiveView('history'); 
        setSelectedTrip(null); 
      } catch (error) {
        alert("Errore nell'eliminazione.");
      }
    } 
  };

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
  const textClass = isDarkMode ? 'text-white' : 'text-black';
  const cardClass = isDarkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200 shadow-xl';
  const subTextClass = isDarkMode ? 'text-zinc-400' : 'text-zinc-500';

  const routeGeoJSON: any = { type: 'FeatureCollection', features: route.map((point: any, index: number) => { 
    if (index === 0) return null; 
    let segmentColor = '#10B981';
    
    if (point.isBadSignal) segmentColor = '#71717a'; 
    else if (point.speed >= 90) segmentColor = '#9333ea'; 
    else if (point.speed >= 50) segmentColor = '#10b981'; 
    else if (point.speed >= 30) segmentColor = '#eab308'; 
    else if (point.speed >= 10) segmentColor = '#f97316'; 
    else segmentColor = '#9f1239'; 

    return { type: 'Feature', properties: { color: segmentColor }, geometry: { type: 'LineString', coordinates: [[route[index - 1].lng, route[index - 1].lat], [point.lng, point.lat]] } }; 
  }).filter(Boolean) };

  const sortedLeaderboard = [...leaderboardData].sort((a: any, b: any) => {
    if (leaderboardFilter === 'distance') return (b.distance || 0) - (a.distance || 0);
    if (leaderboardFilter === 'maxSpeed') return (b.maxSpeed || 0) - (a.maxSpeed || 0);
    if (leaderboardFilter === 'longestTrip') return (b.longestTrip || 0) - (a.longestTrip || 0);
    return 0;
  });

  const toggleFilterTag = (tag: string) => {
    setActiveFilterTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };
  const filteredHistory = history.filter(trip => activeFilterTags.length === 0 || (trip.tag && activeFilterTags.includes(trip.tag)));

  return (
    <div className={`relative h-screen w-screen overflow-hidden transition-colors duration-500 ${bgClass} ${textClass}`}>
      
      <Map ref={mapRef} initialViewState={{ longitude: 8.8251, latitude: 45.8206, zoom: 13 }} mapStyle={isDarkMode ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/light-v11"} mapboxAccessToken={MAPBOX_TOKEN} preserveDrawingBuffer={true}>
        <GeolocateControl 
          ref={geoControlRef} 
          positionOptions={{ enableHighAccuracy: true }} 
          trackUserLocation 
          showUserHeading 
          showUserLocation={false} 
          onGeolocate={(e: any) => setLivePos({ lat: e.coords.latitude, lng: e.coords.longitude })}
          position="bottom-right" 
        />
        <NavigationControl position="bottom-right" />
        {route.length > 1 && <Source id="route-source" type="geojson" data={routeGeoJSON}><Layer id="route-layer" type="line" layout={{ 'line-join': 'round', 'line-cap': 'round' }} paint={{ 'line-color': ['get', 'color'], 'line-width': 6 }} /></Source>}

        {markerPos && (
          <Marker longitude={markerPos.lng} latitude={markerPos.lat} anchor="center">
            <div className="relative flex items-center justify-center drop-shadow-xl transition-all">
              {/* L'onda che pulsa sotto (uguale per tutti) */}
              <div className="absolute h-10 w-10 animate-ping rounded-full opacity-40" style={{ backgroundColor: carColor }}></div>
              
              {/* Condizione: Pallino Base oppure Logo Auto VERO */}
              {carBrand === 'Base' ? (
                <div className="relative z-10 h-5 w-5 rounded-full border-2 border-white shadow-lg" style={{ backgroundColor: carColor }}></div>
              ) : (
                <div className="relative z-10 h-10 w-10 rounded-full border-4 flex items-center justify-center bg-white overflow-hidden shadow-lg" style={{ borderColor: carColor }}>
                   <img 
                     src={getBrandLogoUrl(carBrand, carColor) || getFallbackLogoUrl(carBrand)} 
                     alt={carBrand} 
                     className="w-5 h-5 object-contain" 
                     onError={(e) => {
                       // Se fallisce anche il primo caricamento (es. Alfa), prova il fallback PNG
                       const fallback = getFallbackLogoUrl(carBrand);
                       if (e.currentTarget.src !== fallback) {
                         e.currentTarget.src = fallback;
                       } else {
                         // Se falliscono entrambi, metti le 3 lettere come ultima spiaggia
                         e.currentTarget.outerHTML = `<span class="text-[9px] font-black text-black uppercase tracking-tighter leading-none">${carBrand.substring(0, 3)}</span>`;
                       }
                     }}
                   />
                </div>
              )}
            </div>
          </Marker>
        )}
      </Map>

      {/* --- VISTA PRINCIPALE MAPPA --- */}
      {activeView === 'map' && !showReport && (
        <>
          <div className="absolute top-6 right-6 z-10 mt-[env(safe-area-inset-top)]">
            <button onClick={() => setActiveView('menu')} className={`backdrop-blur-xl border p-3 rounded-full transition-all active:scale-95 ${cardClass}`}>
              <svg className="w-6 h-6" style={{ color: hexPrimary }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
          </div>

          {status === 'countdown' && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
              <div className="flex flex-col items-center">
                <span className="text-2xl font-bold tracking-widest mb-4 text-white">PARTENZA TRA</span>
                <span className="text-9xl font-black animate-pulse" style={{ color: hexAccent }}>{countdown}</span>
                <button onClick={stopTracking} className="mt-12 px-8 py-3 rounded-full border-2 border-white/20 text-gray-300 hover:bg-white/10 hover:text-white font-bold tracking-widest uppercase transition-all active:scale-95">Annulla Partenza</button>
              </div>
            </div>
          )}

          <div className="absolute top-6 left-0 right-0 flex justify-center pointer-events-none px-4 z-10 mt-[env(safe-area-inset-top)]">
            <div className={`flex items-center gap-3 backdrop-blur-xl border p-3 rounded-2xl transition-all ${cardClass}`}>
              <div className={`h-2 w-2 rounded-full ${status === 'paused' ? 'bg-yellow-500 animate-pulse' : status === 'tracking' ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
              <span className={`font-medium text-sm tracking-tight uppercase ${status === 'paused' ? 'text-yellow-500' : ''}`}>
                {status === 'paused' ? 'SESSION PAUSED' : status === 'tracking' ? 'LIVE TRACKING' : 'ONLINE'}
              </span>
            </div>
          </div>

          {(status === 'tracking' || status === 'paused') && (
            <div className="absolute top-24 left-6 flex flex-col gap-3 z-10 mt-[env(safe-area-inset-top)]">
               <div className={`backdrop-blur-md p-4 rounded-2xl border w-24 transition-colors ${cardClass}`}>
                  <p className={`text-[10px] font-bold uppercase ${subTextClass}`}>KM/H</p>
                  <p className="text-3xl font-black">{currentSpeed.toFixed(0)}</p>
               </div>
               <div className={`backdrop-blur-md p-4 rounded-2xl border w-24 transition-colors ${cardClass}`}>
                  <p className={`text-[10px] font-bold uppercase ${subTextClass}`}>TIME</p>
                  <p className="text-xl font-black tracking-wider" style={{ color: hexPrimary }}>{formatTime(effectiveTime)}</p>
               </div>
            </div>
          )}

          {enableSpotify && (status === 'tracking' || status === 'paused') && (
            <div className={`absolute bottom-32 left-6 right-6 md:left-1/2 md:-translate-x-1/2 md:w-96 z-10 backdrop-blur-xl p-3 rounded-3xl border flex items-center gap-4 shadow-2xl animate-in slide-in-from-bottom-10 fade-in duration-500 ${cardClass}`}>
              {currentSong ? (
                <>
                  <div className="relative w-12 h-12 flex-shrink-0 rounded-xl overflow-hidden shadow-lg border border-white/10 bg-zinc-800">
                    <img src={currentSong.image} alt="Album Cover" className={`w-full h-full object-cover transition-transform duration-[10s] ${currentSong.is_playing ? 'scale-110' : 'scale-100 grayscale'}`} />
                    <div className="absolute top-1 left-1 bg-black/50 rounded-full p-0.5"><svg className="w-3 h-3 text-[#1DB954]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.24 1.021zM18.84 14.4c-.3.42-.84.54-1.26.24-3.36-2.04-8.52-2.64-12.54-1.44-.48.12-1.02-.12-1.14-.6-.12-.48.12-1.02.6-1.14 4.56-1.32 10.32-.66 14.1 1.68.42.24.54.84.24 1.26zm.12-3.12c-4.02-2.4-10.56-2.64-14.4-1.44-.6.18-1.2-.18-1.38-.78-.18-.6.18-1.2.78-1.38 4.44-1.32 11.64-1.02 16.2 1.26.54.3.72 1.02.42 1.56-.3.54-1.02.72-1.62.42z"/></svg></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-black truncate ${textClass}`}>{currentSong.title}</p>
                    <p className={`text-xs font-medium truncate ${subTextClass}`}>{currentSong.artist}</p>
                  </div>
                </>
              ) : (
                <div className="flex-1 min-w-0 px-2 flex items-center gap-3">
                  <div className="p-2 rounded-full" style={{ backgroundColor: `${hexAccent}33`, color: hexAccent }}><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.24 1.021zM18.84 14.4c-.3.42-.84.54-1.26.24-3.36-2.04-8.52-2.64-12.54-1.44-.48.12-1.02-.12-1.14-.6-.12-.48.12-1.02.6-1.14 4.56-1.32 10.32-.66 14.1 1.68.42.24.54.84.24 1.26zm.12-3.12c-4.02-2.4-10.56-2.64-14.4-1.44-.6.18-1.2-.18-1.38-.78-.18-.6.18-1.2.78-1.38 4.44-1.32 11.64-1.02 16.2 1.26.54.3.72 1.02.42 1.56-.3.54-1.02.72-1.62.42z"/></svg></div>
                  <p className={`text-sm font-bold ${subTextClass}`}>{!spotifyToken ? 'Accedi da Settings' : 'Nessun brano in riproduzione'}</p>
                </div>
              )}
            </div>
          )}

          <div className="absolute bottom-8 left-0 right-0 px-6 z-10 flex gap-4 justify-center mb-[env(safe-area-inset-bottom)]">
            {(status === 'idle' || status === 'finished') && (
              <button onClick={startCountdown} className="flex-1 max-w-[200px] py-5 rounded-3xl font-black text-lg shadow-2xl tracking-wide transition-all active:scale-95 border-b-4" style={{ backgroundColor: hexPrimary, borderColor: hexAccent, color: hexAccent }}>START</button>
            )}
            {status === 'tracking' && (
              <>
                <button onClick={pauseTracking} className="w-16 h-16 rounded-full flex items-center justify-center font-black shadow-2xl bg-zinc-800 border-b-4 border-zinc-900 text-white active:scale-95 transition-all"><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg></button>
                <button onClick={handleEndJourney} className="flex-1 max-w-[200px] py-5 rounded-3xl font-black text-lg bg-red-600 border-b-4 border-red-800 text-white active:scale-95 shadow-2xl tracking-wide transition-all">STOP</button>
              </>
            )}
            {status === 'paused' && (
              <button onClick={resumeTracking} className="flex-1 max-w-[200px] py-5 rounded-3xl font-black text-lg text-black bg-yellow-500 border-b-4 border-yellow-700 active:scale-95 shadow-2xl tracking-wide transition-all">RESUME</button>
            )}
          </div>
        </>
      )}

      {/* --- SCHERMATA RESOCONTO (CON DA-A) --- */}
      {showReport && tripStats && (
        <div className={`absolute inset-0 z-50 backdrop-blur-md flex flex-col items-center justify-between p-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] animate-in fade-in zoom-in-95 duration-300 ${bgClass}`}>
          <div className="w-full max-w-md mt-8">
            <h2 className="text-3xl font-black mb-6 text-center tracking-tight">Viaggio Completato!</h2>
            
            {/* La tua Mappa */}
            <div className="w-full h-48 bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/10 relative">
              {mapSnapshot && <img src={mapSnapshot} alt="Snapshot" className="w-full h-full object-cover" />}
            </div>
            
            {/* I tuoi 4 Riquadri */}
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className={`${cardClass} p-4 rounded-2xl border`}><p className={`text-xs font-bold uppercase mb-1 ${subTextClass}`}>Distanza</p><p className="text-2xl font-black">{Number(tripStats.distance || 0).toFixed(2)} <span className="text-sm font-medium">km</span></p></div>
              <div className={`${cardClass} p-4 rounded-2xl border`}><p className={`text-xs font-bold uppercase mb-1 ${subTextClass}`}>Tempo</p><p className="text-2xl font-black" style={{ color: hexPrimary }}>{formatTime(tripStats.time || 0)}</p></div>
              <div className={`${cardClass} p-4 rounded-2xl border`}><p className={`text-xs font-bold uppercase mb-1 ${subTextClass}`}>Media</p><p className="text-2xl font-black">{Math.round(tripStats.avgSpeed || 0)} <span className="text-sm font-medium">km/h</span></p></div>
              <div className={`${cardClass} p-4 rounded-2xl border`}><p className={`text-xs font-bold uppercase mb-1 ${subTextClass}`}>Vel Max</p><p className="text-2xl font-black text-red-500">{Number(tripStats.maxSpeed || 0).toFixed(1)} <span className="text-sm font-medium">km/h</span></p></div>
            </div>
          </div>
          
          {/* I tuoi Pulsanti Originali */}
          <div className="w-full max-w-md mb-8 flex flex-col gap-3">
            <button onClick={handleSaveToCloud} disabled={isSaving} className={`w-full py-5 rounded-3xl font-black text-lg transition-all shadow-xl text-white ${isSaving ? 'opacity-50' : ''}`} style={{ backgroundColor: hexPrimary }}>
              {isSaving ? 'INVIO DATI...' : 'SALVA NEL CLOUD'}
            </button>
            <button onClick={handleDiscard} disabled={isSaving} className={`w-full py-4 rounded-3xl font-bold transition-colors ${subTextClass} hover:text-red-500`}>Scarta Dati e Azzera</button>
          </div>
        </div>
      )}

      {/* --- MENU LATERALE --- */}
      {activeView === 'menu' && (
        <div className={`absolute inset-0 z-50 flex flex-col p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] animate-in slide-in-from-right duration-300 ${bgClass}`}>
          <div className="flex justify-between items-center mb-10">
            <h2 className="text-4xl font-black tracking-tighter">
              <span style={{ color: hexPrimary }}>Road</span>
              <span style={{ color: hexAccent }}>Record</span>
            </h2>
            <button onClick={() => setActiveView('map')} className={`p-2 rounded-full transition-colors active:scale-95 ${cardClass}`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
          </div>
          <div className="flex flex-col gap-4">
            <button onClick={() => setActiveView('leaderboard')} className={`flex items-center gap-4 p-5 rounded-2xl border active:scale-95 transition-all text-left ${cardClass}`}>
              <div className="p-2 rounded-lg" style={{ backgroundColor: `${hexAccent}33`, color: hexAccent }}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg></div>
              <span className="font-bold text-lg">Classifica Globale</span>
            </button>
            <button onClick={() => setActiveView('stats')} className={`flex items-center gap-4 p-5 rounded-2xl border active:scale-95 transition-all text-left ${cardClass}`}>
              <div className="p-2 rounded-lg" style={{ backgroundColor: `${hexPrimary}33`, color: hexPrimary }}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg></div>
              <span className="font-bold text-lg">Record Personali</span>
            </button>
            <button onClick={() => setActiveView('garage')} className={`flex items-center gap-4 p-5 rounded-2xl border active:scale-95 transition-all text-left ${cardClass}`}>
              <div className="p-2 rounded-lg" style={{ backgroundColor: `${hexAccent}33`, color: hexAccent }}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg></div>
              <span className="font-bold text-lg">Garage e Icona</span>
            </button>
            <button onClick={() => setActiveView('history')} className={`flex items-center gap-4 p-5 rounded-2xl border active:scale-95 transition-all text-left ${cardClass}`}>
              <div className="p-2 rounded-lg" style={{ backgroundColor: `${hexPrimary}33`, color: hexPrimary }}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg></div>
              <span className="font-bold text-lg">I Miei Percorsi</span>
            </button>
            <button onClick={() => setActiveView('settings')} className={`flex items-center gap-4 p-5 rounded-2xl border active:scale-95 transition-all text-left ${cardClass}`}>
              <div className={`p-2 rounded-lg bg-zinc-500/20 ${subTextClass}`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg></div>
              <span className="font-bold text-lg">Settings</span>
            </button>
          </div>
        </div>
      )}

      {/* --- SCHERMATA IMPOSTAZIONI --- */}
      {activeView === 'settings' && (
        <div className={`absolute inset-0 z-50 flex flex-col p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] animate-in slide-in-from-right duration-300 ${bgClass}`}>
          <div className="flex items-center gap-4 mb-8">
            <button onClick={() => setActiveView('menu')} className={`p-2 rounded-full transition-colors active:scale-95 ${cardClass}`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg></button>
            <h2 className="text-2xl font-black">Settings</h2>
          </div>
          <div className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)] flex flex-col gap-4">
            
            <div className={`p-5 rounded-2xl flex justify-between items-center border ${cardClass}`}>
              <div><p className="font-bold">Il Mio Account</p><p className={`text-xs ${subTextClass}`}>{myNickname}</p></div>
              <button onClick={() => setActiveView('profile')} className="px-4 py-2 rounded-lg font-bold text-sm transition-all" style={{ backgroundColor: `${hexPrimary}33`, color: hexPrimary }}>Modifica</button>
            </div>

            <div className={`p-5 rounded-2xl flex justify-between items-center border ${cardClass}`}>
              <div><p className="font-bold">Tema Scuro Base</p><p className={`text-xs ${subTextClass}`}>Sfondi Mappa e UI</p></div>
              <CustomToggle checked={isDarkMode} onChange={() => setIsDarkMode(!isDarkMode)} activeColor={hexPrimary} />
            </div>

            
            {/* Sezione Settings in MapOverlay.tsx */}
              <div className={`p-5 rounded-2xl flex justify-between items-center border ${cardClass}`}>
                <div>
                  <p className="font-bold">Widget Spotify</p>
                  <p className={`text-xs ${subTextClass}`}>Mostra musica in viaggio</p>
                </div>
                <div className="flex items-center gap-3">
                  {spotifyToken ? (
                    <div className="px-3 py-1.5 bg-[#1DB954]/10 text-[#1DB954] rounded-lg font-black text-[10px] border border-[#1DB954]/30 uppercase tracking-wider">
                      Connesso
                    </div>
                  ) : (
                    <button 
                      onClick={() => spotifyManager.login()} 
                      className="px-3 py-1.5 bg-[#1DB954] text-white rounded-lg font-bold text-xs shadow-md active:scale-95 transition-all"
                    >
                      Collega
                    </button>
                  )}
                  <CustomToggle checked={enableSpotify} onChange={() => setEnableSpotify(!enableSpotify)} activeColor={hexPrimary} />
                </div>
              </div>
            

            <div className={`p-5 rounded-2xl flex flex-col gap-4 border ${cardClass}`}>
              <div><p className="font-bold">Tema Generale App</p><p className={`text-xs ${subTextClass}`}>Scegli una combinazione</p></div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setAppTheme('blue')} className="p-3 rounded-xl border-2 font-bold text-xs transition-all" style={appTheme === 'blue' ? { borderColor: hexPrimary, color: hexPrimary, backgroundColor: `${hexPrimary}11` } : { borderColor: 'transparent', opacity: 0.6 }}>Blu Standard</button>
                <button onClick={() => setAppTheme('black-white')} className="p-3 rounded-xl border-2 font-bold text-xs transition-all" style={appTheme === 'black-white' ? { borderColor: hexPrimary, color: hexPrimary, backgroundColor: `${hexPrimary}11` } : { borderColor: 'transparent', opacity: 0.6 }}>Bianco & Nero</button>
                <button onClick={() => setAppTheme('black-orange')} className="p-3 rounded-xl border-2 font-bold text-xs transition-all" style={appTheme === 'black-orange' ? { borderColor: hexPrimary, color: hexPrimary, backgroundColor: `${hexPrimary}11` } : { borderColor: 'transparent', opacity: 0.6 }}>Nero & Arancio</button>
                <button onClick={() => setAppTheme('purple-yellow')} className="p-3 rounded-xl border-2 font-bold text-xs transition-all" style={appTheme === 'purple-yellow' ? { borderColor: hexPrimary, color: hexPrimary, backgroundColor: `${hexPrimary}11` } : { borderColor: 'transparent', opacity: 0.6 }}>Viola & Giallo</button>
                <button onClick={() => setAppTheme('red-white')} className="p-3 rounded-xl border-2 font-bold text-xs transition-all col-span-2" style={appTheme === 'red-white' ? { borderColor: hexPrimary, color: hexPrimary, backgroundColor: `${hexPrimary}11` } : { borderColor: 'transparent', opacity: 0.6 }}>Rosso & Bianco</button>
              </div>

              <div className="mt-2 pt-4 border-t border-zinc-700">
                 <p className="font-bold text-sm mb-3">Crea Tema Personalizzato</p>
                 <div className="flex items-center gap-6 justify-center">
                    <div className="flex flex-col items-center gap-2">
                       <span className={`text-[10px] font-bold uppercase ${subTextClass}`}>Road</span>
                       <input type="color" value={customPrimary} onChange={(e) => { setCustomPrimary(e.target.value); setAppTheme('custom'); }} className="w-14 h-14 rounded-xl cursor-pointer bg-transparent border-0 p-0 shadow-lg" />
                    </div>
                    <div className="flex flex-col items-center gap-2">
                       <span className={`text-[10px] font-bold uppercase ${subTextClass}`}>Record</span>
                       <input type="color" value={customAccent} onChange={(e) => { setCustomAccent(e.target.value); setAppTheme('custom'); }} className="w-14 h-14 rounded-xl cursor-pointer bg-transparent border-0 p-0 shadow-lg" />
                    </div>
                 </div>
              </div>
            </div>

            <div className="mt-8 mb-6 border-t border-zinc-700/50 pt-6">
               <button onClick={() => { if(window.confirm("Sei sicuro di voler uscire dal tuo account?")) { if(onLogout) onLogout(); } }} className="w-full py-4 rounded-2xl font-black shadow-lg active:scale-95 transition-all text-white bg-red-600 border-b-4 border-red-800">
                 ESCI DALL'ACCOUNT
               </button>
            </div>
            
          </div>
        </div>
      )}

      {/* --- SCHERMATA PROFILO --- */}
      {activeView === 'profile' && (
        <div className={`absolute inset-0 z-50 flex flex-col p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] animate-in slide-in-from-right duration-300 ${bgClass}`}>
          <div className="flex items-center gap-4 mb-8">
            <button onClick={() => setActiveView('settings')} className={`p-2 rounded-full transition-colors active:scale-95 ${cardClass}`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg></button>
            <h2 className="text-2xl font-black">Profilo Pilota</h2>
          </div>
          <div className="flex flex-col items-center gap-8 mt-4">
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
            
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="w-32 h-32 rounded-full object-cover border-4 shadow-xl bg-black" style={{ borderColor: hexPrimary }} />
              ) : (
                <DefaultAvatar color={hexPrimary} className="w-32 h-32 rounded-full border-4 shadow-xl bg-zinc-900" />
              )}
              
              <div className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center transition-all opacity-0 hover:opacity-100">
                <svg className="w-8 h-8 text-white mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /></svg>
              </div>
            </div>

            <div className="w-full">
              <label className={`block text-xs font-bold uppercase mb-2 ${subTextClass}`}>Nickname Pubblico</label>
              <input type="text" value={myNickname} onChange={(e) => setMyNickname(e.target.value)} className={`w-full p-4 rounded-2xl font-bold text-lg focus:outline-none ${cardClass}`} />
            </div>
            <button onClick={handleSaveProfile} disabled={isSavingProfile} className={`w-full mt-4 py-4 rounded-2xl font-black shadow-lg active:scale-95 transition-all text-white border-b-4 ${isSavingProfile ? 'opacity-50 cursor-not-allowed' : ''}`} style={{ backgroundColor: hexPrimary, borderColor: hexAccent }}>
              {isSavingProfile ? 'SALVATAGGIO IN CORSO...' : 'SALVA PROFILO E GARAGE'}
            </button>
          </div>
        </div>
      )}

      {/* --- SCHERMATA GARAGE --- */}
      {activeView === 'garage' && (
        <div className={`absolute inset-0 z-50 flex flex-col p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] animate-in slide-in-from-right duration-300 ${bgClass}`}>
          <div className="flex items-center gap-4 mb-8">
            <button onClick={() => setActiveView('menu')} className={`p-2 rounded-full transition-colors active:scale-95 ${cardClass}`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg></button>
            <h2 className="text-2xl font-black">Garage</h2>
          </div>
          <div className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)] flex flex-col gap-8">
            <div>
              <p className={`text-sm font-bold uppercase mb-4 tracking-wider ${subTextClass}`}>Costruttore Auto</p>
              <div className="grid grid-cols-4 gap-3">
                {CAR_BRANDS.map((brand: string) => (
                  <button key={brand} onClick={() => setCarBrand(brand)} className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all ${cardClass}`} style={carBrand === brand ? { borderColor: hexPrimary, color: hexPrimary, backgroundColor: `${hexPrimary}11` } : { borderColor: 'transparent' }}>
                    {brand === 'Base' ? (
                       <span className="text-[10px] font-black truncate w-full text-center">BASE</span>
                    ) : (
                       <>
                         <img 
                           src={getBrandLogoUrl(brand, isDarkMode ? 'ffffff' : '000000') || getFallbackLogoUrl(brand)} 
                           alt={brand} 
                           className="w-8 h-8 object-contain mb-1 opacity-80" 
                           onError={(e) => {
                             const fallback = getFallbackLogoUrl(brand);
                             if (e.currentTarget.src !== fallback) {
                               e.currentTarget.src = fallback;
                             } else {
                               e.currentTarget.style.display = 'none';
                             }
                           }}
                         />
                         <span className={`text-[9px] font-bold uppercase tracking-wider ${subTextClass}`}>{brand}</span>
                       </>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className={`text-sm font-bold uppercase mb-4 tracking-wider ${subTextClass}`}>Colore LED Mappa</p>
              <div className="flex flex-wrap justify-between px-2 gap-4">
                {['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#ffffff', '#000000'].map((color: string) => (
                  <button key={color} onClick={() => setCarColor(color)} className={`w-10 h-10 rounded-full shadow-lg transition-transform border border-white/20 active:scale-90 ${carColor === color ? 'scale-110 ring-4 ring-white/50' : 'opacity-70'}`} style={{ backgroundColor: color }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- SCHERMATA RECORD --- */}
      {activeView === 'stats' && (
        <div className={`absolute inset-0 z-50 flex flex-col p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] animate-in slide-in-from-right duration-300 ${bgClass}`}>
          <div className="flex items-center gap-4 mb-8">
            <button onClick={() => setActiveView('menu')} className={`p-2 rounded-full transition-colors active:scale-95 ${cardClass}`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg></button>
            <h2 className="text-2xl font-black">I Tuoi Record</h2>
          </div>
          <div className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)] flex flex-col gap-4">
            {globalStats ? (
              <>
                <div className="p-8 rounded-3xl shadow-2xl border" style={{ backgroundColor: `${hexPrimary}22`, borderColor: `${hexPrimary}55`, color: hexPrimary }}>
                  <p className="text-sm font-bold uppercase mb-2 tracking-widest opacity-80">Distanza Totale</p>
                  <div className="flex items-baseline gap-2"><span className="text-6xl font-black tracking-tighter">{globalStats.total_distance?.toFixed(1) || '0.0'}</span><span className="text-xl font-bold opacity-70">km</span></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className={`p-5 rounded-2xl border shadow-lg flex flex-col justify-center ${cardClass}`}><p className={`text-[10px] font-bold uppercase mb-1 ${subTextClass}`}>Velocità Massima</p><p className="text-2xl font-black text-red-500">{globalStats.max_speed?.toFixed(1) || '0.0'} <span className="text-sm opacity-50">km/h</span></p></div>
                  <div className={`p-5 rounded-2xl border shadow-lg flex flex-col justify-center ${cardClass}`}><p className={`text-[10px] font-bold uppercase mb-1 ${subTextClass}`}>Media Globale</p><p className="text-2xl font-black" style={{ color: hexPrimary }}>{globalStats.avg_speed?.toFixed(0) || '0'} <span className="text-sm opacity-50">km/h</span></p></div>
                  <div className={`p-5 rounded-2xl border shadow-lg flex flex-col justify-center ${cardClass}`}><p className={`text-[10px] font-bold uppercase mb-1 ${subTextClass}`}>Viaggio Più Lungo</p><p className="text-2xl font-black text-green-500">{globalStats.longest_trip?.toFixed(1) || '0.0'} <span className="text-sm opacity-50">km</span></p></div>
                  <div className={`p-5 rounded-2xl border shadow-lg flex flex-col justify-center ${cardClass}`}><p className={`text-[10px] font-bold uppercase mb-1 ${subTextClass}`}>Tempo Totale</p><p className="text-2xl font-black" style={{ color: hexPrimary }}>{formatTime(globalStats.total_time || 0)}</p></div>
                  <div className={`p-5 rounded-2xl border shadow-lg flex flex-col justify-center ${cardClass}`}><p className={`text-[10px] font-bold uppercase mb-1 ${subTextClass}`}>Viaggi Effettuati</p><p className="text-2xl font-black">{globalStats.total_trips || '0'}</p></div>
                  <div className={`p-5 rounded-2xl border shadow-lg flex flex-col justify-center ${cardClass}`}><p className={`text-[10px] font-bold uppercase mb-1 ${subTextClass}`}>Tempo in Pausa</p><p className="text-2xl font-black text-yellow-500">{formatTime(globalStats.total_pause_time || 0)}</p></div>
                </div>
              </>
            ) : (<div className="flex-1 flex items-center justify-center"><svg className="animate-spin w-8 h-8" style={{ color: hexPrimary }} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>)}
          </div>
        </div>
      )}

      {/* --- SCHERMATA CLASSIFICA --- */}
      {activeView === 'leaderboard' && (
        <div className={`absolute inset-0 z-50 flex flex-col p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] animate-in slide-in-from-right duration-300 ${bgClass}`}>
          <div className="flex items-center gap-4 mb-6">
            <button onClick={() => setActiveView('menu')} className={`p-2 rounded-full transition-colors active:scale-95 ${cardClass}`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg></button>
            <h2 className="text-2xl font-black">Classifica</h2>
          </div>
          
          <div className={`flex p-1 rounded-xl mb-4 shadow-inner ${isDarkMode ? 'bg-zinc-800' : 'bg-gray-200'}`}>
            <button onClick={() => setLeaderboardFilter('distance')} className={`flex-1 py-2 rounded-lg text-[10px] sm:text-xs font-black tracking-widest uppercase transition-all ${leaderboardFilter === 'distance' ? (isDarkMode ? 'bg-zinc-600 text-white shadow' : 'bg-white text-black shadow') : subTextClass}`}>Totale</button>
            <button onClick={() => setLeaderboardFilter('maxSpeed')} className={`flex-1 py-2 rounded-lg text-[10px] sm:text-xs font-black tracking-widest uppercase transition-all ${leaderboardFilter === 'maxSpeed' ? (isDarkMode ? 'bg-zinc-600 text-white shadow' : 'bg-white text-black shadow') : subTextClass}`}>Vel Max</button>
            <button onClick={() => setLeaderboardFilter('longestTrip')} className={`flex-1 py-2 rounded-lg text-[10px] sm:text-xs font-black tracking-widest uppercase transition-all ${leaderboardFilter === 'longestTrip' ? (isDarkMode ? 'bg-zinc-600 text-white shadow' : 'bg-white text-black shadow') : subTextClass}`}>Più Lungo</button>
          </div>

          <div className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)] flex flex-col gap-3">
            {isLoadingLeaderboard ? (
               <div className="flex-1 flex items-center justify-center"><svg className="animate-spin w-8 h-8" style={{ color: hexPrimary }} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>
            ) : sortedLeaderboard.length === 0 ? (
               <p className={`text-sm text-center mt-10 ${subTextClass}`}>La classifica verrà sincronizzata a breve.</p>
            ) : sortedLeaderboard.map((user: any, index: number) => {
              return (
                <div key={user.id || index} className={`flex items-center gap-4 p-4 rounded-2xl border ${cardClass}`}>
                  <div className={`w-10 h-10 flex items-center justify-center rounded-xl font-black text-lg border ${index === 0 ? 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30' : index === 1 ? 'text-gray-300 bg-gray-300/10 border-gray-300/30' : index === 2 ? 'text-amber-600 bg-amber-600/10 border-amber-600/30' : 'opacity-50 border-transparent'}`}>#{index + 1}</div>
                  
                  {user.avatar_url || user.avatar ? (
                    <img src={user.avatar_url || user.avatar} alt="avatar" className="w-12 h-12 rounded-full object-cover border border-white/10" />
                  ) : (
                    <DefaultAvatar color={hexPrimary} className="w-12 h-12 rounded-full border border-white/10" />
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate text-lg">{user.nickname || 'Pilota Anonimo'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black">
                      {leaderboardFilter === 'distance' ? (user.distance || 0).toFixed(0) : 
                       leaderboardFilter === 'maxSpeed' ? (user.maxSpeed || 0).toFixed(0) : 
                       (user.longestTrip || 0).toFixed(1)}
                    </p>
                    <p className={`text-xs font-bold uppercase tracking-widest ${subTextClass}`}>
                      {leaderboardFilter === 'maxSpeed' ? 'km/h' : 'km'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- SCHERMATA STORICO --- */}
      {activeView === 'history' && (
         <div className={`absolute inset-0 z-50 flex flex-col p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] animate-in slide-in-from-right duration-300 ${bgClass}`}>
          <div className="flex items-center gap-4 mb-4">
            <button onClick={() => setActiveView('menu')} className={`p-2 rounded-full transition-colors active:scale-95 ${cardClass}`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg></button>
            <h2 className="text-2xl font-black">Archivio Viaggi</h2>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-4 mb-2 scrollbar-hide">
             {availableFilterTags.map((tag: string) => (
               <button key={tag} onClick={() => toggleFilterTag(tag)} className={`px-4 py-2 rounded-full text-xs font-bold border whitespace-nowrap transition-all ${activeFilterTags.includes(tag) ? 'border-white bg-white text-black shadow-md' : `border-zinc-700 ${subTextClass}`}`}>
                 {tag}
               </button>
             ))}
          </div>

          <div className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)] flex flex-col gap-4">
            {filteredHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2"><p className={`font-medium text-lg ${subTextClass}`}>Nessun viaggio trovato.</p></div>
            ) : (
              filteredHistory.map((trip: any) => (
                <div key={trip.id} onClick={() => { setSelectedTrip(trip); setActiveView('tripDetail'); }} className={`rounded-2xl p-3 flex gap-4 border shadow-lg active:scale-[0.98] transition-all cursor-pointer relative ${cardClass}`}>
                  <div className="w-24 h-24 rounded-xl overflow-hidden bg-zinc-900 flex-shrink-0 border border-black/10"><img src={trip.snapshot} alt="Mappa" className="w-full h-full object-cover" /></div>
                  <div className="flex flex-col justify-center flex-1">
                    <p className={`text-xs font-semibold uppercase ${subTextClass}`}>{trip.date}</p>
                    <div className="flex items-baseline gap-1 mt-1"><p className="text-xl font-black">{trip.distance.toFixed(2)}</p><p className={`text-sm font-medium ${subTextClass}`}>km</p></div>
                    {trip.tag && (
                       <span className="mt-2 px-2 py-0.5 rounded text-[10px] font-bold w-fit bg-zinc-800 text-zinc-300 border border-zinc-700">{trip.tag}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* --- DETTAGLIO VIAGGIO --- */}
      {activeView === 'tripDetail' && selectedTrip && (
        <div className={`absolute inset-0 z-50 flex flex-col animate-in zoom-in-95 duration-200 ${bgClass}`}>
          <div className="relative h-[45%] w-full bg-black">
            <img src={selectedTrip.snapshot} alt="Dettaglio Mappa" className="w-full h-full object-cover opacity-80" />
            <div className="absolute top-0 left-0 right-0 p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] bg-gradient-to-b from-black/80 to-transparent flex justify-between">
              <button onClick={() => setActiveView('history')} className="p-3 bg-zinc-900/80 backdrop-blur-md rounded-full text-white shadow-lg active:scale-95 transition-all"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg></button>
              <button onClick={handleDeleteTrip} className="p-3 bg-red-600/90 hover:bg-red-500 backdrop-blur-md rounded-full text-white shadow-lg active:scale-95 transition-all"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
            </div>
            <div className={`absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t ${isDarkMode ? 'from-black' : 'from-gray-100'} to-transparent`}></div>
          </div>
          <div className="flex-1 p-6 -mt-8 relative z-10 flex flex-col gap-4 pb-[env(safe-area-inset-bottom)]">
            <div className={`p-6 rounded-3xl border shadow-2xl flex flex-col gap-6 ${cardClass}`}>
              <div className={`flex justify-between items-end border-b ${isDarkMode ? 'border-zinc-800' : 'border-zinc-200'} pb-6`}>
                <div>
                  <p className={`text-sm font-bold uppercase mb-1 ${subTextClass}`}>Distanza Percorsa</p>
                  <p className="text-5xl font-black">{selectedTrip.distance.toFixed(2)} <span className={`text-xl font-bold ${subTextClass}`}>km</span></p>
                  {selectedTrip.tag && <span className="mt-2 inline-block px-3 py-1 rounded text-xs font-bold bg-zinc-800 text-zinc-300 border border-zinc-700">{selectedTrip.tag}</span>}
                </div>
                <div className="text-right"><p className={`text-sm font-bold uppercase mb-1 ${subTextClass}`}>Tempo</p><p className="text-2xl font-bold" style={{ color: hexPrimary }}>{formatTime(selectedTrip.time)}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div><p className={`text-xs font-bold uppercase mb-1 ${subTextClass}`}>Velocità Media</p><p className="text-2xl font-black">{Math.round(selectedTrip.avgSpeed)} <span className={`text-sm font-bold ${subTextClass}`}>km/h</span></p></div>
                 <div><p className={`text-xs font-bold uppercase mb-1 ${subTextClass}`}>Vel. Massima</p><p className="text-2xl font-black text-red-500">{selectedTrip.maxSpeed.toFixed(1)} <span className={`text-sm font-bold ${subTextClass}`}>km/h</span></p></div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}