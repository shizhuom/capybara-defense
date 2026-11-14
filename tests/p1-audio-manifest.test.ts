import {afterEach,describe,expect,it} from 'vitest';
import {mkdtemp,mkdir,readFile,writeFile,rm,symlink} from 'node:fs/promises';
import {resolve,join,relative,isAbsolute} from 'node:path';
import {resolveConfig,type Plugin,type ResolvedConfig} from 'vite';
import {audioManifestPlugin} from '../scripts/audio-manifest';

const gameRoot=resolve(import.meta.dirname,'..'),fixtures:string[]=[];
type Reply={statusCode:number;headers:Record<string,string>;body:string;next:boolean};
type Middleware=(req:{url?:string},res:{statusCode:number;setHeader:(k:string,v:string)=>void;end:(body:string)=>void},next:()=>void)=>unknown;
async function fixture(manifest:string|object={},outDir='release'){
  const runtime=join(gameRoot,'.runtime');await mkdir(runtime,{recursive:true});
  const root=await mkdtemp(join(runtime,'p1-audio-manifest-'));fixtures.push(root);
  await mkdir(join(root,'public/audio'),{recursive:true});await mkdir(join(root,outDir,'audio'),{recursive:true});
  const text=typeof manifest==='string'?manifest:JSON.stringify(manifest);
  await writeFile(join(root,'public/audio/manifest.json'),text);
  await writeFile(join(root,outDir,'audio/manifest.json'),text);
  const plugin=audioManifestPlugin();
  const config=await resolveConfig({configFile:false,root,base:'./',publicDir:'public',build:{outDir}},'build');
  await (plugin.configResolved as (config:ResolvedConfig)=>unknown)(config);
  return {root,plugin,config,outDir};
}
async function files(root:string,paths:string[]){for(const file of paths){await mkdir(resolve(root,file,'..'),{recursive:true});await writeFile(join(root,file),'audio fixture');}}
async function middleware(plugin:Plugin){
  let handler!:Middleware;
  await (plugin.configureServer as (server:unknown)=>unknown)({middlewares:{use:(fn:Middleware)=>{handler=fn;}}});
  return handler;
}
async function request(handler:Middleware,url:string):Promise<Reply>{
  return new Promise((done,reject)=>{
    const reply:Reply={statusCode:0,headers:{},body:'',next:false};
    const response={statusCode:200,setHeader:(key:string,value:string)=>{reply.headers[key.toLowerCase()]=value;},end:(body:string)=>{reply.statusCode=response.statusCode;reply.body=body;done(reply);}};
    Promise.resolve(handler({url},response,()=>{reply.next=true;done(reply);})).catch(reject);
  });
}
async function close(plugin:Plugin){await (plugin.closeBundle as ()=>unknown)();}
afterEach(async()=>{
  for(const root of fixtures){const child=relative(join(gameRoot,'.runtime'),root);if(child.startsWith('..')||isAbsolute(child))throw new Error('unsafe fixture cleanup');await rm(root,{recursive:true,force:true});}
  fixtures.length=0;
});

