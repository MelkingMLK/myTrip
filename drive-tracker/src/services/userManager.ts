import { supabase } from '../supabaseClient';

export const userManager = {
  // Recupera i Record Personali
  async getUserRecords() {
    const { data, error } = await supabase.rpc('get_user_records');
    if (error) { console.error("Errore nel recupero dei record:", error); return null; }
    return data;
  },

  // Scarica dal DB anche Nickname e Avatar, non solo l'auto
  async getPreferences() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;

    const { data, error } = await supabase
      .from('user_preferences')
      .select('car_icon, car_color, nickname, avatar_url')
      .eq('id', session.user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error("Errore nel recupero preferenze:", error);
    }
    return data;
  },

  // Salva le preferenze del Garage
  async savePreferences(car_icon: string, car_color: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return false;

    const { error } = await supabase
      .from('user_preferences')
      .upsert({ id: session.user.id, car_icon, car_color, updated_at: new Date().toISOString() });

    if (error) { console.error("Errore salvataggio preferenze:", error); return false; }
    return true;
  },

  // Prende il file locale e lo spara nel Bucket di Supabase
  async uploadAvatar(base64Image: string): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;

    try {
      const res = await fetch(base64Image);
      const blob = await res.blob();
      // Chiamiamo il file col tuo ID, così se cambi foto sovrascrive la vecchia
      const fileName = `${session.user.id}_avatar.png`; 

      const { error } = await supabase.storage
        .from('avatars')
        .upload(fileName, blob, { contentType: 'image/png', upsert: true });

      if (error) throw error;

      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
      return `${data.publicUrl}?t=${Date.now()}`;
    } catch (error) {
      console.error("Errore upload avatar:", error);
      return null;
    }
  },

  // Aggiornamento Profilo Utente
  async updateProfile(nickname: string, avatar_url: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return false;

    const { error } = await supabase
      .from('user_preferences')
      .upsert({ id: session.user.id, nickname, avatar_url, updated_at: new Date().toISOString() });

    if (error) { console.error("Errore salvataggio profilo:", error); return false; }
    return true;
  },

  // Download della Classifica Globale
  async getLeaderboard() {
    const { data, error } = await supabase.rpc('get_global_leaderboard');
    if (error) { console.error("Errore nel recupero della classifica:", error); return []; }
    return data;
  }
};