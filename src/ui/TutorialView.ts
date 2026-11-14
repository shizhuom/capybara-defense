import type { TutorialStep } from '../core/Tutorial';
import type { BattleState } from '../core/types';
import { STAGE } from '../config/maps';
import { getMergeTargets } from '../core/MergeTargets';
import { t } from '../i18n/i18n';
import { escapeHtml as esc } from './art';

/** The spotlight is purely visual: it never captures the canvas or pauses simulation. */
export function tutorialMarkup(step:TutorialStep,state:BattleState,selectedId?:number):string {
  if(step==='done')return '';
  let area={x:128,y:1226,w:384,h:128};
  if(step===2){
    area={x:STAGE.shovelX-47,y:STAGE.shovelY-47,w:94,h:94};
    outer:for(let row=5;row<10;row++)for(let col=0;col<8;col++){
      if(state.grid[row][col]==='O'&&!state.units.some(unit=>unit.side==='player'&&unit.location.zone==='board'&&unit.location.col===col&&unit.location.row===row)){
        area={x:STAGE.boardX+col*STAGE.cell,y:STAGE.boardY+row*STAGE.cell,w:STAGE.cell,h:STAGE.cell};break outer;
      }
    }
  }
  if(step===3){
    const own=state.units.filter(unit=>unit.side==='player');
    const unit=own.find(unit=>unit.id===selectedId&&getMergeTargets(state,unit.id).length>0)??own.find(unit=>getMergeTargets(state,unit.id).length>0)??own.find(unit=>unit.id===selectedId)??own[0];
    if(unit){
      const location=unit.location;
      const x=location.zone==='bench'?STAGE.benchX+location.slot*STAGE.benchStep+STAGE.benchSize/2:STAGE.boardX+(location.col+.5)*STAGE.cell;
      const y=location.zone==='bench'?STAGE.benchY+STAGE.benchSize/2:STAGE.boardY+(location.row+.5)*STAGE.cell;
      area={x:x-49,y:y-49,w:98,h:98};
    }else area={x:26,y:1018,w:586,h:170};
  }
  return `<div class="tutorial-spotlight" style="left:${area.x/640*100}%;top:${area.y/1386*100}%;width:${area.w/640*100}%;height:${area.h/1386*100}%"></div><section class="tutorial-bubble" style="top:${step===1?70:30}%" role="status" aria-live="polite"><div><strong>${esc(t(`p1.tutorial${step}.title`))}</strong><button type="button" data-action="tutorial-skip">${esc(t('p1.tutorialSkip'))}</button></div><p>${esc(t(`p1.tutorial${step}.body`))}</p><div class="tutorial-dots" aria-hidden="true">${[1,2,3].map(n=>`<i class="${n===step?'current':''}"></i>`).join('')}</div>${step===3?`<button type="button" class="button button-teal" data-action="tutorial-ack">${esc(t('p1.tutorialAck'))}</button>`:''}</section>`;
}
