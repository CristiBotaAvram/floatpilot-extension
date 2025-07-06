import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
    root: __dirname,
    plugins: [
        react(),
        viteStaticCopy({
            targets: [
                {
                    src: 'src/offscreen/offscreen.html',
                    dest: 'offscreen'
                }
            ]
        })],
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
                offscreen: resolve(__dirname, 'public/offscreen.html'),

                /* ------------  Content‑scripts  ------------ */
                'content-scripts/injectStyle': resolve(__dirname, 'src/content-scripts/injectStyle.ts'),
                'content-scripts/searchFilter': resolve(__dirname, 'src/content-scripts/searchFilter.ts'),
                'content-scripts/priceDiff': resolve(__dirname, 'src/content-scripts/priceDiff.ts'),
                'content-scripts/listingEstimation': resolve(__dirname, 'src/content-scripts/listingEstimation.ts'),
                'content-scripts/profitEvaluator': resolve(__dirname, 'src/content-scripts/profitEvaluator.ts'),
                'content-scripts/refreshButton': resolve(__dirname, 'src/content-scripts/refreshButton.ts'),
                'content-scripts/floatHighlighter': resolve(__dirname, 'src/content-scripts/floatHighlighter.ts'),

                /* ------------  Background + Offscreen  ------------ */
                'background/sw': resolve(__dirname, 'src/background/sw.ts'),
                'offscreen/offscreen': resolve(__dirname, 'src/offscreen/offscreen.ts'), // <- Offscreen added here

                'injected/fetch-intercept.js': resolve(__dirname, 'injected/fetch-intercept.js'),
                'inject-loader.js': resolve(__dirname, 'inject-loader.js'),
            },

            /* -------------------------------------------------- */
            /* OUTPUT NAMES                                       */
            /* -------------------------------------------------- */
            output: {
                entryFileNames: (chunk) => {
                    switch (chunk.name) {
                        /* ---- content‑scripts ---- */
                        case 'content-scripts/searchFilter':
                            return 'src/content-scripts/searchFilter.js';
                        case 'content-scripts/injectStyle':
                            return 'src/content-scripts/injectStyle.js';
                        case 'content-scripts/priceDiff':
                            return 'src/content-scripts/priceDiff.js';
                        case 'content-scripts/listingEstimation':
                            return 'src/content-scripts/listingEstimation.js';
                        case 'content-scripts/profitEvaluator':
                            return 'src/content-scripts/profitEvaluator.js';
                        case 'content-scripts/refreshButton':
                            return 'src/content-scripts/refreshButton.js';
                        case 'content-scripts/floatHighlighter':
                            return 'src/content-scripts/floatHighlighter.js';
                        case 'injected/fetch-intercept.js':
                            return 'injected/fetch-intercept.js';
                        case 'inject-loader.js':
                            return 'inject-loader.js';
                        case 'offscreen':
                            return 'offscreen.html';


                        /* ---- background worker ---- */
                        case 'background/sw':
                            return 'src/background/sw.js';

                        /* ---- offscreen ---- */
                        case 'offscreen/offscreen':
                            return 'offscreen/offscreen.js';

                        /* ---- fallback ---- */
                        default:
                            return '[name].js';
                    }
                },
            },
        },
    },
});
