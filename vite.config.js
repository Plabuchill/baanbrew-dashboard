import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    // โฟลเดอร์ lab*-starter / lab3-student-pack เป็นชุดต้นฉบับของแต่ละ lab ไม่ต้องรัน test ซ้ำ
    exclude: [...configDefaults.exclude, 'lab1-starter/**', 'lab2.1-colab/**', 'lab3-student-pack/**'],
  },
})
