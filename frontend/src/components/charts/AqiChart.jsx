// src/components/charts/AqiChart.jsx
import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import Skeleton from '@mui/material/Skeleton';

/**
 * AqiChart
 * Props:
 *   - data: any (array of rows OR open-meteo shape OR object with arrays)
 *   - loading: boolean
 *   - hours: number (fallback/mock generator length)
 *   - height: number (px)
 */
function generateMockAqi(hours = 48) {
  const now = new Date();
  const points = [];
  for (let i = hours - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 60 * 60 * 1000);
    const base = 40 + Math.sin(i / 4) * 25 + (Math.random() * 10 - 5);
    const aqi = Math.max(5, Math.round(base));
    const pm25 = Math.max(2, +(aqi / 2.5 + Math.random() * 3).toFixed(1));
    const pm10 = Math.max(6, +(aqi / 1.8 + Math.random() * 6).toFixed(1));
    points.push({ ts: d.toISOString(), aqi, pm25, pm10 });
  }
  return points;
}

/** Normalize many backend shapes into [{ts, aqi, pm25, pm10}, ...] */
function normalizeInput(raw, hoursPref = 96) {
  if (!raw) return generateMockAqi(Math.min(hoursPref, 48));

    // 1) If it's already an array of objects
  if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'object') {
    const rows = raw
      .map(r => {
        if (!r || typeof r !== 'object') return null;

        // canonical timestamp
        const ts = r.ts ?? r.time ?? r.timestamp ?? r.created_at ?? (r.raw_json?.weather_hour?.ts ?? null);

        if (!ts) return null;

        // helper to safely extract nested numeric fields
        const num = (v) => {
          if (v === null || typeof v === 'undefined') return null;
          // sometimes numbers come as strings; try to coerce
          const n = Number(v);
          return Number.isNaN(n) ? null : n;
        };

        // prefer top-level fields, fallback to raw_json.air_hour or raw_json fields
        const aqiVal = r.us_aqi ?? r.aqi ?? r.raw_json?.air_hour?.us_aqi ?? r.raw_json?.air_hour?.aqi ?? null;
        const pm25Val = r.pm2_5 ?? r.pm25 ?? r.raw_json?.air_hour?.pm2_5 ?? r.raw_json?.air_hour?.pm25 ?? null;
        const pm10Val = r.pm10 ?? r.raw_json?.air_hour?.pm10 ?? null;

        return {
          ts,
          aqi: num(aqiVal),
          pm25: num(pm25Val),
          pm10: num(pm10Val),
          raw: r.raw_json ?? null
        };
      })
      .filter(Boolean);

    // ensure chronological ascending order (oldest -> newest)
    rows.sort((a, b) => {
      const ta = new Date(a.ts).getTime();
      const tb = new Date(b.ts).getTime();
      return (ta || 0) - (tb || 0);
    });
    console.debug('AqiChart normalized rows (first/last):', rows[0], rows[rows.length-1], 'count=', rows.length);


    if (rows.length) return rows;
    // fallback to mock
    return generateMockAqi(hoursPref);
  }


  // 2) Open-meteo style: { hourly: { time: [...], pm2_5: [...], pm10: [...], us_aqi: [...] } }
  if (raw && raw.hourly && Array.isArray(raw.hourly.time)) {
    const t = raw.hourly.time;
    const p25 = raw.hourly.pm2_5 || raw.hourly.pm25 || [];
    const p10 = raw.hourly.pm10 || [];
    const us = raw.hourly.us_aqi || raw.hourly.aqi || [];
    const out = [];
    for (let i = 0; i < t.length; i++) {
      out.push({
        ts: t[i],
        aqi: typeof us[i] !== 'undefined' ? us[i] : null,
        pm25: typeof p25[i] !== 'undefined' ? p25[i] : null,
        pm10: typeof p10[i] !== 'undefined' ? p10[i] : null
      });
    }
    return out;
  }

  // 3) Flat arrays shape: { time: [...], pm2_5: [...], pm10: [...], us_aqi: [...] }
  if (raw && Array.isArray(raw.time)) {
    const t = raw.time;
    const p25 = raw.pm2_5 || raw.pm25 || [];
    const p10 = raw.pm10 || [];
    const us = raw.us_aqi || raw.aqi || [];
    const out = [];
    for (let i = 0; i < t.length; i++) {
      out.push({
        ts: t[i],
        aqi: typeof us[i] !== 'undefined' ? us[i] : null,
        pm25: typeof p25[i] !== 'undefined' ? p25[i] : null,
        pm10: typeof p10[i] !== 'undefined' ? p10[i] : null
      });
    }
    return out;
  }

  // 4) If raw itself is already a single object row
  if (raw && typeof raw === 'object' && (raw.ts || raw.time || raw.timestamp)) {
    const r = raw;
    return [
      {
        ts: r.ts ?? r.time ?? r.timestamp,
        aqi: r.us_aqi ?? r.aqi ?? null,
        pm25: r.pm2_5 ?? r.pm25 ?? null,
        pm10: r.pm10 ?? null
      }
    ];
  }

  // fallback: mock
  return generateMockAqi(Math.min(hoursPref, 48));
}

