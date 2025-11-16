// src/lib/api.js
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

const client = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Basic helper to unwrap and throw normalized errors
async function _req(promise) {
  try {
    const resp = await promise;
    return resp.data;
  } catch (err) {
    // normalize
    if (err.response) {
      const message = err.response.data?.error || err.response.data || err.message;
      const e = new Error(String(message));
      e.status = err.response.status;
      e.payload = err.response.data;
      throw e;
    } else {
      throw err;
    }
  }
}

/** Health check */
export function getHealth() {
  return _req(client.get('/health'));
}

/** Get list of cities */
export function getCities() {
  return _req(client.get('/api/cities'));
}

/** Get latest measurement per city (from materialized view) */
export function getLatestPerCity() {
  return _req(client.get('/api/cities/latest'));
}

/**
 * Get hourly rows for a city
 * Backend expected route: GET /api/cities/:id/hourly
 * Accepts optional `hours` query param to limit (e.g. ?hours=72)
 */
export function getHourlyForCity(cityId, hours = 72) {
  if (!cityId) return Promise.resolve([]);
  return _req(client.get(`/api/cities/${cityId}/hourly`, { params: { hours } }));
}

/** Trigger a manual fetch for a city (POST) */
export function triggerFetchCity(cityId) {
  if (!cityId) return Promise.reject(new Error('cityId required'));
  return _req(client.post(`/api/cities/${cityId}/fetch`));
}

export default client;
