import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the build works both locally and under /color-flocking/ on GitHub Pages.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5173 },
});
