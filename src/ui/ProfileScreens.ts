import {ledger,languagePills,threatBanner} from './LedgerView';
import {sceneSticker} from './stickers';
import type { Profile } from '../core/types';
import { AVATARS } from '../config/avatars';
import { RANKS } from '../config/ranks';
import { getLeaderboard, getUnlockedMaps, selectAvatar, selectMap, setRank, updateSettings } from '../core/PlayerProgression';
import { getRank } from '../config/ranks';
import { avatarSticker } from '../render/M3Art';
import { getLanguage,t } from '../i18n/i18n';
import { escapeHtml as esc } from './art';

export type ProfileScreen = 'profile' | 'leaderboard' | 'settings';
const tr = (key: string, vars?: Record<string, string | number>) => esc(t(key, vars));

export function rankCard(profile: Profile): string {
  const rank = getRank(profile.stars), next = RANKS[rank.index + 1];
  const progress = next ? Math.max(0, Math.min(100, (profile.stars - rank.minStars) / (next.minStars - rank.minStars) * 100)) : 100;
  return `<button type="button" data-action="profile" class="rank-card"><span class="rank-avatar">${avatarSticker(profile.avatarId, 68)}</span><span><small>${tr('m3.rankIndex', { index: rank.index })}</small><strong>${tr(`rank.${rank.index}`)}</strong><b>★ ${tr('m3.stars', { count: profile.stars })}</b><span class="rank-track"><i style="width:${progress}%"></i></span><small>${tr(next ? 'm3.rankProgress' : 'm3.topRank', { count: next ? next.minStars - profile.stars : 0 })}</small></span></button>`;
}

export function mapOptions(profile: Profile, includeAuto = true): string {
  const auto = getRank(profile.stars).mapId;
  return `${includeAuto ? `<option value="auto"${profile.selectedMap === 'auto' ? ' selected' : ''}>${tr('m3.autoMap', { map: t(`map.${auto}`) })}</option>` : ''}${getUnlockedMaps(profile).map(id => `<option value="${id}"${profile.selectedMap === id ? ' selected' : ''}>${tr(`map.${id}`)}</option>`).join('')}`;
}

