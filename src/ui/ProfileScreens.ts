import {ledger} from './LedgerView';
import {sceneSticker} from './stickers';
import type { Profile } from '../core/types';
import { AVATARS } from '../config/avatars';
import { RANKS, getRank, getRankDifficulty } from '../config/ranks';
import { getLeaderboard, getUnlockedMaps, selectAvatar, selectMap, setRank, updateSettings } from '../core/PlayerProgression';
import { avatarSticker } from '../render/M3Art';
import { getLanguage,t } from '../i18n/i18n';
import { escapeHtml as esc } from './art';
import { heroSticker } from './stickers';
import { displayNickname, NICKNAME_MAX } from '../core/PlayerIdentity';
import { localEntry, type LeaderboardEntry, type LeaderboardSnapshot } from './EndlessLeaderboardClient';
import { endlessHubTabs, medallionHeaderBadges } from './MedallionScreen';

export type ProfileScreen = 'profile' | 'leaderboard' | 'endless-board' | 'settings';
const boardClock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const isMyEntry = (entry: LeaderboardEntry, profile: Profile) => entry.isMe === true || (!!entry.playerId && entry.playerId === profile.playerId);

/** Endless board UI state supplied by the host (the client lives in GameApp). */
export interface EndlessBoardView { snapshot: LeaderboardSnapshot; loading: boolean; nicknameDraft?: string; endlessHub?: boolean }

/** P17 global endless board: a warm name card on top, then the Top 100 with the player's row highlighted. */
export function endlessBoardMarkup(profile: Profile, view: EndlessBoardView): string {
  const language = getLanguage(), name = displayNickname(profile, language), best = profile.bestEndlessWave ?? 0;
  const { snapshot } = view, me = snapshot.me, online = snapshot.mode === 'online';
  const rank = me && me.rank > 0 ? tr('p17.board.rank', { rank: me.rank, total: Math.max(snapshot.totalPlayers, me.rank) }) : '';
  const status = view.loading ? tr('p17.board.loading') : snapshot.mode === 'unconfigured' ? tr('p17.board.unconfigured') : snapshot.mode === 'offline' ? tr('p17.board.offline') : '';
  const cached = !online && snapshot.fetchedAt ? `<small class="endless-board-cached">${tr('p17.board.cached', { time: new Date(snapshot.fetchedAt).toLocaleString(language === 'en' ? 'en-US' : 'zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) })}</small>` : '';
  const medallionsBtn = view.endlessHub ? '' : `<button type="button" class="endless-board-medallions" data-action="medallions"><span aria-hidden="true">${sceneSticker('ui_endless_crest', '', 18)}</span> ${tr('p17.board.medallions')}</button>`;
  const card = `<section class="endless-board-card" aria-label="${tr('p17.board.nickname')}"><span class="endless-board-avatar">${avatarSticker(profile.avatarId, 64)}</span><div class="endless-board-identity"><form class="endless-name-form" data-endless-name-form><label class="endless-name-label" for="endless-nickname">${tr('p17.board.nickname')}</label><span class="endless-name-row"><input id="endless-nickname" class="endless-name-input" name="nickname" type="text" maxlength="${NICKNAME_MAX * 2}" autocomplete="off" spellcheck="false" value="${esc(view.nicknameDraft ?? name)}" data-endless-nickname aria-label="${tr('p17.board.nickname')}"><button type="submit" class="storybook-equip-btn endless-name-save" data-action="endless-name-save">${tr('p17.board.save')}</button></span></form><p class="endless-board-best">${best >= 11 ? `<b>${tr('p17.board.best', { wave: best })}</b>${rank ? `<span class="endless-board-rank">${rank}</span>` : `<span class="endless-board-rank is-muted">${tr(online ? 'p17.board.unranked' : 'p17.board.local')}</span>`}` : `<span class="is-muted">${tr('p17.board.noBest')}</span>`}</p></div><div class="endless-board-actions"><button type="button" class="endless-board-refresh" data-action="endless-board-refresh"${view.loading ? ' disabled' : ''}>${tr('p17.board.refresh')}</button>${medallionsBtn}</div></section>`;
  const note = status ? `<p class="endless-board-status${online ? '' : ' is-offline'}" role="status">${status}${cached}</p>` : '';
  const local = localEntry(profile, language);
  const listed = snapshot.entries.length ? snapshot.entries : !online && local ? [local] : [];
  const row = (entry: LeaderboardEntry, index: number) => {
    const mine = isMyEntry(entry, profile), place = entry.rank || index + 1;
    const medal = entry.rank > 0 && place <= 3 ? ['🥇', '🥈', '🥉'][place - 1] : entry.rank > 0 ? `#${place}` : '★';
    const shownName = online ? entry.nickname : (mine ? name : entry.nickname);
    return `<li class="storybook-row-card endless-board-row${mine ? ' is-player' : ''}" data-player="${mine}" data-place="${entry.rank > 0 ? place : 0}"><span class="endless-board-place">${medal}</span><span class="storybook-frame tone-heroes">${avatarSticker(entry.avatarId, 40)}</span><span class="storybook-copy"><strong class="portrait-name">${esc(shownName)}${mine ? ` <span class="you-here">${tr('p17.board.me')}</span>` : ''}</strong><span class="storybook-tagline endless-board-meta"><span class="endless-board-mvp" title="${tr(`hero.${entry.mvpKind}`)}">${heroSticker(entry.mvpKind, 30, entry.mvpAwakened)}</span>${entry.awakenedCount ? `<span class="endless-board-awakened">✦${entry.awakenedCount}</span>` : ''}<span class="endless-board-clock">${sceneSticker('ui_clock_sand', '', 16)}${boardClock(entry.elapsedSeconds)}</span></span></span><span class="storybook-status endless-board-wave"><b>${tr('p17.board.wave', { wave: entry.bestWave })}</b></span></li>`;
  };
  const meRow = me && online && !snapshot.entries.some(entry => isMyEntry(entry, profile)) ? `<li class="endless-board-gap" aria-hidden="true">⋯</li>${row(me, me.rank - 1)}` : '';
  const heading = `<h3 class="storybook-list-heading endless-board-heading">${tr(online ? 'p17.board.top' : 'p17.board.local', { count: Math.min(100, snapshot.entries.length) })}${online && snapshot.totalPlayers ? ` <small>${tr('p17.board.players', { total: snapshot.totalPlayers })}</small>` : ''}</h3>`;
  const list = listed.length ? `<ol class="storybook-rank-list endless-board-list" aria-label="${tr('p11.title.endless-board')}">${listed.map(row).join('')}${meRow}</ol>` : `<p class="endless-board-empty">${tr(online ? 'p17.board.empty' : 'p17.board.noBest')}</p>`;
  return `${card}${note}${heading}${list}`;
}
const tr = (key: string, vars?: Record<string, string | number>) => esc(t(key, vars));

