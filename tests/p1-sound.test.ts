import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {SoundManager,type SoundCue} from '../src/ui/SoundManager';
import {BattleEngine} from '../src/core/BattleEngine';

// Only the browser boundary is doubled; assertions inspect the real manager's graph.
class Param {
  value=1;events:{value:number;time:number;kind:string}[]=[];
  setValueAtTime(value:number,time:number){this.value=value;this.events.push({value,time,kind:'set'});}
  linearRampToValueAtTime(value:number,time:number){this.value=value;this.events.push({value,time,kind:'linear'});}
  exponentialRampToValueAtTime(value:number,time:number){this.value=value;this.events.push({value,time,kind:'exp'});}
  setTargetAtTime(value:number,time:number){this.value=value;this.events.push({value,time,kind:'target'});}
  cancelScheduledValues(){}
}
class Node {
  target?:Node;disconnected=false;
  connect(target:Node){this.target=target;return target;}
  disconnect(){this.disconnected=true;}
}
class Gain extends Node {gain=new Param();}
class Filter extends Node {type='lowpass';frequency=new Param();Q=new Param();}
class Source extends Node {
  onended:(()=>void)|null=null;started:number[]=[];stopped:number[]=[];
  start(at=0){this.started.push(at);}
  stop(at=0){this.stopped.push(at);}
}
class Osc extends Source {type='sine';frequency=new Param();}
class BufferSource extends Source {buffer:unknown;loop=false;}
class Host {
  static instances:Host[]=[];currentTime=0;state='suspended';destination=new Node();sampleRate=8000;
  gains:Gain[]=[];oscillators:Osc[]=[];filters:Filter[]=[];sources:BufferSource[]=[];closed=false;decoded:unknown[]=[];
  constructor(){Host.instances.push(this);}
  createGain(){const g=new Gain();this.gains.push(g);return g;}
  createOscillator(){const o=new Osc();this.oscillators.push(o);return o;}
  createBiquadFilter(){const f=new Filter();this.filters.push(f);return f;}
  createBuffer(_channels:number,length:number,_rate:number){return {duration:length/8000,getChannelData:()=>new Float32Array(length)};}
  createBufferSource(){const s=new BufferSource();this.sources.push(s);return s;}
  async decodeAudioData(bytes:ArrayBuffer){const buffer={duration:2,bytes};this.decoded.push(buffer);return buffer;}
  async resume(){this.state='running';}
  async close(){this.closed=true;this.state='closed';}
}
const settings={musicVolume:.5,soundVolume:.75,showDamageNumbers:true};
const managers:SoundManager[]=[];
function manager(){const m=new SoundManager(settings);managers.push(m);return m;}
function advance(h:Host,seconds:number){for(let t=0;t<seconds-.00001;t+=.05){h.currentTime+=.05;vi.advanceTimersByTime(50);}}
function busOf(node:Node):Node {let out=node;while(out.target&&!(out.target instanceof Node&&out.target.target===undefined))out=out.target;return out;}
async function flush(){for(let i=0;i<15;i++)await Promise.resolve();}
function serve(manifest:unknown,fail=false){
  const requests:string[]=[];
  vi.stubGlobal('fetch',async(input:string)=>{requests.push(String(input));return {ok:!fail,json:async()=>manifest,arrayBuffer:async()=>new ArrayBuffer(8)};});
  return requests;
}
beforeEach(()=>{vi.useFakeTimers();vi.stubGlobal('AudioContext',Host);serve({});});
afterEach(()=>{for(const m of managers)m.dispose();managers.length=0;Host.instances=[];vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();});

