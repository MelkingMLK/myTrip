import { Browser } from '@capacitor/browser';

const CLIENT_ID = 'c4eeceee848d474db514637906f13e5d'; 
const REDIRECT_URI = 'com.tuonome.drivetracker://callback'; 

const SPOTIFY_AUTH = 'https://accounts.spotify.com/authorize?';
const SPOTIFY_TOKEN = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API = 'https://api.spotify.com/v1/me/player/currently-playing';

const generateRandomString = (length: number) => {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], "");
};

const sha256 = async (plain: string) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest('SHA-256', data);
};

const base64encode = (input: ArrayBuffer) => {
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
};

export const spotifyManager = {
  async login() {
    try {
      // 1. Testiamo se la funzione viene almeno chiamata
      console.log("Inizio procedura di login...");
      
      const codeVerifier = generateRandomString(64);
      window.localStorage.setItem('spotify_code_verifier', codeVerifier);
      
      const hashed = await sha256(codeVerifier);
      const codeChallenge = base64encode(hashed);
      
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: CLIENT_ID,
        scope: 'user-read-currently-playing user-read-playback-state',
        redirect_uri: REDIRECT_URI,
        code_challenge_method: 'S256',
        code_challenge: codeChallenge,
      });

      const finalUrl = SPOTIFY_AUTH + params.toString();
      
      // 2. Apriamo il Browser Nativo
      await Browser.open({ 
        url: finalUrl,
        presentationStyle: 'popover' 
      });

    } catch (error: any) {
      // SE C'È UN ERRORE, ORA L'APP CE LO DEVE DIRE!
      alert("ERRORE DI SISTEMA: " + (error.message || JSON.stringify(error)));
      console.error("Errore Login Spotify:", error);
    }
  },

  async extractTokenFromCode(code: string) {
    const codeVerifier = window.localStorage.getItem('spotify_code_verifier');
    if (!codeVerifier) {
      alert("Errore di sicurezza: ricarica l'app e riprova.");
      return null;
    }
    
    try {
      const payload = new URLSearchParams({
        client_id: CLIENT_ID,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI,
        code_verifier: codeVerifier
      });

      const response = await fetch(SPOTIFY_TOKEN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: payload
      });

      const data = await response.json();
      if (data.access_token) {
          window.localStorage.removeItem('spotify_code_verifier');
          return data.access_token;
      }
      return null;
    } catch (err) {
      alert("Errore di rete durante il collegamento a Spotify.");
      return null;
    }
  },

  async getCurrentlyPlaying(token: string) {
    try {
      const res = await fetch(SPOTIFY_API, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401) {
        localStorage.removeItem('spotifyToken');
        return null;
      }
      if (res.status === 204 || res.status > 400) return null;
      const data = await res.json();
      if (!data || !data.item) return null;
      return {
        title: data.item.name,
        artist: data.item.artists.map((a: any) => a.name).join(', '),
        image: data.item.album.images[0]?.url,
        isPlaying: data.is_playing
      };
    } catch (err) { return null; }
  }
};