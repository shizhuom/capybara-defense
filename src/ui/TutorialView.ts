import type {TutorialStep} from '../core/Tutorial';
import type {BattleState,Unit} from '../core/types';
import {STAGE} from '../config/maps';
import {UNITS} from '../config/units';
import {RECIPES} from '../config/recipes';
import {MergeSystem} from '../core/MergeSystem';
import {t} from '../i18n/i18n';
import {escapeHtml as esc} from './art';
import {sceneSticker,unitSticker} from './stickers';

export interface TutorialRect {x:number;y:number;w:number;h:number}
function unitRect(unit:Unit):TutorialRect {
  const p=unit.location;
  return p.zone==='bench'?{x:STAGE.benchX+p.slot*STAGE.benchStep,y:STAGE.benchY,w:STAGE.benchSize,h:STAGE.benchSize}:
    {x:STAGE.boardX+p.col*STAGE.cell,y:STAGE.boardY+p.row*STAGE.cell,w:STAGE.cell,h:STAGE.cell};
}
/** Geometry comes from live units, never presumed bench contents. */
export function tutorialTargets(step:TutorialStep,state:BattleState,guide?:TutorialRect):{source?:TutorialRect;target?:TutorialRect;acknowledge:boolean} {
  const own=state.units.filter(u=>u.side==='player'&&u.kind!=='shovel');
  const dock={x:STAGE.benchX,y:STAGE.benchY,w:STAGE.benchStep*4+STAGE.benchSize,h:STAGE.benchSize};
  if(step===1)return{target:{x:STAGE.summonX,y:STAGE.summonY,w:STAGE.summonW,h:STAGE.summonH},acknowledge:false};
  if(step===2){
    const source=own.find(u=>u.location.zone==='bench'&&u.kind==='hamster')??own.find(u=>u.location.zone==='bench');
    let target:TutorialRect|undefined;
    outer:for(let row=0;row<STAGE.rows;row++)for(let col=0;col<STAGE.cols;col++)if(state.grid[row][col]==='O'&&!own.some(u=>u.location.zone==='board'&&u.location.col===col&&u.location.row===row)){
      target={x:STAGE.boardX+col*STAGE.cell,y:STAGE.boardY+row*STAGE.cell,w:STAGE.cell,h:STAGE.cell};break outer;
    }
    return{source:source?unitRect(source):undefined,target:target??{x:STAGE.shovelX-46,y:STAGE.shovelY-46,w:92,h:92},acknowledge:!source};
  }
  if(step===3||step===4){
    const sorted=[...own].sort((a,b)=>(a.location.zone==='bench'?0:1)-(b.location.zone==='bench'?0:1));
    for(const a of sorted)for(const b of own){
      if(a.id===b.id)continue;
      const outcome=MergeSystem.combine(a,b);
      const correct=step===3?a.kind===b.kind&&UNITS[a.kind]?.category==='basic':RECIPES.some(r=>(r.parts as readonly string[]).includes(a.kind)&&(r.parts as readonly string[]).includes(b.kind));
      if(correct&&outcome.ok&&outcome.unit&&!outcome.swap)return{source:unitRect(a),target:unitRect(b),acknowledge:false};
    }
    return{target:dock,acknowledge:true};
  }
  if(step===5)return{target:guide??{x:910,y:8,w:112,h:52},acknowledge:true};
  return{acknowledge:false};
}
export function tutorialMarkup(step:TutorialStep,state:BattleState,_selectedId?:number,guide?:TutorialRect):string {
  if(step==='done')return '';
  const {source,target,acknowledge}=tutorialTargets(step,state,guide);
  const rects=[target,source].filter((r):r is TutorialRect=>!!r);
  const spotlights=rects.map((r,i)=>`<div class="tutorial-spotlight ${i?'tutorial-source':''}" data-tutorial-target="${i?'source':'target'}" style="left:${r.x/STAGE.width*100}%;top:${r.y/STAGE.height*100}%;width:${r.w/STAGE.width*100}%;height:${r.h/STAGE.height*100}%"></div>`).join('');
  const arrow=source&&target?`<svg class="tutorial-arrow" viewBox="0 0 1280 720" aria-hidden="true"><defs><marker id="tutorial-arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10Z" fill="#ffe080"/></marker></defs><path d="M${source.x+source.w/2} ${source.y+source.h/2} Q${source.x+source.w/2} ${target.y+target.h/2} ${target.x+target.w/2} ${target.y+target.h/2}" marker-end="url(#tutorial-arrowhead)"/></svg>`:'';
  const overlaps=(r:TutorialRect)=>rects.some(a=>r.x<a.x+a.w+12&&r.x+r.w>a.x-12&&r.y<a.y+a.h+12&&r.y+r.h>a.y-12);
  const candidates=[{x:450,y:310,w:430,h:245},{x:740,y:180,w:430,h:245},{x:180,y:110,w:430,h:245},{x:460,y:78,w:430,h:245}];
  const bubble=candidates.find(r=>!overlaps(r))??candidates[0];
  const pointer=target&&(step===1||step===5)?`<div class="tutorial-pointer" style="left:${(target.x+target.w*.75)/1280*100}%;top:${(target.y+(step===1?-52:target.h-2))/720*100}%">${sceneSticker('ui_tutorial_pointer','',60)}</div>`:'';
  return `${spotlights}${arrow}${pointer}<section class="tutorial-bubble" data-tutorial-step="${step}" style="--bubble-left:${bubble.x/1280*100}%;--bubble-width:${bubble.w/1280*100}%;top:${bubble.y/720*100}%;--tutorial-top:${bubble.y/720*100}%" role="status" aria-live="polite"><div class="tutorial-heading">${sceneSticker('ui_tutorial_capy','',60)}<strong><span class="tutorial-step-pill">STEP ${step}/5</span>${esc(t(`p5.tutorial${step}.title`))}</strong><button type="button" data-action="tutorial-skip">${esc(t('p1.tutorialSkip'))}</button></div><p>${esc(t(`p5.tutorial${step}.body`))}</p>${step===4?`<div class="tutorial-equation">${unitSticker('panda',38)} + ${unitSticker('hat_bamboo',38)} = ${unitSticker('kungfu_po',44)} <b>${esc(t('hero.kungfu_po'))}</b></div>`:''}<div class="tutorial-dots" aria-label="${step}/5">${[1,2,3,4,5].map(n=>`<i class="${n===step?'current':n<step?'completed':''}">${n}</i>`).join('')}</div>${acknowledge?`<button type="button" class="button button-teal" data-action="tutorial-ack">${esc(t('p1.tutorialAck'))}</button>`:''}</section>`;
}