describe('P1 arrangements and lifecycle',()=>{
  it.each([['menu',30/116],['battle',30/124],['boss',30/138]] as const)('%s schedules overlapping instruments at its eighth-note tempo',async(mode,step)=>{
    const m=manager();m.setMode(mode);await m.unlock();const h=Host.instances[0];advance(h,1.5);
    const lead=h.oscillators.filter(o=>o.type===(mode==='menu'?'triangle':'sawtooth')&&o.target instanceof Filter&&(o.target as Filter).frequency.value===(mode==='menu'?2800:mode==='battle'?1950:2850));
    expect(lead.length).toBeGreaterThan(3);
    expect(lead[1].started[0]-lead[0].started[0]).toBeCloseTo(step,5);
    expect(new Set(h.oscillators.map(o=>o.type)).size).toBeGreaterThan(1);
    expect(h.oscillators.some(o=>o.frequency.events[0].value<250)).toBe(true);
    expect(h.filters.length).toBeGreaterThan(0);
    if(mode==='menu'){
      expect(h.oscillators.filter(o=>o.started[0]===lead[0].started[0]).length).toBeGreaterThanOrEqual(4);
      expect(h.oscillators.some(o=>Math.round(69+12*Math.log2(o.frequency.events[0].value/440))%12===11)).toBe(true);
      expect(h.oscillators.some(o=>o.stopped[0]-o.started[0]>1)).toBe(true);
    }else expect(h.sources.some(s=>!s.loop&&s.stopped[0]-s.started[0]<.2)).toBe(true);
    for(const o of h.oscillators){
      const envelope=o.target instanceof Filter?o.target.target as Gain:o.target as Gain;
      expect(envelope.gain.events.some(e=>e.kind==='linear'&&e.time>o.started[0])).toBe(true);
      expect(envelope.gain.events.at(-1)?.value).toBeLessThan(.001);
    }
  });
  it('crossfades mode switches on one context and one scheduler, including suspended resume',async()=>{
    const m=manager();await m.unlock();const h=Host.instances[0];
    for(let i=0;i<30;i++)m.setMode(i%2?'battle':'boss');
    expect(Host.instances).toHaveLength(1);expect(vi.getTimerCount()).toBe(1);
    expect(h.gains.some(g=>g.gain.events.some(e=>e.kind==='linear'&&e.value===0))).toBe(true);
    h.state='suspended';const before=h.oscillators.length;advance(h,.5);expect(h.oscillators).toHaveLength(before);
    await m.unlock();expect(vi.getTimerCount()).toBe(1);expect(Host.instances).toHaveLength(1);
    m.dispose();expect(h.closed).toBe(true);expect(vi.getTimerCount()).toBe(0);
    expect([...h.oscillators,...h.sources].every(o=>o.stopped.length>0&&o.disconnected)).toBe(true);
  });
  it('adopts a mode requested during suspension when the gesture resumes audio',async()=>{
    const m=manager();await m.unlock();const h=Host.instances[0];h.state='suspended';m.setMode('battle');
    const before=h.oscillators.length;await m.unlock();advance(h,.6);
    expect(h.oscillators[1].stopped.length).toBeGreaterThan(1);
    const notes=h.oscillators.slice(before),bass=notes.find(o=>o.type==='triangle'&&o.frequency.events[0].value<200);
    expect(bass).toBeDefined();expect(h.sources.some(s=>!s.loop)).toBe(true);
    const lead=notes.filter(o=>o.type==='sawtooth'&&o.target instanceof Filter&&(o.target as Filter).frequency.value===1950);
    expect(lead[1].started[0]-lead[0].started[0]).toBeCloseTo(30/124,5);
  });
  it('mute creates no SFX nodes and the first hit after enabling is audible',async()=>{
    const m=manager();await m.unlock();const h=Host.instances[0];m.setSettings({...settings,soundVolume:0});
    const before=h.oscillators.length;for(let i=0;i<20;i++)m.play('hit_soft' as SoundCue);expect(h.oscillators).toHaveLength(before);
    m.setSettings(settings);m.play('hit_soft' as SoundCue);expect(h.oscillators.length).toBeGreaterThan(before);
    expect(h.gains.filter(g=>g.target===h.destination)[1].gain.value).toBeCloseTo(.8625);
  });
  it('globally throttles hits at 45ms while distinct command cues stay responsive',async()=>{
    const m=manager();await m.unlock();const h=Host.instances[0],before=h.oscillators.length;
    m.play('hit_soft' as SoundCue);const one=h.oscillators.length-before;expect(one).toBeGreaterThan(0);
    for(let i=0;i<200;i++)m.play('hit_soft' as SoundCue);h.currentTime=.044;m.play('hit_soft' as SoundCue);expect(h.oscillators).toHaveLength(before+one);
    h.currentTime=.045;m.play('hit_soft' as SoundCue);expect(h.oscillators).toHaveLength(before+2*one);
    const n=h.oscillators.length;m.play('summon');m.play('summon');expect(h.oscillators.length-n).toBeGreaterThanOrEqual(4);
  });
  it('ducks music for overlays and hidden tabs without touching SFX gain',async()=>{
    const listeners=new Map<string,()=>void>();const doc={hidden:false,addEventListener:(k:string,fn:()=>void)=>listeners.set(k,fn),removeEventListener:(k:string)=>listeners.delete(k)};
    vi.stubGlobal('document',doc);const m=manager();await m.unlock();const h=Host.instances[0],[music,effects]=h.gains.filter(g=>g.target===h.destination);
    m.setDucked(true);expect(music.gain.value).toBeCloseTo(.078);expect(effects.gain.value).toBeCloseTo(.8625);
    const count=music.gain.events.length;for(let i=0;i<60;i++)m.setDucked(true);expect(music.gain.events).toHaveLength(count);
    m.setDucked(false);doc.hidden=true;listeners.get('visibilitychange')!();expect(music.gain.value).toBeCloseTo(.078);
    m.setSettings({...settings,musicVolume:0});expect(music.gain.value).toBe(0);m.dispose();expect(listeners.size).toBe(0);
  });
  it('handles no host and hosts missing optional filters and buffers',async()=>{
    vi.stubGlobal('AudioContext',undefined);const absent=manager();absent.setMode('boss');await expect(absent.unlock()).resolves.toBeUndefined();expect(()=>absent.play('boss_spawn' as SoundCue)).not.toThrow();
    class Minimal extends Host {createBiquadFilter=undefined as never;createBuffer=undefined as never;createBufferSource=undefined as never;}
    vi.stubGlobal('AudioContext',Minimal);const m=manager();m.setMode('battle');await m.unlock();const h=Host.instances[0];advance(h,1);expect(h.oscillators.length).toBeGreaterThan(4);
  });
  it('deduplicates per battle/id and routes core-owned cues without command purge duplicates',async()=>{
    const m=manager();await m.unlock();const h=Host.instances[0],state=new BattleEngine({ai:false}).state;
    const base={side:'player' as const,col:0,row:9,age:0,duration:1};
    for(const [type,effect,value] of [['damage',undefined,5],['bubble','boss_spawn',undefined],['weapon','treasure',undefined],['orange',undefined,1]] as const){
      state.events=[{...base,id:1,type,effect,value}];state.id=String(type);const before=h.oscillators.length;m.consumeBattle(state);expect(h.oscillators.length).toBeGreaterThan(before);const after=h.oscillators.length;m.consumeBattle(state);expect(h.oscillators).toHaveLength(after);
    }
    const before=h.oscillators.length;state.id='purges';state.events=[{...base,id:1,type:'purge',effect:'sprinkler'},{...base,id:2,type:'purge',effect:'legendary'}];m.consumeBattle(state);expect(h.oscillators).toHaveLength(before);
    state.events.push({...base,id:3,type:'purge'});m.consumeBattle(state);expect(h.oscillators.length).toBeGreaterThan(before);
  });
  it.each(['ui_click','shovel','treasure','merge_upgrade','merge_hero','hit_soft','boss_spawn','orange_lost','orange_gain'] as SoundCue[])('plays canonical %s with a soft finite envelope',async cue=>{
    const m=manager();await m.unlock();const h=Host.instances[0],before=h.oscillators.length;m.play(cue);
    const notes=h.oscillators.slice(before);expect(notes.length).toBeGreaterThan(0);
    for(const o of notes){expect(o.frequency.events.every(e=>Number.isFinite(e.value)&&e.value>0)).toBe(true);expect(o.stopped[0]-o.started[0]).toBeGreaterThan(0);expect(o.stopped[0]-o.started[0]).toBeLessThan(2);}
  });
  it('bounds live voice allocation under a command burst and frees expired envelopes',async()=>{
    const m=manager();await m.unlock();const h=Host.instances[0];for(let i=0;i<1000;i++)m.play('legendary');
    expect(h.oscillators.filter(o=>!o.disconnected).length).toBeLessThanOrEqual(96);
    advance(h,2);const before=h.oscillators.length;m.play('legendary');expect(h.oscillators.length).toBeGreaterThan(before);
    expect(h.oscillators.filter(o=>!o.disconnected).length).toBeLessThan(20);
  });
});

