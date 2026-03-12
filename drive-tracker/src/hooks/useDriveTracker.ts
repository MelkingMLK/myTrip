import { useState, useRef, useEffect } from 'react';
import { Geolocation, type Position } from '@capacitor/geolocation';
import { calculateDistance, calculateSpeed } from '../utils/geo';

export interface TrackingData {
  lat: number;
  lng: number;
  speed: number;
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

  const watchId = useRef<string | null>(null);
  const lastPosition = useRef<Position | null>(null);
  const isPausedRef = useRef(false);

  // --- 1. GESTIONE SCORRIMENTO TEMPO ---
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (status === 'countdown') {
      // Qui ci limitiamo SOLO a scalare il numero
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
  // Questo useEffect "osserva" il numero e fa scattare la magia quando arriva a 0
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
    // Salvavita per Safari/Web: Proviamo a chiedere i permessi nativi...
    try {
      const permissions = await Geolocation.requestPermissions();
      if (permissions.location !== 'granted') {
         console.error("Permessi GPS negati");
         setStatus('idle');
         return;
      }
    } catch (error) {
      // ...se il browser non supporta l'API dei permessi (come Safari), lo ignoriamo
      // Il browser chiederà il permesso in automatico non appena chiameremo watchPosition
      console.warn("Delego la richiesta dei permessi al browser");
    }

    // CAMBIAMO STATO! Questo fa sparire il pannello nero e fa comparire i bottoni Pausa/Stop
    setStatus('tracking'); 
    
    watchId.current = await Geolocation.watchPosition(
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      (position, err) => {
        if (err || !position) return;
        
        if (isPausedRef.current) {
          setCurrentSpeed(0);
          return;
        }

        const { latitude, longitude } = position.coords;
        const timestamp = position.timestamp;
        let speed = position.coords.speed !== null ? (position.coords.speed * 3.6) : 0; 

        if (lastPosition.current) {
            const distance = calculateDistance(
                lastPosition.current.coords.latitude,
                lastPosition.current.coords.longitude,
                latitude,
                longitude
            );
            
            setTotalDistance(prev => prev + distance);

            if (position.coords.speed === null) {
               const timeDiff = timestamp - lastPosition.current.timestamp;
               speed = calculateSpeed(distance, timeDiff);
            }
        }

        setCurrentSpeed(speed);
        lastPosition.current = position;
        setRoute(prev => [...prev, { lat: latitude, lng: longitude, speed, timestamp }]);
      }
    );
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
    if (watchId.current) {
      await Geolocation.clearWatch({ id: watchId.current });
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