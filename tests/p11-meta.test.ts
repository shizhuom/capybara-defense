import {afterEach,describe,expect,it,vi} from 'vitest';
import {createProfile} from '../src/core/MetaProgression';
import type {Profile} from '../src/core/types';
import {MetaScreens,propSlots} from '../src/ui/MetaScreens';
import {loadProfile,STORAGE_PREFIX} from '../src/ui/storage';
import {setLanguage,t} from '../src/i18n/i18n';
import {p11MetaEn,p11MetaZh} from '../src/i18n/p11-meta';

afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();setLanguage('zh-CN');});

function host(patch:Partial<Profile>={}) {
  let profile:Profile={...createProfile(),coins:500,freeLotteryTickets:1,...patch};
  const saved=new Map<string,string>();
  const storage={getItem:(key:string)=>saved.get(key)??null,setItem:vi.fn((key:string,value:string)=>{saved.set(key,value);})};
  vi.stubGlobal('window',{localStorage:storage});
  const notify=vi.fn(),render=vi.fn(),sound=vi.fn();
  const meta=new MetaScreens(()=>profile,next=>{profile=next;},render,notify,sound);
  return {meta,storage,notify,render,sound,profile:()=>profile};
}

function weaponIds(html:string):string[] {
  return [...html.matchAll(/<article[^>]*data-weapon-id="([^"]+)"/g)].map(match=>match[1]);
}

