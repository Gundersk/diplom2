// Сборка фронтенда: Vue 3, dev-сервер на localhost:5180, emoji-picker как custom element.
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag === 'emoji-picker',
        },
      },
    }),
  ],
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
