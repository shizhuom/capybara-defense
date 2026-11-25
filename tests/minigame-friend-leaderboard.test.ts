import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createProfile } from '../src/core/MetaProgression';
import { FRIEND_CLOUD_KEYS, buildFriendCloudPayload } from '../src/minigame/friendCloud';
import { createMiniGameAdapter, type MiniGameGlobalApi } from '../src/platform/minigameAdapter';
import type { SpriteImage } from '../src/render/AssetRegistry';

describe('Official Free WeChat Friend Leaderboard (wx.setUserCloudStorage + Open Data Context)', () => {
  it('builds valid wxgame KVDataList entries for rank stars & endless wave and omits rank when dev-tainted', () => {
    const fresh = createProfile();
    expect(buildFriendCloudPayload(fresh, 'zh-CN', 1700000000)).toEqual([]);

    const active = {
      ...fresh,
      matches: 18,
      wins: 15,
      stars: 26,
      highestStars: 26,
      bestEndlessWave: 24,
      bestEndlessTime: 842,
      bestEndlessMvp: 'kungfu_po',
      endlessMedallions: { med_breakthrough_atk: 6, med_luck_rate: 4 },
    };
    const entries = buildFriendCloudPayload(active, 'zh-CN', 1700000000);
    expect(entries.map(e => e.key)).toEqual([FRIEND_CLOUD_KEYS.rank, FRIEND_CLOUD_KEYS.endless]);

    const rankVal = JSON.parse(entries[0].value);
    expect(rankVal).toMatchObject({
      wxgame: { score: 26, update_time: 1700000000 },
      stars: 26,
      wins: 15,
      matches: 18,
    });
    const endlessVal = JSON.parse(entries[1].value);
    expect(endlessVal).toMatchObject({
      wxgame: { score: 24, update_time: 1700000000 },
      bestWave: 24,
      elapsed: 842,
      medallionTotal: 10,
    });

    // Dev-tainted rank must not upload fake rank stars, while legitimate endless record can still sync
    const tainted = { ...active, rankTainted: true };
    const taintedEntries = buildFriendCloudPayload(tainted, 'zh-CN', 1700000000);
    expect(taintedEntries.map(e => e.key)).toEqual([FRIEND_CLOUD_KEYS.endless]);
  });

  it('wires wx.setUserCloudStorage and wx.getOpenDataContext cleanly in minigameAdapter', () => {
    const store = new Map<string, string>();
    const uploaded: Array<Array<{ key: string; value: string }>> = [];
    const posted: Array<Record<string, unknown>> = [];
    const sharedCanvas = { width: 1710, height: 540 } as HTMLCanvasElement;
    const mockCtx = new Proxy({
      measureText: (s: string) => ({ width: s.length * 10 }),
      createLinearGradient: () => ({ addColorStop: () => {} }),
      createRadialGradient: () => ({ addColorStop: () => {} }),
    } as Record<string, unknown>, {
      get(target, prop: string) { return prop in target ? target[prop] : () => {}; },
    });
    const mockCanvas = { width: 0, height: 0, getContext: () => mockCtx } as unknown as HTMLCanvasElement;

    const api: MiniGameGlobalApi = {
      createCanvas: () => mockCanvas,
      createImage: () => ({ width: 0, height: 0, src: '', onload: null, onerror: null }) as unknown as SpriteImage,
      getSystemInfoSync: () => ({ windowWidth: 852, windowHeight: 393, pixelRatio: 2 }),
      getStorageSync: k => store.get(k) ?? '',
      setStorageSync: (k, v) => { store.set(k, v); },
      removeStorageSync: k => { store.delete(k); },
      request: () => {},
      onTouchStart: () => {},
      onTouchMove: () => {},
      onTouchEnd: () => {},
      onTouchCancel: () => {},
      setUserCloudStorage: opts => { uploaded.push(opts.KVDataList); },
      getOpenDataContext: () => ({ canvas: sharedCanvas, postMessage: msg => { posted.push(msg); } }),
    };

    const wxAdapter = createMiniGameAdapter(api, 'wx');
    wxAdapter.setFriendCloudStorage?.([{ key: FRIEND_CLOUD_KEYS.rank, value: '{"stars":12}' }]);
    expect(uploaded).toHaveLength(1);
    expect(uploaded[0][0].key).toBe(FRIEND_CLOUD_KEYS.rank);
    expect(wxAdapter.getFriendLeaderboardCanvas?.()).toBe(sharedCanvas);
    wxAdapter.postFriendLeaderboardMessage?.({ type: 'render', board: 'rank' });
    expect(posted).toEqual([{ type: 'render', board: 'rank' }]);

    // Bilibili adapter must NOT touch WeChat openDataContext APIs
    const blAdapter = createMiniGameAdapter(api, 'bl');
    expect(blAdapter.getFriendLeaderboardCanvas?.()).toBeNull();
  });

  it('executes openDataContext/index.js cleanly with pure ES5 syntax, sorting rank & endless friends and handling scroll/clear', () => {
    const code = readFileSync('src/minigame/openDataContext/index.js', 'utf8');
    // Verify strict ES5/ES2015 compatibility (zero optional chaining, zero nullish coalescing)
    expect(code).not.toMatch(/\?\.[a-zA-Z_$(\[]/);
    expect(code).not.toMatch(/\?\?/);

    const drawnTexts: string[] = [];
    const mockCtx = new Proxy({
      fillText: (txt: string) => { drawnTexts.push(String(txt)); },
      createLinearGradient: () => ({ addColorStop: () => {} }),
      measureText: (s: string) => ({ width: s.length * 10 }),
    } as Record<string, unknown>, {
      get(target, prop: string) { return prop in target ? target[prop] : () => {}; },
    });
    const sharedCanvas = { width: 1710, height: 540, getContext: () => mockCtx };
    let onMsg: ((msg: Record<string, unknown>) => void) | null = null;
    const fakeWx = {
      getSharedCanvas: () => sharedCanvas,
      onMessage: (cb: (msg: Record<string, unknown>) => void) => { onMsg = cb; },
      createImage: () => ({ onload: null, onerror: null, src: '' }),
      getUserInfo: (opts: { success?: (res: unknown) => void }) => {
        opts.success?.({ data: [{ openId: 'me_openid', nickName: '卡皮巴拉本人', avatarUrl: '' }] });
      },
      getFriendCloudStorage: (opts: { keyList: string[]; success?: (res: unknown) => void }) => {
        expect(opts.keyList).toEqual([FRIEND_CLOUD_KEYS.rank, FRIEND_CLOUD_KEYS.endless]);
        opts.success?.({
          data: [
            {
              openid: 'friend_a',
              nickname: '泡汤大佬',
              avatarUrl: '',
              KVDataList: [
                { key: FRIEND_CLOUD_KEYS.rank, value: JSON.stringify({ wxgame: { score: 62 }, stars: 62, rankName: '训宠宗师 II', wins: 40 }) },
                { key: FRIEND_CLOUD_KEYS.endless, value: JSON.stringify({ wxgame: { score: 38 }, bestWave: 38, elapsed: 1120, medallionTotal: 42 }) },
              ],
            },
            {
              openid: 'me_openid',
              nickname: '卡皮巴拉本人',
              avatarUrl: '',
              KVDataList: [
                { key: FRIEND_CLOUD_KEYS.rank, value: JSON.stringify({ wxgame: { score: 36 }, stars: 36, rankName: '温泉馆主 IV', wins: 25 }) },
                { key: FRIEND_CLOUD_KEYS.endless, value: JSON.stringify({ wxgame: { score: 25 }, bestWave: 25, elapsed: 760, medallionTotal: 15 }) },
              ],
            },
            {
              openid: 'friend_b',
              nickname: '萌新小熊',
              avatarUrl: '',
              KVDataList: [
                { key: FRIEND_CLOUD_KEYS.rank, value: JSON.stringify({ wxgame: { score: 12 }, stars: 12, rankName: '溜狗达人 II', wins: 9 }) },
              ],
            },
          ],
        });
      },
    };

    const runOdc = new Function('wx', code);
    runOdc(fakeWx);
    expect(onMsg).toBeTruthy();

    // Render Rank board -> sorted descending: 泡汤大佬 (62) -> 卡皮巴拉本人 (我) (36) -> 萌新小熊 (12)
    drawnTexts.length = 0;
    onMsg!({ type: 'render', board: 'rank', lang: 'zh-CN', force: true });
    expect(drawnTexts).toContain('泡汤大佬');
    expect(drawnTexts).toContain('卡皮巴拉本人 (我)');
    expect(drawnTexts).toContain('★ 62');
    expect(drawnTexts).toContain('★ 36');
    expect(drawnTexts.indexOf('泡汤大佬')).toBeLessThan(drawnTexts.indexOf('卡皮巴拉本人 (我)'));

    // Render Endless board -> sorted descending: 泡汤大佬 (W38) -> 卡皮巴拉本人 (我) (W25); 萌新小熊 excluded (< W11)
    drawnTexts.length = 0;
    onMsg!({ type: 'render', board: 'endless', lang: 'zh-CN', force: true });
    expect(drawnTexts).toContain('W38');
    expect(drawnTexts).toContain('W25');
    expect(drawnTexts).not.toContain('萌新小熊');

    // Scroll & Clear work without throwing
    expect(() => onMsg!({ type: 'scrollDelta', dy: 80 })).not.toThrow();
    expect(() => onMsg!({ type: 'clear' })).not.toThrow();
    expect(vi.isFakeTimers()).toBe(false);
  });
});
