import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {SoundManager,type SoundCue} from '../src/ui/SoundManager';
import {musicStep,tempos,type MusicMode} from '../src/ui/MusicTracks';
import {BattleEngine} from '../src/core/BattleEngine';

class Param {value=1;events:{value:number;time:number}[]=[];setValueAtTime(value:number,time:number){this.value=value;this.events.push({value,time});}linearRampToValueAtTime(value:number,time:number){this.setValueAtTime(value,time);}exponentialRampToValueAtTime(value:number,time:number){this.setValueAtTime(value,time);}setTargetAtTime(value:number,time:number){this.setValueAtTime(value,time);}cancelScheduledValues(){}}
class Node {target?:Node;disconnected=false;connect(target:Node){this.target=target;}disconnect(){this.disconnected=true;}}
class Gain extends Node {gain=new Param();}
class Source extends Node {onended:(()=>void)|null=null;started:number[]=[];stopped:number[]=[];start(at=0){this.started.push(at);}stop(at=0){this.stopped.push(at);}}
class Osc extends Source {frequency=new Param();type='sine';}
class BufferSource extends Source {buffer?:{length?:number;duration:number};loop=false;}
class Compressor extends Node {threshold=new Param();knee=new Param();ratio=new Param();attack=new Param();release=new Param();}
class Filter extends Node {frequency=new Param();Q=new Param();type='lowpass';}
class Host {static instances:Host[]=[];currentTime=0;state='suspended';sampleRate=44100;destination=new Node();gains:Gain[]=[];sources:BufferSource[]=[];oscillators:Osc[]=[];compressors:Compressor[]=[];constructor(){Host.instances.push(this);}createGain(){const g=new Gain();this.gains.push(g);return g;}createBuffer(_n:number,length:number,rate:number){return {length,duration:length/rate,getChannelData:()=>new Float32Array(length)};}createBufferSource(){const s=new BufferSource();this.sources.push(s);return s;}createOscillator(){const o=new Osc();this.oscillators.push(o);return o;}createBiquadFilter(){return new Filter();}createDynamicsCompressor(){const c=new Compressor();this.compressors.push(c);return c;}async resume(){this.state='running';}async close(){this.state='closed';}}
const managers:SoundManager[]=[];
function manager(){const m=new SoundManager();managers.push(m);return m;}
function advance(h:Host,seconds:number){for(let i=0;i<seconds*20;i++){h.currentTime+=.05;vi.advanceTimersByTime(50);}}
beforeEach(()=>{vi.useFakeTimers();vi.stubGlobal('AudioContext',Host);vi.stubGlobal('fetch',undefined);});
afterEach(()=>{managers.forEach(m=>m.dispose());managers.length=0;Host.instances=[];vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();});

