// backend/routes/health.js
const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', db: 'ok', time: new Date().toISOString() });
  } catch (err) {
    console.error('GET /health error', err.message);
    res.status(500).json({ status: 'error', db: 'down', message: err.message });
  }
});

module.exports = router;
