import {it,expect,afterEach,vi} from 'vitest';
import {Compendium} from '../src/ui/Compendium';
import {MetaScreens} from '../src/ui/MetaScreens';
import {ProfileScreens} from '../src/ui/ProfileScreens';
import {createProfile,createLotteryPrizes,spinLottery} from '../src/core/MetaProgression';
import {WEAPONS} from '../src/config/weapons';
import {setLanguage,t} from '../src/i18n/i18n';
import {p5Zh,p5En} from '../src/i18n/p5';
afterEach(()=>{vi.unstubAllGlobals();setLanguage('zh-CN');});
it('charges the P9 120-coin gacha price atomically and retains ticket-first auto payment',()=>{
 const p={...createProfile(),coins:120},prizes=createLotteryPrizes(p,()=>0);
 const paid=spinLottery(p,prizes,()=>0);expect(paid.ok).toBe(true);expect(paid.profile.coins).toBe(0);expect(p.coins).toBe(120);
 expect(spinLottery({...p,coins:119},prizes,()=>0).ok).toBe(false);
 const free=spinLottery({...p,freeLotteryTickets:1},prizes,()=>0);expect(free.profile.coins).toBe(120);expect(free.profile.freeLotteryTickets).toBe(0);
});
it.each(['zh-CN','en'] as const)('provides a fixed header, tabs and inner body in every ledger page (%s)',lang=>{
 setLanguage(lang);const p=createProfile(),meta=new MetaScreens(()=>p,()=>{},()=>{},()=>{}),profile=new ProfileScreens(()=>p,()=>true,()=>{},()=>{});
 const pages=[new Compendium().markup(p),meta.markup('armory'),meta.markup('market'),...(['profile','leaderboard','settings'] as const).map(s=>profile.markup(s))];
 for(const html of pages){expect(html).toContain('ledger-shell');expect(html).toContain('ledger-header');expect(html).toContain('ledger-tabs');expect(html).toContain('ledger-body');expect(html).toContain('id="dialog-title"');expect(html).not.toMatch(/>p5\.[\w.]+</);}
});
it('rounds attack growth, rate and range, and labels the matrix corner and collection progress',()=>{
 const p=createProfile(),book=new Compendium(),html=book.markup(p);
 for(const damage of [50,80,128,205,328])expect(html).toContain(`<td>${damage}</td>`);
 expect(html).not.toMatch(/204\.8|327\.68/);expect(html).toContain('matrix-corner');expect(html).toContain('0/12');expect(html).toContain('0/36');
 book.openTo('panda');expect(book.markup(p)).toContain('0.67');
});
it('has exactly four matching accessible hero equip chips and toggles equip atomically',()=>{
 let p={...createProfile(),unlockedWeapons:['m10_bamboo_staff']};
 const data=new Map();vi.stubGlobal('window',{localStorage:{getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v)}});
 const meta=new MetaScreens(()=>p,next=>{p=next;},()=>{},()=>{});
 let html=meta.markup('armory');expect(html).not.toContain('data-action="meta-equip:');meta.action('meta-weapon:m10_bamboo_staff');html=meta.markup('armory');expect(html.match(/data-action="meta-equip:m10_bamboo_staff:/g)).toHaveLength(4);expect(html).not.toContain('<select');expect(html).toContain('aria-label="穿戴 功夫阿宝"');
 meta.action('meta-equip:m10_bamboo_staff:kungfu_po');expect(p.equippedWeapons.kungfu_po).toBe('m10_bamboo_staff');
 html=meta.markup('armory');expect(html).toContain('storybook-hero-button equipped');meta.action('meta-equip:m10_bamboo_staff:kungfu_po');expect(p.equippedWeapons.kungfu_po).toBeUndefined();
 meta.action('meta-family:recycle');html=meta.markup('armory');expect(html.match(/data-rarity=/g)).toHaveLength(5);expect(html).not.toContain('data-loadout-hero=');
});
it('separates market tabs and retains all settings semantics and profile links',()=>{
 const p=createProfile(),meta=new MetaScreens(()=>p,()=>{},()=>{},()=>{}),profile=new ProfileScreens(()=>p,()=>true,()=>{},()=>{});
 for(const tab of ['shop','lottery'] as const){meta.tab=tab;const html=meta.markup('market');expect(html).not.toContain('market-split');expect(html).not.toContain('class="prop-slot ');expect(html).not.toContain('prop-row');}
 meta.tab='backpack';expect(meta.markup('market').match(/class="prop-slot /g)).toHaveLength(8);
 for(const page of ['profile','leaderboard','settings'] as const){const html=profile.markup(page);for(const action of ['profile','leaderboard','settings'])expect(html).toContain(`data-action="${action}"`);}
 const settings=profile.markup('settings');expect(settings.match(/type="range"/g)).toHaveLength(2);expect(settings.match(/type="checkbox"/g)).toHaveLength(2);expect(settings).toContain('tutorial-replay');
 const rank=profile.markup('leaderboard');expect(rank).not.toContain('rank-podium');expect(rank).not.toContain('threat-banner');expect(rank).toContain('my-rank-summary-card');expect(rank.match(/data-player=/g)).toHaveLength(16);
});
it('has complete P5 bilingual keys and retains all 36 weapons',()=>{
 expect(Object.keys(p5Zh).sort()).toEqual(Object.keys(p5En).sort());
 for(const lang of ['zh-CN','en'] as const){setLanguage(lang);for(const key of Object.keys(p5Zh))expect(t(key)).not.toBe(key);}
 expect(Object.keys(WEAPONS)).toHaveLength(36);
});
