import {afterEach,describe,expect,it,vi} from 'vitest';
import {BattleEngine} from '../src/core/BattleEngine';
import {StickerRenderer} from '../src/render/StickerRenderer';
import {assets} from '../src/render/AssetRegistry';
import {HEROES} from '../src/config/heroes';
import {MAPS,STAGE} from '../src/config/maps';
import {t} from '../src/i18n/i18n';
import type {BattleState,Interaction,Unit} from '../src/core/types';
type Call={name:string;args:unknown[];fill:unknown;stroke:unknown};
function surface(){
 const calls:Call[]=[],values:Record<string,unknown>={globalAlpha:1};
 const context=new Proxy(values,{get(target,key:string){if(key in target)return target[key];if(key==='measureText')return (s:string)=>({width:s.length*8});if(key==='createLinearGradient'||key==='createRadialGradient')return ()=>({addColorStop(){}});return (...args:unknown[])=>calls.push({name:key,args,fill:target.fillStyle,stroke:target.strokeStyle});},set(target,key:string,value){target[key]=value;return true;}}) as unknown as CanvasRenderingContext2D;
 return {calls,renderer:new StickerRenderer({width:0,height:0,getContext:()=>context} as unknown as HTMLCanvasElement)};
}
const image={complete:true,naturalWidth:256,naturalHeight:256} as HTMLImageElement;
afterEach(()=>vi.restoreAllMocks());
function unit(engine:BattleEngine,kind:string,location:Unit['location']):Unit {engine.grant(kind);const u=engine.state.units.at(-1)!;u.location=location;return u;}
describe('P1 map and object pipeline',()=>{
 it.each(Object.keys(MAPS) as Array<keyof typeof MAPS>)('keeps %s image uncovered by static tile blocks, with visible open and broken cells',mapId=>{
   vi.spyOn(assets,'get').mockImplementation(id=>id===`map_${mapId}`?image:undefined);
   const state=new BattleEngine({ai:false,autoWaves:false}).state;state.mapId=mapId;state.grid=MAPS[mapId].grid.map(row=>[...row]);state.grid[6][0]='O';state.grid[6][1]='B';
   const {renderer,calls}=surface();expect(renderer.assets).toBe(assets);renderer.draw(state,.2);
   const mapIndex=calls.findIndex(c=>c.name==='drawImage'&&c.args[0]===image);expect(mapIndex).toBeGreaterThan(calls.findIndex(c=>c.name==='clip'));
   expect(calls[mapIndex].args.slice(1)).toEqual([32,188,576,672]);
   expect(calls.some(c=>c.name==='fillRect'&&c.args[2]===96&&c.args[3]===96)).toBe(false);
   expect(calls.some(c=>c.name==='fill'&&c.fill==='rgba(255,248,232,0.78)')).toBe(true);
   expect(calls.some(c=>c.name==='lineTo'&&c.stroke==='#665c48')).toBe(true);
 });
 it('draws tile aliases and all object images while retaining a live orange stack',()=>{
   const images=new Map(['map_sunny_backyard','tile_open_sunny_backyard','tile_broken','capybara','orange','shovel','sprinkler','glue_trap_placed'].map(id=>[id,{...image,id} as unknown as HTMLImageElement]));
   vi.spyOn(assets,'get').mockImplementation(id=>images.get(id));
   const state=new BattleEngine({ai:false,autoWaves:false}).state;state.grid[6][0]='O';state.grid[6][1]='B';state.traps=[{id:1,side:'player',col:2,row:5,charges:3,hitIds:[]}];state.events=[{id:4,type:'sprinkler',side:'player',col:5,row:6,points:[{col:5,row:6},{col:5,row:5}],age:.3,duration:1}];
   const {renderer,calls}=surface();renderer.draw(state,.3);
   for(const value of images.values())expect(calls.some(c=>c.name==='drawImage'&&c.args[0]===value)).toBe(true);
   expect(calls.some(c=>c.name==='fill'&&c.fill==='#f2ca62')).toBe(false);
   expect(calls.some(c=>c.name==='stroke'&&c.stroke==='#91d3df')).toBe(true);
   expect(calls.filter(c=>c.name==='drawImage'&&c.args[0]===images.get('orange')).length).toBe(state.sides.player.oranges);
 });
 it('omits legacy rival text even when a legacy opponent identity is supplied',()=>{
   const state=new BattleEngine({ai:false,autoWaves:false}).state;
   Object.assign(state,{opponent:{id:'test',name:{'zh-CN':'测试',en:'Test'},avatarId:'capybara',rankIndex:0}});
   const {renderer,calls}=surface();renderer.draw(state,0);expect(calls.some(c=>c.name==='fillText'&&c.args[0]==='AI')).toBe(false);
 });
});
describe('P1 complete merge targets and hero bases',()=>{
 it.each(['selected','dragged'] as const)('highlights all valid board and bench upgrades from a %s source',mode=>{
   const e=new BattleEngine({ai:false,autoWaves:false}),source=unit(e,'hamster',{zone:'bench',slot:0});unit(e,'hamster',{zone:'board',col:1,row:6});unit(e,'hamster',{zone:'bench',slot:1});unit(e,'squirrel',{zone:'bench',slot:2});
   const {renderer,calls}=surface();renderer.draw(e.state,.2,mode==='selected'?{selectedId:source.id}:{draggingId:source.id,pointer:{x:280,y:900}});
   const arrows=calls.filter(c=>c.name==='fillText'&&c.args[0]==='▲');expect(arrows).toHaveLength(2);
   expect(arrows.map(c=>c.args[1])).toEqual(expect.arrayContaining([176+25,STAGE.benchX+STAGE.benchStep+STAGE.benchSize/2+25]));
   const benchBackground=calls.reduce((last,c,i)=>c.name==='roundRect'&&c.args[0]===STAGE.benchX+STAGE.benchStep&&c.args[1]===STAGE.benchY?i:last,-1);
   expect(calls.indexOf(arrows.find(c=>Number(c.args[2])>STAGE.benchY-45)!)).toBeGreaterThan(benchBackground);
 });
 it('gives hero recipe targets gold double rings, stars and a merge capsule in both zones',()=>{
   const e=new BattleEngine({ai:false,autoWaves:false}),source=unit(e,'panda',{zone:'bench',slot:0});unit(e,'hat_bamboo',{zone:'board',col:1,row:6});unit(e,'hat_shades',{zone:'bench',slot:1});
   const {renderer,calls}=surface();renderer.draw(e.state,.3,{selectedId:source.id});
   expect(calls.filter(c=>c.name==='fillText'&&c.args[0]===t('p1.merge')).length).toBe(2);
   expect(calls.filter(c=>c.name==='stroke'&&c.stroke==='#d8aa46').length).toBeGreaterThanOrEqual(4);
   expect(calls.some(c=>c.name==='fill'&&c.fill==='#f1cf75')).toBe(true);
 });
 it.each([{shovel:true},{propId:'washer'}] as Interaction[])('suppresses merge suggestions in tool mode %j',mode=>{
   const e=new BattleEngine({ai:false,autoWaves:false}),source=unit(e,'hamster',{zone:'bench',slot:0});unit(e,'hamster',{zone:'bench',slot:1});
   const {renderer,calls}=surface();renderer.draw(e.state,.2,{selectedId:source.id,...mode});expect(calls.some(c=>c.name==='fillText'&&c.args[0]==='▲')).toBe(false);
 });
 it.each(Object.keys(HEROES))('gives %s gold disks and near-full energy rings on board and bench',kind=>{
   const e=new BattleEngine({ai:false,autoWaves:false});const board=unit(e,kind,{zone:'board',col:1,row:6}),bench=unit(e,kind,{zone:'bench',slot:0});board.energy=999;bench.energy=999;
   const {renderer,calls}=surface();renderer.draw(e.state,.2);
   expect(calls.filter(c=>c.name==='fill'&&c.fill==='#f3d58a')).toHaveLength(2);
   expect(calls.filter(c=>c.name==='stroke'&&c.stroke==='#bb9146')).toHaveLength(2);
   expect(calls.filter(c=>c.name==='stroke'&&c.stroke==='#f1c966')).toHaveLength(2);
 });
});
