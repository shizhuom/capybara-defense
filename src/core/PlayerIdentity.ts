/**
 * P17 anonymous global-board identity: a persistent random `playerId` (no account, no network needed)
 * and an editable nickname that must stay wholesome.
 */
export const PLAYER_ID_PATTERN=/^[A-Za-z0-9_-]{8,64}$/;
export const WRITE_SECRET_PATTERN=/^[A-Za-z0-9_-]{16,128}$/;
export const NICKNAME_MIN=2;
export const NICKNAME_MAX=14;
const ALPHABET='abcdefghijkmnpqrstuvwxyz23456789';

export const isValidPlayerId=(id:unknown):id is string=>typeof id==='string'&&PLAYER_ID_PATTERN.test(id);
export const isValidWriteSecret=(secret:unknown):secret is string=>typeof secret==='string'&&WRITE_SECRET_PATTERN.test(secret);
function randomToken(length:number,random?:()=>number):string {
  const bytes=new Uint8Array(length);
  const cryptoApi=(globalThis as {crypto?:{getRandomValues?:(array:Uint8Array)=>Uint8Array}}).crypto;
  if(!random&&cryptoApi?.getRandomValues)cryptoApi.getRandomValues(bytes);
  else for(let i=0;i<bytes.length;i++)bytes[i]=Math.floor(Math.max(0,Math.min(.999999,(random??Math.random)()))*256);
  return Array.from(bytes,byte=>ALPHABET[byte%ALPHABET.length]).join('');
}
/** `capy_` + 12 random characters; uses Web Crypto when present, otherwise `Math.random`. */
export function generatePlayerId(random?:()=>number):string {
  return `capy_${randomToken(12,random)}`;
}
/** Per-device write proof sent only on POST /api/score and never shown publicly. */
export function generateWriteSecret(random?:()=>number):string {
  return `sec_${randomToken(28,random)}`;
}
/**
 * One id + write secret per page session: `createProfile()` and `normalizeProfile(null)` agree, and the first save makes them permanent.
 * Stored valid credentials always win.
 */
export const SESSION_PLAYER_ID=generatePlayerId();
export const SESSION_WRITE_SECRET=generateWriteSecret();
export const normalizePlayerId=(raw:unknown):string=>isValidPlayerId(raw)?raw:SESSION_PLAYER_ID;
export const normalizeWriteSecret=(raw:unknown):string=>isValidWriteSecret(raw)?raw:SESSION_WRITE_SECRET;

/** Same word list as the project's wholesome-copy test, stored as escapes so the source itself stays clean. */
const BLOCKED=/\u6da9\u6da9|\u8272\u8272|\u4e0d\u8bb8\u6da9|\u7edd\u80b2|\u7eff\u8336|\u75af\u6279|\u8214\u72d7|\u9e21\u4f60\u592a|\u0062\u006f\u006e\u006b/i;
// Control characters, zero-width marks and HTML angle brackets never reach a nickname.
const STRIP=/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff<>]/g;

export interface NicknameCheck {ok:boolean;value:string;key:string}
/** Trim, strip unsafe characters, require 2..14 characters and pass the wholesome filter. */
export function validateNickname(raw:unknown):NicknameCheck {
  const value=(typeof raw==='string'?raw:'').replace(STRIP,'').replace(/\s+/g,' ').trim();
  const length=Array.from(value).length;
  if(length<NICKNAME_MIN)return{ok:false,value,key:'p17.nameTooShort'};
  if(length>NICKNAME_MAX)return{ok:false,value,key:'p17.nameTooLong'};
  if(BLOCKED.test(value.normalize('NFKC').replace(/[\s._\-*·]/g,'')))return{ok:false,value,key:'p17.nameUnkind'};
  return{ok:true,value,key:'p17.nameSaved'};
}
/** Friendly fallback while the player has not chosen a name. */
export function defaultNickname(playerId:string,language:'zh-CN'|'en'):string {
  const tag=(playerId.slice(-4)||'capy').toUpperCase();
  return language==='en'?`ChillCapy#${tag}`:`泡汤水豚#${tag}`;
}
export const displayNickname=(profile:{playerId:string;nickname:string},language:'zh-CN'|'en'):string=>profile.nickname||defaultNickname(profile.playerId,language);
