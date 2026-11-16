import {afterEach,expect,it} from 'vitest';
import {BattleEngine} from '../src/core/BattleEngine';
import {earlyWaveCoachmarkMarkup,nextBattleSpeed,passiveRailMarkup} from '../src/ui/P13HUD';
import {setLanguage} from '../src/i18n/i18n';
import {P13_SCENE_IDS,sceneSticker} from '../src/ui/stickers';
import {readFileSync,readdirSync} from 'node:fs';
afterEach(()=>setLanguage('zh-CN'));
it('cycles all three speed levels without a fourth state',()=>{
 let speed:1|2|3=1;const observed:number[]=[speed];for(let i=0;i<6;i++){speed=nextBattleSpeed(speed);observed.push(speed);}
 expect(observed).toEqual([1,2,3,1,2,3,1]);
});
it.each(['zh-CN','en'] as const)('renders actionable early-wave coaching and all six passive slots (%s)',language=>{
 setLanguage(language);const e=new BattleEngine();e.start();
 const html=earlyWaveCoachmarkMarkup(8);
 expect(html).toContain('data-action="early-wave"');expect(html).toContain('data-action="dismiss-early-tip"');
 expect(html).toContain('+8');expect(html).toContain('ui_tutorial_pointer');expect(html).not.toMatch(/>p13\./);
 const empty=passiveRailMarkup(e.state,true);expect(empty.match(/data-action="passive-backpack"/g)).toHaveLength(6);
 expect(passiveRailMarkup(e.state,false)).not.toContain('passive-backpack');
 e.state.sides.player.loadout.equippedPassiveProps=['auto_shovel','hyper_party'];
 e.state.sides.player.loadout.ownedProps={auto_shovel:1,hyper_party:1};
 const full=passiveRailMarkup(e.state,false,'auto_shovel');
 expect(full.match(/class="passive-slot-pill /g)).toHaveLength(2);
 expect(full).toContain('data-action="passive-info:auto_shovel"');expect(full).toContain('aria-expanded="true"');
 expect(full).toContain('prop_auto_shovel');expect(full).not.toContain('passive-backpack');
});
it('ships exactly 221 synced sprites and four P13 vector fallbacks',()=>{
 const ids=JSON.parse(readFileSync('public/assets/sprites/manifest.json','utf8'));
 expect(ids).toHaveLength(221);expect(readdirSync('public/assets/sprites').filter(f=>f.endsWith('.png'))).toHaveLength(221);
 expect(P13_SCENE_IDS).toHaveLength(4);
 for(const id of P13_SCENE_IDS){expect(ids).toContain(id);const png=readFileSync(`public/assets/sprites/${id}.png`);expect(png.readUInt32BE(16)).toBe(id==='ui_endless_emblem'?320:160);expect(sceneSticker(id,'',48)).toContain('<svg');}
});
