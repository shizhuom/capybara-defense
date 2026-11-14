# P1 fixed interfaces and ownership

Each file has one writer. Only p1_core edits core/types.ts. Root alone edits GameApp/ProfileScreens/MetaScreens/i18n/CSS/vite and service lifecycle. Files below are exact handoff contracts; notify root before changing an interface.

## Core (p1_core)

- GameSettings adds optional `developerMode?:boolean`; normalized settings always have false/true. Profile adds optional `tutorialCompleted?:boolean; tutorialRewardClaimed?:boolean`, normalized profiles always populate both. Optional types preserve pre-P1 callers, not missing runtime defaults.
- `OpponentIdentity {id:string;name:{'zh-CN':string;en:string};avatarId:string;rankIndex:number}`; `BattleState.opponent?:OpponentIdentity` is populated by new engines.
- `config/opponents.ts`: `OpponentTuning {rankIndex:number;interval:number;openingDelay:number;reactionDelay:number;counterMerges:boolean}`; `getOpponentTuning(rankIndex:number):OpponentTuning`.
- `core/OpponentAI.ts` exports `createOpponentSetup(rankIndex:number,random:()=>number):{tuning:OpponentTuning;loadout:BattleLoadout;identity:OpponentIdentity}`. Constructor accepts tuning optionally; EngineOptions adds `aiOverrides?:Partial<OpponentTuning>`; existing loadouts.ai remains explicit override. Use independent seeded stream, not combat RNG; ai:false excludes generated AI loadout.
- `core/MergeTargets.ts`: `getMergeTargets(state:BattleState,sourceId:number):Array<{unitId:number;kind:'upgrade'|'hero';heroId?:string}>`. Same-side real units only; use MergeSystem.combine, exclude swap, washing, self, invalid/locked/maxed. No mutation.
- `core/Tutorial.ts`: `TutorialStep=1|2|3|'done'`; `TutorialAction='summon'|'deploy'|'dig'|'merge'|'acknowledge'|'skip'`; `advanceTutorial(step,action):TutorialStep`; `finishTutorial(profile:Profile,reward:boolean):{profile:Profile;awarded:boolean}`; `replayTutorial(profile:Profile):Profile`. finish marks completed, grants20 only once if reward and not claimed; UI persists before adopting. replay only resets completed, retains claim flag. Normalization handled in MetaProgression; full-test profile done/claimed.
- Add VisualEvent `effect:'treasure'` to existing treasure event and `effect:'boss_spawn'` to spawn bubble if useful, preserving event types; sprinkler purge uses effect:'sprinkler' so it does not play upgrade.

## Assets and Canvas (p1_assets)

- AssetRegistry exports existing class + shared singleton `assets`, `hasSprite(id:string):boolean`, `spriteUrl(id:string):string|undefined`, `onAssetsReady(callback:()=>void):()=>void`. Only successfully loaded PNGs are exposed; base defaults `${import.meta.env.BASE_URL || './'}sprites/`. Registry.get remains Canvas-compatible.
- `ui/stickers.ts`: `propSticker(id:string,size=48):string`, `unitSticker(kind:string,size=40):string`, `sceneSticker(id:'menu_banner'|'logo_capy'|'sprinkler'|'shovel',fallback:string,size?:number):string`. Return external img if loaded, otherwise procedural SVG/appropriate existing fallback. No i18n or UI/storage circular dependency.
- Existing render/M3Art.avatarSticker/weaponSticker signatures unchanged; try avatar_ID / weapon_ID (weapon direct-ID alias) then originalSVG.
- StickerRenderer.assets uses shared singleton. All new map/O/B and object coverage stays in render. Integrate getMergeTargets and hero bases without changing STAGE/hitTest.
- Root draws HTML opponent banner at x177,y193,w282,h34 relative to640×1386. When state.opponent exists, renderer omits old rival text/checkmark/AI (keep ribbon and loot chip). Root supplies localized identity and avatar.
- Root supplies translation `p1.merge` ('✦ 合成!'/'✦ Merge!') for gold capsule. No other new render keys necessary.
- scripts/sync-assets.mjs exports `syncAssets({sourceDir,targetDir}?)` for isolated temp-fixture tests and CLI, defaults relative to project root as spec; does not delete destination PNGs. Only valid lowercase filename copies; alphabetically sorted array manifest.

## Audio (p1_audio)

- Keep SoundManager constructor/unlock/setSettings/setDucked/play/consumeBattle/dispose and all M3 SoundCue names as aliases. Add `MusicMode='menu'|'battle'|'boss'`; `setMode(mode:MusicMode):void`.
- Add canonical cues `ui_click,shovel,treasure,merge_upgrade,merge_hero,hit_soft,boss_spawn,orange_lost,orange_gain`; summon/sprinkler remain. UI owns summon/shovel/merge_hero/ui_click and result/lottery. consumeBattle owns hit_soft/dash/orange/sprinkler/purge(non-legendary non-sprinkler)/treasure/boss_spawn, dedup by battle/event. SFX hit global >=95ms, do not throttle a first event away after enabling audio.
- Three modes:84/108/124BPM; menu warm chord/arpeggio+pad, battle melody+bass+filtered shaker, boss rhythmic percussion+lead/bass. One scheduler, mode transitions fade; paused/overlay/hidden lower music. Missing AudioContext safe.
- Ship public/audio/manifest.json `{}`. Manifest object maps bgm_menu/bgm_battle/bgm_boss and SoundCue keys to safe relative files; loaded external tracks/cues win and use same volume/duck controls, missing/decode failures keep built-in. Avoid requesting undeclared files; dispose stops/cleans all voices/loops and pending async callbacks cannot resurrect disposed manager.

## Root UI

UI imports fixed helpers above; on asset-ready refresh menu/dialog/prop/inspector once without resetting gameplay, lottery or dragging. Use unitSticker/propSticker in all HTML item views, avatars/weapons through existing M3Art.
TutorialView is local ephemeral step; only real successful player commands advance. On ordinary→test/restore clear tutorial along with engine. Persist complete/skip/replay before replacing profile; reward failure may retry without duplication. Replay does not change rewards already claimed.
ui/BattleHUD pure selectors choose most progressed live player Boss, expose count,hp,maxHp,abilityCooldown/interval; use HTML overlay in existing top240 logical px, do not cover grid or opposite orange tower. HUD refreshed with current state; no core pause for guide.
