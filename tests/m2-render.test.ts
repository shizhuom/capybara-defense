import { describe, expect, it } from 'vitest';
import { BattleEngine } from '../src/core/BattleEngine';
import type { BattleState, Interaction, VisualEvent } from '../src/core/types';
import { StickerRenderer } from '../src/render/StickerRenderer';

type Call = { name:string; args:unknown[]; fill:unknown; stroke:unknown };
// Canvas is the rendering boundary: retain issued geometry and styles, with no DOM dependency.
function surface() {
  const calls:Call[]=[], values:Record<string,unknown>={globalAlpha:1};
  const context=new Proxy(values, {
    get(target,key:string) {
      if(key in target)return target[key];
      if(key==='measureText')return (text:string)=>({width:text.length*8});
      if(key==='createLinearGradient'||key==='createRadialGradient')return ()=>({addColorStop(){}});
      return (...args:unknown[])=>calls.push({name:key,args,fill:target.fillStyle,stroke:target.strokeStyle});
    },
    set(target,key:string,value){target[key]=value;return true;},
  }) as unknown as CanvasRenderingContext2D;
  const renderer=new StickerRenderer({width:0,height:0,getContext:()=>context} as unknown as HTMLCanvasElement);
  return {renderer,calls};
}
function state():BattleState {return new BattleEngine({ai:false,autoWaves:false}).state;}
function event(type:string,age:number,extra:Record<string,unknown>={}):VisualEvent {
  return {id:991,type,side:'player',col:0,row:3,age,duration:1.1,...extra} as unknown as VisualEvent;
}
function rendered(type:string,age:number,extra:Record<string,unknown>={}) {
  const board=state();board.events=[event(type,age,extra)];
  const result=surface();result.renderer.draw(board,0);return result.calls;
}
const translated=(calls:Call[],x:number,y:number)=>calls.some(call=>call.name==='translate'&&Math.abs(Number(call.args[0])-x)<.001&&Math.abs(Number(call.args[1])-y)<.001);
const filled=(calls:Call[],color:string)=>calls.some(call=>call.name==='fill'&&call.fill===color);

describe('M2 stored path rendering',()=>{
  const points=[{col:1,row:4},{col:3,row:4},{col:3,row:2}];
  it('moves dash through each recorded segment after source and targets disappear',()=>{
    // Halfway through the second of two segments: (3,3), independently mapped to stage pixels.
    expect(translated(rendered('dash',.825,{points}),536,436)).toBe(true);
  });
  it.each([7,10])('reaches all %i dash endpoints in order',count=>{
    const route=Array.from({length:count+1},(_,i)=>({col:1+i*.31,row:4+i%2*.2}));
    for(let i=1;i<=count;i++) {
      const calls=rendered('dash',i/count*1.1,{points:route});
      expect(translated(calls,224+route[i].col*104,124+route[i].row*104)).toBe(true);
    }
  });
  it('does not jump to the final basketball target at the first bounce',()=>{
    const calls=rendered('bounce',.275,{points,effect:'basketball'});
    expect(translated(calls,432,512)).toBe(true); // (2,4), 28px arc above the route.
    expect(translated(calls,536,332)).toBe(false);
    expect(filled(calls,'#ed9856')).toBe(true);
  });
  it('renders yarn on the second segment and clamps expired events to the last point',()=>{
    expect(translated(rendered('bounce',.825,{points,effect:'yarn'}),536,408)).toBe(true);
    expect(translated(rendered('bounce',5,{points,effect:'yarn'}),536,332)).toBe(true);
  });
  it('drives the sprinkler from the tub backwards around road corners',()=>{
    const route=[{col:8,row:4},{col:7,row:4},{col:7,row:3}];
    const calls=rendered('sprinkler',.825,{points:route});
    expect(translated(calls,952,488)).toBe(true);
    expect(filled(calls,'#f2ca62')).toBe(true);
  });
  it('lands the giant orange cat at the event destination with no live enemy',()=>{
    const calls=rendered('giant_cat',.8,{col:5,row:3});
    expect(translated(calls,744,436)).toBe(true);
    expect(filled(calls,'#e9a34f')).toBe(true);
  });
  it.each(['bamboo','fish','claw','fire','vacuum','unknown_future_effect'])('renders a visible weapon theme for %s',effect=>{
    expect(filled(rendered('weapon',.3,{effect,col:3,row:4}),effect==='vacuum'?'#705688':effect==='bamboo'?'#94b768':effect==='fire'?'#efad54':effect==='fish'?'#a6c8c1':effect==='claw'?'#efdfbd':'#e9c77c')).toBe(true);
  });
  it.each([
    ['treasure','#b88242'],['electric','#abdce5'],['coin','#edc85e'],['bubble','#c6e8e6'],['wave','#c6bcd9'],
  ])('renders %s using its own weapon theme', (effect,color)=>{
    expect(filled(rendered('weapon',.3,{effect,col:3,row:4}),color)).toBe(true);
  });
});

