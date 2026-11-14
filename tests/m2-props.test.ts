import {afterEach,describe,expect,it,vi} from 'vitest';
import {BattleEngine} from '../src/core/BattleEngine';
import {GridSystem} from '../src/core/GridSystem';
import {Random} from '../src/core/Random';
import type {BattleLoadout,Side} from '../src/core/types';

afterEach(()=>vi.restoreAllMocks());
function arena(active:string[]=[],passive:string[]=[],level=1){
  const loadout:BattleLoadout={equippedWeapons:{},ownedProps:Object.fromEntries([...active,...passive].map(id=>[id,id==='promo_badge'?level:1])),equippedActiveProps:active,equippedPassiveProps:passive};
  const e=new BattleEngine({seed:7,ai:false,autoWaves:false,loadouts:{player:loadout}});e.start();return e;
}
function pet(e:BattleEngine,kind='hamster',side:Side='player'){
  const id=e.grant(kind,side).unitId!;return e.state.units.find(u=>u.id===id)!;
}
function enemy(e:BattleEngine,kind='rat',progress=5,side:Side='player'){
  const m=e.spawnEnemy(kind,side);m.progress=progress;Object.assign(m,GridSystem.pathPosition(side,progress));m.speed=0;return m;
}

describe('洒水车与主动道具',()=>{
  it('AI在敌人逼近终点时实际使用自己的免费洒水车',()=>{
    const e=new BattleEngine({autoWaves:false,seed:7});e.start();const m=enemy(e,'rat',14,'ai');m.hp=m.maxHp=500;e.tick(.05);
    expect(e.state.sides.ai.sprinklerUsed).toBe(true);expect(m.progress).toBe(9.5);expect(e.state.sides.player.sprinklerUsed).toBe(false);
  });
  it('每边洒水车只用一次，冲退4.5格/120伤害/2秒减速，不影响对面',()=>{
    const e=arena(),m=enemy(e,'rat',10),other=enemy(e,'rat',10,'ai');m.hp=m.maxHp=500;
    expect(e.useSprinkler().ok).toBe(true);expect(m.hp).toBe(380);expect(m.progress).toBe(5.5);expect(m.slow).toBe(2);expect(other.progress).toBe(10);
    expect(e.useSprinkler().ok).toBe(false);expect(m.hp).toBe(380);expect(e.useSprinkler('ai').ok).toBe(true);
    const event=e.state.events.find(v=>v.type==='sprinkler')!;expect(event.points?.[0]).toEqual({col:7,row:9});expect(event.points?.at(-1)).toEqual({col:0,row:9});
  });
  it('非法目标、未装备、暂停、结束不扣冷却或改变单位',()=>{
    const e=arena(['milk_bottle']),u=pet(e,'panda');
    expect(e.useProp('milk_bottle',{unitId:u.id}).ok).toBe(false);expect(e.state.sides.player.propCooldowns.milk_bottle??0).toBe(0);
    expect(e.useProp('clay',{unitId:u.id}).ok).toBe(false);e.pause();const before=JSON.stringify(e.state);
    expect(e.useSprinkler().ok).toBe(false);expect(e.useProp('milk_bottle',{unitId:u.id}).ok).toBe(false);e.tick(5);expect(JSON.stringify(e.state)).toBe(before);
    e.surrender();expect(e.useSprinkler().ok).toBe(false);
  });
  it('洗衣机3秒后换成其他组件；忙碌不能合成，换窝不会复活被丢弃的单位',()=>{
    const e=arena(['washer']),u=pet(e,'panda'),hat=pet(e,'hat_bamboo');
    expect(e.useProp('washer',{unitId:u.id}).ok).toBe(true);expect(e.move(hat.id,u.location).ok).toBe(false);
    e.tick(2.9);expect(u.kind).toBe('panda');e.tick(.11);expect(u.kind).not.toBe('panda');expect(u.washing??0).toBe(0);
    expect(e.state.sides.player.propCooldowns.washer).toBeCloseTo(24.99);
    e.tick(25);expect(e.useProp('washer',{unitId:u.id}).ok).toBe(true);e.summon();e.tick(3.1);expect(e.state.units.some(x=>x.id===u.id)).toBe(false);
  });
  it('橡皮泥优先制造现有鹅的菜刀配对件，保持同位置',()=>{
    const e=arena(['clay']);pet(e,'goose');const u=pet(e,'panda'),position={...u.location};
    expect(e.useProp('clay',{unitId:u.id}).ok).toBe(true);expect(u.kind).toBe('cleaver');expect(u.location).toEqual(position);expect(e.state.sides.player.propCooldowns.clay).toBe(35);
  });
  it('奶瓶升级基础宠/英雄并立即解控，满级及对方单位不消耗',()=>{
    const e=arena(['milk_bottle']),u=pet(e,'kungfu_po'),other=pet(e,'hamster','ai');u.statuses={SEALED:18,WET:18,KNOCKDOWN:3,CONFUSED:3};
    expect(e.useProp('milk_bottle',{unitId:other.id}).ok).toBe(false);expect(e.useProp('milk_bottle',{unitId:u.id}).ok).toBe(true);
    expect(u.level).toBe(2);expect(u.statuses).toEqual({});expect(e.state.sides.player.propCooldowns.milk_bottle).toBe(50);
    e.tick(50);u.level=5;expect(e.useProp('milk_bottle',{unitId:u.id}).ok).toBe(false);expect(e.state.sides.player.propCooldowns.milk_bottle).toBe(0);
  });
  it('特训哨65%升级解控，35%降级且不低于1',()=>{
    const e=arena(['whistle']),u=pet(e);vi.spyOn(Random.prototype,'next').mockReturnValue(.64);u.statuses.WET=18;
    e.useProp('whistle',{unitId:u.id});expect(u.level).toBe(2);expect(u.statuses.WET).toBeUndefined();e.tick(40);
    vi.mocked(Random.prototype.next).mockReturnValue(.65);e.useProp('whistle',{unitId:u.id});expect(u.level).toBe(1);e.tick(40);e.useProp('whistle',{unitId:u.id});expect(u.level).toBe(1);
  });
  it('临期罐头55/45两分支确实增减命，允许扣到0结算',()=>{
    vi.spyOn(Random.prototype,'next').mockReturnValue(.54);const lucky=arena(['expired_can']);lucky.useProp('expired_can');expect(lucky.state.sides.player.oranges).toBe(4);
    vi.mocked(Random.prototype.next).mockReturnValue(.55);const unlucky=arena(['expired_can']);unlucky.state.sides.player.oranges=1;unlucky.useProp('expired_can');expect(unlucky.state.phase).toBe('finished');expect(unlucky.state.result?.winner).toBe('ai');
  });
  it('猫薄荷真实增加45%攻速，8秒后消失且暂停冻结冷却',()=>{
    const e=arena(['catnip']),u=pet(e,'squirrel'),base=e.getUnitStats(u).rate;e.useProp('catnip');expect(e.getUnitStats(u).rate).toBeCloseTo(base*1.45);
    e.tick(3);e.pause();e.tick(10);expect(e.state.sides.player.propCooldowns.catnip).toBeCloseTo(52);e.pause(false);e.tick(5.01);expect(e.getUnitStats(u).rate).toBeCloseTo(base);
  });
  it('粘鼠板只放己方道路，控制前三个普通怪或一个Boss',()=>{
    const e=arena(['glue_trap']);expect(e.useProp('glue_trap',{col:2,row:7}).ok).toBe(false);expect(e.useProp('glue_trap',{col:1,row:0}).ok).toBe(false);
    expect(e.useProp('glue_trap',{col:0,row:8}).ok).toBe(true);
    const mobs=Array.from({length:4},()=>enemy(e,'rat',1));e.tick(.05);expect(mobs.filter(m=>m.stun>3)).toHaveLength(3);expect(e.state.traps).toHaveLength(0);
    const b=arena(['glue_trap']);b.useProp('glue_trap',{col:0,row:8});const boss=enemy(b,'husky_wrecker',1);b.tick(.05);expect(boss.stun).toBeGreaterThan(3);expect(b.state.traps).toHaveLength(0);
  });
  it('回收1级单位返5粮并进入6秒冷却，不收高级单位',()=>{
    const e=arena(['recycle_bin']),u=pet(e),food=e.state.sides.player.food;u.level=2;
    expect(e.useProp('recycle_bin',{unitId:u.id}).ok).toBe(false);u.level=1;expect(e.useProp('recycle_bin',{unitId:u.id}).ok).toBe(true);
    expect(e.state.units).toHaveLength(0);expect(e.state.sides.player.food).toBe(food+5);expect(e.state.sides.player.propCooldowns.recycle_bin).toBe(6);
  });
});

