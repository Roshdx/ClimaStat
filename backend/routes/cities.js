// backend/routes/cities.js
const express = require('express');
const db = require('../db');
const { fetchForCity } = require('../services/fetcher');

const router = express.Router();

// POST /api/cities  -> add city
router.post('/', async (req, res) => {
  const { name, lat, lon } = req.body;
  if (!name || !lat || !lon) return res.status(400).json({ error: 'name, lat, lon required' });
  try {
    const { rows } = await db.query(
      'INSERT INTO cities (name, lat, lon, active) VALUES ($1,$2,$3,$4) ON CONFLICT (name) DO UPDATE SET lat=EXCLUDED.lat, lon=EXCLUDED.lon RETURNING *',
      [name, lat, lon, true]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('POST /api/cities error', err.message);
    res.status(500).json({ error: 'db_error' });
  }
});

// GET /api/cities -> list
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id, name, lat, lon, active FROM cities ORDER BY name');
    res.json(rows);
  } catch (err) {
    console.error('GET /api/cities error', err.message);
    res.status(500).json({ error: 'db_error' });
  }
});

// GET /api/cities/latest -> latest measurement per city (materialized view fallback)
router.get('/latest', async (req, res) => {
  try {
    // Try materialized view for performance; fallback to query if not present
    const mm = await db.query(`SELECT * FROM latest_measurement_per_city LIMIT 100`);
    if (mm.rows && mm.rows.length) {
      return res.json(mm.rows);
    }
    const { rows } = await db.query(`
      SELECT DISTINCT ON (m.city_id) m.city_id, m.ts, m.temperature_c, m.humidity, m.wind_speed, m.aqi
      FROM measurements_hourly m
      ORDER BY m.city_id, m.ts DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('GET /api/cities/latest error', err.message);
    res.status(500).json({ error: 'db_error' });
  }
});

// GET /api/cities/:id/hourly -> last N hourly (or range via from/to)
router.get('/:id/hourly', async (req, res) => {
  const cityId = Number(req.params.id);
  const limit = Number(req.query.limit) || 168;
  const from = req.query.from; // ISO date-time or date
  const to = req.query.to;

  try {
    let rows;
    if (from || to) {
      // use range query if at least one provided
      const params = [cityId];
      let sql = `SELECT id, city_id, ts, temperature_c, humidity, wind_speed, aqi, raw_json
                 FROM measurements_hourly
                 WHERE city_id = $1`;
      if (from) {
        params.push(new Date(from).toISOString());
        sql += ` AND ts >= $${params.length}`;
      }
      if (to) {
        params.push(new Date(to).toISOString());
        sql += ` AND ts <= $${params.length}`;
      }
      sql += ` ORDER BY ts ASC`; // ascending for range
      const result = await db.query(sql, params);
      rows = result.rows;
    } else {
      const result = await db.query(
        'SELECT id, city_id, ts, temperature_c, humidity, wind_speed, aqi, raw_json FROM measurements_hourly WHERE city_id=$1 ORDER BY ts DESC LIMIT $2',
        [cityId, limit]
      );
      // return DESC (most recent first)
      rows = result.rows;
    }
    res.json(rows);
  } catch (err) {
    console.error('GET /api/cities/:id/hourly error', err.message);
    res.status(500).json({ error: 'db_error' });
  }
});

// GET /api/cities/:id/summary -> small tile data: last measurement + simple 24h stats
router.get('/:id/summary', async (req, res) => {
  const cityId = Number(req.params.id);
  try {
    // last measurement
    const last = await db.query(
      `SELECT id, ts, temperature_c, humidity, wind_speed, aqi
       FROM measurements_hourly WHERE city_id=$1 ORDER BY ts DESC LIMIT 1`, [cityId]
    );

    // 24h window stats
    const stats = await db.query(
      `SELECT
         AVG(temperature_c) AS avg_temp,
         MIN(temperature_c) AS min_temp,
         MAX(temperature_c) AS max_temp,
         AVG(humidity) AS avg_humidity,
         AVG(wind_speed) AS avg_wind
       FROM measurements_hourly
       WHERE city_id=$1 AND ts >= now() - interval '24 hours'`, [cityId]
    );

    res.json({
      last: last.rows[0] || null,
      stats: stats.rows[0] || null
    });
  } catch (err) {
    console.error('GET /api/cities/:id/summary error', err.message);
    res.status(500).json({ error: 'db_error' });
  }
});

// POST /api/cities/:id/fetch -> dev trigger
router.post('/:id/fetch', async (req, res) => {
  try {
    const cityId = Number(req.params.id);
    const { rows } = await db.query('SELECT * FROM cities WHERE id = $1', [cityId]);
    if (!rows[0]) return res.status(404).json({ error: 'city_not_found' });
    await fetchForCity(rows[0]);
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/cities/:id/fetch error', err.message);
    res.status(500).json({ error: 'fetch_error', message: err.message });
  }
});

module.exports = router;
