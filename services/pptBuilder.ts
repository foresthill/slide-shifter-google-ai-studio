import PptxGenJS from 'pptxgenjs';
import { ProcessedSlide, SlideContent } from '../types';

// Helper to crop an image from base64 string
const cropImage = (base64Image: string, box: [number, number, number, number]): Promise<string> => {
  return new Promise((resolve, reject) => {
    // 1. Validate box inputs immediately to fail fast
    const [ymin, xmin, ymax, xmax] = box;
    if (xmax <= xmin || ymax <= ymin) {
        reject(new Error(`Invalid bounding box: [${box.join(', ')}]`));
        return;
    }

    const img = new Image();
    
    // 2. Add timeout to prevent hanging if image never loads
    const timeoutId = setTimeout(() => {
        reject(new Error("Image load timed out in cropImage"));
    }, 10000);

    img.onload = () => {
      clearTimeout(timeoutId);
      try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            throw new Error('Could not get canvas context');
          }

          const width = img.width;
          const height = img.height;

          // Convert percentages to pixels
          const cropX = (xmin / 100) * width;
          const cropY = (ymin / 100) * height;
          const cropW = ((xmax - xmin) / 100) * width;
          const cropH = ((ymax - ymin) / 100) * height;

          // Add a small buffer/padding to avoid cutting off edges if detection is tight
          // but ensure we don't go out of bounds (Clamping)
          const safeX = Math.max(0, cropX);
          const safeY = Math.max(0, cropY);
          
          // Ensure width/height doesn't exceed image bounds from the start point
          const safeW = Math.min(width - safeX, cropW);
          const safeH = Math.min(height - safeY, cropH);

          // 3. Validate calculated dimensions
          if (safeW <= 0 || safeH <= 0) {
              throw new Error(`Invalid calculated crop dimensions: ${safeW}x${safeH}`);
          }

          canvas.width = safeW;
          canvas.height = safeH;

          ctx.drawImage(
            img, 
            safeX, safeY, safeW, safeH, // Source
            0, 0, safeW, safeH          // Destination
          );

          // Return as base64
          resolve(canvas.toDataURL('image/png'));
      } catch (e) {
          reject(e);
      }
    };
    
    img.onerror = (e) => {
        clearTimeout(timeoutId);
        reject(new Error("Failed to load image for cropping"));
    };
    
    img.src = base64Image;
  });
};

/**
 * Generates a PPTX where each slide is just the full image of the PDF page.
 * Fast conversion, visual fidelity is 100%, but not editable text.
 */
export const generateImagePptx = async (processedSlides: ProcessedSlide[]): Promise<void> => {
    const pptx = new PptxGenJS();
    
    pptx.author = 'SlideShifter App';
    pptx.title = 'Converted Presentation (Image Mode)';

    for (const slideItem of processedSlides) {
        const slide = pptx.addSlide();
        
        // Add the original image as a background or full-size image
        slide.addImage({
            data: slideItem.originalImage,
            x: 0,
            y: 0,
            w: '100%',
            h: '100%'
        });
    }

    await pptx.writeFile({ fileName: `Converted_Presentation_Img_${Date.now()}.pptx` });
};

/**
 * Generates a PPTX using AI analysis to create editable text and extracted figures.
 */
export const generatePptx = async (processedSlides: ProcessedSlide[]): Promise<void> => {
  const pptx = new PptxGenJS();
  
  // Set metadata
  pptx.author = 'SlideShifter App';
  pptx.company = 'Made with Gemini';
  pptx.title = 'Converted Presentation';

  // We iterate sequentially to handle async image processing
  for (const slideItem of processedSlides) {
    if (!slideItem.analysis) continue;

    const slideData = slideItem.analysis;
    const slide = pptx.addSlide();
    
    // Apply Colors
    if (slideData.backgroundColor) {
      slide.background = { color: slideData.backgroundColor.replace('#', '') };
    }
    const fgColor = slideData.textColor ? slideData.textColor.replace('#', '') : '000000';

    // Add Title
    if (slideData.title) {
      slide.addText(slideData.title, { 
        x: 0.5, y: 0.5, w: '90%', h: 1, 
        fontSize: 32, 
        bold: true, 
        color: fgColor,
        align: 'center' 
      });
    }

    // Add Content Text
    let textY = 1.8;
    const textH = '70%';
    const textW = '90%';
    const textX = 0.5;

    // Logic to avoid placing text on top of figures if possible
    // (Simple implementation: Text layout remains standard, figures added absolutely)
    
    if (slideData.layoutType === 'TWO_COLUMN') {
      const midPoint = Math.ceil(slideData.content.length / 2);
      const leftCol = slideData.content.slice(0, midPoint);
      const rightCol = slideData.content.slice(midPoint);

      if (leftCol.length > 0) {
        slide.addText(leftCol.map(t => ({ text: t, options: { breakLine: true } })), {
          x: 0.5, y: textY, w: 4.2, h: textH,
          fontSize: 18, color: fgColor, bullet: true
        });
      }
      if (rightCol.length > 0) {
        slide.addText(rightCol.map(t => ({ text: t, options: { breakLine: true } })), {
          x: 5.0, y: textY, w: 4.2, h: textH,
          fontSize: 18, color: fgColor, bullet: true
        });
      }

    } else if (slideData.layoutType === 'SECTION_HEADER') {
      if (slideData.content.length > 0) {
        slide.addText(slideData.content.join('\n'), {
           x: 1, y: 2.5, w: '80%', h: 3,
           fontSize: 24, align: 'center', color: fgColor
        });
      }
    } else {
      // Default
      if (slideData.content.length > 0) {
        slide.addText(slideData.content.map(t => ({ text: t, options: { breakLine: true } })), {
          x: textX, y: textY, w: textW, h: textH,
          fontSize: 18, color: fgColor, bullet: true, align: 'left', valign: 'top'
        });
      }
    }

    // Processing and Adding Figures
    if (slideData.figures && slideData.figures.length > 0) {
        for (const figure of slideData.figures) {
            try {
                // Validation before attempt
                const [ymin, xmin, ymax, xmax] = figure.boundingBox;
                
                // Skip clearly invalid boxes
                if (xmax <= xmin || ymax <= ymin) {
                   console.warn("Skipping invalid figure bounding box:", figure.boundingBox);
                   continue;
                }

                // Crop the figure from the original slide image
                const croppedImgData = await cropImage(slideItem.originalImage, figure.boundingBox);
                
                slide.addImage({
                    data: croppedImgData,
                    x: `${xmin}%`,
                    y: `${ymin}%`,
                    w: `${xmax - xmin}%`,
                    h: `${ymax - ymin}%`
                });
            } catch (err) {
                console.error("Failed to add figure to slide:", err);
                // Continue with other figures/slides, don't crash the whole process
            }
        }
    }

    // Add Notes
    if (slideData.notes) {
      slide.addNotes(slideData.notes);
    }
  }

  await pptx.writeFile({ fileName: `Converted_Presentation_${Date.now()}.pptx` });
};