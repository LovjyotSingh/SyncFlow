import { Router } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = Router();

const COMMANDS: Record<string, string> = {
  summarize: 'Summarize the following document content into 3-5 concise bullet points. Be clear and direct. Output only the bullet points, no preamble.',
  expand: 'Expand the following text with more detail, examples, and context. Keep the same professional tone. Output only the expanded text.',
  grammar: 'Fix all grammar, spelling, and punctuation errors in the following text. Keep the meaning and structure identical. Output only the corrected text.',
  suggest: 'Read the following document content and suggest 3-5 concrete next steps or improvements that would make this document more complete. Format as numbered list.',
  shorten: 'Rewrite the following text to be more concise and impactful, cutting at least 30% of the words while keeping all key information. Output only the shortened text.',
  tone: 'Rewrite the following text in a more professional and polished tone suitable for a business context. Output only the rewritten text.',
};

router.post('/ai', async (req, res) => {
  try {
    const { command, content, apiKey } = req.body;

    if (!command || !content) {
      return res.status(400).json({ error: 'command and content are required' });
    }

    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      return res.status(400).json({ error: 'No Gemini API key provided. Add GEMINI_API_KEY to backend .env or pass it in the request.' });
    }

    const prompt = COMMANDS[command];
    if (!prompt) {
      return res.status(400).json({ error: `Unknown command. Valid: ${Object.keys(COMMANDS).join(', ')}` });
    }

    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }); // Free tier

    const result = await model.generateContent(`${prompt}\n\n---\n\n${content}`);
    const text = result.response.text();

    res.json({ result: text });
  } catch (error: any) {
    console.error('Gemini AI error:', error.message);
    res.status(500).json({ error: error.message || 'AI request failed' });
  }
});

export default router;
