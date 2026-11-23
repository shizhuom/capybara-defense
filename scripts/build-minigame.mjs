import { execSync } from 'node:child_process';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMinigameAssets } from './build-minigame-assets.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv.find(a => a.startsWith('--target='))?.slice(9) === 'bl' ? 'bl' : 'wx';
const outDirName = target === 'bl' ? 'dist-bl' : 'dist-wx';
const outDir = join(ROOT, outDirName);

// Preserve existing project.config.json (especially user's registered AppID & DevTools settings) before Vite clears outDir.
const projectConfigPath = join(outDir, 'project.config.json');
let existingProjectConfig = null;
if (existsSync(projectConfigPath)) {
  try {
    existingProjectConfig = JSON.parse(readFileSync(projectConfigPath, 'utf8'));
  } catch {
    existingProjectConfig = null;
  }
}

execSync('npx vite build --config vite.minigame.config.ts', {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, MINIGAME_TARGET: target },
});

const assetsSummary = await buildMinigameAssets(outDir);

const gameJson = {
  deviceOrientation: 'landscape',
  showStatusBar: false,
  networkTimeout: { request: 10000, downloadFile: 15000 },
  subpackages: [
    { name: 'maps', root: 'subpackages/maps' },
    { name: 'meta', root: 'subpackages/meta' },
  ],
};
writeFileSync(join(outDir, 'game.json'), `${JSON.stringify(gameJson, null, 2)}\n`);

const envAppid = target === 'bl' ? process.env.BL_APPID : process.env.WX_APPID;
const prevAppid = typeof existingProjectConfig?.appid === 'string' && existingProjectConfig.appid !== 'touristappid'
  ? existingProjectConfig.appid
  : '';
const appid = envAppid || prevAppid || '';

const projectConfig = {
  ...(existingProjectConfig && typeof existingProjectConfig === 'object' ? existingProjectConfig : {}),
  description: 'Capybara Chill Defense Mini-Game Build',
  setting: {
    ...(existingProjectConfig?.setting && typeof existingProjectConfig.setting === 'object' ? existingProjectConfig.setting : {}),
    urlCheck: existingProjectConfig?.setting?.urlCheck ?? true,
    es6: false,
    enhance: false,
    postcss: false,
    // Vite already transpiles (ES2017) & minifies game.js; keep DevTools UglifyJS off so Preview/Upload never re-parses it.
    minified: false,
    newFeature: true,
  },
  compileType: 'game',
  appid,
  projectname: target === 'bl' ? 'capybara-defense-bl' : 'capybara-defense-wx',
  condition: existingProjectConfig?.condition ?? {},
};
writeFileSync(projectConfigPath, `${JSON.stringify(projectConfig, null, 2)}\n`);

const jsBytes = statSync(join(outDir, 'game.js')).size;
const mainTotalBytes = jsBytes + assetsSummary.sizes.main;
const totalBytes = mainTotalBytes + assetsSummary.sizes.maps + assetsSummary.sizes.meta;
const mb = n => `${(n / (1024 * 1024)).toFixed(2)} MB`;

console.log(`\n[${target.toUpperCase()}] Built ${outDirName}/ successfully:`);
console.log(`  game.js       : ${(jsBytes / 1024).toFixed(1)} KB`);
console.log(`  main package  : ${mb(mainTotalBytes)} (limit: 4.00 MB)`);
console.log(`  subpkg maps   : ${mb(assetsSummary.sizes.maps)}`);
console.log(`  subpkg meta   : ${mb(assetsSummary.sizes.meta)}`);
console.log(`  grand total   : ${mb(totalBytes)} (${assetsSummary.count} sprites)`);

if (mainTotalBytes >= 4 * 1024 * 1024) {
  console.error(`ERROR: main package (${mb(mainTotalBytes)}) exceeds the 4 MB mini-game limit!`);
  process.exit(1);
}
