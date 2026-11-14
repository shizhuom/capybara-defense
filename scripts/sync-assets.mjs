import {copyFile,mkdir,readdir,writeFile,lstat,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const safeName=/^[a-z][a-z0-9_]*\.png$/;
function assertInside(root,target){
  const relative=path.relative(root,target);
  if(relative==='..'||relative.startsWith(`..${path.sep}`)||path.isAbsolute(relative))throw Error(`Sprite target is outside the game directory: ${target}`);
}
async function rejectLink(filename){
  try{if((await lstat(filename)).isSymbolicLink())throw Error(`Sprite target link/junction is not allowed: ${filename}`);}
  catch(error){if(error.code!=='ENOENT')throw error;}
}
async function checkTargetDirectory(targetDir){
  assertInside(projectRoot,targetDir);
  // Check every existing ancestor before mkdir can follow a directory junction.
  for(let current=targetDir;;current=path.dirname(current)){
    await rejectLink(current);
    if(current===path.dirname(current))break;
  }
  await mkdir(targetDir,{recursive:true});
  assertInside(await realpath(projectRoot),await realpath(targetDir));
}
async function pngNames(directory){
  try{return (await readdir(directory,{withFileTypes:true})).filter(entry=>entry.isFile()&&safeName.test(entry.name)).map(entry=>entry.name).sort();}
  catch(error){if(error.code==='ENOENT')return [];throw error;}
}
/** Copies optional local art without deleting an existing destination override. */
export async function syncAssets({sourceDir=path.resolve(projectRoot,'../../design/assets/sprites'),targetDir=path.resolve(projectRoot,'public/sprites')}={}){
  targetDir=path.resolve(targetDir);
  await checkTargetDirectory(targetDir);
  const source=await pngNames(sourceDir);
  // Validate the entire write batch before replacing any PNG or manifest bytes.
  const targets=new Set([...source,'manifest.json',...(await readdir(targetDir)).filter(name=>safeName.test(name))]);
  for(const name of targets)await rejectLink(path.join(targetDir,name));
  for(const name of source)await copyFile(path.join(sourceDir,name),path.join(targetDir,name));
  const ids=(await pngNames(targetDir)).map(name=>name.slice(0,-4));
  await writeFile(path.join(targetDir,'manifest.json'),`${JSON.stringify(ids,null,2)}\n`);
  console.log(`Sprites: copied ${source.length}; manifest contains ${ids.length} images${source.length?'':' (optional source absent or empty)'}.`);
  return ids;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  syncAssets().catch(error=>{console.error(error);process.exitCode=1;});
}
