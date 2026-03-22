import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
    plugins: [vue(), tailwindcss()],
    base: '',
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
        },
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        target: 'chrome120',
        rollupOptions: {
            input: {
                popup: resolve(__dirname, 'src/popup/index.html'),
                editor: resolve(__dirname, 'src/screenshot-editor/index.html'),
                viewer: resolve(__dirname, 'src/viewer/index.html'),
            },
            output: {
                entryFileNames: 'assets/[name]-[hash].js',
                chunkFileNames: 'assets/[name]-[hash].js',
                assetFileNames: 'assets/[name]-[hash][extname]',
            },
        },
    },
    publicDir: 'public',
});
