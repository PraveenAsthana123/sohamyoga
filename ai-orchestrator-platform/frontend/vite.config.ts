import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Fixed, non-conflicting port for this project (confirmed free before use —
// see the build report). Backend is at 127.0.0.1:8100.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 8101,
    strictPort: true,
  },
})
