import {ledger} from './LedgerView';
import type {Profile} from '../core/types';
import {
  MEDALLION_IDS,MEDALLION_MAX_LEVEL,MEDALLION_TOTAL_MAX,armorPenetration,bossResist,bossSlayerMultiplier,breakthroughAttackMultiplier,
  capyShieldCooldown,isMedallionId,luckBonus,medallionUpgradeCost,momentumMultiplier,MOMENTUM_CAP,type MedallionId,
} from '../config/medallions';
import {getProfileMedallionLevel,profileMedallionTotal,upgradeMedallion,upgradeableMedallions} from '../core/MedallionProgression';
import {formatCompactNumber} from '../core/formatNumber';
import {t} from '../i18n/i18n';
import {escapeHtml as esc} from './art';
import {saveProfile} from './storage';
import type {SoundCue} from './SoundManager';
import {sceneSticker} from './stickers';

const tr=(key:string,vars?:Record<string,string|number>)=>esc(t(key,vars));
const trim=(value:number,digits:number)=>String(Number(value.toFixed(digits)));
const times=(value:number)=>`×${value>=100?formatCompactNumber(value):trim(value,value>=10?1:2)}`;
const pct=(value:number)=>`${trim(value*100,1)}%`;

/** Headline effect for one level, e.g. `×197`, `+35%`, `×3`, `45%`, `×3 / 45%`, `11.67s`. */
export function medallionEffectText(id:MedallionId,level:number):string {
  switch(id){
    case 'med_breakthrough_atk':return times(breakthroughAttackMultiplier(level));
    case 'med_luck_rate':return `+${pct(luckBonus(level))}`;
    case 'med_momentum':return times(momentumMultiplier(MOMENTUM_CAP,level));
    case 'med_boss_resist':return pct(bossResist(level));
    case 'med_boss_slayer':return `${times(bossSlayerMultiplier(level))} / ${pct(armorPenetration(level))}`;
    case 'med_capy_shield':{const seconds=capyShieldCooldown(level);return Number.isFinite(seconds)?t('p17.effect.seconds',{value:trim(seconds,2)}):t('p17.effect.none');}
  }
}
/** Crest / coin chips: green when affordable, cocoa when short. */
export function medallionCostChips(profile:Profile,cost:{crests:number;coins:number}):string {
  const chip=(icon:string,name:string,have:number,need:number)=>{const ready=have>=need,label=`${name} ${have}/${need}`;
    return `<span class="medallion-cost-chip ${ready?'is-ready':'is-short'}" title="${esc(label)}" aria-label="${esc(label)}"><span aria-hidden="true">${icon}</span><b aria-hidden="true">${formatCompactNumber(need)}</b></span>`;};
  return `<span class="medallion-cost-chips"><span class="medallion-cost-label">${tr('p17.cost')}</span>${chip(sceneSticker('ui_endless_crest','',20),t('p17.crests'),profile.endlessCrests,cost.crests)}${chip(sceneSticker('ui_coin_gold','',20),t('profile.coins'),profile.coins,cost.coins)}</span>`;
}
/** Header capsule: crests · coins · total level (clean single pill, no duplicate board link). */
export function medallionHeaderBadges(profile:Profile):string {
  const total=profileMedallionTotal(profile);
  return `<span class="collection-badge medallion-wallet" aria-label="${tr('p17.crests')} ${profile.endlessCrests} · ${tr('profile.coins')} ${profile.coins} · ${tr('p17.totalLevel',{sum:total,max:MEDALLION_TOTAL_MAX})}"><span aria-hidden="true">${sceneSticker('ui_endless_crest','',20)}×${formatCompactNumber(profile.endlessCrests)}</span><span aria-hidden="true">${sceneSticker('ui_coin_gold','',20)}${formatCompactNumber(profile.coins)}</span><span aria-hidden="true">${tr('p17.totalLevel',{sum:total,max:MEDALLION_TOTAL_MAX})}</span></span>`;
}
/** Shared 2-tab bar for the dedicated Endless Hall window (`[ 无尽勋章 | 无尽全球榜 ]`). */
export function endlessHubTabs(active:'medallions'|'endless-board'):string {
  return `<nav class="ledger-tabs meta-tabs medallion-tabs" role="tablist" aria-label="${tr('p5.notebookTabs')}"><button type="button" role="tab" data-action="medallions" aria-selected="${active==='medallions'}" aria-pressed="${active==='medallions'}" class="${active==='medallions'?'selected':''}">${tr('p17.title')}</button><button type="button" role="tab" data-action="endless-board" aria-selected="${active==='endless-board'}" aria-pressed="${active==='endless-board'}" class="${active==='endless-board'?'selected':''}">${tr('p11.tab.endless-board')}</button></nav>`;
}

