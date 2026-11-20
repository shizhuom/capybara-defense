import {ledger} from './LedgerView';
import type {Profile} from '../core/types';
import {
  FACILITIES,FACILITY_IDS,PET_TAP_DAILY_LIMIT,VILLAGE_MAX_LEVEL,VILLAGE_MAX_STARS,VILLAGE_OFFLINE_CAP_MS,isFacilityId,
  type FacilityId,type VillageBuffKey,type VillageCost,
} from '../config/village';
import {
  buildFacility,canAffordVillage,claimOfflineHarvest,computeOfflineHarvest,facilityUpgradeCost,getVillageResidents,hasHarvest,
  localDay,petTapsLeft,petVillageResident,residentCapacity,settleVillageClock,villageLevel,villageStars,type VillageResident,type VillageResult,
} from '../core/VillageProgression';
import {HEROES} from '../config/heroes';
import {t} from '../i18n/i18n';
import {PET_QUOTE_COUNT} from '../i18n/p16';
import {escapeHtml as esc} from './art';
import {saveProfile} from './storage';
import type {SoundCue} from './SoundManager';
import {sceneSticker,unitSticker} from './stickers';

const tr=(key:string,vars?:Record<string,string|number>)=>esc(t(key,vars));
export type VillageTab='courtyard'|'build';
const tabs=['courtyard','build'] as const;
const percent=(value:number)=>Math.round(value*100);
const clock=(ms:number)=>{const minutes=Math.floor(ms/60_000);return `${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;};
/** Where each resident stands relative to its facility plot (percent of the panorama), by slot. */
const RESIDENT_OFFSETS:Record<FacilityId,readonly [number,number][]>={
  fac_bamboo_pool:[[-5,1],[5,2],[0,5]],fac_fish_stall:[[-12,9],[12,8],[0,13]],fac_yuzu_tree:[[11,8],[-12,9],[0,13]],
  fac_cat_nap:[[7,1],[-9,6],[1,9]],fac_sakura_pavilion:[[-11,9],[11,6],[0,12]],
};
/** Facility output and buff lines for one level, in display order. */
export function facilityLines(id:FacilityId,level:number):{output:string[];buffs:string[]} {
  const def=FACILITIES[id],i=Math.max(0,Math.min(2,level-1)),output=[t('p16.output.coins',{value:def.coinsPerHour[i]})];
  for(const [table,key] of [[def.fragmentEveryHours,'p16.output.fragment'],[def.yuzuEveryHours,'p16.output.yuzu'],[def.ticketEveryHours,'p16.output.ticket']] as const)
    if(table?.[i])output.push(t(key,{hours:table[i]}));
  if(def.residents)output.push(t('p16.output.residents',{value:def.residents[i]}));
  const buffs=(Object.entries(def.buffs) as [VillageBuffKey,readonly number[]][]).filter(([,values])=>values[i]).map(([key,values])=>
    t(`p16.buff.${key}`,{value:key==='startFood'||key==='startOranges'?values[i]:percent(values[i])}));
  return{output,buffs:buffs.length?buffs:[t('p16.buff.base')]};
}
export function villageCostChips(profile:Profile,cost:VillageCost):string {
  const chip=(icon:string,name:string,have:number,need:number)=>{if(!need)return '';const ready=have>=need,label=tr('p16.costLabel',{name,have,need});
    return `<span class="village-cost-chip ${ready?'is-ready':'is-short'}" title="${label}" aria-label="${label}"><span aria-hidden="true">${icon}</span><b aria-hidden="true">${have}/${need}</b></span>`;};
  return `<span class="village-cost-chips">${chip(sceneSticker('res_onsen_wood','',20),t('p16.wood'),profile.village.wood,cost.wood)}${chip(sceneSticker('res_yuzu_essence','',20),t('p16.essence'),profile.village.essence,cost.essence)}${chip(sceneSticker('ui_coin_gold','',20),t('profile.coins'),profile.coins,cost.coins)}</span>`;
}
export function villageMaterialsBadge(profile:Profile):string {
  const total=villageStars(profile),label=tr('p16.materials',{wood:profile.village.wood,essence:profile.village.essence,total});
  return `<span class="collection-badge village-materials-badge" title="${label}" aria-label="${label}"><span aria-hidden="true">${sceneSticker('res_onsen_wood','',18)}×${profile.village.wood} · ${sceneSticker('res_yuzu_essence','',18)}×${profile.village.essence} · ★${total}/${VILLAGE_MAX_STARS}</span></span>`;
}

export class VillageScreen {
  tab:VillageTab='courtyard';
  private focus:FacilityId|null=null;
  private feedback:{index:number;quote:string;coins:number;serial:number}|null=null;
  private serial=0;
  private timer?:ReturnType<typeof setTimeout>;
  private stamp='';
  constructor(private profile:()=>Profile,private commit:(profile:Profile)=>void,private render:()=>void,
    private notify:(key:string,error?:boolean,vars?:Record<string,string|number>)=>void,private onSound?:(cue:SoundCue)=>void,
    private now:()=>number=Date.now,private random:()=>number=Math.random){}

  get viewKey():string {return this.tab;}
  reset():void {this.tab='courtyard';this.focus=null;this.clearFeedback();}
  /** Re-anchors a basket whose clock jumped backwards, so it always starts filling again. */
  open():void {
    this.focus=null;this.clearFeedback();
    const settled=settleVillageClock(this.profile(),this.now());
    if(settled!==this.profile())this.persist(settled);
  }
  /** True when the displayed harvest has changed since the last render (checked every frame while open). */
  stale():boolean {return this.harvestStamp()!==this.stamp;}
  private harvestStamp():string {const h=computeOfflineHarvest(this.profile(),this.now());return `${Math.floor(h.elapsedMs/60_000)}:${h.coins}:${h.fragments}:${h.yuzu}:${h.tickets}`;}
  private clearFeedback():void {clearTimeout(this.timer);this.timer=undefined;this.feedback=null;}
  private persist(profile:Profile):boolean {
    if(!saveProfile(profile)){this.notify('hint.storage',true);return false;}
    this.commit(profile);return true;
  }
  private apply(result:VillageResult,cue:SoundCue):boolean {
    if(!result.ok){this.notify(result.key,true);return false;}
    if(!this.persist(result.profile))return false;
    this.notify(result.key);this.onSound?.(cue);return true;
  }
  action(action:string):boolean {
    if(!action.startsWith('village-'))return false;
    const [command,id='']=action.split(':');
    if(command==='village-tab'&&tabs.some(tab=>tab===id)){this.tab=id as VillageTab;if(id==='courtyard')this.focus=null;}
    else if(command==='village-focus'&&isFacilityId(id)){this.tab='build';this.focus=id;}
    else if(command==='village-build'&&isFacilityId(id)){const before=villageLevel(this.profile(),id);if(this.apply(buildFacility(this.profile(),id),before?'merge_hero':'shovel'))this.focus=id;}
    else if(command==='village-harvest'){
      const result=claimOfflineHarvest(this.profile(),this.now(),this.random);
      if(this.apply(result,'lottery_win')&&result.newWeapons.length)this.notify('m2.newWeapons');
    }
    else if(command==='village-pet')this.pet(Number(id));
    else return false;
    this.render();return true;
  }
  private pet(index:number):void {
    const resident=getVillageResidents(this.profile())[index];if(!resident)return;
    const result=petVillageResident(this.profile(),resident.id,localDay(new Date(this.now())));
    if(!result.ok){this.notify(result.key,true);return;}
    if(!this.persist(result.profile))return;
    this.onSound?.(result.coins?'treasure':'merge_upgrade');
    if(!result.coins)this.notify('p16.petFull');
    clearTimeout(this.timer);
    this.feedback={index,quote:t(`p16.quote.${Math.floor(Math.max(0,Math.min(.9999,this.random()))*PET_QUOTE_COUNT)}`),coins:result.coins,serial:++this.serial};
    this.timer=setTimeout(()=>{this.feedback=null;this.timer=undefined;this.render();},1900);
  }

  markup(inBattle=false,preparation=false):string {
    const profile=this.profile();this.stamp=this.harvestStamp();
    const body=this.tab==='build'?this.build(profile):this.courtyard(profile);
    return ledger('village',body,{profile,tabs:this.folderTabs(),badges:villageMaterialsBadge(profile),inBattle,preparation});
  }
  private folderTabs():string {
    return `<nav class="ledger-tabs meta-tabs village-tabs" role="tablist" aria-label="${tr('p5.notebookTabs')}">${tabs.map(tab=>`<button type="button" role="tab" data-action="village-tab:${tab}" aria-selected="${this.tab===tab}" aria-pressed="${this.tab===tab}" class="${this.tab===tab?'selected':''}">${tr(`p16.tab.${tab}`)}</button>`).join('')}</nav>`;
  }
  private residentMarkup(resident:VillageResident,index:number):string {
    const spot=FACILITIES[resident.facility].spot,[dx,dy]=RESIDENT_OFFSETS[resident.facility][Math.min(2,resident.slot)];
    const left=spot.left+dx,top=spot.top+dy,name=t(`${HEROES[resident.id]?'hero':'unit'}.${resident.id}`),fb=this.feedback?.index===index?this.feedback:null;
    const side=(left<30?' bubble-right':left>70?' bubble-left':'')+(top<50?' bubble-below':'');
    const bubble=fb?`<span class="village-pet-bubble${side}" role="status" data-serial="${fb.serial}"><span aria-hidden="true">${sceneSticker('ui_pet_heart','',34)}</span><span class="village-pet-quote">${esc(fb.quote)}</span>${fb.coins?`<b class="village-pet-coins">+${fb.coins}🪙</b>`:''}</span>`:'';
    const zzz=resident.pose==='nap'?`<span class="village-zzz" aria-hidden="true">${sceneSticker('ui_sleep_zzz','',40)}</span>`:'';
    return `<button type="button" class="village-pet pose-${resident.pose}${fb?' is-happy':''}" data-action="village-pet:${index}" data-pet-id="${resident.id}" style="left:${left}%;top:${top}%;--pet-delay:${(index*.37).toFixed(2)}s" aria-label="${tr('p16.petLabel',{name})}" title="${esc(name)}"><span class="village-pet-art" aria-hidden="true">${unitSticker(resident.id,64)}</span>${zzz}${bubble}</button>`;
  }
  private courtyard(profile:Profile):string {
    const residents=getVillageResidents(profile),day=localDay(new Date(this.now()));
    const spots=FACILITY_IDS.map(id=>{
      const level=villageLevel(profile,id),{left,top}=FACILITIES[id].spot,name=t(`facility.${id}`);
      return level
        ?`<button type="button" class="village-spot is-built spot-${id}" data-action="village-focus:${id}" style="left:${left}%;top:${top}%" aria-label="${esc(name)} Lv.${level}" title="${esc(name)}"><span class="village-spot-art" aria-hidden="true">${sceneSticker(id,'',256)}</span></button>`
        :`<button type="button" class="village-spot is-empty" data-action="village-focus:${id}" style="left:${left}%;top:${top}%" aria-label="${tr('p16.buildLabel',{name})}">${tr('p16.emptySpot',{name})}</button>`;
    }).join('');
    // Level tags float on their own layer so soaking or napping residents never hide them.
    const tags=FACILITY_IDS.map(id=>{const level=villageLevel(profile,id),{left,top}=FACILITIES[id].spot;
      return level?`<b class="village-level-tag" aria-hidden="true" style="left:${left}%;top:${top+6}%">${tr('p16.level',{level})}</b>`:'';}).join('');
    const h=computeOfflineHarvest(profile,this.now()),ready=hasHarvest(h);
    const preview=[[sceneSticker('ui_coin_gold','',22),`+${h.coins}`,h.coins],[sceneSticker('ui_weapon_fragment','',22),`×${h.fragments}`,h.fragments],[sceneSticker('ing_yuzu','',22),`×${h.yuzu}`,h.yuzu],[sceneSticker('ui_ticket_gacha','',22),`×${h.tickets}`,h.tickets]]
      .filter(([,, n],i)=>i===0||Number(n)>0).map(([icon,value])=>`<span class="village-preview-item">${icon}<b>${value}</b></span>`).join('');
    const harvest=`<section class="village-harvest-bar" aria-label="${tr('p16.harvestTitle')}"><span class="village-basket" aria-hidden="true">${sceneSticker('ui_harvest_basket','',60)}</span><div class="village-harvest-copy"><span class="village-harvest-head"><strong>${tr('p16.harvestTitle')}</strong><span class="village-harvest-time">${h.full?tr('p16.harvestFull'):tr('p16.harvestElapsed',{time:clock(h.elapsedMs)})}</span></span><span class="slim-progress village-harvest-progress" aria-hidden="true"><i style="width:${Math.round(h.elapsedMs/VILLAGE_OFFLINE_CAP_MS*1000)/10}%"></i></span><span class="village-harvest-preview">${preview}</span></div><button type="button" class="village-harvest-btn" data-action="village-harvest"${ready?'':' disabled'}>${tr(ready?'p16.harvestClaim':'p16.harvestWaiting')}</button></section>`;
    const status=`<p class="village-status"><span>${tr('p16.residents',{count:residents.length,max:residentCapacity(profile)})}</span><span>${tr('p16.petAllowance',{count:PET_TAP_DAILY_LIMIT-petTapsLeft(profile,day)})}</span></p>`;
    return `<div class="village-courtyard"><section class="village-diorama" aria-label="${tr('p16.diorama')}"><span class="village-diorama-bg" aria-hidden="true">${sceneSticker('bg_onsen_village','',1280)}</span>${spots}${tags}${residents.map((r,i)=>this.residentMarkup(r,i)).join('')}${status}</section>${harvest}</div>`;
  }
  private build(profile:Profile):string {
    return `<div class="storybook-list village-build-list">${FACILITY_IDS.map(id=>{
      const level=villageLevel(profile,id),cost=facilityUpgradeCost(id,level),name=t(`facility.${id}`),focused=this.focus===id;
      const now=facilityLines(id,level||1),next=level&&level<VILLAGE_MAX_LEVEL?facilityLines(id,level+1):null;
      const action=level>=VILLAGE_MAX_LEVEL?`<span class="village-maxed">${tr('p16.maxed')}</span>`
        :cost?`<button type="button" class="storybook-equip-btn village-build-btn ${level?'is-upgrade':''}" data-action="village-build:${id}"${canAffordVillage(profile,cost)?'':' disabled'} aria-label="${tr(level?'p16.upgradeLabel':'p16.buildLabel',{name,level:level+1})}">${tr(level?'p16.upgradeTo':'p16.build',{level:level+1})}</button>`:'';
      return `<article class="storybook-row-card village-row ${level?'built':'unbuilt'}${focused?' is-focused':''}" data-facility-id="${id}"${focused?' aria-current="true"':''}><span class="storybook-frame tone-village"><span${level?'':' class="unowned-art"'}>${sceneSticker(id,'',68)}</span></span><span class="storybook-copy"><strong class="portrait-name">${esc(name)} <b class="village-level${level?'':' is-locked'}">${level?tr('p16.level',{level}):tr('p16.notBuilt')}</b></strong><span class="storybook-meta">${now.output.map(esc).join(' · ')}</span><span class="storybook-tagline">${now.buffs.map(esc).join(' · ')}</span>${next?`<span class="village-next">${tr('p16.nextLevel')}：${esc([...next.output.slice(0,1),...next.buffs].join(' · '))}</span>`:''}${cost?villageCostChips(profile,cost):level?'':`<span class="village-free">${tr('p16.free')}</span>`}</span><span class="storybook-action-col">${action}</span></article>`;
    }).join('')}</div>`;
  }
}
