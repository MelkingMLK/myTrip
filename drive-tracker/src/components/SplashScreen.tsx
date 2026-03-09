export default function SplashScreen() {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-gray-900">
      <div className="relative flex items-center justify-center">
        <div className="absolute h-24 w-24 animate-ping rounded-full bg-blue-500 opacity-75"></div>
        <div className="relative z-10 flex h-24 w-24 items-center justify-center rounded-full bg-blue-600 shadow-lg shadow-blue-500/50">
          <span className="text-4xl">🚗</span>
        </div>
      </div>
      <h1 className="mt-8 text-4xl font-extrabold tracking-wider text-white">
        DRIVE<span className="text-blue-500">TRACKER</span>
      </h1>
      <p className="mt-4 animate-pulse text-sm text-gray-400">Acquisizione segnale GPS...</p>
    </div>
  );
}