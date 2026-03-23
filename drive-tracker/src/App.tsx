import { useState, useEffect } from 'react';
import MapOverlay from './components/MapOverlay';
import SplashScreen from './components/SplashScreen';
import LoginScreen from './components/LoginScreen';
// Importiamo il manager di Spotify dello Sviluppatore 2
import { spotifyManager } from './services/spotifyManager'; 

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // LOGICA SPOTIFY TOKEN (Al caricamento dell'app)
  useEffect(() => {
    // 1. Prova a estrarre il token dall'URL (se stiamo tornando dal login di Spotify)
    const token = spotifyManager.extractTokenFromUrl();
    if (token) {
      // 2. Salvalo nella memoria del telefono
      localStorage.setItem('spotifyToken', token);
      // Pulisci l'URL per estetica
      // 2. Salvalo nella memoria del telefono
      localStorage.setItem('spotifyToken', token);
      // Pulisci l'URL per estetica
      window.location.hash = '';
    }
  }, []);

  return (
    <div className="h-screen w-screen bg-gray-900 overflow-hidden">
      {showSplash && (
        <SplashScreen onFinish={() => setShowSplash(false)} />
      )}

      {!showSplash && !isAuthenticated && (
        <LoginScreen onLoginSuccess={() => setIsAuthenticated(true)} />
      )}

      {!showSplash && isAuthenticated && (
        <MapOverlay />
      )}
    </div>
  );
}

export default App;