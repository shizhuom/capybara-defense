import { ENEMIES } from '../../config/enemies';
import { HEROES } from '../../config/heroes';
import { progressionFor, requiredStars } from '../../config/progression';
import { PROPS } from '../../config/props';
import { getRank } from '../../config/ranks';
import { RECIPES } from '../../config/recipes';
import { UNITS } from '../../config/units';
import { HERO_FAMILIES, RARITY_RULES, WEAPONS } from '../../config/weapons';
import { getBaseUnitStats, getBeeProduction } from '../../core/UnitStats';
import type { Profile } from '../../core/types';
import { t } from '../../i18n/i18n';
import { round } from '../../render/StickerArt';
import {
  LEDGER,
  PALETTE,
  ScrollRegion,
  drawDetailNavBar,
  drawIvorySlab,
  drawLedgerShell,
  drawPillButton,
  drawScrollbar,
  drawSpriteContain,
  drawText,
  drawWrappedText,
  type UiHitManager,
} from './CanvasUI';

export const COMPENDIUM_TABS = ['matrix', 'pets', 'heroes', 'bosses', 'weapons', 'props'] as const;
export type CompendiumTab = typeof COMPENDIUM_TABS[number];

export interface CompendiumUiState {
  tab: CompendiumTab;
  detailId: string | null;
  previewAwakened: boolean;
}

const CATALOGS: Record<Exclude<CompendiumTab, 'matrix'>, readonly string[]> = {
  pets: Object.values(UNITS).filter(u => u.category === 'basic' || u.category === 'component').map(u => u.id),
  heroes: RECIPES.map(r => r.hero),
  bosses: Object.keys(ENEMIES),
  weapons: Object.keys(WEAPONS),
  props: Object.keys(PROPS),
};

export function compendiumCatalog(tab: CompendiumTab): readonly string[] {
  return tab === 'matrix' ? CATALOGS.heroes : CATALOGS[tab];
}

export function compendiumOwnerTab(id: string): Exclude<CompendiumTab, 'matrix'> | null {
  if (Object.hasOwn(HEROES, id)) return 'heroes';
  if (Object.hasOwn(UNITS, id)) return 'pets';
  if (Object.hasOwn(ENEMIES, id)) return 'bosses';
  if (Object.hasOwn(WEAPONS, id)) return 'weapons';
  if (Object.hasOwn(PROPS, id)) return 'props';
  return null;
}

function entrySprite(id: string, awakened = false): string {
  if (Object.hasOwn(WEAPONS, id)) return `weapon_${id}`;
  if (Object.hasOwn(PROPS, id)) return `prop_${id}`;
  if (awakened && Object.hasOwn(HEROES, id)) return `${id}_awakened`;
  return id;
}

function entryName(id: string): string {
  if (id === 'r11_sniper_laser') return t('p10.name.r11_sniper_laser');
  if (Object.hasOwn(WEAPONS, id)) return t(`weapon.${id}`);
  if (Object.hasOwn(PROPS, id)) return t(`prop.${id}`);
  if (Object.hasOwn(HEROES, id)) return t(`hero.${id}`);
  if (Object.hasOwn(ENEMIES, id)) return t(`${ENEMIES[id].boss ? 'boss' : 'enemy'}.${id}`);
  return t(`unit.${id}`);
}

function entryTagline(id: string): string {
  if (Object.hasOwn(WEAPONS, id)) return t(`p10.weapon.${WEAPONS[id].family}`);
  if (Object.hasOwn(PROPS, id)) return t(`p10.prop.${PROPS[id].type}`);
  if (Object.hasOwn(HEROES, id)) return t(`p10.hero.${id}`);
  if (Object.hasOwn(ENEMIES, id)) return t(`p10.enemy.${id}`);
  return t(`p10.unit.${id}`);
}

function entryCollected(id: string, profile: Profile): boolean {
  if (Object.hasOwn(HEROES, id)) return profile.mergedHeroes.includes(id);
  if (Object.hasOwn(WEAPONS, id)) return profile.unlockedWeapons.includes(id);
  if (Object.hasOwn(PROPS, id)) return Boolean(profile.ownedProps[id]);
  return true;
}

