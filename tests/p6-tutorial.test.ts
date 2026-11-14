import {afterEach,expect,it,vi} from 'vitest';
import {BattleEngine} from '../src/core/BattleEngine';
import {advanceTutorial} from '../src/core/Tutorial';
import {STAGE} from '../src/config/maps';
import {tutorialTargets,tutorialMarkup,placeTutorialBubble,type TutorialRect} from '../src/ui/TutorialView';
import {GameApp} from '../src/ui/GameApp';
import {setLanguage,t} from '../src/i18n/i18n';
afterEach(()=>{vi.unstubAllGlobals();setLanguage('zh-CN');});
const overlaps=(a:TutorialRect,b:TutorialRect)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
function teaching(){const e=new BattleEngine({tutorialGuided:true});e.start();e.summon();return e;}
it('teaches bench Panda onto a free pad before Hat onto board Panda, staying on step 4 through deploy',()=>{
 const e=teaching(),panda=e.state.units.find(u=>u.kind==='panda')!;
 const first=tutorialTargets(4,e.state);expect(first.source).toEqual({x:STAGE.benchX+2*STAGE.benchStep,y:STAGE.benchY,w:92,h:92});
 expect(first.target!.y).toBeLessThan(STAGE.benchY);expect(first.acknowledge).toBe(false);
 const pad={zone:'board' as const,col:(first.target!.x-STAGE.boardX)/STAGE.cell,row:(first.target!.y-STAGE.boardY)/STAGE.cell};
 expect(e.move(panda.id,pad).ok).toBe(true);expect(advanceTutorial(4,'deploy')).toBe(4);
 const second=tutorialTargets(4,e.state);expect(second.target).toEqual(first.target);expect(second.source!.x).toBe(STAGE.benchX+3*STAGE.benchStep);
 expect(e.move(e.state.units.find(u=>u.kind==='hat_bamboo')!.id,pad).ok).toBe(true);expect(advanceTutorial(4,'merge')).toBe(5);
 expect(e.state.units.find(u=>u.kind==='kungfu_po')!.location).toEqual(pad);
});
it('keeps a board recipe ahead of bench recipes and retains bench/no-pad and missing-pair fallbacks',()=>{
 const e=teaching(),hat=e.state.units.find(u=>u.kind==='hat_bamboo')!;const pad=tutorialTargets(2,e.state).target!;
 e.move(hat.id,{zone:'board',col:(pad.x-STAGE.boardX)/STAGE.cell,row:(pad.y-STAGE.boardY)/STAGE.cell});
 expect(tutorialTargets(4,e.state).target).toEqual(pad);
 const b=teaching();b.state.grid=b.state.grid.map(row=>row.map(tile=>tile==='O'?'G':tile));
 expect(tutorialTargets(4,b.state).target!.y).toBe(STAGE.benchY);
 b.state.units=[];expect(tutorialTargets(4,b.state).acknowledge).toBe(true);
});
it.each([{w:420,h:235},{w:410,h:330}])('avoids real target, source, right live-card and Boss rectangles for bubble size %j',size=>{
 const e=teaching(),targets=tutorialTargets(4,e.state);const obstacles=[targets.source!,targets.target!,{x:960,y:82,w:306,h:380},{x:478,y:7,w:340,h:64}];
 const bubble=placeTutorialBubble(obstacles,size);for(const rect of obstacles)expect(overlaps(bubble,rect)).toBe(false);
 expect(bubble.x).toBeGreaterThanOrEqual(12);expect(bubble.y+bubble.h).toBeLessThan(STAGE.benchY);
});
it('uses bounded least-overlap fallback and translated on-board teaching in both languages',()=>{
 const bubble=placeTutorialBubble([{x:0,y:0,w:1280,h:720}],{w:420,h:235});expect(Number.isFinite(bubble.x)).toBe(true);expect(bubble.x+bubble.w).toBeLessThanOrEqual(1268);
 for(const language of ['zh-CN','en'] as const){setLanguage(language);const html=tutorialMarkup(4,teaching().state,undefined,undefined,[{x:950,y:80,w:310,h:400}]);expect(html).toContain(t('p6.tutorial4Body'));expect(html).toContain('ui_tutorial_capy');}
});
it('docks a portrait toast at the board upper edge even when a large bottom letterbox is available',()=>{
 vi.stubGlobal('window',{innerWidth:390,innerHeight:844});
 const app:any=Object.create(GameApp.prototype);app.element=()=>({getBoundingClientRect:()=>({left:0,right:390,top:312,height:219.375,bottom:531.375})});
 const toast={hidden:false,style:{},getBoundingClientRect:()=>({height:38})};app.positionToast(toast,false);
 expect((toast.style as any).bottom).toBe('auto');expect(parseFloat((toast.style as any).top)).toBeCloseTo(333.94,1);
});
