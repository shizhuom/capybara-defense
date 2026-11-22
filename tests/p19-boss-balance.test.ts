import { describe, expect, it } from 'vitest';
import { BattleEngine } from '../src/core/BattleEngine';
import { BOX_SEAL_DURATION, ENEMIES } from '../src/config/enemies';
import { getRankDifficulty } from '../src/config/ranks';
import { BOSS_UNSTOPPABLE_TIME } from '../src/config/waves';
import { GridSystem } from '../src/core/GridSystem';
import { createProfile } from '../src/core/MetaProgression';
import { getMapUnlockRequirement } from '../src/core/PlayerProgression';
import { RANKS } from '../src/config/ranks';
import { courtyardMarkup } from '../src/ui/CourtyardView';
import { ProfileScreens } from '../src/ui/ProfileScreens';
import { setLanguage, t } from '../src/i18n/i18n';

function arena(rankIndex = 0) {
  const e = new BattleEngine({ seed: 42, autoWaves: false, ai: false, rankIndex });
  e.start();
  return e;
}

function place(e: BattleEngine, kind: string, col = 2, row = 1, level = 1) {
  const id = e.grant(kind).unitId!;
  const u = e.state.units.find(x => x.id === id)!;
  u.location = { zone: 'board', col, row };
  u.level = level;
  return u;
}

function bossAt(e: BattleEngine, kind: string, progress = 2) {
  const b = e.spawnEnemy(kind, 'player');
  b.progress = progress;
  Object.assign(b, GridSystem.pathPosition('player', progress, e.state.mapId));
  b.speed = 0;
  b.hp = b.maxHp = 999999;
  return b;
}

