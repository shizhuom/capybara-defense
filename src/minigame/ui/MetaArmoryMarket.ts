import { HERO_FAMILIES, RARITY_RULES, WEAPONS, type WeaponDefinition, type WeaponFamily } from '../../config/weapons';
import { META_PRICES, PROPS } from '../../config/props';
import type { LotteryPrize } from '../../core/MetaProgression';
import type { Profile } from '../../core/types';
import { getLanguage, t } from '../../i18n/i18n';
import { round } from '../../render/StickerArt';
import {
  BTN_STYLES,
  PALETTE,
  ScrollRegion,
  drawButton,
  drawProgressBar,
  drawSpriteContain,
  drawText,
  drawWoodPanel,
  drawWrappedText,
  type UiHitManager,
} from './CanvasUI';

export const RARITY_COLORS = ['#8f8272', '#4c9e52', '#3d7ec7', '#8b52bf', '#d97a16'] as const;
export const RARITY_BG = ['#f4eee2', '#e7f5e5', '#e4effa', '#f1e7fa', '#fff1d4'] as const;
const RARITY_ZH = ['白品', '绿品', '蓝品', '紫品', '橙品传说'] as const;
const RARITY_EN = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'] as const;

export interface ArmoryState {
  family: 'all' | WeaponFamily;
  selectedId: string;
}

export interface MarketState {
  tab: 'shop' | 'gacha' | 'backpack';
  prizes: LotteryPrize[];
  lastPrizeIndex: number | null;
  lastPrizeLabel: string;
  adRefreshAvailable: boolean;
  adGachaAvailable: boolean;
}

/**
 * Hub #1: Weapon Workshop (神兵锻造坊)
 * Full 36-weapon grid, family tabs, fragment progress, surplus recycling, and per-hero equip/unequip.
 */
