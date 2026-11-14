import { afterEach, describe, expect, it } from 'vitest';
import { WEAPONS } from '../src/config/weapons';
import { PROPS } from '../src/config/props';
import { m2Zh, m2En } from '../src/i18n/m2';
import { setLanguage, t } from '../src/i18n/i18n';
import { readFileSync } from 'node:fs';

describe('M2 live localization', () => {
  afterEach(() => setLanguage('zh-CN'));
  it('provides both names and actual descriptions for every weapon and prop', () => {
    expect(Object.keys(WEAPONS)).toHaveLength(36);
    expect(Object.keys(PROPS)).toHaveLength(20);
    for (const language of ['zh-CN', 'en'] as const) {
      setLanguage(language);
      for (const item of Object.values(WEAPONS)) {
        expect(t(`weapon.${item.id}`)).toBe(item.name[language]);
        expect(t(`weapon.${item.id}.desc`)).toBe(item.description[language]);
        expect(t(`fragment.${item.id}`)).toContain(item.name[language]);
      }
      for (const item of Object.values(PROPS)) {
        expect(t(`prop.${item.id}`)).toBe(item.name[language]);
        expect(t(`prop.${item.id}.desc`)).toBe(item.description[language]);
      }
    }
  });
  it('covers every dynamic key and replaces all supplied placeholders on a language change', () => {
    expect(Object.keys(m2Zh).sort()).toEqual(Object.keys(m2En).sort());
    for (const key of Object.keys(m2Zh)) {
      const variables = Object.fromEntries([...m2Zh[key].matchAll(/\{(\w+)\}/g)].map(match => [match[1], 7]));
      for (const language of ['zh-CN', 'en'] as const) {
        setLanguage(language);
        expect(t(key, variables), `${language}: ${key}`).not.toBe(key);
        expect(t(key, variables)).not.toMatch(/\{\w+\}/);
      }
    }
    setLanguage('zh-CN'); const before = t('m2.prizeCoins', { amount: 80 });
    setLanguage('en'); expect(t('m2.prizeCoins', { amount: 80 })).not.toBe(before);
  });
  it('covers literal dynamic notifications in the meta, prop and UI implementations', () => {
    const files = ['src/core/MetaProgression.ts', 'src/core/PropSystem.ts', 'src/ui/GameApp.ts', 'src/ui/MetaScreens.ts'];
    for (const file of files) {
      const code = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
      const keys = [...code.matchAll(/['"]((?:m2|meta)\.[A-Za-z]+)['"]/g)].map(match => match[1]);
      for (const key of keys) {
        expect(m2Zh[key], `${file}: ${key} Chinese`).toBeTruthy();
        expect(m2En[key], `${file}: ${key} English`).toBeTruthy();
      }
    }
    expect(m2En['render.sealedHint']).toBeTruthy();
  });
});
