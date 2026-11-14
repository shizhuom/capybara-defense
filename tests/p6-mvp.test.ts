import {it,expect} from 'vitest';
import {BattleEngine} from '../src/core/BattleEngine';
const setup=()=>{const e=new BattleEngine({seed:32,autoWaves:false});e.start();return e;};
const pet=(e:BattleEngine,kind:string)=>{const id=e.grant(kind).unitId!;return e.state.units.find(u=>u.id===id)!;};
const target=(e:BattleEngine,hp=100)=>{const enemy=e.spawnEnemy('rat','player');enemy.hp=enemy.maxHp=hp;return enemy;};

it('counts only effective health damage, including armor, and credits one kill despite overkill or repeated calls',()=>{
 const e=setup(),unit=pet(e,'hamster'),enemy=target(e);enemy.armor=.25;
 const keys=Object.keys(unit).sort();e.hurt(enemy,40,unit);e.hurt(enemy,1000,unit);e.hurt(enemy,1000,unit);e.surrender();
 expect(e.state.result?.mvp).toEqual({kind:'hamster',level:1,damage:100,kills:1});expect(Object.keys(unit).sort()).toEqual(keys);
});
it.each([['hamster','hamster','hamster',2],['panda','hat_bamboo','kungfu_po',1],['kungfu_po','panda','kungfu_po',2]] as const)('inherits both records for %s plus %s without duplicating the target id',(first,second,kind,level)=>{
 const e=setup(),a=pet(e,first),b=pet(e,second);e.hurt(target(e,20),999,a);e.hurt(target(e,30),999,b);
 const result=e.move(a.id,b.location);expect(result.ok).toBe(true);const merged=e.state.units.find(u=>u.id===result.unitId)!;
 e.hurt(target(e,40),999,merged);e.surrender();expect(e.state.result?.mvp).toEqual({kind,level,damage:90,kills:3});
});
it('routes post-merge DoT damage through multiple merged identities to the surviving hero',()=>{
 const e=setup(),panda=pet(e,'panda'),hat=pet(e,'hat_bamboo'),enemy=target(e,100);
 e.applyDot(enemy,'burn',2,10,panda);e.move(panda.id,hat.location);
 const hero=e.state.units.find(u=>u.id===hat.id)!,feed=pet(e,'panda');e.move(hero.id,feed.location);
 e.tick(1);e.surrender();expect(e.state.result?.mvp?.kind).toBe('kungfu_po');expect(e.state.result?.mvp?.level).toBe(2);expect(e.state.result?.mvp?.damage).toBeCloseTo(10);
});
it('counts damaging weapon chain kills toward their caster',()=>{
 const e=new BattleEngine({seed:32,autoWaves:false,loadouts:{player:{equippedWeapons:{samurai_doge:'m11_salted_fish'}}}});e.start();const unit=pet(e,'samurai_doge');
 const a=target(e,20);target(e,20);target(e,20);e.hurt(a,100,unit);e.surrender();
 expect(e.state.result?.mvp).toMatchObject({kind:'samurai_doge',damage:60,kills:3});
});
it('keeps departed contributors eligible and current level metadata, while excluding prop-only damage',()=>{
 const e=setup(),a=pet(e,'hamster'),b=pet(e,'squirrel');e.hurt(target(e,80),80,a);a.level=3;
 e.hurt(target(e,30),30,b);e.state.units=e.state.units.filter(u=>u.id!==a.id);e.hurt(target(e,500),500);e.surrender();
 expect(e.state.result?.mvp).toEqual({kind:'hamster',level:3,damage:80,kills:1});
});
it('has no invented MVP without unit damage, and does not count non-player hits',()=>{
 const e=setup();pet(e,'bee');const ai={...pet(e,'hamster'),side:'ai' as const};e.hurt(target(e),100,ai);e.hurt(target(e),100);e.surrender();
 expect(e.state.result?.mvp).toBeUndefined();
});
