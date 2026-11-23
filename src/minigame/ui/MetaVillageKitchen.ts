import {
  BROTHS,
  BROTH_IDS,
  INGREDIENT_BASKET_PRICE,
  INGREDIENT_IDS,
  getKitchenCollectionAura,
  type BrothEffectKey,
  type BrothId,
  type IngredientId,
} from '../../config/kitchen';
import {
  FACILITIES,
  FACILITY_IDS,
  PET_TAP_DAILY_LIMIT,
  VILLAGE_MAX_LEVEL,
  VILLAGE_MAX_STARS,
  type FacilityId,
} from '../../config/village';
import {
  canAffordIngredients,
  getBrothLevel,
  getBrothUpgradeCost,
} from '../../core/KitchenProgression';
import {
  canAffordVillage,
  computeOfflineHarvest,
  facilityUpgradeCost,
  getVillageResidents,
  hasHarvest,
  localDay,
  petTapsLeft,
  villageLevel,
  villageStars,
} from '../../core/VillageProgression';
import type { Profile } from '../../core/types';
import { getLanguage, t } from '../../i18n/i18n';
import { assets } from '../../render/AssetRegistry';
import { INK, round } from '../../render/StickerArt';
import {
  BTN_STYLES,
  PALETTE,
  ScrollRegion,
  drawButton,
  drawSpriteContain,
  drawText,
  drawWoodPanel,
  type UiHitManager,
} from './CanvasUI';
import { drawScrollbar } from './MetaArmoryMarket';

export interface VillageUiState {
  tab: 'courtyard' | 'build';
  elapsed: number;
  nowMs: number;
  lastPetId?: string;
  lastPetUntil: number;
  adDoubleHarvestAvailable: boolean;
}

export interface KitchenUiState {
  tier: 'all' | 1 | 2 | 3 | 4;
}

/**
 * Hub #3: Capybara Onsen Village (水豚温泉山庄)
 * Interactive panoramic diorama (pet residents for pocket coins + offline harvest basket) & 5-facility build sheet.
 */
