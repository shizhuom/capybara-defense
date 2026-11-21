import type {Profile} from '../core/types';
import {HEROES} from '../config/heroes';
import {AVATARS} from '../config/avatars';
import {medallionTotalLevel} from '../config/medallions';
import {displayNickname,isValidPlayerId,isValidWriteSecret,SESSION_WRITE_SECRET} from '../core/PlayerIdentity';
import {effectiveLocationToken,sanitizeLocation} from '../core/Location';
import {readSetting,writeSetting,browserStorage} from './storage';

/**
 * P17 global leaderboards client (Endless + Rank + Geo). Talks to the Cloudflare Worker in `cloudflare-leaderboard/`;
 * when no URL is configured, the network is down or the request times out, it never throws: it reports
 * `unconfigured`/`offline` and serves this device's best run plus the last board it managed to download.
 */
export const BOARD_CACHE_KEY='endless_board_cache';
export const RANK_BOARD_CACHE_KEY='rank_board_cache';
export const BOARD_LIMIT=100;
export const BOARD_TIMEOUT_MS=5000;
export const BOARD_REFRESH_MS=30_000;
/** Runtime default when no build-time `VITE_LEADERBOARD_API_URL` is supplied (empty = local mode). */
export const DEFAULT_LEADERBOARD_API_URL='';

export interface LeaderboardEntry {
  rank:number;
  /** True only for the current player's own row; raw `playerId` is never returned for other players. */
  isMe?:boolean;
  /** Optional legacy/local identifier (present only in local offline rows or pre-P17.1 cache). */
  playerId?:string;
  nickname:string;avatarId:string;location?:string;bestWave:number;elapsedSeconds:number;
  mvpKind:string;mvpAwakened:boolean;awakenedCount:number;medallionTotal:number;updatedAt:number;
}
export interface RankLeaderboardEntry {
  rank:number;
  isMe?:boolean;
  playerId?:string;
  nickname:string;avatarId:string;location?:string;
  stars:number;highestStars:number;wins:number;matches:number;bestWinStreak:number;updatedAt:number;
}
export type BoardMode='online'|'offline'|'unconfigured';
export interface LeaderboardSnapshot {
  mode:BoardMode;entries:LeaderboardEntry[];totalPlayers:number;me:LeaderboardEntry|null;
  /** When the entries were downloaded (ms), or `null` when nothing was ever cached. */
  fetchedAt:number|null;
}
export interface RankLeaderboardSnapshot {
  mode:BoardMode;entries:RankLeaderboardEntry[];totalPlayers:number;me:RankLeaderboardEntry|null;
  fetchedAt:number|null;
}
export interface ScoreSubmission {
  playerId:string;writeSecret:string;nickname:string;avatarId:string;location:string;bestWave:number;elapsedSeconds:number;
  mvpKind:string;mvpAwakened:boolean;awakenedCount:number;medallionTotal:number;
}
export interface RankSubmission {
  playerId:string;writeSecret:string;nickname:string;avatarId:string;location:string;
  stars:number;highestStars:number;wins:number;matches:number;bestWinStreak:number;
}
export interface SubmitOutcome {ok:boolean;mode:BoardMode;rank?:number;totalPlayers?:number;improved?:boolean;key:string}
export interface NicknameCheckOutcome {available:boolean;mode:BoardMode;key?:string}
export interface ClientOptions {
  baseUrl?:string;fetch?:typeof fetch;storage?:Storage;timeoutMs?:number;now?:()=>number;
}

/** Build-time env first, then an optional page-level override, then the runtime default. */
export function resolveLeaderboardUrl():string {
  const env=(import.meta as {env?:Record<string,string|undefined>}).env?.VITE_LEADERBOARD_API_URL;
  const runtime=(globalThis as {CAPY_LEADERBOARD_API_URL?:unknown}).CAPY_LEADERBOARD_API_URL;
  const url=typeof env==='string'&&env.trim()?env:typeof runtime==='string'?runtime:DEFAULT_LEADERBOARD_API_URL;
  return url.trim().replace(/\/+$/,'');
}

