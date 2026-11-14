# P1 UI implementation report

Root UI implementation ready for task review. P1-ui-review-diff.txt contains the M3 ZIP baseline comparison for UI files only. No root repository/design mutations.

Implemented clean mode, saved/query developer control, shared assets ready invalidation, scene/prop/unit HTML stickers, readonly BossHUD selectors, real opponent banner, nonblocking TutorialView with persist-before-adopt rewards, four-page Compendium and complete P1 zh/en dictionaries, SoundManager mode/cue integration, relative Vite base and scratch watcher exclusions. Existing test/normal identity transaction still discards the old engine before any next-frame hero or result persistence; tutorial is discarded at the same transition.

Test-first: tests/p1-ui.test.ts first failed missing BattleHUD import; final9/9 pass. Tests cover exactquery semantics, most-progressed playerBoss selection and dead/enemy exclusion, boundedwave/prep/Boss indicators, all80encyclopedia entries in both languages, exactmerged-only goldstate, all12Boss countertips and translation key parity. Whole integration last548/548 with parallel tasks completed, typecheck0.

Browser P1 actual pointer/DOM flow: scripts/p1-browser-qa.mjs passed8groups with0console/pageerrors. 390×844 menu/battle preserve640:1386 ratio, no document scroll, clean default; actual summon/drag/ack produces20coin receipt, replay/skip no duplicate; developer setting toggles without losing activebattle; board+bench goldmatches, seal andBossHP visible; allfour encyclopedia tabs count12/12/36/20 andEnglish hasnoCJK/unresolvedkeys; fullprofile armory/shop/spin/fourmap load, thennormalrestore; devqueryexplicitoff works. Screenshots verification/p1-*.png.

Visual inspection corrected test-fixture selection (Escape before selecting a replaced unit), bench spotlight center, translated bookeyebrow, enlargedmenuart and preventedpreptext behind manually spawnedBoss. Browser re-run for final screenshots follows review; production/subdir/fallback checks are finalintegration work, not yet claimed here.

ExistingM3browser regression adapted only URLs?dev=1, canonicalmergecue names and weaponPNG-or-SVG selector; running now. Oldproduction/isolation regressions intentionally require builtserver and will run after finalbuild.
