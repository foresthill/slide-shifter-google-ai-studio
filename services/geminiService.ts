import { GoogleGenAI, Type } from "@google/genai";
import { SlideContent } from '../types';

export const analyzeSlideImage = async (base64Image: string): Promise<SlideContent> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Clean the base64 string if it contains the header
  const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: cleanBase64
          }
        },
        {
          text: `Analyze this presentation slide image. 
          1. Extract the title and main text content.
          2. Determine the layout style.
          3. Detect any NON-TEXT visual elements such as charts, graphs, diagrams, screenshots, or photos.
             For each visual element, provide a bounding box as [ymin, xmin, ymax, xmax] on a scale of 0 to 100.
             (Top-left is 0,0; Bottom-right is 100,100).
             Do not include simple decorative lines or background shapes as figures.
          4. Suggest colors.`
        }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "The main title of the slide. Empty if none." },
          content: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "List of bullet points or paragraphs found in the slide body." 
          },
          layoutType: { 
            type: Type.STRING, 
            enum: ['TITLE_ONLY', 'TITLE_AND_CONTENT', 'TWO_COLUMN', 'BLANK', 'SECTION_HEADER'],
            description: "The closest PowerPoint layout matching this slide."
          },
          backgroundColor: { type: Type.STRING, description: "Hex color code for the background (e.g. #FFFFFF)." },
          textColor: { type: Type.STRING, description: "Hex color code for the main text (e.g. #000000)." },
          notes: { type: Type.STRING, description: "Brief description of the slide content for speaker notes." },
          figures: {
            type: Type.ARRAY,
            description: "Detected diagrams, charts, or images.",
            items: {
              type: Type.OBJECT,
              properties: {
                description: { type: Type.STRING },
                boundingBox: {
                  type: Type.ARRAY,
                  items: { type: Type.NUMBER },
                  description: "[ymin, xmin, ymax, xmax] in percent (0-100)."
                }
              },
              required: ["boundingBox", "description"]
            }
          }
        },
        required: ["title", "content", "layoutType"]
      }
    }
  });

  if (response.text) {
    try {
      return JSON.parse(response.text) as SlideContent;
    } catch (e) {
      console.error("Failed to parse Gemini response", e);
      throw new Error("Failed to parse analysis results.");
    }
  }

  throw new Error("No response from Gemini.");
};