export class MedallionScreen {
  private focus:MedallionId|null=null;
  constructor(private profile:()=>Profile,private commit:(profile:Profile)=>void,private render:()=>void,
    private notify:(key:string,error?:boolean,vars?:Record<string,string|number>)=>void,private onSound?:(cue:SoundCue)=>void){}
  get viewKey():string {return 'medallions';}
  open():void {this.focus=null;}
  action(action:string):boolean {
    if(!action.startsWith('medallion-up:'))return false;
    const id=action.slice('medallion-up:'.length);
    if(!isMedallionId(id))return false;
    const result=upgradeMedallion(this.profile(),id);this.focus=id;
    if(!result.ok){this.notify(result.key,true);this.render();return true;}
    if(!saveProfile(result.profile)){this.notify('hint.storage',true);return true;}
    this.commit(result.profile);
    const level=result.level??0;
    this.onSound?.(level===25||level===40||level===MEDALLION_MAX_LEVEL?'merge_hero':'merge_upgrade');
    this.notify(result.key,false,{name:t(`medallion.${id}`),level});
    this.render();return true;
  }
  markup(inBattle=false,preparation=false):string {
    const profile=this.profile(),ready=new Set(upgradeableMedallions(profile));
    const rows=MEDALLION_IDS.map(id=>{
      const level=getProfileMedallionLevel(profile,id),cost=medallionUpgradeCost(level),max=level>=MEDALLION_MAX_LEVEL,name=t(`medallion.${id}`);
      const now=medallionEffectText(id,level),next=max?'':medallionEffectText(id,level+1),progress=Math.round(level/MEDALLION_MAX_LEVEL*1000)/10;
      const button=max?`<b class="medallion-maxed">${tr('p17.maxed')}</b>`
        // Short rows stay clickable so the toast can explain what is missing.
        :`<button type="button" class="storybook-equip-btn medallion-up${ready.has(id)?' is-ready':' is-short'}" data-action="medallion-up:${id}"${ready.has(id)?'':' aria-disabled="true"'} aria-label="${tr('p17.upgrade')} ${esc(name)}">${tr('p17.upgrade')}</button>`;
      return `<article class="storybook-row-card medallion-row${max?' is-max':''}${ready.has(id)?' is-ready':''}${this.focus===id?' is-focused':''}" data-medallion-id="${id}" role="listitem"><span class="storybook-frame tone-medallion"><span aria-hidden="true">${sceneSticker(id,'',68)}</span></span><span class="storybook-copy"><strong class="portrait-name">${esc(name)} <b class="medallion-level-tag">${tr('p17.level',{level,max:MEDALLION_MAX_LEVEL})}</b></strong><span class="storybook-tagline medallion-effect">${tr(`medallion.${id}.desc`)}<span class="medallion-values"><b class="medallion-now">${esc(now)}</b>${max?'':`<i aria-hidden="true">→</i><b class="medallion-next">${esc(next)}</b>`}</span></span><span class="slim-progress medallion-progress" role="progressbar" aria-label="${esc(name)} ${tr('p17.level',{level,max:MEDALLION_MAX_LEVEL})}" aria-valuemin="0" aria-valuemax="${MEDALLION_MAX_LEVEL}" aria-valuenow="${level}"><i style="width:${progress}%"></i></span>${cost?medallionCostChips(profile,cost):''}</span><span class="storybook-action-col">${button}</span></article>`;
    }).join('');
    const body=`<p class="medallion-endless-note"><span aria-hidden="true">${sceneSticker('ui_endless_emblem','',26)}</span><span>${tr('p17.endlessOnly')}</span></p><div class="storybook-list medallion-list" role="list" aria-label="${tr('p17.title')}">${rows}</div>`;
    return ledger('medallions',body,{profile,tabs:endlessHubTabs('medallions'),badges:medallionHeaderBadges(profile),inBattle,preparation});
  }
}
