import {describe,expect,it} from 'vitest';
import {BattleEngine} from '../src/core/BattleEngine';
const game=()=>{const e=new BattleEngine({seed:42,autoWaves:false,ai:false});e.start();return e;};
describe('10口粮五连抽与弃牌重抽',()=>{
  it('一次扣10，填满五个不同窝槽，返回第一只新宠物',()=>{
    const e=game(),r=e.summon(),bench=e.state.units.filter(u=>u.side==='player');
    expect(r.ok).toBe(true);expect(bench).toHaveLength(5);expect(e.state.sides.player.food).toBe(12);
    expect(bench.map(u=>u.location)).toEqual([0,1,2,3,4].map(slot=>({zone:'bench',slot})));
    expect(r.unitId).toBe(bench[0].id);
  });
  it('窝满时可直接丢弃旧一窝再抽五只，只扣一次费用',()=>{
    const e=game();e.summon();const ids=e.state.units.map(u=>u.id);const r=e.summon();
    expect(r.ok).toBe(true);expect(e.state.sides.player.food).toBe(0);expect(e.state.units).toHaveLength(5);
    expect(e.state.units.every(u=>!ids.includes(u.id))).toBe(true);
  });
  it('只丢剩余窝中单位，已上场单位保留且不能创建AI单位',()=>{
    const e=game();e.summon();const deployed=e.state.units[0],discarded=e.state.units.slice(1).map(u=>u.id);
    e.move(deployed.id,{zone:'board',col:2,row:1});expect(e.grant('panda','ai').ok).toBe(false);
    const result=e.summon();expect(result.ok).toBe(true);expect(e.state.units.some(u=>u.id===deployed.id)).toBe(true);
    expect(e.state.units.every(u=>!discarded.includes(u.id))).toBe(true);
    expect(e.state.units.filter(u=>u.side==='player'&&u.location.zone==='bench')).toHaveLength(5);
  });
  it('钱不够时不先丢卡、不扣钱、不改变棋盘',()=>{
    const e=game();e.summon();e.state.sides.player.food=9;const before=JSON.stringify(e.state);
    expect(e.summon()).toMatchObject({ok:false,key:'hint.noFood'});expect(JSON.stringify(e.state)).toBe(before);
  });
  it('暂停不能弃牌重抽，测试台免费发放仍只给一只且不会清空窝',()=>{
    const e=game();e.grant('panda');expect(e.state.units).toHaveLength(1);e.summon();const before=JSON.stringify(e.state.units);
    expect(e.grant('cat')).toMatchObject({ok:false,key:'hint.benchFull'});expect(JSON.stringify(e.state.units)).toBe(before);
    e.pause();expect(e.summon()).toMatchObject({ok:false,key:'hint.paused'});expect(JSON.stringify(e.state.units)).toBe(before);
  });
  it('AI抽卡请求被拒绝且不改变单机状态',()=>{
    const e=game();const player=e.grant('cat').unitId!;e.summon('ai');
    expect(e.state.sides.ai.food).toBe(22);expect(e.state.units.filter(u=>u.side==='ai')).toHaveLength(0);
    expect(e.state.units.some(u=>u.id===player)).toBe(true);
  });
});
describe('开局缓冲与恢复节奏',()=>{
  it('开场18秒供布阵，首领最早在108秒第四波登场',()=>{
    const e=new BattleEngine({ai:false});e.start();e.state.sides.player.oranges=e.state.sides.ai.oranges=99;
    e.tick(17.95);expect(e.state.enemies).toHaveLength(0);e.tick(.1);expect(e.state.enemies.length).toBeGreaterThan(0);
    e.tick(89.9);expect(e.state.enemies.some(m=>m.boss)).toBe(false);
    e.tick(.1);expect(e.state.wave).toBe(4);expect(e.state.enemies.some(m=>m.kind==='husky_wrecker')).toBe(true);
  });
  it('初级仓鼠三次普攻击倒第一波老鼠',()=>{
    const e=game(),id=e.grant('hamster').unitId!,u=e.state.units.find(u=>u.id===id)!;u.location={zone:'board',col:2,row:1};
    const m=e.spawnEnemy('rat','player');Object.assign(m,{progress:2,col:2,row:0,speed:0});e.tick(.05);expect(m.hp).toBe(16);
    e.tick(1.6);expect(m.hp).toBeLessThanOrEqual(0);expect(e.state.sides.player.kills).toBe(1);
  });
  it('每55秒补1把铲子，AI不生产，满4把停止囤积计时',()=>{
    const e=game();e.tick(54.95);expect(e.state.sides.player.shovels).toBe(1);
    e.tick(.1);expect(e.state.sides.player.shovels).toBe(2);expect(e.state.sides.ai.shovels).toBe(1);
    e.tick(200);expect(e.state.sides.player.shovels).toBe(4);
    e.dig(0,1);expect(e.state.sides.player.shovels).toBe(3);e.tick(54.95);expect(e.state.sides.player.shovels).toBe(3);e.tick(.1);expect(e.state.sides.player.shovels).toBe(4);
  });
  it('暂停时铲子倒计时不偷跑',()=>{
    const e=game();e.tick(30);e.pause();e.tick(60);expect(e.state.sides.player.shovels).toBe(1);e.pause(false);e.tick(25.01);expect(e.state.sides.player.shovels).toBe(2);
  });
  it('二哈24秒才首次毁格，每方最多2块坏地，修复后仍可继续毁格',()=>{
    const e=game();const boss=e.spawnEnemy('husky_wrecker','player');boss.speed=0;
    const broken=()=>e.state.grid.flat().filter(t=>t==='B').length;
    e.tick(23.95);expect(broken()).toBe(0);e.tick(.1);expect(broken()).toBe(1);
    e.tick(24);expect(broken()).toBe(2);e.tick(48);expect(broken()).toBe(2);
    const row=e.state.grid.findIndex(tiles=>tiles.includes('B')),col=e.state.grid[row].indexOf('B');
    e.dig(col,row);expect(broken()).toBe(1);e.tick(24);expect(broken()).toBe(2);
  });
});
