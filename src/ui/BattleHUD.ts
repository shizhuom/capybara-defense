import type { BattleState, GameSettings } from '../core/types';
import { ENEMIES } from '../config/enemies';
import { FIRST_WAVE_PREPARATION, WAVE_DURATION } from '../config/waves';

export function getMusicMode(state?:BattleState, browsing=false):'menu'|'battle'|'boss' {
  if(!state||browsing||state.phase!=='playing')return 'menu';
  return state.enemies.some(enemy=>enemy.boss&&enemy.hp>0)?'boss':'battle';
}

export function isDeveloperMode(search: string, settings: Partial<GameSettings>): boolean {
  return new URLSearchParams(search).get('dev') === '1' || settings.developerMode === true;
}

export function getBossHUD(state: BattleState) {
  const bosses = state.enemies.filter(enemy => enemy.side === 'player' && enemy.boss && enemy.hp > 0)
    .sort((a,b) => b.progress-a.progress || a.id-b.id);
  const boss = bosses[0];
  if (!boss) return null;
  const interval = ENEMIES[boss.kind].interval;
  return {id:boss.id, kind:boss.kind, count:bosses.length, hp:Math.max(0,Math.ceil(boss.hp)), maxHp:Math.ceil(boss.maxHp),
    fraction:Math.max(0,Math.min(1,boss.hp/boss.maxHp)), cooldown:Math.max(0,Math.ceil(boss.abilityCooldown)),
    cooldownFraction:Math.max(0,Math.min(1,boss.abilityCooldown/interval)), warning:boss.abilityCooldown<=2};
}

export function getWaveHUD(state: BattleState) {
  const preparing = state.wave === 1 && state.spawned === 0 && state.waveTime < FIRST_WAVE_PREPARATION;
  const kind = getBossHUD(state) ? 'boss' : preparing ? 'preparation' : 'wave';
  const duration = kind==='preparation' ? FIRST_WAVE_PREPARATION : WAVE_DURATION;
  return {kind, fraction:Math.max(0,Math.min(1,state.waveTime/duration)), remaining:Math.max(0,Math.ceil(duration-state.waveTime))};
}
