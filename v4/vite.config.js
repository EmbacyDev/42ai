import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Keep v2 on its own local address so the original prototype can stay
    // open for side-by-side comparison.
    port: 5182,
    strictPort: true,
  },
})
