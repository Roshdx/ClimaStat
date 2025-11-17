// src/App.jsx
import React from 'react';
import {
  ThemeProvider,
  createTheme,
  responsiveFontSizes,
} from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Container from '@mui/material/Container';
import Switch from '@mui/material/Switch';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import BoxIcon from '@mui/icons-material/Widgets';
import NightlightRoundIcon from '@mui/icons-material/NightlightRound';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import WbTwilightIcon from '@mui/icons-material/WbTwilight';
import LightModeIcon from '@mui/icons-material/LightMode';
import NightsStayIcon from '@mui/icons-material/NightsStay';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import OpacityIcon from '@mui/icons-material/Opacity';
import SpeedIcon from '@mui/icons-material/Speed';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CodeIcon from '@mui/icons-material/Code';

import AqiChart from './components/charts/AqiChart';
import { useQueryClient } from "@tanstack/react-query";

import { useLatestAll, useHourly, useCities, useTriggerFetch } from './hooks/useMeasurements';

function useMode(initial = 'light') {
  const [mode, setMode] = React.useState(
    () => localStorage.getItem('climastat_theme') || initial
  );
  React.useEffect(() => localStorage.setItem('climastat_theme', mode), [mode]);
  const toggle = () => setMode(m => (m === 'light' ? 'dark' : 'light'));
  return [mode, toggle];
}

