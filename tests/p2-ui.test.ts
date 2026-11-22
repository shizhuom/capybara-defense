import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BattleEngine } from '../src/core/BattleEngine';
import { STAGE } from '../src/config/maps';
import { createProfile } from '../src/core/MetaProgression';
import { GameApp } from '../src/ui/GameApp';
import { tutorialMarkup } from '../src/ui/TutorialView';
import { setLanguage, t } from '../src/i18n/i18n';
import { en } from '../src/i18n/en';
import { zhCN } from '../src/i18n/zh-CN';
import { loadProfile } from '../src/ui/storage';
import { replayTutorial } from '../src/core/Tutorial';
import { p1En, p1Zh } from '../src/i18n/p1';
import { unitSticker } from '../src/ui/stickers';

// Minimal DOM/audio boundary: all commands, UI routing, copy and tutorial state are real.
class Element {
  innerHTML=''; textContent=''; hidden=false; disabled=false; open=false; value=''; dataset:Record<string,string>={};
  attrs:Record<string,string>={}; style:Record<string,string>={}; listeners:Record<string,((event:any)=>void)[]>={};
  classList={toggle:()=>{},contains:()=>false};
  addEventListener(name:string,fn:(event:any)=>void){(this.listeners[name]??=[]).push(fn);}
  fire(name:string,event:any){for(const fn of this.listeners[name]??[])fn(event);}
  setAttribute(name:string,value:string){this.attrs[name]=value;}
  querySelector(){return new Element();} querySelectorAll(){return [];}
  closest(){return null;}
  contains(){return false;} focus(){} insertAdjacentHTML(_where:string,html:string){this.innerHTML+=html;}
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

describe('P2 solo UI',()=>{
  it.each([
    {width:1440,left:497,right:943,top:48,bottom:892,height:35},
    {width:1024,left:289,right:735,top:48,bottom:892,height:35},
    {width:900,left:227,right:673,top:48,bottom:892,height:90},
    {width:800,left:177,right:623,top:48,bottom:892,height:140},
    {width:390,left:9,right:381,top:88,bottom:795,height:35},
  ])('keeps measured notices outside the stage actions at viewport width $width',fixture=>{
    const {app,element}=harness();
    Object.assign(window,{innerWidth:fixture.width,innerHeight:900});
    if(fixture.width===390)window.innerHeight=844;
    for(const method of ['renderMenu','renderBattleHUD','renderTutorial','renderBattleProps','renderInspector','renderKeyboard'])app[method]=()=>{};
    element('stage').getBoundingClientRect=()=>({...fixture,width:fixture.right-fixture.left,height:fixture.bottom-fixture.top});
    element('toast').getBoundingClientRect=()=>({left:0,right:162,top:0,bottom:fixture.height,width:162,height:fixture.height});
    app.notify('hint.dig');
    const style=element('toast').style;
    if(fixture.width===390){
      expect(style.left).toBe('50%');expect(style.bottom).toBe('auto');
      expect(parseFloat(style.top)).toBeCloseTo(fixture.top+(fixture.bottom-fixture.top)*STAGE.boardY/STAGE.height+6);
    }else{
      const left=parseFloat(style.left),width=parseFloat(style.width);
      expect(left).toBeGreaterThanOrEqual(fixture.right+16);
      expect(left+width).toBeLessThanOrEqual(fixture.width-16);expect(width).toBeGreaterThanOrEqual(120);
      expect(style.transform).toBe('none');
    }
  });
  it('repositions a visible notice after resizing and keeps a wrapped narrow-screen notice above actions when no gutter fits',()=>{
    const {app,element}=harness();
    for(const method of ['renderMenu','renderBattleHUD','renderTutorial','renderBattleProps','renderInspector','renderKeyboard'])app[method]=()=>{};
    Object.assign(window,{innerWidth:1024,innerHeight:900});
    let bounds={left:289,right:735,top:48,bottom:892,width:446,height:844};
    element('stage').getBoundingClientRect=()=>bounds;
    element('toast').getBoundingClientRect=()=>({left:0,right:162,top:0,bottom:90,width:162,height:90});
    app.notify('hint.noFood',true,{count:10,cost:14});expect(element('toast').style.transform).toBe('none');
    Object.assign(window,{innerWidth:390,innerHeight:600});
    bounds={left:52,right:338,top:48,bottom:590,width:286,height:542};setLanguage('en');app.refresh();
    const style=element('toast').style,top=parseFloat(style.top);
    expect(style.left).toBe('50%');expect(style.transform).toBe('translateX(-50%)');
    expect(parseFloat(style.width)).toBeGreaterThanOrEqual(280);
    expect(top).toBeGreaterThanOrEqual(48);expect(top+90).toBeLessThan(48+542*1080/1216);
    expect(style.bottom).toBe('auto');expect(element('toast').textContent).toContain('14');
  });
  it('keeps the shovel identity in UI icons when optional sprites are unavailable',()=>{
    expect(unitSticker('shovel')).toContain('data-sticker="shovel"');
    expect(unitSticker('shovel')).not.toContain('hamster');
  });
  it('renders a solo canvas and a single player loot collection',()=>{
    const {app,engine}=harness();
    expect(app.shell()).toContain('width="1280" height="720"');
    expect(app.shell()).not.toContain('opponent-banner');
    engine.state.sides.player.loot=['m01_swatter'];engine.state.sides.ai.loot=['m02_pan'];
    app.dialogKind='pause';app.renderDialog();
    expect(app.dialog.innerHTML).toContain(t('weapon.m01_swatter'));
    expect(app.dialog.innerHTML).not.toContain(t('weapon.m02_pan'));
    expect((app.dialog.innerHTML.match(/<section>/g)??[])).toHaveLength(1);
  });
  it('shows live prices and shortages after successful and failed redraws',()=>{
    const {app,engine,element}=harness();
    for(const method of ['renderMenu','renderBattleHUD','renderTutorial','renderBattleProps','renderInspector','renderKeyboard'])app[method]=()=>{};
    app.refresh();expect(element('summon-cost').textContent).toContain('10');
    app.action('summon');expect(element('summon-cost').textContent).toContain('12');
    app.action('summon');expect(element('summon-cost').textContent).toContain('14');
    expect(element('summon-button').attrs['aria-label']).toContain('14');
    const ids=engine.state.units.map(unit=>unit.id);
    app.action('summon');
    expect(engine.state.sides.player.summons).toBe(2);expect(engine.state.units.map(unit=>unit.id)).toEqual(ids);
    expect(app.toast.vars).toMatchObject({count:14,cost:14});
    expect(t(app.toast.key,app.toast.vars)).toContain('14');
    expect(t(app.toast.key,app.toast.vars)).not.toMatch(/\{\w+\}/);
    engine.state.sides.player.food=4;app.action('summon');
    expect(app.toast.vars).toMatchObject({count:10,cost:14});
    setLanguage('en');app.refresh(true);expect(element('summon-cost').textContent).toContain('14');
  });
  it('stores a selected shovel, clears consumed selection, and keeps a full-pouch tool',()=>{
    const {app,engine}=harness();app.refresh=()=>{};
    const id=engine.grant('shovel').unitId!;app.selectedId=id;app.activate({kind:'shovel'});
    expect(engine.state.sides.player.shovels).toBe(2);expect(app.selectedId).toBeUndefined();
    expect(app.toast.key).toBe('hint.shovelStored');
    const next=engine.grant('shovel').unitId!;engine.state.sides.player.shovels=4;app.selectedId=next;
    app.activate({kind:'shovel'});expect(app.selectedId).toBe(next);expect(app.toast.key).toBe('hint.shovelFull');
  });
  it('routes a dragged shovel to pouch storage while an ordinary pet drop cancels harmlessly',()=>{
    const {app,engine,canvas}=harness();app.refresh=()=>{};app.bindEvents();
    const id=engine.grant('shovel').unitId!;
    const drop=(id:number)=>{app.drag={pointerId:1,id,shovel:false,moved:true};canvas.fire('pointerup',{pointerId:1,clientX:339,clientY:547});};
    drop(id);expect(engine.state.sides.player.shovels).toBe(2);expect(app.selectedId).toBeUndefined();
    const pet=engine.grant('hamster').unitId!;drop(pet);
    expect(engine.state.units.find(unit=>unit.id===pet)?.location).toEqual({zone:'bench',slot:0});
    expect(app.shovelSelected).toBe(false);
  });
  it('routes canvas taps and keyboard pouch activation through the same storage action',()=>{
    const {app,engine,canvas,root}=harness();app.refresh=()=>{};app.bindEvents();
    engine.grant('shovel');
    app.renderer.hitTest=(x:number)=>x<300?{kind:'bench',slot:0}:{kind:'shovel'};
    const tap=(clientX:number)=>{
      const event={pointerId:1,clientX,clientY:600,isPrimary:true,button:0,preventDefault:()=>{}};
      canvas.fire('pointerdown',event);canvas.fire('pointerup',event);
    };
    tap(50);tap(339);expect(engine.state.sides.player.shovels).toBe(2);expect(app.selectedId).toBeUndefined();
    const id=engine.grant('shovel').unitId!;app.selectedId=id;
    const button=new Element();button.dataset.target='shovel';
    root.fire('click',{target:{closest:()=>button},preventDefault:()=>{}});
    expect(engine.state.sides.player.shovels).toBe(3);expect(app.selectedId).toBeUndefined();
  });
  it('cancels an invalid tool tap silently, then consumes a reselected tool on grass',()=>{
    const {app,engine}=harness();app.refresh=()=>{};
    const id=engine.grant('shovel').unitId!;app.selectedId=id;
    app.activate({kind:'cell',col:1,row:1});
    expect(app.toast).toBeUndefined();expect(app.selectedId).toBeUndefined();app.selectedId=id;
    app.activate({kind:'cell',col:0,row:1});
    expect(engine.state.grid[1][0]).toBe('O');expect(engine.state.sides.player.shovels).toBe(1);
    expect(app.selectedId).toBeUndefined();expect(app.toast.key).toBe('hint.dig');
  });
  it('consumes a bench shovel on a partial repair, with shovel audio and tutorial progress',()=>{
    const {app,engine}=harness();app.refresh=()=>{};app.tutorialStep=2;
    engine.state.grid[1][0]='B';const id=engine.grant('shovel').unitId!;app.selectedId=id;
    app.activate({kind:'cell',col:0,row:1});
    expect(engine.state.craterHits['0,1']).toBe(1);expect(app.selectedId).toBeUndefined();
    expect(app.tutorialStep).toBe(3);expect(app.sound.play).toHaveBeenCalledWith('shovel');
    expect(app.toast.key).toBe('hint.repairProgress');
  });
  it('renders tool help without calling combat stat access and keyboard access to all 45 cells',()=>{
    const {app,engine,element}=harness();const id=engine.grant('shovel').unitId!;app.selectedId=id;
    engine.getUnitStats=()=>{throw new Error('tools have no combat stats');};
    app.renderInspector();expect(element('inspector').innerHTML).toContain(t('inspect.toolBody'));
    app.renderKeyboard();const markup=element('keyboard-controls').innerHTML;
    expect((markup.match(/data-target="cell:/g)??[])).toHaveLength(45);
    expect(markup).toContain('cell:0:0');expect(markup).toContain('cell:8:4');
    expect(markup).not.toContain('unit.shovel');
  });
  it('anchors tutorial spots to the solo board and safely finds an open mat',()=>{
    const {engine}=harness();
    const html=tutorialMarkup(3,engine.state);
    expect(html).toContain('left:29.6875%');expect(html).toContain('top:24.444444444444443%');
    expect(html).toContain('width:8.125%');
    const first=tutorialMarkup(1,engine.state);expect(first).toContain('top:84.72222222222221%');
  });
  it('keeps tutorial pending after failed saving and awards once after save, replay and reload',()=>{
    const {app}=harness();app.refresh=()=>{};app.renderMenu=()=>{};app.tutorialStep=6;
    const storage=memoryStorage();window.localStorage={...storage,setItem:()=>{throw new Error('quota');}};
    app.progressTutorial('acknowledge');expect(app.tutorialStep).toBe(6);expect(app.profile.coins).toBe(0);
    window.localStorage=storage;app.progressTutorial('acknowledge');
    expect(app.tutorialStep).toBe('done');expect(loadProfile(storage).coins).toBe(20);
    app.profile=replayTutorial(loadProfile(storage));app.tutorialStep=6;app.progressTutorial('acknowledge');
    expect(loadProfile(storage).coins).toBe(20);
  });
  it('persists tutorial skipping without paying a completion reward',()=>{
    const {app}=harness();app.refresh=()=>{};app.renderMenu=()=>{};app.tutorialStep=1;
    app.progressTutorial('skip');expect(app.tutorialStep).toBe('done');
    expect(loadProfile()).toMatchObject({tutorialCompleted:true,tutorialRewardClaimed:false,coins:0});
  });
  it.each(['zh-CN','en'] as const)('resolves tool and redraw copy without stale PvP directions in %s',language=>{
    setLanguage(language);
    for(const key of ['unit.shovel','inspect.tool','inspect.toolBody','hint.redrawn','hint.repairProgress','hint.shovelStored','hint.shovelFull','hint.toolOnly','render.dig'])expect(t(key)).not.toBe(key);
    expect(t('hint.redrawn')).toBe(language==='en'?'Fresh pack called in!':'换好新的一窝啦！');
    const dictionary=language==='en'?en:zhCN;
    expect([...Object.values(dictionary),...Object.values(language==='en'?p1En:p1Zh)].join(' ')).not.toMatch(/对手|双方|下半场|两边|rival|opponent|both sides|both gardens|lower (?:half|garden)|your half/i);
    expect(t('prop.shared_oranges')).toBe(language==='en'?'Hot Spring Feast Pass':'温泉加餐券');
    expect(t('prop.shared_oranges.desc')).toMatch(/15%/);expect(t('prop.hyper_party.desc')).toMatch(/38%/);
    expect(t('prop.auto_shovel.desc')).toMatch(/55/);expect(t('prop.auto_shovel.desc')).toMatch(/30/);
  });
});
