import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SPRITES_DIR = join(ROOT, 'public', 'assets', 'sprites');
const MINIGAME_MAPS_DIR = join(ROOT, 'public', 'assets', 'minigame-maps');
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
  'rat', 'roach', 'crab', 'killer_bee', 'charmed_rat',
  'husky_wrecker', 'diva_kitty', 'mega_roomba', 'sad_rain_frog', 'king_skunk',
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

/** Keep in exact sync with `src/minigame/assetPack.ts` (iOS WeChat supports `.jpg` + `.png`, NOT `.webp`). */
function classifySprite(id) {
  if (id === 'menu_banner' || id.endsWith('_walk2')) return { pkg: 'meta', format: 'jpg', maxDim: 640, quality: 0.78, omit: true };
  if (OPAQUE_MAIN_BGS.has(id)) return { pkg: 'main', format: 'jpg', maxDim: 1512, quality: 0.72 };
  if (OPAQUE_MAP_BGS.has(id)) return { pkg: 'maps', format: 'jpg', maxDim: id === 'bg_onsen_village' ? 1280 : 1512, quality: id === 'bg_onsen_village' ? 0.74 : 0.70 };
  if (id === 'title_logo_zh' || id === 'title_logo_en') return { pkg: 'main', format: 'png', maxDim: 720, quality: 1 };
  if (id === 'ui_victory_shield_wings' || id === 'ui_defeat_shield_wings') return { pkg: 'main', format: 'png', maxDim: 480, quality: 1 };
  if (id === 'ui_btn_start_zh' || id === 'ui_btn_start_en') return { pkg: 'main', format: 'png', maxDim: 440, quality: 1 };
  if (id.startsWith('tub_rim_')) return { pkg: id === 'tub_rim_sunny_backyard' ? 'main' : 'maps', format: 'png', maxDim: 380, quality: 1 };
  if (id.startsWith('fac_')) return { pkg: 'maps', format: 'png', maxDim: 240, quality: 1 };
  if (id.startsWith('vfx_') || id.startsWith('weapon_basic_')) return { pkg: 'main', format: 'png', maxDim: 152, quality: 1 };
  if (MAIN_CORE_IDS.has(id)) {
    const isIcon = id.startsWith('ui_') || id === 'orange' || id === 'logo_capy' || id === 'tile_open' || id === 'tile_broken';
    return { pkg: 'main', format: 'png', maxDim: isIcon ? 156 : 216, quality: 1 };
  }
  const isLargeMeta = id.startsWith('dish_') || id.startsWith('npc_') || id.endsWith('_awakened') || id.endsWith('_walk2') || id.startsWith('box_kraken') || id.startsWith('dr_clippers') || id.startsWith('buff_roo') || id.startsWith('hornet_queen') || id.startsWith('screaming_marmot') || id.startsWith('trash_coon') || id.startsWith('dj_rat_king');
  return { pkg: 'meta', format: 'png', maxDim: isLargeMeta ? 196 : 144, quality: 1 };
}

