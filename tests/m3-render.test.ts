import {describe,expect,it} from 'vitest';
import {BattleEngine} from '../src/core/BattleEngine';
import {StickerRenderer} from '../src/render/StickerRenderer';
import {drawEnemyArt} from '../src/render/StickerArt';
import {drawM3Event} from '../src/render/M3Effects';
import {avatarSticker,weaponSticker} from '../src/render/M3Art';
import {WEAPONS} from '../src/config/weapons';
import {MAPS} from '../src/config/maps';
import type {VisualEvent} from '../src/core/types';

type Call={name:string;args:unknown[];fill:unknown;stroke:unknown};
function surface(){
  const calls:Call[]=[],values:Record<string,unknown>={globalAlpha:1};
  const context=new Proxy(values,{get(target,key:string){
    if(key in target)return target[key];
    if(key==='measureText')return (s:string)=>({width:s.length*8});
    if(key==='createLinearGradient'||key==='createRadialGradient')return ()=>({addColorStop(){}});
    return (...args:unknown[])=>calls.push({name:key,args,fill:target.fillStyle,stroke:target.strokeStyle});
  },set(target,key:string,value){target[key]=value;return true;}}) as unknown as CanvasRenderingContext2D;
  return {calls,context,renderer:new StickerRenderer({width:0,height:0,getContext:()=>context} as unknown as HTMLCanvasElement)};
}
const avatarIds=['capybara','hamster','squirrel','bee','cat_swordsman','doge_agent','goose_bully','kungfu_panda','rooster_star','frog_king','market_coon','salted_fish','bamboo_master','sakura_capy','corgi_crown','zen_capy'];
describe('M3 vector sticker output',()=>{
  it('gives every avatar and weapon a distinct geometry, with no scripts, links, emoji or text placeholders',()=>{
    for(const [ids,draw] of [[avatarIds,avatarSticker],[Object.keys(WEAPONS),weaponSticker]] as const){
      const shapes=ids.map(id=>draw(id,72));
      for(const svg of shapes){expect(svg).toContain('viewBox=');expect(svg).toContain('width="72"');expect(svg).toMatch(/<(path|ellipse|polygon)/);expect(svg).not.toMatch(/<text|<script|href=|https?:|onload=|[\u{1F300}-\u{1FAFF}]/u);}
      // Strip identifying metadata and paint so changing only a label/color cannot pass.
      expect(new Set(shapes.map(svg=>svg.replace(/(?:aria-label|data-sticker|fill|stroke)="[^"]*"/g,''))).size).toBe(ids.length);
    }
  });
  it('normalizes unsafe ids and invalid sizes into a safe usable fallback',()=>{
    expect(avatarSticker('<script>',NaN)).not.toContain('<script>');
    expect(weaponSticker('" onload="alert(1)',-20)).toContain('width="48"');
  });
});
describe('M3 canvas integration',()=>{
  it.each(['sunny_backyard','sakura_onsen','midnight_kitchen','cat_tower_maze'] as const)('draws %s palette and follows its own route',id=>{
    const state=new BattleEngine({ai:false,autoWaves:false}).state;state.mapId=id;state.grid=MAPS[id].grid;
    const {renderer,calls}=surface();renderer.draw(state,.2);
    expect(calls.some(c=>c.name==='fillRect'&&c.fill===MAPS[id].theme.road)).toBe(true);
    const a=MAPS[id].paths.player[1],b=MAPS[id].paths.player[2],rotation=Math.atan2(b.row-a.row,b.col-a.col);
    expect(calls.some((c,i)=>c.name==='translate'&&c.args[0]===80+a.col*96&&c.args[1]===236+a.row*96&&calls[i+1]?.name==='rotate'&&calls[i+1].args[0]===rotation)).toBe(true);
  });
  it('hides only damage text, retaining projectile and skill geometry',()=>{
    const state=new BattleEngine({ai:false,autoWaves:false}).state;
    state.events=[{id:1,type:'damage',side:'player',col:2,row:4,value:987,age:.2,duration:1},{id:2,type:'projectile',side:'player',col:2,row:4,targetCol:3,targetRow:7,age:.2,duration:1}];
    const hidden=surface();hidden.renderer.draw(state,.2,{showDamageNumbers:false});
    expect(hidden.calls.some(c=>c.name==='fillText'&&c.args[0]==='−987')).toBe(false);
    expect(hidden.calls.some(c=>c.name==='translate'&&c.args[0]===291.2)).toBe(true);
    const shown=surface();shown.renderer.draw(state,.2);
    expect(shown.calls.some(c=>c.name==='fillText'&&c.args[0]==='−987')).toBe(true);
  });
  it('renders confusion as a spiral rather than another knockdown star ring',()=>{
    const state=new BattleEngine({ai:false,autoWaves:false});state.grant('hamster');state.state.units[0].statuses.CONFUSED=5;
    const {renderer,calls}=surface();renderer.draw(state.state,.2);
    expect(calls.filter(c=>c.name==='lineTo'&&c.stroke==='#9a7db4').length).toBeGreaterThan(15);
  });
  it.each(['diva_kitty','buff_roo','hornet_queen','screaming_marmot','trash_coon','dj_rat_king'])('draws a recognizable %s silhouette and captured skill targets',kind=>{
    const own=surface(),fallback=surface();drawEnemyArt(own.context,kind,.3);drawEnemyArt(fallback.context,'unknown',.3);
    expect(own.calls).not.toEqual(fallback.calls);
    const state=new BattleEngine({ai:false,autoWaves:false}).state;
    state.events=[{id:4,type:'boss_skill',side:'player',col:2,row:4,points:[{col:4,row:5}],effect:kind,age:.4,duration:1} as VisualEvent];
    const {renderer,calls}=surface();renderer.draw(state,.4);
    expect(calls.some(c=>c.name==='translate'&&c.args[0]===464&&c.args[1]===716)).toBe(true);
  });
  it('gives killer bees, charmed rats and bone shields visible identifying marks',()=>{
    const bee=surface(),rat=surface(),normal=surface();drawEnemyArt(bee.context,'killer_bee',0);drawEnemyArt(rat.context,'charmed_rat',0);drawEnemyArt(normal.context,'rat',0);
    expect(bee.calls).not.toEqual(normal.calls);expect(rat.calls).not.toEqual(normal.calls);
    const engine=new BattleEngine({ai:false,autoWaves:false});engine.spawnEnemy('rat','player');engine.state.enemies[0].boneShield=true;
    const s=surface();s.renderer.draw(engine.state,0);expect(s.calls.some(c=>c.name==='fill'&&c.fill==='#f4e7c8')).toBe(true);
  });
  it('uses transparent Canvas fills for shockwave rings',()=>{
    const {context,calls}=surface();drawM3Event(context,{id:3,type:'boss_skill',effect:'buff_roo',side:'player',col:2,row:4,age:.3,duration:1,points:[{col:3,row:4}]});
    // Canvas rejects the SVG-only color "none" and otherwise inherits an opaque fill.
    expect(calls.filter(c=>c.name==='fill').every(c=>c.fill!=='none')).toBe(true);
  });
});