const int=(value:unknown,min:number,max:number):number|null=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=min&&value<=max?value:null;
const text=(value:unknown,max:number):string=>typeof value==='string'?value.slice(0,max):'';
/** Strict parse of one endless row from the Worker (secure `isMe` format or legacy `player_id` cache); malformed rows are dropped. */
export function parseEntry(raw:unknown,fallbackRank=0):LeaderboardEntry|null {
  if(!raw||typeof raw!=='object')return null;
  const r=raw as Record<string,unknown>,pick=(camel:string,snake:string)=>r[camel]??r[snake];
  const rawId=pick('playerId','player_id');
  const bestWave=int(pick('bestWave','best_wave'),1,100_000);
  if(bestWave===null)return null;
  if(rawId!==undefined&&!isValidPlayerId(rawId))return null;
  const isMe=typeof r.isMe==='boolean'?r.isMe:undefined;
  if(rawId===undefined&&isMe===undefined&&typeof r.nickname!=='string')return null;
  const mvp=text(pick('mvpKind','mvp_kind'),40),avatar=text(pick('avatarId','avatar_id'),40);
  const location=sanitizeLocation(pick('location','location_label'));
  return{rank:int(r.rank,1,10_000_000)??fallbackRank,
    ...(isMe!==undefined?{isMe}:{}),
    ...(isValidPlayerId(rawId)?{playerId:rawId}:{}),
    nickname:text(r.nickname,32)||'Capy',
    avatarId:Object.hasOwn(AVATARS,avatar)?avatar:'capybara',
    ...(location?{location}:{}),
    bestWave,
    elapsedSeconds:int(pick('elapsedSeconds','elapsed_seconds'),0,10_000_000)??0,
    mvpKind:Object.hasOwn(HEROES,mvp)?mvp:'kungfu_po',mvpAwakened:Boolean(pick('mvpAwakened','mvp_awakened')),
    awakenedCount:int(pick('awakenedCount','awakened_count'),0,40)??0,medallionTotal:int(pick('medallionTotal','medallion_total'),0,300)??0,
    updatedAt:int(pick('updatedAt','updated_at'),0,Number.MAX_SAFE_INTEGER)??0};
}
export function parseLeaderboard(json:unknown):{entries:LeaderboardEntry[];totalPlayers:number;me:LeaderboardEntry|null}|null {
  if(!json||typeof json!=='object'||(json as {ok?:unknown}).ok!==true)return null;
  const data=json as Record<string,unknown>,rows=Array.isArray(data.entries)?data.entries:[];
  const entries=rows.slice(0,BOARD_LIMIT).map((row,i)=>parseEntry(row,i+1)).filter((row):row is LeaderboardEntry=>!!row);
  const me=data.me?parseEntry(data.me):null;
  return{entries,totalPlayers:int(data.totalPlayers,0,Number.MAX_SAFE_INTEGER)??entries.length,me};
}

