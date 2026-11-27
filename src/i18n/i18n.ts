import {p5Zh,p5En} from './p5';
import {p6Zh,p6En} from './p6';
import {p7Zh,p7En} from './p7';
import {p8Zh,p8En} from './p8';
import {p9Zh,p9En} from './p9';
import {p10Zh,p10En} from './p10';
import {p11Zh,p11En} from './p11';
import {p12Zh,p12En} from './p12';
import {p13Zh,p13En} from './p13';
import {p13SettlementZh,p13SettlementEn} from './p13-settlement';
import {p14Zh,p14En} from './p14';
import {p15Zh,p15En} from './p15';
import {p16Zh,p16En} from './p16';
import {p17Zh,p17En} from './p17';
import {p19Zh,p19En} from './p19';
import { en } from './en';
import { zhCN } from './zh-CN';
import { m2Zh, m2En } from './m2';
import { m3Zh, m3En } from './m3';
import { p1Zh, p1En } from './p1';
import { p3Zh, p3En } from './p3';
import { readSetting, writeSetting } from '../ui/storage';

export type Language = 'zh-CN' | 'en';
let languageStorage: Storage | undefined;
let language: Language = __ENABLE_ENGLISH__ && readSetting('language') === 'en' ? 'en' : 'zh-CN';
const listeners = new Set<() => void>();

/** Binds platform storage (e.g. wx/bl mini-game storage) so language preference persists across launches. */
export function bindLanguageStorage(storage?: Storage): void {
  languageStorage = storage;
  if (!__ENABLE_ENGLISH__) {
    if (language !== 'zh-CN') {
      language = 'zh-CN';
      listeners.forEach(listener => listener());
    }
    return;
  }
  const stored = readSetting('language', storage);
  if (stored === 'en' || stored === 'zh-CN') {
    if (stored !== language) {
      language = stored;
      listeners.forEach(listener => listener());
    }
  }
}

export function getLanguage(): Language { return __ENABLE_ENGLISH__ ? language : 'zh-CN'; }

export function setLanguage(next: Language): void {
  if (!__ENABLE_ENGLISH__) return;
  if (next !== 'zh-CN' && next !== 'en') return;
  writeSetting('language', next, languageStorage);
  if (next === language) return;
  language = next;
  listeners.forEach(listener => listener());
}

export function onLanguageChange(callback: () => void): () => void {
  listeners.add(callback);
  return () => { listeners.delete(callback); };
}

export function t(key: string, vars: Record<string, string | number> = {}): string {
  const isEn = __ENABLE_ENGLISH__ && language === 'en';
  const dictionary: Record<string, string> = isEn ? en : zhCN;
  const fallback: Record<string, string> = zhCN;
  const extra = isEn ? m2En : m2Zh;
  const latest = isEn ? m3En : m3Zh;
  const polish = isEn ? p1En : p1Zh;
  const landscape = isEn ? p3En : p3Zh;
  const phrase = (isEn ? p12En : p12Zh)[key] ?? (isEn ? p11En : p11Zh)[key] ?? (isEn ? p10En : p10Zh)[key] ?? (isEn ? p9En : p9Zh)[key] ?? (isEn ? p8En : p8Zh)[key] ?? (isEn ? p7En : p7Zh)[key] ?? (isEn ? p6En : p6Zh)[key] ?? (isEn ? p5En : p5Zh)[key] ?? landscape[key] ?? polish[key] ?? latest[key] ?? extra[key] ?? dictionary[key] ?? p3Zh[key] ?? p1Zh[key] ?? m3Zh[key] ?? m2Zh[key] ?? fallback[key] ?? key;
  return ((isEn?p19En:p19Zh)[key]??(isEn?p17En:p17Zh)[key]??(isEn?p16En:p16Zh)[key]??(isEn?p15En:p15Zh)[key]??(isEn?p14En:p14Zh)[key]??(isEn?p13SettlementEn:p13SettlementZh)[key]??(isEn?p13En:p13Zh)[key]??phrase).replace(/\{(\w+)\}/g, (match, name: string) => String(vars[name] ?? match));
}
