/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/taskboard-lite/',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // 이 패키지는 내부 import 에 확장자가 없어 Node ESM 으로는 못 읽는다.
    // Vite 를 태워 처리한다 (앱 번들은 문제없음).
    server: { deps: { inline: ['@material/material-color-utilities'] } },
  },
})
