import { defineConfig } from 'vite';

// Static build with relative paths so it runs from GitHub Pages or any subfolder.
export default defineConfig( {
	base: './',
	build: { target: 'esnext', outDir: 'dist', chunkSizeWarningLimit: 2000 },
	server: { port: 5178, strictPort: true }
} );