describe('M2 status, props and tools',()=>{
  it('shows the equipped sniper range rather than the old base range',()=>{
    const engine=new BattleEngine({ai:false,autoWaves:false,loadouts:{player:{equippedWeapons:{doge_wick:'r11_sniper_laser'}}}});
    const id=engine.grant('doge_wick').unitId!,unit=engine.state.units[0];unit.location={zone:'board',col:2,row:4};
    const {renderer,calls}=surface();renderer.draw(engine.state,0,{selectedId:id});
    expect(calls.some(call=>call.name==='arc'&&Math.abs(Number(call.args[2])-449.28)<.001)).toBe(true);
  });
  it('uses yarn orb seven-hit charge for the visible energy bar',()=>{
    const engine=new BattleEngine({ai:false,autoWaves:false,loadouts:{player:{equippedWeapons:{zen_master:'w04_yarn_orb'}}}});
    engine.grant('zen_master');engine.state.units[0].energy=6;
    const {renderer,calls}=surface();renderer.draw(engine.state,0);
    expect(calls.some(call=>call.name==='roundRect'&&call.args[0]===-23&&call.args[1]===31&&Math.abs(Number(call.args[2])-46*6/7)<.001)).toBe(true);
  });
  function unitBoard() {
    const engine=new BattleEngine({ai:false,autoWaves:false});engine.start();engine.grant('hamster');
    return engine.state;
  }
  it('shows corrugated box, warning mark and animated packing tape on SEALED',()=>{
    const board=unitBoard();board.units[0].statuses.SEALED=5;
    const {renderer,calls}=surface();renderer.draw(board,.2);
    expect(calls.some(call=>call.name==='fillText'&&call.args[0]==='!')).toBe(true);
    expect(filled(calls,'#efd594')).toBe(true);
    expect(calls.filter(call=>call.name==='stroke'&&call.stroke==='#bc9368').length).toBeGreaterThan(5);
  });
  it('shows a dark cloud and animated droplets above WET units',()=>{
    const board=unitBoard();board.units[0].statuses.WET=5;
    const {renderer,calls}=surface();renderer.draw(board,.2);
    expect(filled(calls,'#8197aa')).toBe(true);
    expect(calls.some(call=>call.name==='stroke'&&call.stroke==='#6baacb')).toBe(true);
  });
  it('shows a rotating washer around washing bench units',()=>{
    const board=unitBoard();Object.assign(board.units[0],{washing:2.3});
    const {renderer,calls}=surface();renderer.draw(board,.2);
    expect(filled(calls,'#d4e7e6')).toBe(true);
    expect(calls.some(call=>call.name==='rotate'&&Math.abs(Number(call.args[0])-1.6)<.001)).toBe(true);
  });
  it('shows golden shovel even when it is not selected and displays trap charges',()=>{
    const board=state();Object.assign(board.sides.player,{loadout:{equippedPassiveProps:['gold_doge']}});
    Object.assign(board,{traps:[{id:1,side:'player',col:1,row:3,charges:2,hitIds:[]}]});
    const {renderer,calls}=surface();renderer.draw(board,0);
    expect(filled(calls,'#f4cf63')).toBe(true);
    expect(filled(calls,'#e4bd80')).toBe(true);
    expect(calls.some(call=>call.name==='fillText'&&call.args[0]==='2')).toBe(true);
  });
  it('highlights road targets and draws a prop cursor without changing hit targets',()=>{
    const board=state(),{renderer,calls}=surface();
    renderer.draw(board,0,{propId:'glue_trap',pointer:{x:140,y:708},hover:{col:1,row:3}} as Interaction);
    expect(calls.some(call=>call.name==='stroke'&&call.stroke==='#d9a43d')).toBe(true);
    expect(renderer.hitTest(86,162)).toEqual({kind:'shovel'});
  });
  it('does not mark an already trapped road cell as a valid placement',()=>{
    const board=state();board.traps=[{id:1,side:'player',col:1,row:3,charges:2,hitIds:[]}];
    const {renderer,calls}=surface();renderer.draw(board,0,{propId:'glue_trap'});
    expect(calls.some(call=>call.name==='roundRect'&&call.args[0]===284&&call.args[1]===392&&call.args[2]===88)).toBe(false);
  });
  it('draws valid bench prop targets above the opaque nest backgrounds',()=>{
    const board=unitBoard(),{renderer,calls}=surface();renderer.draw(board,0,{propId:'washer'});
    const background=calls.findIndex(call=>call.name==='roundRect'&&call.args[0]===252&&call.args[1]===610&&call.args[2]===92);
    const outline=calls.findIndex(call=>call.name==='ellipse'&&call.args[0]===298&&call.args[1]===686&&Number(call.args[2])>=35);
    expect(background).toBeGreaterThan(-1);expect(outline).toBeGreaterThan(background);
  });
});
