import { HEROES } from '../config/heroes';
import { RECIPES } from '../config/recipes';
import { BOSS_IDS, ENEMIES } from '../config/enemies';
import { HERO_FAMILIES, RARITY_RULES, WEAPONS } from '../config/weapons';
import { PROPS } from '../config/props';
import type { Profile } from '../core/types';
import { t } from '../i18n/i18n';
import { weaponSticker } from '../render/M3Art';
import { propSticker, unitSticker } from './stickers';
import { escapeHtml as esc } from './art';

export const COMPENDIUM_TABS = ['heroes','bosses','weapons','props'] as const;
export type CompendiumTab = typeof COMPENDIUM_TABS[number];
const tr=(key:string,vars?:Record<string,string|number>)=>esc(t(key,vars));
const counts={heroes:12,bosses:12,weapons:36,props:20};
export class Compendium {
  tab:CompendiumTab='heroes';
  select(tab:string):boolean {
    if(!COMPENDIUM_TABS.includes(tab as CompendiumTab))return false;
    this.tab=tab as CompendiumTab;return true;
  }
  markup(profile:Profile):string {
    const header=`<button type="button" class="dialog-close icon-button" data-action="close-recipes" aria-label="${tr('recipe.close')}">×</button><span class="eyebrow">✦ ${tr('p1.bookEyebrow')} ✦</span><h2 id="dialog-title">${tr('p1.encyclopedia')}</h2><p class="dialog-subtitle">${tr('p1.bookSubtitle')}</p><div class="encyclopedia-tabs" role="tablist" aria-label="${tr('p1.encyclopedia')}">${COMPENDIUM_TABS.map(tab=>`<button type="button" role="tab" id="book-tab-${tab}" aria-selected="${tab===this.tab}" aria-controls="book-content" data-action="book:${tab}">${tr(`p1.${tab}`)} <b>${counts[tab]}</b></button>`).join('')}</div>`;
    let cards='';
    if(this.tab==='heroes') cards=RECIPES.map(recipe=>{
      const hero=HEROES[recipe.hero],collected=profile.mergedHeroes.includes(hero.id);
      return `<article class="recipe-card encyclopedia-card${collected?' collected':''}" data-entry="${hero.id}"><div class="book-heading">${unitSticker(hero.id,62)}<div><small>${tr(`m2.family.${HERO_FAMILIES[hero.id]}`)}</small><h4>${tr(`hero.${hero.id}`)}</h4><b class="collection-state">${tr(collected?'p1.collected':'p1.notCollected')}</b></div></div><div class="recipe-equation">${recipe.parts.map(part=>`<span>${unitSticker(part,38)}<small>${tr(`unit.${part}`)}</small></span>`).join('<b>＋</b>')}</div><p class="book-stats">${tr('p1.heroStats',{damage:hero.damage,rate:hero.rate,range:hero.range})}</p><p><strong>${tr(`skill.${hero.id}`)}</strong> · ${tr(`skill.${hero.id}.desc`,{charge:hero.charge})}</p></article>`;
    }).join('');
    if(this.tab==='bosses') cards=BOSS_IDS.map(id=>`<article class="encyclopedia-card boss-card" data-entry="${id}"><div class="book-heading">${unitSticker(id,62)}<h4>${tr(`boss.${id}`)}</h4></div><p class="book-stats">${tr('p1.bossStats',{hp:ENEMIES[id].hp,armor:Math.round(ENEMIES[id].armor*100),interval:ENEMIES[id].interval})}</p><p>${tr(`p1.boss.${id}.mechanic`)}</p><aside><b>${tr('p1.counter')}</b><p>${tr(`p1.boss.${id}.tip`)}</p></aside></article>`).join('');
    if(this.tab==='weapons') cards=Object.values(WEAPONS).map(weapon=>`<article class="encyclopedia-card rarity-${weapon.rarity}" data-entry="${weapon.id}"><div class="book-heading">${weaponSticker(weapon.id,62)}<div><small>${tr(`m2.rarity.${weapon.rarity}`)} · ${tr(`m2.family.${weapon.family}`)}</small><h4>${tr(`weapon.${weapon.id}`)}</h4><b class="collection-state">${tr(profile.unlockedWeapons.includes(weapon.id)?'p1.unlocked':'p1.locked')}</b></div></div><p class="book-stats">${tr('p1.unlock',{count:RARITY_RULES[weapon.rarity].fragments})} · ${tr('m2.damage',{value:Math.round(RARITY_RULES[weapon.rarity].damageBonus*100)})}</p><p>${tr(`weapon.${weapon.id}.desc`)}</p>${weapon.signatureHero?`<aside>${tr('m2.signature',{hero:t(`hero.${weapon.signatureHero}`)})}</aside>`:''}</article>`).join('');
    if(this.tab==='props') cards=Object.values(PROPS).map(prop=>`<article class="encyclopedia-card rarity-${prop.rarity}" data-entry="${prop.id}"><div class="book-heading">${propSticker(prop.id,62)}<div><small>${tr(`m2.${prop.type}`)} · ${tr('p1.price',{price:prop.price})}</small><h4>${tr(`prop.${prop.id}`)}</h4></div></div><p class="book-stats">${tr(prop.type==='active'?'p1.cooldown':'p1.auto',{time:prop.cooldown})}</p><p>${tr(`prop.${prop.id}.desc`)}</p></article>`).join('');
    return header+`<section id="book-content" role="tabpanel" aria-labelledby="book-tab-${this.tab}">${this.tab==='heroes'?`<p class="recipe-note">${tr('recipe.note')}</p>`:''}<div class="encyclopedia-grid">${cards}</div>${this.tab==='heroes'?`<p class="doge-note">${tr('recipe.doge')}</p>`:''}</section>`;
  }
}
