import {createServer} from 'vite';
import fs from 'node:fs';
const loader=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'error'});
try{
  const {BattleEngine}=await loader.ssrLoadModule('/src/core/BattleEngine.ts');
  const runs=[];
  for(let seed=1;seed<=30;seed++){
    const e=new BattleEngine({seed});e.start();e.state.sides.player.oranges=999;
    e.tick(420);
    runs.push({seed,seconds:Math.round(e.state.time),wave:e.state.wave,phase:e.state.phase,finishReason:e.state.result?.reason??null,remainingEnemies:e.state.enemies.length,aiOranges:e.state.sides.ai.oranges,aiUnits:e.state.units.filter(u=>u.side==='ai'&&u.location.zone==='board').length,aiKills:e.state.sides.ai.kills});
  }
  const opening=new BattleEngine({seed:1,ai:false});opening.start();opening.state.sides.ai.oranges=999;
  for(const [kind,col] of [['hamster',2],['squirrel',3],['hedgehog',4]]){
    const id=opening.grant(kind).unitId;opening.move(id,{zone:'board',col,row:7});
  }
  opening.tick(107.9);
  const losses=runs.filter(r=>r.aiOranges===0);
  const report={scenario:'30 seeded rivals against protected non-attacking player; opening probe has three Lv1 defenders only',reachedWaveTenAlive:runs.filter(r=>r.wave===10&&r.aiOranges>0).length,completedTenWavesAlive:runs.filter(r=>r.wave===10&&r.phase==='finished'&&r.finishReason==='waves'&&r.remainingEnemies===0&&r.aiOranges>0).length,earliestAiLoss:losses.length?Math.min(...losses.map(r=>r.seconds)):null,opening:{seconds:opening.state.time,oranges:opening.state.sides.player.oranges,kills:opening.state.sides.player.kills},runs};
  fs.writeFileSync('verification/balance-simulation.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({reachedWaveTenAlive:report.reachedWaveTenAlive,completedTenWavesAlive:report.completedTenWavesAlive,earliestAiLoss:report.earliestAiLoss,opening:report.opening}));
}finally{await loader.close();}