export function rankCard(profile: Profile): string {
  const rank = getRank(profile.stars), next = RANKS[rank.index + 1];
  const progress = next ? Math.max(0, Math.min(100, (profile.stars - rank.minStars) / (next.minStars - rank.minStars) * 100)) : 100;
  return `<button type="button" data-action="profile" class="rank-card"><span class="rank-avatar">${avatarSticker(profile.avatarId, 68)}</span><span><small>${tr('m3.rankIndex', { index: rank.index })}</small><strong>${tr(`rank.${rank.index}`)}</strong><b>${sceneSticker('ui_star_rank','',18)} ${tr('m3.stars', { count: profile.stars })}</b><span class="rank-track"><i style="width:${progress}%"></i></span><small>${tr(next ? 'm3.rankProgress' : 'm3.topRank', { count: next ? next.minStars - profile.stars : 0 })}</small></span></button>`;
}

export function mapOptions(profile: Profile, includeAuto = true): string {
  const auto = getRank(profile.stars).mapId;
  return `${includeAuto ? `<option value="auto"${profile.selectedMap === 'auto' ? ' selected' : ''}>${tr('m3.autoMap', { map: t(`map.${auto}`) })}</option>` : ''}${getUnlockedMaps(profile).map(id => `<option value="${id}"${profile.selectedMap === id ? ' selected' : ''}>${tr(`map.${id}`)}</option>`).join('')}`;
}

