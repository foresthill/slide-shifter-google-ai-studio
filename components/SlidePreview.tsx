import React from 'react';
import { ProcessedSlide } from '../types';
import { CheckCircle2, CircleDashed, AlertTriangle, FileText, Layout } from 'lucide-react';

interface SlidePreviewProps {
  slides: ProcessedSlide[];
}

const SlidePreview: React.FC<SlidePreviewProps> = ({ slides }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {slides.map((slide, index) => (
        <div key={index} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col hover:shadow-md transition-shadow">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="font-medium text-slate-700 text-sm">Slide {index + 1}</span>
            {slide.status === 'done' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
            {slide.status === 'analyzing' && <CircleDashed className="w-5 h-5 text-indigo-500 animate-spin" />}
            {slide.status === 'pending' && <div className="w-5 h-5 rounded-full border-2 border-slate-300" />}
            {slide.status === 'error' && <AlertTriangle className="w-5 h-5 text-red-500" />}
          </div>

          {/* Image & Overlay */}
          <div className="relative aspect-video bg-slate-200 group">
            <img 
              src={slide.originalImage} 
              alt={`Slide ${index + 1}`} 
              className="w-full h-full object-cover"
            />
            {slide.status === 'analyzing' && (
              <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center">
                <span className="text-indigo-700 font-semibold text-sm animate-pulse">Scanning Layout...</span>
              </div>
            )}
          </div>

          {/* Analysis Result Summary */}
          <div className="p-4 flex-1 flex flex-col gap-2">
            {slide.analysis ? (
              <>
                <div className="flex items-start gap-2">
                  <Layout className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <span className="text-xs text-slate-600 font-medium bg-slate-100 px-2 py-0.5 rounded">
                    {slide.analysis.layoutType.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-slate-600 line-clamp-3">
                    <span className="font-semibold text-slate-800">{slide.analysis.title || "Untitled"}</span>
                    {slide.analysis.content.length > 0 && ` - ${slide.analysis.content[0]}`}
                  </p>
                </div>
                {/* Color swatches */}
                <div className="mt-auto pt-2 flex items-center gap-2">
                    <div 
                        className="w-4 h-4 rounded-full border border-slate-200 shadow-sm" 
                        style={{ backgroundColor: slide.analysis.backgroundColor || '#fff' }} 
                        title="Background"
                    />
                    <div 
                        className="w-4 h-4 rounded-full border border-slate-200 shadow-sm flex items-center justify-center text-[8px]" 
                        style={{ backgroundColor: slide.analysis.textColor || '#000' }}
                        title="Text"
                    >
                        <span className="text-white invert opacity-50">T</span>
                    </div>
                </div>
              </>
            ) : (
                <div className="flex-1 flex items-center justify-center">
                    <span className="text-xs text-slate-400 italic">
                        {slide.status === 'error' ? 'Analysis failed' : 'Waiting for analysis...'}
                    </span>
                </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default SlidePreview;