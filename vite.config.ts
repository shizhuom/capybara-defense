import { defineConfig } from 'vitest/config';
import { audioManifestPlugin } from './scripts/audio-manifest.ts';
export default defineConfig({
  base: './',
  define: {
    __ENABLE_DEV_TOOLS__: true,
    __ENABLE_ENGLISH__: true,
  },
  plugins: [audioManifestPlugin()],
  server: { host: '127.0.0.1', port: 4175, strictPort: true, watch: { ignored: ['**/.runtime/**', '**/verification/**', '**/backups/**'] } },
  preview: { host: '127.0.0.1', port: 4175, strictPort: true },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
