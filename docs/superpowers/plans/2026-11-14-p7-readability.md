# P7 Readability Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement these tasks in order, with tests and one final fresh review.

**Goal:** Make the splash title, all secondary pages and battle synthesis opportunities immediately readable.
**Architecture:** Preserve the existing Canvas simulation and ledger shells. Add portrait/detail state to Compendium, a final P7 CSS layer, and shared merge-target metadata for underlay and foreground rendering.
**Tech Stack:** TypeScript, Canvas 2D, Vite, Vitest, Playwright/Chromium.
**Spec:** `D:/rea_game/design/codex_p7_typography_compendium_merge_highlight_spec.md` (read in full).

## Global Constraints
- All writes stay in `D:/rea_game/games/capybara-defense/`; design and parent baseline are read-only.
- Preserve port 4175, save prefix, combat/economy, tutorial/lock interactions and 193 sprite IDs.
- Preserve 960×320 title / 520×220 start assets, one bare pause section and close-toolbar structure.
- Implement the user's explicit P7 refinements where their message is more specific than the design (fallback font 148, orange 160/58; alpha .72).

## Review Focus
- Unknown/stale detail IDs and returning focus after navigating to another portrait.
- Long English names and 844×390 / 390×844 layouts: scrollable body, reachable actions, no clipping.
- Merge candidates on both bench and board, locked/washing/max-level units, and hero feeding semantics.
- Pointer-down preview must never change tap-to-merge, tap-to-deselect or drag movement behavior.
- Foreground callouts must remain readable near stage edges and adjacent candidates.

### Task 1: Portrait/detail compendium and menu-only language
**Files:** `src/ui/Compendium.ts`, `GameApp.ts`, `LedgerView.ts`, `SettlementView.ts`, `src/i18n/p7.ts`, `i18n.ts`; P1/P3 legacy and P7 tests.
**Interfaces:** `inspectEntry(id): boolean`, `closeDetail(): string|null`, `stepDetail(-1|1): boolean`, `openTo(id): void`. `select(tab)` resets detail; matrix hero selection stays in matrix.
- [x] Write/run failing tests for clean portrait counts 19/12/17/36/20, valid/unknown deep links, wrapping, back, exact detail values and menu-only languages.
- [x] Implement catalog ownership, galleries, full detail sheets and keyboard-focus actions; preserve legacy structural contracts.
- [x] Run focused tests then full suite; commit.

### Task 2: Larger art and all-page typography
**Files:** two title PNGs, `stickers.ts`, `src/ui/p7.css`, `src/main.ts`, browser QA.
- [x] Copy only updated title assets and verify dimensions/manifests.
- [x] Apply exact requested title/menu sizes, 1180×720 ledger limits and per-page type scales; short landscape and portrait overrides retain usable scrolling.
- [x] Verify asset/SVG contracts and browser computed sizes; commit after suite.

### Task 3: Passive and immediate multi-target battle highlights
**Files:** `MergeTargets.ts`, `types.ts`, `StickerRenderer.ts`, `GameApp.ts`, P7 tests.
**Interfaces:** `MergeTarget {unitId,kind,heroId?,nextLevel?,feedHero?}` and `getBoardMergeHints(state)`; existing bench hints unchanged. `Interaction.previewSourceId` does not mutate selection.
- [x] Write/run failing tests for board panda+cat+bench hat, same-level upgrades, hero feeds, invalid states and foreground order.
- [x] Implement metadata, passive board rings, active pads/scale/alpha and foreground outcome pills after both sprite loops.
- [x] Verify pointer-down preview and existing P5/P6 input tests; run full suite and commit.

### Task 4: Browser acceptance, isolation, final review
**Files:** `scripts/p7-browser-qa.mjs`, `verification/p7-*`, `docs/P7-verification.md`, game README.
- [ ] Run full tests/typecheck/build; capture every requested desktop screenshot plus short landscape and portrait checks in both languages.
- [ ] Inspect images, check clipping/console errors/focus/input flows and production assets; compare protected hashes.
- [ ] One fresh whole-branch review; one material-fix pass with regression tests.
- [ ] Archive evidence/decisions, commit and preserve a local P7 milestone. Leave production service on 4175.
