import { META_PRICES, PROPS } from '../../config/props';
import { HERO_FAMILIES, RARITY_RULES, WEAPONS, type WeaponDefinition, type WeaponFamily } from '../../config/weapons';
import type { Profile } from '../../core/types';
import { getLanguage, t } from '../../i18n/i18n';
import { round } from '../../render/StickerArt';
import type { DialogGuideStep } from '../../ui/OnboardingGuide';
import {
  BTN_STYLES,
  PALETTE,
  ScrollRegion,
  drawButton,
  drawDetailNavBar,
  drawIconLabel,
  drawIvorySlab,
  drawLedgerShell,
  drawPillButton,
  drawProgressBar,
  drawScrollbar,
  drawSpriteContain,
  drawText,
  drawWrappedText,
  type UiHitManager,
} from './CanvasUI';
import type { LotteryPrize } from '../../core/MetaProgression';

export type ArmoryTab = 'all' | WeaponFamily | 'recycle';
export type MarketTab = 'shop' | 'backpack' | 'lottery';

export interface ArmoryState {
  family: ArmoryTab;
  detailWeaponId: string | null;
  recycleRarities: number[];
}

export interface MarketState {
  tab: MarketTab;
  merchantQuip: number;
  prizes: LotteryPrize[];
  lastPrizeIndex: number | null;
  lastPrizeLabel: string;
  spunThisVisit: boolean;
  adRefreshAvailable: boolean;
  adGachaAvailable: boolean;
}

const RARITY_COLORS = ['#7a6d62', '#3d8f4e', '#3276b8', '#8345b0', '#cf6e12'] as const;
const RARITY_BG = ['#f4f0e8', '#e5f5e8', '#e4effa', '#f2e8fa', '#fdf0dc'] as const;

export function getSortedArmoryWeapons(profile: Profile, family: ArmoryTab): WeaponDefinition[] {
  return Object.values(WEAPONS)
    .filter(w => family === 'all' || family === 'recycle' || w.family === family)
    .sort((a, b) => Number(profile.unlockedWeapons.includes(b.id)) - Number(profile.unlockedWeapons.includes(a.id)) || b.rarity - a.rarity);
}

/**
 * Strict 1:1 Web Storybook Weapon Armory (`MetaScreens.ts` + `p19_04_armory_step1_guide.png` & `p19_05_armory_done_guide.png`):
 * - 5 equal Honey-Oak tabs: 全部 / 近战 / 远程 / 魔法 / 碎片工坊
 * - Single-column sculpted ivory weapon rows -> tap to open centered Weapon Detail Sheet with 4 horizontal hero equip cards!
 * - Dedicated 碎片工坊 (Fragment Recycle) tab with 5 rarity checkboxes & 1-click recycle button
 * - Live P19 In-Dialog Coaching Strip & golden target pulse!
 */
