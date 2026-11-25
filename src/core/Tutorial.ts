import type {Profile} from './types';

export type TutorialStep=1|2|3|4|5|6|7|'done';
export type TutorialAction='summon'|'dig'|'deploy'|'deploy-bee'|'merge'|'acknowledge'|'open-compendium'|'skip';
/** Call only after a real command succeeds; the opening timer is held separately. */
export function advanceTutorial(step:TutorialStep,action:TutorialAction):TutorialStep {
  if(step==='done'||action==='skip')return 'done';
  if(step===1&&action==='summon')return 2;
  if(step===2&&(action==='dig'||action==='acknowledge'))return 3;
  if(step===3&&(action==='deploy'||action==='acknowledge'))return 4;
  if(step===4&&(action==='merge'||action==='acknowledge'))return 5;
  if(step===5&&(action==='merge'||action==='acknowledge'))return 6;
  if(step===6&&(action==='deploy-bee'||action==='deploy'||action==='acknowledge'))return 7;
  if(step===7&&(action==='open-compendium'||action==='acknowledge'))return 'done';
  return step;
}
/** The caller persists this candidate before adopting it, making storage retries safe. */
export function finishTutorial(profile:Profile,reward:boolean):{profile:Profile;awarded:boolean} {
  const awarded=reward&&!profile.tutorialRewardClaimed;
  return {profile:{...profile,tutorialCompleted:true,tutorialRewardClaimed:!!profile.tutorialRewardClaimed||awarded,coins:profile.coins+(awarded?20:0)},awarded};
}
export function replayTutorial(profile:Profile):Profile {
  return {...profile,tutorialCompleted:false,earlyWaveTipSeen:false};
}
