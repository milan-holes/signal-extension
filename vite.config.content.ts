import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

// Separate build config for the content script.
// Content scripts are injected into web pages and CANNOT use ES module imports.
// This config builds everything into a single IIFE bundle.
export default defineConfig({
    plugins: [vue(), tailwindcss()],
    define: {
        // Vite lib mode does NOT auto-replace process.env.NODE_ENV like app mode.
        // Without this, Vue's runtime includes `process.env.NODE_ENV` checks
        // that crash in browser context ("process is not defined").
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
            entry: resolve(__dirname, 'src/content/index.ts'),
            name: 'SignalContent',
            formats: ['iife'],
            fileName: () => 'content.js',
        },
        rollupOptions: {
            output: {
                inlineDynamicImports: true,
                assetFileNames: (assetInfo) => {
                    if (assetInfo.names?.some(n => n.endsWith('.css'))) {
                        return 'content.css';
                    }
                    return 'assets/[name]-[hash][extname]';
                },
            },
        },
        cssCodeSplit: false,
    },
    publicDir: false,
});
