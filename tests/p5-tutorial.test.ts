import {it,expect} from 'vitest';
import {advanceTutorial,finishTutorial,replayTutorial,type TutorialStep} from '../src/core/Tutorial';
import {createProfile} from '../src/core/MetaProgression';
import {BattleEngine} from '../src/core/BattleEngine';
import {tutorialTargets} from '../src/ui/TutorialView';

it('walks all five tutorial steps and completes only on opening the guide or acknowledgement',()=>{
  let step:TutorialStep=1;
  for(const [action,next] of [['summon',2],['deploy',3],['merge',4],['merge',5],['open-compendium','done']] as const){step=advanceTutorial(step,action);expect(step).toBe(next);}
  expect(advanceTutorial(4,'acknowledge')).toBe(5);expect(advanceTutorial(5,'merge')).toBe(5);expect(advanceTutorial(5,'acknowledge')).toBe('done');
  for(const s of [1,2,3,4,5] as const)expect(advanceTutorial(s,'skip')).toBe('done');
  const p=createProfile(),first=finishTutorial(p,true);expect(first.profile.coins-p.coins).toBe(20);
  expect(finishTutorial(replayTutorial(first.profile),true).profile.coins).toBe(first.profile.coins);
  expect(finishTutorial(p,false).profile.coins).toBe(p.coins);
});
it('locates the actual teaching pairs, empty pad and measured guide button, allowing missing-pair acknowledgement',()=>{
  const e=new BattleEngine({tutorialGuided:true});e.start();e.summon();
  const deploy=tutorialTargets(2,e.state);expect(deploy.source).toBeDefined();expect(deploy.target).toBeDefined();
  const basics=tutorialTargets(3,e.state);expect(basics.source).toBeDefined();expect(basics.acknowledge).toBe(false);
  const hero=tutorialTargets(4,e.state);expect(hero.source).toBeDefined();expect(hero.acknowledge).toBe(false);
  e.state.units=[];expect(tutorialTargets(3,e.state).acknowledge).toBe(true);expect(tutorialTargets(4,e.state).acknowledge).toBe(true);
  const guide={x:890,y:4,w:120,h:50};expect(tutorialTargets(5,e.state,guide).target).toEqual(guide);
});
