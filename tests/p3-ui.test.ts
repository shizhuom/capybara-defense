import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BattleEngine } from '../src/core/BattleEngine';
import { createProfile } from '../src/core/MetaProgression';
import { GameApp } from '../src/ui/GameApp';
import { tutorialMarkup } from '../src/ui/TutorialView';
import { setLanguage, t } from '../src/i18n/i18n';
import { sceneSticker } from '../src/ui/stickers';
import { MetaScreens } from '../src/ui/MetaScreens';
import { Compendium } from '../src/ui/Compendium';
import { setPropSlots } from '../src/core/MetaProgression';

// Minimal DOM/audio boundary: all commands, UI routing, copy and tutorial state are real.
class Element {
  innerHTML=''; textContent=''; hidden=false; disabled=false; open=false; value=''; dataset:Record<string,string>={};
  attrs:Record<string,string>={}; style:Record<string,string>={}; listeners:Record<string,((event:any)=>void)[]>={};
  classList={toggle:()=>{},contains:()=>false};
  addEventListener(name:string,fn:(event:any)=>void){(this.listeners[name]??=[]).push(fn);}
  fire(name:string,event:any){for(const fn of this.listeners[name]??[])fn(event);}
  setAttribute(name:string,value:string){this.attrs[name]=value;}
  querySelector(){return new Element();} querySelectorAll(){return [];}
  contains(){return false;} focus(){} insertAdjacentHTML(_where:string,html:string){this.innerHTML+=html;}
  showModal(){this.open=true;} close(){this.open=false;} scrollIntoView(){}
  setPointerCapture(){} hasPointerCapture(){return false;} releasePointerCapture(){}
  getBoundingClientRect(){return {left:0,top:0,width:390,height:741,right:390,bottom:741};}
}
function memoryStorage():Storage {
  const data=new Map<string,string>();
  return {get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:k=>data.get(k)??null,
    setItem:(k,v)=>{data.set(k,v);},removeItem:k=>{data.delete(k);},clear:()=>data.clear()};
}
function harness(){
  const engine=new BattleEngine({seed:81,autoWaves:false});engine.start();
  const elements=new Map<string,Element>();
  const element=(id:string)=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id)!;};
  const app:any=Object.create(GameApp.prototype);
  const root=new Element(),canvas=new Element();
  Object.assign(app,{engine,profile:createProfile(),element,root,canvas,dialog:new Element(),dialogKind:null,
    tutorialStep:'done',selectedId:undefined,shovelSelected:false,speed:1,newWeapons:[],newAvatars:[],
    sound:{play:vi.fn(),unlock:async()=>{},setSettings:()=>{},setDucked:()=>{}},
    meta:{action:()=>false,change:()=>false},profileScreens:{action:()=>false,change:()=>false},
    renderer:{hitTest:()=>({kind:'shovel'})}});
  return {app,engine,element,canvas,root};
}
beforeEach(()=>{
  vi.stubGlobal('HTMLElement',Element);vi.stubGlobal('HTMLInputElement',class extends Element{});
  vi.stubGlobal('HTMLSelectElement',class extends Element{});vi.stubGlobal('HTMLTextAreaElement',class extends Element{});
  vi.stubGlobal('HTMLButtonElement',class extends Element{});
  vi.stubGlobal('document',Object.assign(new Element(),{documentElement:new Element(),activeElement:null,hidden:false}));
  vi.stubGlobal('window',Object.assign(new Element(),{localStorage:memoryStorage()}));vi.stubGlobal('location',{search:''});
});
afterEach(()=>{setLanguage('zh-CN');vi.unstubAllGlobals();});