// ── Pure-Node 256-Color RGBA Palette PNG-8 Encoder (100% iOS/Android/WeChat Native PNG!) ──
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng8(rgba, width, height, maxColors = 192) {
  const pixelCount = width * height;
  // Build quantized 5-bit RGBA histogram (index 0 reserved for fully transparent a < 10)
  const hist = new Map();
  for (let i = 0; i < pixelCount; i++) {
    const o = i * 4;
    const a = rgba[o + 3];
    if (a < 10) continue;
    const r = rgba[o], g = rgba[o + 1], b = rgba[o + 2];
    const key = ((r >> 3) << 15) | ((g >> 3) << 10) | ((b >> 3) << 5) | (a >> 3);
    let entry = hist.get(key);
    if (!entry) {
      entry = { r: 0, g: 0, b: 0, a: 0, count: 0 };
      hist.set(key, entry);
    }
    entry.r += r;
    entry.g += g;
    entry.b += b;
    entry.a += a;
    entry.count += 1;
  }

  const samples = [];
  for (const e of hist.values()) {
    samples.push({
      r: Math.round(e.r / e.count),
      g: Math.round(e.g / e.count),
      b: Math.round(e.b / e.count),
      a: Math.round(e.a / e.count),
      count: e.count,
    });
  }

  const makeBox = (items) => {
    let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0, minA = 255, maxA = 0, total = 0;
    for (const s of items) {
      if (s.r < minR) minR = s.r; if (s.r > maxR) maxR = s.r;
      if (s.g < minG) minG = s.g; if (s.g > maxG) maxG = s.g;
      if (s.b < minB) minB = s.b; if (s.b > maxB) maxB = s.b;
      if (s.a < minA) minA = s.a; if (s.a > maxA) maxA = s.a;
      total += s.count;
    }
    const rSpan = (maxR - minR) * 1.15;
    const gSpan = (maxG - minG) * 1.45;
    const bSpan = (maxB - minB) * 1.1;
    const aSpan = (maxA - minA) * 0.9;
    const maxSpan = Math.max(rSpan, gSpan, bSpan, aSpan);
    const axis = maxSpan === gSpan ? 'g' : maxSpan === rSpan ? 'r' : maxSpan === bSpan ? 'b' : 'a';
    // Gentle population weighting preserves small vibrant accents (green sprout leaves, pink sakura, orange highlights)!
    return { items, total, axis, score: maxSpan * Math.pow(total, 0.25) };
  };

  const targetPalette = Math.min(255, maxColors);
  const boxes = samples.length > 0 ? [makeBox(samples)] : [];
  while (boxes.length < targetPalette) {
    let bestIdx = -1, bestScore = 0;
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].items.length > 1 && boxes[i].score > bestScore) {
        bestScore = boxes[i].score;
        bestIdx = i;
      }
    }
    if (bestIdx < 0) break;
    const box = boxes.splice(bestIdx, 1)[0];
    box.items.sort((x, y) => x[box.axis] - y[box.axis]);
    let acc = 0, split = 1;
    const half = box.total / 2;
    for (let i = 0; i < box.items.length - 1; i++) {
      acc += box.items[i].count;
      if (acc >= half) { split = i + 1; break; }
    }
    boxes.push(makeBox(box.items.slice(0, split)), makeBox(box.items.slice(split)));
  }

  // Palette entry 0 = fully transparent; entries 1..N sorted by (alpha, luma) for cleaner deflate compression
  const palette = [[0, 0, 0, 0]];
  const opaqueEntries = boxes.map(box => {
    let sr = 0, sg = 0, sb = 0, sa = 0, tc = 0;
    for (const s of box.items) {
      sr += s.r * s.count; sg += s.g * s.count; sb += s.b * s.count; sa += s.a * s.count; tc += s.count;
    }
    return [Math.round(sr / tc), Math.round(sg / tc), Math.round(sb / tc), Math.round(sa / tc)];
  });
  opaqueEntries.sort((x, y) => (y[3] - x[3]) || ((x[0] * 3 + x[1] * 6 + x[2]) - (y[0] * 3 + y[1] * 6 + y[2])));
  for (const c of opaqueEntries) palette.push(c);

  const palLen = palette.length;
  const pR = new Uint8Array(palLen), pG = new Uint8Array(palLen), pB = new Uint8Array(palLen), pA = new Uint8Array(palLen);
  for (let i = 0; i < palLen; i++) {
    pR[i] = palette[i][0]; pG[i] = palette[i][1]; pB[i] = palette[i][2]; pA[i] = palette[i][3];
  }

  // Map every pixel to nearest palette index with per-RGBA cache
  const indices = new Uint8Array(pixelCount);
  const nearestCache = new Map();
  for (let i = 0; i < pixelCount; i++) {
    const o = i * 4;
    const a = rgba[o + 3];
    if (a < 10) { indices[i] = 0; continue; }
    const r = rgba[o], g = rgba[o + 1], b = rgba[o + 2];
    const cacheKey = ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;
    let idx = nearestCache.get(cacheKey);
    if (idx === undefined) {
      let best = 1, bestDist = 1e15;
      for (let p = 1; p < palLen; p++) {
        const dr = r - pR[p], dg = g - pG[p], db = b - pB[p], da = a - pA[p];
        const dist = dr * dr * 2 + dg * dg * 4 + db * db * 3 + da * da * 6;
        if (dist < bestDist) { bestDist = dist; best = p; if (dist === 0) break; }
      }
      idx = best;
      nearestCache.set(cacheKey, idx);
    }
    indices[i] = idx;
  }

  // Raw PNG scanlines (filter 0 = None yields smallest deflate on indexed sprites!)
  const stride = width + 1;
  const raw = Buffer.allocUnsafe(stride * height);
  for (let y = 0; y < height; y++) {
    const rowOff = y * stride;
    raw[rowOff] = 0;
    raw.set(indices.subarray(y * width, (y + 1) * width), rowOff + 1);
  }
  const idat = deflateSync(raw, { level: 9 });

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 3; // indexed color (PLTE)
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const plte = Buffer.alloc(palLen * 3);
  for (let i = 0; i < palLen; i++) {
    plte[i * 3] = pR[i]; plte[i * 3 + 1] = pG[i]; plte[i * 3 + 2] = pB[i];
  }
  // Trim trailing 255s from tRNS to save bytes
  let trnsLen = palLen;
  while (trnsLen > 1 && pA[trnsLen - 1] === 255) trnsLen--;
  const trns = Buffer.alloc(trnsLen);
  for (let i = 0; i < trnsLen; i++) trns[i] = pA[i];

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('PLTE', plte),
    pngChunk('tRNS', trns),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
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

