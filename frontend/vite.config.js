import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Return '/index.html' for browser page navigations so React Router handles routing.
// API calls (fetch) send Accept: */* and won't match, so they proxy normally.
function spaBypass(req) {
  if (req.method === 'GET' && req.headers.accept?.includes('text/html')) {
    return '/index.html'
  }
}

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/auth':         { target: 'http://localhost:8000', changeOrigin: true },
      '/upload':       { target: 'http://localhost:8000', changeOrigin: true },
      '/uploads':      { target: 'http://localhost:8000', changeOrigin: true },
      '/reception':    { target: 'http://localhost:8000', changeOrigin: true, bypass: spaBypass },
      '/housekeeping': { target: 'http://localhost:8000', changeOrigin: true, bypass: spaBypass },
      '/room-service': { target: 'http://localhost:8000', changeOrigin: true, bypass: spaBypass },
      '/maintenance':  { target: 'http://localhost:8000', changeOrigin: true, bypass: spaBypass },
      '/kitchen':      { target: 'http://localhost:8000', changeOrigin: true, bypass: spaBypass },
      '/problems':     { target: 'http://localhost:8000', changeOrigin: true, bypass: spaBypass },
      '/dashboard':    { target: 'http://localhost:8000', changeOrigin: true, ws: true },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
