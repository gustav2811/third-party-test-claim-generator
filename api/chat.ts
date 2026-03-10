import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import type { Content } from '@google/genai';

interface ChatRequestBody {
  message: string;
  history: Content[];
  systemInstruction: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server is missing API key configuration' });
    return;
  }

  const { message, history, systemInstruction } = req.body as ChatRequestBody;

  if (!message || !systemInstruction) {
    res.status(400).json({ error: 'Missing required fields: message, systemInstruction' });
    return;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const chat = ai.chats.create({
      model: 'gemini-3-flash-preview',
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
      },
      history: history ?? [],
    });

    const response = await chat.sendMessage({ message });
    const text = response.text ?? '';

    const updatedHistory: Content[] = [
      ...(history ?? []),
      { role: 'user', parts: [{ text: message }] },
      { role: 'model', parts: [{ text }] },
    ];

    res.status(200).json({ text, history: updatedHistory });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
}
