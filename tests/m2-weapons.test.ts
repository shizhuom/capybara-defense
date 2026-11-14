import {afterEach,describe,expect,it,vi} from 'vitest';
import {BattleEngine} from '../src/core/BattleEngine';
import {Random} from '../src/core/Random';
import {GridSystem} from '../src/core/GridSystem';
import {HEROES} from '../src/config/heroes';
import {WEAPONS} from '../src/config/weapons';
import type {Unit} from '../src/core/types';

afterEach(()=>vi.restoreAllMocks());
function arena(weapon:string,hero='kungfu_po'){
  const e=new BattleEngine({ai:false,autoWaves:false,seed:1,loadouts:{player:{equippedWeapons:{[hero]:weapon}}}});e.start();
  const id=e.grant(hero).unitId!,u=e.state.units.find(x=>x.id===id)!;u.location={zone:'board',col:2,row:1};u.energy=-1000;
  return{e,u};
}
function enemy(e:BattleEngine,progress=2){const m=e.spawnEnemy('rat','player');m.progress=progress;Object.assign(m,GridSystem.pathPosition('player',progress));m.speed=0;m.hp=m.maxHp=100000;return m;}
function hits(e:BattleEngine,u:Unit,count=1){for(let i=0;i<count;i++){u.cooldown=0;e.tick(.05);}}
function ultimate(e:BattleEngine,u:Unit){u.energy=e.getUnitStats(u).charge-1;hits(e,u);}