function entryFamily(id: string): string {
  if (Object.hasOwn(HEROES, id)) return t(`p11.meta.family.${HERO_FAMILIES[id]}`);
  if (Object.hasOwn(WEAPONS, id)) return `${t(`m2.rarity.${WEAPONS[id].rarity}`)} · ${t(`p11.meta.family.${WEAPONS[id].family}`)}`;
  if (Object.hasOwn(PROPS, id)) return t(`m2.${PROPS[id].type}`);
  if (Object.hasOwn(ENEMIES, id)) return t(ENEMIES[id].boss ? 'p7.boss' : 'p7.minion');
  return t(UNITS[id]?.category === 'basic' ? 'p3.basics' : id === 'shovel' ? 'p7.tool' : 'p3.components');
}

const FRAME_TONE: Record<CompendiumTab, string> = {
  matrix: '#fff3d6',
  pets: '#eef7e2',
  heroes: '#fff1d4',
  bosses: '#fceae4',
  weapons: '#eaf3fb',
  props: '#f4ebfa',
};

/**
 * Strict 1:1 Web Storybook 6-Tab Compendium (`Compendium.ts` + `p18_preview_d02_compendium_list.png`):
 * - 6 equal Honey-Oak tabs: 合成总览 / 基础萌宠 / 传说英雄 / 捣蛋怪物 / 奇葩神兵 / 黑市道具
 * - Single-column sculpted ivory row cards with `已收录` + `ui_storybook_check`
 * - Tap any row for the full Detail Sheet (Lv.1–5 Growth Table, Awakened Form Toggle, Recipes & Weapons!)
 */
