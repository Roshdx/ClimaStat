import React from 'react';
import {
  ThemeProvider,
  createTheme,
  responsiveFontSizes,
  useTheme
} from '@mui/material/styles';
import CountUp from 'react-countup';
import AqiChart from './components/charts/AqiChart';

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
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import BoxIcon from '@mui/icons-material/Widgets';
import NightlightRoundIcon from '@mui/icons-material/NightlightRound';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import AirIcon from '@mui/icons-material/Air';
import OpacityIcon from '@mui/icons-material/Opacity';
import SpeedIcon from '@mui/icons-material/Speed';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
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
      primary: { main: '#1976d2' },        // still MUI blue
      secondary: { main: '#00acc1' },      // teal-ish secondary
      background: {
        default: mode === 'light' ? '#f7fbff' : '#0f1720', // soft default bg
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

function KPI({ title, value, suffix, color }) {
  // value may be string; ensure numeric for CountUp
  const numeric = Number(String(value).replace(/[^\d.-]/g, '')) || 0;

  return (
    <Paper
      elevation={3}
      sx={{
        p: 2,
        borderRadius: 3,
        background: (theme) =>
          theme.palette.mode === 'light'
            ? 'rgba(255, 255, 255, 0.9)'
            : 'rgba(255, 255, 255, 0.03)',
        backdropFilter: 'blur(6px)',
        transition: 'transform 160ms ease, box-shadow 160ms ease',
        '&:hover': {
          transform: 'translateY(-6px)',
          boxShadow: (theme) => theme.shadows[8]
        },
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography variant="subtitle2" color="text.secondary">
            {title}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              <CountUp end={numeric} duration={1.2} separator="," decimals={numeric % 1 ? 1 : 0} />
            </Typography>
            {suffix ? (
              <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 0.5 }}>
                {suffix}
              </Typography>
            ) : null}
          </Box>
        </Box>

        <Avatar sx={{ bgcolor: color || 'primary.main' }}>
          <BoxIcon />
        </Avatar>
      </Stack>
    </Paper>
  );
}

export default function App() {
  const [open, setOpen] = React.useState(false);
  const [mode, toggleMode] = useMode('light');
  const theme = React.useMemo(() => createAppTheme(mode), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
        <AppBar
          position="fixed"
          elevation={4}
          sx={{
            background:
              mode === "light"
                ? "linear-gradient(90deg, #1976d2 0%, #00acc1 100%)"
                : undefined,
            backdropFilter: "blur(8px)",
            borderBottom: "1px solid rgba(255,255,255,0.1)"
          }}
        >
          <Toolbar sx={{ minHeight: 72 }}>
            {/* LEFT: menu button */}
            <IconButton
              edge="start"
              color="inherit"
              aria-label="menu"
              onClick={() => setOpen(true)}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>

            {/* CENTERED TITLE */}
            <Box sx={{ flexGrow: 1, textAlign: "center" }}>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 600,
                  letterSpacing: "0.5px"
                }}
              >
                ClimaStat Dashboard
              </Typography>
            </Box>

            {/* RIGHT CONTROLS */}
            <Stack direction="row" spacing={2} alignItems="center">
              <Stack direction="row" spacing={1} alignItems="center">
                <WbSunnyIcon sx={{ opacity: mode === "light" ? 1 : 0.5 }} />
                <Switch checked={mode === "dark"} onChange={toggleMode} color="default" />
                <NightlightRoundIcon sx={{ opacity: mode === "dark" ? 1 : 0.5 }} />
              </Stack>
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
              <ListItem button>
                <ListItemText primary="Cities" />
              </ListItem>
              <ListItem button>
                <ListItemText primary="Settings" />
              </ListItem>
              <ListItem button>
                <ListItemText primary="About" />
              </ListItem>
            </List>
          </Box>
        </Drawer>

        <Box
          component="main"
          sx={{
            flexGrow: 1,
            px: { xs: 2, sm: 3, md: 4 },
            py: 4,                // more breathing room
            mt: 2,                // pushes content down slightly
          }}
          >
          <Toolbar />
          <Container maxWidth="xl">
            <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              letterSpacing: "0.3px",
              mb: 1,
            }}
          >
            Dashboard Overview
          </Typography>


          <Typography
            variant="h6"
            color="text.secondary"
            sx={{ fontWeight: 300, mb: 3 }}
          >
            Weather & air quality insights — updated hourly.
          </Typography>

{/* ---------- REPLACE TOP TWO-COLUMN AREA WITH FLEX (stable 1/3 - 2/3) ---------- */}
<Box
  sx={{
    display: 'flex',
    gap: 3,
    alignItems: 'flex-start',
    flexDirection: { xs: 'column', md: 'row' }, // stack on small screens
    mb: 3
  }}
>
  {/* LEFT COLUMN: fixed 1/3 on md+, full width on xs */}
  <Box
    sx={{
      flex: { xs: '1 1 100%', md: '0 0 33.3333%' },
      maxWidth: { xs: '100%', md: '33.3333%' },
      display: 'flex',
      flexDirection: 'column',
      gap: 3
    }}
  >
    {/* Small highlight card */}
    <Paper elevation={3} sx={{ p: 2, borderRadius: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="overline" color="text.secondary">TODAY'S WEATHER</Typography>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>SUN, NOV 16</Typography>
      </Box>

      <Box sx={{ mt: 2 }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
          <Avatar sx={{ bgcolor: 'transparent', color: '#ffb74d' }}><WbSunnyIcon /></Avatar>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Plenty of sun <span style={{ fontWeight: 900 }}>Hi: 35°</span></Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
          <Box sx={{ width: 20 }} />
          <Typography variant="body2" color="text.secondary">
            Tonight: Hazy; air quality will be very unhealthy • Lo: 19°
          </Typography>
        </Box>
      </Box>
    </Paper>

    {/* Compact current weather card */}
    <Paper elevation={3} sx={{ p: 2, borderRadius: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
      <Avatar sx={{ bgcolor: '#ffb74d', width: 72, height: 72 }}>
        <WbSunnyIcon sx={{ fontSize: 34 }} />
      </Avatar>

      <Box sx={{ flex: 1 }}>
        <Typography variant="overline" color="text.secondary">CURRENT WEATHER</Typography>

        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>32°</Typography>
          <Typography variant="body2" color="text.secondary">RealFeel 34°</Typography>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Sunny</Typography>

        <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
          <Chip icon={<OpacityIcon />} label="Humidity 67%" size="small" />
          <Chip icon={<SpeedIcon />} label="Wind 11 km/h" size="small" />
          <Chip icon={<ReportProblemIcon />} label="UV Low" size="small" />
        </Stack>
      </Box>
    </Paper>
  </Box>

  {/* RIGHT COLUMN: fixed 2/3 on md+, full width on xs */}
  <Box
    sx={{
      flex: { xs: '1 1 100%', md: '0 0 66.6667%' },
      maxWidth: { xs: '100%', md: '66.6667%' },
      display: 'flex',
      flexDirection: 'column',
      gap: 3
    }}
  >
    <Paper elevation={3} sx={{ borderRadius: 2, overflow: 'hidden', minHeight: 460 }}>
      <Box sx={{ p: 2 }}>
        <Typography variant="h6">Main Chart</Typography>
      </Box>

      <Box sx={{ width: '100%', height: { xs: 360, md: 420 } }}>
        <AqiChart hours={96} height={420} />
      </Box>
    </Paper>
  </Box>
</Box>

{/* More charts strip — unchanged */}
<Grid item xs={12} sx={{ mt: 3 }}>
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
{/* --------------------------------------------------------------------------- */}



          </Container>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
