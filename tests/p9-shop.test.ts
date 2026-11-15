import {afterEach,expect,it,vi} from 'vitest';
import {createLotteryPrizes,createProfile,spinLottery} from '../src/core/MetaProgression';
import {META_PRICES,PROPS} from '../src/config/props';
import {MetaScreens,propSlots} from '../src/ui/MetaScreens';
import {setLanguage,t} from '../src/i18n/i18n';

afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();setLanguage('zh-CN');});
function host(coins=500,tickets=1){
 let profile={...createProfile(),coins,freeLotteryTickets:tickets};
 const writes=vi.fn(),notify=vi.fn(),render=vi.fn();
 vi.stubGlobal('window',{localStorage:{getItem:()=>null,setItem:writes}});
 const meta=new MetaScreens(()=>profile,next=>{profile=next;},render,notify);
 return {meta,writes,notify,render,profile:()=>profile};
}
it('charges exactly 120 coins while explicitly preserving tickets',()=>{
 const p={...createProfile(),coins:120,freeLotteryTickets:2},prizes=createLotteryPrizes(p,()=>0);
 const result=spinLottery(p,prizes,()=>0,'coins');
 expect(META_PRICES.lottery).toBe(120);expect(result).toMatchObject({ok:true,profile:{coins:0,freeLotteryTickets:2,ownedProps:{washer:1}}});
 expect(p.coins).toBe(120);expect(p.ownedProps).toEqual({});
 expect(spinLottery({...p,coins:119},prizes,()=>0,'coins')).toMatchObject({ok:false,profile:{coins:119,freeLotteryTickets:2}});
});
it('never charges coins for an unavailable ticket and preserves legacy ticket-first auto draws',()=>{
 const p={...createProfile(),coins:500},prizes=createLotteryPrizes(p,()=>0);
 expect(spinLottery(p,prizes,()=>0,'ticket')).toMatchObject({ok:false,key:'p9.noTickets',profile:p});
 expect(spinLottery({...p,freeLotteryTickets:1},prizes,()=>0)).toMatchObject({ok:true,profile:{coins:500,freeLotteryTickets:0}});
});
it('persists a selected payment and reward once before animation and blocks repeated clicks',()=>{
 vi.useFakeTimers();vi.spyOn(Math,'random').mockReturnValue(0);const h=host();h.meta.open('market');h.writes.mockClear();
 h.meta.action('meta-spin:coins');expect(h.writes).toHaveBeenCalledTimes(1);expect(h.profile().coins).toBe(380);expect(h.profile().freeLotteryTickets).toBe(1);expect(h.profile().ownedProps.washer).toBe(1);
 h.meta.action('meta-spin:ticket');expect(h.writes).toHaveBeenCalledTimes(1);vi.runAllTimers();expect(h.meta.markup('market')).toContain('lottery-result');h.meta.reset();vi.restoreAllMocks();
});
it('does not animate or mutate when ticket payment or durable storage fails',()=>{
 vi.useFakeTimers();const h=host(500,0);h.meta.open('market');h.writes.mockClear();h.meta.action('meta-spin:ticket');expect(h.profile().coins).toBe(500);expect(h.writes).not.toHaveBeenCalled();expect(h.notify).toHaveBeenCalledWith('p9.noTickets',true);
 h.writes.mockImplementation(()=>{throw Error('full');});h.meta.action('meta-spin:coins');expect(h.profile().coins).toBe(500);expect(vi.getTimerCount()).toBe(0);h.meta.reset();
});
it.each(['zh-CN','en'] as const)('renders clean armory packets and one full portrait showcase (%s)',lang=>{
 setLanguage(lang);const p={...createProfile(),unlockedWeapons:['m10_bamboo_staff']},meta=new MetaScreens(()=>p,()=>{},()=>{},()=>{});
 const html=meta.markup('armory');expect(html).not.toContain('<select');expect(html.match(/data-action="meta-weapon:/g)).toHaveLength(36);
 for(const packet of html.match(/<button[^>]*data-action="meta-weapon:[\s\S]*?<\/button>/g)??[])expect(packet).not.toMatch(/<p(?:\s|>)/);
 expect(html.match(/data-action="meta-equip:m10_bamboo_staff:/g)).toHaveLength(4);expect(html).toContain('npc_blacksmith_capy');expect(html).toContain(t('weapon.m10_bamboo_staff.desc'));expect(html).toContain('<details class="recycle-panel"');
 meta.action('meta-family:magic');expect(meta.markup('armory').match(/data-action="meta-weapon:/g)).toHaveLength(12);
});
it('selects props without equipping and keeps all twenty clean packets and eight tray slots on both tabs',()=>{
 const h=host();h.meta.open('market');h.meta.action('meta-packet:clay');expect(h.profile().equippedActiveProps).toEqual([]);
 for(const tab of ['shop','lottery'] as const){h.meta.tab=tab;const html=h.meta.markup('market');expect(html).not.toContain('<select');expect(html.match(/data-action="meta-packet:/g)).toHaveLength(23);expect(html.match(/class="prop-slot /g)).toHaveLength(8);expect(html).toContain('npc_shop_raccoon');expect(html).toContain('ui_trunk_crate');expect(html).toContain(t('prop.clay.desc'));
  const packets=html.match(/<button[^>]*class="inventory-prop [\s\S]*?<\/button>/g)??[];expect(packets).toHaveLength(20);for(const packet of packets)expect(packet).not.toMatch(/<p(?:\s|>)/);
 }
 h.meta.tab='lottery';const html=h.meta.markup('market');expect(html).toContain('meta-spin:coins');expect(html).toContain('meta-spin:ticket');expect(html).toContain('ui_gacha_machine');expect(html.match(/class="lottery-cell /g)).toHaveLength(8);expect(Object.keys(PROPS)).toHaveLength(20);
 expect(propSlots(h.profile(),true)).toContain('<select');h.meta.reset();
});
it('cycles three wholesome merchant quips and resets packet selection',()=>{
 const h=host();expect(h.meta.markup('market')).toContain(t('p9.merchant0'));
 h.meta.action('meta-merchant');expect(h.meta.markup('market')).toContain(t('p9.merchant1'));
 h.meta.action('meta-merchant');expect(h.meta.markup('market')).toContain(t('p9.merchant2'));
 h.meta.action('meta-merchant');expect(h.meta.markup('market')).toContain(t('p9.merchant0'));
});
it('plays a metallic cue only after a successful durable equipment change',()=>{
 let p={...createProfile(),unlockedWeapons:['m10_bamboo_staff']};const sound=vi.fn(),write=vi.fn();
 vi.stubGlobal('window',{localStorage:{getItem:()=>null,setItem:write}});
 const meta=new MetaScreens(()=>p,next=>{p=next;},()=>{},()=>{},sound);
 meta.action('meta-equip:m10_bamboo_staff:kungfu_po');expect(p.equippedWeapons.kungfu_po).toBe('m10_bamboo_staff');expect(sound).toHaveBeenCalledExactlyOnceWith('hit_heavy');
 sound.mockClear();meta.action('meta-equip:m10_bamboo_staff:zen_master');expect(sound).not.toHaveBeenCalled();
 write.mockImplementation(()=>{throw Error('full');});meta.action('meta-equip:m10_bamboo_staff:kungfu_po');expect(sound).not.toHaveBeenCalled();expect(p.equippedWeapons.kungfu_po).toBe('m10_bamboo_staff');
});
