import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // <--- Añades esta línea

export default defineConfig({
  plugins: [react(), tailwindcss()], // <--- Añades tailwindcss() aquí
})