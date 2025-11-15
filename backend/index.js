// backend/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const citiesRouter = require('./routes/cities');
const healthRouter = require('./routes/health');
const scheduler = require('./scheduler');

const app = express();
app.use(cors());
app.use(express.json());

// mount routes
app.use('/api/cities', citiesRouter);   // handles /api/cities, /api/cities/:id/fetch, /api/cities/latest, /api/cities/:id/hourly
app.use('/health', healthRouter);

// start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, async () => {
  console.log(`Backend running on ${PORT}`);
  // start initial seeding/fetch and cron scheduler (non-blocking)
  scheduler.start().catch(err => console.error('Scheduler start error', err.message));
});
