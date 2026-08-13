'use strict';

// GET /api/generate-article-stream?topic=...&difficulty=...&token=...
// SSE article generation. EventSource cannot send headers, so auth is via ?token=.
const { client, requireAuthQuery, buildPrompt, parseArticleJSON } = require('../lib/ponte.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAuthQuery(req, res)) return;

  const { topic, difficulty } = req.query;

  if (!topic || !difficulty) {
    return res.status(400).json({ error: 'topic and difficulty are required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  let accumulated = '';

  try {
    const stream = await client.messages.create({
      model:       'claude-sonnet-4-6',
      max_tokens:  1500, // was 1200; +300 headroom for the culturalNote field (#34)
      temperature: 0.8,
      stream:      true,
      messages:    [{ role: 'user', content: buildPrompt(topic, difficulty) }],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        const token = event.delta.text;
        accumulated += token;
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      }
    }

    // Parse the complete accumulated JSON and emit the done event
    let article;
    try {
      article = parseArticleJSON(accumulated);
    } catch (parseErr) {
      console.error('All local parse attempts failed:', parseErr.message);
      console.error('Raw response length:', accumulated.length);
      console.error('Raw response (first 300 chars):', accumulated.slice(0, 300));
      const errPos = parseErr.message.match(/position (\d+)/);
      if (errPos) {
        const pos = parseInt(errPos[1], 10);
        console.error(`Raw response around error (pos ${pos}):`, JSON.stringify(accumulated.slice(Math.max(0, pos - 40), pos + 40)));
      }

      // Retry once with explicit ASCII-only instruction and lower temperature
      console.log('Retrying with strict JSON prompt...');
      try {
        const retry = await client.messages.create({
          model:       'claude-sonnet-4-6',
          max_tokens:  1500, // was 1200; +300 headroom for the culturalNote field (#34)
          temperature: 0.4,
          messages:    [{ role: 'user', content: buildPrompt(topic, difficulty, true) }],
        });
        article = parseArticleJSON(retry.content[0].text);
        console.log('Retry succeeded.');
      } catch (retryErr) {
        console.error('Retry also failed:', retryErr.message);
        throw parseErr; // surface original error to the outer catch
      }
    }

    res.write(`event: done\ndata: ${JSON.stringify(article)}\n\n`);
    res.end();
  } catch (err) {
    console.error('Streaming error:', err.message);
    res.write(`event: generation-error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
};