describe('36把神兵的基础加成与实际词条',()=>{
  const bonuses=[.12,.2,.3,.42,.58];
  it.each(Object.values(WEAPONS).map(w=>[w.id,w.family,w.rarity] as const))('%s 只对穿戴英雄施加品质伤害并真实打伤敌人',(id,family,rarity)=>{
    vi.spyOn(Random.prototype,'next').mockReturnValue(.99);
    const hero=family==='melee'?'kungfu_po':family==='ranged'?'bamboo_mafia':'zen_master',base=family==='melee'?38:family==='ranged'?46:42;
    const {e,u}=arena(id,hero),m=enemy(e);expect(e.getUnitStats(u).damage).toBeCloseTo(base*(1+bonuses[rarity]));hits(e,u);expect(100000-m.hp).toBeGreaterThanOrEqual(base*(1+bonuses[rarity])-.0001);
  });
  it('非法跨系、重复武器与外部对象修改不能给战斗额外加成',()=>{
    const input={equippedWeapons:{kungfu_po:'w01_teaser',puss_in_hat:'m01_swatter',ronin_goose:'m01_swatter'}};
    const e=new BattleEngine({loadouts:{player:input},ai:false,autoWaves:false});e.start();input.equippedWeapons.puss_in_hat='m12_iron_wok';
    expect(e.state.sides.player.loadout.equippedWeapons).toEqual({puss_in_hat:'m01_swatter'});
  });
  it.each([['m02_slipper','kungfu_po',1.9],['m03_scratcher','kungfu_po',2.1],['r02_duck_squirt','bamboo_mafia',3.6],['r11_sniper_laser','doge_wick',4.32]] as const)('%s 扩展射程到 %s',(id,hero,range)=>{
    const{e,u}=arena(id,hero);expect(e.getUnitStats(u).range).toBeCloseTo(range);
  });
  it('法棍15%击退0.35格；板凳与电蚊拍分别控制0.6/0.4秒',()=>{
    vi.spyOn(Random.prototype,'next').mockReturnValue(.149);
    const a=arena('m04_baguette'),m=enemy(a.e);hits(a.e,a.u);expect(m.progress).toBeCloseTo(1.65);
    const b=arena('m06_stool'),n=enemy(b.e);hits(b.e,b.u);expect(n.stun).toBeCloseTo(.55);
    const c=arena('w03_bug_zapper','zen_master'),p=enemy(c.e);hits(c.e,c.u);expect(p.stun).toBeCloseTo(.35);
  });
  it.each([['m05_duster','kungfu_po',1.48],['r06_pressure_washer','bamboo_mafia',1.6]] as const)('%s 同一目标叠攻速有上限，换目标重置',(id,hero,cap)=>{
    const{e,u}=arena(id,hero),m=enemy(e),base=HEROES[hero].rate;hits(e,u,12);expect(e.getUnitStats(u).rate).toBeCloseTo(base*cap);
    m.hp=0;enemy(e,1.9);hits(e,u);expect(e.getUnitStats(u).rate).toBeCloseTo(base*(id.startsWith('m')?1.06:1.1));
  });
  it.each([['m07_rolling_pin','kungfu_po',38*1.42,1.8],['r07_popcorn_cannon','bamboo_mafia',46*1.42,2]] as const)('%s 第8次普攻才产生范围伤害',(id,hero,damage,mult)=>{
    const{e,u}=arena(id,hero);enemy(e);const other=enemy(e,1.5);hits(e,u,7);expect(other.hp).toBe(100000);hits(e,u);expect(100000-other.hp).toBeCloseTo(damage*mult);
  });
  it('榴莲击杀后45%攻速持续2.5秒',()=>{
    const{e,u}=arena('m08_durian'),m=enemy(e);m.hp=1;hits(e,u);expect(e.getUnitStats(u).rate).toBeCloseTo(1.4*1.45);e.tick(2.51);expect(e.getUnitStats(u).rate).toBeCloseTo(1.4);
  });
  it.each([['m09_cat_blade','kungfu_po',4,.8,38*1.58],['m11_salted_fish','kungfu_po',2,1,38*1.58],['w06_yarn_storm','zen_master',4,.8,42*1.3]] as const)('%s 击杀触发独立追击且不会无限递归',(id,hero,count,mult,damage)=>{
    vi.spyOn(Random.prototype,'next').mockReturnValue(.99);const{e,u}=arena(id,hero),m=enemy(e),other=enemy(e,1.5);m.hp=1;hits(e,u);expect(100000-other.hp).toBeCloseTo(count*mult*damage);
  });
  it('神竹18%额外220%范围伤并眩晕；铁锅15%抛飞300%范围伤',()=>{
    vi.spyOn(Random.prototype,'next').mockReturnValue(.14);
    const a=arena('m10_bamboo_staff'),m=enemy(a.e),other=enemy(a.e,1.5);hits(a.e,a.u);expect(100000-other.hp).toBeCloseTo(38*1.58*2.2);expect(m.stun).toBeGreaterThan(.7);
    const b=arena('m12_iron_wok'),n=enemy(b.e),other2=enemy(b.e,1.5);hits(b.e,b.u);expect(100000-other2.hp).toBeCloseTo(38*1.58*3);expect(n.stun).toBeGreaterThan(0);
  });
  it('泡泡减速25%持续1.5秒；发球机20%弹射70%伤害',()=>{
    vi.spyOn(Random.prototype,'next').mockReturnValue(.14);const a=arena('r03_bubble_gun','bamboo_mafia'),m=enemy(a.e);hits(a.e,a.u);expect(m.slowFactor).toBe(.75);expect(m.slow).toBeCloseTo(1.45);
    const b=arena('r04_tennis_launcher','bamboo_mafia');enemy(b.e);const other=enemy(b.e,1.5);hits(b.e,b.u);expect(100000-other.hp).toBeCloseTo(46*1.2*.7);
  });
  it('吹风机灼烧3秒真实持续扣血；火箭筒点燃同路相邻敌人',()=>{
    vi.spyOn(Random.prototype,'next').mockReturnValue(.1);const a=arena('r05_hair_dryer','bamboo_mafia'),m=enemy(a.e);hits(a.e,a.u);a.u.cooldown=20;const hp=m.hp;a.e.tick(1);expect(hp-m.hp).toBeCloseTo(46*1.3*.35);
    const b=arena('r09_bamboo_bazooka','bamboo_mafia');enemy(b.e);const other=enemy(b.e,1.5);hits(b.e,b.u);expect(other.burn).toBeGreaterThan(2.9);const outside=enemy(b.e,14);expect(outside.burn).toBe(0);
  });
  it('摇钱树同敌首次命中25%掉1粮，后续命中不重复抽',()=>{
    vi.spyOn(Random.prototype,'next').mockReturnValue(.24);const{e,u}=arena('r08_coin_slingshot','bamboo_mafia');enemy(e);hits(e,u,5);expect(e.state.sides.player.food).toBe(23);
  });
  it('摇钱树穿透分别对首次命中的每个敌人判定，双枪二次命中不重复',()=>{
    vi.spyOn(Random.prototype,'next').mockReturnValue(.1);const{e,u}=arena('r08_coin_slingshot','doge_wick');enemy(e,2);enemy(e,2.1);hits(e,u);expect(e.state.sides.player.food).toBe(24);hits(e,u);expect(e.state.sides.player.food).toBe(24);
  });
  it('持续伤害保留击杀来源，源离场后毒杀仍触发4团毛线',()=>{
    vi.spyOn(Random.prototype,'next').mockReturnValue(.99);const{e,u}=arena('w06_yarn_storm','pepe_king'),m=enemy(e),other=enemy(e,1.5);m.hp=54;ultimate(e,u);
    e.state.units=[];e.tick(.1);expect(m.hp).toBeLessThanOrEqual(0);expect(e.state.events.filter(v=>v.type==='weapon'&&v.effect==='yarn')).toHaveLength(4);expect(other.hp).toBeLessThan(100000-40*1.3*.8*4);
  });
  it('猫刀流血击杀同样触发飞刃，DOT不会20Hz触发迫击炮弹射',()=>{
    vi.spyOn(Random.prototype,'next').mockReturnValue(.99);const a=arena('m09_cat_blade','puss_in_hat'),m=enemy(a.e);enemy(a.e,1.5);a.u.empowered=1;m.hp=97;hits(a.e,a.u);a.u.cooldown=20;a.e.tick(.2);expect(a.e.state.events.filter(v=>v.effect==='claw')).toHaveLength(4);
    vi.mocked(Random.prototype.next).mockReturnValue(.1);const b=arena('r12_junk_mortar','bamboo_mafia');enemy(b.e);enemy(b.e,1.5);ultimate(b.e,b.u);b.u.cooldown=20;b.e.tick(.6);expect(b.e.state.events.some(v=>v.type==='bounce'&&v.effect==='mortar')).toBe(false);
  });
  it('松果枪每10次普攻额外6发导弹',()=>{
    const{e,u}=arena('r10_acorn_minigun','bamboo_mafia'),m=enemy(e);hits(e,u,9);const hp=m.hp;hits(e,u);expect(hp-m.hp).toBeCloseTo(46*1.58*7);
  });
  it('红点距离增伤随距离增加且最高50%，迫击炮45%真实弹射',()=>{
    vi.spyOn(Random.prototype,'next').mockReturnValue(.44);const near=arena('r11_sniper_laser','bamboo_mafia'),far=arena('r11_sniper_laser','bamboo_mafia');const a=enemy(near.e,2),b=enemy(far.e,0);hits(near.e,near.u);hits(far.e,far.u);expect(100000-b.hp).toBeGreaterThan(100000-a.hp);expect(100000-b.hp).toBeLessThanOrEqual(46*1.58*1.5);
    const c=arena('r12_junk_mortar','bamboo_mafia');enemy(c.e);const other=enemy(c.e,1.5);hits(c.e,c.u);expect(other.hp).toBeLessThan(100000);
  });
  it('静电气球加10%攻速，毛线球少1次充能可提前释放大招',()=>{
    const a=arena('w02_balloon','zen_master');expect(a.e.getUnitStats(a.u).rate).toBeCloseTo(1.32);
    const b=arena('w04_yarn_orb','zen_master');enemy(b.e);b.u.energy=0;hits(b.e,b.u,6);expect(b.u.energy).toBe(6);hits(b.e,b.u);expect(b.u.energy).toBe(0);expect(b.e.state.events.some(v=>v.textKey==='ult.zen_master')).toBe(true);
  });
  it('蹦迪鼓舞仅1.5格友军，木鱼第9击全队加速并真实伤害',()=>{
    vi.spyOn(Random.prototype,'next').mockReturnValue(.14);const a=arena('w05_disco_ball','zen_master');enemy(a.e);const id=a.e.grant('hamster').unitId!,ally=a.e.state.units.find(u=>u.id===id)!;ally.location={zone:'board',col:3,row:1};ally.cooldown=20;hits(a.e,a.u);expect(a.e.getUnitStats(ally).rate).toBeCloseTo(1.25*1.2);a.u.cooldown=20;a.e.tick(4.01);expect(a.e.getUnitStats(ally).rate).toBeCloseTo(1.25);
    const b=arena('w08_fortune_fish','zen_master');enemy(b.e);const m=enemy(b.e,1.5);hits(b.e,b.u,8);expect(m.hp).toBe(100000);hits(b.e,b.u);expect(m.hp).toBeLessThan(100000);expect(b.e.getUnitStats(b.u).rate).toBeCloseTo(1.2*1.15);
  });
  it('猫爪流星12%造成240%范围伤',()=>{
    vi.spyOn(Random.prototype,'next').mockReturnValue(.119);const{e,u}=arena('w07_cat_scratch_meteor','zen_master');enemy(e);const m=enemy(e,1.5);hits(e,u);expect(100000-m.hp).toBeCloseTo(42*1.42*2.4);
  });
  it('阴阳炉每8次交替亢奋增伤与毒雾，黑洞聚怪眩晕',()=>{
    const{e,u}=arena('w09_yin_yang_burner','zen_master');enemy(e);hits(e,u,8);expect(e.getUnitStats(u).damage).toBeCloseTo(42*1.58*1.35);const m=enemy(e,1.5);hits(e,u,8);expect(m.poison).toBeGreaterThan(0);
    vi.spyOn(Random.prototype,'next').mockReturnValue(.14);const b=arena('w10_cosmic_vacuum','zen_master');enemy(b.e);const other=enemy(b.e,1);hits(b.e,b.u);expect(other.progress).toBeGreaterThan(1);expect(other.stun).toBeGreaterThan(.7);
  });
  it('金箍球每次命中40%火溅，蛙杖对减速或中毒目标增伤35%',()=>{
    const a=arena('w11_golden_hoop_ball','zen_master');enemy(a.e);const other=enemy(a.e,1.5);hits(a.e,a.u);expect(100000-other.hp).toBeCloseTo(42*1.58*.4);
    const b=arena('w12_rain_crown_scepter','zen_master'),m=enemy(b.e);m.slow=3;hits(b.e,b.u);expect(100000-m.hp).toBeCloseTo(42*1.58*1.35);
  });
});

