import {ledger} from './LedgerView';
import type {Profile} from '../core/types';
import {
  BROTHS,BROTH_IDS,INGREDIENTS,INGREDIENT_BASKET_PRICE,INGREDIENT_BASKET_SIZE,INGREDIENT_IDS,WHOLE_NUMBER_EFFECTS,
  getKitchenCollectionAura,isBrothId,type BrothEffectKey,type BrothId,type BrothLevel,type IngredientCost,type IngredientId,
} from '../config/kitchen';
import {
  brewBroth,buyIngredientBasket,canAffordIngredients,equipBroth,getBrothLevel,getBrothUpgradeCost,upgradeBroth,type KitchenResult,
} from '../core/KitchenProgression';
import {t} from '../i18n/i18n';
import {escapeHtml as esc} from './art';
import {saveProfile} from './storage';
import type {SoundCue} from './SoundManager';
import {sceneSticker} from './stickers';

const tr=(key:string,vars?:Record<string,string|number>)=>esc(t(key,vars));
export type KitchenTab='broths'|'pantry';
const tabs=['broths','pantry'] as const;
const percent=(value:number)=>Math.round(value*1000)/10;

/** Display values for one broth level: ratios as percentages, counts and cells as-is. */
export function brothEffectVars(id:BrothId,level:BrothLevel):Record<string,number> {
  const vars:Record<string,number>={};
  for(const [key,values] of Object.entries(BROTHS[id].effects) as [BrothEffectKey,readonly number[]][]){
    const value=values[level-1];
    vars[key]=key==='rangedRange'||WHOLE_NUMBER_EFFECTS.includes(key)?value:percent(value);
  }
  return vars;
}
export const brothEffectText=(id:BrothId,level:BrothLevel)=>t(`broth.${id}.effect`,brothEffectVars(id,level));
/** `配方 n/12 · 全员攻击 +d% 攻速 +s%` from the permanent collection aura. */
export function kitchenAuraText(profile:Partial<Pick<Profile,'unlockedBroths'|'brothLevels'>>):string {
  const aura=getKitchenCollectionAura(profile);
  return t('p14.collection',{count:aura.unlockedCount,damage:percent(aura.damageBonus),rate:percent(aura.rateBonus)});
}
const owned=(profile:Profile,id:IngredientId)=>profile.ingredients?.[id]??0;
export function ingredientChips(profile:Profile,cost:IngredientCost):string {
  return `<span class="kitchen-cost-chips">${(Object.entries(cost) as [IngredientId,number][]).map(([id,need])=>{
    const have=owned(profile,id),ready=have>=need,label=tr('p14.costOwned',{name:t(`ingredient.${id}`),owned:have,need});
    return `<span class="kitchen-cost-chip ${ready?'is-ready':'is-short'}" title="${label}" aria-label="${label}"><span aria-hidden="true">${sceneSticker(id,'',20)}</span><b aria-hidden="true">${have}/${need}</b></span>`;
  }).join('')}</span>`;
}

export class KitchenScreen {
  tab:KitchenTab='broths';
  private detailId:BrothId|null=null;
  private gained:IngredientId[]=[];
  constructor(private profile:()=>Profile,private commit:(profile:Profile)=>void,private render:()=>void,
    private notify:(key:string,error?:boolean,vars?:Record<string,string|number>)=>void,private onSound?:(cue:SoundCue)=>void){}

  /** Each tab and detail sheet keeps its own scroll position. */
  get viewKey():string {return `${this.tab}:${this.detailId??'list'}`;}
  get detail():BrothId|null {return this.detailId;}
  reset():void {this.tab='broths';this.detailId=null;this.gained=[];}
  open():void {this.detailId=null;this.gained=[];}

