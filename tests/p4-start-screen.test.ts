import {afterEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {assets} from '../src/render/AssetRegistry';
import {StickerRenderer} from '../src/render/StickerRenderer';
import {MAP_IDS} from '../src/config/maps';
import * as art from '../src/render/StickerArt';

function surface(){
 const calls:{name:string;args:unknown[];fill:unknown;stroke:unknown;alpha:unknown}[]=[],values:Record<string,any>={globalAlpha:1};
 const context=new Proxy(values,{get(v,k:string){if(k in v)return v[k];if(k==='measureText')return (s:string)=>({width:s.length*8});if(k.includes('Gradient'))return ()=>({addColorStop(){}});return (...args:unknown[])=>calls.push({name:k,args,fill:v.fillStyle,stroke:v.strokeStyle,alpha:v.globalAlpha});},set(v,k:string,a){v[k]=a;return true;}}) as CanvasRenderingContext2D;
 return {calls,renderer:new StickerRenderer({getContext:()=>context,width:0,height:0} as unknown as HTMLCanvasElement)};
}
const splash={complete:true,naturalWidth:1280,naturalHeight:720} as HTMLImageElement;
afterEach(()=>vi.restoreAllMocks());

describe('P4 dedicated splash rendering',()=>{
 it.each(MAP_IDS)('keeps the full-bleed gathering scene on %s without requesting battle tiles',mapId=>{
  const get=vi.spyOn(assets,'get').mockImplementation(id=>id==='start_splash_bg'?splash:undefined);
  const {renderer,calls}=surface();renderer.drawPreview(mapId,2,7);
  expect(calls.filter(c=>c.name==='drawImage').map(c=>c.args)).toEqual([[splash,0,0,1280,720]]);
  expect(get.mock.calls.some(([id])=>id.startsWith('map_')||id==='tile_open')).toBe(false);
  expect(calls.some(c=>c.name==='strokeRect')).toBe(false);
 });
 it('falls back to a central hot spring with pets instead of a battlefield when artwork is unavailable',()=>{
  vi.spyOn(assets,'get').mockReturnValue(undefined);
  const capy=vi.spyOn(art,'drawCapybaraArt'),pets=vi.spyOn(art,'drawUnitArt');
  const {renderer,calls}=surface();renderer.drawPreview('sakura_onsen',3,5);
  expect(capy.mock.calls).toHaveLength(1);expect(capy.mock.calls[0][2]).toBe(5);
  expect(new Set(pets.mock.calls.map(c=>c[1])).size).toBeGreaterThanOrEqual(5);
  expect(calls.some(c=>c.name==='translate'&&c.args[0]===640)).toBe(true);
  expect(calls.some(c=>c.name==='strokeRect')).toBe(false);
 });
 it('animates five soft steam wisps and changes ambient shapes across the four map moods',()=>{
  vi.spyOn(assets,'get').mockImplementation(id=>id==='start_splash_bg'?splash:undefined);
  const {renderer,calls}=surface();
  renderer.drawPreview('sunny_backyard',1);
  const steam=calls.filter(c=>c.name==='bezierCurveTo');expect(steam).toHaveLength(5);
  const first=JSON.stringify(calls);
  calls.length=0;renderer.drawPreview('sunny_backyard',2);expect(JSON.stringify(calls)).not.toBe(first);
  const moods=MAP_IDS.map(map=>{calls.length=0;renderer.drawPreview(map,2);return JSON.stringify(calls.filter(c=>c.name==='fill'));});
  expect(new Set(moods).size).toBe(4);
 });
 it.each([
  ['start_splash_bg',1280,720],['title_logo_zh',960,320],['title_logo_en',960,320],
  ['ui_btn_start_zh',520,220],['ui_btn_start_en',520,220],['ui_trophy_rank',256,256],['ui_map_sign',256,256],
 ] as const)('ships %s at its intended aspect ratio', (id,width,height)=>{
  const manifest=JSON.parse(readFileSync('public/assets/sprites/manifest.json','utf8'));
  expect(manifest).toContain(id);
  const data=readFileSync(`public/assets/sprites/${id}.png`);
  expect([data.readUInt32BE(16),data.readUInt32BE(20)]).toEqual([width,height]);
 });
});
