import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

/**
 * Vite configuration for the FloatPilot browser‑extension build.
 *
 * • Keeps React plugin for content/background scripts that still use React/TS.
 * • Uses `popup.html` as the HTML entry (no React root, plain vanilla popup).
 * • Outputs compiled JS to the exact paths expected by the manifest.
 */
export default defineConfig({
    plugins: [react()],
    build: {
        outDir: 'dist',          // extension build folder
        emptyOutDir: false,      // keep static assets / manifest written by other plugins
        rollupOptions: {
            input: {
                popup: resolve(__dirname, 'public/popup.html'),
                grabListings: resolve(__dirname, 'src/content-scripts/grabListings.ts'),
                background: resolve(__dirname, 'src/background/background.ts'),
                'content-scripts/skinportContent': resolve(__dirname, 'src/content-scripts/skinportContent.ts'),
            },
            output: {
                entryFileNames: (chunkInfo) => {
                    switch (chunkInfo.name) {
                        case 'grabListings':
                            return 'src/content-scripts/grabListings.js';
                        case 'background':
                            return 'src/background/background.js';
                        case 'content-scripts/skinportContent':
                            return 'src/content-scripts/skinportContent.js';
                        default:
                            return '[name].js';     // e.g. popup.js -> stays alongside popup.html
                    }
                },
            },
        },
    },
});