export class ProfileScreens {
  constructor(private profile: () => Profile, private persist: (profile: Profile) => boolean, private render: () => void, private notify: (key: string) => void) {}
  action(action: string): boolean {
    if (!action.startsWith('avatar:')) return false;
    const id = action.slice(7), current = this.profile();
    if (current.unlockedAvatars.includes(id) && this.persist(selectAvatar(current, id))) { this.notify('m3.avatarEquipped'); this.render(); }
    return true;
  }
  change(element: HTMLInputElement | HTMLSelectElement): boolean {
    const before = this.profile();
    if (element.dataset.setting) {
      const key = element.dataset.setting;
      const patch = key === 'showDamageNumbers' || key === 'developerMode' ? { [key]: (element as HTMLInputElement).checked } : { [key]: Number(element.value) };
      if (this.persist(updateSettings(before, patch))) {
        element.style?.setProperty?.('--range-fill', `${Math.round(Number(element.value)*100)}%`);
        const output = element.closest('label')?.querySelector('output');
        if (output) output.textContent = `${Math.round(Number(element.value) * 100)}%`;
      } else this.render();
      return true;
    }
    if (element.dataset.map !== undefined) {
      if (this.persist(selectMap(before, element.value as Profile['selectedMap']))) this.notify('m3.mapSaved');
      this.render(); return true;
    }
    if (element.id === 'dev-rank') {
      if (this.persist(setRank(before, Number(element.value)))) this.notify('m3.rankSaved');
      this.render(); return true;
    }
    return false;
  }
  markup(screen: ProfileScreen): string {
    const profile=this.profile();
    const shell=(body:string)=>ledger(screen,body,{profile});
    if(screen==='settings')return ledger('settings',`<div class="settings-form">${(['musicVolume','soundVolume'] as const).map(key=>`<label class="wood-slider"><span>${tr(key==='musicVolume'?'m3.music':'m3.sound')} <output>${Math.round(profile.settings[key]*100)}%</output></span><input class="cozy-range" style="--range-fill:${Math.round(profile.settings[key]*100)}%" type="range" min="0" max="1" step="0.01" value="${profile.settings[key]}" data-setting="${key}" aria-label="${tr(key==='musicVolume'?'m3.music':'m3.sound')}"></label>`).join('')}<div class="setting-toggles">${(['showDamageNumbers','developerMode'] as const).map(key=>`<label class="capsule-setting toggle-setting-card"><input type="checkbox" data-setting="${key}"${profile.settings[key]?' checked':''}><i class="toggle-knob switch-pill" aria-hidden="true"></i><span><b>${tr(key==='developerMode'?'p1.developer':'m3.damage')}</b><small>${tr(key==='developerMode'?'p5.developerHint':'p5.damageHint')}</small></span></label>`).join('')}</div><div class="settings-language">${languagePills()}</div><button type="button" class="tutorial-replay-card" data-action="tutorial-replay">${sceneSticker('ui_tutorial_capy','',64)}<span><b>📖 ${tr('p1.tutorialReplay')}</b><small>${tr('p5.replayHint')}</small></span></button><p class="settings-saved">${tr('m3.settingsSaved')}</p></div>`);
    if(screen==='leaderboard'){
      const entries=getLeaderboard(profile);
      const row=(index:number,podium=false)=>{const entry=entries[index];return `<li class="leaderboard-row ${entry.isPlayer?'is-player':''} ${podium?'podium-card podium-'+(index+1):''}" data-player="${entry.isPlayer}" data-place="${index+1}" aria-label="${tr('m3.place',{place:index+1})}"><b class="place-number">${index<3?['🥇','🥈','🥉'][index]:index+1}</b><span>${avatarSticker(entry.avatarId,podium?72:44)}</span><div><strong>${esc(entry.name[getLanguage()])}</strong><small>${tr(`rank.${getRank(entry.stars).index}`)}</small><small>${tr('m3.record',{wins:entry.wins,matches:entry.matches,rate:entry.matches?Math.round(entry.wins/entry.matches*100):0})}</small>${entry.isPlayer?`<b class="you-here">${tr('p5.here')}</b>`:''}</div><strong class="rank-stars">${sceneSticker('ui_star_rank','',22)} ${entry.stars}</strong></li>`;};
      return shell(`<section class="rank-threat-banner">${rankCard(profile)}<div>${threatBanner(profile)}<p>${tr('p5.threatExplanation')}</p></div></section><p class="meta-rule">${tr('m3.localBoard')}</p><ol class="rank-podium leaderboard-podium">${[1,0,2].map(i=>row(i,true)).join('')}</ol><ol class="leaderboard-list" start="4">${entries.slice(3).map((_,i)=>row(i+3)).join('')}</ol>`);
    }
    const rate=profile.matches?Math.round(profile.wins/profile.matches*100):0;
    return shell(`<section class="keeper-passport keeper-license-card"><h3>${tr('p5.passport')}</h3><div class="passport-layout">${rankCard(profile)}<div class="passport-stats keeper-stat-grid"><article><small>${tr('p5.winRate')}</small><b>${rate}%</b><span>${tr('m3.record',{wins:profile.wins,matches:profile.matches,rate})}</span></article><article><small>${tr('p5.streak')}</small><b>${profile.winStreak} / ${profile.bestWinStreak}</b></article><article><small>${tr('p5.catalog')}</small><b>${tr('p5.collection',{heroes:profile.mergedHeroes.length,weapons:profile.unlockedWeapons.length})}</b></article><button type="button" data-action="leaderboard">${threatBanner(profile,true)}</button></div></div></section><h3 class="avatar-wall-heading">${tr('p5.avatarWall')}</h3><div class="avatar-grid">${Object.values(AVATARS).map(avatar=>{
      const unlocked=profile.unlockedAvatars.includes(avatar.id),selected=profile.avatarId===avatar.id;
      return `<button type="button" class="avatar-card ${unlocked?'unlocked':'locked'}" data-action="avatar:${avatar.id}" aria-pressed="${selected}"${unlocked?'':' disabled'}><span class="avatar-seal">${avatarSticker(avatar.id,72)}</span><strong>${tr(`avatar.${avatar.id}`)}</strong><small>${tr(`avatar.${avatar.id}.desc`)}</small><b>${selected?'💮 ':unlocked?'':'🔒 '}${tr(selected?'m3.avatarCurrent':unlocked?'m3.avatarUnlocked':'m3.avatarLocked')}</b></button>`;
    }).join('')}</div>`);
  }
}
