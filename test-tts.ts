import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  const response = await ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: "Hello, this is a test.",
    config: {
      responseModalities: ["AUDIO"]
    }
  });
  console.log(JSON.stringify(response.candidates?.[0]?.content, null, 2));
}
run();
