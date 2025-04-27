import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import {resolve} from 'path'

export default defineConfig({
    plugins: [react()],
    build: {
        rollupOptions: {
            input: {
                popup: resolve(__dirname, 'index.html'),
                grabListings: resolve(__dirname, 'src/content-scripts/grabListings.ts'),
                background: resolve(__dirname, 'src/background/background.ts'),
                'content-scripts/skinportContent': resolve(__dirname, 'src/content-scripts/skinportContent.ts'),
            },
            output: {
                entryFileNames: (chunkInfo) => {
                    if (chunkInfo.name === 'grabListings') {
                        return 'src/content-scripts/grabListings.js';
                    }
                    if (chunkInfo.name === 'background') {
                        return 'src/background/background.js';
                    }
                    if (chunkInfo.name === 'content-scripts/skinportContent') {
                        return 'src/content-scripts/skinportContent.js';
                    }
                    return '[name].js';
                }
            }
        },
        outDir: 'dist',
    }
})