function createAppTheme(mode) {
  let theme = createTheme({
    palette: {
      mode,
      primary: { main: '#1976d2' },
      secondary: { main: '#00acc1' },
      background: {
        default: mode === 'light' ? '#f7fbff' : '#0f1720',
        paper: mode === 'light' ? '#ffffff' : '#0b1220'
      },
      tonalOffset: 0.08,
    },
    shape: { borderRadius: 12 },
    components: {
      MuiAppBar: {
        styleOverrides: {
          root: ({ theme }) => ({
            background:
              mode === 'light'
                ? 'linear-gradient(90deg, rgba(25,118,210,1) 0%, rgba(0,172,193,1) 100%)'
                : undefined,
            boxShadow: theme.shadows[6],
          }),
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            padding: '16px',
            transition: 'box-shadow 200ms ease, transform 120ms ease',
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
      },
    },
    typography: {
      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
      h4: { fontWeight: 600 },
      h6: { fontWeight: 500 },
    },
  });

  theme = responsiveFontSizes(theme);
  return theme;
}

/** KPI Component */
function KPI({ title, value, suffix, icon }) {
  const display = (value === null || value === undefined || value === '') ? '--' : value;
  return (
    <Paper elevation={3} sx={{ p: 2, borderRadius: 3, minWidth: 160 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography variant="subtitle2" color="text.secondary">{title}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {display}
            </Typography>
            {suffix ? <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 0.6 }}>{suffix}</Typography> : null}
          </Box>
        </Box>

        <Avatar sx={{ bgcolor: 'primary.main' }}>{icon ?? <BoxIcon />}</Avatar>
      </Stack>
    </Paper>
  );
}

/** formatters */
const fmtTemp = (v) => (v === null || v === undefined ? null : `${Number(v).toFixed(1)}°C`);
const fmtPct = (v) => (v === null || v === undefined ? null : `${Number(v).toFixed(0)}%`);
const fmtWind = (v) => (v === null || v === undefined ? null : `${Number(v).toFixed(1)} m/s`);
const aqiCategory = (aqi) => {
  if (aqi === null || aqi === undefined) return '';
  const n = Number(aqi);
  if (n <= 50) return 'Good';
  if (n <= 100) return 'Moderate';
  if (n <= 150) return 'Unhealthy (Sensitive)';
  if (n <= 200) return 'Unhealthy';
  if (n <= 300) return 'Very Unhealthy';
  return 'Hazardous';
};

/** compute 'feels like' (apparent temp) */
function computeFeelsLikeC(tempC, rhPct, windMs) {
  if (tempC === null || tempC === undefined) return null;
  const T = Number(tempC);
  const rh = (rhPct === null || rhPct === undefined) ? 0 : Number(rhPct);
  const wind = (windMs === null || windMs === undefined) ? 0 : Number(windMs);

  const e = (rh / 100) * 6.105 * Math.exp((17.27 * T) / (237.7 + T)); // hPa
  const at = T + 0.33 * e - 0.7 * wind - 4.0;
  if (!isFinite(at)) return null;
  return Number(at.toFixed(1));
}

/**
 * choose icon + bgColor + fgColor + smallFg based on 24h hour (prefer is_day if present)
 * smallFg is used by the small (transparent) avatar so it can invert appropriately between light/dark
 */
function timeOfDayIconAndColor(row, mode = 'light') {
  const defaultBg = '#ffb74d';
  const defaultFg = '#fff';
  const defaultIcon = <WbSunnyIcon />;

  if (!row) return { iconNode: defaultIcon, bgColor: defaultBg, fgColor: defaultFg, smallFg: '#000' };

  if (typeof row.is_day !== 'undefined') {
    const isDay = Number(row.is_day) === 1;
    if (isDay) {
      return {
        iconNode: <LightModeIcon />,
        bgColor: '#ffd54f',
        fgColor: '#fff',
        smallFg: '#ffd54f'
      };
    } else {
      // night w/ explicit flag
      // light mode: small icon should be dark (#334155) on white paper
      // dark mode: small icon should be white
      return {
        iconNode: <NightsStayIcon />,
        bgColor: mode === 'dark' ? '#475569' : '#334155',
        fgColor: '#fff',
        smallFg: mode === 'dark' ? '#fff' : '#334155'
      };
    }
  }

  const ts = row.ts ?? row.created_at ?? null;
  if (!ts) return { iconNode: defaultIcon, bgColor: defaultBg, fgColor: defaultFg, smallFg: '#000' };

  const hour = new Date(ts).getHours();
  // morning 06-11, afternoon 12-16, evening 17-19, night 20-05
  if (hour >= 6 && hour <= 11) {
    return { iconNode: <LightModeIcon />, bgColor: '#ffd54f', fgColor: '#fff', smallFg: '#ffd54f' };
  }
  if (hour >= 12 && hour <= 16) {
    return { iconNode: <WbSunnyIcon />, bgColor: '#ffb74d', fgColor: '#fff', smallFg: '#ffb74d' };
  }
  if (hour >= 17 && hour <= 19) {
    return { iconNode: <WbTwilightIcon />, bgColor: '#f59e0b', fgColor: '#fff', smallFg: '#f59e0b' };
  }

  // NIGHT: set invert-friendly colors
  // light mode -> dark slate bg for big avatar, and smallFg uses that dark slate (icon visible on white)
  // dark mode  -> slightly lighter slate bg for big avatar, and smallFg white (icon visible on dark)
  return {
    iconNode: <NightsStayIcon />,
    bgColor: mode === 'dark' ? '#475569' : '#334155',
    fgColor: '#fff',
    smallFg: mode === 'dark' ? '#fff' : '#334155'
  };
}

export default function App() {
  const [open, setOpen] = React.useState(false);
  const [mode, toggleMode] = useMode('light');
  const theme = React.useMemo(() => createAppTheme(mode), [mode]);
  const queryClient = useQueryClient();
  const [inspectOpen, setInspectOpen] = React.useState(false);
  const openInspector = () => setInspectOpen(true);
  const closeInspector = () => setInspectOpen(false);

  // --- data hooks ---
  const {
    data: cities = [],
    isLoading: citiesLoading,
    isFetching: citiesFetching,
    isError: citiesError,
    error: citiesErrorObj,
    refetch: refetchCities
  } = useCities();

  const { data: latestAll = [], isLoading: latestLoading } = useLatestAll();
  const [selectedCity, setSelectedCity] = React.useState('');
  const { data: hourlyData = [], isLoading: hourlyLoading } = useHourly(selectedCity, 96);

  // auto-select first city when cities load, but prefer persisted choice
  React.useEffect(() => {
    const saved = localStorage.getItem('climastat_city');
    if (saved && (!selectedCity || selectedCity === '')) {
      setSelectedCity(saved);
      return;
    }

    if (!selectedCity && Array.isArray(cities) && cities.length > 0) {
      setSelectedCity(cities[0].id);
    }
  }, [cities, selectedCity]);

  React.useEffect(() => {
    if (selectedCity) localStorage.setItem('climastat_city', String(selectedCity));
  }, [selectedCity]);

  // trigger fetch
  const triggerFetchFn = useTriggerFetch();
  const [refreshing, setRefreshing] = React.useState(false);

  async function handleRefresh() {
    if (!selectedCity) return;
    try {
      setRefreshing(true);
      await triggerFetchFn(selectedCity);
    } catch (err) {
      console.error('Trigger fetch failed', err);
    } finally {
      setRefreshing(false);
    }
  }

  // selected city's latest measurement row (current date/time values)
  const selectedLatest = React.useMemo(() => {
    if (!latestAll || !selectedCity) return null;
    return latestAll.find(r => Number(r.city_id) === Number(selectedCity)) || null;
  }, [latestAll, selectedCity]);

  // direct field usage (confirmed schema)
  const tempRaw = selectedLatest?.temperature_c ?? null;
  const humidityRaw = selectedLatest?.humidity ?? null;
  const windRaw = selectedLatest?.wind_speed ?? null;
  const aqiRaw = selectedLatest?.us_aqi ?? selectedLatest?.aqi ?? null;

  const kpiTemp = tempRaw !== null ? fmtTemp(tempRaw) : null;
  const feelsC = computeFeelsLikeC(tempRaw, humidityRaw, windRaw);
  const kpiFeels = feelsC !== null ? `${feelsC.toFixed(1)}°C` : null;
  const kpiHumidity = humidityRaw !== null ? fmtPct(humidityRaw) : null;
  const kpiWind = windRaw !== null ? fmtWind(windRaw) : null;
  const kpiAqi = aqiRaw !== null ? String(aqiRaw) : null;

  const lastUpdated = selectedLatest?.ts ?? selectedLatest?.created_at ?? null;

  // compute hi/lo for "today" from hourlyData using local date of selectedLatest
  const [hiLo, setHiLo] = React.useState({ hi: null, lo: null });
  React.useEffect(() => {
    if (!Array.isArray(hourlyData) || hourlyData.length === 0 || !lastUpdated) {
      setHiLo({ hi: null, lo: null });
      return;
    }
    const baseDate = new Date(lastUpdated);
    const baseYear = baseDate.getFullYear();
    const baseMonth = baseDate.getMonth();
    const baseDay = baseDate.getDate();

    const tempsForDay = hourlyData
      .map(r => ({ ts: r.ts ?? r.created_at, temp: r.temperature_c }))
      .filter(r => {
        if (!r.ts) return false;
        const d = new Date(r.ts);
        return d.getFullYear() === baseYear && d.getMonth() === baseMonth && d.getDate() === baseDay;
      })
      .map(r => r.temp)
      .filter(t => t !== null && typeof t !== 'undefined');

    if (!tempsForDay || tempsForDay.length === 0) {
      setHiLo({ hi: null, lo: null });
      return;
    }
    const hi = Math.max(...tempsForDay);
    const lo = Math.min(...tempsForDay);
    setHiLo({ hi: fmtTemp(hi), lo: fmtTemp(lo) });
  }, [hourlyData, lastUpdated]);

  // compute 'tonight' (min temp 18:00-23:59 of base date) and 'loNext' (min temp next calendar day)
  const [nightTemps, setNightTemps] = React.useState({ tonight: null, loNext: null });
  React.useEffect(() => {
    if (!Array.isArray(hourlyData) || hourlyData.length === 0 || !lastUpdated) {
      setNightTemps({ tonight: null, loNext: null });
      return;
    }

    const baseDate = new Date(lastUpdated);
    const baseYear = baseDate.getFullYear();
    const baseMonth = baseDate.getMonth();
    const baseDay = baseDate.getDate();

    const toLocal = (ts) => new Date(ts);

    // tonight window 18:00..23:59 of baseDate
    const tonightTemps = hourlyData
      .filter(r => {
        const ts = r.ts ?? r.created_at;
        if (!ts) return false;
        const d = toLocal(ts);
        return d.getFullYear() === baseYear && d.getMonth() === baseMonth && d.getDate() === baseDay && d.getHours() >= 18 && d.getHours() <= 23;
      })
      .map(r => r.temperature_c)
      .filter(t => t !== null && typeof t !== 'undefined');

    // next day (baseDate + 1) entire day min
    const nextDay = new Date(baseYear, baseMonth, baseDay + 1);
    const nextYear = nextDay.getFullYear();
    const nextMonth = nextDay.getMonth();
    const nextDayNum = nextDay.getDate();

    const nextDayTemps = hourlyData
      .filter(r => {
        const ts = r.ts ?? r.created_at;
        if (!ts) return false;
        const d = toLocal(ts);
        return d.getFullYear() === nextYear && d.getMonth() === nextMonth && d.getDate() === nextDayNum;
      })
      .map(r => r.temperature_c)
      .filter(t => t !== null && typeof t !== 'undefined');

    const tonight = (tonightTemps.length > 0) ? fmtTemp(Math.min(...tonightTemps)) : null;
    const loNext = (nextDayTemps.length > 0) ? fmtTemp(Math.min(...nextDayTemps)) : null;

    setNightTemps({ tonight, loNext });
  }, [hourlyData, lastUpdated]);

  // handler for select change
  const handleCityChange = (evt) => {
    const id = evt.target.value;
    setSelectedCity(id);

    queryClient.invalidateQueries({
      predicate: query => Array.isArray(query.queryKey) && query.queryKey[0] === 'hourly'
    });
  };

  // dynamic today date string
  const todayStr = new Date().toLocaleDateString();

  // get icon/bg/fg/smallFg for current selection and theme mode
  const { iconNode, bgColor, fgColor, smallFg } = timeOfDayIconAndColor(selectedLatest, mode);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
        <AppBar position="fixed" elevation={4}
          sx={{
            background: mode === "light" ? "linear-gradient(90deg,#1976d2 0%, #00acc1 100%)" : undefined,
            backdropFilter: "blur(8px)"
          }}>
          <Toolbar sx={{ minHeight: 72 }}>
            <IconButton edge="start" color="inherit" aria-label="menu" onClick={() => setOpen(true)} sx={{ mr: 2 }}>
              <MenuIcon />
            </IconButton>

            <Box sx={{ flexGrow: 1, textAlign: "center" }}>
              <Typography variant="h5" sx={{ fontWeight: 600 }}>ClimaStat Dashboard</Typography>
            </Box>

            {/* top-right controls: theme + city selector */}
            <Stack direction="row" spacing={2} alignItems="center">
              <WbSunnyIcon sx={{ opacity: mode === "light" ? 1 : 0.5 }} />
              <Switch checked={mode === "dark"} onChange={toggleMode} color="default" />
              <NightlightRoundIcon sx={{ opacity: mode === "dark" ? 1 : 0.5 }} />

              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel id="city-select-label" sx={{ color: 'inherit' }}>City</InputLabel>
                <Select
                  labelId="city-select-label"
                  value={selectedCity || ''}
                  label="City"
                  onChange={handleCityChange}
                  sx={{ color: 'inherit', '.MuiSelect-icon': { color: 'inherit' } }}
                >
                  <MenuItem value="">-- Select city --</MenuItem>
                  {Array.isArray(cities) && cities.map(c => (
                    <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Box sx={{ ml: 1 }}>
                <Button size="small" onClick={() => refetchCities()}>Refetch Cities</Button>
              </Box>
              <IconButton size="small" onClick={openInspector} title="Inspect selected JSON" disabled={!selectedCity} sx={{ ml: 1 }}>
                <CodeIcon />
              </IconButton>

            </Stack>
          </Toolbar>
        </AppBar>

        <Drawer anchor="left" open={open} onClose={() => setOpen(false)}>
          <Box sx={{ width: 260 }} role="presentation">
            <Box sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
              <Avatar sx={{ bgcolor: 'primary.main' }}>C</Avatar>
              <Box>
                <Typography variant="subtitle1">ClimaStat</Typography>
                <Typography variant="caption" color="text.secondary">Weather & AQI</Typography>
              </Box>
            </Box>
            <Divider />
            <List>
              <ListItem button><ListItemText primary="Cities" /></ListItem>
              <ListItem button><ListItemText primary="Settings" /></ListItem>
              <ListItem button><ListItemText primary="About" /></ListItem>
            </List>
          </Box>
        </Drawer>

        <Box component="main" sx={{ flexGrow: 1, px: { xs: 2, sm: 3, md: 4 }, py: 4, mt: 2 }}>
          <Toolbar />
          <Container maxWidth="xl">
            <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: "0.3px", mb: 1 }}>Dashboard Overview</Typography>
            <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 300, mb: 3 }}>
              Weather & air quality insights — updated hourly.
            </Typography>

            {/* TOP: left small stacked cards + right main chart */}
            <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start', flexDirection: { xs: 'column', md: 'row' }, mb: 3 }}>
              <Box sx={{ flex: { xs: '1 1 100%', md: '0 0 33.3333%' }, maxWidth: { md: '33.3333%' }, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {/* highlight card: dynamic date + tonight/lo computed */}
                {/* KPI CARD 1 */}
                <Paper elevation={3} sx={{ p: 2, borderRadius: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="overline" color="text.secondary">TODAY'S WEATHER</Typography>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{todayStr}</Typography>
                  </Box>

                  <Box sx={{ mt: 2 }}>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
                      {/* small transparent avatar — use smallFg so icon contrasts properly in both themes */}
                      <Avatar sx={{ bgcolor: 'transparent', color: smallFg }}>
                        {iconNode}
                      </Avatar>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        {selectedLatest?.weather_description ?? ''}
                        <span style={{ fontWeight: 900 }}> {kpiTemp ? kpiTemp : ''}</span>
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                      <Box sx={{ width: 20 }} />
                      <Typography variant="body2" color="text.secondary">
                        Tonight: {nightTemps.tonight ?? '—'} • Lo: {nightTemps.loNext ?? '—'}
                      </Typography>
                    </Box>
                  </Box>
                </Paper>

                {/* KPI CARD 2 */}
                {/* current weather card — show the large temperature and Feels like; NO hi/lo here */}
                <Paper elevation={3} sx={{ p: 2, borderRadius: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
                  {/* big avatar uses bgColor + fgColor so icon contrasts in both themes */}
                  <Avatar sx={{ bgcolor: bgColor, width: 72, height: 72, color: fgColor }}>
                    {iconNode}
                  </Avatar>

                  <Box sx={{ flex: 1 }}>
                    <Typography variant="overline" color="text.secondary">CURRENT WEATHER</Typography>

                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                      <Typography variant="h4" sx={{ fontWeight: 800 }}>
                        {kpiTemp ?? '--'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {kpiFeels ? `Feels like ${kpiFeels}` : ''}
                      </Typography>
                    </Box>

                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {selectedLatest?.weather_description ?? ''}
                    </Typography>

                    <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
                      <Chip icon={<OpacityIcon />} label={`Humidity ${kpiHumidity ?? '—'}`} size="small" />
                      <Chip icon={<SpeedIcon />} label={`Wind ${kpiWind ?? '—'}`} size="small" />
                      <Chip icon={<ReportProblemIcon />} label={`AQI ${kpiAqi ?? '—'}`} size="small" />
                    </Stack>
                  </Box>
                </Paper>
              </Box>

              {/* right main chart 2/3 */}
              <Box sx={{ flex: { xs: '1 1 100%', md: '0 0 66.6667%' }, maxWidth: { md: '66.6667%' }, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Paper elevation={3} sx={{ borderRadius: 2, overflow: 'hidden', minHeight: 460 }}>
                  <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6">Main Chart</Typography>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                      <Typography variant="caption" color="text.secondary">{lastUpdated ? `Last: ${new Date(lastUpdated).toLocaleString()}` : ''}</Typography>
                      <Button variant="contained" onClick={handleRefresh} disabled={refreshing || !selectedCity}>
                        {refreshing ? 'Refreshing...' : 'Refresh City'}
                      </Button>
                    </Box>
                  </Box>

                  <Box sx={{ width: '100%', height: { xs: 360, md: 420 } }}>
                    <AqiChart
                      key={selectedCity || 'none'}
                      data={hourlyData}
                      loading={hourlyLoading}
                      height={420}
                    />
                  </Box>
                </Paper>
              </Box>
            </Box>

            {/* More charts strip */}
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Paper elevation={1} sx={{ borderRadius: 2, p: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary" align="center">More charts</Typography>
                  <Box sx={{ mt: 2, display: 'flex', gap: 2, overflowX: 'auto', py: 1 }}>
                    <Box sx={{ minWidth: 260, height: 140, borderRadius: 1.5, bgcolor: 'background.paper', boxShadow: 1 }} />
                    <Box sx={{ minWidth: 260, height: 140, borderRadius: 1.5, bgcolor: 'background.paper', boxShadow: 1 }} />
                    <Box sx={{ minWidth: 260, height: 140, borderRadius: 1.5, bgcolor: 'background.paper', boxShadow: 1 }} />
                    <Box sx={{ minWidth: 260, height: 140, borderRadius: 1.5, bgcolor: 'background.paper', boxShadow: 1 }} />
                  </Box>
                </Paper>
              </Grid>
            </Grid>
          </Container>
        </Box>
      </Box>

      <Dialog fullWidth maxWidth="md" open={inspectOpen} onClose={closeInspector}>
        <DialogTitle>Inspect data for city {selectedCity || '(none selected)'}</DialogTitle>
        <DialogContent dividers>
          <Typography variant="subtitle2">selectedLatest</Typography>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#0b1220', color: '#e6eef6', padding: 12, borderRadius: 6 }}>
            {JSON.stringify(selectedLatest ?? 'null', null, 2)}
          </pre>

          <Typography variant="subtitle2" sx={{ mt: 2 }}>hourlyData (first 10 rows)</Typography>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#0b1220', color: '#e6eef6', padding: 12, borderRadius: 6 }}>
            {JSON.stringify((hourlyData || []).slice(0, 10), null, 2)}
          </pre>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeInspector}>Close</Button>
        </DialogActions>
      </Dialog>

    </ThemeProvider>
  );
}
