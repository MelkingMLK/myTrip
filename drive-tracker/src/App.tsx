import { useState } from 'react';
import MapOverlay from './components/MapOverlay';
import SplashScreen from './components/SplashScreen';
import LoginScreen from './components/LoginScreen';

function App() {
  // Stati per controllare quale schermata mostrare
  const [showSplash, setShowSplash] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  return (
    <div className="h-screen w-screen bg-gray-900 overflow-hidden">
      {/* 1. Mostra la Splash Screen per 3 secondi */}
      {showSplash && (
        <SplashScreen onFinish={() => setShowSplash(false)} />
      )}

      {/* 2. Finita la Splash, se NON sei loggato, mostra il Login */}
      {!showSplash && !isAuthenticated && (
        <LoginScreen onLoginSuccess={() => setIsAuthenticated(true)} />
      )}

      {/* 3. Finito il Login, mostra la Mappa */}
      {!showSplash && isAuthenticated && (
        <MapOverlay />
      )}
    </div>
  );
}

export default App;