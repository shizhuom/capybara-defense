import { describe, expect, it } from 'vitest';
import type { Profile } from '../src/core/types';

describe('M2 catalogs', () => {
  it('defines exactly 36 bilingual weapons and 12 unique signature awakenings', async () => {
    const catalog = await import('../src/config/weapons').catch(() => undefined);
    expect(catalog, 'weapon catalog must exist').toBeDefined();
    if (!catalog) return;
    const weapons = Object.values(catalog.WEAPONS);
    expect(weapons).toHaveLength(36);
    expect(Object.keys(catalog.WEAPONS)).toEqual([
      'm01_swatter','m02_slipper','m03_scratcher','m04_baguette','m05_duster','m06_stool','m07_rolling_pin','m08_durian','m09_cat_blade','m10_bamboo_staff','m11_salted_fish','m12_iron_wok',
      'r01_rubber_band','r02_duck_squirt','r03_bubble_gun','r04_tennis_launcher','r05_hair_dryer','r06_pressure_washer','r07_popcorn_cannon','r08_coin_slingshot','r09_bamboo_bazooka','r10_acorn_minigun','r11_sniper_laser','r12_junk_mortar',
      'w01_teaser','w02_balloon','w03_bug_zapper','w04_yarn_orb','w05_disco_ball','w06_yarn_storm','w07_cat_scratch_meteor','w08_fortune_fish','w09_yin_yang_burner','w10_cosmic_vacuum','w11_golden_hoop_ball','w12_rain_crown_scepter',
    ]);
    expect(Object.fromEntries(weapons.filter(w=>w.signatureHero).map(w=>[w.id,w.signatureHero]))).toEqual({
      m09_cat_blade:'puss_in_hat',m10_bamboo_staff:'kungfu_po',m11_salted_fish:'samurai_doge',m12_iron_wok:'ronin_goose',
      r09_bamboo_bazooka:'bamboo_mafia',r10_acorn_minigun:'meowfia',r11_sniper_laser:'doge_wick',r12_junk_mortar:'rocket_coon',
      w09_yin_yang_burner:'zen_master',w10_cosmic_vacuum:'purrcerer',w11_golden_hoop_ball:'ballin_rooster',w12_rain_crown_scepter:'pepe_king',
    });
    expect(new Set(weapons.map(w => w.signatureHero).filter(Boolean)).size).toBe(12);
    for (const family of ['melee', 'ranged', 'magic']) {
      const group = weapons.filter(w => w.family === family);
      expect([0,1,2,3,4].map(r => group.filter(w => w.rarity === r).length)).toEqual([2,2,2,2,4]);
    }
    for (const weapon of weapons) for (const lang of ['zh-CN','en'] as const) {
      expect(weapon.name[lang].length).toBeGreaterThan(2);
      expect(weapon.description[lang]).toMatch(/\d/);
    }
    expect(catalog.HERO_FAMILIES.ballin_rooster).toBe('magic');
    expect(weapons.some(w => w.id.includes('plunger'))).toBe(false);
    expect(catalog.RARITY_RULES.map(r => r.fragments)).toEqual([2,4,6,8,16]);
    expect(catalog.RARITY_RULES.map(r => r.damageBonus)).toEqual([.12,.20,.30,.42,.58]);
    expect(catalog.RARITY_RULES.map(r => r.recycle)).toEqual([8,15,30,60,120]);
    expect(catalog.RARITY_RULES.map(r => r.weight)).toEqual([22,24,24,22,8]);
    expect(catalog.rollWeapon(() => 0)).toBe('m01_swatter');
    for (const rarity of [0,1,2,3,4]) expect(catalog.WEAPONS[catalog.rollWeapon(() => .99,[rarity])].rarity).toBe(rarity);
  });
  it('defines the exact 8 active and 12 passive props with real bilingual effects', async () => {
    const catalog = await import('../src/config/props').catch(() => undefined);
    expect(catalog, 'prop catalog must exist').toBeDefined();
    if (!catalog) return;
    const props = Object.values(catalog.PROPS);
    expect(props.filter(p => p.type === 'active')).toHaveLength(8);
    expect(props.filter(p => p.type === 'passive')).toHaveLength(12);
    expect(Object.fromEntries(props.map(p=>[p.id,[p.price,p.cooldown]]))).toEqual({
      washer:[220,28],clay:[300,35],milk_bottle:[380,50],whistle:[200,40],expired_can:[150,65],catnip:[280,55],glue_trap:[160,35],recycle_bin:[210,6],
      gold_doge:[400,0],auto_shovel:[320,0],giant_orange_cat:[450,0],vip_poster:[320,0],extra_oranges:[180,0],shared_oranges:[160,0],hyper_party:[250,0],banana_peel:[180,0],emp_jammer:[310,0],promo_badge:[250,0],tall_perch:[190,0],bee_overtime:[240,0],
    });
    expect(catalog.PROPS.promo_badge).toMatchObject({price:250,maxLevel:3});
    for (const prop of props) for (const lang of ['zh-CN','en'] as const) {
      expect(prop.name[lang].length).toBeGreaterThan(2);
      expect(prop.description[lang]).toMatch(/\d/);
    }
  });
});