export function drawVillageModal(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  profile: Profile,
  villageUi: VillageUiState,
  scroll: ScrollRegion,
): { scrollViewport?: { x: number; y: number; w: number; h: number } } {
  const zh = getLanguage() === 'zh-CN';
  const pw = 1040, ph = 626;
  const px = (1280 - pw) / 2, py = (720 - ph) / 2;

  drawWoodPanel(c, px, py, pw, ph, 24, PALETTE.cream, PALETTE.woodDark);
  hits.add({ id: 'modal:card', x: px, y: py, w: pw, h: ph });

  // Header
  drawSpriteContain(c, 'ui_village_gate', px + 24, py + 14, 48, 48);
  drawText(c, zh ? '水豚温泉山庄' : 'Capybara Onsen Village', px + 80, py + 30, 24, PALETTE.ink, 'left', 900);
  const stars = villageStars(profile);
  const tapsLeft = petTapsLeft(profile, localDay(new Date(villageUi.nowMs)));
  drawText(
    c,
    `🪵 ${profile.village.wood}   ·   ✨ ${profile.village.essence}   ·   🪙 ${profile.coins}   ·   ★ ${stars}/${VILLAGE_MAX_STARS}`,
    px + 80,
    py + 54,
    13.5,
    PALETTE.inkSoft,
    'left',
    800,
  );
  drawButton(c, hits, 'modal:close', px + pw - 56, py + 18, 38, 38, '×', {
    ...BTN_STYLES.cream,
    radius: 12,
    fontSize: 22,
  });

  // 2 Tabs
  const ty = py + 76;
  drawButton(c, hits, 'village:tab:courtyard', px + 26, ty, 200, 40, zh ? '🏡 温泉庭院' : '🏡 Courtyard', {
    ...(villageUi.tab === 'courtyard' ? BTN_STYLES.gold : BTN_STYLES.cream),
    radius: 13,
    fontSize: 15,
  });
  drawButton(c, hits, 'village:tab:build', px + 238, ty, 200, 40, zh ? '🔨 设施建造' : '🔨 Facilities', {
    ...(villageUi.tab === 'build' ? BTN_STYLES.gold : BTN_STYLES.cream),
    radius: 13,
    fontSize: 15,
  });

  const by = ty + 50;
  const bh = ph - 148;

  // ── TAB 1: COURTYARD DIORAMA ──────────────────────────────────────────────
  if (villageUi.tab === 'courtyard') {
    const sx = px + 26, sy = by, sw = pw - 52, sh = bh - 92;
    round(c, sx, sy, sw, sh, 18, '#d4e2bd', PALETTE.woodDark, 2.5);

    // Panoramic village diorama background (from maps subpackage)
    const bg = assets.get('bg_onsen_village');
    c.save();
    c.beginPath();
    c.roundRect(sx + 2, sy + 2, sw - 4, sh - 4, 16);
    c.clip();
    if (bg) {
      c.drawImage(bg, sx + 2, sy + 2, sw - 4, sh - 4);
    } else {
      const grad = c.createLinearGradient(sx, sy, sx, sy + sh);
      grad.addColorStop(0, '#c8dfb3');
      grad.addColorStop(1, '#a9c98f');
      c.fillStyle = grad;
      c.fillRect(sx, sy, sw, sh);
    }

    // Draw all 5 facility plots at exact spot.left / spot.top percentages
    for (const facId of FACILITY_IDS) {
      const def = FACILITIES[facId];
      const lv = villageLevel(profile, facId);
      const fx = sx + (def.spot.left / 100) * sw;
      const fy = sy + (def.spot.top / 100) * sh;

      if (lv > 0) {
        const size = 120;
        drawSpriteContain(c, facId, fx - size / 2, fy - size / 2, size, size);
        round(c, fx - 54, fy + 38, 108, 22, 11, 'rgba(64,40,18,0.82)', '#f7dc96', 1.4);
        drawText(c, `${t(`facility.${facId}`).slice(0, 5)} ${'★'.repeat(lv)}`, fx, fy + 49, 10.5, '#fff6df', 'center', 800);
      } else {
        // Empty plot sign inviting build
        hits.add({ id: 'village:tab:build', x: fx - 48, y: fy - 28, w: 96, h: 56 });
        round(c, fx - 48, fy - 24, 96, 48, 12, 'rgba(255,244,218,0.85)', PALETTE.woodMid, 2);
        drawText(c, `+ ${t(`facility.${facId}`).slice(0, 4)}`, fx, fy - 5, 11, PALETTE.ink, 'center', 900);
        drawText(c, zh ? '点击建造' : 'Build', fx, fy + 12, 10, PALETTE.tealDark, 'center', 800);
      }
    }

    // Draw tappable resident pets & heroes
    const residents = getVillageResidents(profile);
    residents.forEach((res, idx) => {
      const def = FACILITIES[res.facility];
      const angle = (res.slot * 1.4 + idx * 0.7) % (Math.PI * 2);
      const rx = sx + (def.spot.left / 100) * sw + Math.cos(angle) * 58;
      const ry = sy + (def.spot.top / 100) * sh + Math.sin(angle) * 26 + 22;
      const hopped = villageUi.lastPetId === res.id && villageUi.elapsed < villageUi.lastPetUntil;
      const bob = hopped ? -Math.abs(Math.sin((villageUi.lastPetUntil - villageUi.elapsed) * 14)) * 18 : Math.sin(villageUi.elapsed * 2.6 + idx) * 3;
      const size = 54;
      hits.add({ id: `village:pet:${res.id}`, x: rx - size / 2, y: ry - size / 2, w: size, h: size, data: res.id });
      drawSpriteContain(c, res.id, rx - size / 2, ry - size / 2 + bob, size, size);
      if (hopped) {
        drawText(c, '♥ +5🪙', rx, ry - 34, 13, '#fff6c4', 'center', 900, INK, 3);
      }
    });

    // Top-left pet tap counter pill inside courtyard
    round(c, sx + 12, sy + 12, 236, 32, 16, 'rgba(56,36,18,0.78)', 'rgba(246,216,148,0.75)', 1.5);
    drawText(
      c,
      zh ? `🐾 摸摸院中萌宠领零花 (${tapsLeft}/${PET_TAP_DAILY_LIMIT})` : `🐾 Pat pets for coins (${tapsLeft}/${PET_TAP_DAILY_LIMIT})`,
      sx + 130,
      sy + 28,
      12,
      '#fff6df',
      'center',
      800,
    );
    c.restore();

    // Bottom Offline Harvest Basket Strip
    const hy = sy + sh + 12;
    const hh = 78;
    const harvest = computeOfflineHarvest(profile, villageUi.nowMs);
    const ripe = hasHarvest(harvest);

    round(c, sx, hy, sw, hh, 16, '#fff7e5', PALETTE.woodMid, 2);
    drawSpriteContain(c, 'ui_coin_gold', sx + 16, hy + 15, 48, 48);
    drawText(
      c,
      zh ? `离线温泉收菜篮${harvest.full ? '（已满 12h！）' : ''}` : `Offline Harvest Basket${harvest.full ? ' (FULL 12h!)' : ''}`,
      sx + 74,
      hy + 26,
      16,
      PALETTE.ink,
      'left',
      900,
    );
    const summary = ripe
      ? `🪙 +${harvest.coins}${harvest.fragments ? `  ·  🧩 +${harvest.fragments}` : ''}${harvest.yuzu ? `  ·  🍊 +${harvest.yuzu}` : ''}${harvest.tickets ? `  ·  🎟️ +${harvest.tickets}` : ''}`
      : (zh ? '山庄正在缓缓攒收益，过一会儿再来收菜吧～' : 'Your facilities are gathering coins & gifts...');
    drawText(c, summary, sx + 74, hy + 53, 13.5, ripe ? '#2c763d' : PALETTE.muted, 'left', 800);

    const btnW = villageUi.adDoubleHarvestAvailable && ripe ? 174 : 210;
    drawButton(c, hits, 'village:harvest', sx + sw - btnW - 14, hy + 14, btnW, 50, zh ? '🧺 一键收菜' : '🧺 Collect', {
      ...(ripe ? BTN_STYLES.green : BTN_STYLES.muted),
      radius: 14,
      fontSize: 16,
      disabled: !ripe,
    });
    if (villageUi.adDoubleHarvestAvailable && ripe) {
      drawButton(c, hits, 'village:ad-harvest', sx + sw - btnW * 2 - 24, hy + 14, btnW, 50, zh ? '🎬 双倍收菜' : '🎬 2× Ad', {
        ...BTN_STYLES.gold,
        radius: 14,
        fontSize: 15,
      });
    }
    return {};
  }

  // ── TAB 2: 5 FACILITIES BUILD & UPGRADE ───────────────────────────────────
  const vx = px + 26, vy = by, vw = pw - 52, vh = bh;
  round(c, vx, vy, vw, vh, 16, '#fff8ea', PALETTE.woodLight, 1.8);

  c.save();
  c.beginPath();
  c.rect(vx + 2, vy + 2, vw - 4, vh - 4);
  c.clip();

  const ch = 104, gap = 10, pad = 14;
  FACILITY_IDS.forEach((facId, idx) => {
    const def = FACILITIES[facId];
    const lv = villageLevel(profile, facId);
    const cost = facilityUpgradeCost(facId, lv);
    const afford = !!cost && canAffordVillage(profile, cost);
    const rx = vx + pad;
    const ry = vy + pad + idx * (ch + gap) - scroll.offset;
    if (ry + ch < vy - 20 || ry > vy + vh + 20) return;

    round(c, rx, ry, vw - pad * 2, ch, 16, lv > 0 ? '#f7ebd1' : '#f0e7d6', afford ? '#4e9b86' : PALETTE.woodLight, afford ? 2.4 : 1.6);
    round(c, rx + 12, ry + 12, 80, 80, 14, '#fff7e5', PALETTE.woodMid, 1.5);
    drawSpriteContain(c, facId, rx + 16, ry + 16, 72, 72, lv > 0 ? 1 : 0.6);

    const starStr = lv > 0 ? `${'★'.repeat(lv)}${'☆'.repeat(VILLAGE_MAX_LEVEL - lv)}` : (zh ? '未建造' : 'Not Built');
    drawText(c, `${t(`facility.${facId}`)}   ${starStr}`, rx + 106, ry + 26, 17, PALETTE.ink, 'left', 900);
    drawText(c, formatFacilityBuffSummary(facId, Math.max(1, lv), zh), rx + 106, ry + 52, 13, PALETTE.tealDark, 'left', 800);

    if (cost) {
      const costStr = `${zh ? '消耗' : 'Cost'}: 🪵${cost.wood}  ✨${cost.essence}${cost.coins > 0 ? `  🪙${cost.coins}` : ''}`;
      drawText(c, costStr, rx + 106, ry + 78, 12.5, afford ? PALETTE.inkSoft : '#b34232', 'left', 800);
    } else {
      drawText(c, zh ? '★ 已达满级（永久加成已满！）' : '★ Max Level!', rx + 106, ry + 78, 13, '#8a4c10', 'left', 900);
    }

    if (ry + ch > vy && ry < vy + vh) {
      if (cost) {
        const label = lv === 0 ? (zh ? '建造 Lv.1' : 'Build Lv.1') : (zh ? `升级 Lv.${lv + 1}` : `Upgrade Lv.${lv + 1}`);
        drawButton(c, hits, `village:build:${facId}`, rx + vw - pad * 2 - 156, ry + 26, 140, 50, label, {
          ...(afford ? BTN_STYLES.green : BTN_STYLES.muted),
          radius: 14,
          fontSize: 15,
          disabled: !afford,
        });
      } else {
        round(c, rx + vw - pad * 2 - 126, ry + 32, 110, 38, 12, '#f5df9c', PALETTE.goldDark, 1.5);
        drawText(c, 'MAX ★', rx + vw - pad * 2 - 71, ry + 52, 14, '#7a450c', 'center', 900);
      }
    }
  });

  const contentH = pad * 2 + FACILITY_IDS.length * (ch + gap);
  c.restore();
  scroll.setContentBounds(contentH, vh);
  drawScrollbar(c, vx, vy, vw, vh, contentH, scroll);

  return { scrollViewport: { x: vx, y: vy, w: vw, h: vh } };
}

