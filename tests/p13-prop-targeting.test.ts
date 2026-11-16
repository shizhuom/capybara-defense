import {afterEach,describe,expect,it,vi} from 'vitest';
import {BattleEngine} from '../src/core/BattleEngine';
import {isInsideBattleBoard,isValidPropUnit,propTargetKind,resolvePropDrop} from '../src/core/PropTargets';
import {Random} from '../src/core/Random';
import type {Unit} from '../src/core/types';
import {assets} from '../src/render/AssetRegistry';
import {StickerRenderer} from '../src/render/StickerRenderer';

afterEach(()=>vi.restoreAllMocks());
function battle(id='milk_bottle') {
  const engine=new BattleEngine({seed:7,autoWaves:false,loadouts:{player:{ownedProps:{[id]:1},equippedActiveProps:[id]}}});
  engine.start();return engine;
}
function pet(engine:BattleEngine,changes:Partial<Unit>={}):Unit {
  const unit:Unit={id:engine.state.units.length+1,kind:'hamster',side:'player',level:1,location:{zone:'board',col:2,row:1},statuses:{},energy:0,cooldown:0,production:0,buffTime:0,empowered:0,animation:0,...changes};
  engine.state.units.push(unit);return unit;
}

describe('P13 pure prop eligibility',()=>{
  it.each([
    ['washer','hamster',1,true],['washer','hamster',2,false],['washer','panda',1,true],['washer','kungfu_po',1,false],
    ['clay','hamster',1,false],['clay','panda',1,true],['clay','kungfu_po',1,false],
    ['milk_bottle','hamster',4,true],['milk_bottle','hamster',5,false],['milk_bottle','bee',3,false],['milk_bottle','kungfu_po',4,true],['milk_bottle','kungfu_po',5,false],['milk_bottle','panda',1,false],
    ['whistle','hamster',5,true],['whistle','panda',1,true],['recycle_bin','panda',1,true],['recycle_bin','panda',2,false],['recycle_bin','kungfu_po',1,true],['recycle_bin','hamster',2,false],
  ] as const)('%s preview agrees with activation for %s level %i',(id,kind,level,valid)=>{
    const engine=battle(id),unit=pet(engine,{kind,level});
    expect(isValidPropUnit(engine.state,id,unit)).toBe(valid);
    expect(engine.useProp(id,{unitId:unit.id}).ok).toBe(valid);
  });
  it.each(['washer','clay','milk_bottle','whistle','recycle_bin'])('excludes washing and enemy units from %s',id=>{
    const engine=battle(id),unit=pet(engine,{kind:'panda',washing:2});
    expect(isValidPropUnit(engine.state,id,unit)).toBe(false);
    unit.washing=0;unit.side='ai';expect(isValidPropUnit(engine.state,id,unit)).toBe(false);
  });
  it('allows only level one bench shovels to be recycled and preserves the rejection hints',()=>{
    const engine=battle('recycle_bin'),unit=pet(engine,{kind:'shovel',location:{zone:'bench',slot:0}});
    for(const id of ['washer','clay','milk_bottle','whistle'])expect(isValidPropUnit(engine.state,id,unit)).toBe(false);
    expect(isValidPropUnit(engine.state,'recycle_bin',unit)).toBe(true);
    unit.location={zone:'board',col:2,row:1};expect(isValidPropUnit(engine.state,'recycle_bin',unit)).toBe(false);
    expect(engine.useProp('recycle_bin',{unitId:unit.id})).toMatchObject({ok:false,key:'hint.toolOnly'});
    unit.location={zone:'bench',slot:0};unit.washing=1;
    expect(engine.useProp('recycle_bin',{unitId:unit.id})).toMatchObject({ok:false,key:'m2.washing'});
    expect(engine.state.sides.player.propCooldowns.recycle_bin).toBeUndefined();
  });
  it('does not treat passives, global skills or absent units as unit targets',()=>{
    const engine=battle(),unit=pet(engine);
    for(const id of ['sprinkler','catnip','expired_can','giant_orange_cat','hyper_party','unknown'])expect(isValidPropUnit(engine.state,id,unit)).toBe(false);
    engine.state.units=[];expect(isValidPropUnit(engine.state,'milk_bottle',unit)).toBe(false);
  });
});

