import * as pdfjsLib from 'pdfjs-dist';

// We need to set the worker source. In a real bundler environment, this might be imported.
// For this standalone setup, we point to a reliable CDN matching the version.
// Using a specific version to ensure compatibility with the importmap in index.html.
const PDFJS_VERSION = '5.4.624';
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

export const convertPdfToImages = async (file: File): Promise<string[]> => {
  const arrayBuffer = await file.arrayBuffer();
  
  // Loading the document
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  
  const numPages = pdf.numPages;
  const images: string[] = [];
  
  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    
    // Determine scale. 
    // User requested "Highest Quality".
    // 1.5 was standard. 2.5 - 3.0 provides high-density (Retina-like) output.
    // We use 2.5 to balance high quality with browser memory usage.
    const viewport = page.getViewport({ scale: 2.5 });
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) {
      throw new Error(`Could not get canvas context for page ${i}`);
    }
    
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };
    
    await page.render(renderContext).promise;
    
    // Export to base64 with maximum quality (1.0)
    // JPEG at 1.0 is very high quality and more efficient than PNG for photos/gradients.
    const base64Data = canvas.toDataURL('image/jpeg', 1.0);
    images.push(base64Data);
  }
  
  return images;
};