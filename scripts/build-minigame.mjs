import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
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

const assetsSummary = await buildMinigameAssets(outDir, { omitEnglish: target === 'wx' });

// Copy official free WeChat Open Data Context (好友排行榜开放数据域) for `wx` builds.
let openDataBytes = 0;
if (target === 'wx') {
  const odcSrc = join(ROOT, 'src', 'minigame', 'openDataContext', 'index.js');
  const odcDir = join(outDir, 'openDataContext');
  mkdirSync(odcDir, { recursive: true });
  copyFileSync(odcSrc, join(odcDir, 'index.js'));
  openDataBytes = statSync(join(odcDir, 'index.js')).size;
}

// All 289 compressed sprites + game.js (+ openDataContext on wx) fit cleanly under WeChat's 4 MB single-package limit,
// eliminating subpackages so WeChat DevTools Remote Debugging never trips on `/__debug__/__jscore-debug__/subpackages/...`.
const gameJson = {
  deviceOrientation: 'landscape',
  showStatusBar: false,
  ...(target === 'wx' ? { openDataContext: 'openDataContext' } : {}),
  networkTimeout: { request: 10000, downloadFile: 15000 },
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
    // Vite already transpiles (ES2017) & minifies game.js; keep DevTools UglifyJS & SourceMap off for Preview / Remote Debug.
    minified: false,
    uploadWithSourceMap: false,
    newFeature: true,
  },
  compileType: 'game',
  appid,
  projectname: target === 'bl' ? 'capybara-defense-bl' : 'capybara-defense-wx',
  condition: existingProjectConfig?.condition ?? {},
};
writeFileSync(projectConfigPath, `${JSON.stringify(projectConfig, null, 2)}\n`);

const jsBytes = statSync(join(outDir, 'game.js')).size;
const gameJsonBytes = statSync(join(outDir, 'game.json')).size;
const spritesTotalBytes = assetsSummary.sizes.main + assetsSummary.sizes.maps + assetsSummary.sizes.meta;
const totalBytes = jsBytes + gameJsonBytes + openDataBytes + spritesTotalBytes;
const mb = n => `${(n / (1024 * 1024)).toFixed(2)} MB`;

console.log(`\n[${target.toUpperCase()}] Built ${outDirName}/ successfully (single package, zero subpackages):`);
console.log(`  game.js       : ${(jsBytes / 1024).toFixed(1)} KB`);
if (openDataBytes > 0) console.log(`  openDataCtx   : ${(openDataBytes / 1024).toFixed(1)} KB`);
console.log(`  core sprites  : ${mb(assetsSummary.sizes.main)}`);
console.log(`  map sprites   : ${mb(assetsSummary.sizes.maps)}`);
console.log(`  meta sprites  : ${mb(assetsSummary.sizes.meta)}`);
console.log(`  total package : ${mb(totalBytes)} / 4.00 MB (${assetsSummary.count} sprites)`);

if (totalBytes >= 4 * 1024 * 1024) {
  console.error(`ERROR: total package (${mb(totalBytes)}) exceeds the 4 MB single-package mini-game limit!`);
  process.exit(1);
}
