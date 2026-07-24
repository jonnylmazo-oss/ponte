'use strict';

// POST /api/conversation — free conversation reply + per-message error feedback
// Body: { scenario, history, userMessage }
const { client, requireAuth, sanitizeUserText } = require('../lib/ponte.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAuth(req, res)) return;

  const { scenario, history = [], userMessage } = req.body || {};

  if (!scenario || !scenario.trim()) {
    return res.status(400).json({ error: 'scenario is required' });
  }

  const safeScenario = sanitizeUserText(scenario, 200);

  const systemPrompt = `You are a native Italian speaker in this scenario: "${safeScenario}".
Speak only in Italian. Keep your responses conversational and natural — 2–4 sentences max.
After your Italian response, add a new line with exactly "---" followed by a brief English note (1–2 lines) covering any errors in the user's Italian (grammar, Spanish transfer, word choice). Start each error with ⚠️. Add a vocabulary tip starting with 💡 if relevant.
If the user's Italian had no errors, just write "✓ Ottimo!" after the ---.
If this is your opening message (no prior exchange), skip the --- section entirely and just start the conversation naturally.
Stay warm, in-character, and encouraging throughout.`;

  // Build message array from history (must alternate user/assistant)
  const messages = (history || []).map(h => ({ role: h.role, content: String(h.content) }));

  // If history starts with an assistant message, prepend the hidden opener
  if (messages.length > 0 && messages[0].role === 'assistant') {
    messages.unshift({ role: 'user', content: 'Ciao!' });
  }

  // Append the new user message, or inject opener if no history
  if (userMessage) {
    messages.push({ role: 'user', content: userMessage });
  } else if (messages.length === 0) {
    messages.push({ role: 'user', content: 'Ciao!' });
  }

  try {
    const message = await client.messages.create({
      model:       'claude-sonnet-4-6',
      max_tokens:  400,
      temperature: 0.8,
      system:      systemPrompt,
      messages,
    });

    const reply = message.content[0].text.trim();
    res.json({ reply });
  } catch (err) {
    console.error('Conversation error:', err.message);
    res.status(500).json({ error: 'Failed to get conversation response' });
  }
};
