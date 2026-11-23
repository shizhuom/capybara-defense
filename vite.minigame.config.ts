import { defineConfig } from 'vite';

const target = process.env.MINIGAME_TARGET === 'bl' ? 'bl' : 'wx';
const outDir = target === 'bl' ? 'dist-bl' : 'dist-wx';

export default defineConfig({
  base: './',
  publicDir: false,
  build: {
    outDir,
    emptyOutDir: true,
    target: 'es2020',
    minify: true,
    lib: {
      entry: 'src/minigame/entry.ts',
      name: 'CapybaraMiniGame',
      formats: ['iife'],
      fileName: () => 'game.js',
    },
  },
  define: {
    'import.meta.env.BASE_URL': JSON.stringify('./'),
  },
});
