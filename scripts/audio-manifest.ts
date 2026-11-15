import {lstat,mkdir,readFile,realpath,stat,writeFile} from 'node:fs/promises';
import {dirname,isAbsolute,join,relative,resolve} from 'node:path';
import type {Plugin,ResolvedConfig} from 'vite';

const gameRoot=resolve(import.meta.dirname,'..');
const keys=new Set(['battle_start_clash','hit_melee','hit_ranged','hit_magic','hit_heavy','death_rat','death_bug','death_crab','death_machine','death_frog','death_boss','elite_spawn','hero_merge','bgm_menu','bgm_battle','bgm_boss','ui_click','summon','shovel','treasure','merge_upgrade','merge_hero','hit_soft','boss_spawn','orange_lost','orange_gain','sprinkler','goose','lottery_tick','lottery_win','victory','defeat','dig','upgrade','legendary','orange']);
// Keep this exact path/extension rule aligned with SoundManager's browser-side validator.
const safeFile=(value:unknown):value is string=>typeof value==='string'&&/^(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:mp3|ogg|wav|m4a|aac)$/i.test(value);
const within=(base:string,target:string)=>{const child=relative(base,target);return child===''||(!child.startsWith(`..${process.platform==='win32'?'\\':'/'}`)&&child!=='..'&&!isAbsolute(child));};

/** An in-game link can still redirect writes into source files; reject every component. */
async function rejectOutputLinks(target:string):Promise<void> {
  for(let current=resolve(target);;current=dirname(current)){
    try{if((await lstat(current)).isSymbolicLink())throw new Error(`Audio manifest output link/junction is not allowed: ${current}`);}
    catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
    if(current===dirname(current))return;
  }
}

/** Check both lexical paths and existing ancestors so symlinks cannot escape the game. */
async function assertGamePath(target:string):Promise<string> {
  if(!within(gameRoot,resolve(target)))throw new Error('Audio manifest output must stay within the game directory');
  const actualGame=await realpath(gameRoot);let ancestor=resolve(target);
  for(;;){
    try{
      const actual=await realpath(ancestor);
      if(!within(actualGame,actual))throw new Error('Audio manifest output resolves outside the game directory');
      return actual;
    }catch(error){
      if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;
      const parent=dirname(ancestor);if(parent===ancestor)throw error;ancestor=parent;
    }
  }
}

async function availableManifest(audioDir:string):Promise<Record<string,string>> {
  try{
    const actualDir=await realpath(audioDir),actualGame=await realpath(gameRoot);
    if(!within(actualGame,actualDir))return {};
    const value:unknown=JSON.parse(await readFile(join(audioDir,'manifest.json'),'utf8'));
    if(!value||typeof value!=='object'||Array.isArray(value))return {};
    const entries=await Promise.all(Object.entries(value).filter(([key,file])=>keys.has(key)&&safeFile(file)).map(async([key,file])=>{
      try{
        const path=join(audioDir,file),actual=await realpath(path);
        if(!within(actualDir,actual)||!(await stat(path)).isFile())return null;
        return [key,file] as const;
      }catch{return null;}
    }));
    return Object.fromEntries(entries.filter((entry):entry is readonly[string,string]=>entry!==null));
  }catch{return {};}
}

/** Remove unavailable optional audio before the browser receives its manifest. */
export function audioManifestPlugin():Plugin {
  let config:ResolvedConfig;
  const assertOutput=async(target:string)=>{
    const actual=await assertGamePath(target);
    await rejectOutputLinks(target);
    for(const source of [join(gameRoot,'public'),...(config.publicDir?[config.publicDir]:[])]){
      const actualSource=await realpath(source).catch(()=>resolve(source));
      if(within(resolve(source),resolve(target))||within(actualSource,actual))throw new Error('Audio build output must not overwrite public source files');
    }
  };
  return {
    name:'capybara-audio-manifest',
    configResolved(resolved){config=resolved;},
    configureServer(server){
      server.middlewares.use(async(req,res,next)=>{
        const path=req.url?.split('?')[0];
        const basePath=config.base.startsWith('/')?config.base:'/';
        if(path!=='/audio/manifest.json'&&path!==`${basePath}audio/manifest.json`){next();return;}
        const manifest=config.publicDir?await availableManifest(join(config.publicDir,'audio')):{};
        res.statusCode=200;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');
        res.end(JSON.stringify(manifest));
      });
    },
    async closeBundle(){
      if(config.command!=='build')return;
      const audioDir=resolve(config.root,config.build.outDir,'audio'),manifestPath=join(audioDir,'manifest.json');
      await assertOutput(audioDir);await assertOutput(manifestPath);
      const manifest=await availableManifest(audioDir);
      await mkdir(audioDir,{recursive:true});
      await assertOutput(audioDir);await assertOutput(manifestPath);
      await writeFile(manifestPath,`${JSON.stringify(manifest,null,2)}\n`,'utf8');
    },
  };
}