/** Strict parse of one global rank row from the Worker. */
export function parseRankEntry(raw:unknown,fallbackRank=0):RankLeaderboardEntry|null {
  if(!raw||typeof raw!=='object')return null;
  const r=raw as Record<string,unknown>,pick=(camel:string,snake:string)=>r[camel]??r[snake];
  const rawId=pick('playerId','player_id');
  const stars=int(r.stars,0,10_000);
  if(stars===null)return null;
  if(rawId!==undefined&&!isValidPlayerId(rawId))return null;
  const isMe=typeof r.isMe==='boolean'?r.isMe:undefined;
  if(rawId===undefined&&isMe===undefined&&typeof r.nickname!=='string')return null;
  const avatar=text(pick('avatarId','avatar_id'),40);
  const location=sanitizeLocation(pick('location','location_label'));
  const highestStars=int(pick('highestStars','highest_stars'),stars,10_000)??stars;
  const wins=int(r.wins,0,100_000)??0;
  const matches=int(r.matches,wins,100_000)??wins;
  const bestWinStreak=int(pick('bestWinStreak','best_win_streak'),0,wins)??0;
  return{rank:int(r.rank,1,10_000_000)??fallbackRank,
    ...(isMe!==undefined?{isMe}:{}),
    ...(isValidPlayerId(rawId)?{playerId:rawId}:{}),
    nickname:text(r.nickname,32)||'Capy',
    avatarId:Object.hasOwn(AVATARS,avatar)?avatar:'capybara',
    ...(location?{location}:{}),
    stars,highestStars,wins,matches,bestWinStreak,
    updatedAt:int(pick('updatedAt','updated_at'),0,Number.MAX_SAFE_INTEGER)??0};
}
export function parseRankLeaderboard(json:unknown):{entries:RankLeaderboardEntry[];totalPlayers:number;me:RankLeaderboardEntry|null}|null {
  if(!json||typeof json!=='object'||(json as {ok?:unknown}).ok!==true)return null;
  const data=json as Record<string,unknown>,rows=Array.isArray(data.entries)?data.entries:[];
  const entries=rows.slice(0,BOARD_LIMIT).map((row,i)=>parseRankEntry(row,i+1)).filter((row):row is RankLeaderboardEntry=>!!row);
  const me=data.me?parseRankEntry(data.me):null;
  return{entries,totalPlayers:int(data.totalPlayers,0,Number.MAX_SAFE_INTEGER)??entries.length,me};
}

/** `null` until the profile owns an endless record (Wave 11+). */
export function submissionFromProfile(profile:Profile,language:'zh-CN'|'en'='zh-CN'):ScoreSubmission|null {
  const wave=profile.bestEndlessWave??0;
  if(wave<11||!isValidPlayerId(profile.playerId))return null;
  const writeSecret=isValidWriteSecret(profile.writeSecret)?profile.writeSecret:SESSION_WRITE_SECRET;
  const mvp=profile.bestEndlessMvp&&Object.hasOwn(HEROES,profile.bestEndlessMvp)?profile.bestEndlessMvp:'kungfu_po';
  return{playerId:profile.playerId,writeSecret,nickname:displayNickname(profile,language),avatarId:Object.hasOwn(AVATARS,profile.avatarId)?profile.avatarId:'capybara',
    location:effectiveLocationToken(profile),
    bestWave:wave,elapsedSeconds:Math.max(0,Math.round(profile.bestEndlessTime??0)),mvpKind:mvp,mvpAwakened:profile.bestEndlessMvpAwakened===true,
    awakenedCount:Math.max(0,Math.min(12,profile.bestEndlessAwakened??0)),medallionTotal:medallionTotalLevel(profile)};
}
/** `null` until the player has played at least one legitimate battle (and was not altered via Developer Mode). */
export function rankSubmissionFromProfile(profile:Profile,language:'zh-CN'|'en'='zh-CN'):RankSubmission|null {
  if(profile.rankTainted||!isValidPlayerId(profile.playerId))return null;
  const matches=Math.max(0,Math.round(profile.matches??0)),wins=Math.min(matches,Math.max(0,Math.round(profile.wins??0)));
  const stars=Math.max(0,Math.round(profile.stars??0)),highestStars=Math.max(stars,Math.round(profile.highestStars??0));
  if(matches<1&&stars<1)return null;
  if(stars>matches*2+2||highestStars>matches*2+2)return null;
  const writeSecret=isValidWriteSecret(profile.writeSecret)?profile.writeSecret:SESSION_WRITE_SECRET;
  return{playerId:profile.playerId,writeSecret,nickname:displayNickname(profile,language),avatarId:Object.hasOwn(AVATARS,profile.avatarId)?profile.avatarId:'capybara',
    location:effectiveLocationToken(profile),stars,highestStars,wins,matches,bestWinStreak:Math.min(wins,Math.max(0,Math.round(profile.bestWinStreak??0)))};
}
/** This device's own endless row, shown when the global board is unreachable. */
export function localEntry(profile:Profile,language:'zh-CN'|'en'='zh-CN'):LeaderboardEntry|null {
  const submission=submissionFromProfile(profile,language);
  if(!submission)return null;
  const {writeSecret:_secret,...pub}=submission;
  return{...pub,isMe:true,rank:0,updatedAt:0};
}

