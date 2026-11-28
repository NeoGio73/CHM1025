import { defineConfig } from 'vite';

// Static build with relative paths so it runs from GitHub Pages or any subfolder (same as Daughter).
export default defineConfig( {
	base: './',
	build: { target: 'esnext', outDir: 'dist', chunkSizeWarningLimit: 2000, copyPublicDir: false }, // models and textures load from ../game/public in the published copy (config.js ASSETS)
	server: { port: 5181, strictPort: true }
} );
