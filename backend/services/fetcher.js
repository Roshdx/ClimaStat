// backend/services/fetcher.js
const axios = require('axios');
const db = require('../db');

const UPSERT_HOURLY_SQL = `
INSERT INTO measurements_hourly
  (city_id, ts, temperature_c, humidity, wind_speed, raw_json)
VALUES ($1,$2,$3,$4,$5,$6)
ON CONFLICT (city_id, ts) DO UPDATE
SET temperature_c = EXCLUDED.temperature_c,
    humidity = EXCLUDED.humidity,
    wind_speed = EXCLUDED.wind_speed,
    raw_json = EXCLUDED.raw_json,
    created_at = now();
`;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function httpGetWithRetry(url, opts = {}, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await axios.get(url, { timeout: 10000, ...opts });
    } catch (err) {
      if (i === retries) throw err;
      console.warn(`Request failed (attempt ${i + 1}) for ${url}: ${err.message}. Retrying...`);
      await sleep(1000 * (i + 1));
    }
  }
}

async function fetchForCity(city) {
  const { id: city_id, name, lat, lon } = city;
  console.log(`fetchForCity: ${name} (${lat},${lon})`);

  try {
    // Open-Meteo Weather Forecast API (hourly)
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
      + `&hourly=temperature_2m,relativehumidity_2m,windspeed_10m`
      + `&timezone=UTC`;

    const wRes = await httpGetWithRetry(weatherUrl).catch(e => {
      console.error('weather fetch error', e.message);
      return null;
    });

    if (!wRes?.data?.hourly) {
      console.warn(`No hourly data for ${name}`);
      return;
    }

    const times = wRes.data.hourly.time || [];
    const temps = wRes.data.hourly.temperature_2m || [];
    const humidity = wRes.data.hourly.relativehumidity_2m || [];
    const wind = wRes.data.hourly.windspeed_10m || [];

    const client = await db.getClient();
    let written = 0;
    try {
      await client.query('BEGIN');
      for (let i = 0; i < times.length; i++) {
        const ts = new Date(times[i]).toISOString();
        const temp = typeof temps[i] !== 'undefined' ? temps[i] : null;
        const hum = typeof humidity[i] !== 'undefined' ? humidity[i] : null;
        const wnd = typeof wind[i] !== 'undefined' ? wind[i] : null;

        const raw = {
          source: 'open-meteo',
          fetched_at: new Date().toISOString(),
          weather_hour: {
            ts,
            temperature_2m: temp,
            relativehumidity_2m: hum,
            windspeed_10m: wnd
          },
          meta: {
            lat, lon, city: name
          }
        };

        await client.query(UPSERT_HOURLY_SQL, [
          city_id,
          ts,
          temp,
          hum,
          wnd,
          JSON.stringify(raw)
        ]);
        written++;
      }
      await client.query('COMMIT');
      console.log(`Upserted ${written} rows for ${name}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('DB upsert error', err.message);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(`fetch error for ${name}:`, err.message);
  }
}

module.exports = { fetchForCity, httpGetWithRetry, sleep };
