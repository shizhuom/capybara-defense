import { HEROES } from '../config/heroes';
import { RECIPES } from '../config/recipes';
import { ENEMIES } from '../config/enemies';
import { UNITS } from '../config/units';
import { getBaseUnitStats, getBeeProduction } from '../core/UnitStats';
import { HERO_FAMILIES, RARITY_RULES, WEAPONS } from '../config/weapons';
import { PROPS } from '../config/props';
import type { Profile } from '../core/types';
import { t } from '../i18n/i18n';
import { weaponSticker } from '../render/M3Art';
import { propSticker, sceneSticker, unitSticker } from './stickers';
import { escapeHtml as esc } from './art';

export const COMPENDIUM_TABS = ['matrix','pets','heroes','bosses','weapons','props'] as const;
export type CompendiumTab = typeof COMPENDIUM_TABS[number];
const tr=(key:string,vars?:Record<string,string|number>)=>esc(t(key,vars));
const counts={matrix:12,pets:19,heroes:12,bosses:17,weapons:36,props:20};
const num=(n:number)=>Number(n.toFixed(4));
const name=(kind:string)=>tr(`${HEROES[kind]?'hero':ENEMIES[kind]?(ENEMIES[kind].boss?'boss':'enemy'):'unit'}.${kind}`);
const sticker=(kind:string,size:number)=>`<span class="book-sticker" role="img" aria-label="${name(kind)}"><span aria-hidden="true">${unitSticker(kind,size)}</span></span>`;
const equation=(parts:readonly string[],hero:string)=>`${parts.map(part=>sticker(part,30)).join('<b>＋</b>')}<b>→</b>${sticker(hero,34)}<span>${name(hero)}</span>`;
const tabArt=(tab:CompendiumTab)=>tab==='matrix'?sceneSticker('ui_compendium_book','',28):tab==='weapons'?weaponSticker('m10_bamboo_staff',28):tab==='props'?propSticker('washer',28):sticker(tab==='pets'?'hamster':tab==='heroes'?'kungfu_po':'husky_wrecker',28);
function statPills(kind:string):string {
  const s=getBaseUnitStats(kind,1);
  return `<div class="book-stat-pills"><span title="${tr('p3.damage')}">⚔️ ${num(s.damage)}</span><span title="${tr('p3.rate')}">⚡ ${num(s.rate)}/s</span><span title="${tr('p3.range')}">🎯 ${num(s.range)}</span>${HEROES[kind]?`<span title="${tr('p3.charge')}">🔋 ${s.charge}</span>`:''}</div>`;
}
function growth(kind:string):string {
  const max=HEROES[kind]?5:UNITS[kind].maxLevel;
  return `<table class="book-growth"><caption>${tr('p3.growth')}</caption><thead><tr><th scope="col">${tr('p3.levelHeading')}</th><th scope="col">${tr(kind==='bee'?'p3.production':'p3.damage')}</th>${kind==='bee'?'':`<th scope="col">${tr('p3.rate')}</th><th scope="col">${tr('p3.range')}</th>${HEROES[kind]?`<th scope="col">${tr('p3.charge')}</th>`:''}`}</tr></thead><tbody>${[1,2,3,4,5].map(l=>{
    const heading=`<th scope="row">${tr('p3.level',{level:l})}</th>`;
    if(l>max)return `<tr data-growth-unavailable="${l}">${heading}<td colspan="${kind==='bee'?1:3}">${tr('p3.unavailable')}</td></tr>`;
    const s=getBaseUnitStats(kind,l),bee=getBeeProduction(l);
    return `<tr>${heading}${kind==='bee'?`<td>${tr('p3.productionValue',bee)}</td>`:`<td>${num(s.damage)}</td><td>${num(s.rate)}</td><td>${num(s.range)}</td>${HEROES[kind]?`<td>${s.charge}</td>`:''}`}</tr>`;
  }).join('')}</tbody></table>`;
}
function heroWeapons(kind:string):string {
  const all=Object.values(WEAPONS),signature=all.find(w=>w.signatureHero===kind)!;
  const recommendations=all.filter(w=>w.family===HERO_FAMILIES[kind]&&w.id!==signature.id).slice(0,2);
  return `<div class="hero-weapon-previews">${[signature,...recommendations].map((w,i)=>`<div data-weapon-role="${i?'recommendation':'signature'}"><span aria-hidden="true">${weaponSticker(w.id,40)}</span><span><b>${tr(i?'p3.recommendation':'p3.signature')}</b><br/>${tr(`weapon.${w.id}`)}</span></div>`).join('')}</div>`;
}
export class Compendium {
  tab:CompendiumTab='matrix';
  private selectedHero='kungfu_po';
  private selectedPet='hamster';
  private focusedKind='';
  select(tab:string):boolean {
    if(!COMPENDIUM_TABS.includes(tab as CompendiumTab))return false;
    this.tab=tab as CompendiumTab;this.focusedKind='';return true;
  }
  openTo(kind:string):void {
    if(Object.hasOwn(HEROES,kind)){this.tab='heroes';this.selectedHero=kind;}
    else if(Object.hasOwn(UNITS,kind)){this.tab='pets';this.selectedPet=kind;}
    else return;
    this.focusedKind=kind;
  }
  selectHero(kind:string):void {
    if(!Object.hasOwn(HEROES,kind))return;
    this.tab='matrix';this.selectedHero=kind;this.focusedKind=kind;
  }
  private entry(kind:string):string {return `data-compendium-kind="${kind}"${this.focusedKind===kind?' data-compendium-focused="true"':''} tabindex="-1"`;}
  private heroDetail(kind:string):string {
    const hero=HEROES[kind],recipe=RECIPES.find(r=>r.hero===kind)!;
    return `<article class="encyclopedia-card" ${this.entry(kind)}><div class="book-heading">${sticker(kind,72)}<h4>${name(kind)}</h4></div><div class="recipe-equation">${equation(recipe.parts,kind)}</div>${statPills(kind)}${growth(kind)}<p><b>${tr(`skill.${kind}`)}</b> · ${tr(`skill.${kind}.desc`,{charge:hero.charge})}</p></article>`;
  }
  private matrix():string {
    const hats=['hat_bamboo','hat_shades','hat_wizard'];
    return `<div class="compendium-split"><div><table class="merge-matrix"><caption>${tr('p3.matrix')}</caption><thead><tr><td></td>${hats.map(h=>`<th scope="col">${sticker(h,42)}<span>${name(h)}</span></th>`).join('')}</tr></thead><tbody>${['panda','cat','shiba'].map(p=>`<tr><th scope="row">${sticker(p,42)}<span>${name(p)}</span></th>${hats.map(h=>{
      const recipe=RECIPES.find(r=>r.parts[0]===p&&r.parts[1]===h);
      return `<td data-matrix-cell="${p}:${h}">${recipe?`<button type="button" data-action="compendium-hero:${recipe.hero}" aria-pressed="${this.selectedHero===recipe.hero}">${sticker(recipe.hero,64)}<span>${name(recipe.hero)}</span></button>`:`<span class="locked-pair">🔒 ${tr('p3.lockedPair')}</span>`}</td>`;
    }).join('')}</tr>`).join('')}</tbody></table><h3>${tr('p3.special')}</h3><div class="special-recipes">${RECIPES.slice(8).map(r=>`<button type="button" data-special-recipe="${r.hero}" data-action="compendium-hero:${r.hero}" aria-pressed="${this.selectedHero===r.hero}" class="recipe-equation">${equation(r.parts,r.hero)}</button>`).join('')}</div></div><div class="compendium-detail" aria-live="polite">${this.heroDetail(this.selectedHero)}</div></div>`;
  }
  private pets():string {
    const kind=this.selectedPet,definition=UNITS[kind];
    const detail=`<article class="encyclopedia-card" ${this.entry(kind)}><div class="book-heading">${sticker(kind,72)}<h4>${name(kind)}</h4></div>${kind==='shovel'?`<p>${tr('inspect.toolBody')}</p>`:`${kind==='bee'?'':statPills(kind)}<p>${tr(definition.category==='basic'?'p3.drawBasic':'p3.drawComponent')}</p>${growth(kind)}${definition.category==='component'?RECIPES.filter(r=>(r.parts as readonly string[]).includes(kind)).map(r=>`<button type="button" class="recipe-equation" data-action="compendium-hero:${r.hero}">${equation(r.parts,r.hero)}</button>`).join(''):''}${['shiba','hat_wizard'].includes(kind)?`<p class="locked-pair">${tr('p3.lockedPair')}</p>`:''}`}</article>`;
    return `<div class="compendium-split"><div>${(['basic','component'] as const).map(category=>`<h3>${tr(category==='basic'?'p3.basics':'p3.components')}</h3><div class="pet-catalog">${Object.values(UNITS).filter(u=>u.category===category).map(u=>`<article class="encyclopedia-card" data-entry="${u.id}" data-compendium-kind="${u.id}"><button type="button" data-action="inspect-book:${u.id}" aria-pressed="${kind===u.id}">${sticker(u.id,48)}<span>${name(u.id)}</span></button></article>`).join('')}</div>`).join('')}</div><div class="compendium-detail" aria-live="polite">${detail}</div></div>`;
  }
  markup(profile:Profile):string {
    const header=`<button type="button" class="dialog-close icon-button" data-action="close-recipes" aria-label="${tr('recipe.close')}">×</button><span class="eyebrow">${tr('p1.bookEyebrow')}</span><h2 id="dialog-title">${tr('p1.encyclopedia')}</h2><p class="dialog-subtitle">${tr('p1.bookSubtitle')}</p><div class="encyclopedia-tabs" role="tablist" aria-label="${tr('p1.encyclopedia')}">${COMPENDIUM_TABS.map(tab=>`<button type="button" role="tab" id="book-tab-${tab}" aria-selected="${tab===this.tab}" aria-controls="book-content" data-action="book:${tab}"><span aria-hidden="true">${tabArt(tab)}</span><span>${tr(`p3.${tab}`)} <b>${counts[tab]}</b></span></button>`).join('')}</div>`;
    let cards='';
    if(this.tab==='matrix')cards=this.matrix();
    if(this.tab==='pets')cards=this.pets();
    if(this.tab==='heroes') cards=RECIPES.map(recipe=>{
      const hero=HEROES[recipe.hero],collected=profile.mergedHeroes.includes(hero.id);
      return `<article class="recipe-card encyclopedia-card${collected?' collected':''}" data-entry="${hero.id}" ${this.entry(hero.id)}><div class="book-heading">${sticker(hero.id,62)}<div><small>${tr(`m2.family.${HERO_FAMILIES[hero.id]}`)}</small><h4>${tr(`hero.${hero.id}`)}</h4><b class="collection-state">${tr(collected?'p1.collected':'p1.notCollected')}</b></div></div><div class="recipe-equation">${equation(recipe.parts,hero.id)}</div>${statPills(hero.id)}${growth(hero.id)}<p><strong>${tr(`skill.${hero.id}`)}</strong> · ${tr(`skill.${hero.id}.desc`,{charge:hero.charge})}</p>${heroWeapons(hero.id)}</article>`;
    }).join('');
    if(this.tab==='bosses') cards=Object.values(ENEMIES).map(e=>`<article class="encyclopedia-card boss-card" data-entry="${e.id}" ${this.entry(e.id)}><div class="book-heading">${sticker(e.id,62)}<h4>${name(e.id)}</h4></div><p class="book-stats">${tr('p3.enemyStats',{hp:e.hp,speed:e.speed,armor:Math.round(e.armor*100)})}</p>${e.boss?`<p>${tr('p1.cooldown',{time:e.interval})}</p>`:''}<p>${tr(e.boss?`p1.boss.${e.id}.mechanic`:`p3.minion.${e.id}.mechanic`)}</p><aside><b>${tr('p1.counter')}</b><p>${tr(e.boss?`p1.boss.${e.id}.tip`:`p3.minion.${e.id}.tip`)}</p></aside></article>`).join('');
    if(this.tab==='weapons') cards=Object.values(WEAPONS).map(weapon=>`<article class="encyclopedia-card rarity-${weapon.rarity}" data-entry="${weapon.id}" ${this.entry(weapon.id)}><div class="book-heading"><span aria-hidden="true">${weaponSticker(weapon.id,62)}</span><div><small>${tr(`m2.rarity.${weapon.rarity}`)} · ${tr(`m2.family.${weapon.family}`)}</small><h4>${tr(`weapon.${weapon.id}`)}</h4><b class="collection-state">${tr(profile.unlockedWeapons.includes(weapon.id)?'p1.unlocked':'p1.locked')}</b></div></div><p class="book-stats">${tr('p1.unlock',{count:RARITY_RULES[weapon.rarity].fragments})} · ${tr('m2.damage',{value:Math.round(RARITY_RULES[weapon.rarity].damageBonus*100)})}</p><p>${tr(`weapon.${weapon.id}.desc`)}</p>${weapon.signatureHero?`<aside>${tr('m2.signature',{hero:t(`hero.${weapon.signatureHero}`)})}</aside>`:''}</article>`).join('');
    if(this.tab==='props') cards=Object.values(PROPS).map(prop=>`<article class="encyclopedia-card rarity-${prop.rarity}" data-entry="${prop.id}" ${this.entry(prop.id)}><div class="book-heading"><span aria-hidden="true">${propSticker(prop.id,62)}</span><div><small>${tr(`m2.${prop.type}`)} · ${tr('p1.price',{price:prop.price})}</small><h4>${tr(`prop.${prop.id}`)}</h4></div></div><p class="book-stats">${tr(prop.type==='active'?'p1.cooldown':'p1.auto',{time:prop.cooldown})}</p><p>${tr(`prop.${prop.id}.desc`)}</p></article>`).join('');
    return `<div class="p3-compendium">${header}<section id="book-content" role="tabpanel" aria-labelledby="book-tab-${this.tab}">${this.tab==='heroes'?`<p class="recipe-note">${tr('recipe.note')}</p>`:''}<div class="${this.tab==='matrix'||this.tab==='pets'?'compendium-browser':'encyclopedia-grid'}">${cards}</div>${this.tab==='heroes'?`<p class="doge-note">${tr('recipe.doge')}</p>`:''}</section></div>`;
  }
}
