import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { m3Zh, m3En } from '../src/i18n/m3';
import { MAPS } from '../src/config/maps';
import { RANKS } from '../src/config/ranks';
import { AVATARS } from '../src/config/avatars';
import { BOSS_IDS, ENEMIES } from '../src/config/enemies';
import { setLanguage, t } from '../src/i18n/i18n';

describe('M3 complete live localization', () => {
  afterEach(() => setLanguage('zh-CN'));
  it('covers every configuration name, avatar condition and boss bubble', () => {
    for (const language of ['zh-CN', 'en'] as const) {
      setLanguage(language);
      expect(Object.values(MAPS)).toHaveLength(4);
      expect(RANKS).toHaveLength(54);
      expect(Object.values(AVATARS)).toHaveLength(16);
      for (const map of Object.values(MAPS)) expect(t(`map.${map.id}`)).toBe(map.name[language]);
      for (const rank of RANKS) expect(t(`rank.${rank.index}`)).toBe(rank.name[language]);
      for (const avatar of Object.values(AVATARS)) {
        expect(t(`avatar.${avatar.id}`)).toBe(avatar.name[language]);
        expect(t(`avatar.${avatar.id}.desc`)).toBe(avatar.description[language]);
      }
      for (const { id } of Object.values(ENEMIES).filter(enemy => !enemy.boss)) expect(t(`enemy.${id}`)).not.toBe(`enemy.${id}`);
      for (const id of BOSS_IDS) {
        expect(t(`boss.${id}`)).not.toBe(`boss.${id}`);
        expect(t(`boss.${id}.bubble`)).not.toBe(`boss.${id}.bubble`);
      }
    }
  });
  it('has exactly matching keys and placeholder sets with no unresolved substitutions', () => {
    expect(Object.keys(m3Zh).sort()).toEqual(Object.keys(m3En).sort());
    for (const key of Object.keys(m3Zh)) {
      const names = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
      expect(names(m3Zh[key]), key).toEqual(names(m3En[key]));
      for (const language of ['zh-CN', 'en'] as const) {
        setLanguage(language);
        expect(t(key, Object.fromEntries(names(m3Zh[key]).map(name => [name, 7])))).not.toMatch(/\{\w+\}/);
      }
    }
    setLanguage('en'); expect(t('app.edition')).toContain('v1.0');
  });
  it('translates all literal M3 UI keys and changes immediately', () => {
    for (const file of ['GameApp.ts', 'MetaScreens.ts', 'ProfileScreens.ts']) {
      const code = readFileSync(new URL(`../src/ui/${file}`, import.meta.url), 'utf8');
      for (const match of code.matchAll(/['"](m3\.[A-Za-z]+)['"]/g)) {
        expect(m3Zh[match[1]], match[1]).toBeTruthy();
        expect(m3En[match[1]], match[1]).toBeTruthy();
      }
    }
    setLanguage('zh-CN'); const before = t('m3.promotion', { rank: 'X' });
    setLanguage('en'); expect(t('m3.promotion', { rank: 'X' })).not.toBe(before);
  });
});
