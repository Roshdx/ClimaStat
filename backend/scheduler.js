// backend/scheduler.js
const cron = require('node-cron');
const db = require('./db');
const maintenance = require('./maintenance');
const { fetchForCity, sleep } = require('./services/fetcher');
const DEFAULT_CITIES = [
  { name: 'Mumbai', lat: 19.0760, lon: 72.8777 },
  { name: 'Delhi', lat: 28.7041, lon: 77.1025 },
  { name: 'Bengaluru', lat: 12.9716, lon: 77.5946 },
  { name: 'Hyderabad', lat: 17.3850, lon: 78.4867 },
  { name: 'Ahmedabad', lat: 23.0225, lon: 72.5714 },
  { name: 'Chennai', lat: 13.0827, lon: 80.2707 },
  { name: 'Kolkata', lat: 22.5726, lon: 88.3639 },
  { name: 'Surat', lat: 21.1702, lon: 72.8311 },
  { name: 'Pune', lat: 18.5204, lon: 73.8567 },
  { name: 'Jaipur', lat: 26.9124, lon: 75.7873 },
  { name: 'Lucknow', lat: 26.8467, lon: 80.9462 },
  { name: 'Kanpur', lat: 26.4499, lon: 80.3319 },
  { name: 'Nagpur', lat: 21.1458, lon: 79.0882 },
  { name: 'Indore', lat: 22.7196, lon: 75.8577 },
  { name: 'Thane', lat: 19.2183, lon: 72.9781 },
  { name: 'Bhopal', lat: 23.2599, lon: 77.4126 },
  { name: 'Visakhapatnam', lat: 17.6868, lon: 83.2185 },
  { name: 'Pimpri-Chinchwad', lat: 18.6298, lon: 73.7997 },
  { name: 'Patna', lat: 25.5941, lon: 85.1376 },
  { name: 'Vadodara', lat: 22.3072, lon: 73.1812 }
];


// call this instead of seedCitiesIfEmpty
async function syncCities(masterCities, opts = { softDeleteRemoved: true }) {
  // masterCities: [{name, lat, lon}, ...]
  // opts.softDeleteRemoved: if true, mark removed cities active=false; if false, leave them as-is
  const { rows: dbRows } = await db.query('SELECT id, name, lat, lon, active FROM cities');
  const dbByName = new Map(dbRows.map(r => [r.name.toLowerCase(), r]));

  // normalize master list
  const masterByName = new Map(masterCities.map(c => [c.name.toLowerCase(), c]));

  // 1) Insert or update master entries
  for (const c of masterCities) {
    const key = c.name.toLowerCase();
    const existing = dbByName.get(key);
    if (!existing) {
      // insert new city (active true)
      await db.query('INSERT INTO cities (name, lat, lon, active) VALUES ($1,$2,$3,$4)', [c.name, c.lat, c.lon, true]);
      console.log('syncCities: inserted', c.name);
    } else {
      // check if coords or active flag differ
      const latChanged = Number(existing.lat) !== Number(c.lat);
      const lonChanged = Number(existing.lon) !== Number(c.lon);
      const wasInactive = existing.active === false;
      if (latChanged || lonChanged || wasInactive) {
        await db.query('UPDATE cities SET lat=$1, lon=$2, active=$3 WHERE id=$4', [c.lat, c.lon, true, existing.id]);
        console.log('syncCities: updated', c.name, (latChanged || lonChanged) ? 'coords' : '', wasInactive ? 'reactivated' : '');
      }
    }
  }

  // 2) Soft-delete / mark inactive any DB city not in master (if option set)
  if (opts.softDeleteRemoved) {
    for (const dbRow of dbRows) {
      const key = dbRow.name.toLowerCase();
      if (!masterByName.has(key) && dbRow.active !== false) {
        await db.query('UPDATE cities SET active = false WHERE id = $1', [dbRow.id]);
        console.log('syncCities: marked inactive', dbRow.name);
      }
    }
  }

  // 3) Optionally return current counts
  const { rows: counts } = await db.query('SELECT COUNT(*) FILTER (WHERE active) AS active_count, COUNT(*) AS total FROM cities');
  return counts[0];
}


async function initialFetchAll() {
  const { rows: cities } = await db.query('SELECT * FROM cities ORDER BY id');
  console.log(`initialFetchAll: fetching ${cities.length} cities`);
  for (const c of cities) {
    try {
      await fetchForCity(c);
      await sleep(1200);
    } catch (e) {
      console.error('initial fetch error for', c.name, e.message);
    }
  }
  console.log('initialFetchAll done');
}

function schedulePeriodicFetch() {
  // every 20 minutes
  cron.schedule('*/20 * * * *', async () => {
    console.log('Cron: periodic fetch starting', new Date().toISOString());
    const { rows: cities } = await db.query('SELECT * FROM cities ORDER BY id');
    for (const c of cities) {
      try {
        await fetchForCity(c);
        await sleep(800);
      } catch (e) {
        console.error('Periodic fetch error for', c.name, e.message);
      }
    }
    console.log('Cron: periodic fetch finished', new Date().toISOString());
  });
}

async function start() {
  try {
    // sync master list to DB (soft-delete removed cities)
    try {
        await syncCities(DEFAULT_CITIES, { softDeleteRemoved: true });
        await initialFetchAll();
        schedulePeriodicFetch();
        // start maintenance jobs
        maintenance.scheduleMaintenance({ retentionDays: 90 });
        console.log('Scheduler started');
    } catch (err) {
        console.error('Scheduler start error', err.message);
    }
    const syncResult = await syncCities(DEFAULT_CITIES, { softDeleteRemoved: true });
    console.log('syncCities result:', syncResult);
    //await initialFetchAll();
    schedulePeriodicFetch();
    console.log('Scheduler started');
  } catch (err) {
    console.error('Scheduler start error', err.message);
  }
}

module.exports = { start };
