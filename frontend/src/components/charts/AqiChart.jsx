// src/components/charts/AqiChart.jsx
import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';

// Simple mock data generator (you'll replace with real API data later)
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

// Map AQI to color label (for legend or other use)
function aqiLevel(aqi) {
  if (aqi == null) return 'Unknown';
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy SG';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

export default function AqiChart({ hours = 48, height = 260 }) {
  const data = useMemo(() => generateMockAqi(hours), [hours]);

  const option = useMemo(() => {
    const times = data.map(p => p.ts);
    const aqi = data.map(p => p.aqi);
    const pm25 = data.map(p => p.pm25);
    const pm10 = data.map(p => p.pm10);

    return {
      animation: true,
      tooltip: {
        trigger: 'axis',
        formatter: params => {
          // params is an array of series values at that point
          const timeLabel = new Date(params[0].axisValue).toLocaleString();
          const lines = [`<b>${timeLabel}</b>`];
          params.forEach(p => {
            lines.push(`${p.marker} ${p.seriesName}: <b>${p.value}</b>`);
          });
          // include pm values if available in series
          return lines.join('<br/>');
        },
        axisPointer: { type: 'shadow' }
      },
      grid: { left: 50, right: 20, top: 30, bottom: 40 },
      xAxis: {
        type: 'category',
        data: times,
        axisLabel: { formatter: val => new Date(val).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
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
          offset: 0,
          splitLine: { show: false }
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
          data: aqi,
          yAxisIndex: 0,
          smooth: true,
          showSymbol: false,
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(255,120,0,0.18)' },
                { offset: 1, color: 'rgba(255,120,0,0.02)' },
              ]
            }
          },
          lineStyle: { width: 2 },
          itemStyle: { color: '#ff9800' }
        },
        {
          name: 'PM2.5 (µg/m³)',
          type: 'bar',
          data: pm25,
          yAxisIndex: 1,
          barWidth: 8,
          itemStyle: { opacity: 0.7 }
        },
        {
          name: 'PM10 (µg/m³)',
          type: 'bar',
          data: pm10,
          yAxisIndex: 1,
          barWidth: 8,
          itemStyle: { opacity: 0.5 }
        }
      ],
      toolbox: { show: false },
      dataZoom: [
        { type: 'inside', xAxisIndex: 0, start: 0, end: 100 },
        { show: true, realtime: true, start: 0, end: 100, height: 20, bottom: 0 }
      ]
    };
  }, [data]);

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
