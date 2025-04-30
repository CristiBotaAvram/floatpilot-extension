import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

/**
 * Vite configuration for the FloatPilot browser‑extension build.
 *
 * Folder layout (after split):
 *   /extension  ← this config lives here (root)
 *     ├─ public/popup.html  +  popup.js (vanilla popup)
 *     ├─ src/background/...
 *     ├─ src/content-scripts/...
 *     └─ vite.config.ts (this file)
 *
 * Key points:
 * • `root` is set to the directory of this file so all paths resolve from /extension.
 * • `popup.html` in /public is treated as an HTML entry so it’s copied verbatim (with popup.js).
 * • React plugin kept for any React‑based scripts.
 * • Output JS files are renamed to match paths referenced by manifest.json.
 */
export default defineConfig({
    root: __dirname, // everything is relative to /extension
    plugins: [react()],
    build: {
        outDir: '../dist',       // final build goes to project/dist (one level up)
        emptyOutDir: false,      // keep static assets/manifest handled by other tooling
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
                            return '[name].js'; // popup.js lives alongside popup.html in /public
                    }
                },
            },
        },
    },
});
