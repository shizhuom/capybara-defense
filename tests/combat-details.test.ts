import {expect,it} from 'vitest';
import {BattleEngine} from '../src/core/BattleEngine';
import {HEROES} from '../src/config/heroes';
import {GridSystem} from '../src/core/GridSystem';
function arena(kind:string){
  const e=new BattleEngine({autoWaves:false,ai:false,seed:18});e.start();
  const id=e.grant(kind).unitId!,u=e.state.units.find(u=>u.id===id)!;u.location={zone:'board',col:2,row:1};
  u.energy=(HEROES[kind]?.charge??1)-1;
  return{e,u};
}
function enemy(e:BattleEngine,progress=2,side:'player'|'ai'='player'){
  const m=e.spawnEnemy('rat',side);m.progress=progress;Object.assign(m,GridSystem.pathPosition(side,progress));m.speed=0;m.hp=m.maxHp=100000;return m;
}
it('阿宝范围眩晕2秒，远处目标及另一半区不受影响',()=>{
  const {e}=arena('kungfu_po'),near=enemy(e),far=enemy(e,14),other=enemy(e,5,'ai');e.tick(.05);
  expect(near.stun).toBeCloseTo(1.95);expect(far.hp).toBe(100000);expect(other.hp).toBe(100000);
});
it('教父导弹留下3秒灼烧并持续扣血',()=>{
  const {e,u}=arena('bamboo_mafia'),m=enemy(e);e.tick(.05);expect(m.burn).toBeCloseTo(2.95);
  u.cooldown=10;const hp=m.hp;e.tick(1);expect(m.hp).toBeCloseTo(hp-46*.35);
});
it('太极沿路线逆向穿透并击退，不击退更靠近终点的敌人',()=>{
  const {e}=arena('zen_master'),m=enemy(e),behind=enemy(e,.5),ahead=enemy(e,13);
  e.tick(.05);expect(m.progress).toBeCloseTo(.6);expect(behind.progress).toBeCloseTo(0);expect(behind.hp).toBeLessThan(100000);expect(ahead.progress).toBe(13);
});
it('喵利波特闪电最多命中6个目标并麻痹0.6秒',()=>{
  const {e}=arena('purrcerer');const targets=Array.from({length:8},()=>enemy(e));e.tick(.05);
  expect(targets.filter(m=>m.stun>0)).toHaveLength(6);expect(targets[0].stun).toBeCloseTo(.55);
});
it('剑客大招后四次十字攻击倍率220%，结束恢复普通伤害',()=>{
  const {e,u}=arena('puss_in_hat'),m=enemy(e);e.tick(.05);u.energy=-100;
  const start=m.hp;e.tick(2.01);expect(start-m.hp).toBeCloseTo(27*2.2*4);expect(u.empowered).toBe(0);
});
it('加特林大招期间射速约4倍并自动结束',()=>{
  const {e,u}=arena('meowfia'),m=enemy(e);e.tick(.05);u.energy=-100;
  const hp=m.hp;e.tick(1);expect(hp-m.hp).toBeGreaterThanOrEqual(180);expect(hp-m.hp).toBeLessThanOrEqual(240);
  e.tick(2);expect(u.buffTime).toBe(0);
});
it('武士将大招后低于25%血的普通怪斩杀，Boss不触发处决',()=>{
  const {e}=arena('samurai_doge');const m=enemy(e);m.hp=400;m.maxHp=600;e.tick(.05);expect(m.hp).toBeLessThanOrEqual(0);
  const other=arena('samurai_doge');const boss=other.e.spawnEnemy('husky_wrecker','player');boss.progress=2;Object.assign(boss,GridSystem.pathPosition('player',2));boss.speed=0;boss.hp=500;boss.maxHp=1000;other.e.tick(.05);expect(boss.hp).toBeGreaterThan(0);
});
it('蛙王四秒毒与40%减速覆盖本路线全体，另一侧保持原状',()=>{
  const {e,u}=arena('pepe_king'),near=enemy(e),far=enemy(e,14),other=enemy(e,5,'ai');e.tick(.05);u.cooldown=20;
  expect(far.slowFactor).toBe(.6);expect(far.poison).toBeGreaterThan(3.9);expect(other.poison).toBe(0);
  const hp=far.hp;e.tick(1);expect(far.hp).toBeCloseTo(hp-26);e.tick(4);expect(near.poison).toBe(0);expect(far.slow).toBe(0);
});
it('淋湿实际减少攻击次数，合成后恢复攻速',()=>{
  const dry=arena('squirrel'),wet=arena('squirrel');const a=enemy(dry.e),b=enemy(wet.e);wet.u.statuses.WET=20;
  dry.e.tick(4);wet.e.tick(4);expect(100000-b.hp).toBeLessThan((100000-a.hp)*.75);
  const part=wet.e.grant('squirrel').unitId!;wet.e.move(part,{zone:'board',col:2,row:1});expect(wet.e.state.units[0].statuses.WET).toBeUndefined();
});
it('扫地机确实恢复20%最大血量',()=>{
  const {e,u}=arena('hamster');u.cooldown=20;const boss=e.spawnEnemy('mega_roomba','player');boss.progress=2;Object.assign(boss,GridSystem.pathPosition('player',2));boss.speed=0;boss.hp=500;
  e.tick(10.01);expect(boss.hp).toBeCloseTo(845);expect(e.state.units).toHaveLength(0);
});
it('单机高强度阵容完整走完10波在4–6分钟内结算',()=>{
  const e=new BattleEngine({seed:123,ai:false});e.start();
  for(const side of ['player'] as const){
    for(let i=0;i<6;i++){
      const id=e.grant(i===5?'bee':'purrcerer',side).unitId!,u=e.state.units.find(u=>u.id===id)!;
      u.level=i===5?3:5;u.location={zone:'board',col:[1,2,3,2,3,2][i],row:[1,1,1,3,3,5][i]};
    }
    e.state.sides[side].oranges=99;
  }
  e.tick(360);expect(e.state.wave).toBe(10);expect(e.state.phase).toBe('finished');expect(e.state.result?.elapsed).toBeGreaterThanOrEqual(240);expect(e.state.result?.elapsed).toBeLessThanOrEqual(360);
});
it('暂停、结束后的调试命令不能偷偷推进或重复结算',()=>{
  const {e}=arena('hamster');e.pause();const before=JSON.stringify(e.state);e.summon();e.skipWave();e.adjustOranges(-3);e.addFood(500);e.tick(10);expect(JSON.stringify(e.state)).toBe(before);
  e.surrender();const result=e.state.result;e.adjustOranges(-99,'ai');e.surrender();expect(e.state.result).toBe(result);
});
it('敌人挨打短暂闪白，停火后闪白消退',()=>{
  const {e,u}=arena('squirrel'),m=enemy(e) as ReturnType<typeof enemy>&{hitFlash:number};
  e.tick(.05);expect(m.hitFlash).toBeGreaterThan(0);u.cooldown=10;
  e.tick(.2);expect(m.hitFlash).toBe(0);
});
