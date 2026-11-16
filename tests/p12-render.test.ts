import {afterEach,expect,it,vi} from 'vitest';
import {BattleEngine} from '../src/core/BattleEngine';
import type {Unit,VisualEvent} from '../src/core/types';
import {assets} from '../src/render/AssetRegistry';
import {StickerRenderer} from '../src/render/StickerRenderer';
import {drawCombatEvent} from '../src/render/CombatEffects';
const image=(id:string)=>({id,naturalWidth:256,naturalHeight:256,complete:true} as unknown as HTMLImageElement);
function surface(){
 const calls:{name:string,args:any[]}[]=[],values:Record<string,any>={globalAlpha:1};
 const c=new Proxy(values,{get(v,k:string){if(k in v)return v[k];if(k==='measureText')return(s:string)=>({width:s.length*8});if(k.includes('Gradient'))return()=>({addColorStop(){}});return(...args:any[])=>calls.push({name:k,args});},set(v,k:string,x){v[k]=x;return true;}}) as CanvasRenderingContext2D;
 return{c,calls,renderer:new StickerRenderer({getContext:()=>c,width:0,height:0} as unknown as HTMLCanvasElement)};
}
const pet:Unit={id:101,kind:'hamster',side:'player',level:1,location:{zone:'board',col:1,row:1},statuses:{},energy:0,cooldown:0,production:0,buffTime:0,empowered:0,animation:0};
afterEach(()=>vi.restoreAllMocks());
it('always slices one base enemy sprite and never requests a walk2 variant',()=>{
 const spy=vi.spyOn(assets,'get').mockImplementation(id=>['rat','rat_walk2'].includes(id)?image(id):undefined);
 const engine=new BattleEngine({autoWaves:false});const rat=engine.spawnEnemy('rat','player');rat.id=0;rat.progress=.2;
 const {renderer,calls}=surface();renderer.draw(engine.state,0);renderer.draw(engine.state,.05);
 expect(spy.mock.calls.some(([id])=>id.endsWith('_walk2'))).toBe(false);
 expect(calls.filter(x=>x.name==='drawImage'&&x.args[0].id==='rat'&&x.args.length===9).length).toBeGreaterThanOrEqual(24);
});
it('draws the dying monster in a parabolic roll for the first 75 percent then only smoke and stars',()=>{
 const rat=image('rat');vi.spyOn(assets,'get').mockImplementation(id=>id==='rat'?rat:undefined);
 const event:VisualEvent={id:5,type:'death',side:'player',col:2,row:2,age:.2,duration:.55,enemyKind:'rat',boss:false};
 const {c,calls}=surface();drawCombatEvent(c,event,[]);
 expect(calls.some(x=>x.name==='drawImage'&&x.args[0]===rat)).toBe(true);
 expect(calls.some(x=>x.name==='rotate'&&Math.abs(x.args[0]-(.2/.55)*4.2)<1e-6)).toBe(true);
 expect(calls.some(x=>x.name==='translate'&&Math.abs(x.args[1]+Math.sin(.2/.55*Math.PI)*32)<1e-6)).toBe(true);
 calls.length=0;event.age=.42;drawCombatEvent(c,event,[]);expect(calls.some(x=>x.name==='drawImage'&&x.args[0]===rat)).toBe(false);
});
it('slices allied board pets while bench artwork remains a single image',()=>{
 vi.spyOn(assets,'get').mockImplementation(id=>id==='hamster'?image(id):undefined);
 const e=new BattleEngine({autoWaves:false});e.state.units=[pet,{...pet,id:102,location:{zone:'bench',slot:0}}];
 const {renderer,calls}=surface();renderer.draw(e.state,0);
 const art=calls.filter(x=>x.name==='drawImage'&&x.args[0].id==='hamster');
 expect(art.some(x=>x.args.length===9)).toBe(true);expect(art.some(x=>x.args.length===5)).toBe(true);
});
it('freezes every render transform on pause and resumes without consuming paused wall time',()=>{
 vi.spyOn(assets,'get').mockImplementation(id=>id==='rat'||id==='hamster'?image(id):undefined);
 const e=new BattleEngine({autoWaves:false});e.start();e.state.units=[{...pet,attackAnim:.6}];e.spawnEnemy('rat','player');
 const a=surface(),b=surface();a.renderer.draw(e.state,0);b.renderer.draw(e.state,0);a.renderer.draw(e.state,.05);b.renderer.draw(e.state,.05);
 e.state.phase='paused';a.calls.length=0;a.renderer.draw(e.state,50);const frozen=JSON.stringify(a.calls);
 a.calls.length=0;a.renderer.draw(e.state,100);expect(JSON.stringify(a.calls)).toBe(frozen);
 e.state.phase='playing';a.calls.length=0;b.calls.length=0;a.renderer.draw(e.state,100.016);b.renderer.draw(e.state,.066);
 const numbers=(xs:typeof a.calls)=>JSON.stringify(xs,(_k,v)=>typeof v==='number'?Math.round(v*1e7)/1e7:v);
 expect(numbers(a.calls)).toBe(numbers(b.calls));
});