describe('12被动道具',()=>{
  it('黄金犬只在新草坪挖宝，35%门槛、食物和武器碎片两分支',()=>{
    const rng=vi.spyOn(Random.prototype,'next').mockReturnValue(.1);const e=arena([],['gold_doge']);const food=e.state.sides.player.food;
    e.dig(1,7);expect(e.state.sides.player.food).toBe(food+12);
    rng.mockReturnValueOnce(.1).mockReturnValueOnce(.9).mockReturnValue(.1);e.dig(1,8);expect(e.state.sides.player.loot[0]).toMatch(/^[mrw]\d{2}_/);
    const before=e.state.sides.player.loot.length;e.state.grid[8][1]='B';e.state.sides.player.shovels=2;e.dig(1,8);expect(e.state.sides.player.loot).toHaveLength(before);
    const no=arena([],['gold_doge']);rng.mockReturnValue(.35);no.dig(1,7);expect(no.state.sides.player.food).toBe(30);
  });
  it('自动铲7.5秒一把、上限8，不改变未装备方12秒规则',()=>{
    const e=arena([],['auto_shovel']);e.state.sides.player.shovels=0;e.state.sides.ai.shovels=0;e.tick(7.5);expect(e.state.sides.player.shovels).toBe(1);expect(e.state.sides.ai.shovels).toBe(0);
    e.tick(80);expect(e.state.sides.player.shovels).toBe(8);expect(e.state.sides.ai.shovels).toBe(6);
  });
  it('肥橘守最后2格，每局最多两次，普通秒杀/Boss35%最大血并击退3格',()=>{
    const e=arena([],['giant_orange_cat']),boss=enemy(e,'husky_wrecker',13),normal=enemy(e,'rat',14);boss.armor=0;
    e.tick(.05);expect(normal.hp).toBeLessThanOrEqual(0);expect(boss.hp).toBeCloseTo(boss.maxHp*.65);expect(boss.progress).toBe(10);expect(e.state.sides.player.giantCatUses).toBe(1);
    boss.progress=13;Object.assign(boss,GridSystem.pathPosition('player',13));e.tick(.05);expect(e.state.sides.player.giantCatUses).toBe(2);
    boss.progress=13;e.tick(.05);expect(e.state.sides.player.giantCatUses).toBe(2);expect(boss.progress).toBe(13);
  });
  it('VIP只增组件权重，五连抽固定10粮与整窝替换保留',()=>{
    const e=arena([],['vip_poster']),plain=arena();vi.spyOn(Random.prototype,'next').mockReturnValue(.68);
    e.summon();plain.summon();expect(e.state.units.every(u=>u.kind==='panda')).toBe(true);expect(plain.state.units.every(u=>u.kind==='bee')).toBe(true);
    expect(e.state.sides.player.food).toBe(20);const ids=e.state.units.map(u=>u.id);e.summon();expect(e.state.units).toHaveLength(5);expect(e.state.units.every(u=>!ids.includes(u.id))).toBe(true);
  });
  it('果盘/同乐券只开局加命，暂停恢复不会重复添加',()=>{
    const e=arena([],['extra_oranges','shared_oranges']);expect(e.state.sides.player.oranges).toBe(9);expect(e.state.sides.ai.oranges).toBe(5);e.start();e.pause();e.pause(false);expect(e.state.sides.player.oranges).toBe(9);
  });
  it('狂欢己方35%对手20%，望远镜只增基础射程至少2格的单位',()=>{
    const e=arena([],['hyper_party','tall_perch']);const own=pet(e,'squirrel'),other=pet(e,'squirrel','ai'),melee=pet(e);
    expect(e.getUnitStats(own).rate).toBeCloseTo(1.1*1.35);expect(e.getUnitStats(other).rate).toBeCloseTo(1.1*1.2);
    expect(e.getUnitStats(own).range).toBe(3.5);expect(e.getUnitStats(melee).range).toBe(1.35);
  });
  it('香蕉皮永久减少己方道路敌人速度12%，对方不受影响',()=>{
    const e=arena([],['banana_peel']),a=e.spawnEnemy('rat','player'),b=e.spawnEnemy('rat','ai');e.tick(2);
    expect(a.progress).toBeCloseTo(.38*2*.88);expect(b.progress).toBeCloseTo(.38*2);
  });
  it('断电45%技能失败并反噬8%最大血，失败时不会施加雨湿',()=>{
    vi.spyOn(Random.prototype,'next').mockReturnValue(.44);const e=arena([],['emp_jammer']),u=pet(e);u.location={zone:'board',col:2,row:7};const boss=e.spawnEnemy('sad_rain_frog','player');
    expect(u.statuses.WET).toBeUndefined();expect(boss.hp).toBeCloseTo(boss.maxHp*.92);
    vi.mocked(Random.prototype.next).mockReturnValue(.45);e.spawnEnemy('sad_rain_frog','player');expect(u.statuses.WET).toBe(18);
  });
  it.each([[1,.079,.08],[2,.149,.15],[3,.219,.22]])('训宠证Lv%s按相应概率抽出Lv2基础宠，不升级组件',(level,yes,no)=>{
    const e=arena([],['promo_badge'],level);const r=vi.spyOn(Random.prototype,'next').mockReturnValue(0);
    r.mockReturnValueOnce(0).mockReturnValueOnce(yes);e.summon();expect(e.state.units[0].level).toBe(2);
    r.mockReturnValueOnce(0).mockReturnValueOnce(no);e.summon();expect(e.state.units[0].level).toBe(1);
  });
  it('蜜蜂加班初始+10粮，产粮间隔乘0.75，基础数值未改',()=>{
    const e=arena([],['bee_overtime']),u=pet(e,'bee');u.location={zone:'board',col:2,row:7};expect(e.state.sides.player.food).toBe(40);e.tick(11.9);expect(e.state.sides.player.food).toBe(40);e.tick(.11);expect(e.state.sides.player.food).toBe(42);
  });
});