describe('P13 stage drop resolution',()=>{
  it('finds the nearest valid pet instead of a closer ineligible pet',()=>{
    const engine=battle(),valid=pet(engine),invalid=pet(engine,{level:5,location:{zone:'board',col:3,row:1}});
    expect(resolvePropDrop(engine.state,'milk_bottle',{x:490,y:228})).toEqual({unitId:valid.id});
    invalid.level=1;expect(resolvePropDrop(engine.state,'milk_bottle',{x:490,y:228})).toEqual({unitId:invalid.id});
  });
  it('accepts exactly 68 stage pixels above a board pet, but cancels beyond that radius',()=>{
    const engine=battle(),unit=pet(engine);
    expect(resolvePropDrop(engine.state,'milk_bottle',{x:432,y:160})).toEqual({unitId:unit.id});
    expect(resolvePropDrop(engine.state,'milk_bottle',{x:432,y:159.99})).toBeNull();
  });
  it('uses the bench pet center for hat-edge drops outside the nest hit rectangle',()=>{
    const engine=battle(),unit=pet(engine,{location:{zone:'bench',slot:0}});
    expect(resolvePropDrop(engine.state,'milk_bottle',{x:298,y:590})).toEqual({unitId:unit.id});
    expect(resolvePropDrop(engine.state,'milk_bottle',{x:298,y:589.99})).toBeNull();
  });
  it('accepts any point within a free R tile and rejects trapped, non-road or outside points',()=>{
    const engine=battle('glue_trap');
    expect(resolvePropDrop(engine.state,'glue_trap',{x:276,y:72})).toEqual({col:1,row:0});
    expect(resolvePropDrop(engine.state,'glue_trap',{x:379.99,y:175.99})).toEqual({col:1,row:0});
    for(const point of [{x:224,y:124},{x:432,y:228},{x:1108,y:124},{x:172,y:592}])expect(resolvePropDrop(engine.state,'glue_trap',point)).toBeNull();
    engine.state.traps.push({id:1,side:'player',col:1,row:0,charges:3,hitIds:[]});
    expect(resolvePropDrop(engine.state,'glue_trap',{x:328,y:124})).toBeNull();
  });
  it.each(['sprinkler','catnip','expired_can'])('resolves %s anywhere on the board and cancels outside it',id=>{
    const engine=battle();expect(propTargetKind(id)).toBe('self');
    for(const point of [{x:172,y:72},{x:1107.99,y:591.99},{x:328,y:124}])expect(resolvePropDrop(engine.state,id,point)).toEqual({});
    for(const point of [{x:171.99,y:72},{x:1108,y:100},{x:500,y:592},{x:298,y:658},{x:86,y:162}])expect(resolvePropDrop(engine.state,id,point)).toBeNull();
  });
  it('rejects passive activation and non-finite coordinates',()=>{
    const engine=battle();pet(engine);
    for(const id of ['giant_orange_cat','hyper_party','unknown']){
      expect(propTargetKind(id)).toBeUndefined();expect(resolvePropDrop(engine.state,id,{x:432,y:228})).toBeNull();
    }
    for(const point of [{x:NaN,y:100},{x:500,y:Infinity}]){
      expect(isInsideBattleBoard(point)).toBe(false);expect(resolvePropDrop(engine.state,'milk_bottle',point)).toBeNull();
    }
  });
  it('previews without mutating state, consuming randomness or starting cooldowns',()=>{
    const engine=battle('whistle'),unit=pet(engine),before=JSON.stringify(engine.state),rng=vi.spyOn(Random.prototype,'next');
    for(let i=0;i<20;i++){
      expect(isValidPropUnit(engine.state,'whistle',unit)).toBe(true);
      expect(resolvePropDrop(engine.state,'whistle',{x:432,y:228})).toEqual({unitId:unit.id});
    }
    expect(JSON.stringify(engine.state)).toBe(before);expect(rng).not.toHaveBeenCalled();
  });
});