function formatFacilityBuffSummary(id: FacilityId, lv: number, zh: boolean): string {
  const def = FACILITIES[id];
  const idx = Math.max(0, Math.min(2, lv - 1));
  const parts: string[] = [zh ? `产金币 ${def.coinsPerHour[idx]}/时` : `${def.coinsPerHour[idx]} coins/h`];
  const b = def.buffs;
  if (b.damage?.[idx]) parts.push(zh ? `全队伤 +${Math.round(b.damage[idx] * 100)}%` : `DMG +${Math.round(b.damage[idx] * 100)}%`);
  if (b.rate?.[idx]) parts.push(zh ? `攻速 +${Math.round(b.rate[idx] * 100)}%` : `SPD +${Math.round(b.rate[idx] * 100)}%`);
  if (b.startFood?.[idx]) parts.push(zh ? `开局小鱼干 +${b.startFood[idx]}` : `Start Food +${b.startFood[idx]}`);
  if (b.startOranges?.[idx]) parts.push(zh ? `开局橘子 +${b.startOranges[idx]}` : `Start Oranges +${b.startOranges[idx]}`);
  if (b.bossDamage?.[idx]) parts.push(zh ? `首领伤 +${Math.round(b.bossDamage[idx] * 100)}%` : `Boss DMG +${Math.round(b.bossDamage[idx] * 100)}%`);
  if (b.bossFragment?.[idx]) parts.push(zh ? `碎片掉率 +${Math.round(b.bossFragment[idx] * 100)}%` : `Frag Drop +${Math.round(b.bossFragment[idx] * 100)}%`);
  if (b.coinBonus?.[idx]) parts.push(zh ? `通关金币 +${Math.round(b.coinBonus[idx] * 100)}%` : `Coins +${Math.round(b.coinBonus[idx] * 100)}%`);
  if (def.yuzuEveryHours?.[idx]) parts.push(zh ? `每${def.yuzuEveryHours[idx]}h产柚子` : `Yuzu /${def.yuzuEveryHours[idx]}h`);
  if (def.fragmentEveryHours?.[idx]) parts.push(zh ? `每${def.fragmentEveryHours[idx]}h产碎片` : `Frag /${def.fragmentEveryHours[idx]}h`);
  return parts.join('  ·  ');
}