export class ProfileScreens {
  constructor(private profile: () => Profile, private persist: (profile: Profile) => boolean, private render: () => void, private notify: (key: string) => void, private board?: () => EndlessBoardView, private onAvatarChange?: () => void) {}
  action(action: string): boolean {
    if (!action.startsWith('avatar:')) return false;
    const id = action.slice(7), current = this.profile();
    if (current.unlockedAvatars.includes(id) && this.persist(selectAvatar(current, id))) { this.notify('m3.avatarEquipped'); this.onAvatarChange?.(); this.render(); }
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
    const view=screen==='endless-board'?this.board?.()??{snapshot:{mode:'unconfigured',entries:[],totalPlayers:0,me:null,fetchedAt:null},loading:false}:undefined;
    const body=screen==='settings'?this.settings(profile):screen==='leaderboard'?this.leaderboard(profile):screen==='endless-board'?endlessBoardMarkup(profile,view!):this.passport(profile);
    if(screen==='endless-board'&&view?.endlessHub){
      return ledger(screen,body,{profile,tabs:endlessHubTabs('endless-board'),badges:medallionHeaderBadges(profile),mascot:'ui_medallion_peek_capy'});
    }
    return ledger(screen,body,{profile});
  }
  private leaderboard(profile:Profile):string {
    const rank=getRank(profile.stars),next=RANKS[rank.index+1],hp=Number(getRankDifficulty(rank.index).hpMultiplier.toFixed(2));
    const progress=next?Math.max(0,Math.min(100,(profile.stars-rank.minStars)/(next.minStars-rank.minStars)*100)):100;
    const summary=`<section class="storybook-row-card my-rank-summary-card" aria-label="${tr('p11.profile.myRank')}"><span class="storybook-frame tone-heroes">${avatarSticker(profile.avatarId,64)}</span><span class="storybook-copy"><strong class="portrait-name">${tr(`rank.${rank.index}`)}</strong><span class="storybook-tagline">${tr(next?'p11.profile.rankProgress':'p11.profile.topRank',{count:next?next.minStars-profile.stars:0,hp})}</span><span class="slim-progress" role="progressbar" aria-label="${tr('p11.profile.rankProgressLabel')}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress)}"><i style="width:${progress}%"></i></span></span><span class="storybook-status rank-stars">${sceneSticker('ui_star_rank','',24)}<b>${profile.stars}</b></span></section>`;
    const playerName=displayNickname(profile,getLanguage());
    const rows=getLeaderboard(profile).map((entry,index)=>`<li class="storybook-row-card leaderboard-row${entry.isPlayer?' is-player':''}" data-player="${entry.isPlayer}" data-place="${index+1}" aria-label="${tr('m3.place',{place:index+1})}"><span class="rank-portrait"><b class="place-number">${index<3?['🥇','🥈','🥉'][index]:index+1}</b><span class="storybook-frame tone-heroes">${avatarSticker(entry.avatarId,44)}</span></span><span class="storybook-copy"><strong class="portrait-name">${esc(entry.isPlayer?playerName:entry.name[getLanguage()])}${entry.isPlayer?` <span class="you-here">${tr('p11.profile.youHere')}</span>`:''}</strong><span class="storybook-tagline">${tr(`rank.${getRank(entry.stars).index}`)}</span></span><span class="storybook-status rank-stars">${sceneSticker('ui_star_rank','',20)}<b>${entry.stars}</b></span></li>`).join('');
    return `${summary}<ol class="storybook-rank-list" aria-label="${tr('m3.localBoard')}">${rows}</ol>`;
  }
  private passport(profile:Profile):string {
    const rate=profile.matches?Math.round(profile.wins/profile.matches*100):0,language=getLanguage();
    const playerName=displayNickname(profile,language),best=profile.bestEndlessWave??0;
    const endlessNote=best>=11?` · ${tr('p17.board.best',{wave:best})}`:'';
    const summary=`<section class="storybook-row-card storybook-profile-summary" aria-label="${tr('p5.passport')}"><span class="storybook-frame tone-heroes">${avatarSticker(profile.avatarId,68)}</span><span class="storybook-copy"><strong class="portrait-name">${esc(playerName)}</strong><span class="storybook-meta">${tr(`rank.${getRank(profile.stars).index}`)}${endlessNote}</span><span class="storybook-tagline">${tr('p11.profile.record',{matches:profile.matches,rate,best:profile.bestWinStreak})}</span></span><span class="storybook-status profile-collection"><span>${tr('p11.profile.collection')}</span><b>${profile.mergedHeroes.length}/12</b></span></section>`;
    const rows=Object.values(AVATARS).map(avatar=>{
      const unlocked=profile.unlockedAvatars.includes(avatar.id),selected=profile.avatarId===avatar.id;
      const status=selected?`<b>${tr('p11.profile.avatarCurrent')}</b><span class="storybook-mark" aria-hidden="true">${sceneSticker('ui_storybook_check','',26)}</span>`:unlocked?`<span class="storybook-pill-label">${tr('p11.profile.avatarChange')}</span>`:`<b>${tr('m3.avatarLocked')}</b><span class="storybook-mark" aria-hidden="true">${sceneSticker('ui_lock_closed','',22)}</span>`;
      return `<article class="storybook-row-card avatar-row ${unlocked?'unlocked':'locked'}${selected?' is-current':''}" role="listitem"><button type="button" class="storybook-row-button" data-action="avatar:${avatar.id}" aria-pressed="${selected}"${unlocked?'':' disabled'}><span class="storybook-frame tone-heroes${unlocked?'':' unowned-art'}">${avatarSticker(avatar.id,60)}</span><span class="storybook-copy"><strong class="portrait-name">${tr(`avatar.${avatar.id}`)}</strong><span class="storybook-tagline">${tr(`avatar.${avatar.id}.desc`)}</span></span><span class="storybook-status">${status}</span></button></article>`;
    }).join('');
    return `${summary}<h3 class="storybook-list-heading">${tr('p11.profile.avatarCollection')}</h3><div class="storybook-list storybook-avatar-list" role="list" aria-label="${tr('p11.profile.avatarCollection')}">${rows}</div>`;
  }
  private settings(profile:Profile):string {
    const volumes=(['musicVolume','soundVolume'] as const).map(key=>{
      const label=tr(key==='musicVolume'?'p11.profile.musicVolume':'p11.profile.soundVolume'),percent=Math.round(profile.settings[key]*100),id=`profile-setting-${key}`;
      return `<article class="storybook-row-card setting-row setting-volume-row"><label class="storybook-volume-control"><span class="storybook-frame tone-settings setting-icon" aria-hidden="true">${key==='musicVolume'?'♫':'🔊'}</span><span class="storybook-copy"><strong class="portrait-name">${label}</strong><input id="${id}" class="cozy-range" style="--range-fill:${percent}%" type="range" min="0" max="1" step="0.01" value="${profile.settings[key]}" data-setting="${key}" aria-label="${label}"></span><output class="storybook-status" for="${id}">${percent}%</output></label></article>`;
    }).join('');
    const toggles=(['showDamageNumbers','developerMode'] as const).map(key=>`<label class="storybook-setting-toggle"><span class="storybook-copy"><strong class="portrait-name">${tr(key==='developerMode'?'p1.developer':'m3.damage')}</strong><span class="storybook-tagline">${tr(key==='developerMode'?'p5.developerHint':'p5.damageHint')}</span></span><span class="storybook-toggle"><input class="storybook-toggle-input" type="checkbox" data-setting="${key}"${profile.settings[key]?' checked':''}><i class="storybook-toggle-track" aria-hidden="true"></i></span></label>`).join('');
    const replay=`<article class="storybook-row-card setting-row setting-tutorial-row"><button type="button" class="storybook-row-button" data-action="tutorial-replay"><span class="storybook-frame tone-heroes">${sceneSticker('ui_tutorial_capy','',64)}</span><span class="storybook-copy"><strong class="portrait-name">${tr('p11.profile.tutorialReplay')}</strong><span class="storybook-tagline">${tr('p11.profile.tutorialHint')}</span></span><span class="storybook-status"><span class="storybook-pill-label">${tr('p11.profile.start')}</span></span></button></article>`;
    return `<div class="storybook-list storybook-settings-list">${volumes}<article class="storybook-row-card setting-row setting-toggle-row">${toggles}</article>${replay}</div>`;
  }
}