export function drawCompendiumModal(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  profile: Profile,
  ui: CompendiumUiState,
  scroll: ScrollRegion,
  isTestSave: boolean,
): { scrollViewport?: { x: number; y: number; w: number; h: number } } {
  const roster = progressionFor(profile, isTestSave);
  const unlockedRoster = new Set([...roster.units, ...roster.heroes, ...roster.minions, ...roster.bosses]);
  const isAvailable = (id: string) => Boolean(WEAPONS[id] || PROPS[id] || unlockedRoster.has(id));

  const body = drawLedgerShell(c, hits, {
    title: t('p10.title'),
    mascot: 'ui_compendium_peek_capy',
    badgeSegments: [{ text: t('p5.collection', { heroes: profile.mergedHeroes.length, weapons: profile.unlockedWeapons.length }) }],
    tabs: COMPENDIUM_TABS.map(tab => ({
      id: `compendium:tab:${tab}`,
      label: t(`p10.tab.${tab}`),
      active: ui.tab === tab,
    })),
    footer1: t('p10.footerTip1'),
    footer2: t('p10.footerTip2'),
  });

  // ── DETAIL SHEET SUB-PAGE ─────────────────────────────────────────────────
  if (ui.detailId) {
    const id = ui.detailId;
    const owner = compendiumOwnerTab(id) ?? 'heroes';
    const list = compendiumCatalog(ui.tab);
    const idx = list.indexOf(id);
    const navH = drawDetailNavBar(
      c,
      hits,
      'compendium:back',
      'compendium:prev',
      'compendium:next',
      idx >= 0 ? `${idx + 1} / ${list.length}` : '—',
      body.x,
      body.y,
      body.w,
    );

    const vx = body.x, vy = body.y + navH + 8, vw = body.w, vh = body.h - navH - 8;
    c.save();
    c.beginPath();
    c.rect(vx, vy, vw, vh);
    c.clip();

    const available = isAvailable(id);
    const collected = entryCollected(id, profile);
    const isHero = Object.hasOwn(HEROES, id);
    const isUnit = Object.hasOwn(UNITS, id);
    const isEnemy = Object.hasOwn(ENEMIES, id);
    const isWeapon = Object.hasOwn(WEAPONS, id);
    const isProp = Object.hasOwn(PROPS, id);

    let y = vy + 4 - scroll.offset;
    const cardW = vw - 14;
    const cardX = vx + 4;

    // Top Showcase Card (centered framed art, name, tagline, family pill, Awakened toggle)
    const showcaseH = isHero && available ? 236 : 196;
    drawIvorySlab(c, cardX, y, cardW, showcaseH, 18);

    const frameX = cardX + 22, frameY = y + 20, frameS = 114;
    round(
      c,
      frameX,
      frameY,
      frameS,
      frameS,
      20,
      isHero && ui.previewAwakened ? '#fff0c4' : FRAME_TONE[owner],
      isHero && ui.previewAwakened ? '#d97a16' : '#7a5230',
      isHero && ui.previewAwakened ? 3.2 : 2.2,
    );
    const spr = entrySprite(id, isHero && available && ui.previewAwakened);
    if (!drawSpriteContain(c, spr, frameX + 8, frameY + 8, frameS - 16, frameS - 16, available ? 1 : 0.32)) {
      drawSpriteContain(c, entrySprite(id, false), frameX + 8, frameY + 8, frameS - 16, frameS - 16, available ? 1 : 0.32);
    }

    const tx = frameX + frameS + 22;
    drawText(c, entryName(id), tx, y + 40, 31, PALETTE.ink, 'left', 900);
    // Right status badge
    if (!available) {
      drawText(c, t('p9.starUnlock', { stars: requiredStars(id) }), cardX + cardW - 22, y + 38, 24, '#9c5b1e', 'right', 900);
    } else {
      const stateKey = collected ? (isWeapon || isProp ? 'p10.owned' : 'p10.collected') : isHero ? 'p10.canMerge' : 'p10.uncollected';
      drawText(c, t(stateKey), cardX + cardW - 22, y + 36, 22, collected ? '#2c763d' : PALETTE.inkSoft, 'right', 900);
      if (collected) drawSpriteContain(c, 'ui_storybook_check', cardX + cardW - 52, y + 54, 30, 30);
    }

    // Family pill
    round(c, tx, y + 62, 230, 34, 17, '#f0dec0', '#966b3c', 1.8);
    drawText(c, entryFamily(id), tx + 115, y + 80, 19, '#59371a', 'center', 900);

    drawWrappedText(c, entryTagline(id), tx, y + 106, cardW - (tx - cardX) - 24, 21, 27, PALETTE.inkSoft, 'left', 700, 2);

    // Awakened Form Toggle Bar (for Heroes!)
    if (isHero && available) {
      const togY = y + 168;
      if (togY + 50 > vy && togY < vy + vh) {
        drawPillButton(
          c,
          hits,
          'compendium:awakened',
          cardX + 22,
          togY,
          252,
          48,
          t(ui.previewAwakened ? 'p17.awakenedToggle.awakened' : 'p17.awakenedToggle.normal'),
          ui.previewAwakened ? 'gold' : 'cream',
          { fontSize: 20 },
        );
      }
      drawText(c, t('p17.awakenedHint'), cardX + 292, togY + 25, 19, PALETTE.inkSoft, 'left', 700);
    }
    y += showcaseH + 12;

    if (!available) {
      // Locked Chest Notice (1:1 Web `locked-entry-notice` with `ui_unlock_chest`!)
      const lockH = 136;
      drawIvorySlab(c, cardX, y, cardW, lockH, 18, '#fff7e6', '#f2dfc0', '#a67642', 2.4);
      drawSpriteContain(c, 'ui_unlock_chest', cardX + 26, y + 24, 86, 86);
      const stars = requiredStars(id);
      drawWrappedText(c, t('p9.lockedDetail', { stars, rank: t(`rank.${getRank(stars).index}`) }), cardX + 128, y + 32, cardW - 154, 22, 30, PALETTE.ink, 'left', 900, 3);
      y += lockH + 14;
    } else {
      // Recipe Equations Card (for Heroes & Component Pets/Hats)
      const relRecipes = isHero || (isUnit && UNITS[id].category === 'component')
        ? RECIPES.filter(r => r.hero === id || (r.parts as readonly string[]).includes(id))
        : [];
      if (relRecipes.length > 0) {
        const recH = 34 + relRecipes.length * 64;
        drawIvorySlab(c, cardX, y, cardW, recH, 16);
        drawText(c, t('p10.recipeList'), cardX + 20, y + 22, 16.5, PALETTE.inkSoft, 'left', 900);
        relRecipes.forEach((r, ri) => {
          const ry = y + 36 + ri * 60;
          const clickable = r.hero !== id;
          if (clickable && ry + 52 > vy && ry < vy + vh) {
            hits.add({ id: `compendium:entry:${r.hero}`, x: cardX + 16, y: Math.max(vy, ry), w: cardW - 32, h: Math.min(ry + 52, vy + vh) - Math.max(vy, ry) });
          }
          round(c, cardX + 16, ry, cardW - 32, 52, 14, '#f8ebd0', '#a87d4a', 1.6);
          drawSpriteContain(c, r.parts[0], cardX + 30, ry + 6, 40, 40);
          drawText(c, entryName(r.parts[0]), cardX + 76, ry + 27, 16.5, PALETTE.ink, 'left', 800);
          drawText(c, '＋', cardX + 188, ry + 27, 19, PALETTE.inkSoft, 'center', 900);
          drawSpriteContain(c, r.parts[1], cardX + 206, ry + 6, 40, 40);
          drawText(c, entryName(r.parts[1]), cardX + 252, ry + 27, 16.5, PALETTE.ink, 'left', 800);
          drawText(c, '→', cardX + 370, ry + 27, 20, '#8c4c12', 'center', 900);
          drawSpriteContain(c, r.hero, cardX + 390, ry + 4, 44, 44);
          drawText(c, entryName(r.hero), cardX + 442, ry + 27, 18.5, '#6e320b', 'left', 900);
        });
        y += recH + 12;
      }

      // Hero / Basic / Component Stats + Lv.1..5 Growth Table
      if (isHero || (isUnit && id !== 'shovel')) {
        const s1 = getBaseUnitStats(id, 1);
        const maxLv = isHero ? 5 : UNITS[id].maxLevel;
        const isBee = id === 'bee';

        // Stat Pills Bar
        const pills = isBee
          ? [t('p3.productionValue', getBeeProduction(1))]
          : [
              `⚔ ${Math.round(s1.damage)}`,
              `⚡ ${Number(s1.rate.toFixed(2))}/s`,
              `◎ ${Number(s1.range.toFixed(1))}`,
              ...(isHero ? [`✦ ${s1.charge}`] : []),
            ];
        const pillW = Math.floor((cardW - (pills.length - 1) * 10) / pills.length);
        pills.forEach((txt, pi) => {
          const px2 = cardX + pi * (pillW + 10);
          drawIvorySlab(c, px2, y, pillW, 44, 14, '#fffdf8', '#f5e4c2', '#8a5d32', 1.8);
          drawText(c, txt, px2 + pillW / 2, y + 23, 17, PALETTE.ink, 'center', 900);
        });
        y += 54;

        // Growth Table Card (Lv.1..Lv.5)
        const tableH = 44 + 5 * 34 + 14;
        drawIvorySlab(c, cardX, y, cardW, tableH, 16);
        const cols = isBee
          ? [t('p3.levelHeading'), t('p3.production')]
          : isHero
            ? [t('p3.levelHeading'), t('p3.damage'), t('p6.tableRate'), t('p6.tableRange'), t('p6.tableCharge')]
            : [t('p3.levelHeading'), t('p3.damage'), t('p6.tableRate'), t('p6.tableRange')];
        const colW = (cardW - 32) / cols.length;
        round(c, cardX + 12, y + 10, cardW - 24, 32, 10, '#ecd7af', 'transparent', 0);
        cols.forEach((h, ci) => drawText(c, h, cardX + 16 + (ci + 0.5) * colW, y + 27, 15, PALETTE.ink, 'center', 900));

        for (let lv = 1; lv <= 5; lv++) {
          const ry = y + 48 + (lv - 1) * 34;
          if (lv % 2 === 0) round(c, cardX + 12, ry - 12, cardW - 24, 30, 8, 'rgba(235,214,174,0.35)', 'transparent', 0);
          drawText(c, t('p3.level', { level: lv }), cardX + 16 + 0.5 * colW, ry + 3, 15.5, PALETTE.ink, 'center', 900);
          if (lv > maxLv) {
            drawText(c, t('p3.unavailable'), cardX + 16 + (cols.length + 1) * 0.5 * colW, ry + 3, 14.5, PALETTE.muted, 'center', 700);
          } else if (isBee) {
            drawText(c, t('p3.productionValue', getBeeProduction(lv)), cardX + 16 + 1.5 * colW, ry + 3, 15.5, PALETTE.inkSoft, 'center', 800);
          } else {
            const sl = getBaseUnitStats(id, lv);
            const vals = [String(Math.round(sl.damage)), String(Number(sl.rate.toFixed(2))), String(Number(sl.range.toFixed(1))), ...(isHero ? [String(sl.charge)] : [])];
            vals.forEach((v, vi) => drawText(c, v, cardX + 16 + (vi + 1.5) * colW, ry + 3, 15.5, PALETTE.inkSoft, 'center', 800));
          }
        }
        y += tableH + 12;

        // Hero Skill + Signature & Recommended Weapons
        if (isHero) {
          const hero = HEROES[id];
          drawIvorySlab(c, cardX, y, cardW, 92, 16, '#fff8e2', '#f3dfb4', '#c4862f', 2);
          drawText(c, `★ ${t(`skill.${id}`)}`, cardX + 20, y + 26, 18.5, '#7c3c08', 'left', 900);
          drawWrappedText(c, t(`skill.${id}.desc`, { charge: hero.charge }), cardX + 20, y + 44, cardW - 40, 16, 22, PALETTE.ink, 'left', 700, 2);
          y += 104;

          const allW = Object.values(WEAPONS);
          const sig = allW.find(w => w.signatureHero === id);
          const recs = allW.filter(w => w.family === HERO_FAMILIES[id] && w.id !== sig?.id).slice(0, 2);
          const picks = sig ? [sig, ...recs] : recs;
          if (picks.length > 0) {
            const pw2 = Math.floor((cardW - (picks.length - 1) * 10) / picks.length);
            picks.forEach((w, wi) => {
              const wx = cardX + wi * (pw2 + 10);
              if (y + 78 > vy && y < vy + vh) {
                hits.add({ id: `compendium:entry:${w.id}`, x: wx, y: Math.max(vy, y), w: pw2, h: Math.min(y + 78, vy + vh) - Math.max(vy, y) });
              }
              drawIvorySlab(c, wx, y, pw2, 78, 14, wi === 0 ? '#fff2c8' : '#fffdf8', wi === 0 ? '#f7d882' : '#f4e2bc', wi === 0 ? '#c97416' : '#8a5d32', wi === 0 ? 2.4 : 1.8);
              drawSpriteContain(c, `weapon_${w.id}`, wx + 10, y + 13, 52, 52);
              drawText(c, t(wi === 0 ? 'p3.signature' : 'p3.recommendation'), wx + 68, y + 26, 13.5, wi === 0 ? '#a8530b' : PALETTE.inkSoft, 'left', 900);
              drawText(c, entryName(w.id).slice(0, 7), wx + 68, y + 52, 16.5, PALETTE.ink, 'left', 900);
            });
            y += 90;
          }
        } else {
          drawIvorySlab(c, cardX, y, cardW, 64, 15);
          drawWrappedText(c, t(UNITS[id].category === 'basic' ? 'p3.drawBasic' : 'p3.drawComponent'), cardX + 20, y + 18, cardW - 40, 16, 22, PALETTE.inkSoft, 'left', 700, 2);
          y += 76;
        }
      } else if (isUnit && id === 'shovel') {
        drawIvorySlab(c, cardX, y, cardW, 88, 16);
        drawWrappedText(c, t('inspect.toolBody'), cardX + 20, y + 18, cardW - 40, 17, 24, PALETTE.ink, 'left', 700, 3);
        y += 100;
      } else if (isEnemy) {
        const en = ENEMIES[id];
        const pills = [
          `♥ ${t('p7.hp', { value: en.hp })}`,
          `➜ ${t('p7.speed', { value: en.speed })}`,
          `◈ ${t('p7.armor', { value: Math.round(en.armor * 100) })}`,
          ...(en.boss ? [`⏳ ${t('p1.cooldown', { time: en.interval })}`] : []),
        ];
        const pillW = Math.floor((cardW - (pills.length - 1) * 10) / pills.length);
        pills.forEach((txt, pi) => {
          const px2 = cardX + pi * (pillW + 10);
          drawIvorySlab(c, px2, y, pillW, 44, 14);
          drawText(c, txt, px2 + pillW / 2, y + 23, 16, PALETTE.ink, 'center', 900);
        });
        y += 56;

        drawIvorySlab(c, cardX, y, cardW, 92, 16);
        drawWrappedText(c, t(en.boss ? `p1.boss.${id}.mechanic` : `p3.minion.${id}.mechanic`), cardX + 20, y + 18, cardW - 40, 16.5, 24, PALETTE.ink, 'left', 700, 3);
        y += 104;

        drawIvorySlab(c, cardX, y, cardW, 96, 16, '#e9f8e2', '#d2efc6', '#3d8633', 2);
        drawText(c, t('p1.counter'), cardX + 20, y + 24, 17, '#22591b', 'left', 900);
        drawWrappedText(c, t(en.boss ? `p1.boss.${id}.tip` : `p3.minion.${id}.tip`), cardX + 20, y + 42, cardW - 40, 16, 22, '#24521e', 'left', 700, 2);
        y += 108;
      } else if (isWeapon) {
        const w = WEAPONS[id];
        const rule = RARITY_RULES[w.rarity];
        drawIvorySlab(c, cardX, y, cardW, 118, 16);
        drawText(c, `${t('p1.unlock', { count: rule.fragments })}   ·   ${t('m2.damage', { value: Math.round(rule.damageBonus * 100) })}`, cardX + 20, y + 28, 17.5, '#7c3f08', 'left', 900);
        drawWrappedText(c, t(`weapon.${id}.desc`), cardX + 20, y + 50, cardW - 40, 17, 24, PALETTE.ink, 'left', 700, 3);
        y += 130;
        if (w.signatureHero) {
          if (y + 84 > vy && y < vy + vh) {
            hits.add({ id: `compendium:entry:${w.signatureHero}`, x: cardX, y: Math.max(vy, y), w: cardW, h: Math.min(y + 84, vy + vh) - Math.max(vy, y) });
          }
          drawIvorySlab(c, cardX, y, cardW, 84, 16, '#fff4cf', '#f6da8a', '#c77a14', 2.2);
          drawSpriteContain(c, w.signatureHero, cardX + 18, y + 10, 64, 64);
          drawText(c, `★ ${t('m2.signature', { hero: t(`hero.${w.signatureHero}`) })}`, cardX + 96, y + 43, 18.5, '#7c3b08', 'left', 900);
          y += 96;
        }
      } else if (isProp) {
        const pr = PROPS[id];
        drawIvorySlab(c, cardX, y, cardW, 130, 16);
        drawText(
          c,
          `${t(`m2.${pr.type}`)}   ·   ${t('p1.price', { price: pr.price })}   ·   ${t(pr.type === 'active' ? 'p1.cooldown' : 'p1.auto', { time: pr.cooldown })}`,
          cardX + 20,
          y + 30,
          17,
          '#7c3f08',
          'left',
          900,
        );
        drawWrappedText(c, t(`prop.${id}.desc`), cardX + 20, y + 56, cardW - 40, 17.5, 25, PALETTE.ink, 'left', 700, 3);
        y += 142;
      }
    }

    const contentH = Math.max(vh, y + scroll.offset - vy + 12);
    c.restore();
    scroll.setContentBounds(contentH, vh);
    drawScrollbar(c, vx, vy, vw, vh, contentH, scroll);
    return { scrollViewport: { x: vx, y: vy, w: vw, h: vh } };
  }

  // ── MOBILE BIG-CARD GRID (2-column Giant Recipes / 3-column Giant Cards!) ──
  const vx = body.x, vy = body.y, vw = body.w, vh = body.h;
  c.save();
  c.beginPath();
  c.rect(vx, vy, vw, vh);
  c.clip();

  const innerW = vw - 16;
  const gapX = 16, gapY = 14;
  let totalRows = 0;
  let cardH = 226;

  if (ui.tab === 'matrix') {
    const cols = 2;
    const cardW = Math.floor((innerW - gapX * (cols - 1)) / cols);
    cardH = 152;
    totalRows = Math.ceil(RECIPES.length / cols);
    RECIPES.forEach((r, idx) => {
      const col = idx % cols, row = Math.floor(idx / cols);
      const rx = vx + 4 + col * (cardW + gapX);
      const ry = vy + 4 + row * (cardH + gapY) - scroll.offset;
      if (ry + cardH < vy - 20 || ry > vy + vh + 20) return;

      const avail = isAvailable(r.hero);
      const coll = entryCollected(r.hero, profile);
      if (ry + cardH > vy && ry < vy + vh) {
        hits.add({ id: `compendium:entry:${r.hero}`, x: rx, y: Math.max(vy, ry), w: cardW, h: Math.min(ry + cardH, vy + vh) - Math.max(vy, ry) });
      }

      drawIvorySlab(c, rx, ry, cardW, cardH, 20, avail ? '#fffdf8' : '#efe7d8', avail ? '#f6e8cb' : '#e3d8c4', coll ? '#c97b18' : '#7e5530', coll ? 3 : 2.2);
      round(c, rx + 16, ry + 20, 108, 108, 18, FRAME_TONE.heroes, '#8a5d32', 2.4);
      drawSpriteContain(c, r.hero, rx + 22, ry + 26, 96, 96, avail ? 1 : 0.34);

      drawText(c, entryName(r.hero), rx + 138, ry + 40, 29, avail ? PALETTE.ink : PALETTE.muted, 'left', 900);
      drawEntryStatusBadge(c, rx + cardW - 14, ry + 20, avail, coll, true, r.hero);

      // Large clear equation `[pet] 名称 + [gear] 名称`
      const eqY = ry + 102;
      drawSpriteContain(c, r.parts[0], rx + 138, eqY - 22, 44, 44, avail ? 1 : 0.45);
      const p0Name = entryName(r.parts[0]);
      drawText(c, p0Name, rx + 188, eqY + 1, 21, PALETTE.inkSoft, 'left', 800);
      c.font = '800 21px "Trebuchet MS", "PingFang SC", "Microsoft YaHei", sans-serif';
      const p0W = Math.min(120, c.measureText(p0Name).width);
      const plusX = rx + 188 + p0W + 18;
      drawText(c, '+', plusX, eqY + 1, 24, PALETTE.inkSoft, 'center', 900);
      drawSpriteContain(c, r.parts[1], plusX + 16, eqY - 22, 44, 44, avail ? 1 : 0.45);
      drawText(c, entryName(r.parts[1]), plusX + 66, eqY + 1, 21, PALETTE.inkSoft, 'left', 800);
    });
  } else {
    const ids = CATALOGS[ui.tab];
    const cols = 3;
    const cardW = Math.floor((innerW - gapX * (cols - 1)) / cols);
    cardH = 228;
    totalRows = Math.ceil(ids.length / cols);
    ids.forEach((id, idx) => {
      const col = idx % cols, row = Math.floor(idx / cols);
      const rx = vx + 4 + col * (cardW + gapX);
      const ry = vy + 4 + row * (cardH + gapY) - scroll.offset;
      if (ry + cardH < vy - 20 || ry > vy + vh + 20) return;

      const avail = isAvailable(id);
      const coll = entryCollected(id, profile);
      const isHero = Object.hasOwn(HEROES, id);
      if (ry + cardH > vy && ry < vy + vh) {
        hits.add({ id: `compendium:entry:${id}`, x: rx, y: Math.max(vy, ry), w: cardW, h: Math.min(ry + cardH, vy + vh) - Math.max(vy, ry) });
      }

      drawIvorySlab(c, rx, ry, cardW, cardH, 20, avail ? '#fffdf8' : '#efe7d8', avail ? '#f6e8cb' : '#e3d8c4', isHero && coll ? '#c97b18' : '#7e5530', isHero && coll ? 3 : 2.4);
      // Giant framed sprite (108×108!)
      round(c, rx + 14, ry + 14, 108, 108, 18, FRAME_TONE[ui.tab], '#8a5d32', 2.4);
      if (!drawSpriteContain(c, entrySprite(id), rx + 20, ry + 20, 96, 96, avail ? 1 : 0.34)) {
        drawSpriteContain(c, 'ui_weapon_fragment', rx + 20, ry + 20, 96, 96, 0.45);
      }

      // Giant title (28px!) + status pill + family chip
      drawText(c, entryName(id), rx + 134, ry + 36, 27, avail ? PALETTE.ink : PALETTE.muted, 'left', 900);
      drawEntryStatusBadge(c, rx + cardW - 12, ry + 16, avail, coll, isHero, id);
      round(c, rx + 134, ry + 64, cardW - 148, 34, 12, '#efe0be', '#a67f4e', 1.6);
      drawText(c, entryFamily(id), rx + 134 + (cardW - 148) / 2, ry + 82, 19, '#4c2c12', 'center', 900);

      // Big readable bottom description box (20px!)
      round(c, rx + 14, ry + 134, cardW - 28, 80, 14, 'rgba(232,212,172,0.42)', '#cbb082', 1.5);
      drawWrappedText(c, entryTagline(id), rx + 24, ry + 144, cardW - 48, 20.5, 28, PALETTE.ink, 'left', 800, 2);
    });
  }

  const contentH = 12 + totalRows * (cardH + gapY);
  c.restore();
  scroll.setContentBounds(contentH, vh);
  drawScrollbar(c, vx, vy, vw, vh, contentH, scroll);
  return { scrollViewport: { x: vx, y: vy, w: vw, h: vh } };
}

