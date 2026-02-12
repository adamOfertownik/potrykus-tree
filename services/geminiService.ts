import { GoogleGenAI } from "@google/genai";

interface GenerateParams {
  carBase64: string;
  foilBase64: string;
  apiKey?: string;
}

export const generateCarVisualization = async ({
  carBase64,
  foilBase64,
  apiKey
}: GenerateParams): Promise<string> => {
  // Use the provided apiKey if available, otherwise fallback to process.env.API_KEY
  // which might be injected by window.aistudio or build tools.
  const finalApiKey = apiKey || process.env.API_KEY;

  if (!finalApiKey) {
    throw new Error("Brak klucza API. Wpisz klucz w konfiguracji lub wybierz go.");
  }

  // Always create a new instance to ensure we capture the selected API key
  const ai = new GoogleGenAI({ apiKey: finalApiKey });

  // Remove data URL prefix if present for the API call
  const cleanBase64 = (data: string) => data.split(',')[1] || data;
  const mimeType = 'image/jpeg'; // Assuming jpegs for simplicity or derived from input

  // Construct the prompt with 2 images (Car, Foil) and text
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: {
      parts: [
        {
            text: "Generate a high-quality, photorealistic image. \n" +
            "Task: Apply the car wrap/foil color and texture shown in 'Image 2' to the car shown in 'Image 1'. \n" +
            "Details: Maintain the original background, perspective, lighting, and reflections of 'Image 1'. Only change the car's exterior paint/wrap to match the foil sample. The result should look like a professional photo of the specific car provided in Image 1 with the new wrap applied."
        },
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
    config: {
      imageConfig: {
        imageSize: "2K",
        aspectRatio: "16:9" 
      }
    }
  });

  // Extract the generated image
  // The API returns generated images in the parts array
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }

  throw new Error("No image generated.");
};