import {ledger} from './LedgerView';
import type { Profile } from '../core/types';
import { WEAPONS, HERO_FAMILIES, RARITY_RULES, type WeaponFamily, type WeaponDefinition } from '../config/weapons';
import { PROPS,META_PRICES } from '../config/props';
import { buyProp, createLotteryPrizes, ensureDailyLottery, ensureDailyShop, equipProp, equipWeapon, recycleFragments, refreshShop, spinLottery, type LotteryPayment, type LotteryPrize, type MetaResult } from '../core/MetaProgression';
import { t } from '../i18n/i18n';
import { escapeHtml as esc } from './art';
import { saveProfile } from './storage';
import { weaponSticker } from '../render/M3Art';
import type { SoundCue } from './SoundManager';
import { propSticker,unitSticker,sceneSticker } from './stickers';

const tr = (key: string, vars?: Record<string, string | number>) => esc(t(key, vars));
const day = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
export type MetaScreen = 'armory' | 'market';
const armoryTabs = ['all', 'melee', 'ranged', 'magic', 'recycle'] as const;
const marketTabs = ['shop', 'backpack', 'lottery'] as const;

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
  family: WeaponFamily | 'all' | 'recycle' = 'all';
  tab: typeof marketTabs[number] = 'shop';
  rarities = new Set([0, 1, 2, 3, 4]);
  private detailWeaponId: string | null = null;
  private merchantQuip = 0;
  private prizes: LotteryPrize[] = [];
  private needsFreshBoard = false;
  private spinning = false;
  private highlight = -1;
  private prize?: LotteryPrize;
  private convertedCoins?: number;
  private newWeapons: string[] = [];
  private timer?: ReturnType<typeof setTimeout>;
  constructor(private profile: () => Profile, private commit: (profile: Profile) => void, private render: () => void, private notify: (key: string, error?: boolean, vars?: Record<string, string | number>) => void, private onSound?: (cue: SoundCue) => void) {}

  /** List filters and detail entries each keep their own scroll position. */
  get viewKey(): string { return `${this.family}:${this.tab}:${this.detailWeaponId ?? 'list'}`; }
  get detailWeapon(): string | null { return this.detailWeaponId; }

  reset(): void {
    clearTimeout(this.timer); this.timer = undefined;
    this.prizes = []; this.spinning = false; this.highlight = -1;
    this.prize = undefined; this.convertedCoins = undefined; this.newWeapons = [];
    this.detailWeaponId = null; this.merchantQuip = 0;
  }

  open(screen: MetaScreen): void {
    if (screen === 'market') {
      const today = day();
      const profile = ensureDailyLottery(ensureDailyShop(this.profile(), today, Math.random), today, Math.random);
      this.persist(profile);
      this.prizes = [...(this.profile().lottery?.prizes ?? createLotteryPrizes(this.profile(), Math.random))];
      this.needsFreshBoard = false;
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
    if (command === 'meta-family' && armoryTabs.some(tab => tab === id)) { this.family = id as typeof this.family; this.detailWeaponId = null; }
    if (command === 'meta-tab' && marketTabs.some(tab => tab === id)) this.tab = id as typeof this.tab;
    if (command === 'meta-weapon' && Object.hasOwn(WEAPONS, id)) {
      if (this.family !== 'all' && this.family !== WEAPONS[id].family) this.family = WEAPONS[id].family;
      this.detailWeaponId = id;
    }
    if (command === 'meta-weapon-back') this.detailWeaponId = null;
    if (command === 'meta-weapon-prev') this.stepWeapon(-1);
    if (command === 'meta-weapon-next') this.stepWeapon(1);
    if (command === 'meta-merchant') this.merchantQuip = (this.merchantQuip + 1) % 3;
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
    const today = day();
    if (this.needsFreshBoard || this.prizes.length !== 8) {
      const synced = ensureDailyLottery(this.profile(), today, Math.random);
      this.prizes = [...(synced.lottery?.prizes ?? createLotteryPrizes(synced, Math.random))];
      this.needsFreshBoard = false;
    }
    const before = this.profile();
    const result = spinLottery(this.profile(), this.prizes, Math.random, payment, today);
    if (!result.ok) { this.notify(result.key, true); return; }
    // The complete transaction is persisted once, before any animation begins.
    if (!this.persist(result.profile)) return;
    this.needsFreshBoard = true;
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
  markup(screen: MetaScreen, inBattle = false, preparation = false): string {
    const profile = this.profile();
    const body = screen === 'armory' ? this.armory(profile) : this.tab === 'shop' ? this.shop(profile) : this.tab === 'backpack' ? this.backpack(profile) : this.lottery();
    return ledger(screen, body, {profile, tabs:this.folderTabs(screen), inBattle, preparation});
  }

  private folderTabs(screen: MetaScreen): string {
    const tabs = screen === 'armory' ? armoryTabs : marketTabs;
    const selected = screen === 'armory' ? this.family : this.tab;
    return `<nav class="ledger-tabs meta-tabs ${screen}-tabs" role="tablist" aria-label="${tr('p5.notebookTabs')}">${tabs.map(tab => `<button type="button" role="tab" data-action="meta-${screen === 'armory' ? 'family' : 'tab'}:${tab}" aria-selected="${selected === tab}" aria-pressed="${selected === tab}" class="${selected === tab ? 'selected' : ''}">${tr(`p11.meta.${screen === 'armory' ? 'family' : 'tab'}.${tab}`)}</button>`).join('')}</nav>`;
  }

  private weapons(profile: Profile): WeaponDefinition[] {
    return Object.values(WEAPONS)
      .filter(weapon => this.family === 'all' || this.family === weapon.family)
      .sort((a, b) => Number(profile.unlockedWeapons.includes(b.id)) - Number(profile.unlockedWeapons.includes(a.id)) || b.rarity - a.rarity);
  }

  private stepWeapon(delta: -1 | 1): void {
    if (!this.detailWeaponId) return;
    const weapons = this.weapons(this.profile());
    const index = weapons.findIndex(weapon => weapon.id === this.detailWeaponId);
    if (index >= 0) this.detailWeaponId = weapons[(index + delta + weapons.length) % weapons.length].id;
  }

  private armory(profile: Profile): string {
    if (this.family === 'recycle') return this.recycle();
    const weapons = this.weapons(profile);
    const selected = weapons.find(weapon => weapon.id === this.detailWeaponId);
    if (selected) return this.weaponDetail(profile, selected, weapons);
    return `<div class="storybook-list" aria-label="${tr('p11.meta.weaponList')}">${weapons.map(weapon => {
      const unlocked = profile.unlockedWeapons.includes(weapon.id);
      const wearer = Object.keys(profile.equippedWeapons).find(hero => profile.equippedWeapons[hero] === weapon.id);
      const rule = RARITY_RULES[weapon.rarity], count = profile.weaponFragments[weapon.id] ?? 0;
      const status = wearer
        ? `<span class="storybook-wearer" title="${tr(`hero.${wearer}`)}">${unitSticker(wearer,34)}</span><b>${tr('p11.meta.worn')}</b>${sceneSticker('ui_storybook_check','',24)}`
        : unlocked
          ? `<b>${tr('p11.meta.unlocked')}</b><span class="storybook-pill">${tr('p11.meta.equipShort')}</span>`
          : `<span>${count}/${rule.fragments}</span><span class="slim-progress" aria-hidden="true"><i style="width:${Math.min(100,count/rule.fragments*100)}%"></i></span>`;
      const summary = weapon.signatureHero ? tr('m2.signature',{hero:t(`hero.${weapon.signatureHero}`)}) : tr(`weapon.${weapon.id}.desc`);
      return `<article class="storybook-row-card weapon-row rarity-${weapon.rarity} ${unlocked ? 'unlocked' : 'locked'}" data-weapon-id="${weapon.id}" data-weapon-rarity="${weapon.rarity}"><button type="button" class="storybook-row-button" data-action="meta-weapon:${weapon.id}" aria-label="${tr('p9.viewItem',{name:t(`weapon.${weapon.id}`)})}"><span class="storybook-frame tone-weapons"><span${unlocked ? '' : ' class="unowned-art"'}>${weaponSticker(weapon.id,68)}</span></span><span class="storybook-copy"><strong class="portrait-name">${tr(`weapon.${weapon.id}`)}</strong><span class="storybook-meta">${tr(`m2.rarity.${weapon.rarity}`)} · ${tr(`p11.meta.family.${weapon.family}`)}</span><span class="storybook-tagline">⚔ +${Math.round(rule.damageBonus*100)}% · ${summary}</span></span><span class="storybook-status ${unlocked ? 'is-owned' : 'is-locked'}">${status}</span></button></article>`;
    }).join('')}</div>`;
  }

  private weaponDetail(profile: Profile, weapon: WeaponDefinition, weapons: WeaponDefinition[]): string {
    const id = weapon.id, rule = RARITY_RULES[weapon.rarity], count = profile.weaponFragments[id] ?? 0;
    const unlocked = profile.unlockedWeapons.includes(id), index = weapons.findIndex(item => item.id === id);
    const wearer = Object.keys(profile.equippedWeapons).find(hero => profile.equippedWeapons[hero] === id);
    const heroes = Object.keys(HERO_FAMILIES).filter(hero => HERO_FAMILIES[hero] === weapon.family);
    return `<div class="compendium-detail-bar"><button type="button" data-action="meta-weapon-back">${tr('p11.meta.back')}</button><div><button type="button" data-action="meta-weapon-prev">◀ ${tr('p11.meta.previous')}</button><span aria-live="polite">${index+1} / ${weapons.length}</span><button type="button" data-action="meta-weapon-next">${tr('p11.meta.next')} ▶</button></div></div><article class="storybook-detail-sheet compendium-detail-sheet rarity-${weapon.rarity}" data-weapon-id="${id}" data-detail-weapon-id="${id}" tabindex="-1"><div class="storybook-detail-showcase"><span class="storybook-frame tone-weapons"><span${unlocked ? '' : ' class="unowned-art"'}>${weaponSticker(id,116)}</span></span><h3>${tr(`weapon.${id}`)}</h3><span class="storybook-weapon-stats">${tr(`m2.rarity.${weapon.rarity}`)} · ${tr(`p11.meta.family.${weapon.family}`)}</span><b class="storybook-damage">${tr('m2.damage',{value:Math.round(rule.damageBonus*100)})}</b><p>${tr(`weapon.${id}.desc`)}</p>${weapon.signatureHero ? `<p class="signature-note">★ ${tr('m2.signature',{hero:t(`hero.${weapon.signatureHero}`)})}</p>` : ''}<div class="storybook-fragments"><span>${tr('m2.progress',{count,total:rule.fragments})}</span><span class="slim-progress" aria-hidden="true"><i style="width:${Math.min(100,count/rule.fragments*100)}%"></i></span></div></div><h4 class="storybook-equip-heading">${tr('p11.meta.equipHint')}</h4>${unlocked ? '' : `<p class="storybook-unlock-note">${tr('p11.meta.fragmentUnlock',{fragments:rule.fragments})}</p>`}<div class="storybook-hero-equip">${heroes.map(hero => `<button type="button" class="storybook-hero-button ${wearer === hero ? 'equipped' : ''} ${weapon.signatureHero === hero ? 'signature' : ''}" data-action="meta-equip:${id}:${hero}" aria-pressed="${wearer === hero}" aria-label="${tr(wearer === hero ? 'm2.unequip' : 'm2.equip')} ${tr(`hero.${hero}`)}"${unlocked ? '' : ' disabled'}>${unitSticker(hero,56)}<span>${tr(`hero.${hero}`)}</span>${weapon.signatureHero === hero ? `<small>${tr('p11.meta.signatureShort')}</small>` : ''}${wearer === hero ? sceneSticker('ui_storybook_check','',24) : ''}</button>`).join('')}</div></article>`;
  }

  private recycle(): string {
    return `<section class="storybook-recycle-card"><h3>${tr('p11.meta.family.recycle')}</h3><p>${tr('m2.recycleRule')}</p><div class="storybook-recycle-options">${RARITY_RULES.map((rule,rarity) => `<label class="storybook-rarity-row rarity-${rarity}"><input type="checkbox" data-rarity="${rarity}"${this.rarities.has(rarity) ? ' checked' : ''}><strong>${tr(`m2.rarity.${rarity}`)}</strong><span>${tr('m2.recycleRate',{value:rule.recycle})}</span></label>`).join('')}</div><button type="button" class="storybook-equip-btn" data-action="meta-recycle">${tr('p11.meta.recycleAction')}</button></section>`;
  }

  private shop(profile: Profile): string {
    const offers = profile.shop?.offers ?? [];
    const allMaxed = !Object.values(PROPS).some(p => (profile.ownedProps[p.id] ?? 0) < p.maxLevel);
    const whisper = allMaxed ? tr('p11.meta.merchantMaxed') : tr(`p11.meta.merchant${this.merchantQuip}`);
    return `<div class="storybook-shop-heading"><button type="button" class="storybook-whisper" data-action="meta-merchant"><span aria-hidden="true">${sceneSticker('ui_market_peek_raccoon','',32)}</span><span>${whisper}</span></button><button type="button" class="storybook-pill-btn" data-action="meta-refresh"${allMaxed ? ' disabled' : ''}>↻ ${tr('p6.refresh')} · ${sceneSticker('ui_coin_gold','',18)}${META_PRICES.shopRefresh}</button></div><div class="storybook-list">${offers.map(id => {
      if (!Object.hasOwn(PROPS,id)) return '';
      const prop = PROPS[id], level = profile.ownedProps[id] ?? 0;
      return `<article class="storybook-row-card shop-row rarity-${prop.rarity}" data-prop-id="${id}"><span class="storybook-frame tone-props">${propSticker(id,68)}</span><span class="storybook-copy"><strong class="portrait-name">${tr(`prop.${id}`)}</strong><span class="storybook-meta">${tr(`m2.${prop.type}`)} · Lv.${level}/${prop.maxLevel}</span><span class="storybook-tagline">${tr(`prop.${id}.desc`)}</span></span><span class="storybook-action-col">${level >= prop.maxLevel ? `<span class="storybook-status is-owned"><b>${tr('m2.maxed')}</b>${sceneSticker('ui_storybook_check','',24)}</span>` : `<button type="button" class="storybook-buy-btn" data-action="meta-buy:${id}" aria-label="${tr(level ? 'p11.meta.upgradeShort' : 'p11.meta.buyShort')} ${tr(`prop.${id}`)} · ${prop.price}">${sceneSticker('ui_coin_gold','',18)} ${prop.price}<span>${tr(level ? 'p11.meta.upgradeShort' : 'p11.meta.buyShort')}</span></button>`}</span></article>`;
    }).join('') || `<p class="storybook-empty">${tr('m2.shopEmpty')}</p>`}</div>`;
  }

  private backpack(profile: Profile): string {
    const equipped = new Set([...profile.equippedActiveProps,...profile.equippedPassiveProps]);
    const order = (id: string) => equipped.has(id) ? 0 : profile.ownedProps[id] ? 1 : 2;
    const props = Object.values(PROPS).sort((a,b) => order(a.id) - order(b.id));
    return `<section class="storybook-loadout-strip storybook-loadout-bar" aria-label="${tr('m2.loadout')}">${propSlots(profile)}</section><div class="storybook-list">${props.map(prop => {
      const level = profile.ownedProps[prop.id] ?? 0, worn = equipped.has(prop.id);
      return `<article class="storybook-row-card prop-row rarity-${prop.rarity} ${level ? 'owned' : 'unowned'} ${worn ? 'equipped' : ''}" data-prop-id="${prop.id}"><span class="storybook-frame tone-props"><span${level ? '' : ' class="unowned-art"'}>${propSticker(prop.id,60)}</span></span><span class="storybook-copy"><strong class="portrait-name">${tr(`prop.${prop.id}`)}</strong><span class="storybook-meta">${tr(`m2.${prop.type}`)}${level ? ` · Lv.${level}/${prop.maxLevel}` : ''}</span><span class="storybook-tagline">${tr(`prop.${prop.id}.desc`)}</span></span><span class="storybook-action-col">${level ? `<button type="button" class="storybook-equip-btn ${worn ? 'equipped' : ''}" data-action="meta-prop:${prop.id}" aria-pressed="${worn}" aria-label="${tr(worn ? 'm2.unequip' : 'p11.meta.deploy')} ${tr(`prop.${prop.id}`)}">${worn ? sceneSticker('ui_storybook_check','',20) : ''}<span>${tr(worn ? 'p11.meta.deployed' : 'p11.meta.deploy')}</span></button>` : `<span class="storybook-status is-locked"><span>${tr('p11.meta.unowned')}</span>${sceneSticker('ui_lock_closed','',20)}</span>`}</span></article>`;
    }).join('')}</div>`;
  }

  private lotteryResult(): string {
    if (!this.prize) return '';
    return `<section class="lottery-result" role="status"><h3>${tr('m2.prize')}</h3><p>${this.prizeText(this.prize)}</p>${this.convertedCoins !== undefined ? `<p>${tr('m2.convertedCoins',{amount:this.convertedCoins})}</p>` : ''}${this.newWeapons.length ? `<h4>${tr('m2.newWeapons')}</h4>${this.newWeapons.map(id => `<p>${tr(`weapon.${id}`)}</p>`).join('')}` : ''}</section>`;
  }

  private lottery(): string {
    const profile = this.profile(), positions = [0,1,2,5,8,7,6,3];
    const cells = Array.from({length:9},(_,position) => {
      if (position === 4) {
        const useTicket = profile.freeLotteryTickets > 0;
        const disabled = this.spinning || (!useTicket && profile.coins < META_PRICES.lottery);
        return `<button type="button" class="lottery-center${useTicket ? ' has-ticket' : ''}" data-action="meta-spin:${useTicket ? 'ticket' : 'coins'}"${disabled ? ' disabled' : ''}><b>${tr(this.spinning ? 'm2.spinning' : 'm2.spin')}</b><span class="gacha-price">${sceneSticker(useTicket ? 'ui_ticket_gacha' : 'ui_coin_gold','',24)}<strong>${useTicket ? `×${profile.freeLotteryTickets}` : META_PRICES.lottery}</strong></span></button>`;
      }
      const index = positions.indexOf(position), prize = this.prizes[index];
      return `<div class="lottery-cell ${index === this.highlight ? 'lit' : ''}" title="${prize ? this.prizeText(prize) : ''}"><span>${prize?.type === 'prop' ? propSticker(prize.id!,56) : prize?.type === 'coins' ? sceneSticker('ui_coin_gold','',56) : prize?.id ? weaponSticker(prize.id,56) : '✦'}</span><small>${prize ? this.prizeText(prize) : ''}</small></div>`;
    });
    return `<section class="storybook-lottery-card"><div class="storybook-lottery-heading"><span class="storybook-frame tone-props">${sceneSticker('ui_gacha_machine','',64)}</span><div class="storybook-copy"><h3 class="portrait-name">${tr('p11.meta.lotteryTitle')}</h3><p class="storybook-tagline">${tr('p11.meta.lotteryRule')}</p></div></div>${this.lotteryResult()}<div class="storybook-lottery-ring lottery-grid" aria-busy="${this.spinning}">${cells.join('')}</div><div class="storybook-spin-payments"><button type="button" class="storybook-equip-btn" data-action="meta-spin:ticket"${this.spinning || profile.freeLotteryTickets <= 0 ? ' disabled' : ''}>${sceneSticker('ui_ticket_gacha','',24)}${tr('p11.meta.ticketSpin',{count:profile.freeLotteryTickets})}</button><button type="button" class="storybook-equip-btn" data-action="meta-spin:coins"${this.spinning || profile.coins < META_PRICES.lottery ? ' disabled' : ''}>${sceneSticker('ui_coin_gold','',24)}${tr('p11.meta.coinSpin',{price:META_PRICES.lottery})}</button></div><p class="storybook-lottery-note">${tr('m2.lotteryRule')}</p></section>`;
  }
}
