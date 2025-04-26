import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'index.html'),
        grabListings: resolve(__dirname, 'src/content-scripts/grabListings.ts'),
        background: resolve(__dirname, 'src/background/background.ts')
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'grabListings') {
            return 'content-scripts/grabListings.js'
          }
          if (chunkInfo.name === 'background') {
            return 'background/background.js'
          }
          return '[name].js'
        }
      }
    },
    outDir: 'dist'
  }
})
