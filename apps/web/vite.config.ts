/// <reference types="vitest/config" />

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? process.env.VITE_APP_BASE_PATH ?? '/' : '/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
}))
