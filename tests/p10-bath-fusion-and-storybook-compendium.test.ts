import {afterEach,describe,expect,it,vi} from 'vitest';
import {readFileSync,readdirSync} from 'node:fs';
import {assets} from '../src/render/AssetRegistry';
import {StickerRenderer} from '../src/render/StickerRenderer';
import {BattleEngine} from '../src/core/BattleEngine';
import {GUARDIAN_BATH_SPOTS} from '../src/config/guardianBaths';
import {P10_SCENE_IDS,sceneSticker} from '../src/ui/stickers';
import type {BattleState,MapId} from '../src/core/types';

type Matrix=[number,number,number,number,number,number];
type Call={name:string;args:unknown[];matrix:Matrix;stroke:unknown;lineWidth:unknown};
function surface(){
 const calls:Call[]=[],values:Record<string,unknown>={globalAlpha:1};let matrix:Matrix=[1,0,0,1,0,0];const stack:Matrix[]=[];
 const multiply=(n:Matrix)=>{const[a,b,c,d,e,f]=matrix,[g,h,i,j,k,l]=n;matrix=[a*g+c*h,b*g+d*h,a*i+c*j,b*i+d*j,a*k+c*l+e,b*k+d*l+f];};
 const context=new Proxy(values,{get(v,k:string){if(k in v)return v[k];if(k==='measureText')return(s:string)=>({width:s.length*8});return(...args:unknown[])=>{
  calls.push({name:k,args,matrix:[...matrix],stroke:v.strokeStyle,lineWidth:v.lineWidth});const a=args as number[];
  if(k==='save')stack.push([...matrix]);if(k==='restore')matrix=stack.pop()!;
  if(k==='translate')multiply([1,0,0,1,a[0],a[1]]);if(k==='scale')multiply([a[0],0,0,a[1],0,0]);
  if(k==='rotate')multiply([Math.cos(a[0]),Math.sin(a[0]),-Math.sin(a[0]),Math.cos(a[0]),0,0]);
 };},set(v,k:string,a){v[k]=a;return true;}}) as unknown as CanvasRenderingContext2D;
 const renderer=new StickerRenderer({getContext:()=>context,width:0,height:0} as unknown as HTMLCanvasElement);
 return{calls,renderer:renderer as unknown as {drawGuardian(map:MapId,oranges:number,seconds:number):void;observeOranges(s:BattleState,dt:number):void;orangeMotions:{x:number;y:number;targetY:number;add:boolean}[]}};
}
const image=(id:string)=>({id,complete:true,naturalWidth:256,naturalHeight:256} as unknown as HTMLImageElement);
const expected:{id:MapId;x:number;y:number;size:number;orangeY:number}[]=[
 {id:'sunny_backyard',x:1053.5,y:531,size:74,orangeY:495},
 {id:'sakura_onsen',x:263,y:490,size:90,orangeY:446},
 {id:'midnight_kitchen',x:1055,y:323,size:80,orangeY:284},
 {id:'cat_tower_maze',x:1054,y:325,size:74,orangeY:289},
];
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
describe('P10 native map bath fusion',()=>{
 it.each(expected)('anchors the tub-free guardian, ripples and orange stack on $id',spot=>{
  const soak=image('capybara_soak'),orange=image('orange'),old=image('capybara');
  vi.spyOn(assets,'get').mockImplementation(id=>({capybara_soak:soak,orange,capybara:old}[id]));
  const {renderer,calls}=surface();renderer.drawGuardian(spot.id,3,0);
  const art=calls.filter(c=>c.name==='drawImage');expect(art.filter(c=>c.args[0]===soak)).toHaveLength(1);
  // P15: the guardian now breathes (bob, squash, slow tilt) but stays anchored on the painted water centre.
  const body=art.find(c=>c.args[0]===soak)!;expect(Math.abs(body.matrix[4]-spot.x)).toBeLessThan(1);expect(Math.abs(body.matrix[5]-spot.y)).toBeLessThan(1);
  for(const [value,ideal] of [[body.matrix[0],1],[body.matrix[3],1],[body.matrix[1],0],[body.matrix[2],0]])expect(Math.abs(value-ideal)).toBeLessThan(.035);
  expect(body.args.slice(1)).toEqual([-spot.size/2,-spot.size/2,spot.size,spot.size]);expect(art.some(c=>c.args[0]===old)).toBe(false);
  const fruit=art.filter(c=>c.args[0]===orange);expect(fruit).toHaveLength(3);
  fruit.forEach((c,i)=>expect(Math.abs(c.matrix[5]-(spot.orangeY-15*i))).toBeLessThan(2));
  const water=GUARDIAN_BATH_SPOTS[spot.id].water;
  expect(calls.some(c=>c.name==='ellipse'&&c.args[0]===water.x&&c.args[1]===water.y&&c.args[2]===water.rx+1&&c.args[3]===water.ry+1)).toBe(true);
  expect(calls.some(c=>c.name==='clip')).toBe(true);
  expect(GUARDIAN_BATH_SPOTS[spot.id]).toMatchObject({x:spot.x,y:spot.y,size:spot.size,orangeBaseY:spot.orangeY-spot.y});
 });
 it.each(expected)('keeps the dizzy guardian upright inside the $id water',spot=>{
  const dizzy=image('capybara_soak_dizzy');vi.spyOn(assets,'get').mockImplementation(id=>id==='capybara_soak_dizzy'?dizzy:undefined);
  const{renderer,calls}=surface();renderer.drawGuardian(spot.id,0,1);
  const body=calls.find(c=>c.name==='drawImage'&&c.args[0]===dizzy)!;
  // A gentle dizzy sway (≤0.05 rad) replaces the old rigid shake; the guardian never tips over.
  expect(Math.abs(body.matrix[1])).toBeLessThan(.06);expect(Math.abs(body.matrix[2])).toBeLessThan(.06);
  expect(Math.abs(body.matrix[4]-spot.x)).toBeLessThan(2.5);expect(Math.abs(body.matrix[5]-spot.y)).toBeLessThan(3);
  expect(calls.filter(c=>c.name==='rotate').every(c=>Math.abs(Number(c.args[0]))<=.06)).toBe(true);
 });
 it.each(expected)('starts orange loss and gain from the aligned $id stack',spot=>{
  const state=new BattleEngine({mapId:spot.id,autoWaves:false}).state,{renderer}=surface();state.sides.player.oranges=3;
  renderer.observeOranges(state,0);state.sides.player.oranges=2;renderer.observeOranges(state,0);
  expect(renderer.orangeMotions[0]).toMatchObject({x:spot.x,y:spot.orangeY-30,targetY:spot.orangeY-15,add:false});
  state.sides.player.oranges=3;renderer.observeOranges(state,0);
  expect(renderer.orangeMotions[1]).toMatchObject({x:spot.x,y:spot.orangeY-15,targetY:spot.orangeY-30,add:true});
 });
 it('never reuses the old tub while the soaking PNG is absent in a browser',()=>{
  vi.stubGlobal('Image',class{});const old=image('capybara');vi.spyOn(assets,'get').mockImplementation(id=>id==='capybara'?old:undefined);
  const{renderer,calls}=surface();renderer.drawGuardian('sakura_onsen',0,0);
  expect(calls.some(c=>c.name==='drawImage')).toBe(false);expect(calls.some(c=>c.name==='ellipse')).toBe(true);
  expect(calls.some(c=>c.name==='stroke'&&Number(c.lineWidth)>4)).toBe(false);
  expect(calls.filter(c=>c.name==='rotate').every(c=>Math.abs(Number(c.args[0]))<=.06)).toBe(true);
 });
});
describe('P10 art assets and transparent offline fallbacks',()=>{
 it('ships 290 unique PNGs and the four exact transparent art sizes',()=>{
  const root='public/assets/sprites/',ids=JSON.parse(readFileSync(root+'manifest.json','utf8')) as string[];
  expect(ids).toHaveLength(290);expect(new Set(ids).size).toBe(290);expect(readdirSync(root).filter(f=>f.endsWith('.png'))).toHaveLength(290);
  expect(P10_SCENE_IDS).toEqual(['capybara_soak','capybara_soak_dizzy','ui_compendium_peek_capy','ui_storybook_check']);
  for(const id of P10_SCENE_IDS){expect(ids).toContain(id);const png=readFileSync(root+id+'.png'),size=id==='ui_storybook_check'?128:256;
   expect([png.readUInt32BE(16),png.readUInt32BE(20),png[25]]).toEqual([size,size,6]);}
 });
 it('supplies distinct frame-free SVG art for all four new stickers',()=>{
  vi.spyOn(assets,'get').mockReturnValue(undefined);
  const svgs=P10_SCENE_IDS.map(id=>sceneSticker(id,'',78));expect(new Set(svgs).size).toBe(4);
  for(let i=0;i<svgs.length;i++){expect(svgs[i]).toContain('<svg');expect(svgs[i]).toContain(`data-sticker="${P10_SCENE_IDS[i]}"`);expect(svgs[i]).not.toContain('stroke="#fffdf6"');}
 });
});
