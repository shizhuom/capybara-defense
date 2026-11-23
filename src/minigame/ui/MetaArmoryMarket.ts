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
  drawHinokiBoard,
  drawHoneyOakTab,
  drawIconLabel,
  drawIvorySlab,
  drawMatchaSignboard,
  drawProgressBar,
  drawShopAwning,
  drawSpriteContain,
  drawText,
  drawWrappedText,
  drawYuzuCloseButton,
  type UiHitManager,
} from './CanvasUI';

export const RARITY_COLORS = ['#8c7d6b', '#499c4f', '#387ac4', '#8b52bf', '#d97a16'] as const;
export const RARITY_BG = ['#faf6ee', '#ecf8ea', '#eaf3fc', '#f4ecfc', '#fff4dc'] as const;
const RARITY_ZH = ['白 · 普通', '绿 · 精良', '蓝 · 稀有', '紫 · 史诗', '橙 · 传说'] as const;
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
 * 1:1 P18 Carved Hinoki-Wood Weapon Workshop (神兵工坊 — matches p19_04_armory_step1_guide.png!).
 * Mobile-balanced typography (16–30px) + peeking capybara blacksmith + honey-oak tabs + sculpted ivory cards.
 */
export function drawArmoryModal(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  profile: Profile,
  armory: ArmoryState,
  scroll: ScrollRegion,
): { scrollViewport: { x: number; y: number; w: number; h: number } } {
  const zh = getLanguage() === 'zh-CN';
  const pw = 1080, ph = 532;
  const px = (1280 - pw) / 2, py = 158;

  // Matcha Signboard + Peeking Mascot + Yuzu Close
  drawMatchaSignboard(
    c,
    640,
    18,
    zh ? '神兵工坊' : 'Weapon Workshop',
    zh ? `已解锁 ${profile.unlockedWeapons.length}/36  ·  金币 ${profile.coins}` : `Unlocked ${profile.unlockedWeapons.length}/36 · Coins ${profile.coins}`,
    310,
  );
  drawYuzuCloseButton(c, hits, 'modal:close', px + pw - 22, 52);

  // Surplus fragment recycle button perched cleanly near top-right
  let surplusCoins = 0;
  for (const id of profile.unlockedWeapons) {
    const w = WEAPONS[id];
    if (!w) continue;
    const rule = RARITY_RULES[w.rarity];
    const surplus = Math.max(0, (profile.weaponFragments[id] ?? 0) - rule.fragments);
    surplusCoins += surplus * rule.recycle;
  }
  if (surplusCoins > 0) {
    drawButton(c, hits, 'armory:recycle', px + pw - 266, 30, 206, 44, zh ? `分解多余 +${surplusCoins}` : `Recycle +${surplusCoins}`, {
      ...BTN_STYLES.gold,
      radius: 15,
      fontSize: 16.5,
      icon: 'ui_coin_gold',
    });
  }

  // Honey-Oak Bookmark Tabs straddling the top edge of the hinoki board
  const families: Array<{ id: 'all' | WeaponFamily; label: string }> = [
    { id: 'all', label: zh ? '全部 (36)' : 'All (36)' },
    { id: 'melee', label: zh ? '近战' : 'Melee' },
    { id: 'ranged', label: zh ? '远程' : 'Ranged' },
    { id: 'magic', label: zh ? '魔法' : 'Magic' },
  ];
  const tabY = py - 44;
  const tabW = 148;
  families.forEach((f, idx) => {
    drawHoneyOakTab(c, hits, `armory:family:${f.id}`, px + 116 + idx * (tabW + 10), tabY, tabW, 48, f.label, armory.family === f.id);
  });

  // Peeking Capybara Blacksmith perched at top-left of board
  drawSpriteContain(c, 'ui_armory_peek_capy', px + 10, tabY - 38, 102, 102);

  // Carved Hinoki-Wood Board
  drawHinokiBoard(c, px, py, pw, ph, 24);
  hits.add({ id: 'modal:card', x: px, y: py, w: pw, h: ph });

  const allWeapons = Object.values(WEAPONS).filter(w => armory.family === 'all' || w.family === armory.family);
  const selected: WeaponDefinition = WEAPONS[armory.selectedId] ?? allWeapons[0] ?? Object.values(WEAPONS)[0];
  const wornBy = new Map<string, string>();
  for (const [hero, wid] of Object.entries(profile.equippedWeapons)) wornBy.set(wid, hero);

  // Left Scrollable Weapon List (2 big mobile-readable columns of ivory slabs!)
  const vx = px + 18, vy = py + 16, vw = 626, vh = ph - 32;
  c.save();
  c.beginPath();
  c.rect(vx, vy, vw, vh);
  c.clip();

  const cols = 2, gap = 12, pad = 4;
  const cw = Math.floor((vw - pad * 2 - gap) / cols);
  const ch = 114;

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
    const rColor = RARITY_COLORS[w.rarity];

    if (ry + ch > vy && ry < vy + vh) {
      hits.add({ id: `armory:select:${w.id}`, x: rx, y: Math.max(vy, ry), w: cw, h: Math.min(ry + ch, vy + vh) - Math.max(vy, ry), data: w.id });
    }

    drawIvorySlab(
      c,
      rx,
      ry,
      cw,
      ch,
      16,
      isSel ? '#fff4c4' : unlocked ? '#fffdf8' : '#efe7d8',
      isSel ? '#f7d87c' : unlocked ? RARITY_BG[w.rarity] : '#e4dac7',
      isSel ? '#d16a10' : rColor,
      isSel ? 3.5 : 2.4,
    );

    // Weapon Icon Box
    round(c, rx + 12, ry + 17, 78, 78, 16, '#fffdf7', rColor, 2.2);
    if (!drawSpriteContain(c, `weapon_${w.id}`, rx + 16, ry + 21, 70, 70, unlocked ? 1 : 0.48)) {
      drawSpriteContain(c, 'ui_weapon_fragment', rx + 16, ry + 21, 70, 70, unlocked ? 1 : 0.48);
    }

    const name = zh ? w.name['zh-CN'] : w.name.en;
    drawText(c, name.length > 7 ? `${name.slice(0, 7)}…` : name, rx + 102, ry + 28, 19, unlocked ? PALETTE.ink : PALETTE.muted, 'left', 900);
    drawText(c, zh ? RARITY_ZH[w.rarity] : RARITY_EN[w.rarity], rx + 102, ry + 54, 15, rColor, 'left', 800);

    if (unlocked) {
      const statusText = wearer
        ? `✓ ${t(`hero.${wearer}`).slice(0, 5)}`
        : (zh ? '已解锁 · 可穿戴' : 'Unlocked');
      drawText(c, statusText, rx + 102, ry + 84, 15, wearer ? '#2c763d' : '#7a4814', 'left', 900);
    } else {
      drawProgressBar(c, rx + 102, ry + 76, cw - 166, 13, have / need, rColor, 'rgba(72,46,24,0.18)', '#5c3b1e');
      drawText(c, `${have}/${need}`, rx + cw - 12, ry + 83, 15, PALETTE.inkSoft, 'right', 900);
    }

    if (wearer) {
      round(c, rx + cw - 42, ry + ch - 42, 34, 34, 17, '#fffdf6', '#3b8747', 2.2);
      drawSpriteContain(c, wearer, rx + cw - 39, ry + ch - 39, 28, 28);
    }
  });

  const contentH = pad * 2 + Math.ceil(allWeapons.length / cols) * (ch + gap);
  c.restore();
  scroll.setContentBounds(contentH, vh);
  drawScrollbar(c, vx, vy, vw, vh, contentH, scroll);

  // Right Weapon Inspector & Hero Equip Slab (generous phone-readable typography!)
  const dx = vx + vw + 16, dy = vy, dw = pw - vw - 52, dh = vh;
  drawIvorySlab(c, dx, dy, dw, dh, 18, '#fffdf7', '#f5e4c2', '#5c3b1e', 2.8);

  const unlocked = profile.unlockedWeapons.includes(selected.id);
  const rule = RARITY_RULES[selected.rarity];
  const have = profile.weaponFragments[selected.id] ?? 0;
  const rColor = RARITY_COLORS[selected.rarity];

  round(c, dx + 16, dy + 16, 94, 94, 18, RARITY_BG[selected.rarity], rColor, 2.8);
  if (!drawSpriteContain(c, `weapon_${selected.id}`, dx + 22, dy + 22, 82, 82, unlocked ? 1 : 0.5)) {
    drawSpriteContain(c, 'ui_weapon_fragment', dx + 22, dy + 22, 82, 82);
  }
  drawText(c, zh ? selected.name['zh-CN'] : selected.name.en, dx + 122, dy + 36, 23, PALETTE.ink, 'left', 900);
  round(c, dx + 122, dy + 54, 108, 28, 14, rColor, 'transparent', 0);
  drawText(c, zh ? RARITY_ZH[selected.rarity] : RARITY_EN[selected.rarity], dx + 176, dy + 68, 14, '#fffdf5', 'center', 900);
  drawText(c, zh ? `基础伤害 +${Math.round(rule.damageBonus * 100)}%` : `Base DMG +${Math.round(rule.damageBonus * 100)}%`, dx + 122, dy + 98, 16, '#8c4510', 'left', 900);

  // Full Description
  round(c, dx + 16, dy + 122, dw - 32, 128, 14, '#f7ebd1', '#b88c58', 1.8);
  drawWrappedText(c, zh ? selected.description['zh-CN'] : selected.description.en, dx + 28, dy + 134, dw - 56, 16, 23, PALETTE.ink, 'left', 700, 4);

  // Progress or Equip Hint
  const sy = dy + 260;
  if (!unlocked) {
    drawText(c, zh ? `碎片进度：${have} / ${rule.fragments}` : `Fragments: ${have} / ${rule.fragments}`, dx + 18, sy + 12, 16, PALETTE.inkSoft, 'left', 900);
    drawProgressBar(c, dx + 18, sy + 28, dw - 36, 16, have / rule.fragments, rColor, 'rgba(72,46,24,0.18)', '#5c3b1e');
  } else {
    const wearer = wornBy.get(selected.id);
    drawText(c, wearer ? t('p6.equipWorn', { hero: t(`hero.${wearer}`) }) : t('p6.equipIdle'), dx + 18, sy + 16, 16, wearer ? '#2c763d' : PALETTE.inkSoft, 'left', 900);
  }

  // 4 Matching-Family Hero Portrait Buttons (big touch targets!)
  const matchingHeroes = Object.entries(HERO_FAMILIES)
    .filter(([, fam]) => fam === selected.family)
    .map(([heroId]) => heroId);

  const hy = dy + 306;
  const hw = Math.floor((dw - 44) / 2);
  const hh = 84;
  matchingHeroes.forEach((heroId, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const hx = dx + 16 + col * (hw + 12);
    const hhy = hy + row * (hh + 12);
    const equippedHere = profile.equippedWeapons[heroId] === selected.id;
    const isSig = selected.signatureHero === heroId;

    if (unlocked) {
      hits.add({ id: `armory:equip:${heroId}:${selected.id}`, x: hx, y: hhy, w: hw, h: hh, data: { heroId, weaponId: selected.id, equippedHere } });
    }
    drawIvorySlab(
      c,
      hx,
      hhy,
      hw,
      hh,
      15,
      equippedHere ? '#e7f8de' : unlocked ? '#fffaf0' : '#eae2d3',
      equippedHere ? '#ccf0bc' : unlocked ? '#f4e2bc' : '#ddd3c0',
      equippedHere ? '#3b8747' : isSig ? '#d97a16' : '#7a5230',
      equippedHere || isSig ? 2.8 : 2,
    );
    drawSpriteContain(c, heroId, hx + 8, hhy + 12, 58, 58, unlocked ? 1 : 0.42);
    drawText(c, t(`hero.${heroId}`), hx + 72, hhy + 28, 16.5, unlocked ? PALETTE.ink : PALETTE.muted, 'left', 900);
    drawText(
      c,
      equippedHere ? (zh ? '✓ 已佩戴' : '✓ Worn') : isSig ? (zh ? '★ 专属' : '★ Sign.') : (zh ? '点穿戴' : 'Equip'),
      hx + 72,
      hhy + 56,
      14.5,
      equippedHere ? '#2c763d' : isSig ? '#b85c0b' : PALETTE.inkSoft,
      'left',
      800,
    );
  });

  return { scrollViewport: { x: vx, y: vy, w: vw, h: vh } };
}