describe('P11 armory navigation',()=>{
  it('keeps the full catalog in one list and puts five filters in the only tab bar',()=>{
    const h=host({weaponFragments:{m10_bamboo_staff:2}}),html=h.meta.markup('armory');
    expect(html.match(/class="storybook-row-card weapon-row /g)).toHaveLength(36);
    expect(html.match(/class="ledger-tabs /g)).toHaveLength(1);
    expect(html.match(/data-action="meta-family:/g)).toHaveLength(5);
    expect(html).toMatch(/data-action="meta-family:all"[^>]*aria-selected="true"[^>]*aria-pressed="true"/);
    expect(html).toContain('class="slim-progress"');
    expect(html).toContain('2/16');
    expect(html).not.toMatch(/meta-equip:|<select|<details|p9-armory-toolbar|p9-anvil/);
  });

  it('orders unlocked weapons before locked weapons and uses descending rarity within ownership',()=>{
    const h=host({unlockedWeapons:['m01_swatter','m10_bamboo_staff','w07_cat_scratch_meteor']});
    expect(weaponIds(h.meta.markup('armory')).slice(0,4)).toEqual(['m10_bamboo_staff','w07_cat_scratch_meteor','m01_swatter','m09_cat_blade']);
  });

  it('opens one weapon, durably equips and unequips a matching hero, and returns to the same list',()=>{
    const h=host({unlockedWeapons:['m10_bamboo_staff'],weaponFragments:{m10_bamboo_staff:5}});
    const listKey=h.meta.viewKey;
    h.meta.action('meta-weapon:m10_bamboo_staff');
    const detail=h.meta.markup('armory');
    expect(h.meta.viewKey).not.toBe(listKey);
    expect(detail).toContain('class="storybook-detail-sheet');
    expect(detail).toMatch(/class="storybook-detail-sheet[^>]*data-weapon-id="m10_bamboo_staff"/);
    expect(detail).toContain('data-action="meta-weapon-back"');
    expect(detail).toContain(t('weapon.m10_bamboo_staff.desc'));
    expect(detail.match(/data-action="meta-equip:m10_bamboo_staff:/g)).toHaveLength(4);
    expect(detail).not.toContain('weapon-row');
    h.meta.action('meta-equip:m10_bamboo_staff:kungfu_po');
    expect(h.profile().equippedWeapons).toEqual({kungfu_po:'m10_bamboo_staff'});
    expect(loadProfile().equippedWeapons).toEqual({kungfu_po:'m10_bamboo_staff'});
    expect(h.sound).toHaveBeenCalledExactlyOnceWith('hit_heavy');
    expect(h.meta.markup('armory')).toContain('data-sticker="ui_storybook_check"');
    h.meta.action('meta-equip:m10_bamboo_staff:kungfu_po');
    expect(loadProfile().equippedWeapons).toEqual({});
    h.meta.action('meta-weapon-back');
    expect(h.meta.viewKey).toBe(listKey);
    expect(weaponIds(h.meta.markup('armory'))).toHaveLength(36);
  });

  it('steps within the chosen family and resets detail even when reselecting the current tab',()=>{
    const h=host();
    h.meta.action('meta-family:melee');
    const ids=weaponIds(h.meta.markup('armory'));
    expect(ids).toHaveLength(12);
    h.meta.action(`meta-weapon:${ids[0]}`);
    h.meta.action('meta-weapon-prev');
    expect(h.meta.markup('armory')).toContain(`data-detail-weapon-id="${ids[11]}"`);
    h.meta.action('meta-weapon-next');
    expect(h.meta.markup('armory')).toContain(`data-detail-weapon-id="${ids[0]}"`);
    h.meta.action('meta-family:melee');
    expect(weaponIds(h.meta.markup('armory'))).toEqual(ids);
    h.meta.action('meta-family:magic');
    expect(weaponIds(h.meta.markup('armory'))).toHaveLength(12);
    expect(weaponIds(h.meta.markup('armory')).every(id=>id.startsWith('w'))).toBe(true);
  });

  it('shows four disabled matching heroes for a locked weapon and rejects a direct equip attempt',()=>{
    const h=host();h.meta.action('meta-weapon:m10_bamboo_staff');
    const buttons=h.meta.markup('armory').match(/<button[^>]*data-action="meta-equip:[^>]*>/g)??[];
    expect(buttons).toHaveLength(4);
    expect(buttons.every(button=>button.includes(' disabled'))).toBe(true);
    h.meta.action('meta-equip:m10_bamboo_staff:kungfu_po');
    expect(h.profile().equippedWeapons).toEqual({});
    expect(h.storage.setItem).not.toHaveBeenCalled();
    expect(h.sound).not.toHaveBeenCalled();
    expect(h.notify).toHaveBeenCalledWith('meta.weaponLocked',true,{amount:0});
  });

  it('keeps malformed tabs and inherited object IDs from changing the visible selection',()=>{
    const h=host();h.meta.action('meta-family:ranged');
    const key=h.meta.viewKey;
    for(const action of ['meta-tab:nope','meta-family:nope','meta-weapon:missing','meta-weapon:__proto__','meta-weapon:toString','meta-weapon-prev','meta-weapon-next']) h.meta.action(action);
    expect(h.meta.viewKey).toBe(key);
    expect(h.meta.tab).toBe('shop');
    expect(weaponIds(h.meta.markup('armory'))).toHaveLength(12);
    expect(h.storage.setItem).not.toHaveBeenCalled();
  });

  it('isolates recycling in its own tab and recycles only the chosen unlocked surplus',()=>{
    const h=host({unlockedWeapons:['m01_swatter','m10_bamboo_staff'],weaponFragments:{m01_swatter:4,m10_bamboo_staff:18}});
    h.meta.action('meta-weapon:m10_bamboo_staff');h.meta.action('meta-family:recycle');
    const html=h.meta.markup('armory');
    expect(html.match(/type="checkbox" data-rarity=/g)).toHaveLength(5);
    expect(html).toContain('data-action="meta-recycle"');
    expect(html).not.toMatch(/meta-equip:|meta-weapon:|<details/);
    h.meta.change({dataset:{rarity:'4'},checked:false} as unknown as HTMLInputElement);
    h.meta.action('meta-recycle');
    expect(loadProfile()).toMatchObject({coins:516,weaponFragments:{m01_swatter:2,m10_bamboo_staff:18}});
  });
});

describe('P11 dedicated market tabs',()=>{
  it('renders only three daily deals in the shop and a single three-tab navigation',()=>{
    vi.spyOn(Math,'random').mockReturnValue(0);const h=host();h.meta.open('market');
    const html=h.meta.markup('market');
    expect(html.match(/class="storybook-row-card shop-row /g)).toHaveLength(3);
    expect(html.match(/data-action="meta-buy:/g)).toHaveLength(3);
    expect(html.match(/data-action="meta-tab:/g)).toHaveLength(3);
    expect(html.match(/class="ledger-tabs /g)).toHaveLength(1);
    expect(html).toContain('data-action="meta-refresh"');
    expect(html).toContain(t('prop.washer.desc'));
    expect(html).not.toMatch(/class="prop-slot |class="lottery-cell |prop-row|market-split|market-subtabs| hidden/);
  });

  it('shows eight clickable loadout slots and twenty rows ordered equipped, owned, then unowned',()=>{
    const h=host({ownedProps:{washer:1,clay:1,auto_shovel:1},equippedPassiveProps:['auto_shovel']});
    const shopKey=h.meta.viewKey;h.meta.action('meta-tab:backpack');
    const html=h.meta.markup('market');
    expect(h.meta.viewKey).not.toBe(shopKey);
    expect(html).toContain('storybook-loadout-strip');
    expect(html.match(/class="prop-slot /g)).toHaveLength(8);
    expect(html.match(/class="storybook-row-card prop-row /g)).toHaveLength(20);
    expect([...html.matchAll(/<article[^>]*data-prop-id="([^"]+)"/g)].map(match=>match[1]).slice(0,4)).toEqual(['auto_shovel','washer','clay','milk_bottle']);
    expect(html).not.toMatch(/meta-buy:|meta-refresh|class="lottery-cell | hidden/);
    h.meta.action('meta-prop:washer');
    expect(loadProfile().equippedActiveProps).toEqual(['washer']);
    h.meta.action('meta-prop:auto_shovel');
    expect(loadProfile().equippedPassiveProps).toEqual([]);
    const quick=propSlots(h.profile(),true);
    expect(quick.match(/<select data-prop-slot=/g)).toHaveLength(8);
    expect(quick).toContain('value="washer" selected');
  });

  it('keeps the lottery prize in its own card while tabs change during a once-persisted spin',()=>{
    vi.useFakeTimers();vi.spyOn(Math,'random').mockReturnValue(0);
    const h=host();h.meta.open('market');h.meta.action('meta-tab:lottery');
    const lottery=h.meta.markup('market');
    expect(lottery.match(/class="lottery-cell /g)).toHaveLength(8);
    expect(lottery).toContain('ui_gacha_machine');
    expect(lottery).toContain('meta-spin:ticket');expect(lottery).toContain('meta-spin:coins');
    expect(lottery).not.toMatch(/meta-buy:|class="prop-slot |shop-row|prop-row| hidden/);
    h.storage.setItem.mockClear();
    h.meta.action('meta-spin:coins');
    expect(h.storage.setItem).toHaveBeenCalledTimes(1);
    expect(loadProfile()).toMatchObject({coins:300,freeLotteryTickets:1,ownedProps:{washer:1}});
    h.meta.action('meta-tab:backpack');h.meta.action('meta-spin:ticket');
    expect(h.storage.setItem).toHaveBeenCalledTimes(1);
    vi.runAllTimers();
    expect(h.meta.markup('market')).not.toContain('lottery-result');
    h.meta.action('meta-tab:lottery');
    expect(h.meta.markup('market')).toMatch(/class="storybook-lottery-card[\s\S]*class="lottery-result"/);
    expect(h.sound).toHaveBeenCalledWith('lottery_win');
    h.meta.reset();
  });

  it('preserves committed lottery rewards when closing during the animation',()=>{
    vi.useFakeTimers();vi.spyOn(Math,'random').mockReturnValue(0);
    const h=host();h.meta.open('market');h.meta.action('meta-tab:lottery');h.meta.action('meta-spin:ticket');h.meta.reset();
    expect(vi.getTimerCount()).toBe(0);
    expect(loadProfile()).toMatchObject({coins:500,freeLotteryTickets:0,ownedProps:{washer:1}});
  });

  it('leaves purchases, equipment, recycling and spins unchanged when storage refuses a write',()=>{
    vi.useFakeTimers();vi.spyOn(Math,'random').mockReturnValue(0);
    const h=host({ownedProps:{clay:1},unlockedWeapons:['m10_bamboo_staff'],weaponFragments:{m10_bamboo_staff:7}});
    h.meta.open('market');const before=structuredClone(h.profile()),saved=h.storage.getItem(`${STORAGE_PREFIX}profile`);
    h.storage.setItem.mockImplementation(()=>{throw new Error('quota');});
    for(const action of ['meta-buy:washer','meta-prop:clay','meta-equip:m10_bamboo_staff:kungfu_po','meta-recycle','meta-spin:coins']) h.meta.action(action);
    expect(h.profile()).toEqual(before);
    expect(h.storage.getItem(`${STORAGE_PREFIX}profile`)).toBe(saved);
    expect(h.sound).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(h.notify).toHaveBeenCalledWith('hint.storage',true);
  });

  it('rejects unavailable slots and purchases without replacing a valid loadout',()=>{
    const h=host({coins:0,ownedProps:{washer:1,clay:1,milk_bottle:1},equippedActiveProps:['washer','clay'],shop:{day:'2026-11-15',offers:['whistle','catnip','glue_trap']}});
    h.meta.action('meta-prop:milk_bottle');
    expect(h.profile().equippedActiveProps).toEqual(['washer','clay']);
    expect(h.notify).toHaveBeenCalledWith('meta.slotsFull',true,{amount:0});
    h.meta.action('meta-buy:whistle');
    expect(h.profile().ownedProps.whistle).toBeUndefined();
    expect(h.notify).toHaveBeenCalledWith('meta.insufficientCoins',true,{amount:0});
    expect(h.storage.setItem).not.toHaveBeenCalled();
  });

  it('purchases and upgrades from the visible shelf while retaining unchanged offers',()=>{
    const h=host({coins:1000,shop:{day:'2026-11-15',offers:['washer','promo_badge','clay']}});
    h.meta.action('meta-buy:washer');
    expect(loadProfile()).toMatchObject({coins:780,ownedProps:{washer:1},shop:{offers:['milk_bottle','promo_badge','clay']}});
    h.meta.action('meta-buy:promo_badge');
    expect(loadProfile()).toMatchObject({coins:530,ownedProps:{promo_badge:1},shop:{offers:['milk_bottle','promo_badge','clay']}});
    expect(h.meta.markup('market')).toContain(t('p11.meta.upgradeShort'));
  });
});

it.each(['zh-CN','en'] as const)('translates every meta view with one active tab and no counted tab labels (%s)',language=>{
  setLanguage(language);
  const h=host({unlockedWeapons:['m10_bamboo_staff']});h.meta.open('market');
  const views:string[]=[];
  for(const family of ['all','melee','ranged','magic','recycle']) {
    h.meta.action(`meta-family:${family}`);views.push(h.meta.markup('armory'));
  }
  h.meta.action('meta-weapon:m10_bamboo_staff');views.push(h.meta.markup('armory'));
  for(const tab of ['shop','backpack','lottery']) {
    h.meta.action(`meta-tab:${tab}`);views.push(h.meta.markup('market'));
  }
  for(const html of views) {
    expect(html.match(/p11\.meta\.[a-zA-Z.]+/g)??[]).toEqual([]);
    const navigation=html.match(/<nav class="ledger-tabs[\s\S]*?<\/nav>/)?.[0]??'';
    expect(navigation.match(/aria-selected="true"/g)).toHaveLength(1);
    const labels=[...navigation.matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map(match=>match[1]);
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.every(label=>!/[0-9]/.test(label))).toBe(true);
  }
  expect(Object.keys(p11MetaEn).sort()).toEqual(Object.keys(p11MetaZh).sort());
  for(const key of Object.keys(p11MetaZh)) expect(t(key)).not.toBe(key);
  h.meta.reset();
});
