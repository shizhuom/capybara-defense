# P1 Polish Implementation Plan

> For agentic workers: use subagent-driven-development with independent file ownership and dispatching-parallel-agents. User scope overrides root worktrees/commits and redundant design approval. Every write stays in this game; no child agents or service changes by implementers.

**Goal:** Complete all P1 polish, the full optional art/audio pipeline, and desktop/390×844 visual acceptance on the accepted M3 game.
**Architecture:** Keep config → headless core → Canvas → DOM UI. Add pure opponent/tutorial/match helpers, shared loaded-asset queries, separate compendium/HUD/tutorial presentation, and a multi-track sound scheduler. Preserve existing transactions and test/normal identity switching.
**Tech Stack:** Existing TypeScript + Vite + Canvas + Vitest + local Chrome/Playwright; no new engine/dependency.
**Spec:** `D:/rea_game/design/codex_p1_polish_spec.md` is binding. Overall pet design is reference only.

## Global constraints

- Only `D:/rea_game/games/capybara-defense/` may change; design/art sources are read-only. Port127.0.0.1:4175 and capybara_defense_v1: prefix unchanged.
- Preserve 427 M3 tests and M1/M2 tuning. Cases whose exact previous presentation/default shape P1 intentionally changes may update only that expectation, never be removed/skipped/weakened to hide failures.
- Five-card/redraw10-food,20s prep,12s shovels,36 weapons,20 props and all map/merge/Boss/progression mechanics remain.
- New saves tutorial false; missing old field with matches>0 migrates true. Reward20 once; save failures do not advance reward/setting state. Replays never farm coins.
- Default clean mode hides debug/journal extra content, fits390×844; ?dev=1 and settings switch expose debug. Dialogs may internally scroll, battle cannot scroll the page.
- Optional external assets win only after valid load; missing/invalid assets retain working fallbacks. Default shipped empty manifests prevent requests for undeclared files. All paths honor relative Vite base.

## Review focus

- Switching test/normal identities must still drop the old battle; tutorial completion and rewards must not leak from test mode into normal saves.
- Asset-ready notifications must not drop a drag, dismiss/restart a modal or duplicate an ongoing lottery transaction.
- AI presets use a separate seeded stream so loadout selection does not perturb player draw/combat randomness; ai:false remains a headless opt-out without unsolicited AI passives.
- Multi-track transitions, tab suspension, failed external decode and repeated unlock keep a single scheduler/context and bounded voices; hit SFX >=95ms throttled.
- External map art cannot hide O/B changes, hit testing or path geometry; clean-mode scaling cannot change logical pointer coordinates or hide tool buttons.

## Tasks

### 1. Pure rules, migration and rank AI — p1_core

Files and exact interfaces: P1-task-core.md and P1-contracts.md.
- [ ] RED: five rank interval/delay/loadout tiers, actual high-rank defensive prop/sprinkler actions and legal resource use.
- [ ] Implement opponent setup/identity, position/merge priorities, isolated RNG and BattleEngine initialization.
- [ ] RED→GREEN: all valid merge target categories, washing/merge lock/enemy/max-level exclusions, pure tutorial transitions/one-time20 reward and old-save migration.
- [ ] Add SEALED cleanup to successful sprinkler (both sides), preserving its M2 combat effects; review report.

### 2. Assets and Canvas readability — p1_assets

Files and exact interfaces: P1-task-assets.md and P1-contracts.md.
- [ ] RED: URL/ID resolution, ready/failure fallback, all art categories; sync missing source/idempotence/safe filename handling.
- [ ] Shared registry and HTML sticker helpers, all20 procedural prop SVGs,36 weapon/16 avatar overrides, menu/logo/units.
- [ ] Canvas map background + visible O/B overlays; object/character overrides, orange stack, gold hero bases, full-board/bench target pulses.
- [ ] sync-assets script/package command, full ID dictionary and dimensions; scoped tests and report.

### 3. Music and audio overrides — p1_audio

Files and exact interfaces: P1-task-audio.md and P1-contracts.md.
- [ ] RED: mode/tempo/multi-track behavior, hit throttle, single scheduler and external override/decode-failure fallback.
- [ ] Implement three musical states and canonical cues with M3 aliases; safe no-host behavior, gain controls, interruption and cleanup retained.
- [ ] Provide empty audio manifest and documented keys; verify actual scheduling through recording WebAudio host; report.

### 4. Player interface and release integration — root

- [ ] Implement ui/Compendium.ts, ui/BattleHUD.ts, ui/TutorialView.ts and p1.css, plus GameApp/ProfileScreens/MetaScreens integration. Tests in p1-ui/p1-i18n and real browser.
- [ ] Clean menu and battle fit desktop/390×844, sandbox toggle/query override, settings replay, actual tutorial command progression/persistence and skip.
- [ ] Boss/wave HUD and opponent identity; four complete bilingual compendium pages; replace prop Emoji UI and wire music modes/cues.
- [ ] Set Vite base './', sync assets, build/typecheck/full suite; adapt old browser scripts to ?dev=1 where they intentionally access sandbox and migration fields.
- [ ] Desktop/mobile clean/debug, touch/drag/halo/Boss/all encyclopedia tabs/settings/tutorial/asset overrides/subdirectory build browser validation with screenshots and 0 errors.
- [ ] Independent task and whole integration reviews, fix confirmed issues, delete only verified obsolete .runtime source copies, rehash protected files, document and leave production4175 running.

## Decisions where the spec leaves behavior open

- A persisted developerMode setting controls normal URLs. ?dev=1 forces it on for that page; turning it off in settings removes that query parameter so it can immediately close.
- Tutorial skip marks completed but grants no coins; the first later full replay can earn20 if never claimed. Old already-played profiles migrate reward eligibility as consumed. Added tutorialRewardClaimed prevents repeat rewards. Full test profiles mark tutorial done/claimed.
- P1 explicitly expects sprinkler unsealing; it clears SEALED on the using side in addition to existing damage/knockback/slow, with no change to other status rules.
- Gold targets include any successful hero outcome (including feeding/hero-upgrade), green targets are basic upgrades; rejected/swapped/washing targets never glow.
- External art source is currently absent. Build the complete pipeline and procedural fallbacks; do not create or modify original art in design/.
