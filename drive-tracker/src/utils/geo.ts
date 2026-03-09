// src/utils/geo.ts

// Funzione di utilità per convertire i gradi in radianti
const toRad = (value: number) => (value * Math.PI) / 180;

// Calcola la distanza in km tra due coordinate usando l'algoritmo Haversine
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Raggio medio della Terra in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Ritorna la distanza in Km
};

// Calcola la velocità istantanea in km/h in base alla distanza e al tempo trascorso
export const calculateSpeed = (distanceKm: number, timeDiffMs: number): number => {
  if (timeDiffMs === 0) return 0;
  const timeDiffHours = timeDiffMs / (1000 * 60 * 60);
  return distanceKm / timeDiffHours;
};