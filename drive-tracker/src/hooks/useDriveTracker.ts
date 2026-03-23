import { useState, useRef, useEffect } from 'react';
import { registerPlugin } from '@capacitor/core';
import { calculateDistance, calculateSpeed } from '../utils/geo';

// Inizializziamo il plugin di Background Geolocation
const BackgroundGeolocation = registerPlugin<any>('BackgroundGeolocation');

export interface TrackingData {
  lat: number;
  lng: number;
  speed: number;
  timestamp: number;
}

interface SimplePosition {
  lat: number;
  lng: number;
  timestamp: number;
}

export type TrackingStatus = 'idle' | 'countdown' | 'tracking' | 'paused' | 'finished';

export const useDriveTracker = () => {
  const [status, setStatus] = useState<TrackingStatus>('idle');
  const [countdown, setCountdown] = useState(10);
  
  // Stati per la UI (in secondi)
  const [totalTime, setTotalTime] = useState(0);
  const [effectiveTime, setEffectiveTime] = useState(0);
  const [pauseTime, setPauseTime] = useState(0);

  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [totalDistance, setTotalDistance] = useState(0);
  const [route, setRoute] = useState<TrackingData[]>([]);

  const watchId = useRef<string | null>(null);
  const lastPosition = useRef<SimplePosition | null>(null);
  const isPausedRef = useRef(false);

  // --- REFS PER IL TEMPO ASSOLUTO (ANTI-BACKGROUND) ---
  const segmentStartTimestamp = useRef<number>(0);
  const accumulatedActiveTime = useRef<number>(0); // In millisecondi
  const accumulatedPauseTime = useRef<number>(0);  // In millisecondi

  // --- 1. GESTIONE SCORRIMENTO TEMPO ---
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (status === 'countdown') {
      interval = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } 
    else if (status === 'tracking' || status === 'paused') {
      // Aggiorniamo la UI ogni secondo, ma calcolando la VERA differenza di tempo!
      interval = setInterval(() => {
        const now = Date.now();
        
        if (status === 'tracking') {
          const currentActive = accumulatedActiveTime.current + (now - segmentStartTimestamp.current);
          setEffectiveTime(Math.floor(currentActive / 1000));
          setPauseTime(Math.floor(accumulatedPauseTime.current / 1000));
          setTotalTime(Math.floor((currentActive + accumulatedPauseTime.current) / 1000));
        } 
        else if (status === 'paused') {
          const currentPause = accumulatedPauseTime.current + (now - segmentStartTimestamp.current);
          setEffectiveTime(Math.floor(accumulatedActiveTime.current / 1000));
          setPauseTime(Math.floor(currentPause / 1000));
          setTotalTime(Math.floor((accumulatedActiveTime.current + currentPause) / 1000));
        }
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [status]);

  // --- 2. CONTROLLO FINE COUNTDOWN ---
  useEffect(() => {
    if (status === 'countdown' && countdown <= 0) {
      startActualTracking();
    }
  }, [status, countdown]);

  const startCountdown = () => {
    // Reset di tutti i tempi e dati
    setTotalTime(0);
    setEffectiveTime(0);
    setPauseTime(0);
    accumulatedActiveTime.current = 0;
    accumulatedPauseTime.current = 0;
    
    setTotalDistance(0);
    setCurrentSpeed(0);
    setRoute([]);
    setCountdown(10);
    setStatus('countdown');
    isPausedRef.current = false;
  };

  const startActualTracking = async () => {
    setStatus('tracking'); 
    segmentStartTimestamp.current = Date.now(); // Inizio del tempo effettivo!
    
    try {
      const id = await BackgroundGeolocation.addWatcher(
        {
          backgroundTitle: "Tracciamento in corso",
          backgroundMessage: "Drive Tracker sta registrando il tuo viaggio in background.",
          requestPermissions: true,
          stale: false,
          distanceFilter: 5 
        },
        (location: any, err: any) => {
          if (err || !location) return;
          
          if (isPausedRef.current) {
            setCurrentSpeed(0);
            return;
          }

          const latitude = location.latitude;
          const longitude = location.longitude;
          const timestamp = location.time || Date.now();
          
          let speed = location.speed != null ? (location.speed * 3.6) : 0; 

          if (lastPosition.current) {
              const distance = calculateDistance(
                  lastPosition.current.lat,
                  lastPosition.current.lng,
                  latitude,
                  longitude
              );
              
              setTotalDistance(prev => prev + distance);

              if (location.speed == null) {
                 const timeDiff = timestamp - lastPosition.current.timestamp;
                 speed = calculateSpeed(distance, timeDiff);
              }
          }

          setCurrentSpeed(speed);
          lastPosition.current = { lat: latitude, lng: longitude, timestamp };
          
          setRoute(prev => [...prev, { lat: latitude, lng: longitude, speed, timestamp }]);
        }
      );

      watchId.current = id;

    } catch (error) {
      console.error("Errore avvio Background Geolocation:", error);
      alert("Il tracciamento in background è supportato solo sui dispositivi nativi (iOS/Android).");
    }
  };

  const pauseTracking = () => {
    // Aggiungiamo il tempo trascorso finora al "serbatoio" del tempo attivo
    accumulatedActiveTime.current += (Date.now() - segmentStartTimestamp.current);
    segmentStartTimestamp.current = Date.now(); // Facciamo partire il cronometro della pausa
    
    setStatus('paused');
    isPausedRef.current = true;
  };

  const resumeTracking = () => {
    // Aggiungiamo il tempo trascorso finora al "serbatoio" della pausa
    accumulatedPauseTime.current += (Date.now() - segmentStartTimestamp.current);
    segmentStartTimestamp.current = Date.now(); // Facciamo ripartire il cronometro attivo
    
    setStatus('tracking');
    isPausedRef.current = false;
    lastPosition.current = null; // Resettiamo l'ultima posizione per non fare sbalzi di km
  };

  const stopTracking = async () => {
    if (watchId.current) {
      await BackgroundGeolocation.removeWatcher({ id: watchId.current });
      watchId.current = null;
    }
    
    // Calcoliamo l'ultimo spezzone di tempo prima di chiudere
    if (status === 'tracking') {
      accumulatedActiveTime.current += (Date.now() - segmentStartTimestamp.current);
    } else if (status === 'paused') {
      accumulatedPauseTime.current += (Date.now() - segmentStartTimestamp.current);
    }

    setStatus('finished');
    isPausedRef.current = false;
    lastPosition.current = null;
  };

  return {
    status,
    countdown,
    totalTime,
    effectiveTime,
    pauseTime,
    currentSpeed,
    totalDistance,
    route,
    startCountdown,
    pauseTracking,
    resumeTracking,
    stopTracking
  };
};