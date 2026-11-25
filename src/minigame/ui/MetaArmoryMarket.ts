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
import { getLotteryPrizeRarity, type LotteryPrize } from '../../core/MetaProgression';

export type ArmoryTab = 'all' | WeaponFamily | 'recycle';
export type MarketTab = 'shop' | 'backpack' | 'lottery';

export interface ArmoryState {
  family: ArmoryTab;
  detailWeaponId: string | null;
  recycleRarities: number[];
}

export interface GachaSpinAnim {
  step: number;
  totalSteps: number;
  winnerIndex: number;
  timer: number;
  stepDuration: number;
  pendingLabel: string;
  pendingToast: string;
}

export interface MarketState {
  tab: MarketTab;
  merchantQuip: number;
  prizes: LotteryPrize[];
  highlightIndex: number | null;
  lastPrizeIndex: number | null;
  lastPrizeLabel: string;
  spinAnim: GachaSpinAnim | null;
  celebrateUntil: number;
  pendingRefreshAt: number | null;
  spunThisVisit: boolean;
  adRefreshAvailable: boolean;
  adGachaAvailable: boolean;
}

const RARITY_COLORS = ['#7a6d62', '#3d8f4e', '#3276b8', '#8345b0', '#cf6e12'] as const;
const RARITY_BG = ['#f4f0e8', '#e5f5e8', '#e4effa', '#f2e8fa', '#fdf0dc'] as const;