  private persist(profile:Profile):boolean {
    if(!saveProfile(profile)){this.notify('hint.storage',true);return false;}
    this.commit(profile);return true;
  }
  private apply(result:KitchenResult,cue:SoundCue):boolean {
    if(!result.ok){this.notify(result.key,true);return false;}
    if(!this.persist(result.profile))return false;
    this.notify(result.key);this.onSound?.(cue);return true;
  }
  action(action:string):boolean {
    if(!action.startsWith('kitchen-'))return false;
    const [command,id='']=action.split(':');
    if(command==='kitchen-tab'&&tabs.some(tab=>tab===id)){this.tab=id as KitchenTab;this.detailId=null;}
    else if(command==='kitchen-dish'&&isBrothId(id)){this.tab='broths';this.detailId=id;}
    else if(command==='kitchen-back')this.detailId=null;
    else if(command==='kitchen-prev'||command==='kitchen-next')this.step(command==='kitchen-prev'?-1:1);
    else if(command==='kitchen-brew')this.apply(brewBroth(this.profile(),id),'merge_hero');
    else if(command==='kitchen-upgrade')this.apply(upgradeBroth(this.profile(),id),'merge_hero');
    else if(command==='kitchen-equip'&&isBrothId(id))this.apply(equipBroth(this.profile(),id),'hit_heavy');
    else if(command==='kitchen-unequip')this.apply(equipBroth(this.profile(),null),'hit_heavy');
    else if(command==='kitchen-basket'){
      const result=buyIngredientBasket(this.profile(),Math.random);
      if(this.apply(result,'lottery_win'))this.gained=result.gained??[];
    }
    else return false;
    this.render();return true;
  }
  private step(delta:-1|1):void {
    if(!this.detailId)return;
    const index=BROTH_IDS.indexOf(this.detailId);
    this.detailId=BROTH_IDS[(index+delta+BROTH_IDS.length)%BROTH_IDS.length];
  }

