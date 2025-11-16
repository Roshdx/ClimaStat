// src/lib/api.js
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

const client = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' }
});

export async function getHealth() {
  return client.get('/health');
}

export async function getCities() {
  const { data } = await client.get('/api/cities');
  return data;
}

export async function getLatestPerCity() {
  const { data } = await client.get('/api/cities/latest');
  return data; // array of latest rows
}

// fetch hourly measurements for a city, default last 72 hours
export async function getHourlyForCity(cityId, hours = 72) {
  const { data } = await client.get(`/api/cities/${cityId}/hourly`, { params: { hours }});
  return data;
}

export async function triggerFetchCity(cityId) {
  const { data } = await client.post(`/api/cities/${cityId}/fetch`);
  return data;
}

export default client;
