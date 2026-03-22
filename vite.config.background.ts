import { defineConfig } from 'vite';
import { resolve } from 'path';

// Build config for the background service worker.
// MV3 service workers must be a single JS file — built as IIFE.
export default defineConfig({
    define: {
        'process.env.NODE_ENV': JSON.stringify('production'),
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
        },
    },
    build: {
        outDir: 'dist',
        emptyOutDir: false,
        target: 'chrome120',
        lib: {
            entry: resolve(__dirname, 'src/background/index.ts'),
            name: 'SignalBackground',
            formats: ['iife'],
            fileName: () => 'background.js',
        },
        rollupOptions: {
            output: {
                inlineDynamicImports: true,
            },
        },
    },
    publicDir: false,
});