type Call={name:string;args:unknown[];stroke:unknown;shadow:unknown;dash:unknown[]};
function surface(){
  const calls:Call[]=[],values:Record<string,unknown>={globalAlpha:1},stack:Record<string,unknown>[]=[],dashes:unknown[][]=[];
  let dash:unknown[]=[];
  const context=new Proxy(values,{get(target,key:string){
    if(key in target)return target[key];
    if(key==='measureText')return(text:string)=>({width:text.length*8});
    if(key.includes('Gradient'))return()=>({addColorStop(){}});
    return(...args:unknown[])=>{
      if(key==='save'){stack.push({...target});dashes.push([...dash]);}
      if(key==='restore'){for(const name of Object.keys(target))delete target[name];Object.assign(target,stack.pop());dash=dashes.pop()??[];}
      if(key==='setLineDash')dash=args[0] as unknown[];
      calls.push({name:key,args,stroke:target.strokeStyle,shadow:target.shadowBlur,dash:[...dash]});
    };
  },set(target,key:string,value){target[key]=value;return true;}}) as unknown as CanvasRenderingContext2D;
  return{calls,renderer:new StickerRenderer({width:0,height:0,getContext:()=>context} as unknown as HTMLCanvasElement)};
}
const image=(id:string)=>({id,complete:true,naturalWidth:256,naturalHeight:256} as unknown as HTMLImageElement);

describe('P13 Canvas targeting feedback',()=>{
  it.each(['sprinkler','milk_bottle','washer','clay','whistle','recycle_bin','glue_trap','catnip','expired_can'])('draws the actual 74 px %s PNG with a soft shadow',id=>{
    const sprite=image(id),key=id==='sprinkler'?id:`prop_${id}`;
    vi.spyOn(assets,'get').mockImplementation(name=>name===key?sprite:undefined);
    const engine=battle(),{renderer,calls}=surface();renderer.draw(engine.state,0,{propId:id,pointer:{x:432,y:228}});
    const draw=calls.find(call=>call.name==='drawImage'&&call.args[0]===sprite);
    expect(draw?.args.slice(-2)).toEqual([74,74]);expect(Number(draw?.shadow)).toBeGreaterThan(0);
    expect(calls.some(call=>call.name==='arc'&&call.args[0]===0&&call.args[1]===0&&Number(call.args[2])>=20)).toBe(true);
  });
  it('shows eligible board and bench rings above pet sprites without merge sparkles',()=>{
    const engine=battle(),board=pet(engine);pet(engine,{location:{zone:'bench',slot:0}});pet(engine,{level:5,location:{zone:'bench',slot:1}});
    const sprite=image('hamster'),sparkle=image('ui_merge_sparkle');
    vi.spyOn(assets,'get').mockImplementation(id=>id==='hamster'?sprite:id==='ui_merge_sparkle'?sparkle:undefined);
    const {renderer,calls}=surface();renderer.draw(engine.state,0,{propId:'milk_bottle',selectedId:board.id});
    const lastSprite=calls.reduce((last,call,index)=>call.name==='drawImage'&&call.args[0]===sprite?index:last,-1);
    for(const [x,y] of [[432,256],[298,686]])expect(calls.findIndex(call=>call.name==='ellipse'&&call.args[0]===x&&call.args[1]===y&&Number(call.args[2])>=35)).toBeGreaterThan(lastSprite);
    expect(calls.some(call=>call.name==='ellipse'&&call.args[0]===402&&call.args[1]===686)).toBe(false);
    expect(calls.some(call=>call.name==='drawImage'&&call.args[0]===sparkle)).toBe(false);
  });
  it('outlines only available road cells with amber dashed frames',()=>{
    const engine=battle('glue_trap');engine.state.traps=[{id:1,side:'player',col:1,row:0,charges:3,hitIds:[]}];
    const {renderer,calls}=surface();renderer.draw(engine.state,0,{propId:'glue_trap'});
    const frames=calls.filter(call=>call.name==='roundRect'&&call.dash.join(',')==='7,6');
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.some(call=>Number(call.args[0])<380&&Number(call.args[0])>=276&&Number(call.args[1])<176)).toBe(false);
    expect(calls.some(call=>call.name==='stroke'&&call.dash.join(',')==='7,6'&&call.stroke==='#d9a43d')).toBe(true);
  });
  it.each(['sprinkler','catnip','expired_can'])('glows the board edge for %s only while its pointer is inside',id=>{
    const engine=battle(),{renderer,calls}=surface();
    const border=()=>calls.some(call=>call.name==='roundRect'&&call.args[0]===172&&call.args[1]===72&&call.args[2]===936&&call.args[3]===520&&Number(call.shadow)>0);
    renderer.draw(engine.state,0,{propId:id,pointer:{x:432,y:228}});expect(border()).toBe(true);
    calls.length=0;renderer.draw(engine.state,0,{propId:id,pointer:{x:298,y:658}});expect(border()).toBe(false);
    calls.length=0;renderer.draw(engine.state,0,{propId:id});expect(border()).toBe(false);
  });
});