export function drawArmoryModal(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  profile: Profile,
  armory: ArmoryState,
  scroll: ScrollRegion,
  opts?: {
    inBattle?: boolean;
    preparation?: boolean;
    canSwitchMarket?: boolean;
    guideStep?: DialogGuideStep | null;
    elapsed?: number;
  },
): { scrollViewport?: { x: number; y: number; w: number; h: number } } {
  const zh = getLanguage() === 'zh-CN';
  const elapsed = opts?.elapsed ?? 0;
  const tabDefs: Array<{ id: ArmoryTab; label: string }> = [
    { id: 'all', label: t('p11.meta.family.all') },
    { id: 'melee', label: t('p11.meta.family.melee') },
    { id: 'ranged', label: t('p11.meta.family.ranged') },
    { id: 'magic', label: t('p11.meta.family.magic') },
    { id: 'recycle', label: t('p11.meta.family.recycle') },
  ];

  const body = drawLedgerShell(c, hits, {
    title: t('p11.title.armory'),
    mascot: 'ui_armory_peek_capy',
    badgeSegments: [{ text: t('p11.unlocked', { count: profile.unlockedWeapons.length }) }],
    switchLink: opts?.inBattle && opts?.canSwitchMarket ? { id: 'modal:switch:market', label: `${t('p11.switch.market')} ›` } : undefined,
    tabs: tabDefs.map(tb => ({
      id: `armory:family:${tb.id}`,
      label: tb.label,
      active: armory.family === tb.id,
    })),
    footer1: t('p11.tip.armory.1'),
    footer2: opts?.inBattle ? t(opts.preparation ? 'p11.preparation' : 'p11.nextBattle') : t('p11.tip.armory.2'),
    guideStep: opts?.guideStep,
    elapsed,
  });

  // ── TAB 5: FRAGMENT RECYCLE SUB-PAGE (`碎片工坊`) ─────────────────────────
  if (armory.family === 'recycle') {
    const cx = body.x + 6, cy = body.y + 4, cw = body.w - 12, ch = body.h - 8;
    drawIvorySlab(c, cx, cy, cw, ch, 18);
    drawText(c, t('p11.meta.family.recycle'), cx + cw / 2, cy + 32, 23, PALETTE.ink, 'center', 900);
    drawWrappedText(c, t('m2.recycleRule'), cx + 28, cy + 54, cw - 56, 16, 22, PALETTE.inkSoft, 'center', 700, 2);

    // 5 Rarity Checkbox Rows + recyclable preview counts (fits cleanly even with P19 coaching strip!)
    let totalCoins = 0;
    const rowStartY = cy + 92;
    const availRowsH = ch - 160;
    const rowGap = 7;
    const rowH = Math.min(48, Math.max(38, Math.floor((availRowsH - rowGap * 4) / 5)));
    RARITY_RULES.forEach((rule, rarity) => {
      const ry = rowStartY + rarity * (rowH + rowGap);
      const checked = armory.recycleRarities.includes(rarity);
      let extraFrags = 0;
      for (const w of Object.values(WEAPONS)) {
        if (w.rarity === rarity && profile.unlockedWeapons.includes(w.id)) {
          extraFrags += Math.max(0, (profile.weaponFragments[w.id] ?? 0) - rule.fragments);
        }
      }
      if (checked) totalCoins += extraFrags * rule.recycle;

      hits.add({ id: `armory:recycle-toggle:${rarity}`, x: cx + 28, y: ry, w: cw - 56, h: rowH });
      drawIvorySlab(
        c,
        cx + 28,
        ry,
        cw - 56,
        rowH,
        14,
        checked ? '#fffdf8' : '#efe7d8',
        checked ? RARITY_BG[rarity] : '#e4dac7',
        checked ? RARITY_COLORS[rarity] : '#9e8f7b',
        checked ? 2.4 : 1.6,
      );
      // Checkbox
      const cbY = ry + Math.round((rowH - 26) / 2);
      round(c, cx + 46, cbY, 26, 26, 7, checked ? '#82c943' : '#fffdf7', checked ? '#376b18' : '#7a5230', 2);
      if (checked) drawText(c, '✓', cx + 59, ry + rowH / 2 + 1, 19, '#fffdf7', 'center', 900);

      drawText(c, t(`m2.rarity.${rarity}`), cx + 88, ry + rowH / 2 + 1, 18.5, RARITY_COLORS[rarity], 'left', 900);
      drawText(c, t('m2.recycleRate', { value: rule.recycle }), cx + 258, ry + rowH / 2 + 1, 16, PALETTE.inkSoft, 'left', 800);
      drawText(
        c,
        extraFrags > 0 ? (zh ? `可分解 ${extraFrags} 枚 (+${extraFrags * rule.recycle})` : `${extraFrags} extra (+${extraFrags * rule.recycle})`) : (zh ? '无多余碎片' : 'No extras'),
        cx + cw - 46,
        ry + rowH / 2 + 1,
        15.5,
        extraFrags > 0 ? '#2c763d' : PALETTE.muted,
        'right',
        800,
      );
    });

    const btnLabel = totalCoins > 0
      ? `${t('p11.meta.recycleAction')} (+${totalCoins})`
      : t('p11.meta.recycleAction');
    drawPillButton(c, hits, 'armory:recycle', cx + cw / 2 - 170, cy + ch - 56, 340, 46, btnLabel, totalCoins > 0 ? 'gold' : 'muted', {
      fontSize: 17.5,
      icon: 'ui_coin_gold',
      disabled: totalCoins <= 0,
    });
    return {};
  }

  const weapons = getSortedArmoryWeapons(profile, armory.family);
  const detailWeapon = armory.detailWeaponId ? weapons.find(w => w.id === armory.detailWeaponId) ?? WEAPONS[armory.detailWeaponId] : null;

  // ── WEAPON DETAIL SUB-PAGE (EXACT `p19_05_armory_done_guide.png`!) ────────
  if (detailWeapon) {
    const id = detailWeapon.id;
    const rule = RARITY_RULES[detailWeapon.rarity];
    const have = profile.weaponFragments[id] ?? 0;
    const unlocked = profile.unlockedWeapons.includes(id);
    const idx = weapons.findIndex(w => w.id === id);
    const wearer = Object.keys(profile.equippedWeapons).find(h => profile.equippedWeapons[h] === id);
    const heroes = Object.keys(HERO_FAMILIES).filter(h => HERO_FAMILIES[h] === detailWeapon.family);
    const rColor = RARITY_COLORS[detailWeapon.rarity];

    const navH = drawDetailNavBar(
      c,
      hits,
      'armory:back',
      'armory:prev',
      'armory:next',
      idx >= 0 ? `${idx + 1} / ${weapons.length}` : '—',
      body.x,
      body.y,
      body.w,
      t('p11.meta.back'),
    );

    const vx = body.x, vy = body.y + navH + 8, vw = body.w, vh = body.h - navH - 8;
    c.save();
    c.beginPath();
    c.rect(vx, vy, vw, vh);
    c.clip();

    const cx = vx + 4, cw = vw - 14;
    const y0 = vy + 2 - scroll.offset;
    const hasSig = Boolean(detailWeapon.signatureHero);
    const cardH = hasSig ? 364 : 340;
    drawIvorySlab(c, cx, y0, cw, cardH, 18, '#fffdf8', '#f6e8cb', rColor, 2.4);

    // Compact centered weapon showcase so all 4 hero equip cards stay 100% visible even with P19 coaching banner!
    const fS = 78;
    round(c, cx + cw / 2 - fS / 2, y0 + 10, fS, fS, 16, RARITY_BG[detailWeapon.rarity], rColor, 2.4);
    if (!drawSpriteContain(c, `weapon_${id}`, cx + cw / 2 - 33, y0 + 16, 66, 66, unlocked ? 1 : 0.45)) {
      drawSpriteContain(c, 'ui_weapon_fragment', cx + cw / 2 - 33, y0 + 16, 66, 66, 0.6);
    }

    drawText(c, t(`weapon.${id}`), cx + cw / 2, y0 + 105, 22, PALETTE.ink, 'center', 900);
    drawText(c, `${t(`m2.rarity.${detailWeapon.rarity}`)} · ${t(`p11.meta.family.${detailWeapon.family}`)}`, cx + cw / 2, y0 + 127, 14.5, rColor, 'center', 800);

    // Base damage capsule pill
    round(c, cx + cw / 2 - 80, y0 + 139, 160, 26, 13, '#f0dec0', '#966b3c', 1.6);
    drawText(c, t('m2.damage', { value: Math.round(rule.damageBonus * 100) }), cx + cw / 2, y0 + 153, 14.5, '#59371a', 'center', 900);

    drawWrappedText(c, t(`weapon.${id}.desc`), cx + 32, y0 + 170, cw - 64, 15, 19, PALETTE.ink, 'center', 700, 2);

    let nextY = y0 + 208;
    if (detailWeapon.signatureHero) {
      drawText(c, `★ ${t('m2.signature', { hero: t(`hero.${detailWeapon.signatureHero}`) })}`, cx + cw / 2, nextY, 15, '#b55a0c', 'center', 900);
      nextY += 22;
    }

    // Fragment progress bar + equip hint
    drawText(c, `${t('m2.progress', { count: have, total: rule.fragments })} · ${unlocked ? t('p11.meta.equipHint') : t('p11.meta.fragmentUnlock', { fragments: rule.fragments })}`, cx + cw / 2, nextY + 2, 14.5, PALETTE.inkSoft, 'center', 800);
    drawProgressBar(c, cx + 110, nextY + 14, cw - 220, 8, have / rule.fragments, '#82b354', 'rgba(72,46,24,0.16)', '#694828');
    nextY += 28;

    // 4 Horizontal Matching-Family Hero Portrait Buttons (EXACT `p19_05_armory_done_guide.png`!)
    const hGap = 12;
    const hw = Math.floor((cw - 48 - hGap * 3) / 4);
    const hh = 96;
    const pulseStep2 = opts?.guideStep?.pulseSelector === `[data-action="meta-equip:m01_swatter:kungfu_po"]`;
    heroes.forEach((heroId, i) => {
      const hx = cx + 24 + i * (hw + hGap);
      const equippedHere = wearer === heroId;
      const isSig = detailWeapon.signatureHero === heroId;
      const shouldPulse = pulseStep2 && id === 'm01_swatter' && heroId === 'kungfu_po';

      if (unlocked && nextY + hh > vy && nextY < vy + vh) {
        hits.add({
          id: `armory:equip:${heroId}:${id}`,
          x: hx,
          y: Math.max(vy, nextY),
          w: hw,
          h: Math.min(nextY + hh, vy + vh) - Math.max(vy, nextY),
          data: { heroId, weaponId: id, equippedHere },
        });
      }
      drawIvorySlab(
        c,
        hx,
        nextY,
        hw,
        hh,
        15,
        equippedHere ? '#fff4c4' : unlocked ? '#fffdf8' : '#efe7d8',
        equippedHere ? '#f7df8a' : unlocked ? '#f4e3c0' : '#e2d7c4',
        shouldPulse ? '#e68c19' : equippedHere ? '#c97416' : isSig ? '#d18426' : '#8a6239',
        shouldPulse ? 3.8 : equippedHere || isSig ? 2.6 : 1.8,
      );
      if (shouldPulse) {
        const glow = 0.45 + 0.55 * Math.sin(elapsed * 6);
        round(c, hx - 3, nextY - 3, hw + 6, hh + 6, 17, 'transparent', `rgba(255,204,48,${glow.toFixed(2)})`, 3.5);
      }
      drawSpriteContain(c, heroId, hx + hw / 2 - 22, nextY + 4, 44, 44, unlocked ? 1 : 0.4);
      drawText(c, t(`hero.${heroId}`), hx + hw / 2, nextY + 58, 14.5, unlocked ? PALETTE.ink : PALETTE.muted, 'center', 900);
      if (equippedHere) {
        drawSpriteContain(c, 'ui_storybook_check', hx + hw / 2 - 10, nextY + 70, 20, 20);
      } else if (isSig) {
        drawText(c, t('p11.meta.signatureShort'), hx + hw / 2, nextY + 80, 12.5, '#b55c0e', 'center', 900);
      }
    });

    const contentH = cardH + 16;
    c.restore();
    scroll.setContentBounds(contentH, vh);
    drawScrollbar(c, vx, vy, vw, vh, contentH, scroll);
    return { scrollViewport: { x: vx, y: vy, w: vw, h: vh } };
  }

  // ── SINGLE-COLUMN WEAPON LIST (EXACT `p19_04_armory_step1_guide.png`!) ────
  const vx = body.x, vy = body.y, vw = body.w, vh = body.h;
  c.save();
  c.beginPath();
  c.rect(vx, vy, vw, vh);
  c.clip();

  const wornBy = new Map<string, string>();
  for (const [heroId, weaponId] of Object.entries(profile.equippedWeapons)) {
    if (weaponId) wornBy.set(weaponId, heroId);
  }

  const rowH = 112;
  const gap = 12;
  const rowW = vw - 14;
  const pulseSwatter = opts?.guideStep?.pulseSelector === '[data-action="meta-weapon:m01_swatter"]';

  weapons.forEach((w, idx) => {
    const ry = vy + 4 + idx * (rowH + gap) - scroll.offset;
    if (ry + rowH < vy - 20 || ry > vy + vh + 20) return;

    const unlocked = profile.unlockedWeapons.includes(w.id);
    const wearer = wornBy.get(w.id);
    const rule = RARITY_RULES[w.rarity];
    const have = profile.weaponFragments[w.id] ?? 0;
    const rColor = RARITY_COLORS[w.rarity];
    const shouldPulse = pulseSwatter && w.id === 'm01_swatter';

    if (ry + rowH > vy && ry < vy + vh) {
      hits.add({ id: `armory:open:${w.id}`, x: vx + 4, y: Math.max(vy, ry), w: rowW, h: Math.min(ry + rowH, vy + vh) - Math.max(vy, ry), data: w.id });
    }

    drawIvorySlab(
      c,
      vx + 4,
      ry,
      rowW,
      rowH,
      18,
      shouldPulse ? '#fff9db' : unlocked ? '#fffdf8' : '#f2eadc',
      shouldPulse ? '#fae6a2' : unlocked ? '#f6e8cb' : '#e5dac6',
      shouldPulse ? '#e08b19' : '#7e5530',
      shouldPulse ? 3.6 : 2,
    );

    // Weapon Icon Box
    round(c, vx + 18, ry + 16, 80, 80, 16, RARITY_BG[w.rarity], rColor, 2.2);
    if (!drawSpriteContain(c, `weapon_${w.id}`, vx + 23, ry + 21, 70, 70, unlocked ? 1 : 0.46)) {
      drawSpriteContain(c, 'ui_weapon_fragment', vx + 23, ry + 21, 70, 70, unlocked ? 1 : 0.46);
    }

    // Center Copy
    drawText(c, t(`weapon.${w.id}`), vx + 114, ry + 30, 21.5, unlocked ? PALETTE.ink : PALETTE.muted, 'left', 900);
    drawText(c, `${t(`m2.rarity.${w.rarity}`)} · ${t(`p11.meta.family.${w.family}`)}`, vx + 114, ry + 57, 15.5, rColor, 'left', 800);
    const summary = w.signatureHero ? t('m2.signature', { hero: t(`hero.${w.signatureHero}`) }) : t(`weapon.${w.id}.desc`);
    const line3 = `⚔ +${Math.round(rule.damageBonus * 100)}% · ${summary}`;
    drawText(c, line3.length > 26 ? `${line3.slice(0, 26)}…` : line3, vx + 114, ry + 84, 15.5, PALETTE.inkSoft, 'left', 700);

    // Right Status Column
    const rightCx = vx + 4 + rowW - 64;
    if (wearer) {
      drawSpriteContain(c, wearer, rightCx - 20, ry + 12, 40, 40);
      drawText(c, t('p11.meta.worn'), rightCx, ry + 64, 15, '#2c763d', 'center', 900);
      drawSpriteContain(c, 'ui_storybook_check', rightCx - 12, ry + 76, 24, 24);
    } else if (unlocked) {
      drawText(c, t('p11.meta.unlocked'), rightCx, ry + 34, 15.5, '#2c763d', 'center', 900);
      round(c, rightCx - 44, ry + 54, 88, 34, 17, '#f2e0bc', '#855a2e', 1.8);
      drawText(c, t('p11.meta.equipShort'), rightCx, ry + 72, 16, PALETTE.ink, 'center', 900);
    } else {
      drawText(c, `${have}/${rule.fragments}`, rightCx, ry + 42, 16.5, PALETTE.inkSoft, 'center', 900);
      drawProgressBar(c, rightCx - 48, ry + 62, 96, 10, have / rule.fragments, rColor, 'rgba(72,46,24,0.18)', '#6b4928');
    }
  });

  const contentH = 8 + weapons.length * (rowH + gap);
  c.restore();
  scroll.setContentBounds(contentH, vh);
  drawScrollbar(c, vx, vy, vw, vh, contentH, scroll);
  return { scrollViewport: { x: vx, y: vy, w: vw, h: vh } };
}

