import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  preview: { headers: { 'X-Robots-Tag': 'noindex, nofollow, noarchive' } },
  server: {
    headers: { 'X-Robots-Tag': 'noindex, nofollow, noarchive' },
    port: 5177,
    strictPort: true,
  },
})
