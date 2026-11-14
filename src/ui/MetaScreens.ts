import {ledger} from './LedgerView';
import type { Profile } from '../core/types';
import { WEAPONS, HERO_FAMILIES, RARITY_RULES, type WeaponFamily } from '../config/weapons';
import { PROPS,META_PRICES } from '../config/props';
import { buyProp, createLotteryPrizes, ensureDailyShop, equipProp, equipWeapon, recycleFragments, refreshShop, spinLottery, type LotteryPrize, type MetaResult } from '../core/MetaProgression';
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
    return `<button type="button" class="prop-slot ${id ? 'filled' : ''}" ${id ? `data-action="meta-prop:${id}" title="${tr(`prop.${id}.desc`)}"` : 'disabled'} aria-label="${esc(label)}${id ? `: ${tr(`prop.${id}`)}` : ''}"><span>${id ? propSticker(id,36) : '+'}</span><small>${id ? tr(`prop.${id}`) : tr('m2.emptySlot')}</small></button>`;
  }).join('')}</div></section>`).join('');
}

export class MetaScreens {
  family: WeaponFamily | 'all' = 'all';
  tab: 'shop' | 'lottery' = 'shop';
  rarities = new Set([0, 1, 2, 3, 4]);
  orangeFirst = false;
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
    if (command === 'meta-family') this.family = id as WeaponFamily | 'all';
    if (command === 'meta-sort') this.orangeFirst = id === 'orange';
    if (command === 'meta-tab') this.tab = id as 'shop' | 'lottery';
    if (command === 'meta-buy') this.apply(buyProp(this.profile(), id));
    if (command === 'meta-prop') this.apply(equipProp(this.profile(), id));
    if (command === 'meta-equip') this.apply(equipWeapon(this.profile(),hero,this.profile().equippedWeapons[hero]===id?null:id));
    if (command === 'meta-unequip') this.apply(equipWeapon(this.profile(), id, null));
    if (command === 'meta-refresh') this.apply(refreshShop(this.profile(), day(), Math.random));
    if (command === 'meta-recycle') this.apply(recycleFragments(this.profile(), [...this.rarities]));
    if (command === 'meta-spin') this.spin();
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
  private spin(): void {
    if (this.spinning) return;
    const before = this.profile();
    const result = spinLottery(this.profile(), this.prizes, Math.random);
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
    const profile=this.profile();
    if(screen==='armory')return ledger('armory',this.armory(profile),{profile});
    const inventory=Object.values(PROPS).filter(prop=>profile.ownedProps[prop.id]).map(prop=>{
      const equipped=[...profile.equippedActiveProps,...profile.equippedPassiveProps].includes(prop.id);
      return `<button type="button" data-action="meta-prop:${prop.id}" class="inventory-prop ${equipped?'equipped':''}" aria-pressed="${equipped}" title="${tr(`prop.${prop.id}.desc`)}"><b>${propSticker(prop.id,42)} ${tr(`prop.${prop.id}`)}</b><small>${tr(`m2.${prop.type}`)} · ${tr('m2.level',{level:profile.ownedProps[prop.id],max:prop.maxLevel})}</small><strong>${tr(equipped?'m2.unequip':'m2.equip')}</strong></button>`;
    }).join('')||`<p>${tr('m2.noProps')}</p>`;
    return ledger('market',`<div class="market-split"><section class="market-stall"><div class="meta-tabs market-subtabs">${['shop','lottery'].map(tab=>`<button type="button" data-action="meta-tab:${tab}" aria-pressed="${this.tab===tab}" class="${this.tab===tab?'selected':''}">${tr(`m2.${tab}`)}</button>`).join('')}</div><h3 class="stall-awning market-awning">${tr(this.tab==='shop'?'p5.shopAwning':'p5.lotteryAwning')}</h3>${this.tab==='shop'?this.shop(profile):this.lottery()}</section><aside class="market-backpack"><section class="loadout-panel"><h3>${tr('p5.backpack')}</h3>${propSlots(profile)}${inBattle?'':`<p>${tr('m2.nextBattle')}</p>`}</section><h3>${tr('m2.inventory')}</h3><div class="inventory-grid">${inventory}</div></aside></div>`,{profile});
  }
  private armory(profile: Profile): string {
    const weapons = Object.values(WEAPONS).filter(weapon => this.family === 'all' || this.family === weapon.family);
    if (this.orangeFirst) weapons.sort((a, b) => b.rarity - a.rarity);
    return `<section class="hero-overview"><h3>${tr('m3.heroOverview')}</h3><div class="hero-loadout-grid hero-loadout-strip">${Object.keys(HERO_FAMILIES).map(hero => { const id = profile.equippedWeapons[hero]; return `<article class="${id?'stand-equipped':'stand-empty'}" data-loadout-hero="${hero}"><span class="hero-stand-art">${unitSticker(hero,34)}<i>${id ? weaponSticker(id,28) : '＋'}</i></span><div><strong>${tr(`hero.${hero}`)}</strong><small>${id ? tr(`weapon.${id}`) : tr('m3.emptyWeapon')}</small></div>${id?`<button type="button" class="stand-unequip" data-action="meta-unequip:${hero}" aria-label="${tr('m2.unequip')} ${tr(`hero.${hero}`)}">×</button>`:''}</article>`; }).join('')}</div></section><p>${tr('m2.collection', { count: profile.unlockedWeapons.length })}</p><p class="meta-rule">${tr('m2.weaponRule')}</p><div class="meta-tabs sort-tabs">${['default', 'orange'].map(sort => `<button type="button" data-action="meta-sort:${sort}" aria-pressed="${this.orangeFirst === (sort === 'orange')}" class="${this.orangeFirst === (sort === 'orange') ? 'selected' : ''}">${tr(sort === 'orange' ? 'm3.orangeSort' : 'm3.defaultSort')}</button>`).join('')}</div><div class="meta-tabs family-tabs">${['all', 'melee', 'ranged', 'magic'].map(family => `<button type="button" data-action="meta-family:${family}" aria-pressed="${family === this.family}" class="${family === this.family ? 'selected' : ''}">${tr(`m2.family.${family}`)}</button>`).join('')}</div><div class="weapon-grid">${weapons.map(weapon => {
      const unlocked = profile.unlockedWeapons.includes(weapon.id);
      const wearer = Object.keys(profile.equippedWeapons).find(hero => profile.equippedWeapons[hero] === weapon.id);
      const rule = RARITY_RULES[weapon.rarity];
      return `<article class="weapon-card rarity-${weapon.rarity} ${unlocked ? 'unlocked' : 'locked'}" data-weapon-id="${weapon.id}" data-weapon-rarity="${weapon.rarity}"><span class="weapon-sticker">${weaponSticker(weapon.id, 60)}</span><small>${tr(`m2.rarity.${weapon.rarity}`)} · ${tr(`m2.family.${weapon.family}`)}</small><h3>${tr(`weapon.${weapon.id}`)}</h3><b>${tr('m2.damage', { value: Math.round(rule.damageBonus * 100) })}</b><p>${tr(`weapon.${weapon.id}.desc`)}</p>${weapon.signatureHero ? `<p class="signature-note">✦ ${tr('m2.signature', { hero: t(`hero.${weapon.signatureHero}`) })}</p>` : ''}<div class="fragment-track"><i style="width:${Math.min(100, (profile.weaponFragments[weapon.id] ?? 0) / rule.fragments * 100)}%"></i></div><small>${tr('m2.progress', { count: profile.weaponFragments[weapon.id] ?? 0, total: rule.fragments })}</small>${unlocked ? `<div class="hero-equip-chips" aria-label="${tr('p5.equipTip')}">${Object.keys(HERO_FAMILIES).filter(hero=>HERO_FAMILIES[hero]===weapon.family).map(hero=>`<button type="button" class="hero-equip-chip ${wearer===hero?'equipped':''} ${weapon.signatureHero===hero?'signature':''}" data-action="meta-equip:${weapon.id}:${hero}" aria-pressed="${wearer===hero}" aria-label="${tr(wearer===hero?'m2.unequip':'m2.equip')} ${tr(`hero.${hero}`)}" title="${tr(`hero.${hero}`)}">${unitSticker(hero,34)}${weapon.signatureHero===hero?'<i>★</i>':''}${wearer===hero?'<b>✓</b>':''}</button>`).join('')}</div><label class="equip-hero"><span>${tr('m2.chooseHero')}</span><select data-weapon="${weapon.id}" aria-label="${tr('m2.equip')} ${tr(`weapon.${weapon.id}`)}"><option value="" disabled${wearer ? '' : ' selected'}>${tr('m2.chooseHero')}</option>${Object.keys(HERO_FAMILIES).filter(hero => HERO_FAMILIES[hero] === weapon.family).map(hero => `<option value="${hero}"${wearer === hero ? ' selected' : ''}>${tr(`hero.${hero}`)}</option>`).join('')}</select></label>${wearer ? `<p>${tr('m2.equipped', { hero: t(`hero.${wearer}`) })}</p><button type="button" class="text-button" data-action="meta-unequip:${wearer}">${tr('m2.unequip')}</button>` : ''}` : `<strong class="locked-label">${tr('m2.locked')}</strong>`}</article>`;
    }).join('')}</div><section class="recycle-panel"><h3>${tr('m2.recycle')}</h3><p>${tr('m2.recycleRule')}</p><div class="rarity-checks">${RARITY_RULES.map((rule, rarity) => `<label class="rarity-toggle rarity-${rarity}"><input type="checkbox" data-rarity="${rarity}"${this.rarities.has(rarity) ? ' checked' : ''}>${tr(`m2.rarity.${rarity}`)}<small>${tr('m2.recycleRate', { value: rule.recycle })}</small></label>`).join('')}</div><button type="button" class="button button-teal" data-action="meta-recycle">${tr('m2.recycle')}</button></section>`;
  }
  private shop(profile: Profile): string {
    return `<button type="button" class="button button-light shop-refresh" data-action="meta-refresh">${tr('m2.refresh')}</button><div class="shop-grid">${(profile.shop?.offers ?? []).map(id => {
      const prop = PROPS[id]; if (!prop) return '';
      const level = profile.ownedProps[id] ?? 0;
      return `<article class="shop-card rarity-${prop.rarity}"><span class="shop-icon">${propSticker(prop.id,64)}</span><h3>${tr(`prop.${id}`)}</h3><small>${prop.type==='active'?'⚡':'🛡️'} ${tr(`m2.${prop.type}`)} · ${tr('m2.level', { level, max: prop.maxLevel })}</small><p>${tr(`prop.${id}.desc`)}</p><button type="button" class="button button-teal" data-action="meta-buy:${id}"${level >= prop.maxLevel ? ' disabled' : ''}>${tr(level >= prop.maxLevel ? 'm2.maxed' : level ? 'm2.upgrade' : 'm2.buy', { price: prop.price })}</button></article>`;
    }).join('') || `<p>${tr('m2.shopEmpty')}</p>`}</div>`;
  }
  private lottery(): string {
    const positions = [0, 1, 2, 5, 8, 7, 6, 3];
    const cells = Array.from({ length: 9 }, (_, position) => {
      if (position === 4) return `<button type="button" class="lottery-center" data-action="meta-spin"${this.spinning ? ' disabled' : ''}><b>${tr(this.spinning ? 'm2.spinning' : 'm2.spin')}</b><span class="gacha-price">${this.profile().freeLotteryTickets>0?sceneSticker('ui_ticket_gacha','',30):sceneSticker('ui_coin_gold','',30)}<strong>${this.profile().freeLotteryTickets>0?1:META_PRICES.lottery}</strong></span><small>${tr('m2.spinCost')}</small></button>`;
      const index = positions.indexOf(position); const prize = this.prizes[index];
      return `<div class="lottery-cell ${index === this.highlight ? 'lit' : ''}" title="${prize?this.prizeText(prize):''}"><span>${prize?.type === 'prop' ? propSticker(prize.id!,48) : prize?.type === 'coins' ? sceneSticker('ui_coin_gold','',48) : prize?.id ? weaponSticker(prize.id,48) : '✦'}</span><small>${prize ? this.prizeText(prize) : ''}</small></div>`;
    });
    return `<div class="gacha-machine-frame"><div class="lottery-grid">${cells.join('')}</div></div><p class="meta-rule">${tr('m2.lotteryRule')}</p>${this.prize ? `<section class="lottery-result" role="status"><h3>${tr('m2.prize')}</h3><p>${this.prizeText(this.prize)}</p>${this.convertedCoins !== undefined ? `<p>${tr('m2.convertedCoins', { amount: this.convertedCoins })}</p>` : ''}${this.newWeapons.length ? `<h4>${tr('m2.newWeapons')}</h4>${this.newWeapons.map(id => `<p>${tr(`weapon.${id}`)}</p>`).join('')}` : ''}</section>` : ''}`;
  }
}
