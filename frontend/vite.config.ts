import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts')) return 'vendor-recharts';
            if (id.includes('lucide-react')) return 'vendor-lucide';
            if (id.includes('leaflet') || id.includes('react-leaflet')) return 'vendor-leaflet';
            return 'vendor';
          }
        },
      },
    },
  },
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
