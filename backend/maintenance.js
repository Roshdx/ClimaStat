// backend/maintenance.js
const cron = require('node-cron');
const db = require('./db');

async function runRetention(days = 90) {
  try {
    const res = await db.query('DELETE FROM measurements_hourly WHERE ts < now() - ($1::int || \' days\')::interval RETURNING count(*)', [days]);
    console.log(`Retention: removed rows older than ${days} days`);
  } catch (err) {
    console.error('Retention job error', err.message);
  }
}

async function refreshMaterializedView() {
  try {
    console.log('Refreshing materialized view latest_measurement_per_city...');
    // non-concurrent refresh (safer); for large tables consider CONCURRENTLY with proper index
    await db.query('REFRESH MATERIALIZED VIEW CONCURRENTLY latest_measurement_per_city');
    console.log('Materialized view refreshed');
  } catch (err) {
    // If CONCURRENTLY not possible (e.g., view not created or missing unique index), fallback:
    try {
      console.warn('CONCURRENTLY refresh failed, trying non-concurrent refresh...', err.message);
      await db.query('REFRESH MATERIALIZED VIEW latest_measurement_per_city');
      console.log('Materialized view refreshed (non-concurrent)');
    } catch (e) {
      console.error('Failed to refresh materialized view', e.message);
    }
  }
}

// schedule retention daily at 03:10 UTC and refresh view every 5 minutes (tune as needed)
function scheduleMaintenance(opts = { retentionDays: 90 }) {
  cron.schedule('10 3 * * *', async () => {
    await runRetention(opts.retentionDays);
  });

  // Refresh materialized view every 5 minutes to keep latest tile fast
  cron.schedule('*/5 * * * *', async () => {
    await refreshMaterializedView();
  });

  console.log('Maintenance scheduled: retention daily, materialized view refresh every 5 minutes');
}

module.exports = { runRetention, refreshMaterializedView, scheduleMaintenance };
