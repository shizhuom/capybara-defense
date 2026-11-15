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
import {ledger} from './LedgerView';
import {progressionFor,requiredStars} from '../config/progression';
import {getRank} from '../config/ranks';
import {isTestProfile} from './storage';

export const COMPENDIUM_TABS = ['matrix','pets','heroes','bosses','weapons','props'] as const;
export type CompendiumTab = typeof COMPENDIUM_TABS[number];
const tr=(key:string,vars?:Record<string,string|number>)=>esc(t(key,vars));
const catalogs:Record<Exclude<CompendiumTab,'matrix'>,string[]>={
  pets:Object.values(UNITS).filter(u=>u.category==='basic'||u.category==='component').map(u=>u.id),
  heroes:RECIPES.map(r=>r.hero),bosses:Object.keys(ENEMIES),weapons:Object.keys(WEAPONS),props:Object.keys(PROPS),
};
const own=(table:object,id:string)=>Object.hasOwn(table,id);
const owner=(id:string):Exclude<CompendiumTab,'matrix'>|undefined=>own(HEROES,id)?'heroes':own(UNITS,id)?'pets':own(ENEMIES,id)?'bosses':own(WEAPONS,id)?'weapons':own(PROPS,id)?'props':undefined;
const name=(kind:string)=>tr(`${own(WEAPONS,kind)?'weapon':own(PROPS,kind)?'prop':own(HEROES,kind)?'hero':own(ENEMIES,kind)?(ENEMIES[kind].boss?'boss':'enemy'):'unit'}.${kind}`);
const sticker=(kind:string,size:number)=>`<span class="book-sticker" role="img" aria-label="${name(kind)}"><span aria-hidden="true">${own(WEAPONS,kind)?weaponSticker(kind,size):own(PROPS,kind)?propSticker(kind,size):unitSticker(kind,size)}</span></span>`;
const equation=(parts:readonly string[],hero:string,size=30)=>`${parts.map(part=>sticker(part,size)).join('<b>＋</b>')}<b>→</b>${sticker(hero,size+4)}<span>${name(hero)}</span>`;
const tabArt=(tab:CompendiumTab)=>tab==='matrix'?sceneSticker('ui_compendium_book','',28):tab==='weapons'?weaponSticker('m10_bamboo_staff',28):tab==='props'?propSticker('washer',28):sticker(tab==='pets'?'hamster':tab==='heroes'?'kungfu_po':'husky_wrecker',28);
function statPills(kind:string):string {
  const s=getBaseUnitStats(kind,1);
  return `<div class="book-stat-pills"><span title="${tr('p3.damage')}">⚔️ ${Math.round(s.damage)}</span><span title="${tr('p3.rate')}">⚡ ${Number(s.rate.toFixed(2))}/s</span><span title="${tr('p3.range')}">🎯 ${Number(s.range.toFixed(1))}</span>${HEROES[kind]?`<span title="${tr('p3.charge')}">🔋 ${s.charge}</span>`:''}</div>`;
}
function growth(kind:string):string {
  const max=HEROES[kind]?5:UNITS[kind].maxLevel;
  return `<table class="book-growth"><caption>${tr('p3.growth')}</caption><thead><tr><th scope="col">${tr('p3.levelHeading')}</th><th scope="col">${tr(kind==='bee'?'p3.production':'p3.damage')}</th>${kind==='bee'?'':`<th scope="col">${tr('p6.tableRate')}</th><th scope="col">${tr('p6.tableRange')}</th>${HEROES[kind]?`<th scope="col">${tr('p6.tableCharge')}</th>`:''}`}</tr></thead><tbody>${[1,2,3,4,5].map(l=>{
    const heading=`<th scope="row">${tr('p3.level',{level:l})}</th>`;
    if(l>max)return `<tr data-growth-unavailable="${l}">${heading}<td colspan="${kind==='bee'?1:3}">${tr('p3.unavailable')}</td></tr>`;
    const s=getBaseUnitStats(kind,l),bee=getBeeProduction(l);
    return `<tr>${heading}${kind==='bee'?`<td>${tr('p3.productionValue',bee)}</td>`:`<td>${Math.round(s.damage)}</td><td>${Number(s.rate.toFixed(2))}</td><td>${Number(s.range.toFixed(1))}</td>${HEROES[kind]?`<td>${s.charge}</td>`:''}`}</tr>`;
  }).join('')}</tbody></table>`;
}
function heroWeapons(kind:string):string {
  const all=Object.values(WEAPONS),signature=all.find(w=>w.signatureHero===kind)!;
  const recommendations=all.filter(w=>w.family===HERO_FAMILIES[kind]&&w.id!==signature.id).slice(0,2);
  return `<div class="hero-weapon-previews">${[signature,...recommendations].map((w,i)=>`<button type="button" data-action="compendium-entry:${w.id}" data-weapon-role="${i?'recommendation':'signature'}"><span aria-hidden="true">${weaponSticker(w.id,48)}</span><span><b>${tr(i?'p3.recommendation':'p3.signature')}</b><br/>${tr(`weapon.${w.id}`)}</span></button>`).join('')}</div>`;
}
export class Compendium {
  tab:CompendiumTab='matrix';
  private selectedHero='kungfu_po';
  private detailId:string|null=null;
  private focusedKind='';
  private unlocked=new Set<string>();
  private available(id:string):boolean {return !!WEAPONS[id]||!!PROPS[id]||this.unlocked.has(id);}
  private art(id:string,size:number):string {return `<span class="${this.available(id)?'roster-art':'mystery-art'}">${sticker(id,size)}</span>`;}
  private unlockBadge(id:string):string {return `<b class="star-unlock">${sceneSticker('ui_lock_closed','',22)}${tr('p9.starUnlock',{stars:requiredStars(id)})}</b>`;}
  private lockedMessage(id:string):string {const stars=requiredStars(id);return `<aside class="locked-entry-notice">${sceneSticker('ui_unlock_chest','',72)}<p>${tr('p9.lockedDetail',{stars,rank:t(`rank.${getRank(stars).index}`)})}</p></aside>`;}
  select(tab:string):boolean {
    if(!COMPENDIUM_TABS.includes(tab as CompendiumTab))return false;
    this.tab=tab as CompendiumTab;this.detailId=null;this.focusedKind='';return true;
  }
  openTo(kind:string):void {
    this.inspectEntry(kind);
  }
  inspectEntry(id:string):boolean {
    const tab=owner(id);if(!tab)return false;
    this.tab=tab;this.detailId=id;this.focusedKind=id;return true;
  }
  closeDetail():string|null {
    const previous=this.detailId;this.detailId=null;this.focusedKind='';return previous;
  }
  stepDetail(delta:-1|1):boolean {
    if(!this.detailId||this.tab==='matrix')return false;
    const ids=catalogs[this.tab],index=ids.indexOf(this.detailId);
    if(index<0)return false;
    return this.inspectEntry(ids[(index+delta+ids.length)%ids.length]);
  }
  /** Includes the detail ID so re-rendering never retains another entry's scroll offset. */
  get viewKey():string {return `${this.tab}:${this.detailId??''}`;}
  selectHero(kind:string):void {
    if(!Object.hasOwn(HEROES,kind))return;
    if(this.tab!=='matrix'){this.inspectEntry(kind);return;}
    this.selectedHero=kind;this.focusedKind=kind;
  }
  private entry(kind:string):string {return `data-compendium-kind="${kind}"${this.focusedKind===kind?' data-compendium-focused="true"':''} tabindex="-1"`;}
  private heroDetail(kind:string,profile:Profile):string {
    if(!this.available(kind))return `<article class="encyclopedia-card locked-roster" ${this.entry(kind)}>${this.art(kind,120)}<h4>${name(kind)}</h4>${this.unlockBadge(kind)}${this.lockedMessage(kind)}</article>`;
    const hero=HEROES[kind],recipe=RECIPES.find(r=>r.hero===kind)!;
    return `<article class="encyclopedia-card rarity-4" ${this.entry(kind)}><div class="book-heading">${sticker(kind,72)}<div><h4>${name(kind)}</h4><b class="collection-state">${tr(profile.mergedHeroes.includes(kind)?'p5.collected':'p9.heroAvailable')}</b></div></div><div class="recipe-equation">${equation(recipe.parts,kind)}</div>${statPills(kind)}${growth(kind)}<p><b>${tr(`skill.${kind}`)}</b> · ${tr(`skill.${kind}.desc`,{charge:hero.charge})}</p>${heroWeapons(kind)}</article>`;
  }
  private matrix(profile:Profile):string {
    const hats=['hat_bamboo','hat_shades','hat_wizard'];
    return `<div class="compendium-split"><div><table class="merge-matrix"><caption>${tr('p3.matrix')}</caption><thead><tr><th class="matrix-corner">${tr('p5.matrixCorner')}</th>${hats.map(h=>`<th scope="col">${this.art(h,42)}<span>${name(h)}</span></th>`).join('')}</tr></thead><tbody>${['panda','cat','shiba'].map(p=>`<tr><th scope="row">${this.art(p,42)}<span>${name(p)}</span></th>${hats.map(h=>{
      const recipe=RECIPES.find(r=>r.parts[0]===p&&r.parts[1]===h);
      return `<td data-matrix-cell="${p}:${h}">${recipe?`<button type="button" data-action="compendium-hero:${recipe.hero}" aria-pressed="${this.selectedHero===recipe.hero}">${this.art(recipe.hero,64)}<span>${name(recipe.hero)}</span>${this.available(recipe.hero)?'':this.unlockBadge(recipe.hero)}</button>`:`<span class="locked-pair">🔒 ${tr('p3.lockedPair')}</span>`}</td>`;
    }).join('')}</tr>`).join('')}</tbody></table><h3>${tr('p3.special')}</h3><div class="special-recipes">${RECIPES.slice(8).map(r=>`<button type="button" data-special-recipe="${r.hero}" data-action="compendium-hero:${r.hero}" aria-pressed="${this.selectedHero===r.hero}" class="recipe-equation">${this.available(r.hero)?equation(r.parts,r.hero):`${this.art(r.hero,44)}${this.unlockBadge(r.hero)}`}</button>`).join('')}</div></div><div class="compendium-detail" aria-live="polite">${this.heroDetail(this.selectedHero,profile)}</div></div>`;
  }
  private collected(id:string,p:Profile):boolean {
    return own(HEROES,id)?p.mergedHeroes.includes(id):own(WEAPONS,id)?p.unlockedWeapons.includes(id):own(PROPS,id)?!!p.ownedProps[id]:true;
  }
  private rarity(id:string):number {return WEAPONS[id]?.rarity??PROPS[id]?.rarity??(HEROES[id]||ENEMIES[id]?.boss?4:UNITS[id]?.category==='component'?2:0);}
  private badge(id:string,p:Profile):string {return this.available(id)?`<b class="collection-state">${tr(this.collected(id,p)?'p5.collected':HEROES[id]?'p9.heroAvailable':'p5.locked')}</b>`:this.unlockBadge(id);}
  private family(id:string):string {
    if(HEROES[id])return tr(`m2.family.${HERO_FAMILIES[id]}`);
    if(WEAPONS[id])return `${tr(`m2.rarity.${WEAPONS[id].rarity}`)} · ${tr(`m2.family.${WEAPONS[id].family}`)}`;
    if(PROPS[id])return tr(`m2.${PROPS[id].type}`);
    if(ENEMIES[id])return tr(ENEMIES[id].boss?'p7.boss':'p7.minion');
    return tr(UNITS[id]?.category==='basic'?'p3.basics':id==='shovel'?'p7.tool':'p3.components');
  }
  private portraits(profile:Profile):string {
    if(this.tab==='matrix')return '';
    const grid=(ids:string[])=>`<div class="portrait-grid">${ids.map(id=>`<article class="portrait-tile encyclopedia-card rarity-${this.rarity(id)}${this.available(id)?this.collected(id,profile)?' collected':'':' locked-roster'}" data-entry="${id}"><button type="button" class="portrait-tile-button" data-action="compendium-entry:${id}">${this.art(id,96)}<strong class="portrait-name">${name(id)}</strong>${this.badge(id,profile)}${this.tab==='bosses'?`<small class="portrait-family">${this.family(id)}</small>`:''}</button></article>`).join('')}</div>`;
    return `<p class="portrait-instruction">${tr('p7.tapPortrait')}</p>${this.tab==='pets'?(['basic','component'] as const).map(category=>`<h3>${tr(category==='basic'?'p3.basics':'p3.components')}</h3>${grid(catalogs.pets.filter(id=>UNITS[id].category===category))}`).join(''):grid(catalogs[this.tab])}`;
  }
  private details(id:string,profile:Profile):string {
    const tab=owner(id)!;if(tab!==this.tab)return this.portraits(profile);
    const ids=catalogs[tab],index=ids.indexOf(id),hero=HEROES[id],unit=UNITS[id],enemy=ENEMIES[id],weapon=WEAPONS[id],prop=PROPS[id];
    const formulas=this.available(id)&&(hero||unit?.category==='component')?RECIPES.filter(r=>r.hero===id||(r.parts as readonly string[]).includes(id)).map(r=>`<button type="button" class="recipe-equation" data-action="compendium-hero:${r.hero}">${this.available(r.hero)?equation(r.parts,r.hero,44):`${this.art(r.hero,44)}${this.unlockBadge(r.hero)}`}</button>`).join(''):'';
    let body='';
    if(hero)body=`${statPills(id)}${growth(id)}<p class="detail-skill"><b>${tr(`skill.${id}`)}</b> · ${tr(`skill.${id}.desc`,{charge:hero.charge})}</p>${heroWeapons(id)}`;
    else if(unit)body=id==='shovel'?`<p>${tr('inspect.toolBody')}</p>`:`${id==='bee'?`<div class="book-stat-pills"><span>🐟 ${tr('p3.productionValue',getBeeProduction(1))}</span></div>`:statPills(id)}${growth(id)}<p>${tr(unit.category==='basic'?'p3.drawBasic':'p3.drawComponent')}</p>${['shiba','hat_wizard'].includes(id)?`<aside class="locked-pair">${tr('p3.lockedPair')}</aside>`:''}`;
    else if(enemy)body=`<div class="book-stat-pills"><span>❤️ ${tr('p7.hp',{value:enemy.hp})}</span><span>💨 ${tr('p7.speed',{value:enemy.speed})}</span><span>🛡️ ${tr('p7.armor',{value:Math.round(enemy.armor*100)})}</span>${enemy.boss?`<span>⏱ ${tr('p1.cooldown',{time:enemy.interval})}</span>`:''}</div><p>${tr(enemy.boss?`p1.boss.${id}.mechanic`:`p3.minion.${id}.mechanic`)}</p><aside class="counter-tip"><b>${tr('p1.counter')}</b><p>${tr(enemy.boss?`p1.boss.${id}.tip`:`p3.minion.${id}.tip`)}</p></aside>`;
    else if(weapon)body=`<div class="book-stat-pills"><span>🧩 ${tr('p1.unlock',{count:RARITY_RULES[weapon.rarity].fragments})}</span><span>⚔️ ${tr('m2.damage',{value:Math.round(RARITY_RULES[weapon.rarity].damageBonus*100)})}</span></div><p>${tr(`weapon.${id}.desc`)}</p>${weapon.signatureHero?`<button type="button" class="signature-link" data-action="compendium-entry:${weapon.signatureHero}">${sticker(weapon.signatureHero,64)}<span>${tr('m2.signature',{hero:t(`hero.${weapon.signatureHero}`)})}</span></button>`:''}`;
    else if(prop)body=`<div class="book-stat-pills"><span>${tr(`m2.${prop.type}`)}</span><span>🪙 ${tr('p1.price',{price:prop.price})}</span><span>⏱ ${tr(prop.type==='active'?'p1.cooldown':'p1.auto',{time:prop.cooldown})}</span></div><p>${tr(`prop.${id}.desc`)}</p>`;
    return `<div class="compendium-detail-bar"><button type="button" data-action="compendium-back">${tr('p7.back')}</button><div><button type="button" data-action="compendium-prev" ${index<0?'disabled':''}>◀ ${tr('p7.prev')}</button><span aria-live="polite">${index<0?'—':`${index+1} / ${ids.length}`}</span><button type="button" data-action="compendium-next" ${index<0?'disabled':''}>${tr('p7.next')} ▶</button></div></div><article class="compendium-detail-sheet encyclopedia-card rarity-${this.rarity(id)}" data-entry="${id}" ${this.entry(id)}><div class="detail-showcase">${this.art(id,136)}<h4>${name(id)}</h4><span class="detail-family">${this.family(id)}</span>${this.badge(id,profile)}${formulas}</div><div class="detail-stats">${this.available(id)?body:this.lockedMessage(id)}</div></article>`;
  }
  markup(profile:Profile,unrestricted=isTestProfile()):string {
    const roster=progressionFor(profile,unrestricted);this.unlocked=new Set([...roster.units,...roster.heroes,...roster.minions,...roster.bosses]);
    const tabs=`<div class="encyclopedia-tabs ledger-tabs" role="tablist" aria-label="${tr('p1.encyclopedia')}">${COMPENDIUM_TABS.map(tab=>`<button type="button" role="tab" id="book-tab-${tab}" aria-selected="${tab===this.tab}" aria-controls="book-content" data-action="book:${tab}"><span aria-hidden="true">${tabArt(tab)}</span><span>${tr(`p3.${tab}`)}</span></button>`).join('')}</div>`;
    const content=this.tab==='matrix'?this.matrix(profile):this.detailId?this.details(this.detailId,profile):this.portraits(profile);
    return ledger('compendium',`<div class="p3-compendium"><section id="book-content" role="tabpanel" aria-labelledby="book-tab-${this.tab}">${content}</section></div>`,{tabs,badges:`<span class="collection-badge">${tr('p5.collection',{heroes:profile.mergedHeroes.length,weapons:profile.unlockedWeapons.length})}</span>`});
  }
}
