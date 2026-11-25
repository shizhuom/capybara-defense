import { defineConfig } from 'vite';

const target = process.env.MINIGAME_TARGET === 'bl' ? 'bl' : 'wx';
const outDir = target === 'bl' ? 'dist-bl' : 'dist-wx';

export default defineConfig({
  base: './',
  publicDir: false,
  build: {
    outDir,
    emptyOutDir: true,
    target: 'es2017',
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
    // Prevent Web `.env.production` Cloudflare workers.dev URL from leaking into WeChat/Bilibili bundles.
    'import.meta.env.VITE_LEADERBOARD_API_URL': JSON.stringify(process.env.VITE_MINIGAME_LEADERBOARD_URL ?? ''),
    'import.meta.env.VITE_MINIGAME_LEADERBOARD_URL': JSON.stringify(process.env.VITE_MINIGAME_LEADERBOARD_URL ?? ''),
  },
});
