import type {WavePreview} from '../core/types';
import {t} from '../i18n/i18n';
import {escapeHtml as esc} from './art';
import {sceneSticker,unitSticker} from './stickers';

export function wavePreviewTip(preview:WavePreview|null):string {
  if(!preview)return t('p6.finalWave');
  const title=t('p6.wavePreview',{wave:preview.wave,count:preview.count});
  return `${title} · ${preview.bosses.length?preview.bosses.map(id=>`${t(`boss.${id}`)}: ${t(`p1.boss.${id}.tip`)}`).join(' / '):t(`enemy.${preview.minion}`)}`;
}
export function waveStrategyMarkup(preview:WavePreview|null,early:{allowed:boolean;bonusFood:number}):string {
  const bosses=preview?.bosses??[],tip=wavePreviewTip(preview);
  return `<button type="button" id="wave-preview" class="${bosses.length?'boss-preview':''}" data-action="wave-preview" title="${esc(tip)}" aria-label="${esc(tip)}"${preview?'':' hidden'}><span>${bosses.length?'⚠ ':''}${esc(t(preview?.wave===1?'p6.firstWave':'p6.nextWave'))}</span>${(bosses.length?bosses:[preview?.minion??'rat']).map(id=>unitSticker(id,bosses.length?26:24)).join('')}</button><button type="button" id="early-wave-button" data-action="early-wave" title="${esc(t('p6.earlyTip',{food:early.bonusFood}))}" aria-label="${esc(t('p6.earlyTip',{food:early.bonusFood}))}"${early.allowed?'':' disabled hidden'}>${sceneSticker('ui_wave_horn','',30)}<b>+${early.bonusFood}</b>${sceneSticker('ui_fish_food','',20)}</button>`;
}
