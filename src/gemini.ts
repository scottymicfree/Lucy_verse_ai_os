import { GoogleGenAI, Modality, Type, ThinkingLevel } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY || "";
const ai = new GoogleGenAI({ apiKey });

// TTS: gemini-2.5-flash-preview-tts
export async function textToSpeech(text: string, voice: string = 'Kore'): Promise<string | undefined> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Say cheerfully: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice as any },
          },
        },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (error) {
    console.error("TTS Error:", error);
    return undefined;
  }
}

// Thinking: gemini-3.1-pro-preview
export async function thinkingQuery(prompt: string): Promise<string | undefined> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
      },
    });
    return response.text;
  } catch (error) {
    console.error("Thinking Query Error:", error);
    return undefined;
  }
}

// Video Analysis: gemini-3.1-pro-preview
export async function analyzeVideo(videoBase64: string, prompt: string): Promise<string | undefined> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: {
        parts: [
          { inlineData: { data: videoBase64, mimeType: "video/mp4" } },
          { text: prompt }
        ]
      },
    });
    return response.text;
  } catch (error) {
    console.error("Video Analysis Error:", error);
    return undefined;
  }
}

// Video Generation: veo-3.1-fast-generate-preview
export async function generateVideo(prompt: string, aspectRatio: '16:9' | '9:16' = '16:9'): Promise<string | undefined> {
  try {
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio
      }
    });

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await ai.operations.getVideosOperation({ operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) return undefined;

    const response = await fetch(downloadLink, {
      method: 'GET',
      headers: { 'x-goog-api-key': apiKey },
    });
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Video Generation Error:", error);
    return undefined;
  }
}

// Music Generation: lyria-3-pro-preview
export async function generateMusic(prompt: string): Promise<string | undefined> {
  try {
    const response = await ai.models.generateContentStream({
      model: "lyria-3-pro-preview",
      contents: prompt,
    });

    let audioBase64 = "";
    for await (const chunk of response) {
      const parts = chunk.candidates?.[0]?.content?.parts;
      if (!parts) continue;
      for (const part of parts) {
        if (part.inlineData?.data) {
          audioBase64 += part.inlineData.data;
        }
      }
    }
    return audioBase64;
  } catch (error) {
    console.error("Music Generation Error:", error);
    return undefined;
  }
}

// Live API Session: gemini-3.1-flash-live-preview
export function connectLive(callbacks: any) {
  return ai.live.connect({
    model: "gemini-3.1-flash-live-preview",
    callbacks,
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
      },
      systemInstruction: "You are Lucy, a helpful AI assistant for a FiveM server mobile dashboard.",
    },
  });
}
