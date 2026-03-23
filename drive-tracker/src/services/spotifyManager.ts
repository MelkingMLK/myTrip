// Sostituisci con il tuo VERO Client ID da Spotify Developer Dashboard
const CLIENT_ID = 'c4eeceee848d474db514637906f13e5d'; 
const REDIRECT_URI = window.location.origin + '/'; // Torna alla home dell'app

export const spotifyManager = {
  // Invia l'utente a fare il login su Spotify
  login() {
    const scopes = ['user-read-currently-playing'];
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(scopes.join(' '))}&response_type=token&show_dialog=true`;
    window.location.href = authUrl;
  },

  // Cattura il token dall'URL dopo che l'utente è tornato
  extractTokenFromUrl() {
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
      const urlParams = new URLSearchParams(hash.replace('#', '?'));
      const token = urlParams.get('access_token');
      // Pulisce l'URL per estetica
      window.history.pushState("", document.title, window.location.pathname);
      return token;
    }
    return null;
  },

  // Polling per leggere la canzone in riproduzione
  async getCurrentlyPlaying(token: string) {
    try {
      const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      // 204 significa "Nessuna canzone in riproduzione"
      if (res.status === 204 || res.status > 400) return null;

      const data = await res.json();
      if (!data || !data.item) return null;

      return {
        title: data.item.name,
        artist: data.item.artists.map((a: any) => a.name).join(', '),
        image: data.item.album.images[0]?.url,
        isPlaying: data.is_playing
      };
    } catch (err) {
      console.error("Errore Spotify:", err);
      return null;
    }
  }
};