export function drawArmoryModal(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  profile: Profile,
  armory: ArmoryState,
  scroll: ScrollRegion,
): { scrollViewport: { x: number; y: number; w: number; h: number } } {
  const zh = getLanguage() === 'zh-CN';
  const pw = 1040, ph = 626;
  const px = (1280 - pw) / 2, py = (720 - ph) / 2;

  drawWoodPanel(c, px, py, pw, ph, 24, PALETTE.cream, PALETTE.woodDark);
  hits.add({ id: 'modal:card', x: px, y: py, w: pw, h: ph });

  // Header
  drawSpriteContain(c, 'ui_weapon_fragment', px + 24, py + 16, 44, 44);
  drawText(c, t('p5.page.armory'), px + 76, py + 31, 24, PALETTE.ink, 'left', 900);
  drawText(
    c,
    zh
      ? `已锻造 ${profile.unlockedWeapons.length}/36 · 🪙 ${profile.coins}`
      : `Forged ${profile.unlockedWeapons.length}/36 · 🪙 ${profile.coins}`,
    px + 76,
    py + 55,
    13,
    PALETTE.inkSoft,
    'left',
    800,
  );

  // Surplus fragment recycle count
  let surplusCoins = 0;
  for (const id of profile.unlockedWeapons) {
    const w = WEAPONS[id];
    if (!w) continue;
    const rule = RARITY_RULES[w.rarity];
    const surplus = Math.max(0, (profile.weaponFragments[id] ?? 0) - rule.fragments);
    surplusCoins += surplus * rule.recycle;
  }
  drawButton(
    c,
    hits,
    'armory:recycle',
    px + pw - 270,
    py + 18,
    198,
    40,
    surplusCoins > 0
      ? (zh ? `♻ 分解多余 (+${surplusCoins}🪙)` : `♻ Recycle (+${surplusCoins}🪙)`)
      : (zh ? '♻ 无多余碎片' : '♻ No Surplus'),
    {
      ...(surplusCoins > 0 ? BTN_STYLES.gold : BTN_STYLES.muted),
      radius: 12,
      fontSize: 13,
      disabled: surplusCoins <= 0,
    },
  );
  drawButton(c, hits, 'modal:close', px + pw - 56, py + 18, 38, 38, '×', {
    ...BTN_STYLES.cream,
    radius: 12,
    fontSize: 22,
  });

  // Family Filter Tabs
  const families: Array<{ id: 'all' | WeaponFamily; label: string }> = [
    { id: 'all', label: zh ? '全部 (36)' : 'All (36)' },
    { id: 'melee', label: zh ? '⚔️ 近战 (12)' : '⚔️ Melee' },
    { id: 'ranged', label: zh ? '🏹 远程 (12)' : '🏹 Ranged' },
    { id: 'magic', label: zh ? '✨ 法系 (12)' : '✨ Magic' },
  ];
  const ty = py + 76;
  families.forEach((f, idx) => {
    drawButton(c, hits, `armory:family:${f.id}`, px + 24 + idx * 144, ty, 134, 38, f.label, {
      ...(armory.family === f.id ? BTN_STYLES.gold : BTN_STYLES.cream),
      radius: 12,
      fontSize: 13.5,
    });
  });

  const allWeapons = Object.values(WEAPONS).filter(w => armory.family === 'all' || w.family === armory.family);
  const selected: WeaponDefinition = WEAPONS[armory.selectedId] ?? allWeapons[0] ?? Object.values(WEAPONS)[0];

  // Equipped lookup: weaponId -> heroId
  const wornBy = new Map<string, string>();
  for (const [hero, wid] of Object.entries(profile.equippedWeapons)) wornBy.set(wid, hero);

  // Left Scrollable Weapon Grid (3 columns)
  const vx = px + 24, vy = ty + 48, vw = 626, vh = ph - 148;
  round(c, vx, vy, vw, vh, 16, '#fff8ea', PALETTE.woodLight, 1.8);

  c.save();
  c.beginPath();
  c.rect(vx + 2, vy + 2, vw - 4, vh - 4);
  c.clip();

  const cols = 3, gap = 10, pad = 12;
  const cw = Math.floor((vw - pad * 2 - gap * (cols - 1)) / cols);
  const ch = 102;
  allWeapons.forEach((w, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const rx = vx + pad + col * (cw + gap);
    const ry = vy + pad + row * (ch + gap) - scroll.offset;
    if (ry + ch < vy - 20 || ry > vy + vh + 20) return;

    const unlocked = profile.unlockedWeapons.includes(w.id);
    const need = RARITY_RULES[w.rarity].fragments;
    const have = profile.weaponFragments[w.id] ?? 0;
    const isSel = w.id === selected.id;
    const wearer = wornBy.get(w.id);

    // Only register hit inside visible viewport
    if (ry + ch > vy && ry < vy + vh) {
      hits.add({ id: `armory:select:${w.id}`, x: rx, y: Math.max(vy, ry), w: cw, h: Math.min(ry + ch, vy + vh) - Math.max(vy, ry), data: w.id });
    }

    const rColor = RARITY_COLORS[w.rarity];
    round(c, rx, ry, cw, ch, 14, isSel ? '#ffe6a3' : unlocked ? RARITY_BG[w.rarity] : '#ebe4d6', isSel ? '#c25711' : rColor, isSel ? 3 : 2);
    if (!drawSpriteContain(c, `weapon_${w.id}`, rx + 10, ry + 14, 54, 54, unlocked ? 1 : 0.45)) {
      drawSpriteContain(c, 'ui_weapon_fragment', rx + 10, ry + 14, 54, 54, unlocked ? 1 : 0.45);
    }

    const name = zh ? w.name['zh-CN'] : w.name.en;
    drawText(c, name.length > 7 ? `${name.slice(0, 7)}…` : name, rx + 70, ry + 24, 13.5, unlocked ? PALETTE.ink : PALETTE.muted, 'left', 900);
    drawText(c, zh ? RARITY_ZH[w.rarity] : RARITY_EN[w.rarity], rx + 70, ry + 44, 11, rColor, 'left', 800);

    if (unlocked) {
      const surplus = Math.max(0, have - need);
      drawText(c, wearer ? `✓ ${t(`hero.${wearer}`).slice(0, 5)}` : surplus > 0 ? `✓ (+${surplus})` : (zh ? '✓ 已拥有' : '✓ Owned'), rx + 70, ry + 66, 11.5, wearer ? '#2c763d' : PALETTE.inkSoft, 'left', 800);
    } else {
      drawProgressBar(c, rx + 70, ry + 58, cw - 82, 10, have / need, rColor, 'rgba(72,46,24,0.16)', 'transparent');
      drawText(c, `${have}/${need}`, rx + cw - 12, ry + 82, 11, PALETTE.inkSoft, 'right', 800);
    }

    // Mini hero badge if equipped
    if (wearer) {
      round(c, rx + cw - 34, ry + ch - 34, 28, 28, 14, '#fff6df', '#3b8747', 2);
      drawSpriteContain(c, wearer, rx + cw - 32, ry + ch - 32, 24, 24);
    }
  });

  const rows = Math.ceil(allWeapons.length / cols);
  const contentH = pad * 2 + rows * (ch + gap);
  c.restore();
  scroll.setContentBounds(contentH, vh);
  drawScrollbar(c, vx, vy, vw, vh, contentH, scroll);

  // Right Weapon Inspector & Hero Equip Panel
  const dx = vx + vw + 16, dy = vy, dw = pw - vw - 64, dh = vh;
  round(c, dx, dy, dw, dh, 18, '#fff7e5', PALETTE.woodMid, 2);

  const unlocked = profile.unlockedWeapons.includes(selected.id);
  const rule = RARITY_RULES[selected.rarity];
  const have = profile.weaponFragments[selected.id] ?? 0;
  const rColor = RARITY_COLORS[selected.rarity];

  round(c, dx + 16, dy + 16, 86, 86, 16, RARITY_BG[selected.rarity], rColor, 2.5);
  if (!drawSpriteContain(c, `weapon_${selected.id}`, dx + 22, dy + 22, 74, 74, unlocked ? 1 : 0.5)) {
    drawSpriteContain(c, 'ui_weapon_fragment', dx + 22, dy + 22, 74, 74);
  }
  drawText(c, zh ? selected.name['zh-CN'] : selected.name.en, dx + 114, dy + 34, 19, PALETTE.ink, 'left', 900);
  round(c, dx + 114, dy + 50, 88, 22, 11, rColor, 'transparent', 0);
  drawText(c, zh ? RARITY_ZH[selected.rarity] : RARITY_EN[selected.rarity], dx + 158, dy + 61, 11, '#fffdf5', 'center', 900);
  drawText(
    c,
    zh ? `基础伤害 +${Math.round(rule.damageBonus * 100)}%` : `Base DMG +${Math.round(rule.damageBonus * 100)}%`,
    dx + 114,
    dy + 88,
    13,
    '#8c4510',
    'left',
    900,
  );

  // Description
  round(c, dx + 16, dy + 114, dw - 32, 116, 14, '#f6e7c7', PALETTE.woodLight, 1.5);
  drawWrappedText(c, zh ? selected.description['zh-CN'] : selected.description.en, dx + 28, dy + 126, dw - 56, 13, 19, PALETTE.ink, 'left', 700, 5);

  // Status / Fragment progress
  const sy = dy + 242;
  if (!unlocked) {
    drawText(c, zh ? `碎片进度：${have} / ${rule.fragments}（击败首领或扭蛋获取）` : `Fragments: ${have}/${rule.fragments} (Bosses & Gacha)`, dx + 18, sy + 10, 12.5, PALETTE.inkSoft, 'left', 800);
    drawProgressBar(c, dx + 18, sy + 24, dw - 36, 14, have / rule.fragments, rColor, 'rgba(72,46,24,0.18)', PALETTE.woodDark);
  } else {
    const wearer = wornBy.get(selected.id);
    drawText(
      c,
      wearer
        ? t('p6.equipWorn', { hero: t(`hero.${wearer}`) })
        : t('p6.equipIdle'),
      dx + 18,
      sy + 14,
      13,
      wearer ? '#2c763d' : PALETTE.inkSoft,
      'left',
      800,
    );
  }

  // Matching-Family Heroes (4 buttons to tap-equip / tap-unequip)
  const matchingHeroes = Object.entries(HERO_FAMILIES)
    .filter(([, fam]) => fam === selected.family)
    .map(([heroId]) => heroId);

  const hy = dy + 290;
  drawText(c, zh ? '同系英雄穿戴（点头像装备/卸下）：' : 'Compatible Heroes (tap to equip):', dx + 18, hy, 13, PALETTE.ink, 'left', 900);

  const hw = Math.floor((dw - 48) / 2);
  const hh = 72;
  matchingHeroes.forEach((heroId, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const hx = dx + 16 + col * (hw + 12);
    const hhy = hy + 18 + row * (hh + 10);
    const equippedHere = profile.equippedWeapons[heroId] === selected.id;
    const isSig = selected.signatureHero === heroId;

    if (unlocked) {
      hits.add({ id: `armory:equip:${heroId}:${selected.id}`, x: hx, y: hhy, w: hw, h: hh, data: { heroId, weaponId: selected.id, equippedHere } });
    }
    round(
      c,
      hx,
      hhy,
      hw,
      hh,
      14,
      equippedHere ? '#dff5d8' : unlocked ? '#fff4d9' : '#eae2d3',
      equippedHere ? '#3b8747' : isSig ? '#d97a16' : PALETTE.woodMid,
      equippedHere || isSig ? 2.5 : 1.8,
    );
    drawSpriteContain(c, heroId, hx + 8, hhy + 10, 50, 50, unlocked ? 1 : 0.45);
    drawText(c, t(`hero.${heroId}`), hx + 64, hhy + 25, 13.5, unlocked ? PALETTE.ink : PALETTE.muted, 'left', 900);
    drawText(
      c,
      equippedHere ? (zh ? '✓ 已佩戴' : '✓ Worn') : isSig ? (zh ? '★ 专属觉醒' : '★ Signature') : (zh ? '点击穿戴' : 'Tap equip'),
      hx + 64,
      hhy + 47,
      11.5,
      equippedHere ? '#2c763d' : isSig ? '#b85c0b' : PALETTE.inkSoft,
      'left',
      800,
    );
  });

  return { scrollViewport: { x: vx, y: vy, w: vw, h: vh } };
}