describe('P3 stage integration',()=>{
  it('routes persisted purchases, upgrades, active slots and weapons into preparation only',()=>{
    const {app,engine}=harness();app.refresh=()=>{};
    app.profile={...app.profile,coins:10000,unlockedWeapons:['m01_swatter'],shop:{day:'2026-11-14',offers:['washer','promo_badge']}};
    app.meta=new MetaScreens(()=>app.profile,p=>app.acceptPersistedProfile(p),()=>{},()=>{});
    app.action('meta-buy:washer');expect(engine.state.sides.player.loadout.ownedProps.washer).toBe(1);
    app.action('meta-prop:washer');expect(engine.state.sides.player.loadout.equippedActiveProps).toEqual(['washer']);
    app.action('meta-buy:promo_badge');app.action('meta-prop:promo_badge');app.action('meta-buy:promo_badge');
    expect(engine.state.sides.player.loadout.ownedProps.promo_badge).toBe(2);
    expect(engine.state.sides.player.loadout.equippedPassiveProps).toEqual(['promo_badge']);
    app.meta.change({dataset:{weapon:'m01_swatter'},value:'kungfu_po'} as unknown as HTMLSelectElement);
    expect(engine.state.sides.player.loadout.equippedWeapons.kungfu_po).toBe('m01_swatter');
    const before=structuredClone(engine.state.sides.player.loadout),profileBefore=structuredClone(app.profile);
    const storage=window.localStorage;window.localStorage={...storage,setItem:()=>{throw new Error('quota');}};
    app.action('meta-prop:washer');expect(app.profile).toEqual(profileBefore);expect(engine.state.sides.player.loadout).toEqual(before);
    window.localStorage=storage;engine.spawnEnemy('rat','player');
    app.action('meta-prop:washer');expect(app.profile.equippedActiveProps).toEqual([]);expect(engine.state.sides.player.loadout).toEqual(before);
  });
  it('keeps every new scene sticker recognizable without decoded assets',()=>{
    for(const id of ['ui_fish_food','ui_bell_summon','ui_compendium_book','ui_shop_bag','orange'] as const){
      expect(sceneSticker(id,'',32)).toContain(`data-sticker="${id}"`);
      expect(sceneSticker(id,'',32)).toContain('<svg');
    }
  });
  it('restores running or previously paused battles through nested shop tabs and guide deep links',()=>{
    const {app,engine}=harness();app.refresh=()=>{};app.compendium=new Compendium();
    app.meta=new MetaScreens(()=>app.profile,(p)=>app.acceptPersistedProfile(p),()=>app.renderDialog(),()=>{});
    app.action('battle-shop');expect(engine.state.phase).toBe('paused');
    app.action('battle-shop:armory');expect(app.dialogKind).toBe('armory');
    app.action('battle-shop:market');app.action('close-meta');expect(engine.state.phase).toBe('playing');
    app.pause();expect(app.dialogKind).toBe('pause');
    app.action('battle-shop');app.action('battle-shop:armory');app.action('close-meta');
    expect(engine.state.phase).toBe('paused');expect(app.dialogKind).toBe('pause');
    app.action('inspect-book:panda');expect(app.dialog.innerHTML).toContain('data-compendium-focused="true"');
    expect(app.dialog.innerHTML).toContain('id="book-tab-pets"');
    app.action('close-recipes');expect(engine.state.phase).toBe('paused');expect(app.dialogKind).toBe('pause');
    app.action('resume');app.action('recipes');
    app.action('compendium-hero:kungfu_po');expect(app.dialog.innerHTML).toContain('data-matrix-cell="panda:hat_bamboo"');
    app.action('inspect-book:kungfu_po');app.action('close-recipes');expect(engine.state.phase).toBe('playing');
  });
  it('syncs successful prep transactions and preserves live loadout on failed saving or manual spawn',()=>{
    const {app,engine}=harness();app.refresh=()=>{};
    app.profile={...app.profile,coins:10000,ownedProps:{extra_oranges:1,bee_overtime:1,washer:1}};
    const equipped=setPropSlots(app.profile,['washer'],['extra_oranges','bee_overtime']);expect(equipped.ok).toBe(true);
    app.persistProfile(equipped.profile);expect(engine.state.sides.player.oranges).toBe(5);
    expect(engine.state.sides.player.food).toBe(32);expect(engine.state.sides.player.loadout.equippedActiveProps).toEqual(['washer']);
    const storage=window.localStorage;
    window.localStorage={...storage,setItem:()=>{throw new Error('quota');}};
    const removed=setPropSlots(app.profile,[],[]);expect(app.persistProfile(removed.profile)).toBe(false);
    expect(engine.state.sides.player.oranges).toBe(5);expect(app.profile.equippedPassiveProps).toContain('extra_oranges');
    window.localStorage=storage;engine.spawnEnemy('rat','player');
    expect(app.persistProfile(removed.profile)).toBe(true);
    expect(app.profile.equippedPassiveProps).toEqual([]);expect(engine.state.sides.player.loadout.equippedPassiveProps).toContain('extra_oranges');
  });
  it('shows the selected bench or board card, updates numbers without replacing buttons, and clears during drags',()=>{
    const {app,engine,element}=harness();const id=engine.grant('kungfu_po').unitId!;
    app.selectedId=id;app.renderLiveCard();const host=element('live-card-host');
    expect(host.innerHTML).toContain('id="live-unit-card"');expect(host.innerHTML).toContain('inspect-book:kungfu_po');
    const initial=host.innerHTML,unit=engine.state.units.find(u=>u.id===id)!;
    const fields=new Map<string,Element>();host.querySelector=(selector?:string)=>{if(!fields.has(selector!))fields.set(selector!,new Element());return fields.get(selector!)!;};
    unit.energy=3;unit.statuses.WET=2;app.renderLiveCard();expect(host.innerHTML).toBe(initial);
    expect(fields.get('[data-live-energy-value]')!.textContent).toContain('🔋 ');
    expect(fields.get('[data-live-energy-value]')!.textContent).toContain('3/');
    expect(fields.get('[data-live-stat="rate"]')!.textContent).toContain(String(Number(engine.getEffectiveUnitStats(unit).rate.toFixed(2))));
    engine.state.grid[1][6]='O';engine.move(id,{zone:'board',col:6,row:1});app.renderLiveCard();expect(host.innerHTML).toContain('dock-left');
    app.drag={moved:true};app.renderLiveCard();expect(host.innerHTML).toBe('');app.drag=undefined;
    app.selectedId=undefined;app.renderLiveCard();expect(host.innerHTML).toBe('');
  });
  it('keeps the scenic canvas and compact stage actions',()=>{
    const {app}=harness(); const shell=app.shell();
    expect(shell).toContain('id="live-card-host"');
    expect(shell).toContain('data-action="battle-shop"');
    expect(shell).not.toContain('id="summon-note"');
    expect(shell.indexOf('id="keyboard-controls"')).toBeLessThan(shell.indexOf('id="stage"'));
    app.engine=null; app.refresh();expect(app.canvas.hidden).toBe(false);
  });
  it('offers five persisted map chips and four hub entries in both languages',()=>{
    const {app,element}=harness();
    for(const language of ['zh-CN','en'] as const){setLanguage(language);app.renderMenu();const html=element('menu-screen').innerHTML;
      expect(html.match(/data-action="select-map:/g)).toHaveLength(5);
      expect(html).toContain('ui_compendium_book');expect(html).toContain('ui_shop_bag');
      expect(html).not.toMatch(/p3\.[a-zA-Z]/);
    }
    app.action('select-map:sunny_backyard');expect(app.profile.selectedMap).toBe('sunny_backyard');
    app.action('select-map:sakura_onsen');expect(app.profile.selectedMap).toBe('sunny_backyard');
  });
  it('anchors first tutorial spotlight exactly to the summon dock',()=>{
    const {engine}=harness();const html=tutorialMarkup(1,engine.state);
    expect(html).toContain('left:60.9375%');expect(html).toContain('top:84.72222222222221%');
    expect(html).toContain('width:19.375%');
  });
});
