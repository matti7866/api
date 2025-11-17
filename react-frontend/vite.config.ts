import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: 'localhost', // Use localhost to match PHP backend for cookie sharing
    port: 5174,
    strictPort: false, // Try other ports if 5174 is busy
    proxy: {
      '/api': {
        target: 'http://localhost/snt',
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: 'localhost',
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
        },
      },
    },
  },
})