/**
 * Strict 1:1 Web Storybook Raccoon Market (`MetaScreens.ts` + `p18_preview_d12_market_lottery.png`):
 * - 3 equal Honey-Oak tabs in EXACT Web order: 每日特惠 / 道具背包 / 幸运扭蛋
 * - Tab 1: Raccoon whisper + Refresh pill + single-column prop offer rows
 * - Tab 2: 2 Active + 6 Passive Loadout Strip + single-column prop rows
 * - Tab 3: Centered single Gacha Machine card (`ui_gacha_machine`) + 3×3 ring + dual Ticket/Coin spin buttons!
 */
export function drawMarketModal(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  profile: Profile,
  market: MarketState,
  scroll: ScrollRegion,
  opts?: {
    inBattle?: boolean;
    preparation?: boolean;
    canSwitchArmory?: boolean;
    guideStep?: DialogGuideStep | null;
    elapsed?: number;
  },
): { scrollViewport?: { x: number; y: number; w: number; h: number } } {
  const zh = getLanguage() === 'zh-CN';
  const elapsed = opts?.elapsed ?? 0;
  const pulseSel = opts?.guideStep?.pulseSelector;

  const body = drawLedgerShell(c, hits, {
    title: t('p11.title.market'),
    mascot: 'ui_market_peek_raccoon',
    badgeSegments: [
      { icon: 'ui_coin_gold', text: String(profile.coins) },
      { text: '·' },
      { icon: 'ui_ticket_gacha', text: String(profile.freeLotteryTickets) },
    ],
    switchLink: opts?.inBattle && opts?.canSwitchArmory ? { id: 'modal:switch:armory', label: `${t('p11.switch.armory')} ›` } : undefined,
    tabs: [
      { id: 'market:tab:shop', label: t('p11.meta.tab.shop'), active: market.tab === 'shop' },
      { id: 'market:tab:backpack', label: t('p11.meta.tab.backpack'), active: market.tab === 'backpack', pulse: pulseSel === '[data-action="meta-tab:backpack"]' },
      { id: 'market:tab:lottery', label: t('p11.meta.tab.lottery'), active: market.tab === 'lottery', pulse: pulseSel === '[data-action="meta-tab:lottery"]' },
    ],
    footer1: t('p11.tip.market.1'),
    footer2: opts?.inBattle ? t(opts.preparation ? 'p11.preparation' : 'p11.nextBattle') : t('p11.tip.market.2'),
    guideStep: opts?.guideStep,
    elapsed,
  });

  // ── TAB 1: DAILY SHOP (`每日特惠`) ─────────────────────────────────────────
  if (market.tab === 'shop') {
    const offers = profile.shop?.offers ?? [];
    const allMaxed = !Object.values(PROPS).some(p => (profile.ownedProps[p.id] ?? 0) < p.maxLevel);
    const whisper = allMaxed ? t('p11.meta.merchantMaxed') : t(`p11.meta.merchant${market.merchantQuip % 3}`);

    // Top Raccoon Whisper Bar + Refresh Pill (EXACT Web `storybook-shop-heading`!)
    const hy = body.y + 2;
    const refreshW = market.adRefreshAvailable ? 168 : 184;
    const adW = market.adRefreshAvailable ? 148 : 0;
    const whisperW = body.w - refreshW - adW - (adW ? 20 : 12);

    hits.add({ id: 'market:merchant', x: body.x + 2, y: hy, w: whisperW, h: 46 });
    drawIvorySlab(c, body.x + 2, hy, whisperW, 46, 16, '#fffaf0', '#f4e3c0', '#855a2e', 1.8);
    drawSpriteContain(c, 'ui_market_peek_raccoon', body.x + 12, hy + 7, 32, 32);
    drawText(c, whisper, body.x + 52, hy + 24, 15.5, PALETTE.ink, 'left', 800);

    const canRefresh = !allMaxed && profile.coins >= META_PRICES.shopRefresh;
    drawPillButton(c, hits, 'market:refresh', body.x + whisperW + 10, hy + 2, refreshW, 42, `↻ ${t('p6.refresh')} · ${META_PRICES.shopRefresh}`, canRefresh ? 'gold' : 'muted', {
      fontSize: 15.5,
      icon: 'ui_coin_gold',
      disabled: !canRefresh,
    });
    if (market.adRefreshAvailable) {
      drawPillButton(c, hits, 'market:ad-refresh', body.x + body.w - adW, hy + 2, adW, 42, zh ? '🎬 免费刷新' : '🎬 Ad Free', 'teal', { fontSize: 14.5 });
    }

    const vx = body.x, vy = hy + 56, vw = body.w, vh = body.h - 58;
    if (offers.length === 0) {
      drawIvorySlab(c, vx + 4, vy, vw - 8, vh - 4, 18);
      drawText(c, t('m2.shopEmpty'), vx + vw / 2, vy + vh / 2, 22, PALETTE.inkSoft, 'center', 900);
      return {};
    }

    const rowH = Math.min(126, Math.floor((vh - 24) / 3));
    const gap = 10;
    offers.forEach((propId, i) => {
      const prop = PROPS[propId];
      if (!prop) return;
      const ry = vy + i * (rowH + gap);
      const lv = profile.ownedProps[propId] ?? 0;
      const maxed = lv >= prop.maxLevel;
      const afford = profile.coins >= prop.price;
      const rColor = RARITY_COLORS[prop.rarity];

      drawIvorySlab(c, vx + 4, ry, vw - 8, rowH, 18, '#fffdf8', '#f6e8cb', rColor, 2.2);
      round(c, vx + 18, ry + (rowH - 78) / 2, 78, 78, 16, RARITY_BG[prop.rarity], rColor, 2);
      if (!drawSpriteContain(c, `prop_${propId}`, vx + 24, ry + (rowH - 66) / 2, 66, 66)) {
        drawText(c, prop.icon, vx + 57, ry + rowH / 2, 40, PALETTE.ink, 'center', 700);
      }

      drawText(c, t(`prop.${propId}`), vx + 112, ry + 26, 21, PALETTE.ink, 'left', 900);
      drawText(c, `${t(`m2.${prop.type}`)} · Lv.${lv}/${prop.maxLevel}`, vx + 112, ry + 52, 15, prop.type === 'active' ? '#c2502c' : '#2d7a64', 'left', 800);
      drawWrappedText(c, t(`prop.${propId}.desc`), vx + 112, ry + 68, vw - 282, 15, 20, PALETTE.inkSoft, 'left', 700, 2);

      if (maxed) {
        drawText(c, t('m2.maxed'), vx + vw - 76, ry + rowH / 2 - 14, 16, '#2c763d', 'center', 900);
        drawSpriteContain(c, 'ui_storybook_check', vx + vw - 89, ry + rowH / 2, 26, 26);
      } else {
        drawPillButton(
          c,
          hits,
          `market:buy:${propId}`,
          vx + vw - 156,
          ry + (rowH - 48) / 2,
          138,
          48,
          `${prop.price} ${t(lv ? 'p11.meta.upgradeShort' : 'p11.meta.buyShort')}`,
          afford ? 'green' : 'muted',
          { fontSize: 16.5, icon: 'ui_coin_gold', disabled: !afford },
        );
      }
    });
    return {};
  }

  // ── TAB 2: BACKPACK (`道具背包`) ───────────────────────────────────────────
  if (market.tab === 'backpack') {
    // Top Loadout Strip: 2 Active Slots + 6 Passive Slots (EXACT Web `propSlots`!)
    const stripY = body.y + 2;
    const stripH = 104;
    drawIvorySlab(c, body.x + 2, stripY, body.w - 4, stripH, 16, '#fffdf7', '#f3e1bc', '#855a2e', 2);

    // Left: Active · 2
    drawText(c, `${t('m2.active')} · 2`, body.x + 18, stripY + 20, 15, '#c2502c', 'left', 900);
    for (let i = 0; i < 2; i++) {
      const pid = profile.equippedActiveProps[i];
      const sx = body.x + 18 + i * 74;
      const sy = stripY + 34;
      if (pid) hits.add({ id: `market:equip:${pid}`, x: sx, y: sy, w: 64, h: 60 });
      round(c, sx, sy, 64, 60, 14, pid ? '#fff5dc' : '#eadbc0', pid ? '#c2502c' : '#a88e6c', pid ? 2.2 : 1.6);
      if (pid) {
        drawSpriteContain(c, `prop_${pid}`, sx + 10, sy + 6, 44, 44);
        round(c, sx + 44, sy - 4, 22, 22, 11, '#d95843', '#fffdf5', 1.6);
        drawText(c, '×', sx + 55, sy + 7, 15, '#fffdf5', 'center', 900);
      } else {
        drawText(c, '+', sx + 32, sy + 30, 24, '#9a8062', 'center', 900);
      }
    }

    // Divider
    c.strokeStyle = 'rgba(122,82,48,0.35)';
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(body.x + 178, stripY + 14);
    c.lineTo(body.x + 178, stripY + stripH - 14);
    c.stroke();

    // Right: Passive · 6
    const px0 = body.x + 194;
    drawText(c, `${t('m2.passive')} · 6`, px0, stripY + 20, 15, '#2d7a64', 'left', 900);
    const slotStep = Math.floor((body.w - 208) / 6);
    for (let i = 0; i < 6; i++) {
      const pid = profile.equippedPassiveProps[i];
      const sx = px0 + i * slotStep;
      const sy = stripY + 34;
      const sw = Math.min(82, slotStep - 8);
      if (pid) hits.add({ id: `market:equip:${pid}`, x: sx, y: sy, w: sw, h: 60 });
      round(c, sx, sy, sw, 60, 14, pid ? '#edf9f2' : '#eadbc0', pid ? '#3a876f' : '#a88e6c', pid ? 2.2 : 1.6);
      if (pid) {
        drawSpriteContain(c, `prop_${pid}`, sx + (sw - 44) / 2, sy + 6, 44, 44);
        round(c, sx + sw - 18, sy - 4, 22, 22, 11, '#d95843', '#fffdf5', 1.6);
        drawText(c, '×', sx + sw - 7, sy + 7, 15, '#fffdf5', 'center', 900);
      } else {
        drawText(c, '+', sx + sw / 2, sy + 30, 24, '#9a8062', 'center', 900);
      }
    }

    // Scrollable Single-Column Prop Rows
    const vx = body.x, vy = stripY + stripH + 10, vw = body.w, vh = body.h - stripH - 12;
    const eqSet = new Set([...profile.equippedActiveProps, ...profile.equippedPassiveProps]);
    const order = (id: string) => (eqSet.has(id) ? 0 : profile.ownedProps[id] ? 1 : 2);
    const props = Object.values(PROPS).sort((a, b) => order(a.id) - order(b.id));
    const pulseGlue = pulseSel === '[data-action="meta-prop:glue_trap"]';

    c.save();
    c.beginPath();
    c.rect(vx, vy, vw, vh);
    c.clip();

    const rowH = 104, gap = 10, rowW = vw - 14;
    props.forEach((prop, idx) => {
      const ry = vy + 2 + idx * (rowH + gap) - scroll.offset;
      if (ry + rowH < vy - 20 || ry > vy + vh + 20) return;

      const lv = profile.ownedProps[prop.id] ?? 0;
      const worn = eqSet.has(prop.id);
      const rColor = RARITY_COLORS[prop.rarity];
      const shouldPulse = pulseGlue && prop.id === 'glue_trap';

      drawIvorySlab(
        c,
        vx + 4,
        ry,
        rowW,
        rowH,
        16,
        shouldPulse ? '#fff8d4' : worn ? '#ebf9e4' : lv > 0 ? '#fffdf8' : '#efe7d8',
        shouldPulse ? '#f8df91' : worn ? '#d6f0ca' : lv > 0 ? '#f6e8cb' : '#e3d8c4',
        shouldPulse ? '#e08b19' : worn ? '#3d8633' : rColor,
        shouldPulse ? 3.5 : worn ? 2.4 : 1.8,
      );
      round(c, vx + 16, ry + 14, 76, 76, 15, RARITY_BG[prop.rarity], rColor, 2);
      if (!drawSpriteContain(c, `prop_${prop.id}`, vx + 22, ry + 20, 64, 64, lv > 0 ? 1 : 0.36)) {
        drawText(c, prop.icon, vx + 54, ry + 52, 36, PALETTE.ink, 'center', 700);
      }

      drawText(c, t(`prop.${prop.id}`), vx + 106, ry + 26, 20, lv > 0 ? PALETTE.ink : PALETTE.muted, 'left', 900);
      drawText(c, `${t(`m2.${prop.type}`)}${lv > 0 ? ` · Lv.${lv}/${prop.maxLevel}` : ''}`, vx + 106, ry + 50, 15, prop.type === 'active' ? '#c2502c' : '#2d7a64', 'left', 800);
      drawWrappedText(c, t(`prop.${prop.id}.desc`), vx + 106, ry + 64, rowW - 252, 14.5, 19, PALETTE.inkSoft, 'left', 700, 2);

      if (ry + rowH > vy && ry < vy + vh) {
        if (lv > 0) {
          drawPillButton(
            c,
            hits,
            `market:equip:${prop.id}`,
            vx + 4 + rowW - 134,
            ry + 30,
            120,
            44,
            t(worn ? 'p11.meta.deployed' : 'p11.meta.deploy'),
            worn ? 'green' : 'gold',
            { fontSize: 16, icon: worn ? 'ui_storybook_check' : undefined },
          );
        } else {
          drawText(c, t('p11.meta.unowned'), vx + 4 + rowW - 68, ry + 36, 15, PALETTE.muted, 'center', 800);
          drawSpriteContain(c, 'ui_lock_closed', vx + 4 + rowW - 81, ry + 52, 26, 26);
        }
      }
    });

    const contentH = 8 + props.length * (rowH + gap);
    c.restore();
    scroll.setContentBounds(contentH, vh);
    drawScrollbar(c, vx, vy, vw, vh, contentH, scroll);
    return { scrollViewport: { x: vx, y: vy, w: vw, h: vh } };
  }

  // ── TAB 3: LUCKY GACHA (`幸运扭蛋` — EXACT `p18_preview_d12_market_lottery.png`!) ──
  const gx = body.x + 6, gy = body.y + 4, gw = body.w - 12, gh = body.h - 8;
  drawIvorySlab(c, gx, gy, gw, gh, 20, '#fffdf8', '#f8ebd0', '#855a2e', 2.2);

  // Heading row with framed `ui_gacha_machine`!
  round(c, gx + 18, gy + 12, 64, 64, 14, '#f5e8ff', '#8a5d32', 2);
  drawSpriteContain(c, 'ui_gacha_machine', gx + 23, gy + 17, 54, 54);
  drawText(c, t('p11.meta.lotteryTitle'), gx + 96, gy + 32, 23, PALETTE.ink, 'left', 900);
  drawText(c, t('p11.meta.lotteryRule'), gx + 96, gy + 60, 16, PALETTE.inkSoft, 'left', 700);

  if (market.lastPrizeLabel) {
    round(c, gx + gw - 256, gy + 16, 238, 52, 14, '#e4f8da', '#3d8633', 2);
    drawText(c, `🎉 ${market.lastPrizeLabel}`, gx + gw - 137, gy + 43, 15.5, '#1f5918', 'center', 900);
  }

  // Centered 3×3 Ring Grid (exact Web `storybook-lottery-ring`, adapts cleanly when P19 coaching banner is active!)
  const ringOrder = [0, 1, 2, 7, -1, 3, 6, 5, 4];
  const compact = gh < 420;
  const headH = compact ? 70 : 84;
  const gridX = gx + 36, gridY = gy + headH, gridW = gw - 72;
  const gridH = Math.max(198, Math.min(266, gh - headH - 96));
  const cellGap = compact ? 8 : 10;
  const cw = Math.floor((gridW - cellGap * 2) / 3);
  const ch = Math.floor((gridH - cellGap * 2) / 3);
  const pulseSpin = pulseSel === '.lottery-center';

  ringOrder.forEach((prizeIdx, cellIdx) => {
    const col = cellIdx % 3, row = Math.floor(cellIdx / 3);
    const tx = gridX + col * (cw + cellGap);
    const ty = gridY + row * (ch + cellGap);

    if (prizeIdx === -1) {
      const useTicket = profile.freeLotteryTickets > 0;
      const canSpin = useTicket || profile.coins >= META_PRICES.lottery;
      drawButton(c, hits, 'market:spin:auto', tx, ty, cw, ch, '', {
        ...(canSpin ? BTN_STYLES.green : BTN_STYLES.muted),
        radius: 16,
        disabled: !canSpin,
      });
      if (pulseSpin) {
        const glow = 0.5 + 0.5 * Math.sin(elapsed * 6);
        round(c, tx - 3, ty - 3, cw + 6, ch + 6, 18, 'transparent', `rgba(255,212,56,${glow.toFixed(2)})`, 4);
      }
      const dy = hits.isPressed('market:spin:auto') ? 3 : 0;
      drawText(c, t('m2.spin'), tx + cw / 2, ty + ch * 0.34 + dy, compact ? 19 : 22, canSpin ? '#293e10' : PALETTE.muted, 'center', 900);
      drawIconLabel(
        c,
        useTicket ? 'ui_ticket_gacha' : 'ui_coin_gold',
        useTicket ? `×${profile.freeLotteryTickets}` : String(META_PRICES.lottery),
        tx + cw / 2 - 32,
        ty + ch * 0.72 + dy,
        22,
        compact ? 17 : 19,
        canSpin ? '#3c250e' : PALETTE.muted,
      );
      return;
    }

    const prize = market.prizes[prizeIdx];
    const wonHere = market.lastPrizeIndex === prizeIdx;
    round(c, tx, ty, cw, ch, 14, wonHere ? '#fff0a8' : '#f8efdc', wonHere ? '#c96214' : '#e0c796', wonHere ? 3 : 1.8);
    if (!prize) return;

    const sprSz = compact ? 34 : 44;
    if (prize.type === 'coins') {
      drawSpriteContain(c, 'ui_coin_gold', tx + cw / 2 - sprSz / 2, ty + 6, sprSz, sprSz);
      drawText(c, `${t('profile.coins')} ×${prize.amount}`, tx + cw / 2, ty + ch - 14, compact ? 14 : 15.5, PALETTE.ink, 'center', 800);
    } else if (prize.type === 'prop' && prize.id) {
      drawSpriteContain(c, `prop_${prize.id}`, tx + cw / 2 - sprSz / 2, ty + 6, sprSz, sprSz);
      const lbl = `${t(`prop.${prize.id}`)} ×${prize.amount}`;
      drawText(c, lbl.length > 10 ? `${lbl.slice(0, 10)}…` : lbl, tx + cw / 2, ty + ch - 14, compact ? 13.5 : 15, PALETTE.ink, 'center', 800);
    } else if (prize.type === 'fragment' && prize.id) {
      if (!drawSpriteContain(c, `weapon_${prize.id}`, tx + cw / 2 - sprSz / 2, ty + 6, sprSz, sprSz)) {
        drawSpriteContain(c, 'ui_weapon_fragment', tx + cw / 2 - sprSz / 2, ty + 6, sprSz, sprSz);
      }
      const lbl = `${t(`fragment.${prize.id}`)} ×${prize.amount}`;
      drawText(c, lbl.length > 11 ? `${lbl.slice(0, 11)}…` : lbl, tx + cw / 2, ty + ch - 14, compact ? 13.5 : 14.5, PALETTE.ink, 'center', 800);
    }
  });

  // Dual Pill Payment Buttons directly underneath 3×3 grid (EXACT `p18_preview_d12`!)
  const payY = gridY + gridH + (compact ? 10 : 14);
  const hasTicket = profile.freeLotteryTickets > 0;
  const hasCoins = profile.coins >= META_PRICES.lottery;
  const btnGap = 14;
  const btnW = market.adGachaAvailable ? Math.floor((gridW - btnGap * 2) / 3) : Math.floor((gridW - btnGap) / 2);

  drawPillButton(c, hits, 'market:spin:ticket', gridX, payY, btnW, 42, t('p11.meta.ticketSpin', { count: profile.freeLotteryTickets }), hasTicket ? 'cream' : 'muted', {
    fontSize: 16,
    icon: 'ui_ticket_gacha',
    disabled: !hasTicket,
  });
  drawPillButton(c, hits, 'market:spin:coins', gridX + btnW + btnGap, payY, btnW, 42, t('p11.meta.coinSpin', { price: META_PRICES.lottery }), hasCoins ? 'cream' : 'muted', {
    fontSize: 16,
    icon: 'ui_coin_gold',
    disabled: !hasCoins,
  });
  if (market.adGachaAvailable) {
    drawPillButton(c, hits, 'market:ad-gacha', gridX + (btnW + btnGap) * 2, payY, btnW, 42, zh ? '🎬 看视频抽' : '🎬 Ad Spin', 'teal', { fontSize: 15 });
  }

  // Rule Footnote at bottom of gacha card
  drawText(c, t('m2.lotteryRule'), gx + gw / 2, payY + 60, 14, PALETTE.inkSoft, 'center', 700);
  return {};
}

export { drawScrollbar };