  markup(inBattle=false,preparation=false):string {
    const profile=this.profile();
    const body=this.tab==='pantry'?this.pantry(profile):this.detailId?this.dishDetail(profile,this.detailId):this.broths(profile);
    const badge=`<span class="collection-badge kitchen-aura-badge">${sceneSticker('ui_kitchen_pot','',18)} ${esc(kitchenAuraText(profile))}</span>`;
    return ledger('kitchen',body,{profile,tabs:this.folderTabs(),badges:badge,inBattle,preparation});
  }
  private folderTabs():string {
    return `<nav class="ledger-tabs meta-tabs kitchen-tabs" role="tablist" aria-label="${tr('p5.notebookTabs')}">${tabs.map(tab=>`<button type="button" role="tab" data-action="kitchen-tab:${tab}" aria-selected="${this.tab===tab}" aria-pressed="${this.tab===tab}" class="${this.tab===tab?'selected':''}">${tr(`p14.tab.${tab}`)}</button>`).join('')}</nav>`;
  }
  private activeStrip(profile:Profile):string {
    const id=profile.activeBrothId,level=id&&isBrothId(id)?getBrothLevel(profile,id):0;
    if(!id||!isBrothId(id)||!level)return `<section class="kitchen-active-strip is-empty" aria-label="${tr('p14.activeTitle')}"><span class="kitchen-active-art" aria-hidden="true">${sceneSticker('ui_kitchen_pot','',52)}</span><div class="kitchen-active-copy"><small>${tr('p14.activeTitle')}</small><p>${tr('p14.activeEmpty')}</p></div></section>`;
    const name=t(`broth.${id}`);
    return `<section class="kitchen-active-strip" aria-label="${tr('p14.activeTitle')}" style="--broth-color:${BROTHS[id].bathColor}"><span class="kitchen-active-art" aria-hidden="true">${sceneSticker(id,'',52)}</span><div class="kitchen-active-copy"><small>${tr('p14.activeTitle')}</small><strong>${esc(name)} <b class="kitchen-level">${tr('p14.level',{level})}</b></strong><span>${esc(brothEffectText(id,level as BrothLevel))}</span></div><button type="button" class="kitchen-unequip" data-action="kitchen-unequip" aria-label="${tr('p14.unequipLabel',{name})}">${tr('p14.unequip')}</button></section>`;
  }
  private rowAction(profile:Profile,id:BrothId,level:number):string {
    const name=t(`broth.${id}`),cost=getBrothUpgradeCost(id,level),affordable=!!cost&&canAffordIngredients(profile,cost);
    if(!level)return affordable
      ?`<button type="button" class="storybook-equip-btn kitchen-brew-btn" data-action="kitchen-brew:${id}" aria-label="${tr('p14.brewLabel',{name})}">${tr('p14.brew')}</button>`
      :`<span class="kitchen-short-label">${tr('p14.missing')}</span>`;
    const active=profile.activeBrothId===id;
    const upgrade=affordable?`<button type="button" class="kitchen-upgrade-tag" data-action="kitchen-dish:${id}" aria-label="${tr('p14.viewDish',{name})}">${tr('p14.canUpgrade')}</button>`:'';
    return `<button type="button" class="storybook-equip-btn kitchen-equip-btn ${active?'equipped':''}" data-action="kitchen-equip:${id}" aria-pressed="${active}" aria-label="${tr(active?'p14.activeLabel':'p14.equipLabel',{name})}">${tr(active?'p14.active':'p14.equip')}</button>${upgrade}`;
  }
  private broths(profile:Profile):string {
    return `${this.activeStrip(profile)}<div class="storybook-list kitchen-broth-list" aria-label="${tr('p14.list')}">${BROTH_IDS.map(id=>{
      const level=getBrothLevel(profile,id),active=profile.activeBrothId===id,cost=getBrothUpgradeCost(id,level),def=BROTHS[id];
      const status=level?`<b class="kitchen-level">${tr('p14.level',{level})}</b>`:`<b class="kitchen-level is-locked">${tr('p14.locked')}</b>`;
      return `<article class="storybook-row-card kitchen-row tier-${def.tier} ${level?'unlocked':'locked'} ${active?'is-active':''}" data-broth-id="${id}" style="--broth-color:${def.bathColor}"><button type="button" class="kitchen-row-open" data-action="kitchen-dish:${id}" aria-label="${tr('p14.viewDish',{name:t(`broth.${id}`)})}"><span class="storybook-frame tone-kitchen ${active?'is-active':''}"><span${level?'':' class="unowned-art"'}>${sceneSticker(id,'',68)}</span></span><span class="storybook-copy"><strong class="portrait-name">${tr(`broth.${id}`)} ${status}</strong><span class="storybook-meta">${tr('p14.tier',{tier:def.tier})} · ${tr(`broth.${id}.style`)}</span><span class="storybook-tagline">${esc(brothEffectText(id,(level||1) as BrothLevel))}</span>${cost?ingredientChips(profile,cost):`<span class="kitchen-mastered">★ ${tr('p14.mastered')}</span>`}</span></button><span class="storybook-action-col">${this.rowAction(profile,id,level)}</span></article>`;
    }).join('')}</div>`;
  }
  private dishDetail(profile:Profile,id:BrothId):string {
    const def=BROTHS[id],level=getBrothLevel(profile,id),index=BROTH_IDS.indexOf(id),name=t(`broth.${id}`),active=profile.activeBrothId===id;
    const ladder=([1,2,3] as const).map(step=>`<li class="kitchen-ladder-step ${level===step?'is-current':''} ${level>=step?'is-reached':''}"><span class="kitchen-ladder-head"><b>${tr('p14.level',{level:step})}</b><span>${tr(`p14.level.${step}`)}</span>${level>=step?sceneSticker('ui_storybook_check','',20):''}</span><span class="kitchen-ladder-effect">${esc(brothEffectText(id,step))}</span>${level<step?ingredientChips(profile,def.costs[step-1]):''}</li>`).join('');
    const cost=getBrothUpgradeCost(id,level),affordable=!!cost&&canAffordIngredients(profile,cost);
    const primary=!level
      ?`<button type="button" class="storybook-equip-btn kitchen-brew-btn kitchen-primary" data-action="kitchen-brew:${id}"${affordable?'':' disabled'}>${tr('p14.brew')}</button>`
      :`${cost?`<button type="button" class="storybook-equip-btn kitchen-upgrade-btn kitchen-primary" data-action="kitchen-upgrade:${id}"${affordable?'':' disabled'}>${tr('p14.upgradeTo',{level:level+1})}</button>`:`<span class="kitchen-mastered">★ ${tr('p14.mastered')}</span>`}<button type="button" class="storybook-equip-btn kitchen-equip-btn ${active?'equipped':''}" data-action="kitchen-equip:${id}" aria-pressed="${active}">${tr(active?'p14.currentActive':'p14.equipToday')}</button>`;
    const missing=cost?(Object.entries(cost) as [IngredientId,number][]).filter(([ing,need])=>owned(profile,ing)<need).map(([ing])=>ing):[];
    const sources=missing.length?`<section class="kitchen-source-hint"><h4>${tr('p14.sourceHint')}</h4><ul>${missing.map(ing=>`<li>${sceneSticker(ing,'',34)}<span><b>${tr(`ingredient.${ing}`)}</b><small>${tr(`ingredient.${ing}.source`)}</small></span></li>`).join('')}</ul></section>`:'';
    return `<div class="compendium-detail-bar"><button type="button" data-action="kitchen-back">${tr('p14.back')}</button><div><button type="button" data-action="kitchen-prev">◀ ${tr('p14.previous')}</button><span aria-live="polite">${index+1} / ${BROTH_IDS.length}</span><button type="button" data-action="kitchen-next">${tr('p14.next')} ▶</button></div></div><article class="storybook-detail-sheet kitchen-detail-sheet tier-${def.tier}" data-detail-broth-id="${id}" tabindex="-1" style="--broth-color:${def.bathColor}"><div class="storybook-detail-showcase"><span class="storybook-frame tone-kitchen ${active?'is-active':''}"><span${level?'':' class="unowned-art"'}>${sceneSticker(id,'',116)}</span></span><h3>${esc(name)}</h3><span class="kitchen-detail-tags"><span>${tr('p14.tier',{tier:def.tier})}</span><span>${tr(`broth.${id}.style`)}</span><span>${level?tr('p14.level',{level}):tr('p14.locked')}</span></span><p class="kitchen-story">${tr(`broth.${id}.story`)}</p></div><section class="kitchen-ladder" aria-label="${tr('p14.ladder')}"><h4>${tr('p14.ladder')}</h4><ol>${ladder}</ol></section><div class="kitchen-detail-actions">${primary}</div>${sources}</article>`;
  }
  private pantry(profile:Profile):string {
    const rows=INGREDIENT_IDS.map(id=>{
      const count=owned(profile,id);
      return `<article class="storybook-row-card kitchen-ingredient-row rarity-${INGREDIENTS[id].rarity} ${count?'owned':'unowned'}" data-ingredient-id="${id}"><span class="storybook-frame tone-kitchen"><span${count?'':' class="unowned-art"'}>${sceneSticker(id,'',60)}</span></span><span class="storybook-copy"><strong class="portrait-name">${tr(`ingredient.${id}`)}</strong><span class="storybook-tagline">${tr(`ingredient.${id}.flavor`)}</span><span class="storybook-meta kitchen-source">${tr(`ingredient.${id}.source`)}</span></span><span class="kitchen-stock" aria-label="${tr('p14.stock')} ${count}"><small>${tr('p14.stock')}</small><b>×${count}</b></span></article>`;
    }).join('');
    const gained=this.gained.length?`<div class="kitchen-basket-result" role="status"><p>${tr('p14.basketGot')}</p><ul>${this.gained.map(id=>`<li>${sceneSticker(id,'',52)}<span>${tr(`ingredient.${id}`)}</span></li>`).join('')}</ul></div>`:'';
    const poor=profile.coins<INGREDIENT_BASKET_PRICE;
    return `<div class="storybook-list kitchen-pantry-list" aria-label="${tr('p14.pantryList')}">${rows}</div><section class="kitchen-basket-card"><div class="kitchen-basket-heading"><span class="storybook-frame tone-kitchen" aria-hidden="true">${sceneSticker('ui_kitchen_pot','',64)}</span><div class="storybook-copy"><h3 class="portrait-name">${tr('p14.basketTitle')}</h3><p class="storybook-tagline">${tr('p14.basketBody')}</p></div></div>${gained}<div class="kitchen-basket-buy"><button type="button" class="storybook-equip-btn kitchen-basket-btn" data-action="kitchen-basket"${poor?' disabled':''}>${tr('p14.basketBuy',{price:INGREDIENT_BASKET_PRICE,count:INGREDIENT_BASKET_SIZE})}</button><small>${sceneSticker('ui_coin_gold','',18)} ${tr('p14.coins',{coins:profile.coins})}</small></div></section>`;
  }
}
