import { defineConfig } from 'vite';

export default defineConfig({
  // Relative paths so the built site works from a subdirectory. start.ng serves
  // the game from a path, not always the domain root — absolute "/assets/..."
  // URLs would 404 there.
  base: './',
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        // Three.js is the bulk of the download; splitting it out lets the host
        // cache it separately from the game code.
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
});
