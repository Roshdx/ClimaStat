// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,          // already using --host but keep here too
    port: 5173,
    watch: {
      usePolling: true,
      interval: 1000,
    },
    hmr: {
      // usually default is fine; you can explicitly set host/port if needed:
      // host: 'localhost',
      // port: 5173,
    }
  }
});
