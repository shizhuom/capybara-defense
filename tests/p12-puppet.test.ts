import {describe,expect,it} from 'vitest';
import {BattleEngine} from '../src/core/BattleEngine';
import {EnemyMotion} from '../src/render/EnemyMotion';
import {drawPuppetSprite} from '../src/render/SpritePuppetAnimator';
import type {RigPose} from '../src/render/SpritePuppetAnimator';

const path=[{col:0,row:0},{col:5,row:0},{col:5,row:2},{col:0,row:2}];
const tau=Math.PI*2;
function enemy(kind='rat') {
  const value=new BattleEngine({autoWaves:false}).spawnEnemy(kind,'player');
  value.id=0;value.progress=0;value.col=0;value.row=0;
  return value;
}

describe('P12 continuous species motion',()=>{
  it.each([
    ['rat','scurry'],['charmed_rat','scurry'],['roach','skitter'],['crab','scuttle'],
    ['killer_bee','flyer'],['hornet_queen','flyer'],['mega_roomba','roller'],['dr_clippers','roller'],
    ['sad_rain_frog','hopper'],['buff_roo','hopper'],['husky_wrecker','heavy_boss'],
    ['box_kraken','heavy_boss'],['diva_kitty','heavy_boss'],['screaming_marmot','heavy_boss'],
    ['king_skunk','heavy_boss'],['trash_coon','heavy_boss'],['dj_rat_king','heavy_boss'],
  ])('gives %s its own %s motion family',(kind,archetype)=>{
    const pose=new EnemyMotion().sample(enemy(kind),0,false,path);
    expect(pose.archetype).toBe(archetype);
    expect(pose.rig.splitLegs).toBe(!['flyer','roller'].includes(archetype));
  });

  it.each([['rat',9.5,6.5,4.5],['charmed_rat',9.5,6.5,4.5],['roach',13.5,4.2,2.2]] as const)(
    'moves %s legs from actual distance instead of elapsed time',(kind,frequency,stride,lift)=>{
      const motion=new EnemyMotion(),e=enemy(kind);e.progress=.2;
      const first=motion.sample(e,0,false,path);
      expect(first.phase).toBeCloseTo(.2*frequency);
      expect(first.rig.strideX).toBe(stride);expect(first.rig.liftY).toBe(lift);
      const waiting=motion.sample(e,20,false,path);
      expect(waiting.phase).toBe(first.phase);expect(waiting.rig).toEqual(first.rig);
      e.progress+=.01;
      expect(motion.sample(e,21,false,path).phase-first.phase).toBeCloseTo(.01*frequency);
    },
  );

  it('keeps skittering close to the floor and gives crabs the specified lateral sway',()=>{
    const roach=enemy('roach'),crab=enemy('crab'),r=new EnemyMotion(),c=new EnemyMotion();
    let maximumHop=0;
    for(let i=0;i<120;i++){
      roach.progress=crab.progress=i/60;
      const skitter=r.sample(roach,i/60,false,path),scuttle=c.sample(crab,i/60,false,path);
      maximumHop=Math.max(maximumHop,-skitter.hopY);
      expect(scuttle.tilt).toBeCloseTo(Math.sin(scuttle.phase)*.13);
    }
    expect(maximumHop).toBeGreaterThan(1);expect(maximumHop).toBeLessThanOrEqual(1.8);
  });

  it('uses continuous 28Hz wings, 36Hz motors and the exact hovering curve',()=>{
    const bee=enemy('killer_bee'),roller=enemy('mega_roomba');
    const wings=new EnemyMotion(),motor=new EnemyMotion();
    const a=wings.sample(bee,1,false,path),b=wings.sample(bee,1+1/60,false,path);
    expect(a.hopY).toBeCloseTo(-11+Math.sin(5.2)*5);
    expect(b.wingPhase-a.wingPhase).toBeCloseTo(tau*28/60);
    expect(b.rig.strideX).toBe(0);
    const x=motor.sample(roller,1,false,path),y=motor.sample(roller,1+1/60,false,path);
    expect(y.motorPhase-x.motorPhase).toBeCloseTo(tau*36/60);
    expect(Math.abs(x.hopY)).toBeLessThanOrEqual(.8);expect(y.rig.strideX).toBe(0);
  });

  it.each(['sad_rain_frog','buff_roo'])('gives %s a grounded charge, parabolic leap and landing ripple',kind=>{
    const e=enemy(kind),motion=new EnemyMotion();let highest=0,landings=0,charges=0;
    for(let i=0;i<=360;i++){
      e.progress=i/120;const pose=motion.sample(e,i/60,false,path);
      const cycle=((pose.phase%tau)+tau)%tau/tau;
      if(cycle<.24){
        charges++;expect(pose.hopY).toBe(0);
        expect(pose.squashX).toBeCloseTo(1.15);expect(pose.squashY).toBeCloseTo(.84);
      }
      if(cycle>.28&&cycle<.84){
        expect(pose.hopY).toBeLessThan(0);
        expect(pose.squashX).toBeCloseTo(.9);expect(pose.squashY).toBeCloseTo(1.12);
      }
      if(pose.landing>=0){landings++;expect(pose.landing).toBeLessThanOrEqual(1);}
      highest=Math.max(highest,-pose.hopY);
    }
    expect(charges).toBeGreaterThan(0);expect(landings).toBeGreaterThan(0);
    expect(highest).toBeGreaterThan(13.9);expect(highest).toBeLessThanOrEqual(18);
  });

  it('gives heavy bosses long strides and an asymmetric weighted step',()=>{
    const motion=new EnemyMotion(),e=enemy('husky_wrecker');e.progress=.2;
    const pose=motion.sample(e,0,false,path);
    expect(pose.rig.strideX).toBe(8.5);expect(pose.rig.liftY).toBe(5.5);
    expect(pose.rig.spineLag).toBeGreaterThan(2);
    expect(-pose.hopY).toBeCloseTo(Math.pow(Math.abs(Math.sin(pose.phase)),.65)*7);
  });

  it('turns with elapsed-time exponential smoothing while keeping a visible minimum width',()=>{
    const motion=new EnemyMotion(),e=enemy();
    const initial=motion.sample(e,0,false,path);expect(initial.visualFlip).toBe(-1);
    e.col=-.1;const first=motion.sample(e,1/60,false,path);
    expect(first.dirX).toBe(-1);expect(first.flipX).toBe(1);
    expect(first.visualFlip).toBeCloseTo(-1+2*(1-Math.exp(-18/60)));
    expect(first.bankTilt).not.toBe(0);
    for(let i=2;i<=60;i++){
      const pose=motion.sample(e,i/60,false,path);
      expect(Math.abs(pose.visualFlip)).toBeGreaterThanOrEqual(.24);
    }
    expect(motion.sample(e,2,false,path).visualFlip).toBeCloseTo(1);
    const split=new EnemyMotion(),splitEnemy=enemy();split.sample(splitEnemy,0,false,path);splitEnemy.col=-.1;
    split.sample(splitEnemy,1/120,false,path);
    expect(split.sample(splitEnemy,1/60,false,path).visualFlip).toBeCloseTo(first.visualFlip);
  });

  it('pops from .35 through 1.09 and settles exactly at .22 seconds',()=>{
    const motion=new EnemyMotion(),e=enemy();
    expect(motion.sample(e,10,false,path).spawnScale).toBeCloseTo(.35);
    let peak=0;
    for(let i=1;i<=22;i++)peak=Math.max(peak,motion.sample(e,10+i/100,false,path).spawnScale);
    expect(peak).toBeCloseTo(1.09,2);
    expect(motion.sample(e,10.22,false,path).spawnScale).toBe(1);
  });

  it('starts a fresh damped jello response on damage, including repeated hits with the same flash',()=>{
    const motion=new EnemyMotion(),e=enemy();motion.sample(e,0,false,path);
    e.hp-=1;e.hitFlash=.14;expect(motion.sample(e,.1,false,path).jello).toBe(0);
    const hit=motion.sample(e,.14,false,path);
    expect(hit.jello).toBeCloseTo(Math.exp(-14*.04)*Math.sin(34*.04));
    e.hp-=1;expect(motion.sample(e,.15,false,path).jello).toBe(0);
    expect(motion.sample(e,.19,false,path).jello).toBeCloseTo(hit.jello);
    e.hitFlash=0;expect(Math.abs(motion.sample(e,1,false,path).jello)).toBeLessThan(.0001);
  });

  it('detects boss cooldown resets and limits the roar to .45 active seconds',()=>{
    const motion=new EnemyMotion(),e=enemy('husky_wrecker');e.abilityCooldown=.1;motion.sample(e,0,false,path);
    e.abilityCooldown=24;expect(motion.sample(e,.01,false,path).roar).toBe(0);
    expect(motion.sample(e,.2,false,path).roar).toBeGreaterThan(.5);
    expect(motion.sample(e,.46,false,path).roar).toBe(0);
  });

  it('freezes every pose field while paused and resumes like an uninterrupted active clock',()=>{
    const e=enemy('killer_bee'),motion=new EnemyMotion();motion.sample(e,0,false,path);
    const active=motion.sample(e,.05,false,path);
    expect(motion.sample(e,.05,true,path)).toEqual(active);
    expect(motion.sample(e,50,true,path)).toEqual(active);
    const resumed=motion.sample(e,50+1/60,false,path);
    const control=new EnemyMotion();control.sample(e,0,false,path);control.sample(e,.05,false,path);
    const expected=control.sample(e,.05+1/60,false,path);
    for(const [field,value] of Object.entries(expected)){
      if(typeof value==='number')expect(resumed[field as keyof typeof resumed]).toBeCloseTo(value,10);
    }
    expect(resumed.rig.phase).toBeCloseTo(expected.rig.phase,10);
    expect(motion.sample(e,51,true,path)).toEqual(resumed);
    expect(motion.sample(e,100,false,path)).toEqual(resumed);
  });

  it('freezes stunned gait while maintaining the dizzy wiggle and avoids a release jump',()=>{
    const motion=new EnemyMotion(),e=enemy();e.progress=.2;
    const active=motion.sample(e,0,false,path);
    e.stun=1;e.progress=.5;
    const stunned=motion.sample(e,.1,false,path),later=motion.sample(e,.2,false,path);
    expect(stunned.phase).toBe(active.phase);expect(later.rig).toEqual(active.rig);
    expect(later.tilt).not.toBe(stunned.tilt);expect(later.footfall).toBe(false);
    e.stun=0;e.progress+=.01;
    expect(motion.sample(e,.21,false,path).phase-active.phase).toBeCloseTo(.095);
  });

  it('keeps enemy data untouched and starts fresh after retention removal or clear',()=>{
    const motion=new EnemyMotion(),e=enemy(),before=JSON.stringify(e);
    motion.sample(e,0,false,path);motion.sample(e,1,false,path);
    expect(JSON.stringify(e)).toBe(before);
    motion.retain(new Set());expect(motion.sample(e,2,false,path).spawnScale).toBe(.35);
    motion.sample(e,3,false,path);motion.clear();expect(motion.sample(e,4,false,path).spawnScale).toBe(.35);
  });
});

