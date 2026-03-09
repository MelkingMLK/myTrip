// src/hooks/useDriveTracker.ts
import { useState, useRef } from 'react';
import { Geolocation, type Position } from '@capacitor/geolocation';
import { calculateDistance, calculateSpeed } from '../utils/geo';

// Struttura dati richiesta per accumulare i valori del viaggio (Fase 3.2.3)
export interface TrackingData {
  lat: number;
  lng: number;
  speed: number;
  timestamp: number;
}

export const useDriveTracker = () => {
  const [isTracking, setIsTracking] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(0); // km/h
  const [totalDistance, setTotalDistance] = useState(0); // km
  const [route, setRoute] = useState<TrackingData[]>([]);
  
  const watchId = useRef<string | null>(null);
  const lastPosition = useRef<Position | null>(null);

  const startTracking = async () => {
    // Richiediamo i permessi prima di iniziare
    const permissions = await Geolocation.requestPermissions();
    if (permissions.location !== 'granted') {
      console.error("Permessi GPS negati");
      return;
    }

    setIsTracking(true);
    
    // Implementazione di watchPosition per la lettura continua (Fase 2.2.1)
    watchId.current = await Geolocation.watchPosition(
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      (position, err) => {
        if (err || !position) {
          console.error("Errore lettura GPS:", err);
          return;
        }

        const { latitude, longitude } = position.coords;
        const timestamp = position.timestamp;
        
        // Proviamo a leggere la velocità nativa del GPS (convertendo m/s in km/h)
        let speed = position.coords.speed !== null ? (position.coords.speed * 3.6) : 0; 

        // Fallback: calcoliamo i dati se abbiamo una posizione precedente
        if (lastPosition.current) {
            const distance = calculateDistance(
                lastPosition.current.coords.latitude,
                lastPosition.current.coords.longitude,
                latitude,
                longitude
            );
            
            setTotalDistance(prev => prev + distance);

            // Se il GPS non ci dà la velocità nativa, usiamo le nostre funzioni (Fase 2.2.2)
            if (position.coords.speed === null) {
               const timeDiff = timestamp - lastPosition.current.timestamp;
               speed = calculateSpeed(distance, timeDiff);
            }
        }

        setCurrentSpeed(speed);
        lastPosition.current = position;

        // Passiamo i dati accumulati allo state manager (Fase 3.2.3)
        setRoute(prev => [...prev, { lat: latitude, lng: longitude, speed, timestamp }]);
      }
    );
  };

  const stopTracking = async () => {
    if (watchId.current) {
      await Geolocation.clearWatch({ id: watchId.current });
      watchId.current = null;
    }
    setIsTracking(false);
    lastPosition.current = null;
  };

  return {
    isTracking,
    currentSpeed,
    totalDistance,
    route,
    startTracking,
    stopTracking
  };
};