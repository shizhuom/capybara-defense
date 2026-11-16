import {expect,it} from 'vitest';
import {BattleEngine} from '../src/core/BattleEngine';
import {p13WaveMarkup} from '../src/ui/P13HUD';
function endless(){const e=new BattleEngine({seed:13});e.start();while(e.state.phase!=='finished')e.skipWave();e.enterEndless();return e;}
it('banks a fully cleared endless wave when a last-hit skill is immediately followed by pause and cash-out',()=>{
 const e=endless();e.state.spawned=e.currentWaveTargetCount();e.state.enemies=[];
 const last=e.spawnEnemy('rat','player');last.hp=1;e.useSprinkler();
 expect(last.hp).toBeLessThanOrEqual(0);e.pause();e.surrender();
 expect(e.state.result?.endlessCoins).toBe(15);expect(e.state.endlessClearedWave).toBe(11);
});
it('does not bank an incomplete or still-pending-boss endless wave on cash-out',()=>{
 for(const pending of [false,true]){
  const e=endless();e.state.enemies=[];e.state.spawned=e.currentWaveTargetCount()-(pending?0:1);
  if(pending)(e as any).pendingBosses=[{kind:'box_kraken',at:5}];
  e.pause();e.surrender();expect(e.state.result?.endlessCoins).toBe(0);
 }
});
it('uses the endless emblem in the live wave HUD rather than only in the offer',()=>{
 const e=endless();expect(p13WaveMarkup(e.state)).toContain('data-sticker="ui_endless_emblem"');expect(p13WaveMarkup(e.state)).toContain('11');
});
