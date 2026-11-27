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
    // Strip DevToolsModal, 5-tap secret backdoor, __capyDev & debug logs from production mini-game bundles.
    __ENABLE_DEV_TOOLS__: JSON.stringify(process.env.VITE_ENABLE_DEVTOOLS === '1'),
    // WeChat Mini Game ships Chinese-only (removes English switcher, English dictionaries & English title/button sprites).
    __ENABLE_ENGLISH__: JSON.stringify(target !== 'wx'),
    // Prevent Web `.env.production` Cloudflare workers.dev URL from leaking into WeChat/Bilibili bundles.
    'import.meta.env.VITE_LEADERBOARD_API_URL': JSON.stringify(process.env.VITE_MINIGAME_LEADERBOARD_URL ?? ''),
    'import.meta.env.VITE_MINIGAME_LEADERBOARD_URL': JSON.stringify(process.env.VITE_MINIGAME_LEADERBOARD_URL ?? ''),
  },
});
