import {describe,expect,it} from 'vitest';
import { BattleEngine } from '../src/core/BattleEngine';
import { GridSystem } from '../src/core/GridSystem';
import { HEROES } from '../src/config/heroes';
import type { Side, Unit } from '../src/core/types';
const game=()=>{const e=new BattleEngine({seed:42,autoWaves:false,ai:false});e.start();return e;};
function put(e:BattleEngine,kind:string,col=2,row=1,side:Side='player'):Unit {
  const r=e.grant(kind,side); const u=e.state.units.find(u=>u.id===r.unitId)!;
  u.location={zone:'board',col,row}; return u;
}
function target(e:BattleEngine,progress=2,kind='rat'){
  const m=e.spawnEnemy(kind,'player');m.progress=progress;Object.assign(m,GridSystem.pathPosition('player',progress));m.speed=0;return m;
}
describe('命令与经济',()=>{
  it('五连抽扣10，测试台满窝发放不扣钱也不吞卡',()=>{
    const e=game();e.summon();expect(e.state.sides.player.food).toBe(12);
    expect(e.state.units).toHaveLength(5);
    expect(e.grant('hamster')).toMatchObject({ok:false,key:'hint.benchFull'});expect(e.state.sides.player.food).toBe(12);
  });
  it('抽卡长期满足基础/组件权重且不会抽出英雄',()=>{
    const e=game();e.addFood(5000000);let basics=0,bee=0;
    for(let i=0;i<2000;i++){e.summon();for(const u of e.state.units){if(['hamster','squirrel','hedgehog','corgi','bee'].includes(u.kind))basics++;if(u.kind==='bee')bee++;expect(HEROES[u.kind]).toBeUndefined();}e.state.units=[];}
    expect(basics).toBeGreaterThan(6700);expect(basics).toBeLessThan(7300);expect(bee).toBeGreaterThan(650);expect(bee).toBeLessThan(950);
  });
  it('部署、跨窝合成、交换位置；越界移动不吞卡',()=>{
    const e=game();const a=e.grant('panda').unitId!,b=e.grant('hat_bamboo').unitId!;
    expect(e.move(a,{zone:'board',col:2,row:1}).ok).toBe(true);
    expect(e.move(b,{zone:'board',col:2,row:1}).ok).toBe(true);
    expect(e.state.units).toHaveLength(1);expect(e.state.units[0].kind).toBe('kungfu_po');
    const c=e.grant('squirrel').unitId!; e.move(c,{zone:'board',col:6,row:1});
    e.move(c,{zone:'board',col:2,row:1});expect(e.state.units.find(u=>u.id===c)?.location).toEqual({zone:'board',col:2,row:1});
    expect(e.move(c,{zone:'board',col:9,row:1}).ok).toBe(false);expect(e.state.units).toHaveLength(2);
  });
  it('铁锹开草地花1，修复毁格花2；不足时不改变网格',()=>{
    const e=game();expect(e.dig(0,1).ok).toBe(true);expect(e.state.grid[1][0]).toBe('O');
    e.state.grid[1][2]='B';expect(e.dig(2,1).ok).toBe(false);expect(e.state.grid[1][2]).toBe('B');
    e.state.sides.player.shovels=2;expect(e.dig(2,1).ok).toBe(true);expect(e.state.sides.player.shovels).toBe(0);
  });
  it.each([[1,18,1],[2,11,1],[3,7,2]])('Lv%d蜜蜂在%d秒生产%d，不在窝内生产',(lv,seconds,food)=>{
    const e=game();const bee=put(e,'bee');bee.level=lv;e.grant('bee');
    e.tick(seconds+.01);expect(e.state.sides.player.food).toBe(22+food);
  });
});
describe('路径、暂停与通吃',()=>{
  it('普通敌越线扣1橘子，Boss扣2并只结算一次',()=>{
    const e=game();const normal=e.spawnEnemy('rat','player');normal.progress=19.99;e.tick(.1);expect(e.state.sides.player.oranges).toBe(2);
    e.state.sides.player.loot=['a'];e.state.sides.ai.loot=['b','c'];
    const boss=e.spawnEnemy('husky_wrecker','player');boss.progress=19.99;e.tick(.1);
    expect(e.state.phase).toBe('finished');expect(e.state.result?.winner).toBe('ai');expect(e.state.result?.loot).toEqual([]);
    const result=e.state.result;e.tick(100);expect(e.state.result).toBe(result);
  });
  it('玩家清关只带走单机碎片且结算前不入存档',()=>{
    const e=game();e.state.sides.player.loot=['bamboo_blade'];e.state.sides.ai.loot=['orange_wand','chill_shield'];
    expect(e.state.result).toBeNull();e.state.wave=10;e.skipWave();expect(e.state.result?.winner).toBe('player');
    expect(e.state.result?.loot).toEqual(['bamboo_blade']);expect(e.state.result?.coins).toBeGreaterThan(0);
  });
  it('暂停冻结战斗、生产及AI，恢复后继续',()=>{
    const e=game();put(e,'bee');e.spawnEnemy('rat','player');e.pause();const before=JSON.stringify(e.state);e.tick(20);
    expect(JSON.stringify(e.state)).toBe(before);e.pause(false);e.tick(1);expect(e.state.time).toBeCloseTo(1);
  });
});
describe('真正的攻击与12英雄大招',()=>{
  it('普通宠攻击扣血并杀敌',()=>{const e=game();put(e,'squirrel');target(e);e.tick(8);expect(e.state.sides.player.kills).toBe(1);});
  it('刺猬穿透三目标，柯基范围伤害',()=>{
    for(const kind of ['hedgehog','corgi']){const e=game();put(e,kind);const a=target(e,1.8),b=target(e,1.9),c=target(e,2);e.tick(.05);expect(a.hp).toBeLessThan(a.maxHp);expect(b.hp).toBeLessThan(b.maxHp);expect(c.hp).toBeLessThan(c.maxHp);}
  });
  it.each(Object.keys(HEROES))('%s 满能量大招真实伤害或施加效果',kind=>{
    const e=game();const u=put(e,kind);u.energy=HEROES[kind].charge-1;
    const m=target(e,2);m.hp=m.maxHp=100000;const before=m.hp;e.tick(.05);
    expect(u.energy).toBeLessThan(1);
    if(kind==='meowfia')expect(u.buffTime).toBeGreaterThan(2);
    else if(kind==='puss_in_hat')expect(u.empowered).toBe(4);
    else if(kind==='pepe_king'){expect(m.poison).toBeGreaterThan(3);expect(m.slowFactor).toBe(.6);e.tick(1);expect(m.hp).toBeLessThan(before-50);}
    else expect(before-m.hp).toBeGreaterThan(HEROES[kind].damage*2);
    expect(e.state.events.some(event=>event.textKey===`ult.${kind}`)).toBe(true);
  });
  it('纸箱不能攻击，喂养秒解封后正常输出',()=>{
    const e=game();const hero=put(e,'purrcerer');hero.statuses={SEALED:18,WET:99,KNOCKDOWN:3,CONFUSED:3};const m=target(e,2);m.hp=m.maxHp=9999;
    e.tick(.5);expect(m.hp).toBe(9999);const part=e.grant('cat').unitId!;e.move(part,{zone:'board',col:2,row:1});e.tick(.1);
    expect(m.hp).toBeLessThan(9999);expect(e.state.units.find(u=>u.id===hero.id)?.statuses).toEqual({});
  });
  it('Boss被击杀掉8食物和1至2片战利品',()=>{
    const e=game();e.state.wave=10;put(e,'samurai_doge');const boss=target(e,2,'husky_wrecker');boss.hp=1;e.tick(.1);
    expect(e.state.sides.player.food).toBe(30);expect(e.state.sides.player.loot.length).toBeGreaterThanOrEqual(1);expect(e.state.sides.player.loot.length).toBeLessThanOrEqual(2);
  });
});
describe('六首领与镜像AI',()=>{
  it('拆家二哈破坏空地且不摧毁有兵位置',()=>{
    const e=game();put(e,'hamster');target(e,2,'husky_wrecker');e.tick(24.1);
    expect(e.state.grid.flat().filter(t=>t==='B')).toHaveLength(1);expect(e.state.grid[1][2]).toBe('O');
  });
  it('扫地机吞最低级基础宠、回血并膨胀',()=>{
    const e=game();const a=put(e,'hamster'),b=put(e,'squirrel',3,1);b.level=3;const boss=target(e,2,'mega_roomba');boss.hp=500;
    e.tick(10.1);expect(e.state.units.some(u=>u.id===a.id)).toBe(false);expect(e.state.units.some(u=>u.id===b.id)).toBe(true);expect(boss.size).toBeCloseTo(1.15);
  });
  it('剃毛总监降两单位等级并禁合5秒',()=>{
    const e=game();const a=put(e,'hamster'),b=put(e,'squirrel',3,1);a.level=3;b.level=2;target(e,2,'dr_clippers');e.tick(9.05);
    expect(a.level).toBe(2);expect(b.level).toBe(1);expect(a.statuses.MERGE_LOCK).toBeGreaterThan(4);
  });
  it('纸箱封最高级，雨蛙全场淋湿，臭鼬毒雾仍可操作',()=>{
    const e=game();const a=put(e,'hamster'),b=put(e,'squirrel',3,1);b.level=3;
    e.spawnBoss('box_kraken','player');expect(b.statuses.SEALED).toBe(6);expect(a.statuses.SEALED).toBeUndefined();
    e.spawnBoss('sad_rain_frog','player');expect(a.statuses.WET).toBeGreaterThan(0);expect(b.statuses.WET).toBeGreaterThan(0);
    e.spawnBoss('king_skunk','player');expect(e.state.sides.player.fog).toBe(6);expect(e.move(a.id,{zone:'board',col:2,row:3}).ok).toBe(true);
  });
  it('一键Boss只刷玩家路线，每3波不发铁锹',()=>{
    const e=new BattleEngine({ai:false});e.start();e.spawnBoss('king_skunk');expect(e.state.enemies.filter(m=>m.kind==='king_skunk').map(m=>m.side)).toEqual(['player']);
    e.skipWave();e.skipWave();expect(e.state.wave).toBe(3);expect(e.state.sides.player.shovels).toBe(1);
  });
  it('旧AI选项不再自动抽卡或部署',()=>{
    const e=new BattleEngine({seed:123,autoWaves:false});e.start();e.tick(12);
    const ai=e.state.units.filter(u=>u.side==='ai');expect(ai).toHaveLength(0);
    expect(ai.every(u=>u.location.zone!=='board'||u.location.row<5)).toBe(true);
  });
});
