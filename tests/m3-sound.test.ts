import {afterEach,describe,expect,it,vi} from 'vitest';
import {SoundManager,type SoundCue} from '../src/ui/SoundManager';
import {BattleEngine} from '../src/core/BattleEngine';

// A recording WebAudio host: real manager schedules actual oscillator nodes and envelopes.
class Param {value=1;events:{value:number;time:number;kind:string}[]=[];setValueAtTime(value:number,time:number){this.value=value;this.events.push({value,time,kind:'set'});}exponentialRampToValueAtTime(value:number,time:number){this.value=value;this.events.push({value,time,kind:'exp'});}linearRampToValueAtTime(value:number,time:number){this.value=value;this.events.push({value,time,kind:'linear'});}setTargetAtTime(value:number,time:number){this.value=value;this.events.push({value,time,kind:'target'});}cancelScheduledValues(){} }
class Gain {gain=new Param();target:unknown;disconnected=false;connect(target:unknown){this.target=target;}disconnect(){this.disconnected=true;}}
class Osc {frequency=new Param();type='sine';target:unknown;onended:(()=>void)|null=null;started:number[]=[];stopped:number[]=[];connect(target:unknown){this.target=target;}disconnect(){}start(time:number){this.started.push(time);}stop(time=0){this.stopped.push(time);}}
class Host {static instances:Host[]=[];currentTime=0;state='suspended';destination={};gains:Gain[]=[];oscillators:Osc[]=[];closed=false;constructor(){Host.instances.push(this);}createGain(){const g=new Gain();this.gains.push(g);return g;}createOscillator(){const o=new Osc();this.oscillators.push(o);return o;}async resume(){this.state='running';}async close(){this.closed=true;this.state='closed';}}
const settings={musicVolume:.5,soundVolume:.75,showDamageNumbers:true};
const managers:SoundManager[]=[];
function manager(){const m=new SoundManager(settings);managers.push(m);return m;}
afterEach(()=>{managers.forEach(m=>m.dispose());managers.length=0;vi.unstubAllGlobals();vi.useRealTimers();Host.instances=[];});
describe('M3 safe sound lifecycle',()=>{
  it('stays silent until a gesture and safely supports hosts without AudioContext',async()=>{
    vi.stubGlobal('AudioContext',undefined);const m=manager();expect(()=>m.play('summon')).not.toThrow();await expect(m.unlock()).resolves.toBeUndefined();m.consumeBattle(new BattleEngine({ai:false}).state);m.dispose();
  });
  it('captures constructor and resume failures without starting music or leaking contexts',async()=>{
    class Rejected extends Host {async resume(){throw new Error('blocked');}}
    vi.stubGlobal('AudioContext',Rejected);vi.useFakeTimers();const m=manager();await expect(m.unlock()).resolves.toBeUndefined();m.play('dig');expect(Host.instances[0].oscillators).toHaveLength(0);m.dispose();expect(Host.instances[0].closed).toBe(true);
  });
  it('silently handles a failing constructor and permits a later gesture retry',async()=>{
    class Broken {constructor(){throw new Error('no device');}}
    vi.stubGlobal('AudioContext',Broken);vi.useFakeTimers();const m=manager();await expect(m.unlock()).resolves.toBeUndefined();m.play('summon');
    vi.stubGlobal('AudioContext',Host);await m.unlock();expect(Host.instances[0].oscillators.length).toBeGreaterThanOrEqual(4);
  });
  it('does not start a scheduler when disposed while resume is pending',async()=>{
    let finish!:()=>void;class Pending extends Host {async resume(){await new Promise<void>(resolve=>{finish=resolve;});this.state='running';}}
    vi.stubGlobal('AudioContext',Pending);vi.useFakeTimers();const m=manager(),unlock=m.unlock();m.dispose();finish();await unlock;vi.advanceTimersByTime(1000);
    expect(Host.instances[0].oscillators).toHaveLength(0);expect(Host.instances[0].closed).toBe(true);
  });
  it('does not restart the soft duck envelope on every animation frame',async()=>{
    vi.stubGlobal('AudioContext',Host);vi.useFakeTimers();const m=manager();await m.unlock();const h=Host.instances[0];m.setDucked(true);
    const music=h.gains.find(g=>g.gain.events.some(e=>e.kind==='target'))!,writes=music.gain.events.length;
    for(let i=0;i<60;i++)m.setDucked(true);
    expect(music.gain.events).toHaveLength(writes);
  });
  it('resumes a suspended host on the next gesture without duplicating buses or the music loop',async()=>{
    vi.stubGlobal('AudioContext',Host);vi.useFakeTimers();const m=manager();await m.unlock();
    const h=Host.instances[0],buses=h.gains.filter(g=>g.target===h.destination),before=h.oscillators.length;
    h.state='suspended';vi.advanceTimersByTime(450);m.play('goose');expect(h.oscillators).toHaveLength(before);
    const first=m.unlock(),second=m.unlock();expect(first).toBe(second);await Promise.all([first,second]);
    expect(h.state).toBe('running');expect(Host.instances).toHaveLength(1);
    expect(h.gains.filter(g=>g.target===h.destination)).toEqual(buses);expect(vi.getTimerCount()).toBe(1);
    m.play('goose');expect(h.oscillators).toHaveLength(before+2);
    h.currentTime=.45;vi.advanceTimersByTime(450);expect(h.oscillators.length).toBeGreaterThan(before+2);expect(h.oscillators.length-before).toBeLessThan(15);
  });
  it('silently retries a rejected reactivation on a later gesture',async()=>{
    vi.stubGlobal('AudioContext',Host);vi.useFakeTimers();const m=manager();await m.unlock();
    const h=Host.instances[0],before=h.oscillators.length;h.state='suspended';
    const resume=vi.spyOn(h,'resume').mockRejectedValueOnce(new Error('gesture temporarily denied'));
    await expect(m.unlock()).resolves.toBeUndefined();m.play('dig');expect(h.oscillators).toHaveLength(before);
    await m.unlock();expect(resume).toHaveBeenCalledTimes(2);expect(h.state).toBe('running');
    m.play('dig');expect(h.oscillators).toHaveLength(before+2);expect(vi.getTimerCount()).toBe(1);
  });
  it('creates no context before unlock, starts one warm diatonic arrangement, and releases it',async()=>{
    vi.stubGlobal('AudioContext',Host);vi.useFakeTimers();const m=manager();m.play('summon');expect(Host.instances).toHaveLength(0);
    await m.unlock();await m.unlock();vi.advanceTimersByTime(4000);
    const h=Host.instances[0];expect(Host.instances).toHaveLength(1);expect(h.oscillators.length).toBeGreaterThan(5);
    const pitchClasses=h.oscillators.map(o=>Math.round(69+12*Math.log2(o.frequency.events[0].value/440))%12);
    expect(pitchClasses.every(p=>[0,2,4,6,7,9,11].includes(p))).toBe(true);expect(pitchClasses).toContain(11);
    expect(h.oscillators.every(o=>o.type==='sine'||o.type==='triangle')).toBe(true);
    m.dispose();const count=h.oscillators.length;vi.advanceTimersByTime(5000);expect(h.oscillators).toHaveLength(count);expect(h.closed).toBe(true);expect(h.gains.every(g=>g.disconnected)).toBe(true);
  });
  it('applies volume zero immediately and softly ducks only music',async()=>{
    vi.stubGlobal('AudioContext',Host);vi.useFakeTimers();const m=manager();await m.unlock();const h=Host.instances[0];
    m.setDucked(true);expect(h.gains.some(g=>g.gain.events.some(e=>e.kind==='target'&&e.value>0&&e.value<.1))).toBe(true);
    m.setSettings({...settings,musicVolume:0,soundVolume:0});m.play('summon');
    expect(h.gains.filter(g=>g.target===h.destination).every(g=>g.gain.value===0)).toBe(true);
  });
  it.each(['summon','dig','upgrade','legendary','goose','orange','sprinkler','lottery_tick','lottery_win','victory','defeat'] as SoundCue[])('synthesizes %s with finite frequencies, audible envelope and bounded stop',async cue=>{
    vi.stubGlobal('AudioContext',Host);vi.useFakeTimers();const m=manager();await m.unlock();const h=Host.instances[0],before=h.oscillators.length;m.play(cue);
    const notes=h.oscillators.slice(before);expect(notes.length).toBeGreaterThan(0);
    for(const o of notes){expect(o.frequency.events.every(e=>Number.isFinite(e.value)&&e.value>0)).toBe(true);expect(o.stopped[0]-o.started[0]).toBeGreaterThan(0);expect(o.stopped[0]-o.started[0]).toBeLessThan(3);const gain=o.target as Gain;expect(gain.gain.events.some(e=>e.value>0.01)).toBe(true);expect(gain.gain.events.at(-1)!.value).toBeLessThan(.001);}
  });
  it('consumes actual battle event identities once and leaves command-owned cues to UI',async()=>{
    vi.stubGlobal('AudioContext',Host);vi.useFakeTimers();const m=manager();await m.unlock();const h=Host.instances[0],engine=new BattleEngine({ai:false}),state=engine.state;
    const base={side:'player' as const,col:0,row:9,age:0,duration:1};
    state.events=[{...base,id:1,type:'orange',value:1},{...base,id:2,type:'purge',effect:'legendary'},{...base,id:3,type:'orange',value:-1},{...base,id:4,type:'dash'},{...base,id:5,type:'sprinkler'},{...base,id:6,type:'purge'}];
    const before=h.oscillators.length;m.consumeBattle(state);const after=h.oscillators.length;expect(after-before).toBe(15);m.consumeBattle(state);expect(h.oscillators).toHaveLength(after);
    h.currentTime=.1;state.events=state.events.slice(0,2);state.id='another-battle';m.consumeBattle(state);expect(h.oscillators).toHaveLength(after+2);
    state.events=[{...base,id:3,type:'orange',value:-1}];m.consumeBattle(state);expect(h.oscillators).toHaveLength(after+4);
  });
});
