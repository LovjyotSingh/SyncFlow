import { Router } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = Router();

// Primary and fallback models in order of priority
const CANDIDATE_MODELS = [
  process.env.GEMINI_MODEL,
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-1.5-pro',
].filter(Boolean) as string[];

const COMMANDS: Record<string, string> = {
  summarize: `You are an expert document analyst. Summarize the following document into 3-5 concise, insightful bullet points. 
Start each bullet with "• ". Be clear, direct, and capture the most important ideas. Output only the bullet points, no preamble or conclusion.`,

  expand: `You are an expert writer. Expand the following text with more detail, concrete examples, data, and rich context. 
Preserve the original tone and structure. Make it at least 2x longer and significantly more informative. Output only the expanded text.`,

  grammar: `You are a professional editor and proofreader. Fix all grammar, spelling, punctuation, and style errors in the following text. 
Improve clarity and flow while keeping the meaning and structure identical. Output only the corrected text, nothing else.`,

  suggest: `You are a strategic consultant. Read the following document and provide 5 concrete, actionable next steps or improvements. 
Number each suggestion (1. 2. 3. ...). Be specific, practical, and add real value. Focus on what would make this document more complete and impactful.`,

  shorten: `You are an expert at concise writing. Rewrite the following text to be dramatically more concise — cut at least 40% of words 
while keeping ALL key information and impact. Eliminate filler words, redundancy, and fluff. Output only the shortened text.`,

  tone: `You are a senior business writer. Rewrite the following text in a polished, professional tone appropriate for C-suite communication. 
Keep all facts and meaning intact. Improve vocabulary, sentence structure, and executive presence. Output only the rewritten text.`,

  translate_simple: `Translate the following text to simple, plain English that a 12-year-old could understand. 
Replace jargon, complex terms, and long sentences with simple equivalents. Output only the translated text.`,

  action_items: `You are a project manager. Extract all action items, tasks, and commitments from the following document. 
Format as a checklist with [ ] prefix for each item. Group by owner if mentioned. Output only the action items checklist.`,
};

function formatErrorMessage(error: any): string {
  const msg = error?.message || '';
  if (msg.includes('API_KEY_INVALID') || msg.includes('API key not valid')) {
    return 'Invalid Gemini API key. Please check your key at aistudio.google.com';
  }
  if (msg.includes('503') || msg.includes('high demand') || msg.includes('Service Unavailable')) {
    return 'Google Gemini servers are currently experiencing high demand. Please try again in a few seconds.';
  }
  if (msg.includes('quota') || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
    return 'API rate limit or quota reached. Please try again in a moment or add your own free Gemini API key.';
  }
  return msg || 'AI request failed';
}

async function executeWithModelFallback<T>(
  genAI: GoogleGenerativeAI,
  systemInstruction: string,
  fn: (model: any, modelName: string) => Promise<T>
): Promise<T> {
  const uniqueModels = Array.from(new Set(CANDIDATE_MODELS));
  let lastError: any = null;

  for (const modelName of uniqueModels) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction,
      });
      return await fn(model, modelName);
    } catch (err: any) {
      lastError = err;
      const isRecoverable =
        err.status === 503 ||
        err.status === 404 ||
        err.status === 429 ||
        err.message?.includes('503') ||
        err.message?.includes('high demand') ||
        err.message?.includes('404') ||
        err.message?.includes('not found') ||
        err.message?.includes('429') ||
        err.message?.includes('quota') ||
        err.message?.includes('overloaded');

      if (isRecoverable) {
        console.warn(`⚠️ Model "${modelName}" unavailable (${err.message?.slice(0, 100)}). Trying next candidate model...`);
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}

// POST /api/ai — Standard (non-streaming) for simple use
router.post('/ai', async (req, res) => {
  try {
    const { command, content, apiKey, prompt: customPrompt } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'content is required' });
    }

    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      return res.status(400).json({
        error: 'No Gemini API key provided. Add GEMINI_API_KEY to your backend .env file or get one free at aistudio.google.com',
      });
    }

    const systemPrompt = command ? COMMANDS[command] : customPrompt;
    if (!systemPrompt) {
      return res.status(400).json({ error: `Unknown command. Valid: ${Object.keys(COMMANDS).join(', ')}` });
    }

    const genAI = new GoogleGenerativeAI(key);
    const result = await executeWithModelFallback(
      genAI,
      'You are SyncFlow AI, an intelligent writing assistant built into a collaborative document editor. Be concise, accurate, and helpful.',
      async (model, modelName) => {
        const response = await model.generateContent(`${systemPrompt}\n\n---\n\n${content}`);
        return { text: response.response.text(), model: modelName };
      }
    );

    res.json({ result: result.text, model: result.model });
  } catch (error: any) {
    console.error('Gemini AI error:', error.message);
    res.status(500).json({ error: formatErrorMessage(error) });
  }
});

