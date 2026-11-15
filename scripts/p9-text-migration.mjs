import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const changes=[['不许涩涩，Bonk！','吃我一记正义铁槌！'],['Go to bonk jail!','Taste the Hammer of Justice!'],['正义 Bonk 槌','正义破甲槌'],['The Bonk of Justice','Justice Armor-Breaker'],['450% bonk','450% heavy slam'],['Bonk 斩杀线','重槌斩杀线'],['Bonk executes','Heavy-slam executes'],['Bonk threshold','Heavy-slam threshold'],['绝育剃毛总监','魔发剃毛总监'],['绿茶波斯猫','傲娇波斯猫'],['Diva Kitty','Prima Donna Kitty'],['来做我的迷弟吧～','来做我的小跟班吧～'],['Be my biggest fan!','Minions, escort me!'],['疯批大马蜂后','暴躁大马蜂后'],['Hornet Queen','Furious Hornet Queen'],['鸡你太稳！','看我火焰暴扣！'],['Charmed Rat','Dizzy Mouse'],['迷弟耗子','迷糊小耗子']];
for(const directory of ['src/i18n','src/config'])for(const file of fs.readdirSync(path.join(root,directory)).filter(f=>f.endsWith('.ts'))){
 const filename=path.join(root,directory,file),before=fs.readFileSync(filename,'utf8');let after=before;
 for(const [from,to] of changes)after=after.replaceAll(from,to);
 if(file==='p3.ts')after=after.replace("'p3.auto':['自动轮换','Auto']","'p3.auto':['随机','Random']");
 if(file==='m3.ts')after=after.replace("'m3.autoMap': ['跟随段位 · {map}', 'Auto · {map}']","'m3.autoMap': ['随机（已解锁地图）', 'Random (unlocked maps)']");
 if(after!==before)fs.writeFileSync(filename,after);
}
