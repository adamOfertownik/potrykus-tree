import { GoogleGenAI } from "@google/genai";
import { ModelTier } from "../types";

interface GenerateParams {
  carBase64: string;
  foilBase64: string;
  apiKey?: string;
  customPrompt?: string;
  modelTier?: ModelTier;
}

export const generateCarVisualization = async ({
  carBase64,
  foilBase64,
  apiKey,
  customPrompt,
  modelTier = 'pro'
}: GenerateParams): Promise<string> => {
  const rawApiKey = apiKey || process.env.API_KEY;
  const finalApiKey = rawApiKey?.trim();

  if (!finalApiKey) {
    throw new Error("Brak klucza API. Wpisz klucz w konfiguracji lub wybierz go.");
  }

  const ai = new GoogleGenAI({ apiKey: finalApiKey });
  const cleanBase64 = (data: string) => data.split(',')[1] || data;
  const mimeType = 'image/jpeg';

  // Determine model based on tier
  // If user requests "pro", use 'gemini-3-pro-image-preview'.
  // If user requests "flash" (Safe Mode), use 'gemini-2.5-flash-image'.
  const modelName = modelTier === 'pro' 
    ? 'gemini-3-pro-image-preview' 
    : 'gemini-2.5-flash-image';

  // Construct a precise engineering prompt
  const basePrompt = `
    You are a professional automotive wrapper visualizer. Generate a photorealistic image.
    
    INPUTS:
    - Image 1: The target vehicle.
    - Image 2: A material sample (swatch) of the wrap foil. 
    - CRITICAL SCALE INFO: The texture/pattern in Image 2 represents a physical real-world size of 5cm x 10cm.
    
    TASK:
    1. Apply the wrap material from Image 2 onto the painted exterior parts of the vehicle in Image 1.
    2. SCALING: detailed attention is required here. Based on the 5x10cm swatch size, scale the texture density accurately so the grain/metallic flake/pattern looks realistic on a full-size car. Do not stretch the texture unrealistically.
    3. REALISM: Maintain the original perspective, background, lighting, shadows, and reflections of Image 1. The car should look exactly like the original photo, just with a new paint job/wrap.
    
    USER CUSTOM INSTRUCTIONS:
    ${customPrompt ? customPrompt : "No additional custom instructions."}
  `;

  const config: any = {
    imageConfig: {
      aspectRatio: "16:9"
    }
  };

  // Only Pro model supports explicit imageSize (e.g. 2K)
  if (modelTier === 'pro') {
    config.imageConfig.imageSize = "2K";
  }

  const response = await ai.models.generateContent({
    model: modelName,
    contents: {
      parts: [
        { text: basePrompt },
        {
          inlineData: {
            mimeType: mimeType,
            data: cleanBase64(carBase64)
          }
        },
        {
          inlineData: {
            mimeType: mimeType,
            data: cleanBase64(foilBase64)
          }
        }
      ]
    },
    config: config
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }

  throw new Error("No image generated.");
};