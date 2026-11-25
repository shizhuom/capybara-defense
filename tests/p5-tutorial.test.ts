import {it,expect} from 'vitest';
import {advanceTutorial,finishTutorial,replayTutorial,type TutorialStep} from '../src/core/Tutorial';
import {createProfile} from '../src/core/MetaProgression';
import {BattleEngine} from '../src/core/BattleEngine';
import {tutorialTargets} from '../src/ui/TutorialView';

it('walks all seven tutorial steps including bee deployment and completes only on opening the guide or acknowledgement',()=>{
  let step:TutorialStep=1;
  for(const [action,next] of [['summon',2],['dig',3],['deploy',4],['merge',5],['merge',6],['deploy-bee',7],['open-compendium','done']] as const){step=advanceTutorial(step,action);expect(step).toBe(next);}
  expect(advanceTutorial(5,'acknowledge')).toBe(6);expect(advanceTutorial(6,'acknowledge')).toBe(7);expect(advanceTutorial(7,'merge')).toBe(7);expect(advanceTutorial(7,'acknowledge')).toBe('done');
  for(const s of [1,2,3,4,5,6,7] as const)expect(advanceTutorial(s,'skip')).toBe('done');
  const p=createProfile(),first=finishTutorial(p,true);expect(first.profile.coins-p.coins).toBe(20);
  expect(finishTutorial(replayTutorial(first.profile),true).profile.coins).toBe(first.profile.coins);
  expect(finishTutorial(p,false).profile.coins).toBe(p.coins);
});
it('locates the actual teaching pairs, bee food step, empty pad and measured guide button, allowing missing-pair acknowledgement',()=>{
  const e=new BattleEngine({tutorialGuided:true});e.start();e.summon();
  const dig=tutorialTargets(2,e.state);expect(dig.source).toBeDefined();expect(dig.target).toBeDefined();
  const deploy=tutorialTargets(3,e.state);expect(deploy.source).toBeDefined();expect(deploy.target).toBeDefined();
  const basics=tutorialTargets(4,e.state);expect(basics.source).toBeDefined();expect(basics.acknowledge).toBe(false);
  const hero=tutorialTargets(5,e.state);expect(hero.source).toBeDefined();expect(hero.acknowledge).toBe(false);
  const bee=tutorialTargets(6,e.state);expect(bee.source).toBeDefined();expect(bee.target).toBeDefined();expect(bee.acknowledge).toBe(false);
  e.state.units=[];expect(tutorialTargets(4,e.state).acknowledge).toBe(true);expect(tutorialTargets(5,e.state).acknowledge).toBe(true);expect(tutorialTargets(6,e.state).acknowledge).toBe(true);
  const guide={x:890,y:4,w:120,h:50};expect(tutorialTargets(7,e.state,guide).target).toEqual(guide);
});