/**
 * Hub #4: Onsen Kitchen (温泉料理屋 — 6 Ingredients + 14 Bath Broths)
 */
export function drawKitchenModal(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  profile: Profile,
  kitchen: KitchenUiState,
  scroll: ScrollRegion,
): { scrollViewport: { x: number; y: number; w: number; h: number } } {
  const zh = getLanguage() === 'zh-CN';
  const pw = 1040, ph = 626;
  const px = (1280 - pw) / 2, py = (720 - ph) / 2;

  drawWoodPanel(c, px, py, pw, ph, 24, PALETTE.cream, PALETTE.woodDark);
  hits.add({ id: 'modal:card', x: px, y: py, w: pw, h: ph });

  // Header
  drawSpriteContain(c, 'ui_kitchen_pot', px + 24, py + 14, 48, 48);
  drawText(c, zh ? '温泉料理屋' : 'Onsen Kitchen', px + 80, py + 30, 24, PALETTE.ink, 'left', 900);
  const aura = getKitchenCollectionAura(profile);
  drawText(
    c,
    zh
      ? `已解锁 ${aura.unlockedCount}/14 道汤底  ·  收集光环：全队伤害 +${(aura.damageBonus * 100).toFixed(1)}% · 攻速 +${Math.round(aura.rateBonus * 100)}%`
      : `Unlocked ${aura.unlockedCount}/14 Broths · Aura: DMG +${(aura.damageBonus * 100).toFixed(1)}% · SPD +${Math.round(aura.rateBonus * 100)}%`,
    px + 80,
    py + 54,
    13,
    PALETTE.tealDark,
    'left',
    800,
  );
  drawButton(c, hits, 'modal:close', px + pw - 56, py + 18, 38, 38, '×', {
    ...BTN_STYLES.cream,
    radius: 12,
    fontSize: 22,
  });

  // Top Ingredient Pantry Bar + Buy Basket Button
  const barY = py + 72;
  round(c, px + 24, barY, pw - 48, 54, 14, '#f4e3bf', PALETTE.woodLight, 1.8);
  INGREDIENT_IDS.forEach((ingId, idx) => {
    const ix = px + 34 + idx * 124;
    const count = profile.ingredients?.[ingId] ?? 0;
    drawSpriteContain(c, ingId, ix, barY + 9, 36, 36);
    drawText(c, t(`ingredient.${ingId}`).slice(0, 4), ix + 40, barY + 20, 11.5, PALETTE.inkSoft, 'left', 700);
    drawText(c, `×${count}`, ix + 40, barY + 38, 13.5, count > 0 ? PALETTE.ink : PALETTE.muted, 'left', 900);
  });

  const canBuyBasket = profile.coins >= INGREDIENT_BASKET_PRICE;
  drawButton(
    c,
    hits,
    'kitchen:basket',
    px + pw - 238,
    barY + 6,
    206,
    42,
    zh ? `🧺 购3份食材 (${INGREDIENT_BASKET_PRICE}🪙)` : `🧺 3 Ingredients (${INGREDIENT_BASKET_PRICE}🪙)`,
    {
      ...(canBuyBasket ? BTN_STYLES.gold : BTN_STYLES.muted),
      radius: 12,
      fontSize: 12.5,
      disabled: !canBuyBasket,
    },
  );

  // Tier Filter Tabs
  const ty = barY + 62;
  const tiers: Array<{ id: KitchenUiState['tier']; label: string }> = [
    { id: 'all', label: zh ? '全部 (14)' : 'All (14)' },
    { id: 1, label: zh ? 'T1 清汤' : 'Tier 1' },
    { id: 2, label: zh ? 'T2 秘汤' : 'Tier 2' },
    { id: 3, label: zh ? 'T3 珍汤' : 'Tier 3' },
    { id: 4, label: zh ? 'T4 传说汤' : 'Tier 4' },
  ];
  tiers.forEach((tr, i) => {
    drawButton(c, hits, `kitchen:tier:${tr.id}`, px + 24 + i * 124, ty, 114, 34, tr.label, {
      ...(kitchen.tier === tr.id ? BTN_STYLES.gold : BTN_STYLES.cream),
      radius: 11,
      fontSize: 13,
    });
  });
  drawText(c, `🪙 ${profile.coins}`, px + pw - 30, ty + 18, 15, PALETTE.ink, 'right', 900);

  // Scrollable 2-column Grid of Broths
  const vx = px + 24, vy = ty + 42, vw = pw - 48, vh = ph - 196;
  round(c, vx, vy, vw, vh, 16, '#fff8ea', PALETTE.woodLight, 1.8);

  const visible = BROTH_IDS.filter(id => kitchen.tier === 'all' || BROTHS[id].tier === kitchen.tier);
  c.save();
  c.beginPath();
  c.rect(vx + 2, vy + 2, vw - 4, vh - 4);
  c.clip();

  const cols = 2, gap = 12, pad = 14;
  const cw = Math.floor((vw - pad * 2 - gap) / cols);
  const ch = 124;

  visible.forEach((brothId, idx) => {
    const def = BROTHS[brothId];
    const lv = getBrothLevel(profile, brothId);
    const active = profile.activeBrothId === brothId;
    const cost = getBrothUpgradeCost(brothId, lv);
    const afford = !!cost && canAffordIngredients(profile, cost);

    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const rx = vx + pad + col * (cw + gap);
    const ry = vy + pad + row * (ch + gap) - scroll.offset;
    if (ry + ch < vy - 20 || ry > vy + vh + 20) return;

    round(c, rx, ry, cw, ch, 16, active ? '#e7f8de' : lv > 0 ? '#f7ebd1' : '#f0e7d6', active ? '#3c8532' : def.tier === 4 ? '#c77a14' : PALETTE.woodLight, active || def.tier === 4 ? 2.5 : 1.6);
    round(c, rx + 12, ry + 14, 72, 72, 16, def.bathColor, PALETTE.woodDark, 2);
    drawSpriteContain(c, brothId, rx + 14, ry + 16, 68, 68, lv > 0 ? 1 : 0.72);

    const stars = lv > 0 ? '★'.repeat(lv) : `T${def.tier}`;
    drawText(c, `${t(`broth.${brothId}`)}  ${stars}`, rx + 94, ry + 24, 15.5, PALETTE.ink, 'left', 900);
    drawText(c, formatBrothEffectSummary(brothId, Math.max(1, lv), zh), rx + 94, ry + 48, 12, PALETTE.tealDark, 'left', 800);

    // Ingredient cost chips
    if (cost) {
      const costEntries = Object.entries(cost) as Array<[IngredientId, number]>;
      let cx = rx + 94;
      for (const [ingId, req] of costEntries.slice(0, 4)) {
        const have = profile.ingredients?.[ingId] ?? 0;
        const ok = have >= req;
        drawSpriteContain(c, ingId, cx, ry + 62, 22, 22);
        drawText(c, `${have}/${req}`, cx + 24, ry + 73, 11, ok ? '#2c763d' : '#b34232', 'left', 800);
        cx += 64;
      }
    } else {
      drawText(c, zh ? '★ 已熬至满级 Lv.3' : '★ Mastered Lv.3', rx + 94, ry + 73, 12, '#8a4c10', 'left', 900);
    }

    // Bottom right buttons
    if (ry + ch > vy && ry < vy + vh) {
      const btnY = ry + ch - 38;
      if (lv === 0) {
        drawButton(c, hits, `kitchen:brew:${brothId}`, rx + cw - 128, btnY, 114, 30, zh ? '熬制解锁' : 'Brew Lv.1', {
          ...(afford ? BTN_STYLES.green : BTN_STYLES.muted),
          radius: 10,
          fontSize: 12.5,
          disabled: !afford,
        });
      } else {
        drawButton(c, hits, `kitchen:equip:${brothId}`, rx + cw - 118, btnY, 104, 30, active ? (zh ? '✓ 泡澡中' : '✓ Active') : (zh ? '设为汤底' : 'Equip'), {
          ...(active ? BTN_STYLES.teal : BTN_STYLES.gold),
          radius: 10,
          fontSize: 12.5,
        });
        if (cost) {
          drawButton(c, hits, `kitchen:upgrade:${brothId}`, rx + cw - 226, btnY, 100, 30, zh ? `升级 Lv.${lv + 1}` : `Up Lv.${lv + 1}`, {
            ...(afford ? BTN_STYLES.green : BTN_STYLES.muted),
            radius: 10,
            fontSize: 12,
            disabled: !afford,
          });
        }
      }
    }
  });

  const rows = Math.ceil(visible.length / cols);
  const contentH = pad * 2 + rows * (ch + gap);
  c.restore();
  scroll.setContentBounds(contentH, vh);
  drawScrollbar(c, vx, vy, vw, vh, contentH, scroll);

  return { scrollViewport: { x: vx, y: vy, w: vw, h: vh } };
}

