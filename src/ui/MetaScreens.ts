import {ledger} from './LedgerView';
import type { Profile } from '../core/types';
import { WEAPONS, HERO_FAMILIES, RARITY_RULES, type WeaponFamily } from '../config/weapons';
import { PROPS,META_PRICES } from '../config/props';
import { buyProp, createLotteryPrizes, ensureDailyShop, equipProp, equipWeapon, recycleFragments, refreshShop, spinLottery, type LotteryPayment, type LotteryPrize, type MetaResult } from '../core/MetaProgression';
import { t } from '../i18n/i18n';
import { escapeHtml as esc } from './art';
import { saveProfile } from './storage';
import { weaponSticker } from '../render/M3Art';
import type { SoundCue } from './SoundManager';
import { propSticker,unitSticker,sceneSticker } from './stickers';

const tr = (key: string, vars?: Record<string, string | number>) => esc(t(key, vars));
const day = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
export type MetaScreen = 'armory' | 'market';

export function propSlots(profile: Profile, quick = false): string {
  return (['active', 'passive'] as const).map(type => `<section class="slot-group"><h4>${tr(`m2.${type}`)} · ${type === 'active' ? 2 : 6}</h4><div class="${quick ? 'quick-slots' : 'prop-slots'}">${Array.from({ length: type === 'active' ? 2 : 6 }, (_, index) => {
    const ids = type === 'active' ? profile.equippedActiveProps : profile.equippedPassiveProps;
    const id = ids[index];
    const label = t('m2.slot', { type: t(`m2.${type}`), slot: index + 1 });
    if (quick) return `<label><span>${esc(label)}</span><select data-prop-slot="${type}:${index}" aria-label="${esc(label)}"><option value="">${tr('m2.emptySlot')}</option>${Object.values(PROPS).filter(item => item.type === type && profile.ownedProps[item.id]).map(item => `<option value="${item.id}"${id === item.id ? ' selected' : ''}>${tr(`prop.${item.id}`)}</option>`).join('')}</select></label>`;
    return `<button type="button" class="prop-slot ${id ? 'filled' : ''}" ${id ? `data-action="meta-prop:${id}" title="${tr(`prop.${id}.desc`)}"` : 'disabled'} aria-label="${esc(label)}${id ? `: ${tr(`prop.${id}`)} · ${tr('m2.unequip')}` : ''}"><span>${id ? propSticker(id,36) : '+'}</span>${id?'<b class="slot-remove" aria-hidden="true">×</b>':''}<small>${id ? tr(`prop.${id}`) : tr('m2.emptySlot')}</small></button>`;
  }).join('')}</div></section>`).join('');
}

export class MetaScreens {
  family: WeaponFamily | 'all' = 'all';
  tab: 'shop' | 'lottery' = 'shop';
  rarities = new Set([0, 1, 2, 3, 4]);
  orangeFirst = false;
  private selectedWeapon?: string;
  private selectedProp?: string;
  private merchantQuip = 0;
  private prizes: LotteryPrize[] = [];
  private spinning = false;
  private highlight = -1;
  private prize?: LotteryPrize;
  private convertedCoins?: number;
  private newWeapons: string[] = [];
  private timer?: ReturnType<typeof setTimeout>;
  constructor(private profile: () => Profile, private commit: (profile: Profile) => void, private render: () => void, private notify: (key: string, error?: boolean, vars?: Record<string, string | number>) => void, private onSound?: (cue: SoundCue) => void) {}

  reset(): void {
    clearTimeout(this.timer); this.timer = undefined;
    this.prizes = []; this.spinning = false; this.highlight = -1;
    this.prize = undefined; this.convertedCoins = undefined; this.newWeapons = [];
    this.selectedWeapon = undefined; this.selectedProp = undefined; this.merchantQuip = 0;
  }