describe('P1 zero-404 audio manifest filtering',()=>{
  it('serves only declared safe existing audio files with HTTP 200 and leaves public unchanged',async()=>{
    const original={bgm_menu:'music/chill.ogg',hit_soft:'hit.wav',bgm_boss:'missing.mp3',summon:'missing.wav',unknown:'hit.wav'};
    const {root,plugin}=await fixture(original);await files(root,['public/audio/music/chill.ogg','public/audio/hit.wav']);
    const reply=await request(await middleware(plugin),'/audio/manifest.json?fresh=1');
    expect(reply.statusCode).toBe(200);expect(JSON.parse(reply.body)).toEqual({bgm_menu:'music/chill.ogg',hit_soft:'hit.wav'});
    expect(reply.headers['content-type']).toContain('application/json');expect(reply.headers['cache-control']).toBe('no-store');
    expect(JSON.parse(await readFile(join(root,'public/audio/manifest.json'),'utf8'))).toEqual(original);
  });
  it.each(['{broken','null','[]','"string"'])('returns HTTP 200 empty object for invalid manifest %s',async manifest=>{
    const {root,plugin,outDir}=await fixture(manifest);const reply=await request(await middleware(plugin),'/audio/manifest.json');
    expect(reply.statusCode).toBe(200);expect(JSON.parse(reply.body)).toEqual({});
    await close(plugin);expect(JSON.parse(await readFile(join(root,outDir,'audio/manifest.json'),'utf8'))).toEqual({});
    expect(await readFile(join(root,'public/audio/manifest.json'),'utf8')).toBe(manifest);
  });
  it('rejects unsafe paths even when the corresponding file could exist',async()=>{
    const manifest={bgm_menu:'../escape.mp3',bgm_battle:'/absolute.mp3',bgm_boss:'https://host/boss.mp3',hit_soft:'hit.wav?query',summon:'a%2fb.wav',shovel:'a\\b.wav',treasure:'folder/../hit.wav',merge_hero:'//host/a.wav',orange:'hit.flac',dig:5,upgrade:'folder'};
    const {root,plugin}=await fixture(manifest);await files(root,['public/audio/hit.wav','public/escape.mp3','public/audio/folder/keep.wav']);
    const reply=await request(await middleware(plugin),'/audio/manifest.json');expect(JSON.parse(reply.body)).toEqual({});
  });
  it('does not intercept unrelated requests',async()=>{
    const {plugin}=await fixture();const handle=await middleware(plugin);
    for(const url of ['/audio/hit.wav','/sprites/manifest.json','/audio/manifest.json.extra','/other/audio/manifest.json'])expect((await request(handle,url)).next).toBe(true);
  });
  it('reads fresh public changes without restart and never requests files itself',async()=>{
    const {root,plugin}=await fixture({bgm_menu:'later.mp3'}),handle=await middleware(plugin);
    expect(JSON.parse((await request(handle,'/audio/manifest.json')).body)).toEqual({});
    await files(root,['public/audio/later.mp3']);expect(JSON.parse((await request(handle,'/audio/manifest.json')).body)).toEqual({bgm_menu:'later.mp3'});
  });
  it('filters build output using resolved root/outDir and writes only that output manifest',async()=>{
    const original={bgm_menu:'menu.MP3',dig:'fx/dig.wav',bgm_boss:'missing.ogg'};
    const {root,plugin,outDir}=await fixture(original,'nested/output');
    await files(root,['public/audio/menu.MP3','nested/output/audio/menu.MP3','nested/output/audio/fx/dig.wav']);
    await close(plugin);
    expect(JSON.parse(await readFile(join(root,outDir,'audio/manifest.json'),'utf8'))).toEqual({bgm_menu:'menu.MP3',dig:'fx/dig.wav'});
    expect(JSON.parse(await readFile(join(root,'public/audio/manifest.json'),'utf8'))).toEqual(original);
    expect(await readFile(join(root,outDir,'audio/menu.MP3'),'utf8')).toBe('audio fixture');
  });
  it('keeps empty/missing manifests safe in dev and build',async()=>{
    const {root,plugin,outDir}=await fixture();await rm(join(root,'public/audio/manifest.json'));await rm(join(root,outDir,'audio/manifest.json'));
    expect(JSON.parse((await request(await middleware(plugin),'/audio/manifest.json')).body)).toEqual({});
    await close(plugin);expect(JSON.parse(await readFile(join(root,outDir,'audio/manifest.json'),'utf8'))).toEqual({});
  });
  it('does not write when resolved output points beyond the game directory',async()=>{
    const {root,plugin,config}=await fixture();
    // Deliberately use a path outside the allowed game without touching that location.
    await (plugin.configResolved as (config:ResolvedConfig)=>unknown)({...config,build:{...config.build,outDir:resolve(gameRoot,'..','audio-outside-forbidden')}});
    await expect(close(plugin)).rejects.toThrow(/outside|within|game/i);
    expect(await readFile(join(root,'public/audio/manifest.json'),'utf8')).toBe('{}');
  });
  it('honors resolved base, custom publicDir and an absolute in-game outDir',async()=>{
    const {root,plugin,config,outDir}=await fixture({bgm_menu:'menu.mp3'});
    const customPublic=join(root,'custom-public');await files(root,['custom-public/audio/menu.mp3',`${outDir}/audio/menu.mp3`]);
    await writeFile(join(customPublic,'audio/manifest.json'),'{"bgm_menu":"menu.mp3"}');
    await (plugin.configResolved as (config:ResolvedConfig)=>unknown)({...config,base:'/garden/',publicDir:customPublic,build:{...config.build,outDir:join(root,outDir)}});
    expect(JSON.parse((await request(await middleware(plugin),'/garden/audio/manifest.json')).body)).toEqual({bgm_menu:'menu.mp3'});
    await close(plugin);expect(JSON.parse(await readFile(join(root,outDir,'audio/manifest.json'),'utf8'))).toEqual({bgm_menu:'menu.mp3'});
  });
  it('refuses an output directory that would overwrite the public source manifest',async()=>{
    const original={bgm_menu:'missing.mp3'}, {root,plugin,config}=await fixture(original);
    await (plugin.configResolved as (config:ResolvedConfig)=>unknown)({...config,build:{...config.build,outDir:'public'}});
    await expect(close(plugin)).rejects.toThrow(/public|source/i);
    expect(JSON.parse(await readFile(join(root,'public/audio/manifest.json'),'utf8'))).toEqual(original);
  });
  it('rejects an output audio junction to another game source directory before writing',async()=>{
    const {root,plugin,outDir}=await fixture(),source=join(root,'source'),original='{"bgm_boss":"missing.mp3"}';
    await mkdir(source);await writeFile(join(source,'manifest.json'),original);
    const output=join(root,outDir,'audio');
    if(isAbsolute(relative(root,output))||relative(root,output).startsWith('..'))throw new Error('unsafe fixture path');
    await rm(output,{recursive:true,force:true});await symlink(source,output,'junction');
    await expect(close(plugin)).rejects.toThrow(/link|junction/i);
    expect(await readFile(join(source,'manifest.json'),'utf8')).toBe(original);
  });
  it('rejects an output manifest file symlink to another game file before writing',async()=>{
    const {root,plugin,outDir}=await fixture(),source=join(root,'source-manifest.json'),original='{"bgm_boss":"missing.mp3"}';
    await writeFile(source,original);const output=join(root,outDir,'audio/manifest.json');
    await rm(output);await symlink(source,output,'file');
    await expect(close(plugin)).rejects.toThrow(/link|junction/i);
    expect(await readFile(source,'utf8')).toBe(original);
  });
  it('rejects a junction in an output ancestor before following it or creating directories',async()=>{
    const {root,plugin,config}=await fixture(),source=join(root,'source'),original='{"bgm_boss":"missing.mp3"}';
    await mkdir(join(source,'nested/output/audio'),{recursive:true});await writeFile(join(source,'nested/output/audio/manifest.json'),original);
    await symlink(source,join(root,'redirected'),'junction');
    await (plugin.configResolved as (config:ResolvedConfig)=>unknown)({...config,build:{...config.build,outDir:'redirected/nested/output'}});
    await expect(close(plugin)).rejects.toThrow(/link|junction/i);
    expect(await readFile(join(source,'nested/output/audio/manifest.json'),'utf8')).toBe(original);
  });
});
