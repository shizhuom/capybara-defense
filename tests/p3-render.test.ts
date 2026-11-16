import {afterEach,describe,expect,it,vi} from 'vitest';
import {BattleEngine} from '../src/core/BattleEngine';
import {MAPS} from '../src/config/maps';
import {assets} from '../src/render/AssetRegistry';
import {StickerRenderer} from '../src/render/StickerRenderer';
import {EnemyMotion,ENEMY_NATURAL_FACING} from '../src/render/EnemyMotion';
import * as stickerArt from '../src/render/StickerArt';

function enemy(kind='rat') {return new BattleEngine({autoWaves:false}).spawnEnemy(kind,'player');}
function surface(){
 const calls:{name:string;args:any[];fill:unknown;stroke:unknown}[]=[],values:Record<string,any>={globalAlpha:1};
 const c=new Proxy(values,{get(v,k:string){if(k in v)return v[k];if(k==='measureText')return (s:string)=>({width:s.length*8});if(k.includes('Gradient'))return ()=>({addColorStop(){}});return (...args:any[])=>calls.push({name:k,args,fill:v.fillStyle,stroke:v.strokeStyle});},set(v,k:string,a){v[k]=a;return true;}}) as CanvasRenderingContext2D;
 return {calls,renderer:new StickerRenderer({getContext:()=>c,width:0,height:0} as unknown as HTMLCanvasElement)};
}
const image=(id:string)=>({id,complete:true,naturalWidth:256,naturalHeight:256} as unknown as HTMLImageElement);
afterEach(()=>vi.restoreAllMocks());
describe('P3 scenic rendering',()=>{
 it.each(Object.keys(MAPS) as (keyof typeof MAPS)[])('draws %s once full bleed before dynamic board overlays',mapId=>{
  const map=image(mapId);vi.spyOn(assets,'get').mockImplementation(id=>id===`map_${mapId}`?map:undefined);
  const s=new BattleEngine({autoWaves:false,mapId}).state,{renderer,calls}=surface();renderer.draw(s,0);
  expect(calls.filter(c=>c.name==='drawImage'&&c.args[0]===map).map(c=>c.args.slice(1))).toEqual([[0,0,1280,720]]);
  expect(calls.some(c=>c.name==='roundRect'&&c.args[0]===163&&c.args[1]===63)).toBe(false);
  expect(calls.some(c=>c.name==='strokeRect'&&c.stroke==='rgba(60,48,34,0.12)'&&c.args[0]===172.5)).toBe(true);
 });
 // Menu previews intentionally use the dedicated P4 splash; covered in p4-start-screen.test.ts.
 it('deforms the base image continuously even when another frame is present and keeps exact enlarged HP bounds',()=>{
  const base=image('rat'),walk=image('rat_walk2');const get=vi.spyOn(assets,'get').mockImplementation(id=>id==='rat'?base:id==='rat_walk2'?walk:undefined);
  const e=new BattleEngine({autoWaves:false}),rat=e.spawnEnemy('rat','player');rat.progress=.2;rat.id=0;
  const {renderer,calls}=surface();renderer.draw(e.state,0);
  const slices=calls.filter(c=>c.name==='drawImage'&&c.args[0]===base);
  expect(slices).toHaveLength(12);expect(slices.every(c=>c.args.length===9)).toBe(true);
  expect(slices[0].args[6]).toBe(-49);expect(Math.max(...slices.map(c=>c.args[6]+c.args[8]))).toBe(49);
  expect(calls.some(c=>c.name==='drawImage'&&c.args[0]===walk)).toBe(false);
  expect(get.mock.calls.some(([id])=>id==='rat_walk2')).toBe(false);
  expect(calls.some(c=>c.name==='roundRect'&&c.args[2]===42&&c.args[3]===7)).toBe(true);
  calls.length=0;rat.progress+=.01;renderer.draw(e.state,.3);expect(calls.some(c=>c.name==='drawImage'&&c.args[0]===base)).toBe(true);
  expect(calls.filter(c=>c.name==='drawImage'&&c.args[0]===base).map(c=>c.args)).not.toEqual(slices.map(c=>c.args));
  expect(calls.some(c=>c.name==='scale'&&Math.abs(c.args[0])>.7&&Math.abs(c.args[0])<1.1)).toBe(true);
 });
 it('uses a golden recovery arc and no duplicate sprinkler or nest instructions',()=>{
  const truck=image('sprinkler');vi.spyOn(assets,'get').mockImplementation(id=>id==='sprinkler'?truck:undefined);
  const state=new BattleEngine({autoWaves:false}).state;state.sides.player.shovelTimer=15;
  const {renderer,calls}=surface();renderer.draw(state,0);
  expect(calls.some(c=>c.name==='arc'&&c.args[0]===86&&c.args[1]===162&&c.args[2]===41)).toBe(true);
  expect(calls.some(c=>c.name==='drawImage'&&c.args[0]===truck)).toBe(false);
  expect(calls.filter(c=>c.name==='fillText').map(c=>c.args[0])).toEqual(['×1']);
 });
 it('holds procedural animation time and pose across stun and pause when every enemy image is missing',()=>{
  vi.spyOn(assets,'get').mockReturnValue(undefined);const art=vi.spyOn(stickerArt,'drawEnemyArt');
  const engine=new BattleEngine({autoWaves:false}),rat=engine.spawnEnemy('rat','player'),{renderer,calls}=surface();
  rat.id=0;rat.progress=.2;renderer.draw(engine.state,1);const time=art.mock.calls.at(-1)![2];
  rat.stun=2;renderer.draw(engine.state,2);expect(art.mock.calls.at(-1)![2]).toBe(time);
  const geometry=()=>calls.filter(c=>['translate','rotate','scale','ellipse','moveTo','bezierCurveTo','lineTo'].includes(c.name)).map(c=>({name:c.name,args:c.args}));
  engine.state.phase='paused';calls.length=0;renderer.draw(engine.state,3);const first=geometry();
  calls.length=0;renderer.draw(engine.state,4);expect(art.mock.calls.at(-1)![2]).toBe(time);
  expect(geometry()).toEqual(first);
 });
 it.each([[false,27.5,1,.5],[true,15,1,.5],[false,0,4,1],[true,0,6,1]] as const)('shows the real shovel production progress (auto=%s timer=%s stored=%s)', (auto,timer,stock,ratio)=>{
  const state=new BattleEngine({autoWaves:false,loadouts:{player:{ownedProps:{auto_shovel:1},equippedPassiveProps:auto?['auto_shovel']:[]}}}).state;
  state.sides.player.shovelTimer=timer;state.sides.player.shovels=stock;
  const {renderer,calls}=surface();renderer.draw(state,0);
  const arc=calls.find(c=>c.name==='arc'&&c.stroke==='#d9ad48');
  expect(arc?.args).toEqual([86,162,41,-Math.PI/2,-Math.PI/2+ratio*Math.PI*2]);
  expect(renderer.hitTest(86,203)).toEqual({kind:'shovel'});expect(renderer.hitTest(86,203.01)).toBeNull();
 });
 it('keeps boss size clamps, thick HP bars and star feedback visible',()=>{
  const art=image('husky_wrecker');vi.spyOn(assets,'get').mockImplementation(id=>id==='husky_wrecker'?art:undefined);
  const engine=new BattleEngine({autoWaves:false}),boss=engine.spawnEnemy('husky_wrecker','player');boss.id=0;boss.size=99;
  const {renderer,calls}=surface();renderer.draw(engine.state,0);
  const slices=calls.filter(c=>c.name==='drawImage'&&c.args[0]===art);
  expect(slices).toHaveLength(12);expect(slices[0].args[6]).toBe(-63);
  expect(Math.max(...slices.map(c=>c.args[6]+c.args[8]))).toBe(63);
  expect(calls.some(c=>c.name==='roundRect'&&c.args[2]===68&&c.args[3]===9)).toBe(true);
  expect(calls.some(c=>c.name==='fill'&&c.fill==='#e2b46e')).toBe(true);
  const clampedScales=calls.filter(c=>c.name==='scale').map(c=>c.args);
  boss.size=1.6;calls.length=0;renderer.draw(engine.state,0);
  expect(calls.filter(c=>c.name==='scale').map(c=>c.args)).toEqual(clampedScales);
 });
 it('bounds footfall dust, freezes its age on pause and clears it on removals, previews and new battles',()=>{
  const dust=image('vfx_dust_puff');vi.spyOn(assets,'get').mockImplementation(id=>id==='vfx_dust_puff'?dust:undefined);
  const engine=new BattleEngine({autoWaves:false}),roach=engine.spawnEnemy('roach','player');roach.id=0;
  const {renderer,calls}=surface();renderer.draw(engine.state,0);
  for(let i=1;i<=70;i++){roach.progress=i*(Math.PI+.001)/13.5;renderer.draw(engine.state,0);}
  calls.length=0;engine.state.phase='paused';renderer.draw(engine.state,20);
  expect(calls.filter(c=>c.name==='drawImage'&&c.args[0]===dust)).toHaveLength(48);
  const snapshot=JSON.stringify(engine.state);renderer.drawPreview('sakura_onsen',21);expect(JSON.stringify(engine.state)).toBe(snapshot);
  calls.length=0;renderer.draw(engine.state,22);expect(calls.filter(c=>c.name==='drawImage'&&c.args[0]===dust)).toHaveLength(0);
  engine.state.phase='playing';roach.progress+=1;renderer.draw(engine.state,22);
  calls.length=0;for(let i=1;i<=5;i++){calls.length=0;renderer.draw(engine.state,22+i*.1);}
  expect(calls.filter(c=>c.name==='drawImage'&&c.args[0]===dust)).toHaveLength(0);
  roach.progress+=1;renderer.draw(engine.state,22.5);
  engine.state.enemies=[];calls.length=0;renderer.draw(engine.state,22);expect(calls.filter(c=>c.name==='drawImage'&&c.args[0]===dust)).toHaveLength(0);
  engine.state.enemies=[roach];renderer.draw(engine.state,22);roach.progress+=1;renderer.draw(engine.state,22);
  engine.state.id='fresh-battle';calls.length=0;renderer.draw(engine.state,22);expect(calls.filter(c=>c.name==='drawImage'&&c.args[0]===dust)).toHaveLength(0);
 });
});
describe('P3 locomotion',()=>{
 it('faces Sakura left initially, flips only with meaningful horizontal motion and retains vertical facing',()=>{
  const motion=new EnemyMotion(),e=enemy();const path=MAPS.sakura_onsen.paths.player;
  let p=motion.sample(e,0,false,path);expect(p.dirX).toBe(-1);expect(p.flipX).toBe(1);
  e.col+=.001;e.row+=.2;p=motion.sample(e,.1,false,path);expect(p.dirX).toBe(-1);
  e.col+=.1;p=motion.sample(e,.2,false,path);expect(p.dirX).toBe(1);expect(p.flipX).toBe(-1);
  e.row+=.5;expect(motion.sample(e,.3,false,path).dirX).toBe(1);
  expect(ENEMY_NATURAL_FACING).toEqual({rat:-1,roach:-1,killer_bee:-1,dr_clippers:-1,king_skunk:-1,hornet_queen:-1,dj_rat_king:-1,charmed_rat:1,husky_wrecker:1,diva_kitty:1,screaming_marmot:1,trash_coon:1,crab:0,mega_roomba:0,box_kraken:0,sad_rain_frog:0,buff_roo:0});
 });
 it.each([['roach',13.5,1.8],['rat',9.5,3.4],['charmed_rat',9.5,3.4],['crab',8,0],['husky_wrecker',4.6,7]] as const)('drives %s steps, hop, sway, squash and shadows from actual progress', (kind,steps,height)=>{
  const m=new EnemyMotion(),e=enemy(kind);e.id=0;e.boss=kind==='husky_wrecker';e.progress=Math.PI/(2*steps);
  const p=m.sample(e,0,false,MAPS.sunny_backyard.paths.player);
  expect(p.phase).toBeCloseTo(Math.PI/2);expect(p.rig.phase).toBe(p.phase);expect(p.hopY).toBeCloseTo(-height);
  expect(p.shadowScale).toBeCloseTo(1-height/28);
  // Wall time alone cannot move ground legs; speed and slow are reflected by engine progress.
  const waiting=m.sample(e,20,false,MAPS.sunny_backyard.paths.player);
  expect(waiting.phase).toBe(p.phase);expect(waiting.rig).toEqual(p.rig);
  expect([waiting.hopY,waiting.tilt,waiting.squashX,waiting.squashY]).toEqual([p.hopY,p.tilt,p.squashX,p.squashY]);
  e.progress+=.01;expect(m.sample(e,21,false,MAPS.sunny_backyard.paths.player).phase-p.phase).toBeCloseTo(.01*steps);
 });
 it('freezes continuous gait under stun and the entire pose under pause',()=>{
  const m=new EnemyMotion(),e=enemy();e.id=0;e.progress=.2;const path=MAPS.sunny_backyard.paths.player;
  const p=m.sample(e,0,false,path);
  e.stun=1;e.progress=.5;const stunned=m.sample(e,.1,false,path);expect(stunned.rig).toEqual(p.rig);expect(stunned.hopY).toBe(p.hopY);
  expect(m.sample(e,10,true,path)).toEqual(stunned);
 });
 it('flaps flyers continuously at 28Hz, freezes on pause and drops removed/new-battle state',()=>{
  const m=new EnemyMotion(),e=enemy('killer_bee');e.id=0;const path=MAPS.sunny_backyard.paths.player;
  const first=m.sample(e,0,false,path),flapping=m.sample(e,.09,false,path);
  expect(flapping.wingPhase-first.wingPhase).toBeCloseTo(.09*28*Math.PI*2);
  expect(m.sample(e,2,true,path)).toEqual(flapping);
  m.retain(new Set());e.col=5;expect(m.sample(e,3,false,MAPS.sakura_onsen.paths.player).dirX).toBe(-1);
  m.clear();expect(m.sample(e,4,false,path).dirX).toBe(1);
 });
});
