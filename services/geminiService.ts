
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

export const getDrillSuggestions = async (category: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Suggest 5 advanced drills for high performance athletes in the category: ${category}. Return the result as a JSON array of strings.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Gemini Error:", error);
    return [];
  }
};

export const getTrainingAdvice = async (teamName: string, drillSummary: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `As an elite sport scientist, provide a brief (2-3 sentences) analysis and advice for a training plan named "${teamName}" with the following drills: ${drillSummary}.`,
      config: {
        systemInstruction: "You are a world-class high performance coach and sport scientist."
      }
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Keep pushing the limits of science and performance.";
  }
};
