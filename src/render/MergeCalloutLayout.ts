import {STAGE} from '../config/maps';
import type {StageRect} from '../core/types';

const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
const overlap=(a:StageRect,b:StageRect)=>Math.max(0,Math.min(a.x+a.w+4,b.x+b.w)-Math.max(a.x-4,b.x))*Math.max(0,Math.min(a.y+a.h+4,b.y+b.h)-Math.max(a.y-4,b.y));

/** Prefer directly above/below the partner; HUD and previous labels are hard obstacles. */
export function placeMergeCallout(p:{x:number;y:number},w:number,h:number,obstacles:readonly StageRect[],used:readonly StageRect[]):StageRect {
 const rect=(x:number,y:number):StageRect=>({x:clamp(x,8,STAGE.width-w-8),y:clamp(y,8,STAGE.height-h-8),w,h});
 const blocked=(r:StageRect)=>[...obstacles,...used].some(o=>overlap(r,o)>0);
 const preferred=[rect(p.x-w/2,p.y-82),rect(p.x-w/2,p.y+58)];
 for(const r of preferred)if(!blocked(r))return r;
 const candidates=[...preferred,rect(p.x-w-58,p.y-h/2),rect(p.x+58,p.y-h/2)];
 // Search the full safe stage if several neighboring partners need translated labels.
 const xs=[p.x-w/2,p.x-w-58,p.x+58,8,STAGE.width-w-8];
 for(let x=STAGE.boardX;x<STAGE.width-w-8;x+=STAGE.cell)xs.push(x);
 for(const x of xs)for(let y=8;y<=STAGE.height-h-8;y+=h+6)candidates.push(rect(x,y));
 const score=(r:StageRect)=>obstacles.reduce((n,o)=>n+overlap(r,o),0)*1e8+used.reduce((n,o)=>n+overlap(r,o),0)*1e6+(r.x+r.w/2-p.x)**2+(r.y+r.h/2-p.y)**2;
 const free=candidates.filter(r=>!blocked(r)),pool=free.length?free:candidates;
 let best=pool[0],bestScore=score(best);
 for(const candidate of pool.slice(1)){const s=score(candidate);if(s<bestScore){best=candidate;bestScore=s;}}
 return best;
}
