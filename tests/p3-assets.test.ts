import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MAP_IDS } from '../src/config/maps';
import { BOSS_IDS } from '../src/config/enemies';

const manifest: string[] = JSON.parse(readFileSync('public/assets/sprites/manifest.json', 'utf8'));
const png = (id: string) => readFileSync(`public/assets/sprites/${id}.png`);

describe('P3 shipped landscape artwork', () => {
  it('contains all shipped unique safe IDs with decodable PNG headers', () => {
    expect(manifest).toHaveLength(193);
    expect(new Set(manifest).size).toBe(193);
    for (const id of manifest) {
      expect(id).toMatch(/^[a-z][a-z0-9_]*$/);
      const data = png(id);
      expect([...data.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
      expect(data.readUInt32BE(16)).toBeGreaterThan(0);
      expect(data.readUInt32BE(20)).toBeGreaterThan(0);
    }
  });
  it.each(MAP_IDS)('%s is a full 1280 by 720 scenic stage', id => {
    const data = png(`map_${id}`);
    expect([data.readUInt32BE(16), data.readUInt32BE(20)]).toEqual([1280, 720]);
  });
  it('supplies both walking poses for five minions and twelve bosses', () => {
    const kinds = ['rat', 'roach', 'crab', 'killer_bee', 'charmed_rat', ...BOSS_IDS];
    expect(kinds).toHaveLength(17);
    for (const kind of kinds) {
      expect(manifest).toContain(kind);
      expect(manifest).toContain(`${kind}_walk2`);
      expect(png(kind).equals(png(`${kind}_walk2`))).toBe(false);
    }
  });
  it('ships illustrated food, bell, guide and shop controls', () => {
    for (const name of ['fish_food', 'bell_summon', 'compendium_book', 'shop_bag']) {
      expect(manifest).toContain(`ui_${name}`);
    }
  });
});
