import { useState, useEffect } from 'react';
import MapOverlay from './components/MapOverlay';
import SplashScreen from './components/SplashScreen';
import LoginScreen from './components/LoginScreen';
import { spotifyManager } from './services/spotifyManager'; 
import { authManager } from './services/authManager';
import { App as CapApp } from '@capacitor/app';

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // 1. Check Spotify Token (Ora gestito correttamente in asincrono!)
    const checkSpotifyToken = async () => {
      
      const token = await spotifyManager.extractTokenFromUrl();
      if (token) {
        localStorage.setItem('spotifyToken', token);
        window.location.hash = ''; 
      }
      
    };
    // Ascolta il ritorno da Safari con lo Schema URL Personalizzato
    CapApp.addListener('appUrlOpen', async (event) => {
      // Cerchiamo il codice generato da Spotify nell'URL
      const codeMatch = event.url.match(/code=([^&]+)/);
      if (codeMatch) {
        const token = await spotifyManager.extractTokenFromCode(codeMatch[1]);
        if (token) {
          localStorage.setItem('spotifyToken', token);
          window.location.reload(); // Ricarichiamo l'app per mostrare la musica!
        }
      }
    });
    checkSpotifyToken();

    // 2. AUTO-LOGIN 
    const checkSession = async () => {
      // Controlla prima se c'è il nostro salvataggio locale (il "Resta collegato")
      if (localStorage.getItem('rr_logged_in') === 'true') {
        setIsAuthenticated(true);
      }
      
      try {
        const session = await authManager.getCurrentUser?.(); 
        if (session) setIsAuthenticated(true);
      } catch (error) {
        console.log("Nessuna sessione backend attiva");
      }
    };
    checkSession();
  }, []);

  const handleLogout = async () => {
    try {
      await authManager.signOut?.(); 
    } catch(e) {}
    localStorage.removeItem('rr_logged_in'); // Cancella la memoria!
    setIsAuthenticated(false); 
  };

  return (
    <div className="h-screen w-screen bg-black overflow-hidden">
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
      {!showSplash && !isAuthenticated && <LoginScreen onLoginSuccess={() => setIsAuthenticated(true)} />}
      {!showSplash && isAuthenticated && <MapOverlay onLogout={handleLogout} />}
    </div>
  );
}

export default App;