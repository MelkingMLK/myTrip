import { useState } from 'react';

// Questa prop 'onLoginSuccess' servirà per dire ad App.tsx di sbloccare la Mappa
export default function LoginScreen({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Finta funzione di login (che lo Sviluppatore 2 sostituirà con Supabase)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simuliamo 1.5 secondi di caricamento per fingere la verifica credenziali
    setTimeout(() => {
      setIsLoading(false);
      onLoginSuccess(); // Chiama la funzione che sblocca l'app!
    }, 1500);
  };

  return (
    <div className="relative h-screen w-screen bg-gray-900 flex flex-col items-center justify-center p-6 overflow-hidden">
      
      {/* Sfondo Astratto sfocato */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[100px] animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-900/20 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }}></div>

      <div className="relative z-10 w-full max-w-sm animate-in fade-in zoom-in-95 duration-500">
        
        {/* Header / Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 bg-gray-800 border border-white/10 rounded-2xl flex items-center justify-center mb-4 shadow-2xl shadow-blue-900/20">
            <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-white">Road<span className="text-blue-500">Record</span></h1>
          <p className="text-gray-400 text-sm mt-2 font-medium tracking-wide">
            {isRegistering ? 'Crea il tuo profilo pilota' : 'Accedi al computer di bordo'}
          </p>
        </div>

        {/* Form di Login/Registrazione */}
        <form onSubmit={handleSubmit} className="bg-gray-800/50 backdrop-blur-xl p-8 rounded-3xl border border-white/5 shadow-2xl flex flex-col gap-5">
          
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Email</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-900/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"

            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Password</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-900/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"

            />
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full mt-4 bg-blue-600 hover:bg-blue-500 text-white font-black text-lg py-4 rounded-2xl transition-all active:scale-95 shadow-lg shadow-blue-600/20 border-b-4 border-blue-800 disabled:opacity-70 disabled:active:scale-100 flex justify-center items-center gap-2"
          >
            {isLoading ? (
              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            ) : isRegistering ? 'REGISTRATI' : 'ACCEDI'}
          </button>
        </form>

        {/* Toggle Login/Registrazione */}
        <div className="mt-8 text-center">
          <p className="text-gray-400 text-sm">
            {isRegistering ? 'Hai già un account?' : 'Non hai ancora le chiavi?'}
            <button 
              type="button" 
              onClick={() => setIsRegistering(!isRegistering)}
              className="ml-2 text-blue-400 font-bold hover:text-blue-300 transition-colors"
            >
              {isRegistering ? 'Accedi ora' : 'Registrati qui'}
            </button>
          </p>
        </div>

      </div>
    </div>
  );
}