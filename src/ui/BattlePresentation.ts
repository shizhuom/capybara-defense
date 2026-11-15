import {sceneSticker,unitSticker} from './stickers';
import {t} from '../i18n/i18n';
import {escapeHtml as esc} from './art';
import type {BattleState,VisualEvent} from '../core/types';
import {getUnlockedHeroIds} from '../config/progression';
const tr=(key:string,vars?:Record<string,string|number>)=>esc(t(key,vars));
export function transitionMarkup(state:BattleState,stars:number):string {
 return `<span class="curtain-shutter left"></span><span class="curtain-shutter right"></span><span class="blade-sheen"></span><span class="clash-center">${sceneSticker('ui_battle_clash_crest','',150)}<span class="clash-blades">${sceneSticker('ui_crossed_blades','',116)}</span><strong>${tr(`map.${state.mapId}`)}</strong><b>${tr('p9.ready')}</b><span class="curtain-roster">${getUnlockedHeroIds(stars).slice(0,6).map(id=>unitSticker(id,36)).join('')}</span><small>${tr(`rank.${state.rankIndex}`)} · ${tr('p9.skipCurtain')}</small></span>`;
}
export function enemyAlertMarkup(event:Pick<VisualEvent,'enemyKind'|'boss'>):string {
 const id=event.enemyKind;if(!id)return '';
 const name=t(`${event.boss?'boss':'enemy'}.${id}`),tip=event.boss?`p1.boss.${id}.tip`:`p9.alert.${id}`;
 return `${sceneSticker('ui_alert_siren','',36)}${unitSticker(id,44)}<span><strong>${event.boss?tr('p9.boss',{name}):`${tr('p9.elite')} · ${esc(name)}`}</strong><small>${tr(tip)}</small></span>`;
}
