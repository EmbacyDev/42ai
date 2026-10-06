import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Своя страница на своём порту, чтобы лёгкая сборка и полный
    // редактор могли работать одновременно.
    port: Number(process.env.PORT) || 5176,
  },
})
