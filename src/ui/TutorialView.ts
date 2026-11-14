import type { TutorialStep } from '../core/Tutorial';
import type { BattleState } from '../core/types';
import { STAGE } from '../config/maps';
import { getMergeTargets } from '../core/MergeTargets';
import { t } from '../i18n/i18n';
import { escapeHtml as esc } from './art';

/** The spotlight is purely visual: it never captures the canvas or pauses simulation. */
export function tutorialMarkup(step:TutorialStep,state:BattleState,selectedId?:number):string {
  if(step==='done')return '';
  let area={x:STAGE.summonX,y:STAGE.summonY,w:STAGE.summonW,h:STAGE.summonH};
  if(step===2){
    area={x:STAGE.shovelX-47,y:STAGE.shovelY-47,w:94,h:94};
    outer:for(let row=0;row<STAGE.rows;row++)for(let col=0;col<STAGE.cols;col++){
      if(state.grid[row][col]==='O'&&!state.units.some(unit=>unit.side==='player'&&unit.location.zone==='board'&&unit.location.col===col&&unit.location.row===row)){
        area={x:STAGE.boardX+col*STAGE.cell,y:STAGE.boardY+row*STAGE.cell,w:STAGE.cell,h:STAGE.cell};break outer;
      }
    }
  }
  if(step===3){
    const own=state.units.filter(unit=>unit.side==='player'&&unit.kind!=='shovel');
    const unit=own.find(unit=>unit.id===selectedId&&getMergeTargets(state,unit.id).length>0)??own.find(unit=>getMergeTargets(state,unit.id).length>0)??own.find(unit=>unit.id===selectedId)??own[0];
    if(unit){
      const location=unit.location;
      const x=location.zone==='bench'?STAGE.benchX+location.slot*STAGE.benchStep+STAGE.benchSize/2:STAGE.boardX+(location.col+.5)*STAGE.cell;
      const y=location.zone==='bench'?STAGE.benchY+STAGE.benchSize/2:STAGE.boardY+(location.row+.5)*STAGE.cell;
      area={x:x-49,y:y-49,w:98,h:98};
    }else area={x:STAGE.benchX,y:STAGE.benchY,w:4*STAGE.benchStep+STAGE.benchSize,h:STAGE.benchSize};
  }
  const bubbleTop=step===1?57:area.y+area.h/2<STAGE.height/2?60:16;
  return `<div class="tutorial-spotlight" style="left:${area.x/STAGE.width*100}%;top:${area.y/STAGE.height*100}%;width:${area.w/STAGE.width*100}%;height:${area.h/STAGE.height*100}%"></div><section class="tutorial-bubble" style="top:${bubbleTop}%;--tutorial-top:${bubbleTop}%" role="status" aria-live="polite"><div><strong>${esc(t(`p1.tutorial${step}.title`))}</strong><button type="button" data-action="tutorial-skip">${esc(t('p1.tutorialSkip'))}</button></div><p>${esc(t(`p3.tutorial${step}.body`))}</p><div class="tutorial-dots" aria-hidden="true">${[1,2,3].map(n=>`<i class="${n===step?'current':''}"></i>`).join('')}</div>${step===3?`<button type="button" class="button button-teal" data-action="tutorial-ack">${esc(t('p1.tutorialAck'))}</button>`:''}</section>`;
}
