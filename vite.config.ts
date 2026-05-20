import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    host: 'localhost',
    port: 5180,
    strictPort: true,
  },
  preview: {
    host: 'localhost',
    port: 5180,
    strictPort: true,
  },
})
