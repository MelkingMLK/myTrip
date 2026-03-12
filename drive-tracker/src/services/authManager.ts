// src/services/authManager.ts
import { supabase } from '../supabaseClient';

export const authManager = {
  // Registrazione nuovo utente
  async signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  },

  // Login utente esistente
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  // Logout
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  // Recupera l'utente attualmente loggato
  async getCurrentUser() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user || null;
  }
};