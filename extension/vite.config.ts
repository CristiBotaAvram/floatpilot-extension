import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
    root: __dirname,
    plugins: [react()],
    build: {
        outDir: '../dist',
        emptyOutDir: false,
        rollupOptions: {
            /* -------------------------------------------------- */
            /* ENTRY POINTS                                       */
            /* -------------------------------------------------- */
            input: {
                // Popup UI (React)
                popup: resolve(__dirname, 'public/popup.html'),

                /* ------------  Content‑scripts  ------------ */
                'content-scripts/searchContent': resolve(__dirname, 'src/content-scripts/searchContent.ts'),
                'content-scripts/itemContent': resolve(__dirname, 'src/content-scripts/itemContent.ts'),
                'content-scripts/injectStyle': resolve(__dirname, 'src/content-scripts/injectStyle.ts'),
                'content-scripts/skinportContent': resolve(__dirname, 'src/content-scripts/skinportContent.ts'),
                'content-scripts/searchFilter': resolve(__dirname, 'src/content-scripts/searchFilter.ts'),
                'content-scripts/priceDiff': resolve(__dirname, 'src/content-scripts/priceDiff.ts'),
            },

            /* -------------------------------------------------- */
            /* OUTPUT NAMES                                       */
            /* -------------------------------------------------- */
            output: {
                entryFileNames: (chunk) => {
                    switch (chunk.name) {
                        /* ---- content‑scripts ---- */
                        case 'content-scripts/searchContent':
                            return 'src/content-scripts/searchContent.js';
                        case 'content-scripts/itemContent':
                            return 'src/content-scripts/itemContent.js';
                        case 'content-scripts/skinportContent':
                            return 'src/content-scripts/skinportContent.js';
                        case 'content-scripts/searchFilter':
                            return 'src/content-scripts/searchFilter.js';
                        case 'content-scripts/injectStyle':
                            return 'src/content-scripts/injectStyle.js';
                        case 'content-scripts/priceDiff':
                            return 'src/content-scripts/priceDiff.js';

                        /* ---- background worker ---- */
                        case 'background/sw':
                            return 'src/background/sw.js';


                        /* ---- fallback ---- */
                        default:
                            return '[name].js';
                    }
                },
            },
        },
    },
});