export class EndlessLeaderboardClient {
  private readonly baseUrl:string;
  private readonly fetcher?:typeof fetch;
  private readonly storage?:Storage;
  private readonly timeoutMs:number;
  private readonly now:()=>number;
  private current:LeaderboardSnapshot;
  private rankCurrent:RankLeaderboardSnapshot;
  private lastRefresh=Number.NEGATIVE_INFINITY;
  private lastRankRefresh=Number.NEGATIVE_INFINITY;
  private pending?:Promise<LeaderboardSnapshot>;
  private rankPending?:Promise<RankLeaderboardSnapshot>;
  constructor(options:ClientOptions={}){
    this.baseUrl=(options.baseUrl??resolveLeaderboardUrl()).trim().replace(/\/+$/,'');
    this.fetcher=options.fetch??(typeof fetch==='function'?fetch.bind(globalThis):undefined);
    this.storage=options.storage??browserStorage();this.timeoutMs=options.timeoutMs??BOARD_TIMEOUT_MS;this.now=options.now??Date.now;
    const cached=this.readCache();
    this.current={mode:this.configured?'offline':'unconfigured',entries:cached?.entries??[],totalPlayers:cached?.totalPlayers??0,me:cached?.me??null,fetchedAt:cached?.fetchedAt??null};
    const rankCached=this.readRankCache();
    this.rankCurrent={mode:this.configured?'offline':'unconfigured',entries:rankCached?.entries??[],totalPlayers:rankCached?.totalPlayers??0,me:rankCached?.me??null,fetchedAt:rankCached?.fetchedAt??null};
  }
  get configured():boolean {return/^https?:\/\//i.test(this.baseUrl)&&!!this.fetcher;}
  snapshot():LeaderboardSnapshot {return{...this.current,entries:[...this.current.entries]};}
  rankSnapshot():RankLeaderboardSnapshot {return{...this.rankCurrent,entries:[...this.rankCurrent.entries]};}
  /** True while a refresh is still inside its 30-second cache window. */
  fresh():boolean {return this.current.mode==='online'&&this.now()-this.lastRefresh<BOARD_REFRESH_MS;}
  rankFresh():boolean {return this.rankCurrent.mode==='online'&&this.now()-this.lastRankRefresh<BOARD_REFRESH_MS;}

  /** Cloudflare edge city fallback (`GET /api/geo`) when browser geolocation reverse-lookup fails. */
  async fetchGeoLocation():Promise<string|null> {
    if(!this.configured)return null;
    const data=await this.request('/api/geo',{method:'GET'}) as Record<string,unknown>|null;
    if(!data||data.ok!==true)return null;
    const loc=sanitizeLocation(data.location);
    return loc||null;
  }

  /** Checks whether a nickname is available across BOTH leaderboards. */
  async checkNickname(name:string,playerId?:string):Promise<NicknameCheckOutcome> {
    if(!this.configured)return{available:true,mode:'unconfigured'};
    const query=new URLSearchParams({name});if(isValidPlayerId(playerId))query.set('playerId',playerId);
    const data=await this.request(`/api/nickname?${query}`,{method:'GET'}) as Record<string,unknown>|null;
    if(!data)return{available:true,mode:'offline'};
    if(data.ok===true)return{available:data.available===true,mode:'online',...(data.available===true?{}:{key:'p17.nameTaken'})};
    return{available:false,mode:'online',key:data.error==='invalid_nickname'?'p17.nameUnkind':'p17.board.rejected'};
  }

  /** Global Endless Top 100 plus this player's exact rank; cached for 30 s unless `force`. Never rejects. */
  refresh(playerId?:string,force=false):Promise<LeaderboardSnapshot> {
    if(!this.configured){this.current={...this.current,mode:'unconfigured'};return Promise.resolve(this.snapshot());}
    if(!force&&this.fresh())return Promise.resolve(this.snapshot());
    if(this.pending)return this.pending;
    const query=new URLSearchParams({limit:String(BOARD_LIMIT)});if(isValidPlayerId(playerId))query.set('playerId',playerId);
    this.pending=this.request(`/api/leaderboard?${query}`,{method:'GET'}).then(json=>{
      const parsed=json?parseLeaderboard(json):null;
      if(!parsed){this.current={...this.current,mode:'offline'};return this.snapshot();}
      this.lastRefresh=this.now();
      this.current={mode:'online',...parsed,fetchedAt:this.now()};this.writeCache();
      return this.snapshot();
    }).finally(()=>{this.pending=undefined;});
    return this.pending;
  }

  /** Global Rank Top 100 plus this player's exact rank; cached for 30 s unless `force`. Never rejects. */
  refreshRank(playerId?:string,force=false):Promise<RankLeaderboardSnapshot> {
    if(!this.configured){this.rankCurrent={...this.rankCurrent,mode:'unconfigured'};return Promise.resolve(this.rankSnapshot());}
    if(!force&&this.rankFresh())return Promise.resolve(this.rankSnapshot());
    if(this.rankPending)return this.rankPending;
    const query=new URLSearchParams({limit:String(BOARD_LIMIT)});if(isValidPlayerId(playerId))query.set('playerId',playerId);
    this.rankPending=this.request(`/api/rank-leaderboard?${query}`,{method:'GET'}).then(json=>{
      const parsed=json?parseRankLeaderboard(json):null;
      if(!parsed){this.rankCurrent={...this.rankCurrent,mode:'offline'};return this.rankSnapshot();}
      this.lastRankRefresh=this.now();
      this.rankCurrent={mode:'online',...parsed,fetchedAt:this.now()};this.writeRankCache();
      return this.rankSnapshot();
    }).finally(()=>{this.rankPending=undefined;});
    return this.rankPending;
  }

  /** Upload (or idempotently re-send) the profile's best endless run, or its updated nickname/avatar/location. */
  async submitScore(profile:Profile,language:'zh-CN'|'en'='zh-CN'):Promise<SubmitOutcome> {
    const body=submissionFromProfile(profile,language);
    if(!body)return{ok:false,mode:this.current.mode,key:'p17.board.unranked'};
    if(!this.configured)return{ok:false,mode:'unconfigured',key:'p17.board.unconfigured'};
    const response=await this.request('/api/score',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)},true);
    if(response&&typeof response==='object'&&'status' in response&&(response as {status:number}).status===429)return{ok:false,mode:'online',key:'p17.board.rateLimited'};
    const data=response as Record<string,unknown>|null;
    if(!data||data.ok!==true){
      if(!data)this.current={...this.current,mode:'offline'};
      const err=data?.error;
      const key=!data?'p17.board.offline':err==='nickname_taken'?'p17.nameTaken':err==='invalid_nickname'?'p17.nameUnkind':'p17.board.rejected';
      return{ok:false,mode:data?'online':'offline',key};
    }
    const rank=int(data.rank,1,10_000_000)??undefined,totalPlayers=int(data.totalPlayers,0,Number.MAX_SAFE_INTEGER)??undefined;
    this.lastRefresh=Number.NEGATIVE_INFINITY;
    if(rank!==undefined){
      const {writeSecret:_secret,playerId:_pid,...pub}=body;
      const me:LeaderboardEntry={...pub,isMe:true,rank,updatedAt:this.now()};
      this.current={...this.current,mode:'online',me,totalPlayers:totalPlayers??this.current.totalPlayers};this.writeCache();
    }
    return{ok:true,mode:'online',rank,totalPlayers,improved:data.improved===true,key:'p17.board.synced'};
  }

  /** Upload the profile's real rank progress (stars/wins/matches) plus nickname/avatar/location. */
  async submitRank(profile:Profile,language:'zh-CN'|'en'='zh-CN'):Promise<SubmitOutcome> {
    const body=rankSubmissionFromProfile(profile,language);
    if(!body)return{ok:false,mode:this.rankCurrent.mode,key:profile.rankTainted?'p17.rankBoard.tainted':'p17.rankBoard.unranked'};
    if(!this.configured)return{ok:false,mode:'unconfigured',key:'p17.board.unconfigured'};
    const response=await this.request('/api/rank',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)},true);
    if(response&&typeof response==='object'&&'status' in response&&(response as {status:number}).status===429)return{ok:false,mode:'online',key:'p17.board.rateLimited'};
    const data=response as Record<string,unknown>|null;
    if(!data||data.ok!==true){
      if(!data)this.rankCurrent={...this.rankCurrent,mode:'offline'};
      const err=data?.error;
      const key=!data?'p17.board.offline':err==='nickname_taken'?'p17.nameTaken':err==='invalid_nickname'?'p17.nameUnkind':'p17.board.rejected';
      return{ok:false,mode:data?'online':'offline',key};
    }
    const rank=int(data.rank,1,10_000_000)??undefined,totalPlayers=int(data.totalPlayers,0,Number.MAX_SAFE_INTEGER)??undefined;
    this.lastRankRefresh=Number.NEGATIVE_INFINITY;
    if(rank!==undefined){
      const {writeSecret:_secret,playerId:_pid,...pub}=body;
      const me:RankLeaderboardEntry={...pub,isMe:true,rank,updatedAt:this.now()};
      this.rankCurrent={...this.rankCurrent,mode:'online',me,totalPlayers:totalPlayers??this.rankCurrent.totalPlayers};this.writeRankCache();
    }
    return{ok:true,mode:'online',rank,totalPlayers,improved:data.improved===true,key:'p17.board.synced'};
  }

  /** GET/POST with a hard timeout. Network failures resolve to `null`; a 429 resolves to `{status:429}`. */
  private async request(path:string,init:RequestInit,keepRateLimit=false):Promise<unknown> {
    if(!this.fetcher)return null;
    const controller=typeof AbortController==='function'?new AbortController():undefined;
    const timer=controller?setTimeout(()=>controller.abort(),this.timeoutMs):undefined;
    try{
      const response=await this.fetcher(`${this.baseUrl}${path}`,{...init,signal:controller?.signal});
      if(keepRateLimit&&response.status===429)return{status:429};
      const json:unknown=await response.json().catch(()=>null);
      return response.ok||(json&&typeof json==='object')?json:null;
    }catch{return null;}
    finally{if(timer!==undefined)clearTimeout(timer);}
  }
  private readCache():{entries:LeaderboardEntry[];totalPlayers:number;me:LeaderboardEntry|null;fetchedAt:number}|null {
    try{
      const raw:unknown=JSON.parse(readSetting(BOARD_CACHE_KEY,this.storage)??'null');
      if(!raw||typeof raw!=='object')return null;
      const parsed=parseLeaderboard({...(raw as object),ok:true}),fetchedAt=int((raw as {fetchedAt?:unknown}).fetchedAt,0,Number.MAX_SAFE_INTEGER);
      return parsed&&fetchedAt!==null?{...parsed,fetchedAt}:null;
    }catch{return null;}
  }
  private writeCache():void {
    const {entries,totalPlayers,me,fetchedAt}=this.current;
    writeSetting(BOARD_CACHE_KEY,JSON.stringify({entries,totalPlayers,me,fetchedAt}),this.storage);
  }
  private readRankCache():{entries:RankLeaderboardEntry[];totalPlayers:number;me:RankLeaderboardEntry|null;fetchedAt:number}|null {
    try{
      const raw:unknown=JSON.parse(readSetting(RANK_BOARD_CACHE_KEY,this.storage)??'null');
      if(!raw||typeof raw!=='object')return null;
      const parsed=parseRankLeaderboard({...(raw as object),ok:true}),fetchedAt=int((raw as {fetchedAt?:unknown}).fetchedAt,0,Number.MAX_SAFE_INTEGER);
      return parsed&&fetchedAt!==null?{...parsed,fetchedAt}:null;
    }catch{return null;}
  }
  private writeRankCache():void {
    const {entries,totalPlayers,me,fetchedAt}=this.rankCurrent;
    writeSetting(RANK_BOARD_CACHE_KEY,JSON.stringify({entries,totalPlayers,me,fetchedAt}),this.storage);
  }
}