function formatBrothEffectSummary(id: BrothId, lv: number, zh: boolean): string {
  const def = BROTHS[id];
  const i = Math.max(0, Math.min(2, lv - 1));
  const labels: Record<BrothEffectKey, [string, string, boolean]> = {
    startFood: ['开局鱼干+', 'Start Food+', true],
    waveIncome: ['每波鱼干+', 'Wave Food+', true],
    meleeDamage: ['近战伤+', 'Melee DMG+', false],
    meleeRate: ['近战攻速+', 'Melee SPD+', false],
    heroRefund: ['合英雄返粮+', 'Hero Refund+', true],
    rangedDamage: ['远程伤+', 'Ranged DMG+', false],
    rangedRange: ['远程射程+', 'Range+', true],
    bossDamage: ['首领伤+', 'Boss DMG+', false],
    burnRatio: ['灼烧+', 'Burn+', false],
    startOranges: ['开局橘子+', 'Oranges+', true],
    tubSlow: ['浴池减速+', 'Tub Slow+', false],
    magicDamage: ['法系伤+', 'Magic DMG+', false],
    chargeReduction: ['充能-', 'Charge-', true],
    shovelSpeed: ['铁锹提速+', 'Shovel+', false],
    beeSpeed: ['蜜蜂产粮+', 'Bee+', false],
    veteranDamage: ['高星伤+', 'High-Lv DMG+', false],
    globalSlow: ['全路减速+', 'Global Slow+', false],
    coinBonus: ['金币+', 'Coins+', false],
    dropBonus: ['掉率+', 'Drops+', false],
    allDamage: ['全队伤+', 'All DMG+', false],
    allRate: ['全队攻速+', 'All SPD+', false],
    momentumBonus: ['战意获取+', 'Spirit+', false],
  };
  const out: string[] = [];
  for (const [k, vals] of Object.entries(def.effects) as Array<[BrothEffectKey, readonly [number, number, number]]>) {
    const [z, e, isNum] = labels[k];
    const v = vals[i];
    out.push(`${zh ? z : e}${isNum ? v : `${Math.round(v * 100)}%`}`);
  }
  return out.slice(0, 3).join(' · ');
}