// POST /api/ai/stream — Streaming (Server-Sent Events) for real-time word-by-word output
router.post('/ai/stream', async (req, res) => {
  try {
    const { command, content, apiKey, prompt: customPrompt } = req.body;

    if (!content) {
      res.status(400).json({ error: 'content is required' });
      return;
    }

    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      res.status(400).json({ error: 'No Gemini API key. Add GEMINI_API_KEY to .env or pass apiKey in request.' });
      return;
    }

    const systemPrompt = command ? COMMANDS[command] : customPrompt;
    if (!systemPrompt) {
      res.status(400).json({ error: `Unknown command. Valid: ${Object.keys(COMMANDS).join(', ')}` });
      return;
    }

    // Set up Server-Sent Events (SSE)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    const genAI = new GoogleGenerativeAI(key);
    const streamResult = await executeWithModelFallback(
      genAI,
      'You are SyncFlow AI, an intelligent writing assistant built into a collaborative document editor. Be concise, accurate, and helpful.',
      async (model) => {
        return await model.generateContentStream(`${systemPrompt}\n\n---\n\n${content}`);
      }
    );

    for await (const chunk of streamResult.stream) {
      const text = chunk.text();
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error('Gemini stream error:', error.message);
    res.write(`data: ${JSON.stringify({ error: formatErrorMessage(error) })}\n\n`);
    res.end();
  }
});

// POST /api/ai/chat/stream — Free-form conversational AI (code, explanations, anything)
// Accepts: { message, history?: [{role, text}], apiKey? }
router.post('/ai/chat/stream', async (req, res) => {
  try {
    const { message, history = [], apiKey } = req.body;

    if (!message?.trim()) {
      res.status(400).json({ error: 'message is required' });
      return;
    }

    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      res.status(400).json({ error: 'No Gemini API key. Add GEMINI_API_KEY to .env or pass apiKey in request.' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    const genAI = new GoogleGenerativeAI(key);
    const systemInstruction =
      'You are SyncFlow AI — a brilliant, versatile assistant embedded in a collaborative document editor. ' +
      'You can write and explain code in any language, answer technical questions, write essays, ' +
      'summarize topics, generate content, and help with anything the user asks. ' +
      'Be concise but thorough. Use markdown formatting (code blocks, headers, bullet points) where it improves clarity.';

    // Build conversation history for multi-turn context
    const chatHistory = (history as { role: string; text: string }[]).map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }],
    }));

    const streamResult = await executeWithModelFallback(
      genAI,
      systemInstruction,
      async (model) => {
        const chat = model.startChat({ history: chatHistory });
        return await chat.sendMessageStream(message);
      }
    );

    for await (const chunk of streamResult.stream) {
      const text = chunk.text();
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error('Gemini chat error:', error.message);
    res.write(`data: ${JSON.stringify({ error: formatErrorMessage(error) })}\n\n`);
    res.end();
  }
});

export default router;
