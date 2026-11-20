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
import { en } from './en';
import { zhCN } from './zh-CN';
import { m2Zh, m2En } from './m2';
import { m3Zh, m3En } from './m3';
import { p1Zh, p1En } from './p1';
import { p3Zh, p3En } from './p3';
import { readSetting, writeSetting } from '../ui/storage';

export type Language = 'zh-CN' | 'en';
let language: Language = readSetting('language') === 'en' ? 'en' : 'zh-CN';
const listeners = new Set<() => void>();

export function getLanguage(): Language { return language; }

export function setLanguage(next: Language): void {
  if (next !== 'zh-CN' && next !== 'en') return;
  writeSetting('language', next);
  if (next === language) return;
  language = next;
  listeners.forEach(listener => listener());
}

export function onLanguageChange(callback: () => void): () => void {
  listeners.add(callback);
  return () => { listeners.delete(callback); };
}

export function t(key: string, vars: Record<string, string | number> = {}): string {
  const dictionary: Record<string, string> = language === 'en' ? en : zhCN;
  const fallback: Record<string, string> = zhCN;
  const extra = language === 'en' ? m2En : m2Zh;
  const latest = language === 'en' ? m3En : m3Zh;
  const polish = language === 'en' ? p1En : p1Zh;
  const landscape = language === 'en' ? p3En : p3Zh;
  const phrase = (language === 'en' ? p12En : p12Zh)[key] ?? (language === 'en' ? p11En : p11Zh)[key] ?? (language === 'en' ? p10En : p10Zh)[key] ?? (language === 'en' ? p9En : p9Zh)[key] ?? (language === 'en' ? p8En : p8Zh)[key] ?? (language === 'en' ? p7En : p7Zh)[key] ?? (language === 'en' ? p6En : p6Zh)[key] ?? (language === 'en' ? p5En : p5Zh)[key] ?? landscape[key] ?? polish[key] ?? latest[key] ?? extra[key] ?? dictionary[key] ?? p3Zh[key] ?? p1Zh[key] ?? m3Zh[key] ?? m2Zh[key] ?? fallback[key] ?? key;
  return ((language==='en'?p16En:p16Zh)[key]??(language==='en'?p15En:p15Zh)[key]??(language==='en'?p14En:p14Zh)[key]??(language==='en'?p13SettlementEn:p13SettlementZh)[key]??(language==='en'?p13En:p13Zh)[key]??phrase).replace(/\{(\w+)\}/g, (match, name: string) => String(vars[name] ?? match));
}
