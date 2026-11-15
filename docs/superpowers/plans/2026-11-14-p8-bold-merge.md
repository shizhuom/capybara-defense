# P8 Bold Contrast & Always-On Merge Plan

> **For agentic workers:** Use superpowers:executing-plans inline, with RED→GREEN checks and one final independent review.

**Goal:** Make every secondary-page label bold and legible, and expose every ready recipe without requiring a drag.
**Architecture:** Keep combat and saved data unchanged. Extend shared merge metadata, manage selection in GameApp, and render passive badges as a foreground layer alongside active targets. Apply a final scoped P8 typography/contrast stylesheet; verify effective computed colors and text bounds in Chromium.
**Tech Stack:** TypeScript, Canvas 2D, Vite, Vitest, Playwright.
**Spec:** `D:/rea_game/design/codex_p8_bold_contrast_and_always_on_merge_spec.md` (read completely), plus the user's explicit P8 parameter and acceptance refinements.

## Global Constraints
- Only write inside `D:/rea_game/games/capybara-defense/`; parent/design are read-only.
- Keep port 4175, `capybara_defense_v1:` storage, economy, tutorials, lock slots and 193 sprites.
- Preserve exact legacy bench/board hint shapes and one bare pause `<section>`.
- P7 baseline `5f95671` / `v1.0-p7`, 902 passing tests. Use branch `p8-bold-merge-alerts` in the mandated directory.
- Explicit user sizes/colors take precedence over nearby spec values. Where a requested background fails the stronger contrast rule, darken within the same hue: white/#2f6f46 is 6.03:1 and subtitle/#7f532d is 6.19:1. Body text aims >=11:1; every audited visible text run must be >=7:1.

## Review Focus
- Several simultaneous special/hat recipes, duplicate parts, disappearing pairs and repeated locator clicks select only currently valid components.
- Selecting an unrelated pet or one merge group leaves all other passive groups visible; held tools/drag previews suppress passive badges.
- Crowded top/bottom rows, bench locks and mobile overlays retain readable badges and the existing foreground active tether.
- Contrast audit accounts for ancestor opacity, translucent/gradient backgrounds, disabled/locked text and actual visible text runs.
- 1080p/1440p fluid type and short landscape/portrait layouts preserve scroll access, full labels and keyboard focus.

### Task 1: Full-field metadata, selection lifecycle and locator
**Files:** `src/core/MergeTargets.ts`, `src/ui/GameApp.ts`, `src/i18n/p8.ts`, `i18n.ts`, `tests/p8-bold-contrast-and-merge-alerts.test.ts`.
**Interfaces:** `getPassiveMergeCallouts(state): PassiveMergeCallout[]` with unitId/zone/kind/heroId?/nextLevel?/partnerIds; new-hero preferred over feed/upgrade. `getHeroMergeOptions(state)` deduplicates new-hero pairs for a stable cycling locator.
- [ ] Write/run failing tests for all 12 recipes across three zone combinations, upgrade/feed exclusions, summon/deploy selection clearing and board-only locator cycling. Expected: FAIL.
- [ ] Implement shared metadata, unconditional successful summon clearing, deployed clearing, clickable localized full-field alert; preserve selected merge/feed outcomes.
- [ ] Focused then full Vitest suite; expected all PASS. Commit.

### Task 2: Persistent foreground merge badges
**Files:** `src/render/StickerRenderer.ts`, `MergeCalloutLayout.ts` if placement extension needed, P8 tests.
- [ ] Test 14+ units with each special pair and unrelated selected squirrel; check both hero icons/text render after board and bench sprites. Test unrelated passive groups coexist with active selection; drag/prop suppress passive sparkles. Expected: FAIL.
- [ ] Active source only for held/dragging units or selected units with targets. Keep uncovered passive groups in idle mode. Draw synchronized gold/green rings, clear level/lock corners, 20px hero icons and bold dark MERGE!/upgrade pills after all unit/nest art.
- [ ] Run focused P6/P7/P8 and full suite; expected all PASS. Commit.

### Task 3: Bold contrast typography and final browser acceptance
**Files:** `src/ui/p8.css` (last import in `src/main.ts`), `SettlementView.ts`, `scripts/p8-browser-qa.mjs`, browser style audit helper, `verification/p8-*`, game docs.
- [ ] Run baseline browser assertions for all visible text weight>=700, effective contrast>=7, requested 1080p settlement labels>=21px/800. Expected: FAIL on P7.
- [ ] Implement requested fluid dimensions/type scale, bright surfaces/dark ink, universal bold minimum, 44/46/76px settlement art and mobile overrides; preserve hidden native controls and menu-only language.
- [ ] Chromium 1920×1080, 1280×720 and mobile: all eight pages, bilingual galleries/details, typography/contrast/overflow, crowded passive special recipes and locator; save the seven requested screenshots plus responsive evidence. Expected PASS, console/pageerror 0.
- [ ] Run npm test/build, production smoke/save isolation and protected-file hashes. One fresh whole-branch review, one material-fix pass with regressions. Archive rulings and results, commit local P8 milestone; leave production on 4175.
