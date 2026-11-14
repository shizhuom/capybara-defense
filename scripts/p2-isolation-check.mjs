import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const game=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const repo=path.resolve(game,'../..');
const output=path.join(game,'verification');
const beforeFile=path.join(output,'p2-protected-before.json');
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const relative=file=>path.relative(repo,file).replaceAll('\\','/');
const git=(...args)=>{
  const result=spawnSync('git',['-c',`safe.directory=${repo.replaceAll('\\','/')}`,...args],{cwd:repo,encoding:'utf8',env:{...process.env,GIT_OPTIONAL_LOCKS:'0'}});
  if(result.status!==0)throw Error(result.stderr);
  return result.stdout;
};
const walk=directory=>fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
  const file=path.join(directory,entry.name);
  return entry.isDirectory()?walk(file):entry.isFile()?[file]:[];
});
const protectedFiles=()=>[...new Set([...git('ls-files','-z').split('\0').filter(Boolean).map(file=>path.join(repo,file)),...walk(path.join(repo,'design'))])].sort();

if(process.argv.includes('--capture')){
  if(fs.existsSync(beforeFile))throw Error('P2 protection baseline already exists; refusing to replace it.');
  const files=protectedFiles().map(file=>({path:relative(file),sha256:sha(file)}));
  fs.writeFileSync(beforeFile,JSON.stringify({at:new Date().toISOString(),files},null,2));
  console.log(`Captured ${files.length} read-only baseline/design files.`);
}else{
  const before=JSON.parse(fs.readFileSync(beforeFile,'utf8'));
  const changed=before.files.filter(item=>!fs.existsSync(path.join(repo,item.path))||sha(path.join(repo,item.path))!==item.sha256);
  const beforeNames=new Set(before.files.map(file=>file.path));
  const added=protectedFiles().map(relative).filter(file=>!beforeNames.has(file));
  const ids=JSON.parse(fs.readFileSync(path.join(game,'public/sprites/manifest.json'),'utf8'));
  const sourceDir=path.join(repo,'design/assets/sprites');
  const sourcePngs=fs.readdirSync(sourceDir).filter(file=>file.endsWith('.png'));
  const mismatched=sourcePngs.filter(name=>sha(path.join(sourceDir,name))!==sha(path.join(game,'public/sprites',name)));
  const manifestEqual=sha(path.join(sourceDir,'manifest.json'))===sha(path.join(game,'public/sprites/manifest.json'));
  const mapSizes=ids.filter(id=>id.startsWith('map_')).map(id=>{
    const data=fs.readFileSync(path.join(game,'public/sprites',id+'.png'));
    return{id,width:data.readUInt32BE(16),height:data.readUInt32BE(20)};
  });
  const trackedChanges=git('diff','--name-only').trim();
  const report={at:new Date().toISOString(),checked:before.files.length,changed,added,sourcePngs:sourcePngs.length,manifestCount:ids.length,mismatched,manifestEqual,mapSizes,trackedChanges,
    passed:changed.length===0&&added.length===0&&mismatched.length===0&&sourcePngs.length===145&&ids.length===145&&manifestEqual&&mapSizes.length===4&&mapSizes.every(map=>map.width===768&&map.height===896)&&!trackedChanges};
  fs.writeFileSync(path.join(output,'p2-isolation-report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  if(!report.passed)process.exitCode=1;
}