describe('P9 audible mobile audio',()=>{
  it('primes a one-frame silent buffer before resume resolves, and retries interrupted contexts',async()=>{
    let finish!:()=>void;class Pending extends Host {async resume(){await new Promise<void>(resolve=>{finish=resolve;});this.state='running';}}
    vi.stubGlobal('AudioContext',Pending);const session={type:'ambient'};vi.stubGlobal('navigator',{audioSession:session});
    const m=manager(),unlock=m.unlock(),h=Host.instances[0];expect(session.type).toBe('playback');
    expect(h.sources[0]?.buffer?.length).toBe(1);expect(h.sources[0]?.started).toEqual([0]);expect(m.isUnlocked()).toBe(false);
    finish();await unlock;expect(m.isUnlocked()).toBe(true);h.state='interrupted';expect(m.isUnlocked()).toBe(false);
    const retry=m.unlock();expect(h.sources.filter(s=>s.buffer?.length===1)).toHaveLength(2);finish();await retry;expect(m.isUnlocked()).toBe(true);
  });
  it('routes both buses through the limiter and makeup with audible default gain and strict zero mute',async()=>{
    const m=manager();await m.unlock();const h=Host.instances[0],c=h.compressors[0];expect(c).toBeDefined();
    expect([c.threshold.value,c.knee.value,c.ratio.value,c.attack.value,c.release.value]).toEqual([-10,12,4,.003,.16]);
    const buses=h.gains.filter(g=>g.target===c);expect(buses.map(g=>g.gain.value)).toEqual([.325,.8624999999999999]);
    const makeup=c.target as Gain;expect(makeup.gain.value).toBe(1.35);expect(makeup.target).toBe(h.destination);
    m.setDucked(true);expect(buses[0].gain.value).toBeCloseTo(.078);expect(buses[1].gain.value).toBeCloseTo(.8625);
    m.setSettings({musicVolume:0,soundVolume:0,showDamageNumbers:true});expect(buses.every(g=>g.gain.value===0)).toBe(true);
  });
  it('lets a later trusted gesture recover when an earlier resume promise remains pending',async()=>{
    class GestureHost extends Host {attempts=0;resume(){if(++this.attempts===1)return new Promise<void>(()=>{});this.state='running';return Promise.resolve();}}
    vi.stubGlobal('AudioContext',GestureHost);const m=manager();void m.unlock();const h=Host.instances[0];
    expect(h.state).toBe('suspended');const later=m.unlock();await later;
    expect(m.isUnlocked()).toBe(true);expect(vi.getTimerCount()).toBe(1);expect(h.compressors).toHaveLength(1);
  });
  it('pauses builtin music immediately while leaving effects playable, then resumes without a catch-up burst',async()=>{
    const m=manager();await m.unlock();const h=Host.instances[0];m.setMusicPaused(true);const before=h.oscillators.length;
    advance(h,5);expect(h.oscillators).toHaveLength(before);expect(vi.getTimerCount()).toBe(0);
    m.play('battle_start_clash');expect(h.oscillators.length).toBeGreaterThan(before);const after=h.oscillators.length;
    m.setMode('battle');expect(h.oscillators).toHaveLength(after);m.setMusicPaused(false);expect(vi.getTimerCount()).toBe(1);
    expect(h.oscillators.length-after).toBeLessThan(15);advance(h,1);expect(h.oscillators.length).toBeGreaterThan(after);
  });
  it.each(['battle_start_clash','hit_melee','hit_ranged','hit_magic','hit_heavy','death_rat','death_bug','death_crab','death_machine','death_frog','death_boss','elite_spawn'] as SoundCue[])('synthesizes audible %s with phone-range harmonics and bounded envelopes',async cue=>{
    const m=manager();await m.unlock();m.setMusicPaused(true);const h=Host.instances[0],before=h.oscillators.length;m.play(cue);
    const notes=h.oscillators.slice(before);expect(notes.length).toBeGreaterThan(0);expect(notes.some(o=>o.type!=='sine')).toBe(true);
    expect(notes.some(o=>o.frequency.events[0].value>=680)).toBe(true);
    const envelopes=notes.map(o=>o.target instanceof Filter?o.target.target as Gain:o.target as Gain);
    expect(envelopes.some(g=>g.gain.events.some(e=>e.value>=.11))).toBe(true);
    expect(notes.every(o=>o.stopped[0]>o.started[0]&&o.stopped[0]-o.started[0]<2)).toBe(true);
  });
  it('draws steel with the specified noise sweep, four ringing partials and drum fall',async()=>{
    const m=manager();await m.unlock();m.setMusicPaused(true);const h=Host.instances[0],before=h.oscillators.length;m.play('battle_start_clash');
    const notes=h.oscillators.slice(before),noise=h.sources.find(s=>s.target instanceof Filter&&(s.target as Filter).frequency.events[0]?.value===1800)!;
    expect(noise).toBeDefined();const filter=noise.target as Filter;expect(filter.type).toBe('highpass');
    expect(filter.frequency.events.map(e=>e.value)).toEqual([1800,5200]);expect(noise.stopped[0]-noise.started[0]).toBeCloseTo(.195);
    const steel=[1318,1975,2637,3520].map(frequency=>notes.find(o=>o.frequency.events[0].value===frequency));
    expect(steel.every(Boolean)).toBe(true);expect(new Set(steel.map(o=>o!.started[0])).size).toBe(1);
    for(const partial of steel){const gain=(partial!.target as Filter).target as Gain;expect(gain.gain.events.at(-1)!.time-partial!.started[0]).toBeCloseTo(.65);}
    const drum=notes.find(o=>o.frequency.events[0].value===140)!;expect(drum?.frequency.events.map(e=>e.value)).toEqual([140,58]);
  });
  it.each([
    ['death_rat',[980,1480,420]],['death_bug',[620,180]],
    ['death_machine',[880,110]],['death_frog',[340,210,130]],
  ] as const)('%s follows its exact primary pitch contour',async(cue,frequencies)=>{
    const m=manager();await m.unlock();m.setMusicPaused(true);const h=Host.instances[0],before=h.oscillators.length;m.play(cue);
    const notes=h.oscillators.slice(before),primary=notes.find(o=>o.frequency.events[0].value===frequencies[0]);
    expect(primary?.frequency.events.map(e=>e.value)).toEqual(frequencies);
    expect(primary!.frequency.events.every((event,i,events)=>i===0||event.time>events[i-1].time)).toBe(true);
    if(cue==='death_rat')expect(notes.some(o=>o!==primary&&o.started[0]>primary!.started[0])).toBe(true);
    if(cue==='death_bug')expect(notes.some(o=>o!==primary&&o.frequency.events[0].value>1000)).toBe(true);
    if(cue==='death_machine')expect(h.sources.some(s=>s.target instanceof Filter&&(s.target as Filter).type==='highpass')).toBe(true);
  });
  it('cracks a crab shell with simultaneous 540 and 810Hz tones then a 220Hz bubble',async()=>{
    const m=manager();await m.unlock();m.setMusicPaused(true);const h=Host.instances[0],before=h.oscillators.length;m.play('death_crab');
    const notes=h.oscillators.slice(before),low=notes.find(o=>o.frequency.events[0].value===540),high=notes.find(o=>o.frequency.events[0].value===810),bubble=notes.find(o=>o.frequency.events[0].value===220);
    expect(low).toBeDefined();expect(high).toBeDefined();expect(bubble).toBeDefined();
    expect(low!.started[0]).toBe(high!.started[0]);expect(bubble!.started[0]).toBeGreaterThan(low!.started[0]);
  });
  it('routes typed damage, creature death and alerts; deduplicates identities, limits minions by family, never boss deaths',async()=>{
    const m=manager();await m.unlock();m.setMusicPaused(true);const h=Host.instances[0],state=new BattleEngine({ai:false}).state;
    const base={side:'player' as const,col:0,row:0,age:0,duration:1};
    const event=(id:number,extra:Record<string,unknown>)=>({...base,id,...extra}) as typeof state.events[number];
    const play=vi.spyOn(m,'play');
    state.events=[event(1,{type:'damage',hitCue:'hit_magic'}),event(2,{type:'death',enemyKind:'charmed_rat'}),event(3,{type:'death',enemyKind:'roach'}),event(4,{type:'death',enemyKind:'crab'}),event(5,{type:'death',enemyKind:'mega_roomba',boss:true}),event(6,{type:'death',enemyKind:'sad_rain_frog',boss:true}),event(7,{type:'death',enemyKind:'husky_wrecker',boss:true}),event(8,{type:'alert',effect:'elite_spawn'})];
    m.consumeBattle(state);expect(play.mock.calls.map(([cue])=>cue)).toEqual(['hit_magic','death_rat','death_bug','death_crab','death_machine','death_frog','death_boss','elite_spawn']);
    const before=h.oscillators.length;m.consumeBattle(state);expect(h.oscillators).toHaveLength(before);
    state.events=[event(9,{type:'death',enemyKind:'rat'}),event(10,{type:'death',enemyKind:'rat',boss:true}),event(11,{type:'death',enemyKind:'rat',boss:true})];
    m.consumeBattle(state);expect(h.oscillators.length-before).toBe(4);h.currentTime=.055;m.play('death_rat');expect(h.oscillators.length).toBeGreaterThan(before+4);
  });
  it('limits mixed impact cues to one every 45ms without delaying commands',async()=>{
    const m=manager();await m.unlock();m.setMusicPaused(true);const h=Host.instances[0];m.play('hit_melee');const count=h.oscillators.length;
    m.play('hit_magic');expect(h.oscillators).toHaveLength(count);h.currentTime=.044;m.play('hit_heavy');expect(h.oscillators).toHaveLength(count);
    h.currentTime=.045;m.play('hit_ranged');expect(h.oscillators.length).toBeGreaterThan(count);const after=h.oscillators.length;m.play('ui_click');expect(h.oscillators.length).toBeGreaterThan(after);
  });
  it('reserves transient headroom inside cue envelopes while keeping the contracted effects bus',async()=>{
    const m=manager();await m.unlock();m.setMusicPaused(true);const h=Host.instances[0],before=h.oscillators.length;m.play('hit_melee');
    const primary=h.oscillators.slice(before).find(o=>o.frequency.events[0].value===680)!,envelope=(primary.target as Filter).target as Gain;
    expect(Math.max(...envelope.gain.events.map(e=>e.value))).toBeCloseTo(.1392);
    expect(h.gains.filter(g=>g.target===h.compressors[0])[1].gain.value).toBeCloseTo(.8625);
  });
  it('reserves more attack headroom when impacts overlap a sustained hero chord',async()=>{
    const m=manager();await m.unlock();m.setMusicPaused(true);const h=Host.instances[0];m.play('merge_hero');const before=h.oscillators.length;m.play('hit_melee');
    const primary=h.oscillators.slice(before).find(o=>o.frequency.events[0].value===680)!,envelope=(primary.target as Filter).target as Gain;
    expect(Math.max(...envelope.gain.events.map(e=>e.value))).toBeCloseTo(.0696);
  });
});

describe('P9 full arrangements',()=>{
  it.each(['menu','battle','boss'] as MusicMode[])('%s runs a 16-bar phrase at its own quarter-note tempo',mode=>{
    expect(tempos[mode]).toBe({menu:116,battle:124,boss:138}[mode]);
    expect(musicStep(mode,64)).toEqual(musicStep(mode,0));
    const bars=Array.from({length:16},(_,bar)=>JSON.stringify(Array.from({length:4},(_,i)=>musicStep(mode,bar*4+i))));
    expect(new Set(bars).size).toBeGreaterThan(8);
    expect(Array.from({length:64},(_,i)=>musicStep(mode,i)).flat().some(n=>n.delay>0)).toBe(true);
    if(mode==='menu')expect(Array.from({length:64},(_,i)=>musicStep(mode,i)).flat().some(n=>n.noise)).toBe(false);
  });
});