/**
 * Hub #2: Raccoon Market (浣熊黑市 — Daily Shop, Lucky Gacha, Prop Backpack)
 */
export function drawMarketModal(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  profile: Profile,
  market: MarketState,
  scroll: ScrollRegion,
): { scrollViewport?: { x: number; y: number; w: number; h: number } } {
  const zh = getLanguage() === 'zh-CN';
  const pw = 1000, ph = 616;
  const px = (1280 - pw) / 2, py = (720 - ph) / 2;

  drawWoodPanel(c, px, py, pw, ph, 24, PALETTE.cream, PALETTE.woodDark);
  hits.add({ id: 'modal:card', x: px, y: py, w: pw, h: ph });

  // Header
  drawSpriteContain(c, 'ui_shop_bag', px + 24, py + 16, 44, 44);
  drawText(c, t('p5.page.market'), px + 76, py + 31, 24, PALETTE.ink, 'left', 900);
  drawText(
    c,
    `🪙 ${profile.coins}   ·   🎟️ ${profile.freeLotteryTickets}   ·   ${zh ? `再赢 ${3 - (profile.gachaWinCounter ?? 0)} 局送免费券` : `${3 - (profile.gachaWinCounter ?? 0)} wins to free ticket`}`,
    px + 76,
    py + 55,
    13,
    PALETTE.inkSoft,
    'left',
    800,
  );
  drawButton(c, hits, 'modal:close', px + pw - 56, py + 18, 38, 38, '×', {
    ...BTN_STYLES.cream,
    radius: 12,
    fontSize: 22,
  });

  // 3 Tabs
  const ty = py + 76;
  const tabs: Array<{ id: MarketState['tab']; label: string }> = [
    { id: 'shop', label: zh ? '🏪 今日货摊' : '🏪 Daily Shop' },
    { id: 'gacha', label: zh ? `🎰 幸运扭蛋${profile.freeLotteryTickets > 0 ? ` (${profile.freeLotteryTickets})` : ''}` : `🎰 Gacha${profile.freeLotteryTickets > 0 ? ` (${profile.freeLotteryTickets})` : ''}` },
    { id: 'backpack', label: zh ? `🎒 道具背包 (${Object.keys(profile.ownedProps).length})` : `🎒 Backpack (${Object.keys(profile.ownedProps).length})` },
  ];
  tabs.forEach((tb, i) => {
    drawButton(c, hits, `market:tab:${tb.id}`, px + 28 + i * 212, ty, 200, 42, tb.label, {
      ...(market.tab === tb.id ? BTN_STYLES.gold : BTN_STYLES.cream),
      radius: 13,
      fontSize: 15,
    });
  });

  const by = ty + 54;
  const bh = ph - 154;

  // ── TAB 1: DAILY SHOP ─────────────────────────────────────────────────────
  if (market.tab === 'shop') {
    const offers = profile.shop?.offers ?? [];
    if (offers.length === 0) {
      round(c, px + 28, by, pw - 56, bh - 76, 18, '#fff7e5', PALETTE.woodLight, 1.8);
      drawText(c, zh ? '🎉 今日货摊全部道具已买满！' : '🎉 All shop props owned at max level!', px + pw / 2, by + 160, 20, PALETTE.inkSoft, 'center', 800);
    } else {
      const cw = Math.floor((pw - 56 - 28) / 3);
      const ch = bh - 78;
      offers.forEach((propId, i) => {
        const prop = PROPS[propId];
        if (!prop) return;
        const cx = px + 28 + i * (cw + 14);
        const rColor = RARITY_COLORS[prop.rarity];
        const lv = profile.ownedProps[propId] ?? 0;
        const afford = profile.coins >= prop.price;

        round(c, cx, by, cw, ch, 18, '#fff8ea', rColor, 2.5);
        round(c, cx + 16, by + 14, 72, 24, 12, prop.type === 'active' ? '#d96b45' : '#4e9b86', 'transparent', 0);
        drawText(c, prop.type === 'active' ? (zh ? '主动道具' : 'Active') : (zh ? '被动光环' : 'Passive'), cx + 52, by + 26, 11.5, '#fffdf5', 'center', 900);
        drawText(c, `Lv.${lv}/${prop.maxLevel}`, cx + cw - 18, by + 26, 12, PALETTE.inkSoft, 'right', 800);

        round(c, cx + cw / 2 - 44, by + 50, 88, 88, 20, RARITY_BG[prop.rarity], rColor, 2);
        if (!drawSpriteContain(c, `prop_${propId}`, cx + cw / 2 - 36, by + 58, 72, 72)) {
          drawText(c, prop.icon, cx + cw / 2, by + 96, 44, PALETTE.ink, 'center', 700);
        }

        drawText(c, zh ? prop.name['zh-CN'] : prop.name.en, cx + cw / 2, by + 158, 18, PALETTE.ink, 'center', 900);
        drawWrappedText(c, zh ? prop.description['zh-CN'] : prop.description.en, cx + 18, by + 178, cw - 36, 13, 19, PALETTE.inkSoft, 'left', 600, 5);

        drawButton(c, hits, `market:buy:${propId}`, cx + 22, by + ch - 64, cw - 44, 48, `🪙 ${prop.price} ${zh ? '购买' : 'Buy'}`, {
          ...(afford ? BTN_STYLES.green : BTN_STYLES.muted),
          radius: 14,
          fontSize: 16,
          disabled: !afford,
        });
      });
    }

    // Bottom Refresh Bar
    const ry = by + bh - 56;
    drawButton(c, hits, 'market:refresh', px + 28, ry, 250, 50, `🔄 ${t('p6.refresh')} (🪙 ${META_PRICES.shopRefresh})`, {
      ...(profile.coins >= META_PRICES.shopRefresh ? BTN_STYLES.gold : BTN_STYLES.muted),
      radius: 14,
      fontSize: 16,
      disabled: profile.coins < META_PRICES.shopRefresh,
    });
    if (market.adRefreshAvailable) {
      drawButton(c, hits, 'market:ad-refresh', px + 294, ry, 250, 50, zh ? '🎬 看视频免费刷新' : '🎬 Free Ad Refresh', {
        ...BTN_STYLES.teal,
        radius: 14,
        fontSize: 15,
      });
    }
    return {};
  }

  // ── TAB 2: LUCKY 9-GRID GACHA ─────────────────────────────────────────────
  if (market.tab === 'gacha') {
    const gx = px + 28, gy = by, gw = 560, gh = bh;
    round(c, gx, gy, gw, gh, 18, '#fff7e5', PALETTE.woodMid, 2);

    // 3×3 grid: 8 outer prize tiles + center Spin button!
    const ringOrder = [0, 1, 2, 7, -1, 3, 6, 5, 4];
    const pad = 16, gap = 10;
    const tw = Math.floor((gw - pad * 2 - gap * 2) / 3);
    const th = Math.floor((gh - pad * 2 - gap * 2) / 3);

    ringOrder.forEach((prizeIdx, cellIdx) => {
      const col = cellIdx % 3;
      const row = Math.floor(cellIdx / 3);
      const tx = gx + pad + col * (tw + gap);
      const ty2 = gy + pad + row * (th + gap);

      if (prizeIdx === -1) {
        const useTicket = profile.freeLotteryTickets > 0;
        const canSpin = useTicket || profile.coins >= META_PRICES.lottery;
        drawButton(
          c,
          hits,
          'market:spin',
          tx,
          ty2,
          tw,
          th,
          useTicket ? (zh ? `🎟️ 免费扭一次\n(剩 ${profile.freeLotteryTickets} 张)` : `🎟️ Free Spin\n(${profile.freeLotteryTickets} left)`) : (zh ? `🎰 扭一次\n🪙 ${META_PRICES.lottery}` : `🎰 Spin\n🪙 ${META_PRICES.lottery}`),
          {
            ...(canSpin ? BTN_STYLES.green : BTN_STYLES.muted),
            radius: 18,
            fontSize: 16,
            disabled: !canSpin,
          },
        );
        return;
      }

      const prize = market.prizes[prizeIdx];
      const wonHere = market.lastPrizeIndex === prizeIdx;
      round(c, tx, ty2, tw, th, 16, wonHere ? '#ffe48a' : '#f7ebd1', wonHere ? '#c95c14' : PALETTE.woodLight, wonHere ? 3.2 : 1.8);
      if (!prize) return;

      if (prize.type === 'coins') {
        drawSpriteContain(c, 'ui_coin_gold', tx + tw / 2 - 28, ty2 + 12, 56, 56);
        drawText(c, `🪙 +${prize.amount}`, tx + tw / 2, ty2 + th - 26, 16, '#874a10', 'center', 900);
      } else if (prize.type === 'prop' && prize.id) {
        const prop = PROPS[prize.id];
        if (!drawSpriteContain(c, `prop_${prize.id}`, tx + tw / 2 - 28, ty2 + 12, 56, 56)) {
          drawText(c, prop?.icon ?? '🎁', tx + tw / 2, ty2 + 44, 34, PALETTE.ink, 'center', 700);
        }
        const name = prop ? (zh ? prop.name['zh-CN'] : prop.name.en) : prize.id;
        drawText(c, name.length > 7 ? `${name.slice(0, 7)}…` : name, tx + tw / 2, ty2 + th - 26, 13.5, PALETTE.ink, 'center', 900);
      } else if (prize.type === 'fragment' && prize.id) {
        const w = WEAPONS[prize.id];
        if (!drawSpriteContain(c, `weapon_${prize.id}`, tx + tw / 2 - 28, ty2 + 12, 56, 56)) {
          drawSpriteContain(c, 'ui_weapon_fragment', tx + tw / 2 - 28, ty2 + 12, 56, 56);
        }
        const wName = w ? (zh ? w.name['zh-CN'] : w.name.en) : prize.id;
        drawText(c, `${wName.slice(0, 6)}碎片`, tx + tw / 2, ty2 + th - 26, 12.5, w ? RARITY_COLORS[w.rarity] : PALETTE.ink, 'center', 900);
      }
    });

    // Right Info & Last Pull Panel
    const rx = gx + gw + 18, rw = pw - gw - 74;
    round(c, rx, gy, rw, gh, 18, '#fff7e5', PALETTE.woodMid, 2);
    drawSpriteContain(c, 'ui_ticket_gacha', rx + rw / 2 - 36, gy + 22, 72, 72);
    drawText(c, t('p5.lotteryAwning'), rx + rw / 2, gy + 114, 18, PALETTE.ink, 'center', 900);
    drawWrappedText(
      c,
      zh
        ? '每累计赢得 3 场胜利赠送 1 张免费扭蛋券！奖池包含随机道具、金币以及紫品/橙品神兵碎片。重复满级道具自动折算等额金币！'
        : 'Every 3 battle wins earns 1 Free Gacha Ticket! Win props, coins, and Epic/Legendary weapon fragments. Maxed duplicates convert to coins!',
      rx + 22,
      gy + 136,
      rw - 44,
      13.5,
      20,
      PALETTE.inkSoft,
      'left',
      600,
      5,
    );

    if (market.lastPrizeLabel) {
      round(c, rx + 20, gy + 266, rw - 40, 74, 14, '#e4f6db', '#428738', 2);
      drawText(c, zh ? '🎉 上次抽中' : '🎉 Latest Pull', rx + rw / 2, gy + 288, 13, '#2b6b22', 'center', 800);
      drawText(c, market.lastPrizeLabel, rx + rw / 2, gy + 316, 16, PALETTE.ink, 'center', 900);
    }

    if (market.adGachaAvailable) {
      drawButton(c, hits, 'market:ad-gacha', rx + 24, gy + gh - 72, rw - 48, 52, zh ? '🎬 看视频免费抽 1 次' : '🎬 Watch Ad · Free Spin', {
        ...BTN_STYLES.teal,
        radius: 15,
        fontSize: 15,
      });
    }
    return {};
  }

  // ── TAB 3: PROP BACKPACK ──────────────────────────────────────────────────
  const ownedIds = Object.keys(profile.ownedProps).filter(id => (profile.ownedProps[id] ?? 0) > 0 && PROPS[id]);

  // Top slot summary strip
  round(c, px + 28, by, pw - 56, 52, 14, '#f3e2be', PALETTE.woodLight, 1.8);
  drawText(
    c,
    zh
      ? `主动出战槽：${profile.equippedActiveProps.length} / 2     ·     被动光环槽：${profile.equippedPassiveProps.length} / 6（点道具直接上阵/卸下）`
      : `Active Slots: ${profile.equippedActiveProps.length}/2   ·   Passive Slots: ${profile.equippedPassiveProps.length}/6 (Tap to toggle)`,
    px + pw / 2,
    by + 27,
    14,
    PALETTE.ink,
    'center',
    900,
  );

  const vx = px + 28, vy = by + 62, vw = pw - 56, vh = bh - 62;
  round(c, vx, vy, vw, vh, 16, '#fff8ea', PALETTE.woodLight, 1.8);

  if (ownedIds.length === 0) {
    drawText(c, zh ? '背包空空如也，去「今日货摊」或「幸运扭蛋」逛逛吧！' : 'No props owned yet — visit Daily Shop or Lucky Gacha!', vx + vw / 2, vy + vh / 2, 17, PALETTE.muted, 'center', 700);
    return { scrollViewport: { x: vx, y: vy, w: vw, h: vh } };
  }

  c.save();
  c.beginPath();
  c.rect(vx + 2, vy + 2, vw - 4, vh - 4);
  c.clip();

  const cols = 2, gap = 12, pad = 14;
  const cw = Math.floor((vw - pad * 2 - gap) / cols);
  const ch = 104;
  ownedIds.forEach((propId, i) => {
    const prop = PROPS[propId];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const rx = vx + pad + col * (cw + gap);
    const ry = vy + pad + row * (ch + gap) - scroll.offset;
    if (ry + ch < vy - 20 || ry > vy + vh + 20) return;

    const equipped = prop.type === 'active'
      ? profile.equippedActiveProps.includes(propId)
      : profile.equippedPassiveProps.includes(propId);
    const lv = profile.ownedProps[propId] ?? 1;

    round(c, rx, ry, cw, ch, 14, equipped ? '#e6f6de' : '#f7ebd1', equipped ? '#408735' : PALETTE.woodLight, equipped ? 2.5 : 1.6);
    if (!drawSpriteContain(c, `prop_${propId}`, rx + 12, ry + 18, 60, 60)) {
      drawText(c, prop.icon, rx + 42, ry + 50, 34, PALETTE.ink, 'center', 700);
    }
    const typeTag = prop.type === 'active' ? (zh ? '[主动]' : '[Act]') : (zh ? '[被动]' : '[Pas]');
    drawText(c, `${typeTag} ${zh ? prop.name['zh-CN'] : prop.name.en} Lv.${lv}`, rx + 82, ry + 24, 14.5, PALETTE.ink, 'left', 900);
    drawWrappedText(c, zh ? prop.description['zh-CN'] : prop.description.en, rx + 82, ry + 40, cw - 196, 11.5, 15.5, PALETTE.inkSoft, 'left', 600, 3);

    if (ry + ch > vy && ry < vy + vh) {
      drawButton(c, hits, `market:equip:${propId}`, rx + cw - 104, ry + 28, 90, 44, equipped ? (zh ? '已上阵' : 'Equipped') : (zh ? '上阵' : 'Equip'), {
        ...(equipped ? BTN_STYLES.coral : BTN_STYLES.teal),
        radius: 12,
        fontSize: 13.5,
      });
    }
  });

  const rows = Math.ceil(ownedIds.length / cols);
  const contentH = pad * 2 + rows * (ch + gap);
  c.restore();
  scroll.setContentBounds(contentH, vh);
  drawScrollbar(c, vx, vy, vw, vh, contentH, scroll);

  return { scrollViewport: { x: vx, y: vy, w: vw, h: vh } };
}

export function drawScrollbar(
  c: CanvasRenderingContext2D,
  vx: number,
  vy: number,
  vw: number,
  vh: number,
  contentH: number,
  scroll: ScrollRegion,
): void {
  if (scroll.maxOffset <= 4) return;
  const trackH = vh - 24;
  const thumbH = Math.max(34, trackH * (vh / Math.max(vh, contentH)));
  const thumbY = vy + 12 + (scroll.offset / scroll.maxOffset) * (trackH - thumbH);
  round(c, vx + vw - 10, thumbY, 6, thumbH, 3, 'rgba(122,82,48,0.45)', 'transparent', 0);
}
