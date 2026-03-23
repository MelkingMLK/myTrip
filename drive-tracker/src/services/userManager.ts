import { supabase } from '../supabaseClient';

export const userManager = {
  // 7.2.1: Recupera i Record Personali (Aggregazione)
  async getUserRecords() {
    const { data, error } = await supabase.rpc('get_user_records');
    
    if (error) {
      console.error("Errore nel recupero dei record:", error);
      return null;
    }
    return data;
  },

  // 7.2.2: Recupera le preferenze del Garage
  async getPreferences() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;

    const { data, error } = await supabase
      .from('user_preferences')
      .select('car_icon, car_color')
      .eq('id', session.user.id)
      .single();

    if (error && error.code !== 'PGRST116') { // Ignora l'errore se la riga non esiste ancora
      console.error("Errore nel recupero preferenze:", error);
    }
    return data;
  },

  // 7.2.2: Salva le preferenze del Garage
  async savePreferences(car_icon: string, car_color: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return false;

    const { error } = await supabase
      .from('user_preferences')
      .upsert({ 
        id: session.user.id, 
        car_icon, 
        car_color, 
        updated_at: new Date().toISOString() 
      });

    if (error) {
      console.error("Errore salvataggio preferenze:", error);
      return false;
    }
    return true;
  },

  // FASE 8.2.1: Aggiornamento Profilo Utente
  async updateProfile(nickname: string, avatar_url: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return false;

    const { error } = await supabase
      .from('user_preferences')
      .upsert({ 
        id: session.user.id, 
        nickname, 
        avatar_url, 
        updated_at: new Date().toISOString() 
      });

    if (error) {
      console.error("Errore salvataggio profilo:", error);
      return false;
    }
    return true;
  },

  // FASE 8.2.2: Download della Classifica Globale
  async getLeaderboard() {
    // Chiamiamo la RPC "Security Definer" che calcola i totali di tutti
    const { data, error } = await supabase.rpc('get_global_leaderboard');
    
    if (error) {
      console.error("Errore nel recupero della classifica:", error);
      return [];
    }

    // Il Frontend potrà prendere questo array di oggetti e ordinarlo
    // facilmente con .sort() in base alla metrica scelta (Distanza, Vel Max, ecc.)
    return data;
  }
};