export default function AqiChart({ data: raw = null, loading = false, hours = 96, height = 300 }) {
  // Loading skeleton
  if (loading) {
    return <Skeleton variant="rectangular" height={height} animation="wave" />;
  }

  // Normalize to rows [{ts, aqi, pm25, pm10}]
  const rows = useMemo(() => normalizeInput(raw, hours), [raw, hours]);

  // If we still have no rows, render skeleton or placeholder
  if (!Array.isArray(rows) || rows.length === 0) {
    return <Skeleton variant="rectangular" height={height} animation="wave" />;
  }

  // Trim to last `hours` if requested (rows expected ordered ascending by time)
  let pts = rows;
  if (hours && rows.length > hours) {
    pts = rows.slice(-hours);
  }

  // build series arrays
  const times = pts.map(p => p.ts);
  const aqiVals = pts.map(p => (p.aqi == null ? NaN : Number(p.aqi)));
  const pm25Vals = pts.map(p => (p.pm25 == null ? NaN : Number(p.pm25)));
  const pm10Vals = pts.map(p => (p.pm10 == null ? NaN : Number(p.pm10)));

  // Avoid overcrowded x axis: show every Nth label depending on length
  const labelInterval = Math.max(0, Math.floor(times.length / 8));

  const option = {
    animation: true,
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        if (!params || params.length === 0) return '';
        const timeLabel = new Date(params[0].axisValue).toLocaleString();
        const lines = [`<b>${timeLabel}</b>`];
        params.forEach(p => {
          if (p.seriesName && (p.value !== null && p.value !== undefined && !Number.isNaN(p.value))) {
            lines.push(`${p.marker} ${p.seriesName}: <b>${p.value}</b>`);
          }
        });
        return lines.join('<br/>');
      },
      axisPointer: { type: 'shadow' }
    },
    grid: { left: 58, right: 44, top: 24, bottom: 72 },
    xAxis: {
      type: 'category',
      data: times,
      axisLabel: {
        formatter: val => {
          try {
            return new Date(val).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          } catch (e) {
            return String(val);
          }
        },
        interval: labelInterval
      },
      boundaryGap: false
    },
    yAxis: [
      {
        name: 'AQI',
        type: 'value',
        position: 'left',
        min: 0,
        max: 500,
        splitLine: { show: true, lineStyle: { color: '#eceff1' } }
      },
      {
        name: 'µg/m³',
        type: 'value',
        position: 'right',
        splitLine: { show: false },
        offset: 0
      }
    ],
    visualMap: {
      show: false,
      pieces: [
        { gt: 300, label: '>300', color: '#7e0023' },
        { gt: 200, lte: 300, label: '201-300', color: '#99004c' },
        { gt: 150, lte: 200, label: '151-200', color: '#ff0000' },
        { gt: 100, lte: 150, label: '101-150', color: '#ff7e00' },
        { gt: 50, lte: 100, label: '51-100', color: '#ffd400' },
        { lte: 50, label: '0-50', color: '#009966' }
      ],
      seriesIndex: 0
    },
    series: [
      {
        name: 'AQI (US)',
        type: 'line',
        data: aqiVals,
        yAxisIndex: 0,
        smooth: true,
        showSymbol: false,
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(255,120,0,0.18)' },
              { offset: 1, color: 'rgba(255,120,0,0.02)' }
            ]
          }
        },
        lineStyle: { width: 2 },
        itemStyle: { color: '#ff9800' }
      },
      {
        name: 'PM2.5 (µg/m³)',
        type: 'bar',
        data: pm25Vals,
        yAxisIndex: 1,
        barWidth: Math.max(6, Math.floor(700 / Math.max(pts.length, 40))),
        itemStyle: { opacity: 0.75 }
      },
      {
        name: 'PM10 (µg/m³)',
        type: 'bar',
        data: pm10Vals,
        yAxisIndex: 1,
        barWidth: Math.max(6, Math.floor(700 / Math.max(pts.length, 40))),
        itemStyle: { opacity: 0.45 }
      }
    ],
    toolbox: { show: false },
    dataZoom: [
      { type: 'inside', xAxisIndex: 0, start: 0, end: 100 },
      { show: true, realtime: true, start: 0, end: 100, height: 20, bottom: 8 }
    ]
  };

  return (
    <div>
      <ReactECharts
        option={option}
        style={{ height: `${height}px`, width: '100%' }}
        notMerge={true}
        lazyUpdate={true}
      />
    </div>
  );
}
