import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {BattleEngine} from '../src/core/BattleEngine';
import {createProfile} from '../src/core/MetaProgression';
import {GameApp} from '../src/ui/GameApp';
import {saveProfile} from '../src/ui/storage';
import {p13Zh,p13En} from '../src/i18n/p13';
import {setLanguage,t} from '../src/i18n/i18n';
vi.mock('../src/ui/storage',async importOriginal=>({...await importOriginal<typeof import('../src/ui/storage')>(),saveProfile:vi.fn(()=>true)}));
function harness(){
 const engine=new BattleEngine({seed:13});engine.start();
 const app:any=Object.create(GameApp.prototype);
 Object.assign(app,{engine,profile:{...createProfile(),tutorialCompleted:true,stars:10,highestStars:10,gachaWinCounter:2,onboardedFeatures:['done:endless']},tutorialStep:'done',speed:1,savedResult:true,
  newWeapons:[],newAvatars:[],newRoster:{units:[],heroes:[]},resultStars:0,previousRank:0,
  sound:{play:vi.fn()},refresh:vi.fn(),notify:vi.fn(),clearSelection:vi.fn(),renderDialog:vi.fn(),renderMenu:vi.fn(),
  profileScreens:{action:()=>false},meta:{action:()=>false},canvas:{focus:vi.fn()},dialog:{open:false},
  showDialog:vi.fn((kind:string)=>{app.dialogKind=kind;}),closeDialog:vi.fn(()=>{app.dialogKind=null;}),
  persistProfile:vi.fn((p:any)=>{if(saveProfile(p)){app.profile=p;return true;}return false;})});
 return {app,engine};
}
function win(engine:BattleEngine){engine.state.wave=10;(engine as any).finish('player','waves');}
beforeEach(()=>{vi.mocked(saveProfile).mockReset().mockReturnValue(true);});
afterEach(()=>{setLanguage('zh-CN');vi.restoreAllMocks();});
it('banks the normal victory before offering endless; decline never pays a second time',()=>{
 const {app,engine}=harness();engine.state.sides.player.loot=['m01_swatter'];win(engine);app.finish(engine.state);
 expect(app.dialogKind).toBe('endless-offer');expect(saveProfile).toHaveBeenCalledOnce();
 expect(app.profile.wins).toBe(1);expect(app.profile.matches).toBe(1);expect(app.profile.freeLotteryTickets).toBe(1);
 const saved=JSON.stringify(app.profile);app.action('decline-endless');expect(app.dialogKind).toBe('result');
 app.finish(engine.state);expect(JSON.stringify(app.profile)).toBe(saved);expect(saveProfile).toHaveBeenCalledOnce();
});
it('retains the standard award and separately banks endless once, without a second star or ticket',()=>{
 const {app,engine}=harness();engine.grant('hamster');const unit=engine.state.units[0];win(engine);app.finish(engine.state);
 const stars=app.profile.stars,coins=app.profile.coins,delta=app.resultStars;app.action('enter-endless');
 expect(engine.state.wave).toBe(11);expect(engine.state.units[0]).toBe(unit);expect(engine.state.endless).toBe(true);
 engine.state.endlessCoins=45;engine.state.sides.player.loot.push('m01_swatter');engine.state.wave=13;engine.surrender();app.finish(engine.state);
 expect(app.dialogKind).toBe('result');expect(app.profile.coins).toBe(coins+45);expect(app.profile.stars).toBe(stars);expect(app.resultStars).toBe(delta);
 expect(app.profile.freeLotteryTickets).toBe(1);expect(app.profile.matches).toBe(1);expect(app.profile.bestEndlessWave).toBe(13);
 const saved=JSON.stringify(app.profile);app.finish(engine.state);expect(JSON.stringify(app.profile)).toBe(saved);
});
it('failed standard persistence cannot enter endless or restart, and retry awards exactly once',()=>{
 const {app,engine}=harness();win(engine);vi.mocked(saveProfile).mockReturnValue(false);app.finish(engine.state);
 expect(app.savedResult).toBe(false);expect(app.profile.matches).toBe(0);app.action('enter-endless');expect(engine.state.wave).toBe(10);
 app.start();expect(app.engine).toBe(engine);expect(app.notify).toHaveBeenCalledWith('p13.saveFirst',true);
 vi.mocked(saveProfile).mockReturnValue(true);app.action('retry-save-result');expect(app.profile.matches).toBe(1);
 app.action('retry-save-result');expect(app.profile.matches).toBe(1);app.action('enter-endless');expect(engine.state.wave).toBe(11);
});
it('failed endless persistence leaves the prior banked stars intact and retries only the bonus',()=>{
 const {app,engine}=harness();win(engine);app.finish(engine.state);app.action('enter-endless');
 const before=structuredClone(app.profile);engine.state.endlessCoins=15;engine.surrender();vi.mocked(saveProfile).mockReturnValue(false);app.finish(engine.state);
 expect(app.profile).toEqual(before);expect(app.savedResult).toBe(false);
 vi.mocked(saveProfile).mockReturnValue(true);app.action('retry-save-result');expect(app.profile.coins).toBe(before.coins+15);
 expect(app.profile.stars).toBe(before.stars);expect(app.profile.wins).toBe(1);app.action('retry-save-result');expect(app.profile.coins).toBe(before.coins+15);
});
it('successful early call or dismissal persists coaching without altering the five-step tutorial',()=>{
 const {app,engine}=harness();app.action('early-wave');expect(app.profile.earlyWaveTipSeen).toBe(true);expect(engine.state.spawned).toBe(1);
 const second=harness();second.app.action('dismiss-early-tip');expect(second.app.profile.earlyWaveTipSeen).toBe(true);expect(second.engine.state.spawned).toBe(0);
 const guided=harness();guided.app.tutorialStep=4;guided.app.action('early-wave');expect(guided.engine.state.spawned).toBe(0);expect(guided.app.profile.earlyWaveTipSeen).toBe(false);
});
it('cycles the real HUD action through 1, 2, 3 and keeps explicit developer speeds',()=>{
 const {app}=harness();app.profile={...app.profile,stars:60,highestStars:60};for(const expected of [2,3,1]){app.action('speed');expect(app.speed).toBe(expected);}
 app.action('speed-3');expect(app.speed).toBe(3);
});
it('has symmetric fully translated HUD copy',()=>{
 expect(Object.keys(p13Zh).sort()).toEqual(Object.keys(p13En).sort());
 for(const language of ['zh-CN','en'] as const){setLanguage(language);for(const key of Object.keys(p13Zh))expect(t(key,{food:8,wave:11})).not.toBe(key);}
});
