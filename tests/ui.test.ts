import { afterEach, describe, expect, it } from 'vitest';
import { awardBattle, emptyProfile, loadProfile, resetOwnStorage, saveProfile, STORAGE_PREFIX } from '../src/ui/storage';
import { en } from '../src/i18n/en';
import { zhCN } from '../src/i18n/zh-CN';
import { getLanguage, onLanguageChange, setLanguage, t } from '../src/i18n/i18n';
import { UNITS } from '../src/config/units';
import { HEROES } from '../src/config/heroes';
import { BOSS_IDS, FRAGMENTS } from '../src/config/enemies';
import type { BattleResult } from '../src/core/types';

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    key: (index) => [...data.keys()][index] ?? null,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
    removeItem: (key) => { data.delete(key); },
    clear: () => data.clear(),
  };
}

const victory: BattleResult = {
  winner: 'player', reason: 'waves', loot: ['bamboo_blade', 'orange_wand'],
  playerLoot: ['bamboo_blade'], aiLoot: ['orange_wand'], coins: 120, elapsed: 280,
};

describe('isolated profile persistence', () => {
  it('returns a usable empty profile when JSON is corrupt or storage is blocked', () => {
    const storage = memoryStorage();
    storage.setItem(`${STORAGE_PREFIX}profile`, '{broken');
    expect(loadProfile(storage)).toEqual(emptyProfile());
    const blocked = { getItem() { throw new Error('denied'); } } as unknown as Storage;
    expect(loadProfile(blocked)).toEqual(emptyProfile());
  });

  it('validates numeric counters, known fragments and battle receipts on load', () => {
    const storage = memoryStorage();
    storage.setItem(`${STORAGE_PREFIX}profile`, JSON.stringify({
      coins: -5, matches: 3, wins: 100, fragments: ['orange_wand', null, 'fake_fragment'],
      awardedBattles: ['battle-1', 'battle-1', 100, ''],
    }));
    expect(loadProfile(storage)).toEqual({
      ...emptyProfile(), tutorialCompleted:true, tutorialRewardClaimed:true,
      coins: 0, matches: 3, wins: 3, fragments: ['orange_wand'], awardedBattles: ['battle-1'],
      weaponFragments:{m01_swatter:1},unlockedWeapons:[],
      stars:3,highestStars:3,unlockedAvatars:['capybara','hamster','squirrel','bee','cat_swordsman'],
    });
  });

  it('awards a finished battle once, including after a save and reload', () => {
    const storage = memoryStorage();
    const first = awardBattle(emptyProfile(), 'battle-once', victory);
    expect(first.awarded).toBe(true);
    expect(first.profile).toMatchObject({ coins: 120, wins: 1, matches: 1, fragments: ['bamboo_blade', 'orange_wand'] });
    expect(saveProfile(first.profile, storage)).toBe(true);
    const duplicate = awardBattle(loadProfile(storage), 'battle-once', victory);
    expect(duplicate.awarded).toBe(false);
    expect(duplicate.profile).toEqual(first.profile);
  });

  it('records a loss without giving the losing player the winner’s coins or loot', () => {
    const lost = awardBattle(emptyProfile(), 'loss', { ...victory, winner: 'ai' });
    expect(lost.profile).toMatchObject({ coins: 0, wins: 0, matches: 1, fragments: [] });
  });

  it('deletes only this game’s keys, preserving unrelated saves', () => {
    const storage = memoryStorage();
    storage.setItem('original-game:save', 'precious');
    storage.setItem(`${STORAGE_PREFIX}profile`, '{}');
    storage.setItem(`${STORAGE_PREFIX}language`, 'en');
    expect(resetOwnStorage(storage)).toBe(true);
    expect(storage.length).toBe(1);
    expect(storage.getItem('original-game:save')).toBe('precious');
  });

  it('keeps the in-memory award usable when a browser refuses writes', () => {
    const blocked = { setItem() { throw new Error('quota'); } } as unknown as Storage;
    const award = awardBattle(emptyProfile(), 'memory-only', victory);
    expect(saveProfile(award.profile, blocked)).toBe(false);
    expect(awardBattle(award.profile, 'memory-only', victory).profile.coins).toBe(120);
  });
});

describe('live localization', () => {
  afterEach(() => setLanguage('zh-CN'));

  it('switches immediately, interpolates values, and stops notifying unsubscribed views', () => {
    setLanguage('zh-CN');
    const before = t('hud.wave', { wave: 4, total: 10 });
    let changes = 0;
    const unsubscribe = onLanguageChange(() => changes++);
    setLanguage('en');
    expect(getLanguage()).toBe('en');
    expect(t('hud.wave', { wave: 4, total: 10 })).toContain('4');
    expect(t('hud.wave', { wave: 4, total: 10 })).not.toEqual(before);
    expect(changes).toBe(1);
    unsubscribe();
    setLanguage('zh-CN');
    expect(changes).toBe(1);
  });

  it('has both language entries for every unit, skill, boss and reward shown by the game', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zhCN).sort());
    const keys = [
      ...Object.keys(UNITS).map(id => `unit.${id}`),
      ...Object.keys(HEROES).flatMap(id => [`hero.${id}`, `skill.${id}`, `skill.${id}.desc`, `ult.${id}`]),
      ...BOSS_IDS.flatMap(id => [`boss.${id}`, `boss.${id}.bubble`]),
      ...FRAGMENTS.map(id => `fragment.${id}`),
    ];
    for (const key of keys) {
      setLanguage('zh-CN');
      expect(t(key), key).not.toEqual(key);
      setLanguage('en');
      expect(t(key), key).not.toEqual(key);
    }
  });
});
