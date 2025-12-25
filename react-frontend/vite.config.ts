import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1', // Use IPv4 instead of IPv6
    port: 5174,
    strictPort: false, // Try other ports if 5174 is busy
  },
})
