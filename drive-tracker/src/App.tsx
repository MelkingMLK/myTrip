import { useState, useEffect } from 'react';
import MapOverlay from './components/MapOverlay';
import SplashScreen from './components/SplashScreen';
import LoginScreen from './components/LoginScreen';
import { spotifyManager } from './services/spotifyManager'; 
import { authManager } from './services/authManager';
import { App as CapApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // 1. ASCOLTA IL RITORNO DA SPOTIFY
    const setupListener = async () => {
      const listener = await CapApp.addListener('appUrlOpen', async (event) => {
        const url = event.url;
        
        if (url.includes('code=')) {
          // 1. Chiudi subito la finestra nativa di login
          await Browser.close();

          // 2. Estrai il codice in modo sicuro
          const code = url.split('code=')[1]?.split('&')[0];
          if (code) {
            const token = await spotifyManager.extractTokenFromCode(code);
            if (token) {
              localStorage.setItem('spotifyToken', token);
              
              // 3. Ricarica l'interfaccia React per mostrare "Connesso"
              window.location.href = "/";
            }
          }
        }
      });
      return listener;
    };

    const listenerPromise = setupListener();

    // 2. AUTO-LOGIN SUPABASE
    const checkAuth = async () => {
      if (localStorage.getItem('rr_logged_in') === 'true') {
        setIsAuthenticated(true);
      }
      try {
        const user = await authManager.getCurrentUser?.();
        if (user) {
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
          localStorage.removeItem('rr_logged_in');
        }
      } catch (e) {
        setIsAuthenticated(false);
      }
    };

    checkAuth();

    return () => {
      listenerPromise.then(l => l.remove());
    };
  }, []);

  const handleLogout = async () => {
    try { await authManager.signOut?.(); } catch(e) {}
    localStorage.removeItem('rr_logged_in'); 
    setIsAuthenticated(false); 
  };

  if (isAuthenticated === null) return null;

  return (
    <div className="h-screen w-screen bg-black overflow-hidden select-none">
      {showSplash ? (
        <SplashScreen onFinish={() => setShowSplash(false)} />
      ) : isAuthenticated ? (
        <MapOverlay onLogout={handleLogout} />
      ) : (
        <LoginScreen onLoginSuccess={() => setIsAuthenticated(true)} />
      )}
    </div>
  );
}

export default App;