// Import through a promise so the initial RED run reports missing behavior as an assertion.
const meta = () => import('../src/core/MetaProgression').catch(() => undefined);
const storageModule = () => import('../src/ui/storage');
function memoryStorage(): Storage {
  const data = new Map<string,string>();
  return {get length(){return data.size;},key:i=>[...data.keys()][i]??null,
    getItem:k=>data.get(k)??null,setItem:(k,v)=>{data.set(k,v);},removeItem:k=>{data.delete(k);},clear:()=>data.clear()};
}
async function progression() {
  const m = await meta();
  expect(m, 'pure progression module must exist').toBeDefined();
  if (!m) throw new Error('missing progression');
  return m;
}
describe('M2 pure progression', () => {
  it('migrates valid legacy counters and placeholder fragments exactly once without discarding history', async () => {
    const m=await progression();
    const old={coins:378,wins:4,matches:7,fragments:['bamboo_blade','orange_wand'],awardedBattles:['old']};
    const migrated=m.normalizeProfile(old);
    expect(migrated).toMatchObject({...old,schemaVersion:2,weaponFragments:{m01_swatter:2},unlockedWeapons:['m01_swatter'],freeLotteryTickets:0});
    expect(m.normalizeProfile(JSON.parse(JSON.stringify(migrated)))).toEqual(migrated);
    expect(old).not.toHaveProperty('weaponFragments');
  });
  it('normalizes corrupt counters, invalid equipment, duplicates and level or slot overflow', async () => {
    const m=await progression();
    const p=m.normalizeProfile({schemaVersion:2,coins:-1,wins:100,matches:2,weaponFragments:{m01_swatter:2,m09_cat_blade:16,fake:40},
      equippedWeapons:{kungfu_po:'m01_swatter',puss_in_hat:'m01_swatter',zen_master:'m09_cat_blade',fake:'m09_cat_blade'},
      ownedProps:{washer:9,clay:1,milk_bottle:1,promo_badge:99,fake:1},equippedActiveProps:['washer','washer','clay','milk_bottle'],equippedPassiveProps:['promo_badge','washer']});
    expect(p).toMatchObject({coins:0,wins:2,matches:2,weaponFragments:{m01_swatter:2,m09_cat_blade:16},ownedProps:{washer:1,clay:1,milk_bottle:1,promo_badge:3},equippedActiveProps:['washer','clay'],equippedPassiveProps:['promo_badge']});
    expect(Object.keys(p.equippedWeapons)).toHaveLength(1);
    expect(m.normalizeProfile(null)).toEqual(m.createProfile());
  });
  it('unlocks at the exact threshold and recycles only overflow without mutating the input', async () => {
    const m=await progression(); let p=m.createProfile();
    const before=JSON.stringify(p);
    const first=m.grantWeaponFragments(p,['m09_cat_blade','m09_cat_blade','fake']);
    expect(first.profile.weaponFragments.m09_cat_blade).toBe(2); expect(first.newWeapons).toEqual([]);
    expect(JSON.stringify(p)).toBe(before);
    p=m.grantWeaponFragments(first.profile,Array(15).fill('m09_cat_blade')).profile;
    expect(p.unlockedWeapons).toEqual(['m09_cat_blade']);
    const recycled=m.recycleFragments(p,[4]);
    expect(recycled).toMatchObject({ok:true,amount:120,profile:{coins:120,weaponFragments:{m09_cat_blade:16}}});
    expect(m.recycleFragments(recycled.profile,[4]).ok).toBe(false);
    expect(m.grantWeaponFragments(p,['m09_cat_blade']).newWeapons).toEqual([]);
  });
  it('retains every rarity threshold and converts all surplus at the specified per-fragment rates',async()=>{
    const m=await progression();const {RARITY_RULES}=await import('../src/config/weapons');
    const ids=['m01_swatter','m03_scratcher','m05_duster','m07_rolling_pin','m09_cat_blade'];
    let p=m.createProfile();
    for(const [rarity,id] of ids.entries()) {
      const below=m.grantWeaponFragments(p,Array(RARITY_RULES[rarity].fragments-1).fill(id));
      expect(below.newWeapons).toEqual([]);expect(below.profile.unlockedWeapons).not.toContain(id);
      const above=m.grantWeaponFragments(below.profile,[id,id,id]);
      expect(above.newWeapons).toEqual([id]);p=above.profile;
    }
    const r=m.recycleFragments(p,[0,1,2,3,4]);expect(r.amount).toBe(2*(8+15+30+60+120));
    for(const [rarity,id] of ids.entries()) expect(r.profile.weaponFragments[id]).toBe(RARITY_RULES[rarity].fragments);
    expect(r.profile.unlockedWeapons).toEqual(ids);
  });
  it('validates all 36 family restrictions, locked items and auto transfers unique weapons', async () => {
    const m=await progression();const {WEAPONS,HERO_FAMILIES}=await import('../src/config/weapons');
    const p=m.unlockAllProfile(m.createProfile());
    for (const weapon of Object.values(WEAPONS)) for (const [hero,family] of Object.entries(HERO_FAMILIES)) {
      expect(m.equipWeapon(p,hero,weapon.id).ok).toBe(weapon.family===family);
    }
    expect(m.equipWeapon(m.createProfile(),'kungfu_po','m01_swatter').ok).toBe(false);
    expect(m.equipWeapon(p,'fake','m01_swatter').ok).toBe(false);
    const moved=m.equipWeapon(p,'kungfu_po','m09_cat_blade').profile;
    expect(moved.equippedWeapons.kungfu_po).toBe('m09_cat_blade');
    expect(moved.equippedWeapons.puss_in_hat).toBeUndefined();
    expect(p.equippedWeapons.puss_in_hat).toBe('m09_cat_blade');
    expect(m.equipWeapon(moved,'kungfu_po',null).profile.equippedWeapons.kungfu_po).toBeUndefined();
  });
  it('buys every prop with its actual price, upgrades badge 3 times, and refuses invalid or maxed purchases atomically', async () => {
    const m=await progression();const {PROPS}=await import('../src/config/props');
    for(const prop of Object.values(PROPS)) {
      let p:Profile={...m.createProfile(),coins:1000,shop:{day:'2026-11-12',offers:[prop.id]}};
      for(let level=1;level<=prop.maxLevel;level++) {
        const r=m.buyProp(p,prop.id);expect(r.ok).toBe(true);expect(r.profile.ownedProps[prop.id]).toBe(level);
        expect(r.profile.coins).toBe(1000-level*prop.price);p=r.profile;
      }
      const before=JSON.stringify(p);expect(m.buyProp(p,prop.id).ok).toBe(false);expect(JSON.stringify(p)).toBe(before);
    }
    const p=m.createProfile();expect(m.buyProp(p,'washer').profile).toEqual(p);
    const poor={...p,shop:{day:'2026-11-12',offers:['washer']}};
    expect(m.buyProp(poor,'washer')).toMatchObject({ok:false,profile:poor});
  });
  it('fills only the purchased max-level shop slot while preserving the other offers and date',async()=>{
    const m=await progression();
    const p:Profile={...m.createProfile(),coins:1000,shop:{day:'2026-11-13',offers:['washer','clay','milk_bottle']}};
    const purchased=m.buyProp(p,'washer');
    expect(purchased.profile.shop).toEqual({day:'2026-11-13',offers:['whistle','clay','milk_bottle']});
    expect(purchased.profile.coins).toBe(780);expect(p.shop?.offers).toEqual(['washer','clay','milk_bottle']);
    const badge:Profile={...p,shop:{day:'2026-11-13',offers:['promo_badge','clay','milk_bottle']}};
    const first=m.buyProp(badge,'promo_badge');
    expect(first.profile.ownedProps.promo_badge).toBe(1);expect(first.profile.shop).toEqual(badge.shop);
    const second=m.buyProp(first.profile,'promo_badge');
    expect(second.profile.ownedProps.promo_badge).toBe(2);expect(second.profile.shop).toEqual(badge.shop);
    const third=m.buyProp(second.profile,'promo_badge');
    expect(third.profile.shop).toEqual({day:'2026-11-13',offers:['washer','clay','milk_bottle']});
  });
  it('keeps fewer than 3 offers when every remaining unsold prop is already on the shelf',async()=>{
    const m=await progression();const full=m.unlockAllProfile(m.createProfile());
    delete full.ownedProps.washer;delete full.ownedProps.clay;delete full.ownedProps.milk_bottle;
    full.shop={day:'2026-11-13',offers:['washer','clay','milk_bottle']};
    const first=m.buyProp(full,'washer');expect(first.profile.shop?.offers).toEqual(['clay','milk_bottle']);
    const second=m.buyProp(first.profile,'clay');expect(second.profile.shop?.offers).toEqual(['milk_bottle']);
    expect(m.buyProp(second.profile,'milk_bottle').profile.shop?.offers).toEqual([]);
  });
  it('toggles owned props with exactly 2 active and 6 passive slots and rejects illegal slot sets atomically', async () => {
    const m=await progression(); const p=m.unlockAllProfile(m.createProfile());
    const empty=m.setPropSlots(p,[],[]).profile;
    const a=m.equipProp(empty,'washer').profile;expect(a.equippedActiveProps).toEqual(['washer']);
    expect(m.equipProp(a,'washer').profile.equippedActiveProps).toEqual([]);
    const two=m.setPropSlots(empty,['washer','clay'],['gold_doge','auto_shovel','giant_orange_cat','vip_poster','extra_oranges','shared_oranges']);
    expect(two.ok).toBe(true);
    expect(m.equipProp(two.profile,'milk_bottle').ok).toBe(false);
    expect(m.equipProp(two.profile,'hyper_party').ok).toBe(false);
    for(const [active,passive] of [[['washer','washer'],[]],[['gold_doge'],[]],[[],['washer']],[['fake'],[]]]) {
      expect(m.setPropSlots(p,active,passive)).toMatchObject({ok:false,profile:p});
    }
    expect(m.equipProp(m.createProfile(),'washer').ok).toBe(false);
  });
  it('persists a calendar-day shop, excludes max-level stock, and refreshes for exactly 40 coins', async () => {
    const m=await progression();const p={...m.createProfile(),coins:100};
    const today=m.ensureDailyShop(p,'2026-11-12',()=>0);
    expect(today.shop?.offers).toHaveLength(3);expect(new Set(today.shop?.offers).size).toBe(3);
    expect(m.ensureDailyShop(today,'2026-11-12',()=>{throw Error('must not reroll');})).toEqual(today);
    const tomorrow=m.ensureDailyShop(today,'2026-11-13',()=>.9);expect(tomorrow.shop?.day).toBe('2026-11-13');
    const refreshed=m.refreshShop(today,'2026-11-12',()=>.8);expect(refreshed).toMatchObject({ok:true,profile:{coins:60}});
    const poor={...today,coins:39};expect(m.refreshShop(poor,'2026-11-12',()=>0)).toMatchObject({ok:false,profile:poor});
    const full=m.unlockAllProfile(p);expect(m.ensureDailyShop({...full,shop:null},'2026-11-12',()=>0).shop?.offers).toEqual([]);
    expect(m.refreshShop(full,'2026-11-12',()=>0)).toMatchObject({ok:false,profile:full});
    const storage=memoryStorage();const s=await storageModule();s.saveProfile(today,storage);
    expect(m.ensureDailyShop(s.loadProfile(storage),'2026-11-12',()=>.2).shop).toEqual(today.shop);
  });
  it('generates exact 3-tier rarity 8-slot wheels (6.5/5/1 over 12.5) with uniform 1/8 slot odds, capped prop compensation and fragments', async () => {
    const m=await progression();const p={...m.createProfile(),coins:300,freeLotteryTickets:1};
    const countRarities=(list:ReturnType<typeof m.createLotteryPrizes>)=>list.map(pr=>m.getLotteryPrizeRarity(pr)).sort((a,b)=>a-b);
    const seq=(first:number)=>{let used=false;return()=>{if(!used){used=true;return first;}return .25;};};

    // Exact 3 rarity patterns at exact weight boundaries (6.5 / 12.5, 5 / 12.5, 1 / 12.5)
    expect(countRarities(m.createLotteryPrizes(p,seq(0)))).toEqual([0,0,0,1,1,1,2,2]);
    expect(countRarities(m.createLotteryPrizes(p,seq(6.49/12.5)))).toEqual([0,0,0,1,1,1,2,2]);
    expect(countRarities(m.createLotteryPrizes(p,seq(6.5/12.5)))).toEqual([0,0,0,1,1,2,2,3]);
    expect(countRarities(m.createLotteryPrizes(p,seq(11.49/12.5)))).toEqual([0,0,0,1,1,2,2,3]);
    expect(countRarities(m.createLotteryPrizes(p,seq(11.5/12.5)))).toEqual([0,0,1,1,2,2,3,4]);
    expect(countRarities(m.createLotteryPrizes(p,seq(.999)))).toEqual([0,0,1,1,2,2,3,4]);

    // Deterministic empirical distribution check across 12,500 evenly spaced wheel rolls + exact 1/8 slot pick
    const tierCounts={common:0,epic:0,legendary:0};
    for(let i=0;i<12500;i++) tierCounts[m.rollLotteryPattern(()=>(i+.5)/12500).id]++;
    expect(tierCounts).toEqual({common:6500,epic:5000,legendary:1000});

    const prizes=m.createLotteryPrizes(p,seq(6.5/12.5));
    expect(prizes).toHaveLength(8);
    // Exact uniform 1/8 chance for each of the 8 slots
    const hitSlots=new Set<number>();
    for(let s=0;s<8;s++) hitSlots.add(m.spinLottery(p,prizes,()=>(s+.5)/8).index!);
    expect([...hitSlots].sort((a,b)=>a-b)).toEqual([0,1,2,3,4,5,6,7]);

    // Capped prop refund, fragment unlock, atomic ticket/coin payment & invalid prize rejection
    prizes[0]={type:'prop',id:'washer',amount:1};
    prizes[6]={type:'fragment',id:'m07_rolling_pin',amount:1};
    const first=m.spinLottery(p,prizes,()=>0);expect(first).toMatchObject({ok:true,index:0,profile:{coins:300,freeLotteryTickets:0,ownedProps:{washer:1}}});
    expect(p.freeLotteryTickets).toBe(1);expect(p.ownedProps).toEqual({});
    const paid=m.spinLottery(first.profile,prizes,()=>0);expect(paid.profile.coins).toBe(320); // P19: 300 - 200 + capped washer's 220
    const frag=m.spinLottery({...p,weaponFragments:{m07_rolling_pin:7}},prizes,()=>.76);
    expect(frag.newWeapons).toEqual(['m07_rolling_pin']);expect(frag.profile.weaponFragments.m07_rolling_pin).toBe(8);
    const poor={...m.createProfile(),coins:199};expect(m.spinLottery(poor,prizes,()=>0)).toMatchObject({ok:false,profile:poor});
    expect(m.spinLottery(p,[],()=>0)).toMatchObject({ok:false,profile:p});
    expect(m.spinLottery(p,[...prizes.slice(0,7),{type:'coins',amount:-1}],()=>.99)).toMatchObject({ok:false,profile:p});
  });
  it.each([
    {id:'washer',level:0,replacement:'whistle'},
    {id:'promo_badge',level:2,replacement:'washer'},
  ])('replaces only the lottery-capped $id shelf slot and preserves the same-day offers',async({id,level,replacement})=>{
    const m=await progression();const s=await storageModule();
    const p:Profile={...m.createProfile(),coins:500,freeLotteryTickets:1,ownedProps:level?{[id]:level}:{},
      shop:{day:'2026-11-13',offers:[id,'clay','milk_bottle']}};
    const prizes=m.createLotteryPrizes(p,()=>0);prizes[0]={type:'prop',id,amount:1};
    const won=m.spinLottery(p,prizes,()=>0);
    expect(won.profile.shop).toEqual({day:'2026-11-13',offers:[replacement,'clay','milk_bottle']});
    expect(won.profile.coins).toBe(500);expect(won.profile.freeLotteryTickets).toBe(0);
    expect(p.shop?.offers).toEqual([id,'clay','milk_bottle']);
    const storage=memoryStorage();expect(s.saveProfile(won.profile,storage)).toBe(true);
    const reloaded=m.ensureDailyShop(s.loadProfile(storage),'2026-11-13',()=>{throw Error('same-day shop must not reroll');});
    expect(reloaded.shop).toEqual(won.profile.shop);
  });
  it('keeps lottery-upgraded badge stock until max level and permits fewer offers when no replacement remains',async()=>{
    const m=await progression();
    const badge:Profile={...m.createProfile(),freeLotteryTickets:2,shop:{day:'2026-11-13',offers:['promo_badge','clay','milk_bottle']}};
    const prizes=m.createLotteryPrizes(badge,()=>0);prizes[0]={type:'prop',id:'promo_badge',amount:1};
    const first=m.spinLottery(badge,prizes,()=>0);expect(first.profile.shop).toEqual(badge.shop);
    const second=m.spinLottery(first.profile,prizes,()=>0);expect(second.profile.shop).toEqual(badge.shop);
    expect(second.profile.ownedProps.promo_badge).toBe(2);
    const nearlyFull=m.unlockAllProfile(m.createProfile());delete nearlyFull.ownedProps.washer;delete nearlyFull.ownedProps.clay;
    nearlyFull.freeLotteryTickets=1;nearlyFull.shop={day:'2026-11-13',offers:['washer','clay']};
    const lastPrizes=m.createLotteryPrizes(nearlyFull,()=>0);lastPrizes[0]={type:'prop',id:'washer',amount:1};
    expect(m.spinLottery(nearlyFull,lastPrizes,()=>0).profile.shop).toEqual({day:'2026-11-13',offers:['clay']});
  });
});
describe('M2 storage receipts and dev backup', () => {
  it('settles both loot bags once with real fragment unlocks and 3-win ticket cycle once Market unlocks', async () => {
    const m=await progression();const s=await storageModule();
    const result={winner:'player' as const,reason:'waves' as const,loot:['m01_swatter','m01_swatter'],playerLoot:['m01_swatter'],aiLoot:['m01_swatter'],coins:120,elapsed:280};
    const marketReady={...m.createProfile(),stars:5,highestStars:5,gachaWinCounter:2};
    const first=s.awardBattle(marketReady,'once',result);
    expect(first).toMatchObject({awarded:true,ticketAwarded:true,newWeapons:['m01_swatter'],profile:{coins:120,wins:1,matches:1,weaponFragments:{m01_swatter:2},freeLotteryTickets:1,gachaWinCounter:0}});
    const storage=memoryStorage();s.saveProfile(first.profile,storage);
    expect(s.awardBattle(s.loadProfile(storage),'once',result)).toMatchObject({awarded:false,newWeapons:[],profile:first.profile});
    const lost=s.awardBattle(marketReady,'loss',{...result,winner:'ai'});
    expect(lost.profile).toMatchObject({coins:0,matches:1,wins:0,freeLotteryTickets:0,weaponFragments:{}});
  });
  it('backs up the complete ordinary profile once, supports reload and restores it while deleting the backup', async () => {
    const m=await progression();const s=await storageModule();const storage=memoryStorage();
    const p=m.ensureDailyShop({...m.createProfile(),coins:371,wins:2,matches:4,freeLotteryTickets:7},'2026-11-12',()=>.3);
    s.saveProfile(p,storage);
    expect(s.enableTestProfile,'test profile API').toBeTypeOf('function');
    const full=s.enableTestProfile(storage);expect(full.coins).toBe(9999);expect(full.unlockedWeapons).toHaveLength(36);expect(Object.keys(full.equippedWeapons)).toHaveLength(12);expect(Object.keys(full.ownedProps)).toHaveLength(20);
    expect(s.isTestProfile(storage)).toBe(true);s.saveProfile({...full,coins:1},storage);s.enableTestProfile(storage);
    expect(s.restoreNormalProfile(storage)).toEqual(p);expect(s.loadProfile(storage)).toEqual(p);expect(s.isTestProfile(storage)).toBe(false);
    expect(s.restoreNormalProfile(storage)).toEqual(p);
  });
  it('never creates a full test profile when its ordinary backup cannot be saved',async()=>{
    const s=await storageModule();const storage=memoryStorage();
    s.saveProfile({...s.emptyProfile(),coins:298},storage);
    storage.setItem=()=>{throw Error('quota');};
    expect(s.enableTestProfile(storage).coins).toBe(298);expect(s.loadProfile(storage).coins).toBe(298);expect(s.isTestProfile(storage)).toBe(false);
  });
  it('rolls back a new backup if writing the full test profile fails so subsequent normal winnings cannot be reverted',async()=>{
    const s=await storageModule();const storage=memoryStorage();
    const original={...s.emptyProfile(),coins:298};s.saveProfile(original,storage);
    const set=storage.setItem;
    storage.setItem=(key,value)=>{
      if(key===`${s.STORAGE_PREFIX}profile`&&JSON.parse(value).coins===9999) throw Error('full profile exceeds quota');
      set(key,value);
    };
    expect(s.enableTestProfile(storage)).toEqual(original);
    const wasTest=s.isTestProfile(storage);
    const won=s.awardBattle(s.loadProfile(storage),'after-failed-test-activation',{
      winner:'player',reason:'waves',loot:[],playerLoot:[],aiLoot:[],coins:120,elapsed:280,
    }).profile;
    expect(s.saveProfile(won,storage)).toBe(true);
    expect(s.restoreNormalProfile(storage)).toEqual(won);
    expect(s.loadProfile(storage)).toMatchObject({coins:418,wins:1,matches:1});
    expect(wasTest).toBe(false);
    expect(storage.getItem(`${s.STORAGE_PREFIX}normalProfileBackup`)).toBeNull();
  });
  it('retains an active ordinary backup when repeated activation or restoration cannot write the main profile',async()=>{
    const s=await storageModule();const storage=memoryStorage();
    const original={...s.emptyProfile(),coins:298};s.saveProfile(original,storage);
    const full=s.enableTestProfile(storage);const backup=storage.getItem(`${s.STORAGE_PREFIX}normalProfileBackup`);
    const set=storage.setItem;
    storage.setItem=(key,value)=>{if(key===`${s.STORAGE_PREFIX}profile`) throw Error('main save blocked');set(key,value);};
    expect(s.enableTestProfile(storage)).toEqual(full);
    expect(s.restoreNormalProfile(storage)).toEqual(full);
    expect(s.isTestProfile(storage)).toBe(true);
    expect(storage.getItem(`${s.STORAGE_PREFIX}normalProfileBackup`)).toBe(backup);
    storage.setItem=set;
    expect(s.restoreNormalProfile(storage)).toEqual(original);
    expect(s.isTestProfile(storage)).toBe(false);
  });
});