describe('12位英雄一一对应本命觉醒',()=>{
  it('阿宝震地半径+30%并竹笋环，剑客6次强化附带流血',()=>{
    vi.spyOn(Random.prototype,'next').mockReturnValue(.99);const a=arena('m10_bamboo_staff');enemy(a.e);const far=enemy(a.e,4.8);ultimate(a.e,a.u);expect(far.hp).toBeLessThan(100000);expect(a.e.state.events.some(v=>v.effect==='bamboo_ring')).toBe(true);
    const b=arena('m09_cat_blade','puss_in_hat');const m=enemy(b.e);ultimate(b.e,b.u);expect(b.u.empowered).toBe(6);hits(b.e,b.u);expect(m.bleed).toBeGreaterThan(2.9);
  });
  it('修勾斩杀线35%且必出剑气，非本命英雄不获得斩杀觉醒',()=>{
    vi.spyOn(Random.prototype,'next').mockReturnValue(.99);const a=arena('m11_salted_fish','samurai_doge'),m=enemy(a.e);m.maxHp=3000;m.hp=1450;enemy(a.e,1.5);ultimate(a.e,a.u);expect(m.hp).toBeLessThanOrEqual(0);expect(a.e.state.events.some(v=>v.effect==='fish')).toBe(true);
    const b=arena('m10_bamboo_staff','samurai_doge'),n=enemy(b.e);n.maxHp=3000;n.hp=1450;ultimate(b.e,b.u);expect(n.hp).toBeGreaterThan(0);
  });
  it('刀鹅7变10次真实伤害，保存1.1秒残影路径；普通仍7次',()=>{
    vi.spyOn(Random.prototype,'next').mockReturnValue(.99);const a=arena('m12_iron_wok','ronin_goose'),m=enemy(a.e);ultimate(a.e,a.u);expect(100000-m.hp).toBeCloseTo(50*1.58*(1+10*1.6));const event=a.e.state.events.find(v=>v.type==='dash')!;expect(event.duration).toBe(1.1);expect(event.points).toHaveLength(11);
    const b=arena('m01_swatter','ronin_goose');enemy(b.e);ultimate(b.e,b.u);expect(b.e.state.events.find(v=>v.type==='dash')?.points).toHaveLength(8);
  });
  it('教父8枚轰炸；加特林持续4秒',()=>{
    vi.spyOn(Random.prototype,'next').mockReturnValue(.99);const a=arena('r09_bamboo_bazooka','bamboo_mafia'),m=enemy(a.e);ultimate(a.e,a.u);expect(100000-m.hp).toBeCloseTo(46*1.58*(1+8*1.5)+46*1.58*.35*.05);
    const b=arena('r10_acorn_minigun','meowfia');enemy(b.e);ultimate(b.e,b.u);expect(b.u.buffTime).toBe(4);b.u.cooldown=20;b.e.tick(3);expect(b.u.buffTime).toBeGreaterThan(.9);
  });
  it('旺财85%悬赏与浣熊40%顺手鱼干/大招范围+40%',()=>{
    vi.spyOn(Random.prototype,'next').mockReturnValue(.7);const a=arena('r11_sniper_laser','doge_wick'),m=enemy(a.e);m.hp=1;hits(a.e,a.u);expect(a.e.state.sides.player.food).toBe(25);
    vi.mocked(Random.prototype.next).mockReturnValue(.39);const b=arena('r12_junk_mortar','rocket_coon');enemy(b.e);hits(b.e,b.u);expect(b.e.state.sides.player.food).toBe(23);
    vi.mocked(Random.prototype.next).mockReturnValue(.99);const far=enemy(b.e,.3);ultimate(b.e,b.u);expect(far.hp).toBeLessThan(100000);
  });
  it('太极双波，喵利10跳，鸡神12跳且路径逐段保存',()=>{
    vi.spyOn(Random.prototype,'next').mockReturnValue(.99);const a=arena('w09_yin_yang_burner','zen_master'),m=enemy(a.e);ultimate(a.e,a.u);expect(100000-m.hp).toBeCloseTo(42*1.58*(1+2*2.8));
    const b=arena('w10_cosmic_vacuum','purrcerer');const mobs=Array.from({length:12},()=>enemy(b.e));ultimate(b.e,b.u);expect(mobs.filter(m=>m.stun>0)).toHaveLength(10);expect(b.e.state.events.find(v=>v.type==='bounce')?.points).toHaveLength(11);
    const c=arena('w11_golden_hoop_ball','ballin_rooster');enemy(c.e);ultimate(c.e,c.u);expect(c.e.state.events.find(v=>v.type==='bounce')?.points).toHaveLength(13);
  });
  it('蛙王6秒减速毒并护甲归零，过期恢复原护甲',()=>{
    const{e,u}=arena('w12_rain_crown_scepter','pepe_king'),m=enemy(e);m.armor=.5;ultimate(e,u);u.cooldown=20;expect(m.poison).toBeGreaterThan(5.9);expect(m.armorBreak).toBeGreaterThan(5.9);const hp=m.hp;e.tick(1);expect(hp-m.hp).toBeCloseTo(40*1.58*.65*1.35);e.tick(5.1);expect(m.armor).toBe(.5);expect(m.armorBreak??0).toBe(0);
  });
});