describe('P1 optional decoded audio',()=>{
  it('requests only the empty manifest and keeps builtin arrangements',async()=>{
    const requests=serve({});const m=manager();await m.unlock();await flush();expect(requests).toHaveLength(1);expect(requests[0]).toMatch(/audio\/manifest\.json$/);expect(Host.instances[0].oscillators.length).toBeGreaterThan(1);
  });
  it.each([null,[],{bgm_menu:'../outside.mp3',hit_soft:'https://bad.test/a.wav'},{bgm_menu:'/absolute.mp3',summon:'a%2fb.mp3'},{unknown:'no.mp3'}].map(manifest=>({manifest})))('ignores invalid or unsafe manifest entries $manifest',async({manifest})=>{
    const requests=serve(manifest);const m=manager();await m.unlock();await flush();expect(requests).toHaveLength(1);expect(Host.instances[0].oscillators.length).toBeGreaterThan(1);
  });
  it('uses decoded external music and cues through shared volume/duck buses and stops on mode/dispose',async()=>{
    const requests=serve({bgm_menu:'music/menu.ogg',hit_soft:'hit.wav'});const m=manager();await m.unlock();await flush();const h=Host.instances[0];
    expect(requests.some(u=>u.endsWith('/audio/music/menu.ogg'))).toBe(true);expect(h.decoded).toHaveLength(2);
    const loop=h.sources.find(s=>s.loop)!;expect(loop).toBeDefined();expect(loop.buffer).toBe(h.decoded[0]);
    const musicBus=busOf(loop) as Gain;m.setDucked(true);expect(musicBus.gain.value).toBeCloseTo(.078);
    const before=h.oscillators.length;m.play('hit_soft' as SoundCue);expect(h.oscillators).toHaveLength(before);
    const cue=h.sources.find(s=>!s.loop&&s.buffer===h.decoded[1])!;expect(cue).toBeDefined();const effectBus=busOf(cue) as Gain;
    m.setSettings({...settings,soundVolume:0,musicVolume:0});expect(musicBus.gain.value).toBe(0);expect(effectBus.gain.value).toBe(0);
    advance(h,.5);expect(h.oscillators).toHaveLength(before);m.setMode('battle');expect(loop.stopped.length).toBeGreaterThan(0);
    m.dispose();expect(h.sources.every(s=>s.disconnected)).toBe(true);
  });
  it('stops a decoded music loop during the battle curtain and resumes the selected mode cleanly',async()=>{
    serve({bgm_menu:'menu.ogg',bgm_battle:'battle.ogg'});const m=manager();await m.unlock();await flush();const h=Host.instances[0];
    const menu=h.sources.find(s=>s.loop)!;m.setMusicPaused(true);expect(menu.stopped.length).toBeGreaterThan(0);expect(menu.disconnected).toBe(true);
    const before=h.sources.length;m.setMode('battle');advance(h,2);expect(h.sources).toHaveLength(before);expect(vi.getTimerCount()).toBe(0);
    m.setMusicPaused(false);expect(h.sources.filter(s=>s.loop&&!s.disconnected)).toHaveLength(1);expect(vi.getTimerCount()).toBe(1);
  });
  it.each(['fetch','decode'])('falls back quietly when external %s fails',async failure=>{
    const requests=serve({bgm_menu:'missing.mp3',summon:'missing.wav'});if(failure==='fetch')vi.stubGlobal('fetch',async(input:string)=>{requests.push(String(input));if(String(input).endsWith('manifest.json'))return {ok:true,json:async()=>({bgm_menu:'missing.mp3',summon:'missing.wav'})};throw new Error('offline');});
    else vi.spyOn(Host.prototype,'decodeAudioData').mockRejectedValueOnce(new Error('codec')).mockRejectedValueOnce(new Error('codec'));
    const m=manager();await expect(m.unlock()).resolves.toBeUndefined();await flush();const h=Host.instances[0],before=h.oscillators.length;m.play('summon');expect(h.oscillators.length).toBeGreaterThan(before);expect(h.sources.some(s=>s.loop)).toBe(false);
    vi.restoreAllMocks();
  });
  it('does not resurrect audio when a pending manifest completes after dispose',async()=>{
    let finish!:(v:unknown)=>void;vi.stubGlobal('fetch',()=>new Promise(resolve=>{finish=resolve;}));const m=manager();await m.unlock();const h=Host.instances[0];m.dispose();const count=h.sources.length;
    finish({ok:true,json:async()=>({bgm_menu:'late.mp3'})});await flush();expect(h.sources).toHaveLength(count);expect(vi.getTimerCount()).toBe(0);expect(h.closed).toBe(true);
  });
  it('does not resurrect voices when decode completes after disposal',async()=>{
    serve({bgm_menu:'late.mp3'});let finish!:(buffer:{duration:number;bytes:ArrayBuffer})=>void;
    vi.spyOn(Host.prototype,'decodeAudioData').mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
    const m=manager();await m.unlock();await flush();const h=Host.instances[0];expect(finish).toBeTypeOf('function');m.dispose();finish({duration:2,bytes:new ArrayBuffer(8)});await flush();
    expect(h.sources.filter(s=>(s.buffer as {duration:number}).duration>1/h.sampleRate)).toHaveLength(0);expect(vi.getTimerCount()).toBe(0);vi.restoreAllMocks();
  });
  it('adopts a decoded override that arrives while the context is suspended',async()=>{
    serve({bgm_menu:'late.mp3'});let finish!:(buffer:{duration:number;bytes:ArrayBuffer})=>void;
    vi.spyOn(Host.prototype,'decodeAudioData').mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
    const m=manager();await m.unlock();await flush();const h=Host.instances[0];h.state='suspended';finish({duration:2,bytes:new ArrayBuffer(8)});await flush();
    expect(h.sources.filter(s=>(s.buffer as {duration:number}).duration>1/h.sampleRate)).toHaveLength(0);await m.unlock();expect(h.sources.some(s=>s.loop)).toBe(true);vi.restoreAllMocks();
  });
  it('keeps builtin scheduling when a decoded buffer source fails to start',async()=>{
    class NoPlayback extends Host {createBufferSource(){const s=super.createBufferSource();s.start=()=>{throw new Error('restricted playback');};return s;}}
    vi.stubGlobal('AudioContext',NoPlayback);serve({bgm_menu:'valid.mp3'});const m=manager();await m.unlock();await flush();const h=Host.instances[0],before=h.oscillators.length;
    advance(h,1);expect(h.oscillators.length).toBeGreaterThan(before);expect(h.sources.every(s=>s.disconnected)).toBe(true);
  });
  it('throttles a treasure reported by both bubble and weapon effects to one chime',async()=>{
    const m=manager();await m.unlock();const h=Host.instances[0],state=new BattleEngine({ai:false}).state;
    const base={side:'player' as const,col:0,row:9,age:0,duration:1,effect:'treasure'};
    state.events=[{...base,id:1,type:'bubble'},{...base,id:2,type:'weapon'}];const before=h.oscillators.length;m.consumeBattle(state);expect(h.oscillators.length-before).toBe(4);
  });
});
