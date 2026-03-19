import { useState, useEffect } from 'react';
import SplashScreen from './components/SplashScreen';
import MapOverlay from './components/MapOverlay';

function App() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <main className="h-screen w-screen overflow-hidden bg-black">
      {isLoading ? <SplashScreen onFinish={() => setIsLoading(false)} /> : <MapOverlay />}
    </main> 
  );
}

export default App;