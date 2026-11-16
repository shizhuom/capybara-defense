import {createServer} from 'vite';
import fs from 'node:fs';
import path from 'node:path';
const output=process.argv[2]??'verification/combat-balance-after.json';
const root=process.cwd(),destination=path.resolve(root,output);
if(!destination.startsWith(root+path.sep))throw new Error('Benchmark output must stay in the game directory');
const loader=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'error'});
try{
  const {runCombatBenchmark}=await loader.ssrLoadModule('/tests/helpers/combat-benchmark.ts');
  const rows=runCombatBenchmark();
  fs.writeFileSync(destination,JSON.stringify({method:'Lv.1 unless specified. Single target / four stacked targets: 180 seconds, 60 Hz, 0 armor, no knockback or kills. Path: each existing open pad across all 4 maps, solo defender, 24 rats (1200 HP, 0 armor, 0.6 tiles/s, 1.3 s spawn interval), 90 seconds at 20 Hz. No props/weapons except named signature scenario.',rows},null,2));
  console.table(rows.map(r=>({kind:r.kind,normal:r.normalDps.toFixed(1),dummy:r.dummy.dps.toFixed(1),pack:r.pack.dps.toFixed(1),range:r.range,path:r.pathAverageDps.toFixed(1),bestPad:r.pathBestDps.toFixed(1)})));
}finally{await loader.close();}
