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

// Creiamo un tipo più semplice per l'ultima posizione, per slegarci dalle dipendenze del vecchio plugin
interface SimplePosition {
  lat: number;
  lng: number;
  timestamp: number;
}

export type TrackingStatus = 'idle' | 'countdown' | 'tracking' | 'paused' | 'finished';

export const useDriveTracker = () => {
  const [status, setStatus] = useState<TrackingStatus>('idle');
  const [countdown, setCountdown] = useState(10);
  
  const [totalTime, setTotalTime] = useState(0);
  const [effectiveTime, setEffectiveTime] = useState(0);
  const [pauseTime, setPauseTime] = useState(0);

  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [totalDistance, setTotalDistance] = useState(0);
  const [route, setRoute] = useState<TrackingData[]>([]);

  // Il Watcher ID con questo plugin è una stringa
  const watchId = useRef<string | null>(null);
  const lastPosition = useRef<SimplePosition | null>(null);
  const isPausedRef = useRef(false);

  // --- 1. GESTIONE SCORRIMENTO TEMPO ---
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (status === 'countdown') {
      interval = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } 
    else if (status === 'tracking' || status === 'paused') {
      interval = setInterval(() => {
        setTotalTime((prev) => prev + 1);
        if (status === 'tracking') setEffectiveTime((prev) => prev + 1);
        else if (status === 'paused') setPauseTime((prev) => prev + 1);
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
    setTotalTime(0);
    setEffectiveTime(0);
    setPauseTime(0);
    setTotalDistance(0);
    setCurrentSpeed(0);
    setRoute([]);
    setCountdown(10);
    setStatus('countdown');
    isPausedRef.current = false;
  };

  const startActualTracking = async () => {
    setStatus('tracking'); 
    
    try {
      // Usiamo il nuovo plugin corazzato per il Background Tracking
      const id = await BackgroundGeolocation.addWatcher(
        {
          backgroundTitle: "Tracciamento in corso",
          backgroundMessage: "Drive Tracker sta registrando il tuo viaggio in background.",
          requestPermissions: true, // Chiede in automatico i permessi "Sempre" su iOS
          stale: false,
          distanceFilter: 5 // Aggiorna ogni 5 metri per risparmiare un po' di batteria
        },
        (location: any, err: any) => {
          if (err || !location) {
            console.error("Errore GPS Background:", err);
            return;
          }
          
          if (isPausedRef.current) {
            setCurrentSpeed(0);
            return;
          }

          const latitude = location.latitude;
          const longitude = location.longitude;
          const timestamp = location.time || Date.now();
          
          // Il plugin restituisce la velocità in m/s (se disponibile)
          let speed = location.speed != null ? (location.speed * 3.6) : 0; 

          if (lastPosition.current) {
              const distance = calculateDistance(
                  lastPosition.current.lat,
                  lastPosition.current.lng,
                  latitude,
                  longitude
              );
              
              setTotalDistance(prev => prev + distance);

              // Calcolo manuale se il GPS non fornisce la velocità nativa
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
      // Fallback in caso di Safari su Mac che non supporta il plugin nativo
      alert("Il tracciamento in background è supportato solo sui dispositivi nativi (iOS/Android).");
    }
  };

  const pauseTracking = () => {
    setStatus('paused');
    isPausedRef.current = true;
  };

  const resumeTracking = () => {
    setStatus('tracking');
    isPausedRef.current = false;
    lastPosition.current = null;
  };

  const stopTracking = async () => {
    // Rimuoviamo l'osservatore di sistema per fermare l'uso della batteria
    if (watchId.current) {
      await BackgroundGeolocation.removeWatcher({ id: watchId.current });
      watchId.current = null;
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