import { describe, it, expect } from 'vitest';
import { BattleEngine } from '../src/core/BattleEngine';
import { ENEMIES } from '../src/config/enemies';
import { setMobileWideStage } from '../src/config/maps';
import { UNITS } from '../src/config/units';
import { getBaseUnitStats } from '../src/core/UnitStats';
import { getStandardBossScaling, getStandardMinionPressure, getWaveConfig, WAVES } from '../src/config/waves';

describe('r18 Difficulty Balance: draw weights, standard boss/wave scaling, tutorial protection, endless invariants', () => {
  it('keeps basic pet weights & level multipliers unchanged while lowering shovel and hero component weights', () => {
    // Basic pet draw weights preserved
    expect(UNITS.hamster.weight).toBe(20);
    expect(UNITS.squirrel.weight).toBe(20);
    expect(UNITS.hedgehog.weight).toBe(16);
    expect(UNITS.corgi.weight).toBe(12);
    expect(UNITS.bee.weight).toBe(8);

    // Basic pet level multipliers preserved ([1, 1.55, 2.25, 3.15, 4.3])
    const h1 = getBaseUnitStats('hamster', 1);
    const h2 = getBaseUnitStats('hamster', 2);
    const h5 = getBaseUnitStats('hamster', 5);
    expect(h2.damage / h1.damage).toBeCloseTo(1.55, 5);
    expect(h5.damage / h1.damage).toBeCloseTo(4.3, 5);

    // Shovel weight lowered (10 -> 3.5) and hero component weights lowered (~40%)
    expect(UNITS.shovel.weight).toBe(3.5);
    expect(UNITS.panda.weight).toBe(1.8);
    expect(UNITS.cat.weight).toBe(1.8);
    expect(UNITS.shiba.weight).toBe(1.8);
    expect(UNITS.hat_bamboo.weight).toBe(1.4);
    expect(UNITS.hat_shades.weight).toBe(1.4);
    expect(UNITS.hat_wizard.weight).toBe(1.2);
    for (const uniquePart of ['goose', 'cleaver', 'rooster', 'basketball', 'raccoon', 'trash_lid', 'frog', 'crown']) {
      expect(UNITS[uniquePart].weight).toBe(0.65);
    }
  });

  it('escalates standard W4–W10 boss HP cleanly even for 0★ Husky and applies standard minion pressure', () => {
    const w4Husky = getStandardBossScaling(ENEMIES.husky_wrecker.hp, 4, false);
    const w6Husky = getStandardBossScaling(ENEMIES.husky_wrecker.hp, 6, false);
    const w10Husky = getStandardBossScaling(ENEMIES.husky_wrecker.hp, 10, false);
    expect(Math.round(ENEMIES.husky_wrecker.hp * w4Husky.hpScale)).toBe(1900);
    expect(Math.round(ENEMIES.husky_wrecker.hp * w6Husky.hpScale)).toBe(3600);
    expect(Math.round(ENEMIES.husky_wrecker.hp * w10Husky.hpScale)).toBe(10200);
    expect(w10Husky.speedMult).toBeCloseTo(1.08, 5);

    const w10Skunk = getStandardBossScaling(ENEMIES.king_skunk.hp, 10, false);
    expect(Math.round(ENEMIES.king_skunk.hp * w10Skunk.hpScale)).toBe(Math.round(ENEMIES.king_skunk.hp * 2.7));

    // Minion pressure stays neutral on W1–W2 and ramps smoothly to W10
    expect(getStandardMinionPressure(1, false)).toEqual({ hpMult: 1, speedMult: 1 });
    expect(getStandardMinionPressure(2, false)).toEqual({ hpMult: 1, speedMult: 1 });
    expect(getStandardMinionPressure(10, false)).toEqual({ hpMult: 1.8, speedMult: 1.14 });
  });

  it('keeps tutorialGuided Match 1 strongly protected so new players clear reliably', () => {
    const tutBoss = getStandardBossScaling(ENEMIES.husky_wrecker.hp, 10, true);
    const tutMinion = getStandardMinionPressure(10, true);
    expect(tutBoss.hpScale).toBeLessThan(1);
    expect(tutBoss.speedMult).toBeLessThan(1);
    expect(tutMinion.hpMult).toBeLessThan(1);
    expect(tutMinion.speedMult).toBeLessThan(1);

    // Live BattleEngine check: Match 1 tutorial spawns protected boss on Wave 10, while non-tutorial 0★ spawns scaled 10,200 HP boss
    setMobileWideStage(true);
    try {
      const tut = new BattleEngine({ seed: 42, mapId: 'sunny_backyard', progressionStars: 0, tutorialGuided: true, autoWaves: false });
      tut.start();
      tut.state.wave = 10;
      tut.spawnBoss('husky_wrecker');
      const tutHp = tut.state.enemies[0].maxHp;

      const std = new BattleEngine({ seed: 42, mapId: 'sunny_backyard', progressionStars: 0, tutorialGuided: false, autoWaves: false });
      std.start();
      std.state.wave = 10;
      std.spawnBoss('husky_wrecker');
      const stdHp = std.state.enemies[0].maxHp;

      expect(tutHp).toBeLessThan(600); // 700 * 0.72 * 0.85 = 428.4
      expect(Math.round(stdHp)).toBe(10200);
    } finally {
      setMobileWideStage(false);
    }
  });

  it('preserves Endless Wave 11+ smooth continuity above W10 and direct spawnEnemy invariants', () => {
    expect(WAVES[9].hpScale).toBe(9);
    const w10EffectiveHp = WAVES[9].hpScale * getStandardMinionPressure(10, false).hpMult;
    expect(getWaveConfig(11).hpScale).toBeGreaterThan(w10EffectiveHp);
    expect(getWaveConfig(11).hpScale).toBeCloseTo(w10EffectiveHp * 1.25, 6);
    expect(getWaveConfig(11).speedScale).toBeGreaterThan(getStandardMinionPressure(10, false).speedMult);

    const e = new BattleEngine({ seed: 7, autoWaves: false });
    e.start();
    const directBoss = e.spawnEnemy('diva_kitty', 'player');
    expect(directBoss.maxHp).toBe(ENEMIES.diva_kitty.hp);
    expect(directBoss.speed).toBe(ENEMIES.diva_kitty.speed);
  });
});