/**
 * 1:1 P18 Carved Hinoki-Wood Raccoon Market (浣熊黑市 & 扭蛋)
 * Features peeking raccoon shopkeeper, striped red-cream shop awning, honey-oak tabs, and big mobile fonts!
 */
export function drawMarketModal(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  profile: Profile,
  market: MarketState,
  scroll: ScrollRegion,
): { scrollViewport?: { x: number; y: number; w: number; h: number } } {
  const zh = getLanguage() === 'zh-CN';
  const pw = 1040, ph = 532;
  const px = (1280 - pw) / 2, py = 158;

  drawMatchaSignboard(
    c,
    640,
    18,
    t('p5.page.market'),
    zh
      ? `金币 ${profile.coins}  ·  扭蛋券 ${profile.freeLotteryTickets}  ·  再赢 ${3 - (profile.gachaWinCounter ?? 0)} 局送免费券`
      : `Coins ${profile.coins} · Tickets ${profile.freeLotteryTickets} · ${3 - (profile.gachaWinCounter ?? 0)} wins to ticket`,
    340,
  );
  drawYuzuCloseButton(c, hits, 'modal:close', px + pw - 22, 52);

  // 3 Honey-Oak Bookmark Tabs
  const tabY = py - 44;
  const tabs: Array<{ id: MarketState['tab']; label: string }> = [
    { id: 'shop', label: zh ? '今日货摊' : 'Daily Shop' },
    { id: 'gacha', label: zh ? `幸运扭蛋${profile.freeLotteryTickets > 0 ? ` (${profile.freeLotteryTickets})` : ''}` : `Gacha${profile.freeLotteryTickets > 0 ? ` (${profile.freeLotteryTickets})` : ''}` },
    { id: 'backpack', label: zh ? `道具背包 (${Object.keys(profile.ownedProps).length})` : `Backpack (${Object.keys(profile.ownedProps).length})` },
  ];
  tabs.forEach((tb, i) => {
    drawHoneyOakTab(c, hits, `market:tab:${tb.id}`, px + 124 + i * 224, tabY, 212, 48, tb.label, market.tab === tb.id);
  });

  // Peeking Raccoon Shopkeeper
  drawSpriteContain(c, 'ui_market_peek_raccoon', px + 14, tabY - 38, 102, 102);

  // Carved Hinoki Board
  drawHinokiBoard(c, px, py, pw, ph, 24);
  hits.add({ id: 'modal:card', x: px, y: py, w: pw, h: ph });

  // ── TAB 1: DAILY SHOP (with cozy striped red-cream awning!) ───────────────
  if (market.tab === 'shop') {
    drawShopAwning(c, px + 18, py + 12, pw - 36, 22);
    const offers = profile.shop?.offers ?? [];
    const by = py + 44;
    const ch = ph - 122;

    if (offers.length === 0) {
      drawIvorySlab(c, px + 24, by, pw - 48, ch, 18);
      drawText(c, zh ? '今日货摊全部道具已买满！' : 'All shop props maxed out!', 640, by + ch / 2, 24, PALETTE.inkSoft, 'center', 900);
    } else {
      const cw = Math.floor((pw - 48 - 28) / 3);
      offers.forEach((propId, i) => {
        const prop = PROPS[propId];
        if (!prop) return;
        const cx = px + 24 + i * (cw + 14);
        const rColor = RARITY_COLORS[prop.rarity];
        const lv = profile.ownedProps[propId] ?? 0;
        const afford = profile.coins >= prop.price;

        drawIvorySlab(c, cx, by, cw, ch, 18, '#fffdf7', '#f7ebd1', rColor, 2.8);
        round(c, cx + 14, by + 14, 94, 28, 14, prop.type === 'active' ? '#d96b45' : '#4e9b86', 'transparent', 0);
        drawText(c, prop.type === 'active' ? (zh ? '主动道具' : 'Active') : (zh ? '被动光环' : 'Passive'), cx + 61, by + 28, 14, '#fffdf5', 'center', 900);
        drawText(c, `Lv.${lv}/${prop.maxLevel}`, cx + cw - 16, by + 28, 15, PALETTE.inkSoft, 'right', 900);

        round(c, cx + cw / 2 - 46, by + 50, 92, 92, 20, RARITY_BG[prop.rarity], rColor, 2.4);
        if (!drawSpriteContain(c, `prop_${propId}`, cx + cw / 2 - 38, by + 58, 76, 76)) {
          drawText(c, prop.icon, cx + cw / 2, by + 98, 46, PALETTE.ink, 'center', 700);
        }

        drawText(c, zh ? prop.name['zh-CN'] : prop.name.en, cx + cw / 2, by + 164, 21, PALETTE.ink, 'center', 900);
        drawWrappedText(c, zh ? prop.description['zh-CN'] : prop.description.en, cx + 18, by + 186, cw - 36, 15.5, 22, PALETTE.inkSoft, 'left', 700, 5);

        drawButton(c, hits, `market:buy:${propId}`, cx + 20, by + ch - 68, cw - 40, 52, `${prop.price} ${zh ? '购买' : 'Buy'}`, {
          ...(afford ? BTN_STYLES.green : BTN_STYLES.muted),
          radius: 15,
          fontSize: 19,
          icon: 'ui_coin_gold',
          disabled: !afford,
        });
      });
    }

    const ry = py + ph - 66;
    drawButton(c, hits, 'market:refresh', px + 24, ry, 250, 50, `${t('p6.refresh')} (${META_PRICES.shopRefresh})`, {
      ...(profile.coins >= META_PRICES.shopRefresh ? BTN_STYLES.gold : BTN_STYLES.muted),
      radius: 15,
      fontSize: 18,
      icon: 'ui_coin_gold',
      disabled: profile.coins < META_PRICES.shopRefresh,
    });
    if (market.adRefreshAvailable) {
      drawButton(c, hits, 'market:ad-refresh', px + 288, ry, 256, 50, zh ? '看视频免费刷新' : 'Free Ad Refresh', {
        ...BTN_STYLES.teal,
        radius: 15,
        fontSize: 17,
      });
    }
    return {};
  }

  // ── TAB 2: LUCKY 9-GRID GACHA ─────────────────────────────────────────────
  if (market.tab === 'gacha') {
    const gx = px + 22, gy = py + 18, gw = 588, gh = ph - 36;
    drawIvorySlab(c, gx, gy, gw, gh, 18, '#fffdf7', '#f5e4c2', '#5c3b1e', 2.6);

    const ringOrder = [0, 1, 2, 7, -1, 3, 6, 5, 4];
    const pad = 14, gap = 10;
    const tw = Math.floor((gw - pad * 2 - gap * 2) / 3);
    const th = Math.floor((gh - pad * 2 - gap * 2) / 3);

    ringOrder.forEach((prizeIdx, cellIdx) => {
      const col = cellIdx % 3, row = Math.floor(cellIdx / 3);
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
          useTicket
            ? (zh ? `免费扭一次\n(剩 ${profile.freeLotteryTickets} 张)` : `Free Spin\n(${profile.freeLotteryTickets} left)`)
            : (zh ? `扭一次\n${META_PRICES.lottery} 金币` : `Spin\n${META_PRICES.lottery} Coins`),
          {
            ...(canSpin ? BTN_STYLES.green : BTN_STYLES.muted),
            radius: 18,
            fontSize: 20,
            disabled: !canSpin,
          },
        );
        return;
      }

      const prize = market.prizes[prizeIdx];
      const wonHere = market.lastPrizeIndex === prizeIdx;
      drawIvorySlab(
        c,
        tx,
        ty2,
        tw,
        th,
        16,
        wonHere ? '#fff0a8' : '#fffdf8',
        wonHere ? '#f7cf54' : '#f4e2bc',
        wonHere ? '#c95c14' : '#8a6038',
        wonHere ? 3.5 : 2,
      );
      if (!prize) return;

      if (prize.type === 'coins') {
        drawSpriteContain(c, 'ui_coin_gold', tx + tw / 2 - 34, ty2 + 12, 68, 68);
        drawText(c, `+${prize.amount}`, tx + tw / 2, ty2 + th - 26, 21, '#874a10', 'center', 900);
      } else if (prize.type === 'prop' && prize.id) {
        const prop = PROPS[prize.id];
        if (!drawSpriteContain(c, `prop_${prize.id}`, tx + tw / 2 - 34, ty2 + 10, 68, 68)) {
          drawText(c, prop?.icon ?? '🎁', tx + tw / 2, ty2 + 48, 40, PALETTE.ink, 'center', 700);
        }
        const name = prop ? (zh ? prop.name['zh-CN'] : prop.name.en) : prize.id;
        drawText(c, name.length > 6 ? `${name.slice(0, 6)}…` : name, tx + tw / 2, ty2 + th - 24, 16.5, PALETTE.ink, 'center', 900);
      } else if (prize.type === 'fragment' && prize.id) {
        const w = WEAPONS[prize.id];
        if (!drawSpriteContain(c, `weapon_${prize.id}`, tx + tw / 2 - 34, ty2 + 10, 68, 68)) {
          drawSpriteContain(c, 'ui_weapon_fragment', tx + tw / 2 - 34, ty2 + 10, 68, 68);
        }
        const wName = w ? (zh ? w.name['zh-CN'] : w.name.en) : prize.id;
        drawText(c, `${wName.slice(0, 5)}碎片`, tx + tw / 2, ty2 + th - 24, 15.5, w ? RARITY_COLORS[w.rarity] : PALETTE.ink, 'center', 900);
      }
    });

    // Right Info & Last Pull Panel
    const rx = gx + gw + 18, rw = pw - gw - 62;
    drawIvorySlab(c, rx, gy, rw, gh, 18, '#fffdf7', '#f5e4c2', '#5c3b1e', 2.6);
    drawSpriteContain(c, 'ui_ticket_gacha', rx + rw / 2 - 44, gy + 20, 88, 88);
    drawText(c, t('p5.lotteryAwning'), rx + rw / 2, gy + 128, 21, PALETTE.ink, 'center', 900);
    drawWrappedText(
      c,
      zh
        ? '每累计赢得 3 场胜利赠送 1 张免费扭蛋券！可抽出实用道具、大量金币与紫品/橙品神兵碎片，满级重复道具自动返还等额金币！'
        : 'Every 3 wins earns 1 Free Ticket! Win props, coins & Epic/Legendary fragments. Maxed duplicates refund full coins!',
      rx + 22,
      gy + 154,
      rw - 44,
      16,
      23,
      PALETTE.inkSoft,
      'left',
      700,
      5,
    );

    if (market.lastPrizeLabel) {
      round(c, rx + 20, gy + 296, rw - 40, 84, 16, '#e4f6db', '#428738', 2.4);
      drawText(c, zh ? '上次抽中' : 'Latest Pull', rx + rw / 2, gy + 322, 16, '#2b6b22', 'center', 900);
      drawText(c, market.lastPrizeLabel, rx + rw / 2, gy + 354, 19, PALETTE.ink, 'center', 900);
    }

    if (market.adGachaAvailable) {
      drawButton(c, hits, 'market:ad-gacha', rx + 22, gy + gh - 72, rw - 44, 54, zh ? '看视频免费抽 1 次' : 'Watch Ad · Free Spin', {
        ...BTN_STYLES.teal,
        radius: 15,
        fontSize: 17,
      });
    }
    return {};
  }

  // ── TAB 3: PROP BACKPACK ──────────────────────────────────────────────────
  const ownedIds = Object.keys(profile.ownedProps).filter(id => (profile.ownedProps[id] ?? 0) > 0 && PROPS[id]);

  drawIvorySlab(c, px + 22, py + 16, pw - 44, 50, 14, '#fffdf7', '#f3e2be', '#7a5230', 2);
  drawText(
    c,
    zh
      ? `主动出战槽：${profile.equippedActiveProps.length} / 2     ·     被动光环槽：${profile.equippedPassiveProps.length} / 6`
      : `Active Slots: ${profile.equippedActiveProps.length}/2   ·   Passive Slots: ${profile.equippedPassiveProps.length}/6`,
    px + pw / 2,
    py + 42,
    18,
    PALETTE.ink,
    'center',
    900,
  );

  const vx = px + 22, vy = py + 76, vw = pw - 44, vh = ph - 94;
  if (ownedIds.length === 0) {
    drawIvorySlab(c, vx, vy, vw, vh, 16);
    drawText(c, zh ? '背包空空如也，去「今日货摊」或「幸运扭蛋」逛逛吧！' : 'No props owned yet — visit Daily Shop or Gacha!', vx + vw / 2, vy + vh / 2, 20, PALETTE.muted, 'center', 800);
    return { scrollViewport: { x: vx, y: vy, w: vw, h: vh } };
  }

  c.save();
  c.beginPath();
  c.rect(vx, vy, vw, vh);
  c.clip();

  const cols = 2, gap = 12, pad = 4;
  const cw = Math.floor((vw - pad * 2 - gap) / cols);
  const ch = 120;
  ownedIds.forEach((propId, i) => {
    const prop = PROPS[propId];
    const col = i % cols, row = Math.floor(i / cols);
    const rx = vx + pad + col * (cw + gap);
    const ry = vy + pad + row * (ch + gap) - scroll.offset;
    if (ry + ch < vy - 20 || ry > vy + vh + 20) return;

    const equipped = prop.type === 'active'
      ? profile.equippedActiveProps.includes(propId)
      : profile.equippedPassiveProps.includes(propId);
    const lv = profile.ownedProps[propId] ?? 1;

    drawIvorySlab(c, rx, ry, cw, ch, 16, equipped ? '#e8f9df' : '#fffdf7', equipped ? '#d4f2c4' : '#f4e2bc', equipped ? '#3c8532' : '#7a5230', equipped ? 2.8 : 2);
    if (!drawSpriteContain(c, `prop_${propId}`, rx + 12, ry + 24, 68, 68)) {
      drawText(c, prop.icon, rx + 46, ry + 60, 40, PALETTE.ink, 'center', 700);
    }
    const typeTag = prop.type === 'active' ? (zh ? '[主动]' : '[Act]') : (zh ? '[被动]' : '[Pas]');
    drawText(c, `${typeTag} ${zh ? prop.name['zh-CN'] : prop.name.en} Lv.${lv}`, rx + 88, ry + 26, 17.5, PALETTE.ink, 'left', 900);
    drawWrappedText(c, zh ? prop.description['zh-CN'] : prop.description.en, rx + 88, ry + 46, cw - 206, 14, 19, PALETTE.inkSoft, 'left', 700, 3);

    if (ry + ch > vy && ry < vy + vh) {
      drawButton(c, hits, `market:equip:${propId}`, rx + cw - 110, ry + 34, 96, 50, equipped ? (zh ? '已上阵' : 'Used') : (zh ? '上阵' : 'Equip'), {
        ...(equipped ? BTN_STYLES.coral : BTN_STYLES.teal),
        radius: 13,
        fontSize: 16.5,
      });
    }
  });

  const contentH = pad * 2 + Math.ceil(ownedIds.length / cols) * (ch + gap);
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
  const trackH = vh - 20;
  const thumbH = Math.max(40, trackH * (vh / Math.max(vh, contentH)));
  const thumbY = vy + 10 + (scroll.offset / scroll.maxOffset) * (trackH - thumbH);
  round(c, vx + vw - 9, thumbY, 7, thumbH, 3.5, 'rgba(255,244,218,0.68)', 'rgba(74,43,22,0.5)', 1);
}

export { drawIconLabel };
