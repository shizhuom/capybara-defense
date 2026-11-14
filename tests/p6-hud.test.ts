import {afterEach,expect,it,vi} from 'vitest';
import {BattleEngine} from '../src/core/BattleEngine';
import {STAGE} from '../src/config/maps';
import {assets} from '../src/render/AssetRegistry';
import {StickerRenderer} from '../src/render/StickerRenderer';
import {GameApp} from '../src/ui/GameApp';
import {liveUnitCardMarkup} from '../src/ui/LiveUnitCard';
import {waveStrategyMarkup,wavePreviewTip} from '../src/ui/WaveStrategyView';
import {setLanguage,t} from '../src/i18n/i18n';
afterEach(()=>{vi.restoreAllMocks();setLanguage('zh-CN');});
function surface(){
 const calls:{name:string;args:any[]}[]=[],values:Record<string,unknown>={globalAlpha:1};
 const c=new Proxy(values,{get(v,k:string){if(k in v)return v[k];if(k==='measureText')return(s:string)=>({width:s.length*8});if(k.includes('Gradient'))return()=>({addColorStop(){}});return(...args:unknown[])=>calls.push({name:k,args});},set(v,k:string,a){v[k]=a;return true;}}) as unknown as CanvasRenderingContext2D;
 return{calls,renderer:new StickerRenderer({getContext:()=>c,width:0,height:0} as unknown as HTMLCanvasElement)};
}
function battle(){const e=new BattleEngine({seed:94,autoWaves:false});e.start();return e;}
it('hits only an occupied 26px lock badge outside tutorial and drag release, preserving normal nest targets',()=>{
 const e=battle();e.grant('panda');const{renderer}=surface(),x=STAGE.benchX+13,y=STAGE.benchY+13;
 expect(renderer.hitTest(x,y,{state:e.state,allowBenchLock:true})).toEqual({kind:'bench-lock',slot:0});
 for(const context of [undefined,{state:e.state,allowBenchLock:false},{state:e.state,allowBenchLock:true,dragging:true}])expect(renderer.hitTest(x,y,context)).toEqual({kind:'bench',slot:0});
 expect(renderer.hitTest(x+STAGE.benchStep,y,{state:e.state,allowBenchLock:true})).toEqual({kind:'bench',slot:1});
 expect(renderer.hitTest(STAGE.benchX+27,y,{state:e.state,allowBenchLock:true})).toEqual({kind:'bench',slot:0});
});
it('draws hero sparkles without selection, the correct lock state, and suppresses passive sparkles during drag/prop targeting',()=>{
 const e=battle();e.grant('panda');e.grant('hat_bamboo');e.toggleBenchLock(0);
 const sprites=new Map<string,HTMLImageElement>();for(const id of ['ui_lock_closed','ui_lock_open','ui_merge_sparkle'])sprites.set(id,{complete:true,naturalWidth:192,naturalHeight:192,id} as unknown as HTMLImageElement);
 vi.spyOn(assets,'get').mockImplementation(id=>sprites.get(id));
 for(const interaction of [{allowBenchLock:true},{allowBenchLock:true,draggingId:e.state.units[0].id},{allowBenchLock:true,propId:'milk_bottle'}]){
   const{renderer,calls}=surface();(renderer as any).drawNests(e.state,interaction,2);
   const drawn=calls.filter(c=>c.name==='drawImage').map(c=>c.args[0].id);
   expect(drawn).toContain('ui_lock_closed');expect(drawn).toContain('ui_lock_open');
   expect(drawn.includes('ui_merge_sparkle')).toBe(!('draggingId'in interaction)&&!('propId'in interaction));
 }
});
it('keeps accessible live-card locking on bench only and dispatches both lock entry points through the real engine',()=>{
 const e=battle();const id=e.grant('hamster').unitId!,unit=e.state.units[0];const input={unit,state:e.state,stats:e.getEffectiveUnitStats(unit),loadout:e.state.sides.player.loadout,allowBenchLock:true};
 expect(liveUnitCardMarkup(input)).toContain('data-action="toggle-bench-lock"');expect(liveUnitCardMarkup({...input,allowBenchLock:false})).not.toContain('data-action="toggle-bench-lock"');
 const app:any=Object.create(GameApp.prototype);Object.assign(app,{engine:e,tutorialStep:'done',selectedId:id,sound:{play:vi.fn()},refresh(){},notify(){},meta:{action:()=>false},profileScreens:{action:()=>false}});
 app.activate({kind:'bench-lock',slot:0});expect(e.state.sides.player.lockedBenchSlot).toBe(0);
 expect(liveUnitCardMarkup(input)).toContain('aria-pressed="true"');app.action('toggle-bench-lock');expect(e.state.sides.player.lockedBenchSlot).toBeNull();
 app.tutorialStep=4;app.action('toggle-bench-lock');expect(e.state.sides.player.lockedBenchSlot).toBeNull();
 unit.location={zone:'board',col:2,row:1};expect(liveUnitCardMarkup(input)).not.toContain('data-action="toggle-bench-lock"');
});
it.each(['zh-CN','en'] as const)('shows exact double-Boss tips and early reward with localized accessible controls (%s)',language=>{
 setLanguage(language);const preview={wave:10,count:36,minion:'crab',bosses:['box_kraken','husky_wrecker']};
 const html=waveStrategyMarkup(preview,{allowed:true,bonusFood:8});
 for(const id of ['box_kraken','husky_wrecker','ui_wave_horn','ui_fish_food'])expect(html).toContain(`data-sticker="${id}"`);
 expect(wavePreviewTip(preview)).toContain(t('p1.boss.box_kraken.tip'));expect(html).toContain('id="early-wave-button"');expect(html).toContain('+8');expect(html).not.toMatch(/>p6\./);
 expect(waveStrategyMarkup(preview,{allowed:false,bonusFood:0})).toContain('disabled hidden');
});
it('routes the horn through early-wave gates and keeps the first actual spawn in sync',()=>{
 const e=new BattleEngine({seed:93});e.start();const app:any=Object.create(GameApp.prototype);Object.assign(app,{engine:e,tutorialStep:'done',sound:{play:vi.fn()},refresh(){},notify(){}});
 app.action('early-wave');expect(e.state.spawned).toBe(1);expect(e.state.sides.player.food).toBe(30);
 const food=e.state.sides.player.food;app.action('early-wave');expect(e.state.sides.player.food).toBe(food);
});
