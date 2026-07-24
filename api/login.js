'use strict';

// POST /api/login — password → Bearer token
const { PONTE_PASSWORD, makeToken } = require('../lib/ponte.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password } = req.body || {};
  if (!PONTE_PASSWORD) return res.json({ token: 'no-auth' });
  if (!password || password !== PONTE_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect password' });
  }
  res.json({ token: makeToken(password) });
};
