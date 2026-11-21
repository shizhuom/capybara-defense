export type Side = 'player' | 'ai';
export type MapId = 'sunny_backyard' | 'sakura_onsen' | 'midnight_kitchen' | 'cat_tower_maze';
export interface GameSettings { musicVolume:number; soundVolume:number; showDamageNumbers:boolean; developerMode?:boolean }
export interface OpponentIdentity {id:string;name:{'zh-CN':string;en:string};avatarId:string;rankIndex:number}
export type Tile = 'C' | 'G' | 'O' | 'S' | 'R' | 'B';
export type Status = 'SEALED' | 'WET' | 'KNOCKDOWN' | 'CONFUSED' | 'MERGE_LOCK';
export interface Point { col: number; row: number }
export type UnitLocation = { zone: 'board'; col: number; row: number } | { zone: 'bench'; slot: number };
export interface Unit {
  id: number; kind: string; side: Side; level: number; location: UnitLocation;
  statuses: Partial<Record<Status, number>>; energy: number; cooldown: number;
  production: number; buffTime: number; empowered: number; animation: number;
  attackAngle?:number; facing?:1|-1; attackAnim?:number;
  washing?: number; haste?: number; hasteTime?: number; powerTime?: number;
  /** P17 endless breakthrough: a Lv.5 hero fed once more in endless may awaken (permanent for the run). */
  awakened?: boolean;
  /** Missed breakthrough rolls; each adds +5% to the next one. */
  breakthroughFails?: number;
}
export interface Enemy {
  id: number; kind: string; side: Side; boss: boolean; hp: number; maxHp: number;
  progress: number; col: number; row: number; speed: number; armor: number; size: number;
  abilityCooldown: number; stun: number; slow: number; slowFactor: number;
  burn: number; burnDps: number; poison: number; poisonDps: number; stolenBy: number[]; hitFlash: number;
  knockX?:number; knockY?:number;
  bleed?: number; bleedDps?: number; armorBreak?: number; hasteTime?:number; boneShield?:boolean;
}
export interface BattleLoadout {
  equippedWeapons: Record<string,string>; ownedProps: Record<string,number>;
  equippedActiveProps: string[]; equippedPassiveProps: string[];
  /** P14 Onsen Kitchen snapshot. Absent/empty keeps every battle number identical to P13. */
  unlockedBroths?: string[]; brothLevels?: Record<string, number>; activeBrothId?: string | null;
  /** P16 village facility levels. Absent, or only the starter pool at Lv.1, keeps every battle number identical to P15. */
  villageFacilities?: Record<string, number>;
  /** P17 endless medallion levels (0..50). Read only in endless (Wave 11+); absent or all-zero changes nothing. */
  endlessMedallions?: Record<string, number>;
}
export interface SideState {
  lockedBenchSlot?:number|null;
  food: number; summons:number; oranges: number; shovels: number; shovelTimer:number; kills: number; damage: number; loot: string[]; ingredientLoot: string[]; villageLoot: string[]; fog: number;
  loadout:BattleLoadout; propCooldowns:Record<string,number>; sprinklerUsed:boolean; giantCatUses:number; catnipTime:number;
  /** P17 endless-only state: one bubble-shield charge, its recharge countdown (seconds) and crests banked this run. */
  capyShieldReady:boolean; capyShieldTimer:number; endlessCrests:number;
}
export interface Trap extends Point { id:number; side:Side; charges:number; hitIds:number[] }
/** Captured before attack counters/hooks change; event age remains mutable independently. */
export interface AttackPresentation {
  readonly sourceKind:string; readonly hero:boolean; readonly awakened:boolean;
  readonly empowered:boolean; readonly critical:boolean; readonly enhanced:boolean;
}
export interface VisualEvent {
  id: number; type: 'alert' | 'slash' | 'hit' | 'death' | 'food' | 'projectile' | 'burst' | 'bubble' | 'damage' | 'purge' | 'orange' | 'dash' | 'bounce' | 'sprinkler' | 'giant_cat' | 'weapon' | 'boss_skill' | 'shield_block';
  side: Side; col: number; row: number; targetCol?: number; targetRow?: number;
  textKey?: string; value?: number; color?: string; age: number; duration: number; unitId?: number;
  points?:Point[]; effect?:string;
  enemyKind?:string; boss?:boolean; hitCue?:'hit_melee'|'hit_ranged'|'hit_magic'|'hit_heavy';
  readonly presentation?:Readonly<AttackPresentation>;
}
export interface BattleMVP {kind:string;level:number;damage:number;kills:number;awakened?:boolean}
export interface BattleResult { winner: Side; reason: 'oranges' | 'waves' | 'surrender'; loot: string[]; playerLoot: string[]; aiLoot: string[]; coins: number; elapsed: number; rankIndex?:number; mergedHeroes?:string[];mvp?:BattleMVP;
  /** Display totals stay in coins/loot; these fields contain only the additional award. */
  endless?:boolean;endlessWave?:number;endlessCoins?:number;endlessLoot?:string[];
  /** Ingredients banked by this receipt (victory: all; defeat: salvage); endless adds only the post-wave-10 share. */
  ingredientLoot?:string[];endlessIngredientLoot?:string[];
  /** Village building materials (`res_onsen_wood` / `res_yuzu_essence`), banked with the same victory/salvage rules. */
  villageLoot?:string[];endlessVillageLoot?:string[];
  /** P17: crests from this receipt (standard victory: 3; endless: only the post-wave-10 share) and awakened heroes on the board. */
  endlessCrests?:number;awakenedCount?:number;
}
export interface BattleState {
  opponent?:OpponentIdentity;
  id: string; phase: 'ready' | 'playing' | 'paused' | 'finished'; time: number;
  wave: number; waveTime: number; nextSpawn: number; spawned: number;
  mapId:MapId; rankIndex:number; mergedHeroes:Record<Side,string[]>;
  craterHits:Record<string,number>;
  grid: Tile[][]; sides: Record<Side, SideState>; units: Unit[]; enemies: Enemy[];
  events: VisualEvent[]; traps:Trap[]; result: BattleResult | null;
  endless?:boolean;standardResult?:BattleResult;endlessCoins?:number;endlessClearedWave?:number;
}
export interface CommandResult { ok: boolean; key: string; unitId?: number; value?: number }
export interface WavePreview {wave:number;count:number;bosses:readonly string[];minion:string}
export interface Profile extends BattleLoadout {
  tutorialCompleted?:boolean; tutorialRewardClaimed?:boolean;
  earlyWaveTipSeen?:boolean;bestEndlessWave?:number;
  coins:number; wins:number; matches:number; fragments:string[]; awardedBattles:string[];
  schemaVersion:2; weaponFragments:Record<string,number>; unlockedWeapons:string[]; freeLotteryTickets:number;
  shop:{day:string;offers:string[]}|null;
  stars:number; highestStars:number; winStreak:number; bestWinStreak:number;
  selectedMap:'auto'|MapId; avatarId:string; unlockedAvatars:string[]; mergedHeroes:string[]; settings:GameSettings;
  ingredients:Record<string,number>; unlockedBroths:string[]; brothLevels:Record<string,number>; activeBrothId:string|null;
  village:VillageState;
  /** P17 endless crests, medallion levels (6 ids, 0..50) and the anonymous global-board identity. */
  endlessCrests:number; endlessMedallions:Record<string,number>;
  playerId:string; writeSecret:string; nickname:string;
  /** Metadata of the best endless run (submitted to the global board). */
  bestEndlessTime?:number; bestEndlessMvp?:string; bestEndlessMvpAwakened?:boolean; bestEndlessAwakened?:number;
}
export interface VillageState {
  wood:number; essence:number;
  /** Facility levels; the bamboo pool always starts at Lv.1. */
  facilities:Record<string,number>;
  /** Last offline-harvest anchor (ms since epoch). */
  lastHarvestAt:number;
  /** `YYYY-MM-DD` of the current pet-tap allowance and how many paid taps were used that day. */
  petTapDay:string; petTapCount:number;
}
export interface StageRect { x:number; y:number; w:number; h:number }
export interface Interaction { draggingId?: number; previewSourceId?:number; pointer?: { x: number; y: number }; shovel?: boolean; hover?: Point; selectedId?: number; propId?:string; showDamageNumbers?:boolean; allowBenchLock?:boolean; mergeAvoidRects?:StageRect[];
  /** P17 endless: live breakthrough chance (0..1) per Lv.5 hero id, for the 「可突破 x%」 labels. */
  breakthroughChances?:Record<number,number> }