describe('P19.2 Boss balance: Dr. Buzzcut temporary clip, Overtime Boss Unstoppable, Box Kraken seal', () => {
  it('makes awakened heroes completely immune to Dr. Buzzcut downgrade and emits immunity feedback', () => {
    const e = arena();
    e.state.endless = true;
    e.state.wave = 12;
    const awakenedHero = place(e, 'kungfu_po', 2, 1, 5);
    awakenedHero.awakened = true;
    const boss = bossAt(e, 'dr_clippers', 2);
    boss.abilityCooldown = 0.01;
    e.tick(0.05);
    expect(awakenedHero.level).toBe(5);
    expect(awakenedHero.clippedLevels).toBeUndefined();
    expect(awakenedHero.statuses.MERGE_LOCK).toBeUndefined();
    expect(e.state.events.some(ev => ev.textKey === 'p19.awakenedImmuneClip' && ev.unitId === awakenedHero.id)).toBe(true);
  });

  it('temporarily clips non-awakened units by at most 1 level per wave with vivid cues and restores level when the boss dies', () => {
    const e = arena();
    e.state.wave = 6;
    const hero = place(e, 'zen_master', 2, 1, 4);
    const boss = bossAt(e, 'dr_clippers', 2);
    boss.abilityCooldown = 0.01;

    // First clip in wave 6: Lv.4 -> Lv.3 with prominent clipped VFX + floating text
    e.tick(0.05);
    expect(hero.level).toBe(3);
    expect(hero.clippedLevels).toBe(1);
    expect(hero.clippedByBossId).toBe(boss.id);
    expect(hero.clippedWave).toBe(6);
    expect(e.state.events.some(ev => ev.type === 'boss_skill' && ev.effect === 'dr_clippers')).toBe(true);
    expect(e.state.events.some(ev => ev.type === 'purge' && ev.effect === 'clipped' && ev.textKey === 'p19.clippedDowngrade' && ev.unitId === hero.id)).toBe(true);

    // Second cast by same boss in the same wave: capped at 1 level per wave!
    boss.abilityCooldown = 0.01;
    e.tick(0.05);
    expect(hero.level).toBe(3);

    // Even a second Dr. Buzzcut in the same wave cannot drop it further!
    const boss2 = bossAt(e, 'dr_clippers', 2);
    boss2.abilityCooldown = 0.01;
    e.tick(0.05);
    expect(hero.level).toBe(3);

    // Killing the boss that clipped it restores the hero right back to Lv.4 and clears MERGE_LOCK!
    e.hurt(boss, boss.hp * 2, hero, false, false, true);
    expect(hero.level).toBe(4);
    expect(hero.clippedLevels).toBeUndefined();
    expect(hero.clippedByBossId).toBeUndefined();
    expect(hero.statuses.MERGE_LOCK).toBeUndefined();
    expect(e.state.events.some(ev => ev.type === 'purge' && ev.effect === 'clip_restore' && ev.textKey === 'p19.clipRestored' && ev.unitId === hero.id)).toBe(true);

    // Still protected for the rest of wave 6 even after restoring!
    boss2.abilityCooldown = 0.01;
    e.tick(0.05);
    expect(hero.level).toBe(4);

    // In the next wave, a boss can apply a fresh 1-level temporary clip again.
    e.state.wave = 7;
    boss2.abilityCooldown = 0.01;
    e.tick(0.05);
    expect(hero.level).toBe(3);
    expect(hero.clippedWave).toBe(7);
  });

  it('does not leak a clipped part tag onto a newly forged Lv.1 hero recipe', () => {
    const e = arena();
    e.state.wave = 6;
    const panda = place(e, 'panda', 2, 1, 2);
    const boss = bossAt(e, 'dr_clippers', 2);
    boss.abilityCooldown = 0.01;
    e.tick(0.05);
    expect(panda.level).toBe(1);
    expect(panda.clippedLevels).toBe(1);
    delete panda.statuses.MERGE_LOCK;
    const hat = e.grant('hat_bamboo').unitId!;
    expect(e.move(hat, { zone: 'board', col: 2, row: 1 }).ok).toBe(true);
    const po = e.state.units.find(u => u.kind === 'kungfu_po')!;
    expect(po.level).toBe(1);
    expect(po.clippedLevels).toBeUndefined();
    e.hurt(boss, boss.hp * 2, po, false, false, true);
    expect(po.level).toBe(1);
  });

  it('grants bosses overtime knockback & stun immunity after BOSS_UNSTOPPABLE_TIME to prevent infinite endless stall', () => {
    const e = arena();
    e.state.endless = true;
    e.state.wave = 25;
    const boss = bossAt(e, 'husky_wrecker', 6);
    boss.speed = 0.3;

    // Before overtime: knockback works normally
    e.knockback(boss, 2);
    expect(boss.progress).toBeCloseTo(4, 3);
    expect(boss.knockbackImmune).toBeFalsy();

    // Advance wave time past BOSS_UNSTOPPABLE_TIME (60s)
    e.state.waveTime = BOSS_UNSTOPPABLE_TIME;
    e.tick(0.1);
    expect(boss.knockbackImmune).toBe(true);
    expect(e.state.events.some(ev => ev.textKey === 'p19.bossUnstoppable')).toBe(true);

    // Knockback is now ignored, stun is cleared, and boss keeps advancing steadily
    const before = boss.progress;
    boss.stun = 5;
    e.knockback(boss, 4.5);
    expect(boss.progress).toBeCloseTo(before, 5);
    e.tick(1);
    expect(boss.stun).toBe(0);
    expect(boss.progress).toBeGreaterThan(before + 0.15);

    // Non-boss minions are still knockbackable even in overtime
    const rat = e.spawnEnemy('rat', 'player');
    rat.progress = 8;
    e.knockback(rat, 2);
    expect(rat.progress).toBeCloseTo(6, 3);
  });

  it('keeps Box Kraken seal strictly shorter than its cooldown at every rank and prefers unsealed heroes', () => {
    expect(BOX_SEAL_DURATION).toBe(6);
    expect(ENEMIES.box_kraken.interval).toBe(14);
    for (let rank = 0; rank <= 53; rank++) {
      const cd = ENEMIES.box_kraken.interval * getRankDifficulty(rank).bossCooldownScale;
      expect(cd - BOX_SEAL_DURATION).toBeGreaterThanOrEqual(4.4);
    }

    const e = arena();
    const high = place(e, 'kungfu_po', 2, 1, 5);
    const second = place(e, 'zen_master', 3, 1, 4);
    e.spawnBoss('box_kraken', 'player');
    expect(high.statuses.SEALED).toBe(BOX_SEAL_DURATION);
    expect(second.statuses.SEALED).toBeUndefined();

    // A second Box Kraken prefers the unsealed Lv.4 hero instead of refreshing the already boxed hero!
    e.spawnBoss('box_kraken', 'player');
    expect(second.statuses.SEALED).toBe(BOX_SEAL_DURATION);
  });

  it('ships complete bilingual labels for the new boss combat cues', () => {
    for (const lang of ['zh-CN', 'en'] as const) {
      setLanguage(lang);
      for (const key of ['p19.clippedDowngrade', 'p19.clipRestored', 'p19.awakenedImmuneClip', 'p19.bossUnstoppable', 'p19.unstoppableTag', 'p19.mapUnlockTip', 'p19.rankLadderTitle', 'p19.rankCurrent']) {
        expect(t(key)).not.toBe(key);
      }
    }
    setLanguage('zh-CN');
  });

  it('shows exact unlock conditions on hover tooltips for all locked maps', () => {
    expect(getMapUnlockRequirement('sunny_backyard')).toEqual({ rankIndex: 0, minStars: 0 });
    expect(getMapUnlockRequirement('sakura_onsen')).toEqual({ rankIndex: 10, minStars: 20 });
    expect(getMapUnlockRequirement('midnight_kitchen')).toEqual({ rankIndex: 20, minStars: 40 });
    expect(getMapUnlockRequirement('cat_tower_maze')).toEqual({ rankIndex: 30, minStars: 60 });

    const profile = { ...createProfile(), stars: 12, highestStars: 12, matches: 5 };
    const html = courtyardMarkup(profile);
    // sunny_backyard is unlocked (no lock tooltip)
    expect(html).not.toContain('data-action="locked-map:sunny_backyard"');
    // sakura_onsen (20★), midnight_kitchen (40★), cat_tower_maze (60★) have hover tooltips with exact star & rank requirement
    expect(html).toContain('data-action="locked-map:sakura_onsen"');
    expect(html).toContain('达到 20★（猫咖店长 I）解锁 · 还差 8★');
    expect(html).toContain('达到 40★（宠物营养师 I）解锁 · 还差 28★');
    expect(html).toContain('达到 60★（萌宠统帅 I）解锁 · 还差 48★');
    expect(html.match(/class="map-lock-tooltip"/g)).toHaveLength(3);
  });

  it('toggles a full 54-rank star ladder when clicking current rank in Leaderboard and highlights current rank', () => {
    const profile = { ...createProfile(), stars: 25, highestStars: 25 };
    let renders = 0;
    const screens = new ProfileScreens(() => profile, () => true, () => { renders++; }, () => {});
    const initial = screens.markup('leaderboard');
    expect(initial).toContain('data-action="rank-ladder-toggle"');
    expect(initial).not.toContain('rank-ladder-panel');

    expect(screens.action('rank-ladder-toggle')).toBe(true);
    expect(renders).toBe(1);
    expect(screens.isRankLadderOpen()).toBe(true);

    const open = screens.markup('leaderboard');
    expect(open).toContain('rank-ladder-panel');
    expect(open).toContain('升级零惩罚');
    expect(open).toContain('前10波小怪 +8');
    expect(open.match(/data-rank-index="/g)).toHaveLength(RANKS.length);
    expect(open.match(/data-current-rank="true"/g)).toHaveLength(1);
    // 25★ corresponds to rank index 12 (24–25★, 猫咖店长 III)
    expect(open).toContain('data-rank-index="12" data-current-rank="true"');
    expect(open).toContain('24–25★');
    expect(open).toContain('180★+');

    expect(screens.action('rank-ladder-close')).toBe(true);
    expect(screens.isRankLadderOpen()).toBe(false);
    expect(screens.markup('leaderboard')).not.toContain('rank-ladder-panel');
  });
});
