import React, { useState, useCallback } from 'react';
import { AppState, ProcessedSlide, ConversionMode } from './types';
import Dropzone from './components/Dropzone';
import SlidePreview from './components/SlidePreview';
import { convertPdfToImages } from './services/pdfUtils';
import { analyzeSlideImage } from './services/geminiService';
import { generatePptx, generateImagePptx } from './services/pptBuilder';
import { FileDown, Loader2, Sparkles, RefreshCw, Presentation, Image as ImageIcon } from 'lucide-react';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [slides, setSlides] = useState<ProcessedSlide[]>([]);
  const [progress, setProgress] = useState<{current: number, total: number}>({current: 0, total: 0});
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ConversionMode>('AI_EXTRACT');

  const handleFileAccepted = useCallback(async (file: File) => {
    try {
      setAppState(AppState.PROCESSING_PDF);
      setError(null);
      
      const images = await convertPdfToImages(file);
      
      const initialSlides: ProcessedSlide[] = images.map(img => ({
        originalImage: img,
        analysis: null,
        status: 'pending'
      }));
      
      setSlides(initialSlides);
      setProgress({ current: 0, total: initialSlides.length });
      
      // Branch logic based on selected mode
      if (mode === 'AI_EXTRACT') {
        analyzeSlides(initialSlides);
      } else {
        // IMAGE_ONLY mode - skip Gemini analysis
        await createSimplePptx(initialSlides);
      }
      
    } catch (err) {
      console.error(err);
      setError("Failed to process PDF. Please try a simpler file.");
      setAppState(AppState.ERROR);
    }
  }, [mode]);

  // Logic for IMAGE_ONLY mode
  const createSimplePptx = async (currentSlides: ProcessedSlide[]) => {
      setAppState(AppState.GENERATING_PPT);
      // Wait a brief moment so UI updates
      await new Promise(r => setTimeout(r, 500));
      
      try {
          const updatedSlides = currentSlides.map(s => ({ ...s, status: 'done' as const }));
          setSlides(updatedSlides);
          
          await generateImagePptx(updatedSlides);
          setAppState(AppState.COMPLETED);
      } catch (err) {
          console.error(err);
          setError("Failed to generate PowerPoint file.");
          setAppState(AppState.ERROR);
      }
  };

  // Logic for AI_EXTRACT mode
  const analyzeSlides = async (currentSlides: ProcessedSlide[]) => {
    setAppState(AppState.ANALYZING_SLIDES);
    
    // Process in batches or sequentially to avoid rate limits if necessary
    // Here we do sequentially to show nice progress
    const updatedSlides = [...currentSlides];

    for (let i = 0; i < updatedSlides.length; i++) {
        // Update status to analyzing
        updatedSlides[i] = { ...updatedSlides[i], status: 'analyzing' };
        setSlides([...updatedSlides]);

        try {
            const analysis = await analyzeSlideImage(updatedSlides[i].originalImage);
            updatedSlides[i] = { 
                ...updatedSlides[i], 
                analysis, 
                status: 'done' 
            };
        } catch (err) {
            console.error(`Error analyzing slide ${i+1}`, err);
            updatedSlides[i] = { ...updatedSlides[i], status: 'error' };
        }
        
        // Update state after each slide
        setSlides([...updatedSlides]);
        setProgress(prev => ({ ...prev, current: i + 1 }));
    }

    setAppState(AppState.GENERATING_PPT);
    try {
        const validSlides = updatedSlides.filter(s => s.status === 'done' && s.analysis);
        
        if (validSlides.length === 0) {
            throw new Error("No slides were successfully analyzed.");
        }

        // Pass the full slide objects so builder can access original images for cropping figures
        await generatePptx(validSlides);
        setAppState(AppState.COMPLETED);
    } catch (err) {
        console.error(err);
        setError("Failed to generate PowerPoint file.");
        setAppState(AppState.ERROR);
    }
  };

  const handleReset = () => {
      setAppState(AppState.IDLE);
      setSlides([]);
      setError(null);
      setProgress({ current: 0, total: 0});
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg">
                <Presentation className="text-white w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">SlideShifter</h1>
          </div>
          <div className="flex items-center gap-4">
             {appState === AppState.COMPLETED && (
                 <button 
                    onClick={handleReset}
                    className="text-sm text-slate-600 hover:text-indigo-600 font-medium flex items-center gap-1 transition-colors"
                 >
                    <RefreshCw className="w-4 h-4" />
                    Convert Another
                 </button>
             )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        
        {/* Intro / IDLE State */}
        {appState === AppState.IDLE && (
            <div className="max-w-2xl mx-auto space-y-8 animate-fade-in-up">
                <div className="text-center space-y-4">
                    <h2 className="text-4xl font-extrabold text-slate-900">
                        PDF to PowerPoint Converter
                    </h2>
                    <p className="text-lg text-slate-600">
                        Choose how you want to convert your presentation.
                    </p>
                </div>

                {/* Mode Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button 
                        onClick={() => setMode('AI_EXTRACT')}
                        className={`p-6 rounded-xl border-2 transition-all duration-200 text-left relative flex flex-col gap-3
                            ${mode === 'AI_EXTRACT' 
                                ? 'border-indigo-600 bg-indigo-50 shadow-md ring-1 ring-indigo-600' 
                                : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50'
                            }`}
                    >
                        <div className="flex items-center justify-between w-full">
                            <div className={`p-2 rounded-lg ${mode === 'AI_EXTRACT' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                <Sparkles className="w-6 h-6" />
                            </div>
                            {mode === 'AI_EXTRACT' && <div className="w-3 h-3 bg-indigo-600 rounded-full animate-pulse" />}
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900">AI Editable Mode</h3>
                            <p className="text-sm text-slate-500 mt-1">Extracts text and layout. Text becomes editable, diagrams are preserved.</p>
                        </div>
                    </button>

                    <button 
                        onClick={() => setMode('IMAGE_ONLY')}
                        className={`p-6 rounded-xl border-2 transition-all duration-200 text-left relative flex flex-col gap-3
                            ${mode === 'IMAGE_ONLY' 
                                ? 'border-indigo-600 bg-indigo-50 shadow-md ring-1 ring-indigo-600' 
                                : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50'
                            }`}
                    >
                        <div className="flex items-center justify-between w-full">
                             <div className={`p-2 rounded-lg ${mode === 'IMAGE_ONLY' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                <ImageIcon className="w-6 h-6" />
                            </div>
                            {mode === 'IMAGE_ONLY' && <div className="w-3 h-3 bg-indigo-600 rounded-full animate-pulse" />}
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900">Image Copy Mode</h3>
                            <p className="text-sm text-slate-500 mt-1">Converts slides as high-quality images. Perfect layout match, but text is not editable.</p>
                        </div>
                    </button>
                </div>

                <Dropzone onFileAccepted={handleFileAccepted} isProcessing={false} />
                
            </div>
        )}

        {/* Processing States */}
        {appState !== AppState.IDLE && (
            <div className="space-y-8">
                {/* Status Bar */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 sticky top-20 z-10">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            {appState === AppState.PROCESSING_PDF && (
                                <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                            )}
                            {appState === AppState.ANALYZING_SLIDES && (
                                <Sparkles className="w-6 h-6 text-indigo-600 animate-pulse" />
                            )}
                            {appState === AppState.GENERATING_PPT && (
                                <FileDown className="w-6 h-6 text-indigo-600 animate-bounce" />
                            )}
                            {appState === AppState.COMPLETED && (
                                <div className="bg-green-100 p-1.5 rounded-full">
                                    <FileDown className="w-5 h-5 text-green-600" />
                                </div>
                            )}
                            
                            <div>
                                <h3 className="font-semibold text-slate-900 text-lg">
                                    {appState === AppState.PROCESSING_PDF && "Reading PDF..."}
                                    {appState === AppState.ANALYZING_SLIDES && `Analyzing Slide ${progress.current} of ${progress.total}`}
                                    {appState === AppState.GENERATING_PPT && "Building PowerPoint..."}
                                    {appState === AppState.COMPLETED && "Done! Download started."}
                                    {appState === AppState.ERROR && "Something went wrong."}
                                </h3>
                                <p className="text-sm text-slate-500">
                                    {mode === 'AI_EXTRACT' && appState === AppState.ANALYZING_SLIDES && "Extracting text and layout..."}
                                    {mode === 'IMAGE_ONLY' && appState === AppState.GENERATING_PPT && "Placing images onto slides..."}
                                    {appState === AppState.COMPLETED && "Check your downloads folder."}
                                    {appState === AppState.ERROR && error}
                                </p>
                            </div>
                        </div>

                        {appState === AppState.ANALYZING_SLIDES && (
                            <div className="w-full md:w-64 bg-slate-100 rounded-full h-2 overflow-hidden">
                                <div 
                                    className="bg-indigo-600 h-full transition-all duration-300 ease-out"
                                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                                />
                            </div>
                        )}
                        
                        {appState === AppState.COMPLETED && (
                            <button 
                                onClick={handleReset}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors shadow-sm shadow-indigo-200"
                            >
                                Convert New File
                            </button>
                        )}
                    </div>
                </div>

                {/* Grid of slides */}
                <SlidePreview slides={slides} />
            </div>
        )}
      </main>
      
      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white mt-auto py-8">
          <div className="max-w-7xl mx-auto px-4 text-center text-slate-500 text-sm">
              <p>&copy; {new Date().getFullYear()} SlideShifter. Powered by Google Gemini.</p>
          </div>
      </footer>
    </div>
  );
};

export default App;