const GACHA_RARITY_PALETTE = [
  { top: '#fbf7ef', bot: '#eee3ce', border: '#9c8b72', iconBg: '#f3ead8', pill: '#857560', pillStroke: '#5c4f3e', text: '#fffdf7' },
  { top: '#ecfae8', bot: '#cdeec3', border: '#388a48', iconBg: '#dbf5d3', pill: '#3f9648', pillStroke: '#245e29', text: '#fffdf7' },
  { top: '#eaf4fe', bot: '#cae2fc', border: '#2c72ba', iconBg: '#d9ecfd', pill: '#3078c4', pillStroke: '#1c4d82', text: '#fffdf7' },
  { top: '#f6ebff', bot: '#e2c9fa', border: '#803eb3', iconBg: '#ebd9fc', pill: '#8542ba', pillStroke: '#52227a', text: '#fffdf7' },
  { top: '#fff4d6', bot: '#fcdd94', border: '#cf6e12', iconBg: '#ffecb8', pill: '#d97312', pillStroke: '#874105', text: '#fffdf7' },
] as const;

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

  // ── 3-COLUMN GIANT MOBILE WEAPON CARDS ───────────────────────────────────
  const vx = body.x, vy = body.y, vw = body.w, vh = body.h;
  c.save();
  c.beginPath();
  c.rect(vx, vy, vw, vh);
  c.clip();

  const wornBy = new Map<string, string>();
  for (const [heroId, weaponId] of Object.entries(profile.equippedWeapons)) {
    if (weaponId) wornBy.set(weaponId, heroId);
  }

  const cols = 3;
  const gapX = 16, gapY = 14;
  const cardW = Math.floor((vw - 16 - gapX * (cols - 1)) / cols);
  const cardH = 228;
  const pulseSwatter = opts?.guideStep?.pulseSelector === '[data-action="meta-weapon:m01_swatter"]';

  weapons.forEach((w, idx) => {
    const col = idx % cols, row = Math.floor(idx / cols);
    const rx = vx + 4 + col * (cardW + gapX);
    const ry = vy + 4 + row * (cardH + gapY) - scroll.offset;
    if (ry + cardH < vy - 20 || ry > vy + vh + 20) return;

    const unlocked = profile.unlockedWeapons.includes(w.id);
    const wearer = wornBy.get(w.id);
    const rule = RARITY_RULES[w.rarity];
    const have = profile.weaponFragments[w.id] ?? 0;
    const rColor = RARITY_COLORS[w.rarity];
    const shouldPulse = pulseSwatter && w.id === 'm01_swatter';

    if (ry + cardH > vy && ry < vy + vh) {
      hits.add({ id: `armory:open:${w.id}`, x: rx, y: Math.max(vy, ry), w: cardW, h: Math.min(ry + cardH, vy + vh) - Math.max(vy, ry), data: w.id });
    }

    drawIvorySlab(
      c,
      rx,
      ry,
      cardW,
      cardH,
      20,
      shouldPulse ? '#fff9db' : unlocked ? '#fffdf8' : '#f2eadc',
      shouldPulse ? '#fae6a2' : unlocked ? '#f6e8cb' : '#e5dac6',
      shouldPulse ? '#e08b19' : rColor,
      shouldPulse ? 4 : 2.6,
    );

    // Big Weapon Icon Box (104×104)
    round(c, rx + 14, ry + 14, 104, 104, 18, RARITY_BG[w.rarity], rColor, 2.4);
    if (!drawSpriteContain(c, `weapon_${w.id}`, rx + 20, ry + 20, 92, 92, unlocked ? 1 : 0.46)) {
      drawSpriteContain(c, 'ui_weapon_fragment', rx + 20, ry + 20, 92, 92, unlocked ? 1 : 0.46);
    }

    // Giant title + rarity + damage bonus
    drawText(c, t(`weapon.${w.id}`), rx + 132, ry + 36, 26, unlocked ? PALETTE.ink : PALETTE.muted, 'left', 900);
    drawText(c, `${t(`m2.rarity.${w.rarity}`)} · ${t(`p11.meta.family.${w.family}`)}`, rx + 132, ry + 68, 19.5, rColor, 'left', 800);
    round(c, rx + 132, ry + 86, cardW - 146, 32, 12, '#efe0be', '#a67f4e', 1.6);
    drawText(c, `⚔ +${Math.round(rule.damageBonus * 100)}%`, rx + 132 + (cardW - 146) / 2, ry + 103, 19.5, '#4c2c12', 'center', 900);

    // Bottom status / equip / progress footer
    const footY = ry + 132;
    const summary = w.signatureHero ? `★ ${t('m2.signature', { hero: t(`hero.${w.signatureHero}`) })}` : t(`weapon.${w.id}.desc`);
    drawText(c, summary.length > 16 ? `${summary.slice(0, 16)}…` : summary, rx + 16, footY + 14, 19, PALETTE.inkSoft, 'left', 800);

    if (wearer) {
      round(c, rx + 14, ry + cardH - 52, cardW - 28, 38, 19, '#dff5d6', '#3d8633', 2);
      drawSpriteContain(c, wearer, rx + 24, ry + cardH - 49, 32, 32);
      drawText(c, `${t(`hero.${wearer}`)} · ${t('p11.meta.worn')}`, rx + cardW / 2 + 12, ry + cardH - 32, 19, '#1f5918', 'center', 900);
    } else if (unlocked) {
      round(c, rx + 14, ry + cardH - 52, cardW - 28, 38, 19, '#f7d263', '#8c4e12', 2.2);
      drawText(c, `${t('p11.meta.unlocked')} · ${t('p11.meta.equipShort')}`, rx + cardW / 2, ry + cardH - 32, 19.5, '#3c1e08', 'center', 900);
    } else {
      drawProgressBar(c, rx + 16, ry + cardH - 42, cardW - 116, 16, have / rule.fragments, rColor, 'rgba(72,46,24,0.18)', '#6b4928');
      drawText(c, `${have}/${rule.fragments}`, rx + cardW - 16, ry + cardH - 34, 19.5, PALETTE.inkSoft, 'right', 900);
    }
  });

  const contentH = 12 + Math.ceil(weapons.length / cols) * (cardH + gapY);
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

    // Top Raccoon Whisper Bar + Refresh Pill (ENLARGED!)
    const hy = body.y + 2;
    const refreshW = market.adRefreshAvailable ? 210 : 230;
    const adW = market.adRefreshAvailable ? 176 : 0;
    const whisperW = body.w - refreshW - adW - (adW ? 24 : 14);

    hits.add({ id: 'market:merchant', x: body.x + 2, y: hy, w: whisperW, h: 54 });
    drawIvorySlab(c, body.x + 2, hy, whisperW, 54, 18, '#fffaf0', '#f4e3c0', '#855a2e', 2.2);
    drawSpriteContain(c, 'ui_market_peek_raccoon', body.x + 12, hy + 7, 40, 40);
    drawText(c, whisper, body.x + 60, hy + 28, 20, PALETTE.ink, 'left', 800);

    const canRefresh = !allMaxed && profile.coins >= META_PRICES.shopRefresh;
    drawPillButton(c, hits, 'market:refresh', body.x + whisperW + 12, hy + 2, refreshW, 50, `${t('p6.refresh')} · ${META_PRICES.shopRefresh}`, canRefresh ? 'gold' : 'muted', {
      fontSize: 20,
      icon: 'ui_coin_gold',
      disabled: !canRefresh,
    });
    if (market.adRefreshAvailable) {
      drawPillButton(c, hits, 'market:ad-refresh', body.x + body.w - adW, hy + 2, adW, 50, zh ? '🎬 免费刷新' : '🎬 Ad Free', 'teal', { fontSize: 19 });
    }

    const vx = body.x, vy = hy + 66, vw = body.w, vh = body.h - 68;
    if (offers.length === 0) {
      drawIvorySlab(c, vx + 4, vy, vw - 8, vh - 4, 20);
      drawText(c, t('m2.shopEmpty'), vx + vw / 2, vy + vh / 2, 28, PALETTE.inkSoft, 'center', 900);
      return {};
    }

    // 3 GIANT SIDE-BY-SIDE SHOWCASE OFFER CARDS!
    const gap = 16;
    const cardW = Math.floor((vw - 8 - gap * 2) / 3);
    const cardH = Math.min(392, vh - 4);
    offers.slice(0, 3).forEach((propId, i) => {
      const prop = PROPS[propId];
      if (!prop) return;
      const rx = vx + 4 + i * (cardW + gap);
      const ry = vy;
      const lv = profile.ownedProps[propId] ?? 0;
      const maxed = lv >= prop.maxLevel;
      const afford = profile.coins >= prop.price;
      const rColor = RARITY_COLORS[prop.rarity];

      drawIvorySlab(c, rx, ry, cardW, cardH, 22, '#fffdf8', '#f6e8cb', rColor, 3);
      const iconS = 114;
      round(c, rx + (cardW - iconS) / 2, ry + 18, iconS, iconS, 20, RARITY_BG[prop.rarity], rColor, 2.6);
      if (!drawSpriteContain(c, `prop_${propId}`, rx + (cardW - 96) / 2, ry + 27, 96, 96)) {
        drawText(c, prop.icon, rx + cardW / 2, ry + 75, 52, PALETTE.ink, 'center', 700);
      }

      drawText(c, t(`prop.${propId}`), rx + cardW / 2, ry + 156, 28, PALETTE.ink, 'center', 900);
      drawText(c, `${t(`m2.${prop.type}`)} · Lv.${lv}/${prop.maxLevel}`, rx + cardW / 2, ry + 188, 20, prop.type === 'active' ? '#c2502c' : '#2d7a64', 'center', 800);

      round(c, rx + 16, ry + 208, cardW - 32, Math.max(82, cardH - 294), 14, 'rgba(232,212,172,0.42)', '#cbb082', 1.5);
      drawWrappedText(c, t(`prop.${propId}.desc`), rx + 26, ry + 218, cardW - 52, 20.5, 27, PALETTE.ink, 'left', 700, 3);

      const btnY = ry + cardH - 68;
      if (maxed) {
        round(c, rx + 24, btnY, cardW - 48, 52, 26, '#dff5d6', '#3d8633', 2.2);
        drawText(c, `✓ ${t('m2.maxed')}`, rx + cardW / 2, btnY + 27, 22, '#22591b', 'center', 900);
      } else {
        drawPillButton(
          c,
          hits,
          `market:buy:${propId}`,
          rx + 24,
          btnY,
          cardW - 48,
          54,
          `${prop.price} ${t(lv ? 'p11.meta.upgradeShort' : 'p11.meta.buyShort')}`,
          afford ? 'green' : 'muted',
          { fontSize: 22, icon: 'ui_coin_gold', disabled: !afford },
        );
      }
    });
    return {};
  }

  // ── TAB 2: BACKPACK (`道具背包`) ───────────────────────────────────────────
  if (market.tab === 'backpack') {
    // Top Loadout Strip: 2 Active Slots + 6 Passive Slots — GIANT icons (>= candidate items below!)
    const stripY = body.y + 2;
    const stripH = 148;
    drawIvorySlab(c, body.x + 2, stripY, body.w - 4, stripH, 18, '#fffdf7', '#f3e1bc', '#855a2e', 2.4);

    const slotY = stripY + 38;
    const slotH = 100;
    const slotIconSz = 86; // Strictly larger than 80×80 candidate prop icons below!

    // Left: Active · 2
    const activeX0 = body.x + 20;
    const activeW = 122;
    const activeGap = 14;
    drawText(c, `${t('m2.active')} · 2`, activeX0, stripY + 21, 22, '#c2502c', 'left', 900);
    for (let i = 0; i < 2; i++) {
      const pid = profile.equippedActiveProps[i];
      const sx = activeX0 + i * (activeW + activeGap);
      if (pid) hits.add({ id: `market:equip:${pid}`, x: sx, y: slotY, w: activeW, h: slotH });
      round(c, sx, slotY, activeW, slotH, 18, pid ? '#fff5dc' : '#eadbc0', pid ? '#c2502c' : '#a88e6c', pid ? 2.6 : 1.8);
      if (pid) {
        drawSpriteContain(c, `prop_${pid}`, sx + (activeW - slotIconSz) / 2, slotY + (slotH - slotIconSz) / 2, slotIconSz, slotIconSz);
        round(c, sx + activeW - 22, slotY - 6, 28, 28, 14, '#d95843', '#fffdf5', 2);
        drawText(c, '×', sx + activeW - 8, slotY + 8, 19, '#fffdf5', 'center', 900);
      } else {
        drawText(c, '+', sx + activeW / 2, slotY + slotH / 2, 36, '#9a8062', 'center', 900);
      }
    }

    // Divider
    const divX = activeX0 + 2 * activeW + activeGap + 20;
    c.strokeStyle = 'rgba(122,82,48,0.35)';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(divX, stripY + 14);
    c.lineTo(divX, stripY + stripH - 14);
    c.stroke();

    // Right: Passive · 6
    const px0 = divX + 20;
    const passiveAvailW = body.x + body.w - 20 - px0;
    const pGap = 14;
    const pSlotW = Math.floor((passiveAvailW - pGap * 5) / 6);
    drawText(c, `${t('m2.passive')} · 6`, px0, stripY + 21, 22, '#2d7a64', 'left', 900);
    for (let i = 0; i < 6; i++) {
      const pid = profile.equippedPassiveProps[i];
      const sx = px0 + i * (pSlotW + pGap);
      if (pid) hits.add({ id: `market:equip:${pid}`, x: sx, y: slotY, w: pSlotW, h: slotH });
      round(c, sx, slotY, pSlotW, slotH, 18, pid ? '#edf9f2' : '#eadbc0', pid ? '#3a876f' : '#a88e6c', pid ? 2.6 : 1.8);
      if (pid) {
        drawSpriteContain(c, `prop_${pid}`, sx + (pSlotW - slotIconSz) / 2, slotY + (slotH - slotIconSz) / 2, slotIconSz, slotIconSz);
        round(c, sx + pSlotW - 22, slotY - 6, 28, 28, 14, '#d95843', '#fffdf5', 2);
        drawText(c, '×', sx + pSlotW - 8, slotY + 8, 19, '#fffdf5', 'center', 900);
      } else {
        drawText(c, '+', sx + pSlotW / 2, slotY + slotH / 2, 36, '#9a8062', 'center', 900);
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

    // 2-Column GIANT Prop Cards in Backpack
    const cols = 2, gapX = 16, gapY = 12;
    const cardW = Math.floor((vw - 16 - gapX) / cols);
    const cardH = 148;
    props.forEach((prop, idx) => {
      const col = idx % cols, row = Math.floor(idx / cols);
      const rx = vx + 4 + col * (cardW + gapX);
      const ry = vy + 2 + row * (cardH + gapY) - scroll.offset;
      if (ry + cardH < vy - 20 || ry > vy + vh + 20) return;

      const lv = profile.ownedProps[prop.id] ?? 0;
      const worn = eqSet.has(prop.id);
      const rColor = RARITY_COLORS[prop.rarity];
      const shouldPulse = pulseGlue && prop.id === 'glue_trap';

      drawIvorySlab(
        c,
        rx,
        ry,
        cardW,
        cardH,
        18,
        shouldPulse ? '#fff8d4' : worn ? '#ebf9e4' : lv > 0 ? '#fffdf8' : '#efe7d8',
        shouldPulse ? '#f8df91' : worn ? '#d6f0ca' : lv > 0 ? '#f6e8cb' : '#e3d8c4',
        shouldPulse ? '#e08b19' : worn ? '#3d8633' : rColor,
        shouldPulse ? 3.8 : worn ? 2.8 : 2.2,
      );
      round(c, rx + 14, ry + 26, 94, 94, 18, RARITY_BG[prop.rarity], rColor, 2.2);
      if (!drawSpriteContain(c, `prop_${prop.id}`, rx + 21, ry + 33, 80, 80, lv > 0 ? 1 : 0.36)) {
        drawText(c, prop.icon, rx + 61, ry + 73, 44, PALETTE.ink, 'center', 700);
      }

      drawText(c, t(`prop.${prop.id}`), rx + 122, ry + 30, 25, lv > 0 ? PALETTE.ink : PALETTE.muted, 'left', 900);
      drawText(c, `${t(`m2.${prop.type}`)}${lv > 0 ? ` · Lv.${lv}/${prop.maxLevel}` : ''}`, rx + 122, ry + 60, 19, prop.type === 'active' ? '#c2502c' : '#2d7a64', 'left', 800);
      drawWrappedText(c, t(`prop.${prop.id}.desc`), rx + 122, ry + 78, cardW - 266, 18.5, 24, PALETTE.inkSoft, 'left', 700, 2);

      if (ry + cardH > vy && ry < vy + vh) {
        if (lv > 0) {
          drawPillButton(
            c,
            hits,
            `market:equip:${prop.id}`,
            rx + cardW - 134,
            ry + 48,
            120,
            52,
            t(worn ? 'p11.meta.deployed' : 'p11.meta.deploy'),
            worn ? 'green' : 'gold',
            { fontSize: 19.5, icon: worn ? 'ui_storybook_check' : undefined },
          );
        } else {
          drawText(c, t('p11.meta.unowned'), rx + cardW - 72, ry + 54, 18.5, PALETTE.muted, 'center', 800);
          drawSpriteContain(c, 'ui_lock_closed', rx + cardW - 87, ry + 74, 30, 30);
        }
      }
    });

    const contentH = 12 + Math.ceil(props.length / cols) * (cardH + gapY);
    c.restore();
    scroll.setContentBounds(contentH, vh);
    drawScrollbar(c, vx, vy, vw, vh, contentH, scroll);
    return { scrollViewport: { x: vx, y: vy, w: vw, h: vh } };
  }

  // ── TAB 3: LUCKY GACHA (`幸运扭蛋` — Widescreen 2-Column Big-Font + Rarity Colors + Chase Animation!) ──
  const gx = body.x + 4, gy = body.y + 4, gw = body.w - 8, gh = body.h - 8;
  drawIvorySlab(c, gx, gy, gw, gh, 20, '#fffdf8', '#f8ebd0', '#855a2e', 2.4);

  const compact = gh < 410;
  const pad = 16;
  const spinning = Boolean(market.spinAnim);
  const celebrating = !spinning && market.lastPrizeIndex !== null && elapsed < market.celebrateUntil;

  // LEFT COLUMN: Gacha Machine Showcase + Big Rule/Win Banner + Chunky Spin Buttons
  const lx = gx + pad;
  const ly = gy + pad;
  const lw = 398;
  const lh = gh - pad * 2;

  const machSz = compact ? 74 : 86;
  round(c, lx, ly, machSz, machSz, 18, '#f5e8ff', '#8a5d32', 2.4);
  if (spinning) {
    c.save();
    c.translate(lx + machSz / 2, ly + machSz / 2);
    c.rotate(Math.sin(elapsed * 28) * 0.09);
    const bounce = 1 + Math.abs(Math.sin(elapsed * 18)) * 0.06;
    c.scale(bounce, bounce);
    drawSpriteContain(c, 'ui_gacha_machine', -(machSz - 12) / 2, -(machSz - 12) / 2, machSz - 12, machSz - 12);
    c.restore();
  } else {
    drawSpriteContain(c, 'ui_gacha_machine', lx + 6, ly + 6, machSz - 12, machSz - 12);
  }

  const headTextX = lx + machSz + 14;
  const headTextW = lw - machSz - 14;
  drawText(c, t('p11.meta.lotteryTitle'), headTextX, ly + (compact ? 20 : 24), compact ? 27 : 30, PALETTE.ink, 'left', 900);
  drawWrappedText(
    c,
    t('p11.meta.lotteryRule'),
    headTextX,
    ly + (compact ? 40 : 48),
    headTextW,
    compact ? 19 : 20,
    compact ? 23 : 25,
    PALETTE.inkSoft,
    'left',
    800,
    2,
  );

  // Bottom Spin Buttons Stack (sized first so middle rule/result slab fills exact remaining height!)
  const hasTicket = !spinning && profile.freeLotteryTickets > 0;
  const hasCoins = !spinning && profile.coins >= META_PRICES.lottery;
  const hasAd = market.adGachaAvailable;
  const btnH = hasAd ? (compact ? 44 : 52) : (compact ? 52 : 60);
  const btnGap = compact ? 8 : 12;
  const btnCount = hasAd ? 3 : 2;
  const btnStackH = btnCount * btnH + (btnCount - 1) * btnGap;
  const btnStartY = ly + lh - btnStackH;

  // Middle Status / Spinning / Last Prize / Rule Card (BIG 20–25px bold text, zero tiny footnotes!)
  const midY = ly + machSz + (compact ? 10 : 14);
  const midH = Math.max(78, btnStartY - midY - (compact ? 10 : 14));
  if (spinning) {
    const dots = '.'.repeat(1 + (Math.floor(elapsed * 6) % 3));
    drawIvorySlab(c, lx, midY, lw, midH, 18, '#fff8d4', '#f8df88', '#d48216', 2.8);
    drawText(c, zh ? `✨ 幸运转盘旋转中${dots}` : `✨ Spinning${dots}`, lx + lw / 2, midY + midH * 0.42, compact ? 22 : 25, '#8c4408', 'center', 900);
    drawText(c, zh ? '好运即将揭晓！' : 'Good luck!', lx + lw / 2, midY + midH * 0.74, compact ? 19 : 21, '#7c5018', 'center', 800);
  } else if (market.lastPrizeLabel) {
    drawIvorySlab(c, lx, midY, lw, midH, 18, '#e8fae0', '#d1f2c2', '#3d8633', 2.8);
    drawText(c, zh ? '🎉 恭喜抽中' : '🎉 You Won!', lx + lw / 2, midY + (compact ? 24 : 34), compact ? 20 : 22, '#2d6e24', 'center', 900);
    drawWrappedText(
      c,
      market.lastPrizeLabel,
      lx + 16,
      midY + (compact ? 44 : 58),
      lw - 32,
      compact ? 22 : 25,
      compact ? 26 : 30,
      '#1a4d14',
      'center',
      900,
      2,
    );
  } else {
    drawIvorySlab(c, lx, midY, lw, midH, 18, '#fff7e4', '#f2dfba', '#b38449', 2.2);
    drawWrappedText(
      c,
      t('m2.lotteryRule'),
      lx + 18,
      midY + (compact ? 14 : 22),
      lw - 36,
      compact ? 19.5 : 21.5,
      compact ? 25 : 29,
      PALETTE.ink,
      'left',
      800,
      compact ? 3 : 4,
    );
  }

  let by = btnStartY;
  drawPillButton(c, hits, 'market:spin:ticket', lx, by, lw, btnH, t('p11.meta.ticketSpin', { count: profile.freeLotteryTickets }), hasTicket ? 'gold' : 'muted', {
    fontSize: compact ? 20.5 : 23,
    icon: 'ui_ticket_gacha',
    disabled: !hasTicket,
  });
  by += btnH + btnGap;
  drawPillButton(c, hits, 'market:spin:coins', lx, by, lw, btnH, t('p11.meta.coinSpin', { price: META_PRICES.lottery }), hasCoins ? 'cream' : 'muted', {
    fontSize: compact ? 20.5 : 23,
    icon: 'ui_coin_gold',
    disabled: !hasCoins,
  });
  if (hasAd) {
    by += btnH + btnGap;
    drawPillButton(c, hits, 'market:ad-gacha', lx, by, lw, btnH, zh ? '🎬 看视频免费抽' : '🎬 Free Ad Spin', spinning ? 'muted' : 'teal', {
      fontSize: compact ? 19.5 : 21.5,
      disabled: spinning,
    });
  }

  // RIGHT COLUMN: GIANT 3×3 Rarity-Colored Prize Ring with Chase Spotlight Animation!
  const ringOrder = [0, 1, 2, 7, -1, 3, 6, 5, 4];
  const gridX = lx + lw + 18;
  const gridY = ly;
  const gridW = gx + gw - pad - gridX;
  const gridH = lh;
  const cellGap = compact ? 10 : 12;
  const cw = Math.floor((gridW - cellGap * 2) / 3);
  const ch = Math.floor((gridH - cellGap * 2) / 3);
  const pulseSpin = pulseSel === '.lottery-center';

  ringOrder.forEach((prizeIdx, cellIdx) => {
    const col = cellIdx % 3, row = Math.floor(cellIdx / 3);
    const tx = gridX + col * (cw + cellGap);
    const ty = gridY + row * (ch + cellGap);

    if (prizeIdx === -1) {
      const useTicket = profile.freeLotteryTickets > 0;
      const canSpin = !spinning && (useTicket || profile.coins >= META_PRICES.lottery);
      drawButton(c, hits, 'market:spin:auto', tx, ty, cw, ch, '', {
        ...(spinning ? BTN_STYLES.gold : canSpin ? BTN_STYLES.green : BTN_STYLES.muted),
        radius: 20,
        disabled: !canSpin,
      });
      if (pulseSpin && !spinning) {
        const glow = 0.5 + 0.5 * Math.sin(elapsed * 6);
        round(c, tx - 3, ty - 3, cw + 6, ch + 6, 22, 'transparent', `rgba(255,212,56,${glow.toFixed(2)})`, 4.5);
      }
      const dy = hits.isPressed('market:spin:auto') ? 3 : 0;
      const centerLabel = spinning ? t('m2.spinning') : t('m2.spin');
      drawText(
        c,
        centerLabel,
        tx + cw / 2,
        ty + ch * 0.35 + dy,
        compact ? 24 : 28,
        spinning ? '#4a2406' : canSpin ? '#fffdf7' : PALETTE.muted,
        'center',
        900,
        !spinning && canSpin ? '#294d12' : undefined,
        4,
      );
      const costStr = useTicket ? `×${profile.freeLotteryTickets}` : String(META_PRICES.lottery);
      const costFont = compact ? 21 : 24;
      const costIcon = compact ? 26 : 30;
      c.font = `900 ${costFont}px "Trebuchet MS", "PingFang SC", "Microsoft YaHei", sans-serif`;
      const totalCostW = costIcon + 8 + c.measureText(costStr).width;
      drawIconLabel(
        c,
        useTicket ? 'ui_ticket_gacha' : 'ui_coin_gold',
        costStr,
        tx + (cw - totalCostW) / 2,
        ty + ch * 0.72 + dy,
        costIcon,
        costFont,
        spinning ? '#5e3208' : canSpin ? '#fff9d6' : PALETTE.muted,
      );
      return;
    }

    const prize = market.prizes[prizeIdx];
    const rarity = prize ? getLotteryPrizeRarity(prize) : 0;
    const pal = GACHA_RARITY_PALETTE[rarity];
    const isChaseLit = spinning && market.highlightIndex === prizeIdx;
    const isWonLit = !spinning && market.lastPrizeIndex === prizeIdx;
    const isActive = isChaseLit || isWonLit;

    c.save();
    if (isActive) {
      const pop = isChaseLit ? 1.04 : celebrating ? 1.03 + 0.02 * Math.sin(elapsed * 12) : 1.02;
      c.translate(tx + cw / 2, ty + ch / 2);
      c.scale(pop, pop);
      c.translate(-(tx + cw / 2), -(ty + ch / 2));
    }

    // Rarity-tinted card background + thick golden spotlight ring when chased/won!
    drawIvorySlab(
      c,
      tx,
      ty,
      cw,
      ch,
      18,
      isChaseLit ? '#fff9cc' : pal.top,
      isChaseLit ? '#ffe578' : pal.bot,
      isActive ? '#e68a00' : pal.border,
      isActive ? 4.4 : 2.6,
    );

    if (isActive) {
      const glowAlpha = isChaseLit ? 0.95 : 0.65 + 0.35 * Math.sin(elapsed * 8);
      round(c, tx - 4, ty - 4, cw + 8, ch + 8, 21, 'transparent', `rgba(255,214,48,${glowAlpha.toFixed(2)})`, 5);
    }

    if (!prize) {
      c.restore();
      return;
    }

    // Horizontal cell interior: Rarity-framed icon on left + Big name & Rarity-Colored Tier/Count button on right!
    const iconBox = compact ? 70 : 82;
    const ix = tx + 10;
    const iy = ty + Math.round((ch - iconBox) / 2);
    round(c, ix, iy, iconBox, iconBox, 16, isChaseLit ? '#fffdf0' : pal.iconBg, isActive ? '#d47c08' : pal.border, 2.2);

    const sprSz = iconBox - 12;
    let label = '';
    if (prize.type === 'coins') {
      drawSpriteContain(c, 'ui_coin_gold', ix + 6, iy + 6, sprSz, sprSz);
      label = t('profile.coins');
    } else if (prize.type === 'prop' && prize.id) {
      drawSpriteContain(c, `prop_${prize.id}`, ix + 6, iy + 6, sprSz, sprSz);
      label = t(`prop.${prize.id}`);
    } else if (prize.type === 'fragment' && prize.id) {
      if (!drawSpriteContain(c, `weapon_${prize.id}`, ix + 6, iy + 6, sprSz, sprSz)) {
        drawSpriteContain(c, 'ui_weapon_fragment', ix + 6, iy + 6, sprSz, sprSz);
      }
      label = t(`fragment.${prize.id}`);
    }

    const textX = ix + iconBox + 10;
    const textW = tx + cw - textX - 10;
    const nameSize = compact ? 19 : 21;
    const nameLH = compact ? 22 : 25;
    drawWrappedText(c, label, textX, ty + (compact ? 12 : 16), textW, nameSize, nameLH, PALETTE.ink, 'left', 900, 2);

    // Rarity-Colored Grade + Count Pill/Button (Green for 优良, Blue for 精良, Purple for 史诗, Gold-Orange for 传说!)
    const pillH = compact ? 32 : 36;
    const pillY = ty + ch - pillH - (compact ? 10 : 14);
    const pillW = textW;
    const rarityLabel = t(`m2.rarity.${rarity}`);
    const badgeStr = `${rarityLabel} ×${prize.amount}`;
    round(c, textX, pillY + 2, pillW, pillH, pillH / 2, pal.pillStroke, 'transparent', 0);
    round(c, textX, pillY, pillW, pillH, pillH / 2, pal.pill, pal.pillStroke, 2);
    drawText(c, badgeStr, textX + pillW / 2, pillY + pillH / 2 + 1, compact ? 17.5 : 19, pal.text, 'center', 900);

    // Celebratory winner badge perched on top-right corner once landed
    if (isWonLit) {
      const winW = 76, winH = 26;
      round(c, tx + cw - winW - 6, ty - 10, winW, winH, 13, '#ffd238', '#8a4306', 2.2);
      drawText(c, zh ? '★ 中奖!' : '★ WIN!', tx + cw - winW / 2 - 6, ty + 3, 15.5, '#592304', 'center', 900);
    }

    // Subtle dim on non-lit cells during spin chase so the moving spotlight pops vividly!
    if (spinning && !isChaseLit) {
      round(c, tx, ty, cw, ch, 18, 'rgba(38,20,6,0.12)', 'transparent', 0);
    }

    c.restore();
  });

  return {};
}

export { drawScrollbar };
