import {afterEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {BattleEngine} from '../src/core/BattleEngine';
import {STAGE,MAPS} from '../src/config/maps';
import {COMBAT_STYLES,DEFAULT_HELD_WEAPONS,WEAPON_RARITY_SCALES} from '../src/config/combat';
import {WEAPONS} from '../src/config/weapons';
import {assets} from '../src/render/AssetRegistry';
import {StickerRenderer} from '../src/render/StickerRenderer';
import {drawHeldWeapon,heldWeapon,weaponPose,bodyPose,WEAPON_ART_AXES,weaponArtGeometry} from '../src/render/HeldWeaponRenderer';
import {drawCombatEvent} from '../src/render/CombatEffects';
import {setLanguage,t} from '../src/i18n/i18n';
import type {Unit,VisualEvent} from '../src/core/types';

type Call={name:string;args:unknown[];fill:unknown;stroke:unknown;filter:unknown};
function surface(){
 const calls:Call[]=[],values:Record<string,unknown>={globalAlpha:1};
 const c=new Proxy(values,{get(v,k:string){if(k in v)return v[k];if(k==='measureText')return (s:string)=>({width:s.length*8});if(k.includes('Gradient'))return ()=>({addColorStop(){}});return (...args:unknown[])=>calls.push({name:k,args,fill:v.fillStyle,stroke:v.strokeStyle,filter:v.filter});},set(v,k:string,a){v[k]=a;return true;}}) as unknown as CanvasRenderingContext2D;
 return {c,calls,renderer:new StickerRenderer({getContext:()=>c,width:0,height:0} as unknown as HTMLCanvasElement)};
}
function pet(kind:string,board=true):Unit{return {id:10,kind,side:'player',level:1,location:board?{zone:'board',col:2,row:3}:{zone:'bench',slot:0},statuses:{},energy:0,cooldown:0,production:0,buffTime:0,empowered:0,animation:0};}
const image=(id:string)=>({complete:true,naturalWidth:256,naturalHeight:256,id} as unknown as HTMLImageElement);
afterEach(()=>{vi.restoreAllMocks();setLanguage('zh-CN');});
describe('P2 single garden geometry',()=>{
 it('keeps nests free of headings, counts and helper microcopy in both languages',()=>{
  for(const language of ['zh-CN','en'] as const)for(const filled of [0,5]){
   setLanguage(language);const state=new BattleEngine({autoWaves:false}).state;
   state.units=Array.from({length:filled},(_,slot)=>({...pet('hamster',false),id:10+slot,location:{zone:'bench' as const,slot}}));
   const {renderer,calls}=surface();renderer.draw(state,0);
   for(const text of [t('render.petNests'),String(filled)+' / 5',t('render.mergeHint'),t('render.dragHint'),t('render.keepCalm')])expect(calls.some(c=>c.name==='fillText'&&c.args[0]===text)).toBe(false);
  }
 });
 it('excludes every outer board edge and keeps all 45 cell centers reachable',()=>{
  const {renderer}=surface();for(let row=0;row<5;row++)for(let col=0;col<9;col++)expect(renderer.hitTest(224+104*col,124+104*row)).toEqual({kind:'cell',col,row});
  for(const [x,y] of [[171,72],[1108,300],[172,71],[400,592]])expect(renderer.hitTest(x,y)).toBeNull();
  expect(renderer.hitTest(1107.99,591.99)).toEqual({kind:'cell',col:8,row:4});
  for(let slot=0;slot<5;slot++)expect(renderer.hitTest(298+104*slot,656)).toEqual({kind:'bench',slot});
  expect(renderer.hitTest(350,656)).toBeNull();expect(renderer.hitTest(86,162)).toEqual({kind:'shovel'});
 });
 it.each(Object.keys(MAPS) as Array<keyof typeof MAPS>)('draws only the %s endpoint guardian and full board',mapId=>{
  const guardian=image('capybara'),map=image(`map_${mapId}`);vi.spyOn(assets,'get').mockImplementation(id=>id==='capybara'?guardian:id===`map_${mapId}`?map:undefined);
  const state=new BattleEngine({ai:false,autoWaves:false,mapId}).state,{renderer,calls}=surface();renderer.draw(state,0);
  expect(calls.filter(c=>c.name==='drawImage'&&c.args[0]===guardian)).toHaveLength(1);
  expect(calls.find(c=>c.name==='drawImage'&&c.args[0]===map)?.args.slice(1)).toEqual([0,0,1280,720]);
  const spot={sunny_backyard:[1053.5,531],sakura_onsen:[263,490],midnight_kitchen:[1055,323],cat_tower_maze:[1054,325]}[mapId];expect(calls.some(c=>c.name==='translate'&&c.args[0]===spot[0]&&c.args[1]===spot[1])).toBe(true);
  expect(calls.some(c=>c.name==='fillText'&&c.args[0]==='AI')).toBe(false);
  expect(calls.some(c=>c.name==='stroke'&&c.stroke==='#9b9c83')).toBe(false);
 });
});
describe('P2 held weapons and exact motion',()=>{
 it.each(Object.keys(DEFAULT_HELD_WEAPONS))('mounts the correct %s default only on the board',kind=>{
  expect(heldWeapon(pet(kind))).toMatchObject({id:DEFAULT_HELD_WEAPONS[kind],style:COMBAT_STYLES[kind]});
  expect(heldWeapon(pet(kind,false))).toBeNull();
  const art=image(DEFAULT_HELD_WEAPONS[kind]);vi.spyOn(assets,'get').mockImplementation(id=>id===DEFAULT_HELD_WEAPONS[kind]?art:undefined);
  const state=new BattleEngine({ai:false,autoWaves:false}).state;state.units=[pet(kind)];const {renderer,calls}=surface();renderer.draw(state,.1);
  expect(calls.some(c=>c.name==='drawImage'&&c.args[0]===art)).toBe(true);
 });
 it('resolves equipped sprite, rarity progression and signature awakening',()=>{
  expect(Object.keys(DEFAULT_HELD_WEAPONS)).toHaveLength(16);for(const kind of ['bee','panda','shovel'])expect(heldWeapon(pet(kind))).toBeNull();
  expect(heldWeapon(pet('kungfu_po'))?.scale).toBe(.95);
  expect(heldWeapon(pet('kungfu_po'),{equippedWeapons:{kungfu_po:'m10_bamboo_staff'}})).toMatchObject({id:'weapon_m10_bamboo_staff',scale:1.52,awakened:true});
  expect(heldWeapon(pet('kungfu_po'),{equippedWeapons:{kungfu_po:'m01_swatter'}})).toMatchObject({id:'weapon_m01_swatter',scale:WEAPON_RARITY_SCALES[0],awakened:false});
  for(const weapon of Object.values(WEAPONS)){
   const kind=weapon.family==='melee'?'kungfu_po':weapon.family==='ranged'?'meowfia':'zen_master';
   expect(heldWeapon(pet(kind),{equippedWeapons:{[kind]:weapon.id}})).toMatchObject({id:`weapon_${weapon.id}`,scale:WEAPON_RARITY_SCALES[weapon.rarity]});
  }
 });
 it('spins 2.1π around 46/54px, thrusts 28px and recoils 10px',()=>{
  const corgi=pet('corgi');corgi.attackAnim=1;const start=weaponPose(corgi,0);corgi.attackAnim=.00001;const end=weaponPose(corgi,0);expect(end.rotation-start.rotation).toBeCloseTo(2.1*Math.PI,3);expect(Math.hypot(start.x,start.y)).toBeCloseTo(46);
  const po=pet('kungfu_po');po.attackAnim=1;expect(Math.hypot(weaponPose(po,0).x,weaponPose(po,0).y)).toBeCloseTo(54);
  const spear=pet('hedgehog');spear.attackAngle=0;spear.attackAnim=.5;expect(weaponPose(spear,0).extension).toBeCloseTo(28);
  const gun=pet('meowfia');gun.attackAnim=1;expect(weaponPose(gun,0).recoil).toBe(10);expect(weaponPose(gun,0).muzzle).toBe(true);gun.attackAnim=.5;expect(weaponPose(gun,0).muzzle).toBe(false);
  corgi.attackAnim=.5;corgi.facing=-1;expect(bodyPose(corgi).x).toBeLessThan(0);expect(bodyPose(corgi).scaleX).toBeGreaterThan(0);
 });
 it('winds up for 25% then cleaves 185 degrees and reverses twin blades',()=>{
  const unit=pet('samurai_doge');unit.attackAnim=.75;const start=weaponPose(unit,0).rotation;unit.attackAnim=.000001;expect(weaponPose(unit,0).rotation-start).toBeCloseTo(185*Math.PI/180,4);
  const cat=pet('puss_in_hat');cat.attackAnim=1;expect(weaponPose(cat,0).rotation).toBeCloseTo(0);cat.attackAnim=.875;expect(weaponPose(cat,0).rotation).toBeCloseTo(-32.5*Math.PI/180);cat.attackAnim=.75;expect(weaponPose(cat,0).rotation).toBeCloseTo(-65*Math.PI/180);
  cat.attackAnim=.5625;const first=weaponPose(cat,0).rotation;cat.attackAnim=.1875;expect(weaponPose(cat,0).rotation).toBeCloseTo(first);
 });
 it.each(['m01_swatter','r06_pressure_washer'])('normalizes the actual %s axis and muzzle transform when aimed left/right',id=>{
  const kind=id[0]==='m'?'kungfu_po':'meowfia',art=image(`weapon_${id}`),flash=image('vfx_muzzle_flash');vi.spyOn(assets,'get').mockImplementation(key=>key===`weapon_${id}`?art:key==='vfx_muzzle_flash'?flash:undefined);
  // Track the real matrix stack at drawImage; a list of isolated rotate calls cannot prove composition.
  for(const angle of [0,Math.PI]){
   let transform=[1,0,0,1,0,0];const stack:number[][]=[],draws:{image:unknown;matrix:number[]}[]=[];
   const {c}=surface();const tracked=new Proxy(c,{get(target,key:string){if(key==='save')return ()=>stack.push([...transform]);if(key==='restore')return ()=>{transform=stack.pop()!;};if(key==='translate')return (x:number,y:number)=>{transform[4]+=transform[0]*x+transform[2]*y;transform[5]+=transform[1]*x+transform[3]*y;};if(key==='rotate')return (a:number)=>{const [x,y,u,v]=transform,co=Math.cos(a),si=Math.sin(a);transform[0]=x*co+u*si;transform[1]=y*co+v*si;transform[2]=u*co-x*si;transform[3]=v*co-y*si;};if(key==='drawImage')return (im:unknown)=>draws.push({image:im,matrix:[...transform]});return Reflect.get(target,key);}});
   const unit=pet(kind);unit.attackAngle=angle;unit.attackAnim=1;drawHeldWeapon(tracked,unit,0,{equippedWeapons:{[kind]:id}});
   // Independent hand-measured PNG landmarks, rather than reading the implementation's axis.
   const axis=id==='m01_swatter'?{from:[40/256,218/256],tip:[174/256,70/256]}:{from:[94/256,145/256],tip:[194/256,84/256]};
   const weapon=draws.find(d=>d.image===art)!,dx=axis.tip[0]-axis.from[0],dy=axis.tip[1]-axis.from[1],pose=weaponPose(unit,0),size=57*heldWeapon(unit,{equippedWeapons:{[kind]:id}})!.scale;
   expect(Math.atan2(weapon.matrix[1]*dx+weapon.matrix[3]*dy,weapon.matrix[0]*dx+weapon.matrix[2]*dy)).toBeCloseTo(pose.rotation,5);
   if(id[0]==='r'){
    const muzzle=draws.find(d=>d.image===flash)!,tipX=(axis.tip[0]-.5)*size,tipY=(axis.tip[1]-.5)*size;
    expect(muzzle.matrix[4]).toBeCloseTo(weapon.matrix[4]+weapon.matrix[0]*tipX+weapon.matrix[2]*tipY,5);expect(muzzle.matrix[5]).toBeCloseTo(weapon.matrix[5]+weapon.matrix[1]*tipX+weapon.matrix[3]*tipY,5);
   }
  }
 });
 it('explicitly authors axes for every equipped weapon instead of family guesses',()=>{for(const id of Object.keys(WEAPONS)){expect(WEAPON_ART_AXES[`weapon_${id}`]).toBeDefined();expect(Number.isFinite(weaponArtGeometry(`weapon_${id}`).rotation)).toBe(true);}});
 it('retains a visible procedural mount and muzzle when optional images fail',()=>{
  const {c,calls}=surface();vi.spyOn(assets,'get').mockReturnValue(undefined);const gun=pet('meowfia');gun.attackAnim=1;
  expect(()=>drawHeldWeapon(c,gun,.1,{equippedWeapons:{meowfia:'r10_acorn_minigun'}})).not.toThrow();
  expect(calls.some(c=>c.name==='fill'&&c.fill==='#ffd47a')).toBe(true);
  expect(calls.some(c=>c.name==='fill'&&c.fill==='#9bad8e')).toBe(true);
 });
});
describe('P2 captured combat effects and bench tools',()=>{
 function occupiedNestPreview(engine:BattleEngine,source:Unit){
  const {renderer,calls}=surface();renderer.draw(engine.state,0,{draggingId:source.id,pointer:{x:402,y:656}});
  const nest=calls.findIndex(call=>call.name==='roundRect'&&call.args[0]===356&&call.args[1]===610&&call.args[2]===92&&call.args[3]===92&&call.args[4]===19);
  expect(nest).toBeGreaterThanOrEqual(0);
  return {fill:calls[nest+1].fill,stroke:calls[nest+2].stroke};
 }
 it.each([['shovel','hamster'],['hamster','shovel'],['shovel','shovel']])('previews the legal bench %s to %s swap as valid',(sourceKind,targetKind)=>{
  const engine=new BattleEngine({autoWaves:false}),source=pet(sourceKind,false),target={...pet(targetKind,false),id:11,location:{zone:'bench' as const,slot:1}};
  engine.state.units=[source,target];const preview=occupiedNestPreview(engine,source);
  expect(engine.move(source.id,{zone:'bench',slot:1})).toMatchObject({ok:true,key:'hint.swapped'});
  expect(source.location).toEqual({zone:'bench',slot:1});expect(target.location).toEqual({zone:'bench',slot:0});
  expect(preview).toEqual({fill:'#efe8bf',stroke:'#5f9b8c'});
 });
 it('previews a legal pet merge into an occupied nest as valid',()=>{
  const engine=new BattleEngine({autoWaves:false}),source=pet('hamster',false),target={...pet('hamster',false),id:11,location:{zone:'bench' as const,slot:1}};
  engine.state.units=[source,target];const preview=occupiedNestPreview(engine,source);
  expect(engine.move(source.id,{zone:'bench',slot:1})).toMatchObject({ok:true,key:'hint.merged'});
  expect(engine.state.units).toHaveLength(1);expect(engine.state.units[0]).toMatchObject({level:2,location:{zone:'bench',slot:1}});
  expect(preview).toEqual({fill:'#efe8bf',stroke:'#5f9b8c'});
 });
 it('keeps a board pet targeting a bench shovel invalid',()=>{
  const engine=new BattleEngine({autoWaves:false}),source=pet('hamster'),target={...pet('shovel',false),id:11,location:{zone:'bench' as const,slot:1}};
  engine.state.units=[source,target];const before=structuredClone(engine.state.units),preview=occupiedNestPreview(engine,source);
  expect(engine.move(source.id,{zone:'bench',slot:1})).toMatchObject({ok:false,key:'hint.toolOnly'});
  expect(engine.state.units).toEqual(before);expect(preview).toEqual({fill:'#efd7c6',stroke:'#d28e78'});
 });
 it.each([
  ['hamster','shovel','source','washing','m2.washing'],
  ['shovel','hamster','target','washing','m2.washing'],
  ['hamster','hamster','source','washing','m2.washing'],
  ['hamster','hamster','target','washing','m2.washing'],
  ['hamster','hamster','source','mergeLock','hint.mergeLocked'],
  ['hamster','hamster','target','mergeLock','hint.mergeLocked'],
 ])('keeps %s to %s invalid when the %s has %s',(sourceKind,targetKind,locked,restriction,key)=>{
  const engine=new BattleEngine({autoWaves:false}),source=pet(sourceKind,false),target={...pet(targetKind,false),id:11,location:{zone:'bench' as const,slot:1}};
  const unit=locked==='source'?source:target;if(restriction==='washing')unit.washing=1;else unit.statuses.MERGE_LOCK=1;
  engine.state.units=[source,target];const before=structuredClone(engine.state.units),preview=occupiedNestPreview(engine,source);
  expect(engine.move(source.id,{zone:'bench',slot:1})).toMatchObject({ok:false,key});
  expect(engine.state.units).toEqual(before);expect(preview).toEqual({fill:'#efd7c6',stroke:'#d28e78'});
 });
 it.each(['kungfu_po','puss_in_hat'])('keeps captured %s art/size/enhancement after moving, unequipping or deleting its source',kind=>{
  const engine=new BattleEngine({autoWaves:false,loadouts:{player:{equippedWeapons:{[kind]:kind==='kungfu_po'?'m10_bamboo_staff':'m09_cat_blade'}}}});engine.start();engine.grant(kind);const source=engine.state.units[0];source.location={zone:'board',col:2,row:1};source.empowered=1;const enemy=engine.spawnEnemy('rat','player');Object.assign(enemy,{progress:2,col:2,row:0,hp:100000,maxHp:100000,speed:0});engine.tick(.05);
  const slash=engine.state.events.find(v=>v.type==='slash')!;slash.age=.1;engine.state.events=[slash];const sprites=new Map(['vfx_slash_spin','vfx_slash_heavy','vfx_slash_cross','vfx_slash_crescent'].map(id=>[id,image(id)]));vi.spyOn(assets,'get').mockImplementation(id=>sprites.get(id));
  const render=()=>{const {renderer,calls}=surface();renderer.draw(engine.state,.1);return calls.filter(c=>c.name==='drawImage'&&[...sprites.values()].includes(c.args[0] as HTMLImageElement)).map(c=>c.args);};
  const before=render();expect(before.map(a=>(a[0] as unknown as {id:string}).id)).toContain(kind==='kungfu_po'?'vfx_slash_heavy':'vfx_slash_cross');expect(before[0].slice(3)).toEqual(kind==='kungfu_po'?[185,185]:[112,112]);
  source.location={zone:'bench',slot:0};engine.state.sides.player.loadout.equippedWeapons={};expect(render()).toEqual(before);engine.state.units=[];engine.state.events.push({id:999,type:'damage',side:'player',col:2,row:0,value:999,color:'#f16941',age:.01,duration:.65});expect(render()).toEqual(before);
 });
 it('does not enhance an ordinary captured spin when unrelated critical text appears',()=>{
  const engine=new BattleEngine({autoWaves:false});engine.start();engine.grant('kungfu_po');engine.state.units[0].location={zone:'board',col:2,row:1};const enemy=engine.spawnEnemy('rat','player');Object.assign(enemy,{progress:2,col:2,row:0,hp:100000,maxHp:100000,speed:0});engine.tick(.05);const slash=engine.state.events.find(v=>v.type==='slash')!;slash.age=.1;engine.state.events=[slash,{id:999,type:'damage',side:'player',col:2,row:0,value:999,color:'#f16941',age:.01,duration:.65}];const heavy=image('vfx_slash_heavy');vi.spyOn(assets,'get').mockImplementation(id=>id==='vfx_slash_heavy'?heavy:undefined);const {renderer,calls}=surface();renderer.draw(engine.state,.1);expect(calls.some(c=>c.name==='drawImage'&&c.args[0]===heavy)).toBe(false);
 });
 it.each(['spin360','cleave180','heavy_cleave','cross_slash','thrust'])('renders %s and survives missing source/art',effect=>{
  const {c,calls}=surface();const e:VisualEvent={id:1,type:'slash',side:'player',col:2,row:3,targetCol:3,targetRow:3,effect,age:.1,duration:.33};expect(drawCombatEvent(c,e,[])).toBe(true);expect(calls.some(c=>c.name==='stroke')).toBe(true);
 });
 it('uses captured projectile theme after source removal and draws food/death/hit art',()=>{
  const {c,calls}=surface();const sprites=new Map(['vfx_hit_burst','vfx_dust_puff'].map(id=>[id,image(id)]));vi.spyOn(assets,'get').mockImplementation(id=>sprites.get(id));
  for(const type of ['projectile','food','hit','death'] as const)expect(drawCombatEvent(c,{id:1,type,side:'player',col:1,row:1,targetCol:2,targetRow:1,effect:type==='projectile'?'ballin_rooster':undefined,value:8,age:.1,duration:1},[])).toBe(true);
  expect(calls.some(c=>c.name==='fill'&&c.fill==='#eda267')).toBe(true);expect(calls.some(c=>c.name==='fillText'&&c.args[0]==='+8')).toBe(true);
  for(const sprite of sprites.values())expect(calls.some(c=>c.name==='drawImage'&&c.args[0]===sprite)).toBe(true);
 });
 it('shows translated shovel label, partial repair and usable grass/pouch without merge markers',()=>{
  setLanguage('en');const state=new BattleEngine({ai:false,autoWaves:false}).state;state.units=[pet('shovel',false)];state.grid[2][0]='B';state.craterHits['0,2']=1;const {renderer,calls}=surface();renderer.draw(state,.1,{selectedId:10});
  expect(calls.some(c=>c.name==='fillText'&&c.args[0]==='DIG')).toBe(true);expect(calls.some(c=>c.name==='fillText'&&c.args[0]==='1/2')).toBe(true);
  expect(calls.some(c=>c.name==='stroke'&&c.stroke==='#c9a25a')).toBe(true);expect(calls.some(c=>c.name==='fillText'&&c.args[0]==='▲')).toBe(false);
 });
 it('uses the cone at 120px and overlays heavy art on awakened hero spin rings',()=>{
  const sprites=new Map(['vfx_thrust_cone','vfx_slash_spin','vfx_slash_heavy'].map(id=>[id,image(id)]));vi.spyOn(assets,'get').mockImplementation(id=>sprites.get(id));
  const {c,calls}=surface(),event:VisualEvent={id:1,type:'slash',side:'player',col:2,row:3,targetCol:3,targetRow:3,effect:'thrust',unitId:10,age:.1,duration:.33};drawCombatEvent(c,event,[pet('hedgehog')]);
  expect(calls.find(c=>c.name==='drawImage'&&c.args[0]===sprites.get('vfx_thrust_cone'))?.args.slice(3)).toEqual([120,120]);
  drawCombatEvent(c,{...event,effect:'spin360',presentation:{sourceKind:'kungfu_po',hero:true,awakened:true,empowered:false,critical:false,enhanced:true}},[pet('kungfu_po')]);
  for(const id of ['vfx_slash_spin','vfx_slash_heavy'])expect(calls.find(c=>c.name==='drawImage'&&c.args[0]===sprites.get(id))?.args.slice(3)).toEqual([185,185]);
 });
 it('shows B as valid for one pouch shovel or a bench tool with zero stored shovels',()=>{
  for(const bench of [false,true]){
   const state=new BattleEngine({ai:false,autoWaves:false}).state;state.grid[0][5]='B';state.sides.player.shovels=bench?0:1;if(bench)state.units=[pet('shovel',false)];
   const {renderer,calls}=surface();renderer.draw(state,0,bench?{selectedId:10,hover:{col:5,row:0}}:{shovel:true,hover:{col:5,row:0}});
   expect(calls.some(c=>c.name==='roundRect'&&c.args[0]===710&&c.args[1]===90)).toBe(true);
   expect(calls.some(c=>c.name==='stroke'&&c.stroke==='#5f9b8c')).toBe(true);
  }
 });
 it.each(['washer','clay','milk_bottle','whistle'])('never gives the bench shovel a %s target outline',propId=>{
  const state=new BattleEngine({ai:false,autoWaves:false}).state;state.units=[pet('shovel',false)];const {renderer,calls}=surface();renderer.draw(state,0,{propId});
  expect(calls.some(c=>c.name==='ellipse'&&c.args[0]===298&&c.args[1]===686&&Number(c.args[2])>=35)).toBe(false);
 });
 it('preserves core knock displacement and white flash during the P12 spawn/jello pose',()=>{
  const engine=new BattleEngine({ai:false,autoWaves:false});engine.spawnEnemy('rat','player');const enemy=engine.state.enemies[0];Object.assign(enemy,{id:0,progress:0,col:2,row:3,hitFlash:.14,knockX:5,knockY:0,size:1});
  const art=image('rat');vi.spyOn(assets,'get').mockImplementation(id=>id==='rat'?art:undefined);const {renderer,calls}=surface();renderer.draw(engine.state,0);
  expect(calls.some(c=>c.name==='translate'&&c.args[0]===437&&c.args[1]===436)).toBe(true);
  const scale=calls.find(c=>c.name==='scale'&&Number(c.args[0])<0)!;
  expect(Math.abs(Number(scale.args[0]))).toBeGreaterThan(.3);expect(Math.abs(Number(scale.args[0]))).toBeLessThan(.4);
  expect(Number(scale.args[1])).toBeGreaterThan(.3);expect(Number(scale.args[1])).toBeLessThan(.4);
  expect(calls.find(c=>c.name==='drawImage'&&c.args[0]===art)?.filter).toBe('brightness(0) invert(1)');
 });
 it('draws no projectile geometry for a captured melee kind',()=>{const {c,calls}=surface();expect(drawCombatEvent(c,{id:1,type:'projectile',side:'player',col:1,row:1,targetCol:2,targetRow:1,effect:'corgi',age:.1,duration:.25},[])).toBe(true);expect(calls.filter(c=>!['save','restore'].includes(c.name))).toHaveLength(0);});
 it('ships exactly the 255 safe optional sprite IDs',()=>{const ids=JSON.parse(readFileSync('public/assets/sprites/manifest.json','utf8'));expect(ids).toHaveLength(255);for(const id of [...Object.values(DEFAULT_HELD_WEAPONS),'vfx_slash_spin','vfx_muzzle_flash'])expect(ids).toContain(id);});
});