type ImageDraw=[CanvasImageSource,number,number,number,number,number,number,number,number];
const neutralRig:RigPose={phase:0,spineLag:0,leanX:0,waveAmpX:0,breatheAmp:0,strideX:0,liftY:0,splitLegs:true};
function drawSlices(pose:RigPose=neutralRig,image:CanvasImageSource={naturalWidth:256,naturalHeight:128} as HTMLImageElement,size=100):ImageDraw[]{
  const draws:ImageDraw[]=[];
  const context={drawImage:(...args:ImageDraw)=>draws.push(args)} as unknown as CanvasRenderingContext2D;
  drawPuppetSprite(context,image,size,pose);
  return draws;
}

describe('P12 single-sprite puppet geometry',()=>{
  it('covers six torso bands and three pairs of feet without exceeding source bounds',()=>{
    const draws=drawSlices();expect(draws).toHaveLength(12);
    for(const [,sx,sy,sw,sh,dx,dy,dw,dh] of draws){
      expect(sx).toBeGreaterThanOrEqual(0);expect(sy).toBeGreaterThanOrEqual(0);
      expect(sw).toBeGreaterThan(0);expect(sh).toBeGreaterThan(0);
      expect(sx+sw).toBeLessThanOrEqual(256);expect(sy+sh).toBeLessThanOrEqual(128);
      expect([dx,dy,dw,dh].every(Number.isFinite)).toBe(true);
    }
    expect(draws.slice(0,6).every(([,sx,,sw])=>sx===0&&sw===256)).toBe(true);
    expect(draws[0][6]).toBe(-50);expect(draws.at(-1)![6]+draws.at(-1)![8]).toBe(50);
    expect(draws[6][1]).toBe(0);expect(draws[6][3]).toBeCloseTo(256*.52);
    expect(draws[7][1]).toBeCloseTo(256*.48);expect(draws[7][3]).toBeCloseTo(256*.52);
  });

  it('overlaps adjacent source and destination rows by .8 pixels, including the hip seam',()=>{
    const draws=drawSlices(),rows=[...draws.slice(0,6),draws[6],draws[8],draws[10]];
    for(let i=0;i<rows.length-1;i++){
      expect(rows[i][2]+rows[i][4]-rows[i+1][2]).toBeCloseTo(.8);
      expect(rows[i][6]+rows[i][8]-rows[i+1][6]).toBeCloseTo(.8);
    }
  });

  it('anchors the hip while opposite feet trace alternating elliptical strides',()=>{
    const base=drawSlices(),side=drawSlices({...neutralRig,phase:Math.PI/2,strideX:6,liftY:4});
    expect(side[6].slice(5)).toEqual(base[6].slice(5));expect(side[7].slice(5)).toEqual(base[7].slice(5));
    expect(side[10][5]-base[10][5]).toBeCloseTo(6);expect(side[11][5]-base[11][5]).toBeCloseTo(-6);
    const front=drawSlices({...neutralRig,phase:0,strideX:6,liftY:4});
    const rear=drawSlices({...neutralRig,phase:Math.PI,strideX:6,liftY:4});
    expect(front[10][6]-base[10][6]).toBe(-4);expect(front[11][6]).toBe(base[11][6]);
    expect(rear[10][6]).toBe(base[10][6]);expect(rear[11][6]-base[11][6]).toBe(-4);
  });

  it('delays the upper spine and keeps a different smoothly changing pose at every 60Hz sample',()=>{
    const frames:ImageDraw[][]=[];
    for(let i=0;i<60;i++)frames.push(drawSlices({...neutralRig,phase:i*.1,spineLag:2.5,waveAmpX:3.2,breatheAmp:.03,strideX:6.5,liftY:4.5}));
    expect(new Set(frames.map(frame=>JSON.stringify(frame.map(draw=>draw.slice(5))))).size).toBe(60);
    expect(frames[0][0][5]).not.toBe(frames[0][5][5]);
    for(let i=1;i<frames.length;i++)for(let band=0;band<12;band++){
      expect(Math.abs(frames[i][band][5]-frames[i-1][band][5])).toBeLessThan(1.5);
      expect(Math.abs(frames[i][band][6]-frames[i-1][band][6])).toBeLessThan(1);
    }
  });

  it('keeps the lower body whole for flyers and rollers',()=>{
    const draws=drawSlices({...neutralRig,phase:1,splitLegs:false,strideX:100,liftY:100});
    expect(draws).toHaveLength(9);
    expect(draws.every(([,sx,,sw])=>sx===0&&sw===256)).toBe(true);
    expect(draws.at(-1)![6]+draws.at(-1)![8]).toBe(50);
  });

  it('uses natural dimensions first, falls back to canvas dimensions and skips empty images safely',()=>{
    const canvas={width:64,height:32} as HTMLCanvasElement,draws=drawSlices(neutralRig,canvas,20);
    expect(draws[0][3]).toBe(64);expect(draws.at(-1)![2]+draws.at(-1)![4]).toBe(32);
    const zeroNatural={naturalWidth:0,naturalHeight:0,width:64,height:32} as HTMLImageElement;
    expect(drawSlices(neutralRig,zeroNatural,20)).toEqual(draws.map(draw=>[zeroNatural,...draw.slice(1)]));
    const natural={naturalWidth:16,naturalHeight:8,width:64,height:32} as HTMLImageElement;
    expect(drawSlices(neutralRig,natural,20)[0][3]).toBe(16);
    expect(drawSlices(neutralRig,{width:0,height:0} as HTMLCanvasElement)).toEqual([]);
    expect(drawSlices(neutralRig,canvas,0)).toEqual([]);
  });
});
