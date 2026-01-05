
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const getWorkoutTip = async (exercise: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Dê uma dica profissional super curta (máx 10 palavras) para o exercício: ${exercise}. Foco em postura ou segurança. Responda em Português do Brasil. Sem introdução, apenas a dica.`,
      config: {
        temperature: 0.7,
      },
    });
    return response.text || "Mantenha a postura e respire.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Foque em movimentos controlados.";
  }
};
