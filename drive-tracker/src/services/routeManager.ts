// src/services/routeManager.ts
import { supabase } from '../supabaseClient';
import { Network } from '@capacitor/network';
import { Preferences } from '@capacitor/preferences';
export interface RouteStats {
  distance_km: number;
  avg_speed_kmh: number;
  max_speed_kmh: number;
  total_time_seconds: number;
  driving_time_seconds: number;
  pause_time_seconds: number;
  route_data?: any;
  tag?: string; // <--- AGGIUNGI QUESTO
}

const OFFLINE_KEY = 'offline_pending_routes';

export const routeManager = {

  // FASE 4.2 & 5.2: Salvataggio con Auth
  async saveRoute(base64Image: string, stats: RouteStats) {
    const status = await Network.getStatus();
    
    if (!status.connected) {
      console.warn("Nessuna connessione. Salvataggio in locale...");
      await this.saveToOfflineStorage(base64Image, stats);
      return { success: true, offline: true };
    }

    try {
      // FASE 5: Controllo utente loggato
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Devi effettuare il login per salvare nel Cloud.");
      const userId = session.user.id;

      // 1. Upload Immagine
      const fileName = `${userId}_${Date.now()}.png`; // Rendiamo il nome file unico per utente
      const res = await fetch(base64Image);
      const blob = await res.blob();

      const { error: uploadError } = await supabase.storage
        .from('snapshots')
        .upload(fileName, blob, { contentType: 'image/png' });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('snapshots')
        .getPublicUrl(fileName);

      // 2. Salvataggio Database con user_id!
      const { error: dbError } = await supabase.from('routes').insert({
        user_id: userId,
        snapshot_url: publicUrlData.publicUrl,
        ...stats
      });

      if (dbError) throw dbError;

      return { success: true, offline: false };

    } catch (error) {
      console.error("Errore Cloud:", error);
      await this.saveToOfflineStorage(base64Image, stats);
      return { success: true, offline: true };
    }
  },

  // FASE 5.2.2 & 5.2.3: Recupero Storico con Paginazione
  // page = 0 (primi 10), page = 1 (da 11 a 20), ecc.
  async getRoutes(page: number = 0, limit: number = 10) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return []; // Se non c'è utente, niente storico

    const from = page * limit;
    const to = from + limit - 1;

    // Grazie alle RLS di Supabase (Fase 1), questa query scaricherà AUTOMATICAMENTE
    // solo i viaggi dell'utente loggato, senza bisogno di scrivere "WHERE user_id = ..."
    const { data, error } = await supabase
      .from('routes')
      .select('*')
      .order('created_at', { ascending: false }) // I più recenti prima
      .range(from, to); // FASE 5.2.3: Paginazione!

    if (error) {
      console.error("Errore recupero storico:", error);
      return [];
    }

    return data;
  },

  // --- LOGICA OFFLINE (Invariata) ---
  async saveToOfflineStorage(base64Image: string, stats: RouteStats) {
    const { value } = await Preferences.get({ key: OFFLINE_KEY });
    const pendingRoutes = value ? JSON.parse(value) : [];
    pendingRoutes.push({ base64Image, stats, timestamp: Date.now() });
    await Preferences.set({ key: OFFLINE_KEY, value: JSON.stringify(pendingRoutes) });
  },

  async syncOfflineRoutes() {
    const status = await Network.getStatus();
    if (!status.connected) return;

    const { value } = await Preferences.get({ key: OFFLINE_KEY });
    if (!value) return;

    const pendingRoutes = JSON.parse(value);
    if (pendingRoutes.length === 0) return;
    
    const failedRoutes = [];
    for (const route of pendingRoutes) {
      try {
        await this.saveRoute(route.base64Image, route.stats);
      } catch (e) {
        failedRoutes.push(route);
      }
    }
    await Preferences.set({ key: OFFLINE_KEY, value: JSON.stringify(failedRoutes) });
  }
};