import { useState } from 'react';
import { authManager } from '../services/authManager';

export default function LoginScreen({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true); // Nuovo stato per "Resta collegato"

  const [isDarkMode] = useState(() => localStorage.getItem('rr_dark') !== 'false');
  const [appTheme] = useState(() => localStorage.getItem('rr_theme') || 'blue');
  const [customPrimary] = useState(() => localStorage.getItem('rr_custom1') || '#10b981');
  const [customAccent] = useState(() => localStorage.getItem('rr_custom2') || '#f59e0b');

  const getThemeColors = () => {
    let hexPrimary = '#3b82f6'; let hexAccent = '#60a5fa';
    switch (appTheme) {
      case 'black-white': hexPrimary = isDarkMode ? '#ffffff' : '#000000'; hexAccent = isDarkMode ? '#9ca3af' : '#4b5563'; break;
      case 'black-orange': hexPrimary = isDarkMode ? '#ffffff' : '#000000'; hexAccent = '#f97316'; break;
      case 'purple-yellow': hexPrimary = '#9611fe'; hexAccent = '#facc15'; break;
      case 'red-white': hexPrimary = '#ef4444'; hexAccent = isDarkMode ? '#ffffff' : '#000000'; break;
      case 'custom': hexPrimary = customPrimary; hexAccent = customAccent; break;
    }
    return { hexPrimary, hexAccent };
  };

  const { hexPrimary, hexAccent } = getThemeColors();
  const bgClass = isDarkMode ? 'bg-black' : 'bg-gray-100';
  const textClass = isDarkMode ? 'text-white' : 'text-black';
  const cardClass = isDarkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200 shadow-xl';
  const subTextClass = isDarkMode ? 'text-zinc-400' : 'text-zinc-500';
const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (isRegistering) {
        await authManager.signUp(email, password);
        alert("Registrazione completata! Ora puoi accedere.");
        setIsRegistering(false);
      } else {
        await authManager.signIn(email, password);
        
        // NUOVO: Se ha spuntato "Resta collegato", salviamolo in memoria!
        if (rememberMe) {
          localStorage.setItem('rr_logged_in', 'true');
        } else {
          localStorage.removeItem('rr_logged_in');
        }
        
        onLoginSuccess();
      }
    } catch (error: any) {
      alert(`Errore: ${error.message || "Credenziali errate"}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`relative h-screen w-screen flex flex-col items-center justify-center p-6 overflow-hidden transition-colors duration-500 ${bgClass} ${textClass}`}>
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-[100px] animate-pulse opacity-20" style={{ backgroundColor: hexPrimary }}></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-[100px] animate-pulse opacity-20" style={{ backgroundColor: hexAccent, animationDelay: '1s' }}></div>

      <div className="relative z-10 w-full max-w-sm animate-in fade-in zoom-in-95 duration-500">
        
        <div className="flex flex-col items-center mb-10">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-2xl border ${cardClass}`}>
            <svg className="w-8 h-8" style={{ color: hexPrimary }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </div>
          <h1 className="text-4xl font-black tracking-tighter">
            <span style={{ color: hexPrimary }}>Road</span>
            <span style={{ color: hexAccent }}>Record</span>
          </h1>
          <p className={`text-sm mt-2 font-medium tracking-wide ${subTextClass}`}>
            {isRegistering ? 'Crea il tuo profilo ' : 'Accedi al sistema'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className={`p-8 rounded-3xl border shadow-2xl flex flex-col gap-4 ${cardClass}`}>
          <div>
            <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${subTextClass}`}>Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={`w-full bg-transparent border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 transition-all ${isDarkMode ? 'border-zinc-700 text-white' : 'border-gray-300 text-black'}`} style={{ outlineColor: hexPrimary }} />
          </div>

          <div>
            <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${subTextClass}`}>Password</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={`w-full bg-transparent border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 transition-all ${isDarkMode ? 'border-zinc-700 text-white' : 'border-gray-300 text-black'}`} style={{ outlineColor: hexPrimary }} />
          </div>

          {/* NUOVO: Resta collegato e Password dimenticata */}
          {!isRegistering && (
            <div className="flex items-center justify-between mt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={rememberMe} onChange={() => setRememberMe(!rememberMe)} className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: hexPrimary }} />
                <span className={`text-xs font-bold ${subTextClass}`}>Resta collegato</span>
              </label>
              <button type="button" className="text-xs font-bold transition-opacity hover:opacity-80" style={{ color: hexAccent }}>Psw persa?</button>
            </div>
          )}

          <button type="submit" disabled={isLoading} className="w-full mt-2 font-black text-lg py-4 rounded-2xl transition-all active:scale-95 shadow-lg border-b-4 text-white flex justify-center items-center" style={{ backgroundColor: hexPrimary, borderColor: hexAccent, opacity: isLoading ? 0.7 : 1 }}>
            {isLoading ? <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : isRegistering ? 'REGISTRATI' : 'ACCEDI'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className={`text-sm ${subTextClass}`}>
            {isRegistering ? 'Hai già un account?' : 'Non hai ancora le chiavi?'}
            <button type="button" onClick={() => setIsRegistering(!isRegistering)} className="ml-2 font-bold transition-colors hover:opacity-80" style={{ color: hexAccent }}>
              {isRegistering ? 'Accedi ora' : 'Registrati qui'}
            </button>
          </p>
        </div>

      </div>
    </div>
  );
}