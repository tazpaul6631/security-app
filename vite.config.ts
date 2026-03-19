/// <reference types="vitest" />

import legacy from '@vitejs/plugin-legacy'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    vue(),
    legacy()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom'
  },
  // server: {
  //   host: '0.0.0.0', // Dùng 0.0.0.0 để linh hoạt hơn IP tĩnh
  //   port: 8100,
  //   // THÊM ĐOẠN NÀY: Giúp HMR hoạt động ổn định qua mạng Wifi
  //   hmr: {
  //     host: '10.0.149.28',
  //     port: 8100
  //   }
  // },
  // THÊM ĐOẠN NÀY: Tối ưu build cho mobile
  build: {
    chunkSizeWarningLimit: 2000,
    cssCodeSplit: true,
    sourcemap: false, // Tắt để build nhanh hơn và nhẹ hơn
  }
})
