# P11 Storybook Hub Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans, with independent UI domains delegated under superpowers:dispatching-parallel-agents. Steps use checkbox syntax.

**Goal:** Give Armory, Market, Rank, Profile and Settings the calm P10 folder layout, with one tab bar and progressive disclosure.

**Architecture:** LedgerView owns the common transparent header, badge, tabs and tips. MetaScreens and ProfileScreens own independent page state and flat row markup; existing progression transactions remain authoritative. A final p11.css scopes visual changes to hub dialogs only.

**Tech Stack:** TypeScript, Vite, Canvas, Vitest, existing Playwright Chromium verification.

**Spec:** `D:/rea_game/design/codex_v2_p11_storybook_armory_market_rank_spec.md`

## Global Constraints

- Write only beneath `D:/rea_game/games/capybara-defense/`; read design and art without mutation.
- Preserve all audio files, SettlementView.ts, p6.css, pause/result rendering, saved profile data and battle economy.
- Keep 127.0.0.1:4175 and capybara_defense_v1: storage prefix.
- Sync 209 art assets; use 680px folder width, cocoa board, cream horizontal rows, one tab bar.
- User supplied the complete approved visual and interaction design; implementation proceeds without another approval gate.

## Review Focus

- Detail/list scroll and focus after equip, back, filters and asynchronous sprite loading.
- Lottery tabs or close during animation must neither double-charge nor lose earned rewards.
- Locked/insufficient funds, storage failures and same-hero unequip remain correct.
- Prep equipment syncs now; mid-wave edits apply next battle and notices stay outside the board.
- Long English names, portrait tabs and short landscape footers remain readable and inside the viewport.

## Task 1 — Shared shell, art and integration (parent)

- [x] Read design, preview and current code; baseline 1040 tests pass.
- [x] Create isolated P11 branch and capture protected file hashes.
- [x] Add failing P11 tests for 209 assets, four borderless fallbacks, shared mascots, one tab bar and footer.
- [x] Extend ledger options to `{profile?, tabs?, badges?, inBattle?, preparation?}`; page-specific compact badge and cross-link; `p11.ts` shell phrases.
- [x] Add P11_SCENE_IDS, sync assets, register dirty refresh and p11.css last import.
- [x] Integrate MetaScreens.viewKey, list/detail keyboard focus and footer preparation notice in GameApp.

## Task 2 — Armory and market (independent delegate)

**Files:** MetaScreens.ts, i18n/p11-meta.ts, tests/p11-meta.test.ts. No shared file edits.
**Interfaces:** `ledger(page, body, {profile,tabs,inBattle,preparation})`; `markup(screen, inBattle=false, preparation=false)`; `viewKey` includes family, market tab, selected weapon. Translation keys use `p11.meta.*`.

- [x] Write/run failing behavior tests for list→detail→equip→back, family recycle, three separated market tabs and invalid entry handling.
- [x] Implement five armory tabs; 36/12 row lists, four hero buttons only in detail, five rarity toggles only in recycle.
- [x] Implement shop three rows, backpack eight slots + twenty sorted rows, lottery one card + eight prizes; preserve transactional methods and sounds.
- [x] Run focused tests; report DOM class contract and no shared file changes.

## Task 3 — Rank, profile, settings (independent delegate)

**Files:** ProfileScreens.ts, i18n/p11-profile.ts, tests/p11-profile.test.ts. No shared file edits.
**Interfaces:** ledger selects leaderboard/profile/settings tabs; preserve `rankCard`, `mapOptions`, action/change APIs; translation keys use `p11.profile.*`.

- [x] Write/run failing tests for sixteen uniform rank/portrait rows, profile selection and four settings cards.
- [x] Render one rank summary + sixteen rows; one profile summary + sixteen avatar rows; four settings rows with native inputs.
- [x] Preserve settings persistence/error recovery, avatar guards and tutorial action; run focused tests.

## Task 4 — Regression and visual QA (parent)

- [x] Update only superseded layout/count assertions in P5/P6/P9/P10 suites; retain fee/storage/audio/core tests.
- [x] Run full `npm test`, typecheck/build and P11 isolation report.
- [x] Browser-check all page states in zh-CN/en at 1366×768, 1920×1080, 844×390, 390×844; save screenshots and numeric layout report.
- [x] Exercise purchase, equip/unequip, recycle, ticket/coin lottery, avatars, sliders, tutorial and battle preparation/locked loadouts through real UI.
- [x] Review screenshots, resolve real defects, get independent final code review, rerun affected checks and write verification report.