export async function buildMinigameAssets(outDir, opts = {}) {
  const omitEnglish = Boolean(opts.omitEnglish);
  const manifest = JSON.parse(readFileSync(join(SPRITES_DIR, 'manifest.json'), 'utf8'));
  mkdirSync(CACHE_DIR, { recursive: true });
  mkdirSync(join(outDir, 'assets', 'sprites'), { recursive: true });

  const work = [];
  const entries = [];
  for (const id of manifest) {
    if (omitEnglish && (id === 'title_logo_en' || id === 'ui_btn_start_en')) continue;
    const rule = classifySprite(id);
    if (rule.omit) continue;
    const wideOverride = join(MINIGAME_MAPS_DIR, `${id}.png`);
    const srcPath = existsSync(wideOverride) ? wideOverride : join(SPRITES_DIR, `${id}.png`);
    if (!existsSync(srcPath)) continue;
    const st = statSync(srcPath);
    const cacheKey = createHash('sha1').update(`v5pan21x9:${id}:${srcPath}:${st.size}:${Math.trunc(st.mtimeMs)}:${rule.format}:${rule.maxDim}:${rule.quality}`).digest('hex').slice(0, 12);
    const cachedFile = join(CACHE_DIR, `${id}.${cacheKey}.${rule.format}`);
    const destRel = `assets/sprites/${id}.${rule.format}`;
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
      for (let i = 0; i < work.length; i += 16) {
        const batch = work.slice(i, i + 16).map(item => ({
          id: item.id,
          format: item.rule.format,
          maxDim: item.rule.maxDim,
          quality: item.rule.quality,
          b64: readFileSync(item.srcPath).toString('base64'),
        }));
        const results = await page.evaluate(async (items) => {
          const canvas = document.getElementById('c');
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
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
              ctx.drawImage(img, 0, 0, w, h);
              const dataUrl = canvas.toDataURL('image/jpeg', item.quality);
              out.push({ kind: 'jpg', b64: dataUrl.slice(dataUrl.indexOf(',') + 1), w, h });
            } else {
              ctx.drawImage(img, 0, 0, w, h);
              const raw = ctx.getImageData(0, 0, w, h).data;
              let bin = '';
              const chunk = 0x8000;
              for (let k = 0; k < raw.length; k += chunk) {
                bin += String.fromCharCode(...raw.subarray(k, k + chunk));
              }
              out.push({ kind: 'rgba', b64: btoa(bin), w, h });
            }
          }
          return out;
        }, batch);
        for (let j = 0; j < batch.length; j++) {
          const item = work[i + j];
          const res = results[j];
          if (res.kind === 'jpg') {
            writeFileSync(item.cachedFile, Buffer.from(res.b64, 'base64'));
          } else {
            const rgba = Buffer.from(res.b64, 'base64');
            writeFileSync(item.cachedFile, encodePng8(rgba, res.w, res.h, 255));
          }
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
