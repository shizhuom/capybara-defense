import type { Profile } from '../core/types';
import { AVATARS } from '../config/avatars';
import { RANKS } from '../config/ranks';
import { getLeaderboard, getUnlockedMaps, selectAvatar, selectMap, setRank, updateSettings } from '../core/PlayerProgression';
import { getRank } from '../config/ranks';
import { avatarSticker } from '../render/M3Art';
import { t } from '../i18n/i18n';
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
    const profile = this.profile();
    const header = `<button type="button" class="dialog-close icon-button" data-action="close-profile" aria-label="${tr('m3.close')}">×</button><h2 id="dialog-title">${tr(`m3.${screen}`)}</h2>`;
    if (screen === 'settings') return header + `<div class="settings-form">${(['musicVolume', 'soundVolume'] as const).map(key => `<label><span>${tr(key === 'musicVolume' ? 'm3.music' : 'm3.sound')} <output>${Math.round(profile.settings[key] * 100)}%</output></span><input type="range" min="0" max="1" step="0.01" value="${profile.settings[key]}" data-setting="${key}" aria-label="${tr(key === 'musicVolume' ? 'm3.music' : 'm3.sound')}"></label>`).join('')}<label class="damage-setting"><input type="checkbox" data-setting="showDamageNumbers"${profile.settings.showDamageNumbers ? ' checked' : ''}><span>${tr('m3.damage')}</span></label><label class="damage-setting"><input type="checkbox" data-setting="developerMode"${profile.settings.developerMode ? ' checked' : ''}><span>${tr('p1.developer')}</span></label><button type="button" class="button button-light" data-action="tutorial-replay">${tr('p1.tutorialReplay')}</button><p>${tr('m3.settingsSaved')}</p></div>`;
    if (screen === 'leaderboard') return header + `<p class="meta-rule">${tr('m3.localBoard')}</p><ol class="leaderboard-list">${getLeaderboard(profile).map((entry, index) => `<li class="leaderboard-row ${entry.isPlayer ? 'is-player' : ''}" data-player="${entry.isPlayer}" aria-label="${tr('m3.place', { place: index + 1 })}"><b>${index + 1}</b><span>${avatarSticker(entry.avatarId, 48)}</span><div><strong>${esc(entry.name[document.documentElement.lang === 'en' ? 'en' : 'zh-CN'])}</strong><small>${tr(`rank.${getRank(entry.stars).index}`)}</small><small>${tr('m3.record', { wins: entry.wins, matches: entry.matches, rate: entry.matches ? Math.round(entry.wins / entry.matches * 100) : 0 })}</small></div><strong>★ ${entry.stars}</strong></li>`).join('')}</ol>`;
    return header + rankCard(profile) + `<p>${tr('m3.record', { wins: profile.wins, matches: profile.matches, rate: profile.matches ? Math.round(profile.wins / profile.matches * 100) : 0 })}</p><p>${tr('m3.streak', { current: profile.winStreak, best: profile.bestWinStreak })}</p><div class="avatar-grid">${Object.values(AVATARS).map(avatar => {
      const unlocked = profile.unlockedAvatars.includes(avatar.id), selected = profile.avatarId === avatar.id;
      return `<button type="button" class="avatar-card ${unlocked ? 'unlocked' : 'locked'}" data-action="avatar:${avatar.id}" aria-pressed="${selected}"${unlocked ? '' : ' disabled'}>${avatarSticker(avatar.id, 72)}<strong>${tr(`avatar.${avatar.id}`)}</strong><small>${tr(`avatar.${avatar.id}.desc`)}</small><b>${tr(selected ? 'm3.avatarCurrent' : unlocked ? 'm3.avatarUnlocked' : 'm3.avatarLocked')}</b></button>`;
    }).join('')}</div>`;
  }
}
