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
  drawHinokiBoard,
  drawHoneyOakTab,
  drawIconLabel,
  drawIvorySlab,
  drawMatchaSignboard,
  drawSpriteContain,
  drawText,
  drawYuzuCloseButton,
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
 * 1:1 P18 Carved Hinoki-Wood Capybara Onsen Village (水豚温泉山庄)
 * Panoramic diorama with live petting residents, harvest basket (`ui_harvest_basket`),
 * peeking village capybara, and mobile-sized facility cards!
 */
export function drawVillageModal(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  profile: Profile,
  villageUi: VillageUiState,
  scroll: ScrollRegion,
): { scrollViewport?: { x: number; y: number; w: number; h: number } } {
  const zh = getLanguage() === 'zh-CN';
  const pw = 1080, ph = 532;
  const px = (1280 - pw) / 2, py = 158;
  const stars = villageStars(profile);
  const tapsLeft = petTapsLeft(profile, localDay(new Date(villageUi.nowMs)));

  drawMatchaSignboard(
    c,
    640,
    18,
    zh ? '水豚温泉山庄' : 'Capybara Onsen Village',
    zh
      ? `木料 ${profile.village.wood} · 精粹 ${profile.village.essence} · 金币 ${profile.coins} · 山庄 ★${stars}/${VILLAGE_MAX_STARS}`
      : `Wood ${profile.village.wood} · Essence ${profile.village.essence} · Coins ${profile.coins} · ★${stars}/${VILLAGE_MAX_STARS}`,
    340,
  );
  drawYuzuCloseButton(c, hits, 'modal:close', px + pw - 22, 52);

  // 2 Honey-Oak Tabs
  const tabY = py - 44;
  drawHoneyOakTab(c, hits, 'village:tab:courtyard', px + 124, tabY, 210, 48, zh ? '温泉庭院' : 'Courtyard', villageUi.tab === 'courtyard');
  drawHoneyOakTab(c, hits, 'village:tab:build', px + 344, tabY, 210, 48, zh ? '设施建造' : 'Facilities', villageUi.tab === 'build');
  drawSpriteContain(c, 'ui_village_peek_capy', px + 12, tabY - 38, 104, 104);

  drawHinokiBoard(c, px, py, pw, ph, 24);
  hits.add({ id: 'modal:card', x: px, y: py, w: pw, h: ph });

  // ── TAB 1: PANORAMIC COURTYARD DIORAMA ────────────────────────────────────
  if (villageUi.tab === 'courtyard') {
    const sx = px + 20, sy = py + 16, sw = pw - 40, sh = ph - 120;
    round(c, sx, sy, sw, sh, 18, '#d4e2bd', '#4a2b16', 3);

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

    for (const facId of FACILITY_IDS) {
      const def = FACILITIES[facId];
      const lv = villageLevel(profile, facId);
      const fx = sx + (def.spot.left / 100) * sw;
      const fy = sy + (def.spot.top / 100) * sh;

      if (lv > 0) {
        drawSpriteContain(c, facId, fx - 64, fy - 64, 128, 128);
        round(c, fx - 66, fy + 38, 132, 26, 13, 'rgba(64,40,18,0.88)', '#f7dc96', 1.8);
        drawText(c, `${t(`facility.${facId}`).slice(0, 5)} ${'★'.repeat(lv)}`, fx, fy + 51, 13.5, '#fff6df', 'center', 900);
      } else {
        hits.add({ id: 'village:tab:build', x: fx - 56, y: fy - 32, w: 112, h: 64 });
        drawIvorySlab(c, fx - 56, fy - 28, 112, 56, 14, 'rgba(255,250,235,0.92)', 'rgba(244,226,188,0.92)', '#6b4522', 2.2);
        drawText(c, `+ ${t(`facility.${facId}`).slice(0, 4)}`, fx, fy - 7, 14.5, PALETTE.ink, 'center', 900);
        drawText(c, zh ? '点击建造' : 'Build', fx, fy + 14, 13.5, PALETTE.tealDark, 'center', 900);
      }
    }

    // Live interactive resident pets & heroes
    const residents = getVillageResidents(profile);
    residents.forEach((res, idx) => {
      const def = FACILITIES[res.facility];
      const angle = (res.slot * 1.4 + idx * 0.7) % (Math.PI * 2);
      const rx = sx + (def.spot.left / 100) * sw + Math.cos(angle) * 62;
      const ry = sy + (def.spot.top / 100) * sh + Math.sin(angle) * 28 + 20;
      const hopped = villageUi.lastPetId === res.id && villageUi.elapsed < villageUi.lastPetUntil;
      const bob = hopped ? -Math.abs(Math.sin((villageUi.lastPetUntil - villageUi.elapsed) * 14)) * 20 : Math.sin(villageUi.elapsed * 2.6 + idx) * 3;
      const size = 60;
      hits.add({ id: `village:pet:${res.id}`, x: rx - size / 2, y: ry - size / 2, w: size, h: size, data: res.id });
      drawSpriteContain(c, res.id, rx - size / 2, ry - size / 2 + bob, size, size);
      if (hopped) {
        drawText(c, '♥ +5', rx, ry - 38, 17, '#fff6c4', 'center', 900, INK, 4);
      }
    });

    round(c, sx + 14, sy + 14, 290, 38, 19, 'rgba(56,36,18,0.84)', 'rgba(246,216,148,0.82)', 1.8);
    drawText(
      c,
      zh ? `摸摸院中萌宠领零花 (${tapsLeft}/${PET_TAP_DAILY_LIMIT})` : `Pat pets for coins (${tapsLeft}/${PET_TAP_DAILY_LIMIT})`,
      sx + 159,
      sy + 33,
      15.5,
      '#fff8e4',
      'center',
      900,
    );
    c.restore();

    // Bottom Offline Harvest Basket Strip (`ui_harvest_basket`!)
    const hy = sy + sh + 12, hh = 80;
    const harvest = computeOfflineHarvest(profile, villageUi.nowMs);
    const ripe = hasHarvest(harvest);

    drawIvorySlab(c, sx, hy, sw, hh, 16, '#fffdf7', '#f5e4c2', '#5c3b1e', 2.4);
    if (!drawSpriteContain(c, 'ui_harvest_basket', sx + 14, hy + 10, 60, 60)) {
      drawSpriteContain(c, 'ui_coin_gold', sx + 16, hy + 14, 52, 52);
    }
    drawText(
      c,
      zh ? `离线温泉收菜篮${harvest.full ? '（已满 12h！）' : ''}` : `Offline Harvest Basket${harvest.full ? ' (FULL!)' : ''}`,
      sx + 86,
      hy + 26,
      19.5,
      PALETTE.ink,
      'left',
      900,
    );
    if (ripe) {
      let cx = sx + 86;
      cx += drawIconLabel(c, 'ui_coin_gold', `+${harvest.coins}`, cx, hy + 55, 22, 18, '#2c763d') + 18;
      if (harvest.fragments) cx += drawIconLabel(c, 'ui_weapon_fragment', `+${harvest.fragments}`, cx, hy + 55, 22, 18, '#8a4510') + 18;
      if (harvest.yuzu) cx += drawIconLabel(c, 'ing_yuzu', `+${harvest.yuzu}`, cx, hy + 55, 22, 18, '#9e6210') + 18;
      if (harvest.tickets) drawIconLabel(c, 'ui_ticket_gacha', `+${harvest.tickets}`, cx, hy + 55, 22, 18, '#c23a2b');
    } else {
      drawText(c, zh ? '山庄正在缓缓积攒收益，过一会儿再来收菜吧～' : 'Your village is gathering offline coins & gifts...', sx + 86, hy + 55, 16, PALETTE.muted, 'left', 800);
    }

    const btnW = villageUi.adDoubleHarvestAvailable && ripe ? 186 : 220;
    drawButton(c, hits, 'village:harvest', sx + sw - btnW - 14, hy + 14, btnW, 52, zh ? '一键收菜' : 'Collect', {
      ...(ripe ? BTN_STYLES.green : BTN_STYLES.muted),
      radius: 15,
      fontSize: 19,
      icon: 'ui_harvest_basket',
      disabled: !ripe,
    });
    if (villageUi.adDoubleHarvestAvailable && ripe) {
      drawButton(c, hits, 'village:ad-harvest', sx + sw - btnW * 2 - 24, hy + 14, btnW, 52, zh ? '双倍收菜' : '2× Ad', {
        ...BTN_STYLES.gold,
        radius: 15,
        fontSize: 18,
      });
    }
    return {};
  }

  // ── TAB 2: 5 FACILITIES BUILD & UPGRADE ───────────────────────────────────
  const vx = px + 20, vy = py + 16, vw = pw - 40, vh = ph - 32;
  c.save();
  c.beginPath();
  c.rect(vx, vy, vw, vh);
  c.clip();

  const ch = 122, gap = 12, pad = 4;
  FACILITY_IDS.forEach((facId, idx) => {
    const lv = villageLevel(profile, facId);
    const cost = facilityUpgradeCost(facId, lv);
    const afford = !!cost && canAffordVillage(profile, cost);
    const rx = vx + pad;
    const ry = vy + pad + idx * (ch + gap) - scroll.offset;
    if (ry + ch < vy - 20 || ry > vy + vh + 20) return;

    drawIvorySlab(c, rx, ry, vw - pad * 2, ch, 18, lv > 0 ? '#fffdf7' : '#f2eadc', lv > 0 ? '#f6e7c7' : '#e6dcc9', afford ? '#4a997e' : '#7a5230', afford ? 2.8 : 2);
    round(c, rx + 14, ry + 15, 92, 92, 16, '#fffdf7', '#8c6239', 2);
    drawSpriteContain(c, facId, rx + 18, ry + 19, 84, 84, lv > 0 ? 1 : 0.6);

    const starStr = lv > 0 ? `${'★'.repeat(lv)}${'☆'.repeat(VILLAGE_MAX_LEVEL - lv)}` : (zh ? '未建造' : 'Not Built');
    drawText(c, `${t(`facility.${facId}`)}   ${starStr}`, rx + 122, ry + 28, 21, PALETTE.ink, 'left', 900);
    drawText(c, formatFacilityBuffSummary(facId, Math.max(1, lv), zh), rx + 122, ry + 60, 16, PALETTE.tealDark, 'left', 800);

    if (cost) {
      let cx = rx + 122;
      cx += drawIconLabel(c, 'res_onsen_wood', `${profile.village.wood}/${cost.wood}`, cx, ry + 94, 24, 16, profile.village.wood >= cost.wood ? '#2c763d' : '#b83c2c') + 22;
      cx += drawIconLabel(c, 'res_yuzu_essence', `${profile.village.essence}/${cost.essence}`, cx, ry + 94, 24, 16, profile.village.essence >= cost.essence ? '#2c763d' : '#b83c2c') + 22;
      if (cost.coins > 0) {
        drawIconLabel(c, 'ui_coin_gold', `${cost.coins}`, cx, ry + 94, 24, 16, profile.coins >= cost.coins ? PALETTE.ink : '#b83c2c');
      }
    } else {
      drawText(c, zh ? '★ 已达满级（永久加成已满！）' : '★ Max Level Reached!', rx + 122, ry + 94, 16.5, '#8a4c10', 'left', 900);
    }

    if (ry + ch > vy && ry < vy + vh) {
      if (cost) {
        const label = lv === 0 ? (zh ? '建造 Lv.1' : 'Build Lv.1') : (zh ? `升级 Lv.${lv + 1}` : `Up Lv.${lv + 1}`);
        drawButton(c, hits, `village:build:${facId}`, rx + vw - pad * 2 - 178, ry + 34, 162, 54, label, {
          ...(afford ? BTN_STYLES.green : BTN_STYLES.muted),
          radius: 15,
          fontSize: 18,
          disabled: !afford,
        });
      } else {
        round(c, rx + vw - pad * 2 - 140, ry + 38, 124, 44, 14, '#f5df9c', PALETTE.goldDark, 2);
        drawText(c, 'MAX ★', rx + vw - pad * 2 - 78, ry + 61, 17, '#7a450c', 'center', 900);
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
  const parts: string[] = [zh ? `金币 ${def.coinsPerHour[idx]}/时` : `${def.coinsPerHour[idx]}/h`];
  const b = def.buffs;
  if (b.damage?.[idx]) parts.push(zh ? `全队伤 +${Math.round(b.damage[idx] * 100)}%` : `DMG +${Math.round(b.damage[idx] * 100)}%`);
  if (b.rate?.[idx]) parts.push(zh ? `攻速 +${Math.round(b.rate[idx] * 100)}%` : `SPD +${Math.round(b.rate[idx] * 100)}%`);
  if (b.startFood?.[idx]) parts.push(zh ? `开局鱼干 +${b.startFood[idx]}` : `Food +${b.startFood[idx]}`);
  if (b.startOranges?.[idx]) parts.push(zh ? `开局橘子 +${b.startOranges[idx]}` : `Oranges +${b.startOranges[idx]}`);
  if (b.bossDamage?.[idx]) parts.push(zh ? `首领伤 +${Math.round(b.bossDamage[idx] * 100)}%` : `Boss +${Math.round(b.bossDamage[idx] * 100)}%`);
  if (b.bossFragment?.[idx]) parts.push(zh ? `碎片掉率 +${Math.round(b.bossFragment[idx] * 100)}%` : `Drops +${Math.round(b.bossFragment[idx] * 100)}%`);
  if (b.coinBonus?.[idx]) parts.push(zh ? `金币 +${Math.round(b.coinBonus[idx] * 100)}%` : `Coins +${Math.round(b.coinBonus[idx] * 100)}%`);
  return parts.join('  ·  ');
}

/**
 * 1:1 P18 Carved Hinoki-Wood Onsen Kitchen (温泉料理屋 — matches p19_07_kitchen_tier4_broths.png!)
 * Peeking Chef Capybara, Matcha Signboard, Honey-Oak Tier Tabs, Big Ingredient Pantry, Sculpted Ivory Broth Cards!
 */
export function drawKitchenModal(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  profile: Profile,
  kitchen: KitchenUiState,
  scroll: ScrollRegion,
): { scrollViewport: { x: number; y: number; w: number; h: number } } {
  const zh = getLanguage() === 'zh-CN';
  const pw = 1080, ph = 532;
  const px = (1280 - pw) / 2, py = 158;
  const aura = getKitchenCollectionAura(profile);

  drawMatchaSignboard(
    c,
    640,
    18,
    zh ? '温泉料理屋' : 'Onsen Kitchen',
    zh
      ? `配方 ${aura.unlockedCount}/14 · 全员攻击 +${(aura.damageBonus * 100).toFixed(1)}% · 攻速 +${Math.round(aura.rateBonus * 100)}%`
      : `Recipes ${aura.unlockedCount}/14 · Team DMG +${(aura.damageBonus * 100).toFixed(1)}% · SPD +${Math.round(aura.rateBonus * 100)}%`,
    320,
  );
  drawYuzuCloseButton(c, hits, 'modal:close', px + pw - 22, 52);

  // Honey-Oak Tier Tabs perched at top edge of wooden board
  const tabY = py - 44;
  const tiers: Array<{ id: KitchenUiState['tier']; label: string }> = [
    { id: 'all', label: zh ? '全部 (14)' : 'All (14)' },
    { id: 1, label: zh ? 'T1 清汤' : 'Tier 1' },
    { id: 2, label: zh ? 'T2 秘汤' : 'Tier 2' },
    { id: 3, label: zh ? 'T3 珍汤' : 'Tier 3' },
    { id: 4, label: zh ? 'T4 传说' : 'Tier 4' },
  ];
  tiers.forEach((tr, i) => {
    drawHoneyOakTab(c, hits, `kitchen:tier:${tr.id}`, px + 116 + i * 144, tabY, 136, 48, tr.label, kitchen.tier === tr.id);
  });

  // Peeking Chef Capybara
  drawSpriteContain(c, 'ui_kitchen_peek_capy', px + 10, tabY - 38, 102, 102);

  drawHinokiBoard(c, px, py, pw, ph, 24);
  hits.add({ id: 'modal:card', x: px, y: py, w: pw, h: ph });

  // Top Ingredient Pantry Strip + Buy Basket Button
  const barY = py + 14;
  drawIvorySlab(c, px + 20, barY, pw - 40, 56, 15, '#fffdf7', '#f4e3bf', '#7a5230', 2);
  INGREDIENT_IDS.forEach((ingId, idx) => {
    const ix = px + 30 + idx * 126;
    const count = profile.ingredients?.[ingId] ?? 0;
    drawSpriteContain(c, ingId, ix, barY + 9, 38, 38);
    drawText(c, `×${count}`, ix + 44, barY + 29, 19, count > 0 ? PALETTE.ink : PALETTE.muted, 'left', 900);
  });

  const canBuyBasket = profile.coins >= INGREDIENT_BASKET_PRICE;
  drawButton(c, hits, 'kitchen:basket', px + pw - 266, barY + 6, 236, 44, zh ? `购3份食材 (${INGREDIENT_BASKET_PRICE})` : `3 Ingredients (${INGREDIENT_BASKET_PRICE})`, {
    ...(canBuyBasket ? BTN_STYLES.gold : BTN_STYLES.muted),
    radius: 13,
    fontSize: 15.5,
    icon: 'ui_coin_gold',
    disabled: !canBuyBasket,
  });

  // Scrollable 2-Column Broth Cards (larger fonts for mobile!)
  const vx = px + 20, vy = barY + 66, vw = pw - 40, vh = ph - 96;
  const visible = BROTH_IDS.filter(id => kitchen.tier === 'all' || BROTHS[id].tier === kitchen.tier);

  c.save();
  c.beginPath();
  c.rect(vx, vy, vw, vh);
  c.clip();

  const cols = 2, gap = 12, pad = 4;
  const cw = Math.floor((vw - pad * 2 - gap) / cols);
  const ch = 148;

  visible.forEach((brothId, idx) => {
    const def = BROTHS[brothId];
    const lv = getBrothLevel(profile, brothId);
    const active = profile.activeBrothId === brothId;
    const cost = getBrothUpgradeCost(brothId, lv);
    const afford = !!cost && canAffordIngredients(profile, cost);

    const col = idx % cols, row = Math.floor(idx / cols);
    const rx = vx + pad + col * (cw + gap);
    const ry = vy + pad + row * (ch + gap) - scroll.offset;
    if (ry + ch < vy - 20 || ry > vy + vh + 20) return;

    drawIvorySlab(
      c,
      rx,
      ry,
      cw,
      ch,
      18,
      active ? '#e9fae0' : lv > 0 ? '#fffdf7' : '#f2eadc',
      active ? '#d4f2c4' : lv > 0 ? '#f6e7c7' : '#e6dcc9',
      active ? '#3c8532' : def.tier === 4 ? '#c77a14' : '#7a5230',
      active || def.tier === 4 ? 3 : 2,
    );

    round(c, rx + 14, ry + 18, 86, 86, 18, def.bathColor, '#5c3b1e', 2.4);
    drawSpriteContain(c, brothId, rx + 18, ry + 22, 78, 78, lv > 0 ? 1 : 0.78);

    const stars = lv > 0 ? '★'.repeat(lv) : `T${def.tier}`;
    drawText(c, `${t(`broth.${brothId}`)}  ${stars}`, rx + 112, ry + 26, 19.5, PALETTE.ink, 'left', 900);
    drawText(c, formatBrothEffectSummary(brothId, Math.max(1, lv), zh), rx + 112, ry + 54, 15, PALETTE.tealDark, 'left', 800);

    // Ingredient cost chips
    if (cost) {
      const costEntries = Object.entries(cost) as Array<[IngredientId, number]>;
      let cx = rx + 112;
      for (const [ingId, req] of costEntries.slice(0, 4)) {
        const have = profile.ingredients?.[ingId] ?? 0;
        const ok = have >= req;
        drawSpriteContain(c, ingId, cx, ry + 70, 26, 26);
        drawText(c, `${have}/${req}`, cx + 28, ry + 84, 14, ok ? '#2c763d' : '#b83c2c', 'left', 900);
        cx += 78;
      }
    } else {
      drawText(c, zh ? '★ 已熬至满级 Lv.3' : '★ Mastered Lv.3', rx + 112, ry + 84, 15.5, '#8a4c10', 'left', 900);
    }

    if (ry + ch > vy && ry < vy + vh) {
      const btnY = ry + ch - 44;
      if (lv === 0) {
        drawButton(c, hits, `kitchen:brew:${brothId}`, rx + cw - 146, btnY, 132, 36, zh ? '熬制解锁' : 'Brew Lv.1', {
          ...(afford ? BTN_STYLES.green : BTN_STYLES.muted),
          radius: 11,
          fontSize: 15.5,
          disabled: !afford,
        });
      } else {
        drawButton(c, hits, `kitchen:equip:${brothId}`, rx + cw - 134, btnY, 120, 36, active ? (zh ? '✓ 泡澡中' : '✓ Active') : (zh ? '设为汤底' : 'Equip'), {
          ...(active ? BTN_STYLES.teal : BTN_STYLES.gold),
          radius: 11,
          fontSize: 15.5,
        });
        if (cost) {
          drawButton(c, hits, `kitchen:upgrade:${brothId}`, rx + cw - 262, btnY, 120, 36, zh ? `升级 Lv.${lv + 1}` : `Up Lv.${lv + 1}`, {
            ...(afford ? BTN_STYLES.green : BTN_STYLES.muted),
            radius: 11,
            fontSize: 15,
            disabled: !afford,
          });
        }
      }
    }
  });

  const contentH = pad * 2 + Math.ceil(visible.length / cols) * (ch + gap);
  c.restore();
  scroll.setContentBounds(contentH, vh);
  drawScrollbar(c, vx, vy, vw, vh, contentH, scroll);

  return { scrollViewport: { x: vx, y: vy, w: vw, h: vh } };
}

function formatBrothEffectSummary(id: BrothId, lv: number, zh: boolean): string {
  const def = BROTHS[id];
  const i = Math.max(0, Math.min(2, lv - 1));
  const labels: Record<BrothEffectKey, [string, string, boolean]> = {
    startFood: ['开局鱼干+', 'Food+', true],
    waveIncome: ['每波鱼干+', 'Wave+', true],
    meleeDamage: ['近战伤+', 'Melee+', false],
    meleeRate: ['近战速+', 'MSPD+', false],
    heroRefund: ['合英雄返+', 'Refund+', true],
    rangedDamage: ['远程伤+', 'Ranged+', false],
    rangedRange: ['射程+', 'Range+', true],
    bossDamage: ['首领伤+', 'Boss+', false],
    burnRatio: ['灼烧+', 'Burn+', false],
    startOranges: ['橘子+', 'Orange+', true],
    tubSlow: ['浴池减速+', 'Slow+', false],
    magicDamage: ['法系伤+', 'Magic+', false],
    chargeReduction: ['充能-', 'Chg-', true],
    shovelSpeed: ['铁锹提速+', 'Dig+', false],
    beeSpeed: ['蜜蜂产粮+', 'Bee+', false],
    veteranDamage: ['高星伤+', 'Vet+', false],
    globalSlow: ['全路减速+', 'Slow+', false],
    coinBonus: ['金币+', 'Coins+', false],
    dropBonus: ['掉率+', 'Drops+', false],
    allDamage: ['全队伤+', 'DMG+', false],
    allRate: ['全队速+', 'SPD+', false],
    momentumBonus: ['战意+', 'Spirit+', false],
  };
  const out: string[] = [];
  for (const [k, vals] of Object.entries(def.effects) as Array<[BrothEffectKey, readonly [number, number, number]]>) {
    const [z, e, isNum] = labels[k];
    const v = vals[i];
    out.push(`${zh ? z : e}${isNum ? v : `${Math.round(v * 100)}%`}`);
  }
  return out.slice(0, 3).join(' · ');
}
