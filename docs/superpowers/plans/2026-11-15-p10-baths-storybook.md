# P10 Bath Fusion and Storybook Compendium Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for integration; independent compendium work may use dispatching-parallel-agents. Preserve file ownership and test each change before final integration.

**Goal:** Put a tub-free guardian into each map's painted bath and replace only the Compendium with the supplied cozy folder/list design.

**Architecture:** Keep game rules and audio untouched. A typed bath-anchor table drives Canvas sprites and orange motion; progressive Compendium data remains intact under new row markup and strictly scoped CSS.

**Tech Stack:** Existing TypeScript, Canvas, Vite, Vitest, Playwright; no new dependency.

**Spec:** Read-only `D:/rea_game/design/codex_v2_p10_map_bath_fusion_and_cats_soup_compendium_spec.md`, companion task prompt, and current user requirements. Both reference images inspected before edits.

## Global Constraints

- All writes remain inside `D:/rea_game/games/capybara-defense/`. Preserve P9 tag `v2.0-p9`; work in this exact nested repository.
- Freeze `SoundManager.ts`, `MusicTracks.ts`, `AudioGestures.ts` byte-for-byte; protect parent baseline/design via before/after hashes.
- Keep port4175, existing storage prefix, progression, controls, growth numbers, recipes, portrait class signatures and collection badges.
- Asset count205, original maps1280×720. User-supplied P10 palette takes precedence only inside the Compendium.
- Digits remain absent from tab labels and qualitative row copy. Explicit locked-star requirements remain visible in the status column.

## Review Focus

1. Missing or partially decoded new PNGs must never fall back to a second tub in a real browser; test procedural fallback and explicit legacy mock separately.
2. Orange loss/gain after map changes and at zero life must originate from the actual bath/head anchor, without rotating the bath or leaking canvas transforms.
3. Locked and grandfathered profiles must retain progression gating in list, matrix, detail and deep links.
4. Short landscape and narrow portrait screens must keep all tabs, footer, close, row action and growth table accessible without horizontal clipping.
5. Scoped CSS and page-specific header markup must not change shop/settings/settlement or audio; verify representative pages and frozen hashes.

## Tasks

### 1. Assets, isolation and guardian fusion
Files: `scripts/p10-isolation-check.mjs`, `public/assets/sprites/*`, `src/ui/stickers.ts`, `src/ui/GameApp.ts` preload list, `src/render/StickerRenderer.ts`, `src/render/StickerArt.ts`, `src/config/guardianBaths.ts`, `tests/p10-bath-fusion-and-storybook-compendium.test.ts`.
- [x] Capture baseline hashes and pass existing suite; sync205 PNGs.
- [x] Add failing tests recording actual Canvas draw transforms, healthy/dizzy selection, no real old-tub fallback, orange motion and sprite/fallback coverage.
- [x] Implement exact bath coordinates/sizes/ripple radii/orange offsets, tub-free vector art, steam and floating motion.
- [x] Pass focused tests and update obsolete asset-count/endpoint assertions only where P10 explicitly supersedes them.

### 2. Storybook Compendium
Owner scope: `Compendium.ts`, `LedgerView.ts`, new `p10.css`, new `i18n/p10.ts`, `i18n/i18n.ts`, and focused `tests/p10-storybook.test.ts`. Parent owns main.ts import/sticker registration and browser QA.
- [x] Add failing tests for row structure, digit-free taglines, statuses/checks,12 recipe rows, matrix/detail compatibility and bilingual gating.
- [x] Preserve portrait navigation contracts; add framed art/copy/status rows and recipe list before selected details and collapsible matrix.
- [x] Page-specific peeking mascot, outlined title, footer and exact palette; responsive only under `#game-dialog.recipe-dialog`.
- [x] Run focused legacy/P10 tests; do not modify audio, other screen styling or numerical gameplay data.

### 3. Integration and delivery
- [x] Import p10.css last, run all tests/typecheck/build.
- [x] Capture1366×768,844×390,390×844 screenshots for four baths and six bilingual tabs/detail/back/locked views; test offline assets, keyboard focus and cross-page regression.
- [x] Fresh whole-branch review, regression fixes, protected hash comparison, screenshots/report in game-local verification/docs; preserve local branch/version checkpoint.
