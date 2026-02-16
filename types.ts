export enum AppState {
  IDLE = 'IDLE',
  PROCESSING_PDF = 'PROCESSING_PDF',
  ANALYZING_SLIDES = 'ANALYZING_SLIDES',
  GENERATING_PPT = 'GENERATING_PPT',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export type ConversionMode = 'AI_EXTRACT' | 'IMAGE_ONLY';

export interface SlideFigure {
  boundingBox: [number, number, number, number]; // ymin, xmin, ymax, xmax (0-100 scale)
  description: string;
}

export interface SlideContent {
  title: string;
  content: string[]; // Bullet points or paragraphs
  layoutType: 'TITLE_ONLY' | 'TITLE_AND_CONTENT' | 'TWO_COLUMN' | 'BLANK' | 'SECTION_HEADER';
  backgroundColor?: string;
  textColor?: string;
  notes?: string;
  figures?: SlideFigure[];
}

export interface ProcessedSlide {
  originalImage: string; // Base64
  analysis: SlideContent | null;
  status: 'pending' | 'analyzing' | 'done' | 'error';
}