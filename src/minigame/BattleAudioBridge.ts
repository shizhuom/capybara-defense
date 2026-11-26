import type { BattleState } from '../core/types';
import type { MinigameAudioController } from '../platform/types';

/**
 * Watches BattleState.events and maps gameplay moments to MinigameAudio cues
 * without modifying Web SoundManager or BattleEngine.
 */
export class BattleAudioBridge {
  private lastEventId = 0;
  private battleId = '';
  private lastHitAt = 0;

  reset(battleId = ''): void {
    this.battleId = battleId;
    this.lastEventId = 0;
    this.lastHitAt = 0;
  }

  observe(state: BattleState, audio: MinigameAudioController, nowMs: number): void {
    if (this.battleId !== state.id) {
      this.battleId = state.id;
      this.lastEventId = 0;
    }
    let maxId = this.lastEventId;
    for (const ev of state.events) {
      if (ev.id <= this.lastEventId) continue;
      if (ev.id > maxId) maxId = ev.id;
      if (ev.side !== 'player') continue;

      switch (ev.type) {
        case 'hit':
        case 'slash':
        case 'projectile':
          if (nowMs - this.lastHitAt > 95) {
            this.lastHitAt = nowMs;
            audio.play(ev.hitCue ?? 'hit_melee');
          }
          break;
        case 'death':
          audio.play('enemy_defeat');
          break;
        case 'orange':
          audio.play((ev.value ?? -1) < 0 ? 'orange_loss' : 'orange_gain');
          break;
        case 'shield_block':
          audio.play('orange_gain');
          break;
        case 'sprinkler':
          audio.play('sprinkler');
          break;
        case 'giant_cat':
          audio.play('giant_cat');
          break;
        case 'lucky_drop':
          audio.play('gacha_win');
          break;
        case 'purge':
          if (ev.effect === 'legendary' || ev.effect === 'awakened') {
            audio.play('hero_ult');
          } else {
            audio.play('merge_hero');
          }
          break;
        case 'bubble':
          if (ev.effect === 'boss_spawn') audio.play('boss_arrive');
          break;
        case 'alert':
          if (ev.effect === 'elite_spawn') audio.play('wave_start');
          break;
        default:
          break;
      }
    }
    this.lastEventId = maxId;
  }
}
