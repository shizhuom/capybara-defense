import {describe,it,expect,vi,afterEach} from 'vitest';
import {createProfile} from '../src/core/MetaProgression';
import {BattleEngine} from '../src/core/BattleEngine';
import {getUnlockedUnitIds,newlyUnlocked} from '../src/config/progression';
import {Compendium} from '../src/ui/Compendium';
import {resultMarkup} from '../src/ui/SettlementView';
import {transitionMarkup,enemyAlertMarkup} from '../src/ui/BattlePresentation';
import {bindAudioGestures} from '../src/ui/AudioGestures';
import {GameApp} from '../src/ui/GameApp';
import {P9_SCENE_IDS,sceneSticker} from '../src/ui/stickers';
import {p9Zh,p9En} from '../src/i18n/p9';
import {setLanguage} from '../src/i18n/i18n';
afterEach(()=>{setLanguage('zh-CN');vi.restoreAllMocks();vi.unstubAllGlobals();});

describe('P9 gated encyclopedia and saved progress celebration',()=>{
 it.each(['zh-CN','en'] as const)('keeps locked portraits clickable but hides unreached full stats (%s)',lang=>{
  setLanguage(lang);const p=createProfile(),book=new Compendium();book.select('heroes');let html=book.markup(p);
  expect(html.match(/data-entry=/g)).toHaveLength(12);expect(html.match(/locked-roster/g)).toHaveLength(10);expect(html).toContain('mystery-art');
  book.openTo('pepe_king');html=book.markup(p);expect(html).toContain('★20');expect(html).toContain('locked-entry-notice');expect(html).not.toContain('book-growth');
  expect(book.markup({...p,highestStars:20})).toContain('book-growth');expect(book.markup({...p,mergedHeroes:['pepe_king']})).toContain('book-growth');expect(book.markup(p,true)).toContain('book-growth');
  book.openTo('frog');expect(book.markup({...p,mergedHeroes:['pepe_king']})).not.toContain('locked-entry-notice');
  book.openTo('hornet_queen');expect(book.markup(p)).toContain('★12');expect(book.markup(p)).not.toContain('counter-tip');
 });
 it('renders crossed-tier pets and heroes exactly once in a victory result, never in defeat',()=>{
  const e=new BattleEngine({autoWaves:false});e.start();e.state.result={winner:'player',reason:'waves',elapsed:55,loot:[],playerLoot:[],aiLoot:[],coins:60};
  const p={...createProfile(),stars:1,highestStars:1},newRoster=newlyUnlocked(0,1),args={state:e.state,profile:p,savedResult:true,resultStars:1,previousRank:0,newWeapons:[],newAvatars:[],newRoster};
  expect(newRoster).toEqual({units:['hedgehog','hat_shades'],heroes:['bamboo_mafia','meowfia']});
  expect(resultMarkup(args)).toContain('ui_unlock_chest');expect(resultMarkup(args)).toContain('roster-unlock-celebration');expect(newlyUnlocked(1,1).heroes).toEqual([]);
  e.state.result.winner='ai';expect(resultMarkup(args)).not.toContain('roster-unlock-celebration');
 });
 it('keeps washer and intelligent clay inside the permitted roster',()=>{
  const e=new BattleEngine({progressionStars:0,seed:18,autoWaves:false,loadouts:{player:{ownedProps:{washer:1,clay:1},equippedActiveProps:['washer','clay']}}});e.start();
  const id=e.grant('panda').unitId!;e.grant('shiba');const unit=e.state.units.find(u=>u.id===id)!;
  for(let i=0;i<25;i++){
   e.state.sides.player.propCooldowns={};e.useProp('clay',{unitId:id});expect(getUnlockedUnitIds(0)).toContain(unit.kind);
   e.useProp('washer',{unitId:id});e.tick(3.1);expect(getUnlockedUnitIds(0)).toContain(unit.kind);
  }
 });
 it('provides all eight distinct offline v2 stickers and symmetric translations',()=>{
  const svgs=P9_SCENE_IDS.map(id=>sceneSticker(id,'',64));expect(svgs.every(s=>s.includes('<svg'))).toBe(true);expect(new Set(svgs).size).toBe(8);
  expect(Object.keys(p9Zh)).toEqual(Object.keys(p9En));expect(Object.values(p9En).every(s=>!!s)).toBe(true);
 });
});
describe('P9 trusted gestures and presentation integration',()=>{
 it('calls unlock synchronously from non-passive gestures, guards running state and retries interruption',async()=>{
  const host=new EventTarget(),doc=Object.assign(new EventTarget(),{hidden:false}),listeners=vi.spyOn(host,'addEventListener');let unlocked=false;
  const sound={isUnlocked:()=>unlocked,unlock:vi.fn(()=>Promise.resolve())},unbind=bindAudioGestures(sound,host as Window,doc as Document);
  expect(listeners.mock.calls.every(c=>(c[2] as AddEventListenerOptions).passive===false)).toBe(true);
  for(const event of ['pointerdown','pointerup','touchend','click','keydown'])host.dispatchEvent(new Event(event));expect(sound.unlock).toHaveBeenCalledTimes(5);
  unlocked=true;host.dispatchEvent(new Event('click'));expect(sound.unlock).toHaveBeenCalledTimes(5);
  unlocked=false;doc.dispatchEvent(new Event('visibilitychange'));expect(sound.unlock).toHaveBeenCalledTimes(6);
  unbind();host.dispatchEvent(new Event('touchend'));expect(sound.unlock).toHaveBeenCalledTimes(6);
 });
 it('holds a real guided battle only during the curtain and keeps tutorial hold after skip',()=>{
  const elements=new Map<string,any>(),element=(id:string)=>{if(!elements.has(id))elements.set(id,{hidden:true,innerHTML:'',focus:vi.fn(),classList:{toggle:vi.fn()}});return elements.get(id);};
  const app:any=Object.create(GameApp.prototype);Object.assign(app,{profile:createProfile(),canvas:{focus:vi.fn()},element,closeDialog:vi.fn(),clearSelection:vi.fn(),refresh:vi.fn(),sound:{play:vi.fn(),setMusicPaused:vi.fn()}});
  vi.stubGlobal('window',{matchMedia:()=>({matches:false})});app.start(true);
  expect(element('battle-transition').hidden).toBe(false);expect(element('battle-transition').innerHTML).toContain('ui_battle_clash_crest');expect(app.sound.play).toHaveBeenCalledWith('battle_start_clash');
  app.engine.tick(2);expect(app.engine.state.waveTime).toBe(0);app.endTransition();expect(app.sound.setMusicPaused).toHaveBeenLastCalledWith(false);
  app.engine.tick(1);expect(app.engine.state.waveTime).toBe(0);app.engine.setTutorialHold(false);app.engine.tick(1);expect(app.engine.state.waveTime).toBeCloseTo(1);
 });
 it.each(['zh-CN','en'] as const)('renders a map-specific curtain and localized elite/boss tips (%s)',lang=>{
  setLanguage(lang);const e=new BattleEngine();e.start();expect(transitionMarkup(e.state,0)).toContain('ui_crossed_blades');
  for(const enemyKind of ['crab','killer_bee','charmed_rat','husky_wrecker']){const html=enemyAlertMarkup({enemyKind,boss:enemyKind==='husky_wrecker'});expect(html).toContain('ui_alert_siren');expect(html.replace(/<[^>]+>/g,'')).not.toMatch(/p9\.|p1\.|boss\.|enemy\./);}
 });
});
