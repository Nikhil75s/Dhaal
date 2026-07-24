import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/catalyst': {
        target: 'https://dhaal-60077679458.development.catalystserverless.in',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/catalyst/, ''),
      },
    },
  },
})
