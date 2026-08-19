import { Router } from 'express';
import { GoogleGenAI } from '@google/genai';

const router = Router();

// Model: Gemini 3.7 Flash exclusively
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.7-flash';

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
  if (msg.includes('API_KEY_INVALID') || msg.includes('API key not valid') || msg.includes('403')) {
    return 'Invalid Gemini API key. Please check GEMINI_API_KEY in backend .env';
  }
  if (msg.includes('503') || msg.includes('high demand') || msg.includes('Service Unavailable')) {
    return 'Gemini 3.7 Flash is currently experiencing high demand. Please try again in a few seconds.';
  }
  if (msg.includes('quota') || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
    return 'API rate limit or quota reached. Please try again in a moment.';
  }
  return msg || 'AI request failed';
}

// POST /api/ai — Standard (non-streaming)
router.post('/ai', async (req, res) => {
  try {
    const { command, content, prompt: customPrompt } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'content is required' });
    }

    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return res.status(400).json({
        error: 'No Gemini API key provided in backend .env (GEMINI_API_KEY)',
      });
    }

    const systemPrompt = command ? COMMANDS[command] : customPrompt;
    if (!systemPrompt) {
      return res.status(400).json({ error: `Unknown command. Valid: ${Object.keys(COMMANDS).join(', ')}` });
    }

    const ai = new GoogleGenAI({ apiKey: key });
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `${systemPrompt}\n\n---\n\n${content}`,
      config: {
        systemInstruction: 'You are SyncFlow AI, an intelligent writing assistant built into a collaborative document editor. Be concise, accurate, and helpful.',
      },
    });

    res.json({ result: response.text || '', model: GEMINI_MODEL });
  } catch (error: any) {
    console.error('Gemini AI error:', error.message);
    res.status(500).json({ error: formatErrorMessage(error) });
  }
});

// POST /api/ai/stream — Streaming (Server-Sent Events) for real-time output
router.post('/api/ai/stream', async (req, res) => {
  try {
    const { command, content, prompt: customPrompt } = req.body;

    if (!content) {
      res.status(400).json({ error: 'content is required' });
      return;
    }

    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      res.status(400).json({ error: 'No Gemini API key in backend .env (GEMINI_API_KEY)' });
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

    const ai = new GoogleGenAI({ apiKey: key });
    const streamResult = await ai.models.generateContentStream({
      model: GEMINI_MODEL,
      contents: `${systemPrompt}\n\n---\n\n${content}`,
      config: {
        systemInstruction: 'You are SyncFlow AI, an intelligent writing assistant built into a collaborative document editor. Be concise, accurate, and helpful.',
      },
    });

    for await (const chunk of streamResult) {
      const text = chunk.text;
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

// POST /api/ai/chat/stream — Free-form conversational AI with gemini-3.7-flash
router.post('/api/ai/chat/stream', async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message?.trim()) {
      res.status(400).json({ error: 'message is required' });
      return;
    }

    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      res.status(400).json({ error: 'No Gemini API key in backend .env (GEMINI_API_KEY)' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    const ai = new GoogleGenAI({ apiKey: key });
    const systemInstruction =
      'You are SyncFlow AI — a brilliant, versatile assistant embedded in a collaborative document editor. ' +
      'You can write and explain code in any language, answer technical questions, write essays, ' +
      'summarize topics, generate content, and help with anything the user asks. ' +
      'Be concise but thorough. Use markdown formatting (code blocks, headers, bullet points) where it improves clarity.';

    // Map conversation history
    const contents = (history as { role: string; text: string }[]).map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }],
    }));
    contents.push({ role: 'user', parts: [{ text: message }] });

    const streamResult = await ai.models.generateContentStream({
      model: GEMINI_MODEL,
      contents,
      config: {
        systemInstruction,
      },
    });

    for await (const chunk of streamResult) {
      const text = chunk.text;
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
