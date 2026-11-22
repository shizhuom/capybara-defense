import {afterEach,expect,it} from 'vitest';
import {BattleEngine} from '../src/core/BattleEngine';
import {createProfile} from '../src/core/MetaProgression';
import {setLanguage} from '../src/i18n/i18n';
import * as settlement from '../src/ui/SettlementView';
import type {ResultViewInput} from '../src/ui/SettlementView';

afterEach(()=>setLanguage('zh-CN'));

function victory():ResultViewInput {
 const engine=new BattleEngine({autoWaves:false});engine.start();engine.surrender();
 Object.assign(engine.state,{wave:10,time:125});
 engine.state.sides.player.oranges=3;
 Object.assign(engine.state.result!,{winner:'player',reason:'waves',elapsed:125,coins:65,loot:['m01_swatter','m01_swatter','m10_bamboo_staff'],mvp:{kind:'kungfu_po',level:3,damage:1234.6,kills:27}});
 return {state:engine.state,profile:{...createProfile(),stars:5},savedResult:true,resultStars:2,previousRank:0,newWeapons:['m10_bamboo_staff'],newAvatars:['sakura_capy'],newRoster:{units:['bee'],heroes:['ronin_goose']},ticketAwarded:true};
}

it.each(['zh-CN','en'] as const)('keeps the result heading accessible while setting its title along the ribbon (%s)',language=>{
 setLanguage(language);const html=settlement.resultMarkup(victory());
 expect(html).toMatch(/<h2 id="dialog-title" class="crest-ribbon-title[^>]*>[\s\S]*?<svg class="crest-ribbon-svg" viewBox="0 0 380 100"/);
 expect(html).toContain('id="crest-ribbon-curve" d="M 26,74 Q 190,34 354,74"');
 expect(html).toContain(`<textPath href="#crest-ribbon-curve" startOffset="50%" text-anchor="middle">${language==='en'?'VICTORY':'守卫成功'}</textPath>`);
 // A rank bar nested inside the title row squeezes the title instead of forming its own row.
 expect(html).toMatch(/class="crest-rank-line"[\s\S]*?<\/div>\s*<div class="crest-exp-bar"/);
});

it('presents the MVP, treasure quantities and run footprints without the old nested report cards',()=>{
 const html=settlement.resultMarkup({...victory(),statsOpen:true});
 expect(html).toContain('visual-report-scroll');
 for(const scene of ['visual-mvp-stage','visual-treasure-shelf','visual-footprint-strip'])expect(html).toContain(scene);
 for(const id of ['kungfu_po','ui_mvp_crown','ui_stat_damage_burst','ui_stat_ko_skull','ui_coin_gold','ui_ticket_gacha','ui_unlock_chest','bee','ronin_goose','m10_bamboo_staff','sakura_capy','ui_map_sign','orange'])expect(html).toContain(`data-sticker="${id}"`);
 for(const value of ['1,235','×27','×2','+65','NEW!','02:05'])expect(html).toContain(value);
 expect(html).not.toMatch(/result-rewards-card|result-mvp-card|result-summary-grid|unlock-gallery|loot-tray/);
 expect(html).toContain('aria-labelledby="result-stats-title"');
 expect(html).toContain('class="ledger-body crest-report-body" tabindex="0"');
});

it.each(['zh-CN','en'] as const)('offers endless only after the standard victory has been saved (%s)',language=>{
 setLanguage(language);
 expect(settlement).toHaveProperty('endlessOfferMarkup');
 const offer=(settlement as typeof settlement & {endlessOfferMarkup: (state:ResultViewInput['state'],saved:boolean)=>string}).endlessOfferMarkup;
 const saved=offer(victory().state,true),unsaved=offer(victory().state,false);
 for(const html of [saved,unsaved]){
  expect(html).toContain('data-sticker="ui_endless_emblem"');
  expect(html).toContain('data-action="decline-endless"');
  expect(html).toContain('data-action="enter-endless"');
  expect(html).toContain('id="dialog-title"');
  expect(html).not.toMatch(/>p13\.[\w.]+</);
 }
 expect(saved).toContain('endless-banked-note');
 expect(saved).not.toContain('data-action="retry-save-result"');
 expect(saved).not.toMatch(/data-action="enter-endless"[^>]*disabled/);
 expect(unsaved).not.toContain('endless-banked-note');
 expect(unsaved).not.toContain(language==='en'?'banked':'已入账');
 expect(unsaved).toContain('data-action="retry-save-result"');
 expect(unsaved).toMatch(/data-action="enter-endless"[^>]*disabled/);
});

it.each(['zh-CN','en'] as const)('honors an endless finish and reports whole-run rewards without another rank or ticket award (%s)',language=>{
 setLanguage(language);const input=victory();
 const standardResult={...input.state.result!,loot:[...input.state.result!.loot]};
 Object.assign(input.state,{endless:true,wave:15,standardResult});
 Object.assign(input.state.result!,{endless:true,endlessWave:15,endlessCoins:90,endlessLoot:['m01_swatter'],winner:'player',reason:'oranges'});
 Object.assign(input.profile,{bestEndlessWave:18});
 input.state.sides.player.oranges=0;
 const before=JSON.stringify(input),html=settlement.resultMarkup(input);
 expect(html).toContain(language==='en'?'ENDLESS':'无尽凯旋');
 expect(html).toContain('data-sticker="ui_victory_shield_wings"');
 expect(html).not.toContain('data-sticker="ui_defeat_shield_wings"');
 expect(html).toContain('crest-endless-record');
 expect(html).toContain(language==='en'?'Reached wave 15':'本局抵达第 15 波');
 expect(html).toContain(language==='en'?'best 18':'历史最高 18');
 expect(html).toContain('+155');expect(html).toContain('×3');
 expect(html).not.toContain('class="result-reason"');
 expect(JSON.stringify(input)).toBe(before);
});

it.each(['zh-CN','en'] as const)('renames endless pause surrender to settling rewards while preserving the pause contract (%s)',language=>{
 setLanguage(language);const input=victory();Object.assign(input.state,{endless:true,wave:15});
 const html=settlement.pauseMarkup(input.state);
 expect(html.match(/<section>/g)).toHaveLength(1);
 expect(html).toContain('data-action="surrender"');
 expect(html).toContain(language==='en'?'Settle Endless':'结算无尽奖励');
 expect(html).not.toContain('15/10');
 expect(html).toContain(language==='en'?'Wave 15':'第 15 波');
});

it('keeps an unsaved result retry visible before its report is opened',()=>{
 const html=settlement.resultMarkup({...victory(),savedResult:false});
 const beforeDrawer=html.split('<aside id="result-stats"')[0];
 expect(beforeDrawer).toContain('data-action="retry-save-result"');
 expect(beforeDrawer).toMatch(/data-action="menu"[^>]*disabled/);
 expect(beforeDrawer).toMatch(/data-action="start"[^>]*disabled/);
 expect(html).not.toContain('奖励已记录到本机');
});
