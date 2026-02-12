import React, { useState, useEffect } from 'react';
import { Button } from './components/Button';
import { UploadField } from './components/UploadField';
import { AppStatus, FileInputState } from './types';
import { generateCarVisualization } from './services/geminiService';

const App: React.FC = () => {
  const [hasApiKey, setHasApiKey] = useState(false);
  const [manualApiKey, setManualApiKey] = useState('');
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [carImage, setCarImage] = useState<FileInputState>({ file: null, previewUrl: null, base64: null });
  const [foilImage, setFoilImage] = useState<FileInputState>({ file: null, previewUrl: null, base64: null });
  
  const [resultImage, setResultImage] = useState<string | null>(null);

  useEffect(() => {
    checkApiKey();
  }, []);

  const checkApiKey = async () => {
    try {
      if (window.aistudio && window.aistudio.hasSelectedApiKey) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      }
    } catch (e) {
      console.error("Failed to check API key", e);
    }
  };

  const handleSelectKey = async () => {
    try {
      if (window.aistudio && window.aistudio.openSelectKey) {
        await window.aistudio.openSelectKey();
        // Assume success after interaction (as per guidelines to avoid race condition)
        setHasApiKey(true);
      }
    } catch (e) {
      console.error("Failed to select API key", e);
      setErrorMsg("Nie udało się wybrać klucza API. Spróbuj ponownie.");
    }
  };

  const processFile = (file: File, setState: React.Dispatch<React.SetStateAction<FileInputState>>) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setState({
        file: file,
        previewUrl: result,
        base64: result
      });
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setState: React.Dispatch<React.SetStateAction<FileInputState>>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0], setState);
    }
  };

  const clearFile = (setState: React.Dispatch<React.SetStateAction<FileInputState>>) => {
    setState({ file: null, previewUrl: null, base64: null });
  };

  const handleGenerate = async () => {
    if (!carImage.base64 || !foilImage.base64) {
      setErrorMsg("Proszę wgrać zdjęcie samochodu i próbnik folii.");
      return;
    }

    // Allow generation if manual key is present OR if system key is present
    if (!manualApiKey && !hasApiKey) {
      setErrorMsg("Wymagany jest klucz API. Wpisz go powyżej lub wybierz.");
      return;
    }

    setStatus(AppStatus.GENERATING);
    setErrorMsg(null);

    try {
      const generatedImg = await generateCarVisualization({
        carBase64: carImage.base64,
        foilBase64: foilImage.base64,
        apiKey: manualApiKey || undefined // Pass manual key if it exists
      });
      setResultImage(generatedImg);
      setStatus(AppStatus.SUCCESS);
    } catch (e: any) {
      console.error("Generation failed:", e);
      setStatus(AppStatus.ERROR);
      setErrorMsg(e.message || "Wystąpił błąd podczas generowania wizualizacji.");
      // Retry logic for API key if not found and we were relying on the system key
      if (!manualApiKey && e.message && e.message.includes("Requested entity was not found")) {
        setHasApiKey(false);
        handleSelectKey();
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-black text-white font-sans selection:bg-red-600 selection:text-white">
      
      {/* Left Panel: Configuration */}
      <div className="w-full md:w-1/2 p-6 md:p-12 overflow-y-auto border-r border-zinc-800 flex flex-col">
        <div className="mb-8">
           <h1 className="text-4xl md:text-5xl font-bold mb-2 tracking-tighter">
            CAR <span className="text-red-600">FORCE</span>
          </h1>
          <p className="text-xl text-gray-400 font-light">Wizualizator Oklejania</p>
          <div className="h-1 w-20 bg-red-600 mt-6"></div>
        </div>

        {/* API Key Configuration */}
        <div className="mb-8 p-6 bg-zinc-900 border border-zinc-700 rounded-lg">
          <h3 className="text-lg font-bold mb-4 text-red-500 uppercase tracking-wide">Konfiguracja API</h3>
          
          {/* Manual Input */}
          <div className="mb-4">
            <label className="text-sm font-bold uppercase tracking-wide text-gray-300 block mb-2">
              Wpisz Klucz API (Google Gemini)
            </label>
            <input
              type="password"
              value={manualApiKey}
              onChange={(e) => setManualApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full bg-black border border-zinc-600 rounded p-3 text-white focus:border-red-600 focus:outline-none transition-colors placeholder-zinc-600 font-mono text-sm"
            />
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-500 mb-4">
            <div className="h-px bg-zinc-700 flex-grow"></div>
            <span>LUB</span>
            <div className="h-px bg-zinc-700 flex-grow"></div>
          </div>

          {/* Fallback to System Key */}
          {!hasApiKey ? (
            <Button onClick={handleSelectKey} variant="outline" fullWidth className="text-xs py-2">
              Wybierz Klucz z AI Studio
            </Button>
          ) : (
            <div className="text-green-500 text-sm flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              Klucz AI Studio aktywny
            </div>
          )}
          
          <p className="text-gray-500 mt-4 text-xs">
            Wymagany model: <span className="text-gray-300">gemini-3-pro-image-preview</span>. 
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="underline hover:text-white ml-1">
              Pobierz klucz tutaj
            </a>.
          </p>
        </div>

        <div className="space-y-2 flex-grow">
          <UploadField 
            id="car-upload"
            label="1. Zdjęcie Samochodu"
            subLabel="Wgraj wyraźne zdjęcie samochodu"
            previewUrl={carImage.previewUrl}
            onChange={(e) => handleFileChange(e, setCarImage)}
            onClear={() => clearFile(setCarImage)}
          />

          <UploadField 
            id="foil-upload"
            label="2. Próbnik Folii"
            subLabel="Wgraj zdjęcie koloru/faktury folii"
            previewUrl={foilImage.previewUrl}
            onChange={(e) => handleFileChange(e, setFoilImage)}
            onClear={() => clearFile(setFoilImage)}
          />

          {errorMsg && (
            <div className="p-4 bg-red-900/30 border border-red-800 text-red-200 text-sm rounded mt-4">
              {errorMsg}
            </div>
          )}
        </div>

        <div className="mt-8 pt-6 border-t border-zinc-800">
           <Button 
            onClick={handleGenerate} 
            fullWidth 
            disabled={status === AppStatus.GENERATING || (!hasApiKey && !manualApiKey)}
            className="h-14 text-lg shadow-red-900/40"
          >
            {status === AppStatus.GENERATING ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generowanie... (może potrwać 20s)
              </span>
            ) : "Generuj Wizualizację"}
          </Button>
        </div>
      </div>

      {/* Right Panel: Result */}
      <div className="w-full md:w-1/2 bg-zinc-900 relative flex flex-col items-center justify-center p-6 min-h-[500px]">
        {/* Background Grid Pattern */}
        <div className="absolute inset-0 z-0 opacity-10 pointer-events-none" style={{
            backgroundImage: 'radial-gradient(circle, #333 1px, transparent 1px)',
            backgroundSize: '20px 20px'
        }}></div>

        {status === AppStatus.IDLE && (
           <div className="text-center z-10 opacity-40">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-24 h-24 mx-auto mb-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
              </svg>
              <h2 className="text-2xl font-light">Wizualizacja pojawi się tutaj</h2>
              <p className="mt-2 text-sm">Skonfiguruj parametry po lewej stronie</p>
           </div>
        )}

        {status === AppStatus.GENERATING && (
          <div className="z-10 text-center">
             <div className="inline-block animate-pulse">
                <div className="h-1 w-32 bg-red-600 mb-2"></div>
             </div>
             <p className="text-xl font-light animate-pulse">Przetwarzanie AI...</p>
             <p className="text-xs text-zinc-500 mt-2">To może chwilę potrwać</p>
          </div>
        )}

        {resultImage && status === AppStatus.SUCCESS && (
          <div className="z-10 w-full max-w-4xl flex flex-col gap-6 animate-fade-in">
             <div className="bg-black p-2 border border-zinc-800 shadow-2xl rounded-lg">
                <img src={resultImage} alt="Wygenerowana wizualizacja" className="w-full h-auto rounded" />
             </div>
             
             <div className="flex flex-col md:flex-row gap-4 justify-center">
                <a 
                  href={resultImage} 
                  download="car-force-visualization.png" 
                  className="w-full md:w-auto"
                >
                  <Button className="w-full md:w-64">
                    Pobierz Grafikę
                  </Button>
                </a>
                <Button 
                   variant="secondary" 
                   className="w-full md:w-auto"
                   onClick={() => setResultImage(null)}
                >
                   Nowa Wizualizacja
                </Button>
             </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default App;