function drawEntryStatusBadge(
  c: CanvasRenderingContext2D,
  rightX: number,
  topY: number,
  available: boolean,
  collected: boolean,
  isHero: boolean,
  id: string,
): void {
  const bh = 38;
  if (!available) {
    const label = t('p9.starUnlock', { stars: requiredStars(id) });
    c.font = '900 21px "Trebuchet MS", "PingFang SC", "Microsoft YaHei", sans-serif';
    const bw = Math.max(126, Math.ceil(c.measureText(label).width) + 24);
    const bx = rightX - bw;
    round(c, bx, topY, bw, bh, 19, '#5e3c1f', '#ffd978', 2.4);
    drawText(c, label, bx + bw / 2, topY + bh / 2 + 1, 21, '#fff6df', 'center', 900);
    return;
  }
  const isOwnedType = Object.hasOwn(WEAPONS, id) || Object.hasOwn(PROPS, id);
  const key = collected ? (isOwnedType ? 'p10.owned' : 'p10.collected') : isHero ? 'p10.canMerge' : 'p10.uncollected';
  const label = t(key);
  c.font = '900 19px "Trebuchet MS", "PingFang SC", "Microsoft YaHei", sans-serif';
  const bw = Math.max(96, Math.ceil(c.measureText(label).width) + 22);
  const bx = rightX - bw;
  const fill = collected ? (isHero ? '#f6c542' : '#6db33f') : '#dfd2b8';
  const color = collected ? (isHero ? '#452208' : '#fffdf5') : '#5d4630';
  round(c, bx, topY, bw, 34, 17, fill, '#4c2d12', 2);
  drawText(c, label, bx + bw / 2, topY + 18, 19, color, 'center', 900);
}

export { LEDGER };
