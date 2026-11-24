import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SPRITES_DIR = join(ROOT, 'public', 'assets', 'sprites');
const CACHE_DIR = join(ROOT, '.minigame-assets-cache');

const OPAQUE_MAIN_BGS = new Set(['start_splash_bg', 'map_sunny_backyard']);
const OPAQUE_MAP_BGS = new Set(['map_sakura_onsen', 'map_midnight_kitchen', 'map_cat_tower_maze', 'bg_onsen_village']);
const MAIN_CORE_IDS = new Set([
  'panda', 'cat', 'shiba', 'goose', 'rooster', 'raccoon', 'frog',
  'hamster', 'squirrel', 'hedgehog', 'corgi', 'bee',
  'hat_bamboo', 'hat_shades', 'hat_wizard', 'cleaver', 'basketball', 'trash_lid', 'crown',
  'kungfu_po', 'bamboo_mafia', 'zen_master', 'puss_in_hat', 'meowfia', 'purrcerer',
  'samurai_doge', 'doge_wick', 'ronin_goose', 'ballin_rooster', 'rocket_coon', 'pepe_king',
  'capybara', 'capybara_soak', 'capybara_soak_2', 'capybara_soak_3', 'capybara_soak_4',
  'capybara_soak_dizzy', 'capybara_soak_dizzy_2',
  'tub_rim_sunny_backyard', 'tile_open', 'tile_broken',
  'orange', 'shovel', 'sprinkler', 'glue_trap_placed',
  'rat', 'rat_walk2', 'roach', 'roach_walk2', 'crab', 'crab_walk2',
  'killer_bee', 'killer_bee_walk2', 'charmed_rat', 'charmed_rat_walk2',
  'husky_wrecker', 'husky_wrecker_walk2', 'diva_kitty', 'diva_kitty_walk2',
  'mega_roomba', 'mega_roomba_walk2', 'sad_rain_frog', 'sad_rain_frog_walk2',
  'king_skunk', 'king_skunk_walk2',
  'logo_capy', 'avatar_capybara', 'title_logo_zh', 'title_logo_en', 'ui_btn_start_zh', 'ui_btn_start_en',
  'ui_bell_summon', 'ui_fish_food', 'ui_coin_gold', 'ui_star_rank', 'ui_compendium_book',
  'ui_shop_bag', 'ui_trophy_rank', 'ui_map_sign', 'ui_village_gate', 'ui_kitchen_pot',
  'ui_endless_crest', 'ui_lock_closed', 'ui_lock_open', 'ui_merge_sparkle', 'ui_wave_horn',
  'ui_tutorial_capy', 'ui_tutorial_pointer', 'ui_victory_shield_wings', 'ui_defeat_shield_wings',
  'ui_victory_star_lit', 'ui_victory_star_dim', 'ui_mvp_crown', 'ui_ticket_gacha',
  'ui_weapon_fragment', 'ui_clock_sand', 'ui_skull_threat', 'ui_btn_return_arrow',
  'ui_horn_continue', 'ui_crossed_blades', 'ui_storybook_check', 'ui_streak_flame',
  'ui_pause_peek_capy', 'ui_compendium_peek_capy', 'ui_armory_peek_capy', 'ui_alert_siren',
  'ui_battle_clash_crest', 'ui_harvest_basket', 'ui_rank_protect_shield', 'ui_endless_emblem',
  'ui_passive_aura_badge', 'ui_stat_damage_burst', 'ui_stat_ko_skull', 'weapon_m10_bamboo_staff',
  'ui_stats_scroll', 'ui_unlock_chest', 'ui_profile_peek_capy', 'ui_rank_peek_capy',
  'ui_market_peek_raccoon', 'ui_village_peek_capy', 'ui_kitchen_peek_capy', 'ui_medallion_peek_capy',
  'ui_gacha_machine', 'ui_pet_heart', 'ui_sleep_zzz',
]);

function classifySprite(id) {
  if (id === 'menu_banner') return { pkg: 'meta', format: 'jpg', maxDim: 640, quality: 0.78, omit: true };
  if (OPAQUE_MAIN_BGS.has(id)) return { pkg: 'main', format: 'jpg', maxDim: 1280, quality: 0.82 };
  if (OPAQUE_MAP_BGS.has(id)) return { pkg: 'maps', format: 'jpg', maxDim: 1280, quality: 0.82 };
  if (id === 'title_logo_zh' || id === 'title_logo_en') return { pkg: 'main', format: 'webp', maxDim: 720, quality: 0.85 };
  if (id === 'ui_victory_shield_wings' || id === 'ui_defeat_shield_wings') return { pkg: 'main', format: 'webp', maxDim: 512, quality: 0.85 };
  if (id === 'ui_btn_start_zh' || id === 'ui_btn_start_en') return { pkg: 'main', format: 'webp', maxDim: 440, quality: 0.85 };
  if (id.startsWith('tub_rim_')) return { pkg: id === 'tub_rim_sunny_backyard' ? 'main' : 'maps', format: 'webp', maxDim: 420, quality: 0.84 };
  if (id.startsWith('fac_')) return { pkg: 'maps', format: 'webp', maxDim: 280, quality: 0.84 };
  if (id.startsWith('vfx_') || id.startsWith('weapon_basic_')) return { pkg: 'main', format: 'webp', maxDim: 160, quality: 0.82 };
  if (MAIN_CORE_IDS.has(id)) {
    const isIcon = id.startsWith('ui_') || id === 'orange' || id === 'logo_capy' || id === 'tile_open' || id === 'tile_broken';
    return { pkg: 'main', format: 'webp', maxDim: isIcon ? 160 : 224, quality: 0.82 };
  }
  const isLargeMeta = id.startsWith('dish_') || id.startsWith('npc_') || id.endsWith('_awakened') || id.endsWith('_walk2') || id.startsWith('box_kraken') || id.startsWith('dr_clippers') || id.startsWith('buff_roo') || id.startsWith('hornet_queen') || id.startsWith('screaming_marmot') || id.startsWith('trash_coon') || id.startsWith('dj_rat_king');
  return { pkg: 'meta', format: 'webp', maxDim: isLargeMeta ? 224 : 160, quality: 0.8 };
}

function findBrowserExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean);
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return undefined;
}

export async function buildMinigameAssets(outDir) {
  const manifest = JSON.parse(readFileSync(join(SPRITES_DIR, 'manifest.json'), 'utf8'));
  mkdirSync(CACHE_DIR, { recursive: true });
  mkdirSync(join(outDir, 'assets', 'sprites'), { recursive: true });
  mkdirSync(join(outDir, 'subpackages', 'maps', 'assets'), { recursive: true });
  mkdirSync(join(outDir, 'subpackages', 'meta', 'assets'), { recursive: true });

  const work = [];
  const entries = [];
  for (const id of manifest) {
    const rule = classifySprite(id);
    if (rule.omit) continue;
    const srcPath = join(SPRITES_DIR, `${id}.png`);
    if (!existsSync(srcPath)) continue;
    const st = statSync(srcPath);
    const cacheKey = createHash('sha1').update(`${id}:${st.size}:${Math.trunc(st.mtimeMs)}:${rule.format}:${rule.maxDim}:${rule.quality}`).digest('hex').slice(0, 12);
    const cachedFile = join(CACHE_DIR, `${id}.${cacheKey}.${rule.format}`);
    const destRel = rule.pkg === 'main' ? `assets/sprites/${id}.${rule.format}` : `subpackages/${rule.pkg}/assets/${id}.${rule.format}`;
    const destPath = join(outDir, destRel);
    entries.push({ id, rule, srcPath, cachedFile, destRel, destPath });
    if (!existsSync(cachedFile)) work.push({ id, rule, srcPath, cachedFile });
  }

  if (work.length > 0) {
    const executablePath = findBrowserExecutable();
    const browser = await chromium.launch({ executablePath, headless: true });
    try {
      const page = await browser.newPage();
      await page.setContent('<canvas id="c"></canvas>');
      for (let i = 0; i < work.length; i += 20) {
        const batch = work.slice(i, i + 20).map(item => ({
          id: item.id,
          format: item.rule.format,
          maxDim: item.rule.maxDim,
          quality: item.rule.quality,
          b64: readFileSync(item.srcPath).toString('base64'),
        }));
        const results = await page.evaluate(async (items) => {
          const canvas = document.getElementById('c');
          const ctx = canvas.getContext('2d');
          const out = [];
          for (const item of items) {
            const img = new Image();
            await new Promise((res, rej) => {
              img.onload = res;
              img.onerror = rej;
              img.src = `data:image/png;base64,${item.b64}`;
            });
            const scale = Math.min(1, item.maxDim / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
            const w = Math.max(1, Math.round(img.naturalWidth * scale));
            const h = Math.max(1, Math.round(img.naturalHeight * scale));
            canvas.width = w;
            canvas.height = h;
            ctx.clearRect(0, 0, w, h);
            if (item.format === 'jpg') {
              ctx.fillStyle = '#231d18';
              ctx.fillRect(0, 0, w, h);
            }
            ctx.drawImage(img, 0, 0, w, h);
            const mime = item.format === 'jpg' ? 'image/jpeg' : 'image/webp';
            const dataUrl = canvas.toDataURL(mime, item.quality);
            out.push(dataUrl.slice(dataUrl.indexOf(',') + 1));
          }
          return out;
        }, batch);
        for (let j = 0; j < batch.length; j++) {
          writeFileSync(work[i + j].cachedFile, Buffer.from(results[j], 'base64'));
        }
      }
    } finally {
      await browser.close();
    }
  }

  const sizes = { main: 0, maps: 0, meta: 0 };
  for (const item of entries) {
    copyFileSync(item.cachedFile, item.destPath);
    sizes[item.rule.pkg] += statSync(item.destPath).size;
  }

  // Minimal subpackage entry files required by WeChat/Bilibili subpackage loader.
  writeFileSync(join(outDir, 'subpackages', 'maps', 'game.js'), 'module.exports = { ready: true };\n');
  writeFileSync(join(outDir, 'subpackages', 'meta', 'game.js'), 'module.exports = { ready: true };\n');

  return { count: entries.length, compressedNow: work.length, sizes };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outArg = process.argv.find(a => a.startsWith('--out='))?.slice(6) ?? 'dist-wx';
  const outDir = resolve(ROOT, outArg);
  const summary = await buildMinigameAssets(outDir);
  const mb = n => `${(n / (1024 * 1024)).toFixed(2)} MB`;
  console.log(`Compressed ${summary.compressedNow}/${summary.count} sprites -> ${outArg}`);
  console.log(`  main=${mb(summary.sizes.main)}  maps=${mb(summary.sizes.maps)}  meta=${mb(summary.sizes.meta)}  total=${mb(summary.sizes.main + summary.sizes.maps + summary.sizes.meta)}`);
}
