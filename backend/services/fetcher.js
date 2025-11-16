// backend/services/fetcher.js
const axios = require('axios');
const db = require('../db');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function httpGetWithRetry(url, opts = {}, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await axios.get(url, { timeout: 10000, ...opts });
    } catch (err) {
      const attempt = i + 1;
      const msg = err?.message || String(err);
      console.warn(`Request failed (attempt ${attempt}) for ${url}: ${msg}`);
      if (i === retries) {
        throw err;
      }
      // backoff
      await sleep(1000 * attempt);
    }
  }
}

// ----- AQI helpers (US EPA breakpoints) -----
function aqiFromPm25(pm25) {
  if (pm25 == null) return null;
  const bps = [
    { c_lo: 0.0,   c_hi: 12.0,  i_lo: 0,   i_hi: 50 },
    { c_lo: 12.1,  c_hi: 35.4,  i_lo: 51,  i_hi: 100 },
    { c_lo: 35.5,  c_hi: 55.4,  i_lo: 101, i_hi: 150 },
    { c_lo: 55.5,  c_hi: 150.4, i_lo: 151, i_hi: 200 },
    { c_lo: 150.5, c_hi: 250.4, i_lo: 201, i_hi: 300 },
    { c_lo: 250.5, c_hi: 350.4, i_lo: 301, i_hi: 400 },
    { c_lo: 350.5, c_hi: 500.4, i_lo: 401, i_hi: 500 },
  ];
  for (const bp of bps) {
    if (pm25 >= bp.c_lo && pm25 <= bp.c_hi) {
      const { c_lo, c_hi, i_lo, i_hi } = bp;
      return Math.round(((i_hi - i_lo) / (c_hi - c_lo)) * (pm25 - c_lo) + i_lo);
    }
  }
  return null;
}

function aqiFromPm10(pm10) {
  if (pm10 == null) return null;
  const bps = [
    { c_lo: 0,    c_hi: 54,   i_lo: 0,   i_hi: 50 },
    { c_lo: 55,   c_hi: 154,  i_lo: 51,  i_hi: 100 },
    { c_lo: 155,  c_hi: 254,  i_lo: 101, i_hi: 150 },
    { c_lo: 255,  c_hi: 354,  i_lo: 151, i_hi: 200 },
    { c_lo: 355,  c_hi: 424,  i_lo: 201, i_hi: 300 },
    { c_lo: 425,  c_hi: 504,  i_lo: 301, i_hi: 400 },
    { c_lo: 505,  c_hi: 604,  i_lo: 401, i_hi: 500 },
  ];
  for (const bp of bps) {
    if (pm10 >= bp.c_lo && pm10 <= bp.c_hi) {
      const { c_lo, c_hi, i_lo, i_hi } = bp;
      return Math.round(((i_hi - i_lo) / (c_hi - c_lo)) * (pm10 - c_lo) + i_lo);
    }
  }
  return null;
}

function compositeAqiFromPm(pm25, pm10) {
  const a1 = aqiFromPm25(pm25);
  const a2 = aqiFromPm10(pm10);
  if (a1 == null && a2 == null) return null;
  if (a1 == null) return a2;
  if (a2 == null) return a1;
  return Math.max(a1, a2);
}

// ----- UPSERT SQL (ensure columns exist in schema) -----
const UPSERT_HOURLY_SQL = `
INSERT INTO measurements_hourly
  (city_id, ts, temperature_c, humidity, wind_speed, aqi, us_aqi, european_aqi, pm2_5, pm10, raw_json)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
ON CONFLICT (city_id, ts) DO UPDATE
SET temperature_c = EXCLUDED.temperature_c,
    humidity = EXCLUDED.humidity,
    wind_speed = EXCLUDED.wind_speed,
    aqi = EXCLUDED.aqi,
    us_aqi = EXCLUDED.us_aqi,
    european_aqi = EXCLUDED.european_aqi,
    pm2_5 = EXCLUDED.pm2_5,
    pm10 = EXCLUDED.pm10,
    raw_json = EXCLUDED.raw_json,
    created_at = now();
`;

// ----- Main fetcher -----
async function fetchForCity(city) {
  const { id: city_id, name, lat, lon } = city;
  console.log(`fetchForCity: ${name} (${lat},${lon})`);

  try {
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&hourly=temperature_2m,relativehumidity_2m,windspeed_10m&timezone=UTC`;

    // air quality endpoint (Open-Meteo air-quality)
    const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
      `&hourly=pm2_5,pm10,us_aqi,european_aqi&timezone=UTC`;

    // fetch both concurrently with retries
    const [wRes, aRes] = await Promise.all([
      httpGetWithRetry(weatherUrl).catch(e => { console.error('weather fetch error', e.message || e); return null; }),
      httpGetWithRetry(aqiUrl).catch(e => { console.error('aqi fetch error', e.message || e); return null; })
    ]);

    if (!wRes?.data?.hourly) {
      console.warn(`No hourly weather data for ${name} — skipping`);
      return;
    }

    const times = wRes.data.hourly.time || [];
    const temps = wRes.data.hourly.temperature_2m || [];
    const humidity = wRes.data.hourly.relativehumidity_2m || [];
    const wind = wRes.data.hourly.windspeed_10m || [];

    // AQ arrays (may be empty if aRes missing)
    const pm25 = aRes?.data?.hourly?.pm2_5 || [];
    const pm10 = aRes?.data?.hourly?.pm10 || [];
    const usAqiArr = aRes?.data?.hourly?.us_aqi || [];
    const euAqiArr = aRes?.data?.hourly?.european_aqi || [];

    const client = await db.getClient();
    let written = 0;
    try {
      await client.query('BEGIN');

      for (let i = 0; i < times.length; i++) {
        const ts = new Date(times[i]).toISOString();
        const temp = typeof temps[i] !== 'undefined' ? temps[i] : null;
        const hum = typeof humidity[i] !== 'undefined' ? humidity[i] : null;
        const wnd = typeof wind[i] !== 'undefined' ? wind[i] : null;

        const p25 = (pm25.length > i && typeof pm25[i] !== 'undefined') ? pm25[i] : null;
        const p10 = (pm10.length > i && typeof pm10[i] !== 'undefined') ? pm10[i] : null;
        let us = (usAqiArr.length > i && typeof usAqiArr[i] !== 'undefined') ? usAqiArr[i] : null;
        let eu = (euAqiArr.length > i && typeof euAqiArr[i] !== 'undefined') ? euAqiArr[i] : null;

        // fallback compute if provider didn't return us_aqi
        if (us == null) {
          us = compositeAqiFromPm(p25, p10);
        }

        // generic aqi (prefer us)
        const genericAqi = us ?? eu ?? null;

        const raw = {
          source: 'open-meteo',
          fetched_at: new Date().toISOString(),
          weather_hour: { ts, temperature_2m: temp, relativehumidity_2m: hum, windspeed_10m: wnd },
          air_hour: { pm2_5: p25, pm10: p10, us_aqi: us, european_aqi: eu },
          meta: { lat, lon, city: name }
        };

        await client.query(UPSERT_HOURLY_SQL, [
          city_id, ts, temp, hum, wnd, genericAqi, us, eu, p25, p10, JSON.stringify(raw)
        ]);

        written++;
      }

      await client.query('COMMIT');
      console.log(`Upserted ${written} rows for ${name}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('DB upsert error', err.message || err);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(`fetch error for ${name}:`, err.message || err);
  }
}

module.exports = { fetchForCity, httpGetWithRetry, sleep };