  open(screen: MetaScreen): void {
    if (screen === 'market') {
      const profile = ensureDailyShop(this.profile(), day(), Math.random);
      this.persist(profile);
      if (!this.prizes.length) this.prizes = createLotteryPrizes(this.profile(), Math.random);
    }
  }
  private persist(profile: Profile): boolean {
    if (!saveProfile(profile)) { this.notify('hint.storage', true); return false; }
    this.commit(profile); return true;
  }
  private apply(result: MetaResult): boolean {
    if (!result.ok) { this.notify(result.key, true, { amount: result.amount ?? 0 }); return false; }
    const newAvatar = result.profile.unlockedAvatars.some(id => !this.profile().unlockedAvatars.includes(id));
    if (!this.persist(result.profile)) return false;
    this.notify(newAvatar ? 'm3.newAvatars' : result.key, false, { amount: result.amount ?? 0 }); this.render(); return true;
  }
  action(action: string): boolean {
    if (!action.startsWith('meta-')) return false;
    const [command, id, hero] = action.split(':');
    if (command === 'meta-family' && ['all','melee','ranged','magic'].includes(id)) { this.family = id as WeaponFamily | 'all'; this.selectedWeapon = undefined; }
    if (command === 'meta-sort') this.orangeFirst = id === 'orange';
    if (command === 'meta-tab') this.tab = id as 'shop' | 'lottery';
    if (command === 'meta-weapon' && WEAPONS[id]) this.selectedWeapon = id;
    if (command === 'meta-packet' && PROPS[id]) { this.selectedProp = id; this.prize = undefined; }
    if (command === 'meta-merchant') { this.merchantQuip = (this.merchantQuip + 1) % 3; this.selectedProp = undefined; this.prize = undefined; }
    if (command === 'meta-buy') this.apply(buyProp(this.profile(), id));
    if (command === 'meta-prop') this.apply(equipProp(this.profile(), id));
    if (command === 'meta-equip' && this.apply(equipWeapon(this.profile(),hero,this.profile().equippedWeapons[hero]===id?null:id))) this.onSound?.('hit_heavy');
    if (command === 'meta-unequip') this.apply(equipWeapon(this.profile(), id, null));
    if (command === 'meta-refresh') this.apply(refreshShop(this.profile(), day(), Math.random));
    if (command === 'meta-recycle') this.apply(recycleFragments(this.profile(), [...this.rarities]));
    if (command === 'meta-spin') this.spin(id === 'ticket' || id === 'coins' ? id : 'auto');
    this.render(); return true;
  }
  change(element: HTMLInputElement | HTMLSelectElement): boolean {
    if (element.dataset.rarity) {
      const value = Number(element.dataset.rarity);
      if ((element as HTMLInputElement).checked) this.rarities.add(value); else this.rarities.delete(value);
      return true;
    }
    if (element.dataset.weapon) { this.apply(equipWeapon(this.profile(), element.value, element.dataset.weapon)); return true; }
    if (element.dataset.hero) { this.apply(equipWeapon(this.profile(), element.dataset.hero, null)); return true; }
    return false;
  }
  private spin(payment: LotteryPayment = 'auto'): void {
    if (this.spinning) return;
    const before = this.profile();
    const result = spinLottery(this.profile(), this.prizes, Math.random, payment);
    if (!result.ok) { this.notify(result.key, true); return; }
    // The complete transaction is persisted once, before any animation begins.
    if (!this.persist(result.profile)) return;
    if (result.profile.unlockedAvatars.some(id => !before.unlockedAvatars.includes(id))) this.notify('m3.newAvatars');
    this.spinning = true; this.prize = undefined;
    this.newWeapons = result.newWeapons ?? [];
    this.convertedCoins = result.prize?.type === 'prop' && (before.ownedProps[result.prize.id!] ?? 0) >= PROPS[result.prize.id!].maxLevel ? PROPS[result.prize.id!].price : undefined;
    const winner = result.index ?? 0;
    let step = 0;
    const total = 24 + winner;
    const animate = () => {
      this.highlight = step % 8; this.onSound?.('lottery_tick'); this.render();
      if (step++ < total) this.timer = setTimeout(animate, step > 18 ? 90 + (step - 18) * 18 : 65);
      else { this.spinning = false; this.prize = result.prize; this.timer = undefined; this.onSound?.('lottery_win'); this.render(); }
    };
    clearTimeout(this.timer); animate();
  }
  private prizeText(prize: LotteryPrize): string {
    if (prize.type === 'coins') return tr('m2.prizeCoins', { amount: prize.amount });
    return tr(prize.type === 'prop' ? 'm2.prizeProp' : 'm2.prizeFragment', { name: t(`${prize.type === 'prop' ? 'prop' : 'weapon'}.${prize.id}`), amount: prize.amount });
  }
  markup(screen: MetaScreen, inBattle = false): string {
    const profile = this.profile();
    if (screen === 'armory') return ledger('armory', this.armory(profile), {profile});
    return ledger('market', `<div class="p9-market"><section class="p9-loadout-tray" aria-label="${tr('m2.loadout')}">${propSlots(profile)}${inBattle?'':`<span class="p9-next-battle">${tr('m2.nextBattle')}</span>`}</section><div class="market-split p9-market-stage"><aside class="p9-merchant"><div class="p9-speech" aria-live="polite">${this.merchant(profile)}</div><button type="button" class="p9-npc-button" data-action="meta-merchant" aria-label="${tr('p9.merchant')}">${sceneSticker('npc_shop_raccoon','',180)}<strong>${tr('p9.merchant')}</strong></button></aside><section class="market-stall p9-market-racks"><div class="meta-tabs market-subtabs">${(['shop','lottery'] as const).map(tab=>`<button type="button" data-action="meta-tab:${tab}" aria-pressed="${this.tab===tab}" class="${this.tab===tab?'selected':''}">${tr(tab==='shop'?'p9.marketDaily':'p9.marketGacha')}</button>`).join('')}</div><div class="p9-shop-tab"${this.tab==='shop'?'':' hidden'}>${this.shop(profile)}</div><div class="p9-lottery-tab"${this.tab==='lottery'?'':' hidden'}>${this.lottery()}</div></section></div></div>`, {profile});
  }
  private armory(profile: Profile): string {
    const weapons = Object.values(WEAPONS).filter(weapon => this.family === 'all' || this.family === weapon.family);
    if (this.orangeFirst) weapons.sort((a,b)=>b.rarity-a.rarity);
    const selected = weapons.find(weapon=>weapon.id===this.selectedWeapon) ?? weapons.find(weapon=>profile.unlockedWeapons.includes(weapon.id)) ?? weapons[0];
    return `<div class="p9-armory"><div class="p9-armory-toolbar"><div class="meta-tabs family-tabs">${(['all','melee','ranged','magic'] as const).map(family=>`<button type="button" data-action="meta-family:${family}" aria-pressed="${family===this.family}" class="${family===this.family?'selected':''}">${tr(`m2.family.${family}`)} <b>${family==='all'?36:12}</b></button>`).join('')}</div><button type="button" class="p9-sort" data-action="meta-sort:${this.orangeFirst?'default':'orange'}" aria-pressed="${this.orangeFirst}">${tr('m3.orangeSort')}</button><span>${tr('m2.collection',{count:profile.unlockedWeapons.length})}</span></div><div class="p9-armory-stage"><section class="p9-weapon-rack" aria-label="${tr('p9.rack')}"><div class="weapon-grid p9-weapon-grid">${weapons.map(weapon=>{
      const unlocked=profile.unlockedWeapons.includes(weapon.id),wearer=Object.keys(profile.equippedWeapons).find(hero=>profile.equippedWeapons[hero]===weapon.id),rule=RARITY_RULES[weapon.rarity],count=profile.weaponFragments[weapon.id]??0;
      return `<button type="button" data-action="meta-weapon:${weapon.id}" class="weapon-card p9-weapon-packet rarity-${weapon.rarity} ${unlocked?'unlocked':'locked'}" data-weapon-id="${weapon.id}" data-weapon-rarity="${weapon.rarity}" aria-pressed="${selected?.id===weapon.id}" aria-label="${tr('p9.viewItem',{name:t(`weapon.${weapon.id}`)})}"><small class="p9-grade">${weapon.rarity+1}</small>${wearer?`<span class="p9-wearer" title="${tr(`hero.${wearer}`)}">${unitSticker(wearer,32)}</span>`:''}<span class="p9-packet-art">${weaponSticker(weapon.id,64)}</span><strong>${tr(`weapon.${weapon.id}`)}</strong>${unlocked?`<b>⚔ +${Math.round(rule.damageBonus*100)}%</b>`:`<span class="p9-packet-progress"><span class="fragment-track"><i style="width:${Math.min(100,count/rule.fragments*100)}%"></i></span><small>${count}/${rule.fragments}</small></span>`}</button>`;
    }).join('')}</div></section><aside class="p9-anvil">${selected?this.weaponShowcase(profile,selected.id):''}</aside></div><details class="recycle-panel"><summary>${tr('m2.recycle')}</summary><p>${tr('m2.recycleRule')}</p><div class="rarity-checks">${RARITY_RULES.map((rule,rarity)=>`<label class="rarity-toggle rarity-${rarity}"><input type="checkbox" data-rarity="${rarity}"${this.rarities.has(rarity)?' checked':''}>${tr(`m2.rarity.${rarity}`)}<small>${tr('m2.recycleRate',{value:rule.recycle})}</small></label>`).join('')}</div><button type="button" class="button button-teal" data-action="meta-recycle">${tr('m2.recycle')}</button></details><details class="p9-loadout-overview"><summary>${tr('m3.heroOverview')}</summary><div class="hero-loadout-grid hero-loadout-strip">${Object.keys(HERO_FAMILIES).map(hero=>{const id=profile.equippedWeapons[hero];return `<article class="${id?'stand-equipped':'stand-empty'}" data-loadout-hero="${hero}">${unitSticker(hero,34)}<strong>${tr(`hero.${hero}`)}</strong><small>${id?tr(`weapon.${id}`):tr('m3.emptyWeapon')}</small>${id?`<button type="button" data-action="meta-unequip:${hero}" aria-label="${tr('m2.unequip')} ${tr(`hero.${hero}`)}">×</button>`:''}</article>`;}).join('')}</div></details></div>`;
  }
  private weaponShowcase(profile:Profile,id:string):string {
    const weapon=WEAPONS[id],rule=RARITY_RULES[weapon.rarity],unlocked=profile.unlockedWeapons.includes(id),wearer=Object.keys(profile.equippedWeapons).find(hero=>profile.equippedWeapons[hero]===id),count=profile.weaponFragments[id]??0;
    return `<div class="p9-blacksmith-heading">${sceneSticker('npc_blacksmith_capy','',128)}<strong>${tr('p9.blacksmith')}</strong></div><div class="p9-anvil-plinth">${weaponSticker(id,88)}</div><div class="p9-weapon-detail rarity-${weapon.rarity}"><span class="p9-detail-badges">${tr(`m2.rarity.${weapon.rarity}`)} · ${tr(`m2.family.${weapon.family}`)}</span><h3>${tr(`weapon.${id}`)}</h3><b class="p9-damage">${tr('m2.damage',{value:Math.round(rule.damageBonus*100)})}</b><p>${tr(`weapon.${id}.desc`)}</p>${weapon.signatureHero?`<p class="signature-note">★ ${tr('m2.signature',{hero:t(`hero.${weapon.signatureHero}`)})}</p>`:''}<div class="fragment-track"><i style="width:${Math.min(100,count/rule.fragments*100)}%"></i></div><small>${tr('m2.progress',{count,total:rule.fragments})}</small><p class="equip-status ${wearer?'is-equipped':''}">${tr(unlocked?(wearer?'p6.equipWorn':'p6.equipIdle'):'p9.fragmentUnlock',{hero:wearer?t(`hero.${wearer}`):''})}</p><div class="hero-equip-chips p9-hero-equip" aria-label="${tr('p5.equipTip')}">${Object.keys(HERO_FAMILIES).filter(hero=>HERO_FAMILIES[hero]===weapon.family).map(hero=>`<button type="button" class="hero-equip-chip ${wearer===hero?'equipped':''} ${weapon.signatureHero===hero?'signature':''}" data-action="meta-equip:${id}:${hero}" aria-pressed="${wearer===hero}" aria-label="${tr(wearer===hero?'m2.unequip':'m2.equip')} ${tr(`hero.${hero}`)}"${unlocked?'':' disabled'}>${unitSticker(hero,56)}<span>${tr(`hero.${hero}`)}</span>${weapon.signatureHero===hero?'<i aria-hidden="true">★</i>':''}${wearer===hero?'<b aria-hidden="true">✓</b>':''}</button>`).join('')}</div></div>`;
  }
  private merchant(profile:Profile):string {
    if(this.prize) return `<section class="lottery-result" role="status"><h3>${tr('m2.prize')}</h3><p>${this.prizeText(this.prize)}</p>${this.convertedCoins!==undefined?`<p>${tr('m2.convertedCoins',{amount:this.convertedCoins})}</p>`:''}${this.newWeapons.length?`<h4>${tr('m2.newWeapons')}</h4>${this.newWeapons.map(id=>`<p>${tr(`weapon.${id}`)}</p>`).join('')}`:''}</section>`;
    const prop=this.selectedProp?PROPS[this.selectedProp]:undefined;
    if(!prop)return `<p class="p9-merchant-quip">${tr(`p9.merchant${this.merchantQuip}`)}</p>`;
    const level=profile.ownedProps[prop.id]??0,equipped=[...profile.equippedActiveProps,...profile.equippedPassiveProps].includes(prop.id),offered=profile.shop?.offers.includes(prop.id);
    return `<div class="p9-prop-detail">${propSticker(prop.id,72)}<h3>${tr(`prop.${prop.id}`)}</h3><p>${tr(`prop.${prop.id}.desc`)}</p><span class="p9-detail-badges">${tr(`m2.${prop.type}`)}${prop.cooldown?` · ${tr('m2.cooldown',{time:prop.cooldown})}`:''}</span><small>${tr('m2.level',{level,max:prop.maxLevel})}</small><div class="p9-merchant-actions">${level?`<button type="button" class="button button-teal" data-action="meta-prop:${prop.id}">${tr(equipped?'m2.unequip':'p9.equipSquad')}</button>`:''}${level<prop.maxLevel&&offered?`<button type="button" class="button button-teal" data-action="meta-buy:${prop.id}">${tr(level?'m2.upgrade':'m2.buy',{price:prop.price})}</button>`:''}${!level&&!offered?`<p>${tr('p9.outOfStock')}</p>`:''}</div></div>`;
  }
  private shop(profile: Profile): string {
    return `<h3 class="stall-awning market-awning"><span>${sceneSticker('ui_trunk_crate','',56)}${tr('p5.shopAwning')}</span><button type="button" class="shop-refresh" data-action="meta-refresh">${tr('p6.refresh')} ${sceneSticker('ui_coin_gold','',20)}${META_PRICES.shopRefresh}</button></h3><div class="shop-grid p9-daily-shelf">${(profile.shop?.offers??[]).map(id=>{
      const prop=PROPS[id];if(!prop)return '';const level=profile.ownedProps[id]??0;
      return `<article class="shop-card rarity-${prop.rarity}"><button type="button" data-action="meta-packet:${id}" class="p9-offer-select" aria-pressed="${this.selectedProp===id}">${propSticker(id,76)}<strong>${tr(`prop.${id}`)}</strong></button><button type="button" class="button p9-price" data-action="meta-buy:${id}"${level>=prop.maxLevel?' disabled':''}>${tr(level>=prop.maxLevel?'m2.maxed':level?'m2.upgrade':'m2.buy',{price:prop.price})}</button></article>`;
    }).join('')||`<p>${tr('m2.shopEmpty')}</p>`}</div><h3>${tr('p9.packets')}</h3><div class="inventory-grid p9-prop-packets">${Object.values(PROPS).map(prop=>{
      const level=profile.ownedProps[prop.id]??0,equipped=[...profile.equippedActiveProps,...profile.equippedPassiveProps].includes(prop.id);
      return `<button type="button" class="inventory-prop p9-seed-packet rarity-${prop.rarity} ${equipped?'equipped':''} ${level?'owned':'unowned'}" data-action="meta-packet:${prop.id}" aria-pressed="${this.selectedProp===prop.id}" aria-label="${tr('p9.viewItem',{name:t(`prop.${prop.id}`)})}">${propSticker(prop.id,56)}<strong>${tr(`prop.${prop.id}`)}</strong><small>${equipped?`✓ ${tr('meta.equipped')}`:level?tr('m2.level',{level,max:prop.maxLevel}):tr('meta.propNotOwned')}</small></button>`;
    }).join('')}</div>`;
  }
  private lottery(): string {
    const profile=this.profile(),positions=[0,1,2,5,8,7,6,3];
    const cells=Array.from({length:9},(_,position)=>{
      if(position===4)return `<button type="button" class="lottery-center" data-action="meta-spin:coins"${this.spinning||profile.coins<META_PRICES.lottery?' disabled':''}><b>${tr(this.spinning?'m2.spinning':'m2.spin')}</b><span class="gacha-price">${sceneSticker('ui_coin_gold','',30)}<strong>${META_PRICES.lottery}</strong></span></button>`;
      const index=positions.indexOf(position),prize=this.prizes[index];
      return `<div class="lottery-cell ${index===this.highlight?'lit':''}" title="${prize?this.prizeText(prize):''}"><span>${prize?.type==='prop'?propSticker(prize.id!,64):prize?.type==='coins'?sceneSticker('ui_coin_gold','',64):prize?.id?weaponSticker(prize.id,64):'✦'}</span><small>${prize?this.prizeText(prize):''}</small></div>`;
    });
    return `<div class="p9-gacha-header">${sceneSticker('ui_gacha_machine','',180)}<div><h3>${tr('p9.marketGacha')}</h3><strong>${tr('m2.tickets',{count:profile.freeLotteryTickets})}</strong><p>${tr('m2.lotteryRule')}</p></div></div><div class="gacha-machine-frame"><div class="lottery-grid">${cells.join('')}</div></div><div class="p9-spin-payments"><button type="button" class="button button-teal" data-action="meta-spin:ticket"${this.spinning||profile.freeLotteryTickets<=0?' disabled':''}>${sceneSticker('ui_ticket_gacha','',28)}${tr('p9.ticketSpin')}</button><button type="button" class="button button-teal" data-action="meta-spin:coins"${this.spinning||profile.coins<META_PRICES.lottery?' disabled':''}>${sceneSticker('ui_coin_gold','',28)}${tr('p9.coinSpin')}</button></div>`;
  }
}
