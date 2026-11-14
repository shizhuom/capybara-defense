# P4 Start Splash Implementation Plan

> Execution: inline with `executing-plans`, focused test-first changes, then one independent whole-change review.

**Goal:** Match the supplied animal-gathering splash mockup with localized floating art, organic Start button, atmospheric animation and small corner medallions, retaining all P3 gameplay.

**Authority:** `D:/rea_game/design/codex_p4_start_screen_spec.md` and `design/assets/previews/21_p4_start_screen_mockup.png` (read in full / visually inspected before edits).

**Architecture:** Reuse the shared decoded `AssetRegistry` and existing menu action routing. Keep preview-only scenery separate from battle drawing. Render semantic menu controls with aspect-preserving art helpers. Replace only menu rules in `p3.css`; portrait uses adjacent letterbox space for compact controls when needed.

**Global constraints:** Every write is inside this standalone game repo. Port 4175 and `capybara_defense_v1:` remain unchanged. Preserve P3 battle, progression, profile isolation and 762 baseline tests except preview assertions intentionally superseded by P4. Copy all 173 PNGs and the source manifest byte-for-byte. No changes to the design source or parent repo. Baseline commit: `1b1bdfe`.

## Task 1: Splash assets and independent preview scene

Files: `public/sprites/*`, `public/sprites/README.md`, `src/render/StickerRenderer.ts`, preview-specific tests, `tests/p4-start-screen.test.ts`.

Interfaces: `drawPreview(mapId, seconds, oranges)` keeps its signature; assets remain loaded-only. Menu atmosphere changes with map ID, while splash background stays the same.

1. Add failing render tests: dedicated full-stage image, no map/open-tile lookups, no grid fallback, central procedural capy/pets when missing, animated and map-specific atmosphere. Update superseded P3 endpoint-preview assertions only.
2. Run focused Vitest; expect the new preview assertions to fail against P3.
3. Sync 173 PNGs and exact manifest. Implement bounded, allocation-light wisps/particles and scenic fallback, preserving battle renderer methods.
4. Run focused tests and full suite; expect all green. Commit assets and preview implementation.

## Task 2: Localized wide art and corner controls

Files: `src/ui/stickers.ts`, `CourtyardView.ts`, `GameApp.ts`, `p3.css`, P4 UI tests.

Interfaces: shared `spriteUrl` / `onAssetsReady` refresh, unchanged action names, short existing map translations and profile unlock rules.

1. Add failing tests for PNG/fallback art in both languages, escaping/accessibility, geometry fallback icons and menu semantic actions / lock state.
2. Run focused Vitest; expect missing wide art and medallion markup failures.
3. Implement wide aspect helper, trophy/map-sign geometry, semantic H1 and Start button, split corner medallions and exact desktop coordinates. Remove old title box, flat button and portrait menu grid rules.
4. Validate async asset refresh and responsive composition in real Chromium. Portrait keeps the art composition, using letterbox only for controls that cannot fit readably. Reduced-motion disables decorative animation.
5. Run full tests and typecheck; expect all green. Commit UI.

## Task 3: Browser acceptance, regressions and delivery

Files: `scripts/p4-browser-qa.mjs`, verification JSON/PNG, relevant browser entry point, documentation.

1. Capture desktop zh/en, 844×390 landscape and 390×844 portrait screenshots with actual decoded assets. Inspect each screenshot.
2. Exercise map selection, profile, settings, guide, armory, shop, leaderboard, Start; check real pointer targets, title/start language swaps, fallback before decode and post-decode refresh. Ensure the central panorama stays clear and stage remains 16:9.
3. Retain P3 battle/browser/profile regression checks; adapt only obsolete menu geometry assertions. Verify zero console/page errors.
4. Run `npm test`, `npm run build` and P4 isolation checker. Expect green tests, successful build, 173 identical PNGs + manifest, zero protected-file changes.
5. One fresh-context whole-change review; fix material findings with regression tests, update final report and local P4 snapshot.

## Review Focus

Check delayed/missing image fallback and language races, portrait pointer target overlap and letterbox collisions with rotate hint, long English/high-rank profile labels, preserved battle CSS/input ownership, no accidental map or grid drawing in previews, and exact source asset parity / directory isolation.
