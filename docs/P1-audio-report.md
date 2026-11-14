# P1 audio implementation report

Status: complete in the assigned audio scope. All writes stayed inside this game directory; no design, repository baseline, server or package changes and no Git operations were made.

## Files

- `src/ui/SoundManager.ts`: shared WebAudio graph, mode transitions, canonical/legacy cues, throttling, battle event consumption, optional decoded audio and lifecycle cleanup.
- `src/ui/MusicTracks.ts`: actual multi-instrument arrangements and exact 84/108/124 BPM eighth-note schedules.
- `public/audio/manifest.json`: shipped `{}`; default installation fetches only this existing manifest.
- `public/audio/README.md`: supported keys, safe relative paths, override precedence, deployment and failure behavior.
- `tests/p1-sound.test.ts`: 34 new recording-WebAudio tests.
- `tests/m3-sound.test.ts`: all 21 existing cases retained; four cases minimally adapted as explained below.
- `docs/P1-audio-report.md`: this report.

## Implemented behavior

Menu uses Cmaj9/Am9/Fmaj9/G6/9 arpeggios over a slow, low-pass triangle pad at 84 BPM. Battle uses sine/mallet melody, plucked triangle bass and filtered white-noise shaker at 108 BPM. Boss uses a more rhythmic lead, bass, shaker and sliding low drum at 124 BPM. Notes have attacks and bounded release envelopes; percussion reuses one short noise buffer.

One context and one 100 ms lookahead interval persist through all modes/resumes. Three cached arrangement buses and per-voice envelopes crossfade over about 220 ms, including rapid mode changes. Missed beats are skipped after interruption instead of allocating catch-up bursts. Live voices are capped at 96 and ended voices/filters/gains disconnect. Disposal aborts loads, clears the interval/listener, stops all sources/loops, disconnects every bus and closes the context. Late resume, manifest or decode completion cannot revive audio.

`setMode('menu'|'battle'|'boss')` is added; the existing constructor/unlock/settings/duck/play/consume/dispose APIs remain. All canonical cues are playable. `dig`, `upgrade`, `legendary`, `orange` alias `shovel`, `merge_upgrade`, `merge_hero`, `orange_lost`; all other M3 names remain. Music and effects use their existing independent master gains (music volume × 0.12; sound volume × 0.5). Music ducks to 15% for overlays/hidden documents; SFX does not. Volume zero applies immediately, and re-enabling SFX resets the throttle history so the first event is audible.

Hit sounds have a global 95 ms minimum interval. Goose/dash, orange, sprinkler, boss, treasure and lottery tick cues also have short limits; summon, shovel and hero commands remain responsive. Battle events deduplicate by battle ID plus event ID. Damage/dash/orange/sprinkler/ordinary purge/treasure/boss effects are consumed; legendary and sprinkler purges do not emit an upgrade. Core's paired treasure bubble/weapon events coalesce through the 80 ms treasure limit.

Declared external audio is fetched and decoded into the same context/buses; decoded music loops and takes priority over synthesis, and decoded SFX takes priority per cue. Missing, unsafe, invalid, fetch/decode/start failures retain synthesis. A decoded override arriving during suspension is adopted on the next gesture resume. Optional filters/buffers and AudioContext itself may be absent without uncaught errors. No undeclared audio files are requested.

## Test-first evidence

1. Before implementation, `npm test -- tests/p1-sound.test.ts`: **16 failed / 3 passed (19 cases)**. Expected missing behaviors included `setMode`, multi-track scheduling, new hit cue/throttle and manifest/decoded override handling.
2. Self-review regression for switching modes while suspended: **1 failed / 30 passed** before the fix; it demonstrated the old pad was not faded out on resume.
3. Self-review regressions for an override decoded during suspension and a buffer source rejecting `start()`: **2 failed / 32 passed** before the fixes. The first could leave synthesis running; the second could leave a phantom loop in the live voice set.
4. Final targeted command `npm test -- tests/p1-sound.test.ts tests/m3-sound.test.ts`: **2 files, 55 tests passed**, exit 0 (2026-11-13 16:32:42 local environment clock).
5. Final `npm run typecheck`: **passed**, exit 0.
6. Final `npm test`: **23 files, 548 tests passed**, exit 0 (2026-11-13 16:32:45). No concurrent failures were observed in this run.

Tests exercise actual manager-created node routing, oscillator frequencies/onsets, attacks/releases, noise-buffer scheduling, fades, gains, source stops and teardown. Only browser WebAudio/fetch/document/timer APIs are doubled; no manager methods are replaced. Coverage includes all canonical cues, the M3 cues/lifecycle, exact tempos, muted/ducked gain paths, 95 ms boundary, voice bounds, event ownership/dedup, safe manifests, decoded precedence, failures and pending async cleanup.

## Every changed legacy assertion

1. Constructor-retry case: initial oscillator count `1` became `>=4`, because a successfully retried P1 menu starts a melody plus chord pad. The original constructor failure/retry checks remain.
2. Suspended-resume case: advances the recording host's `currentTime` to 0.45 before advancing the timer. P1 scheduling follows the AudioContext clock rather than blindly scheduling one note per interval; the existing exact two goose notes, subsequent music progress, shared buses, single context and one timer assertions remain.
3. Initial-music case: renamed the obsolete pentatonic title; replaced C/D/E/G/A-only membership with C-major diatonic membership and an explicit B natural/seventh assertion. This is required for the specified maj7/9 harmony. Sine/triangle softness, context/lifecycle and disposal checks remain.
4. Battle-consumption case: first emitted note count changed from 14 to 15: new orange gain +2, specified two-note upgrade replacing the old three-note cue −1. On a new battle, the positive orange now adds two notes; the host clock advances 100 ms to avoid intentionally throttling the distinct event. The following orange loss adds two notes. The existing repeated-event suppression and UI-owned legendary exclusion remain, with stronger exact new-battle totals.

## Interfaces and attention points

No contract deviations or out-of-scope edits were required. Root UI owns automatic mode selection and command/result/lottery calls; core supplies the explicit boss/treasure/sprinkler effects. The 548-test full run included those concurrent changes.

There are no bundled audio files and no third-party audio/license dependency. The follow-up Vite manifest filter below removes missing declared audio before dev playback and static deployment. Runtime/browser codec support can vary and falls back safely. Tests verify scheduling/graph behavior; subjective speaker/headphone listening and real browser autoplay policy remain part of the root's browser QA, not claimed by these WebAudio-host tests.

## Follow-up: missing declared audio produces no 404

Added `scripts/audio-manifest.ts`, exporting the requested `audioManifestPlugin(): Plugin`, and `tests/p1-audio-manifest.test.ts` with 13 isolated tests. Updated the audio README above. `SoundManager.ts` and its existing logic were unchanged in this follow-up. Root owns `vite.config.ts` registration; this agent did not edit that configuration.

The dev middleware intercepts only the audio manifest URL (including the resolved deployment base), reads the resolved `publicDir` freshly for every request, and sends HTTP 200 JSON with `Cache-Control: no-store`. Unknown keys, unsafe paths, files that do not exist and directories are removed. A missing, malformed or non-object manifest becomes `{}`. The safe path/extension regex exactly matches SoundManager's existing validator: safe relative segments, and mp3/ogg/wav/m4a/aac files. A browser therefore never sees a declaration for a missing dev audio file.

The `closeBundle` hook uses Vite's resolved root and relative or absolute `build.outDir`. It filters the copied output manifest against the actual copied output files, then rewrites only that output manifest. Public source manifests and audio files are unchanged. Game directory boundaries are checked both lexically and through real paths/existing ancestors, including before writes; paths beyond the game and output paths that would overwrite public sources are rejected. Symlink audio declarations escaping the audio directory are omitted. Empty manifests remain `{}`. These guarantees apply to the complete build deployed to a normal static host; removing audio after publishing requires updating/redeploying its manifest.

Test evidence:

- Initial RED: the new suite could not resolve the not-yet-created `../scripts/audio-manifest` module, confirming the plugin artifact was absent.
- Additional behavior RED before its fix: `refuses an output directory that would overwrite the public source manifest` failed, with **1 failed / 12 passed** because the hook incorrectly resolved instead of rejecting. The implementation was then guarded against public-source writes.
- Final command `npm test -- tests/p1-audio-manifest.test.ts tests/p1-sound.test.ts tests/m3-sound.test.ts`: **3 files, 68 tests passed** (13 manifest + 55 existing audio), exit 0, 2026-11-13 16:48:03.
- Final `npm run typecheck`: **passed**, exit 0.
- As requested, the full suite was not repeated for this follow-up. No server was started/stopped. All fixtures were created under the game's `.runtime/p1-audio-manifest-*` directories and removed after their tests. Middleware and build hooks were exercised directly; Vite registration/build integration belongs to root.

Coverage includes safe existing/missing assets; all malformed JSON/object cases in dev and build; unsafe/traversal/absolute/encoded paths; unrelated requests passing through; fresh file availability; nested/absolute output directories; a custom resolved public directory and deployment base; empty/missing manifests; preserved public source content and unchanged audio files; forbidden outside-game/public-source output. The final test run showed only a Vite configuration warning about root's extensionless plugin import; root has been notified to use `./scripts/audio-manifest.ts`. No interface deviations remain.

## Round 1 review fix: reject links within the game before output writes

Reviewer evidence identified a real boundary gap: a build output audio junction aimed at another source directory inside this game passed the previous game/public checks and allowed `closeBundle` to overwrite that source manifest. Preserved the exact pre-fix plugin at `.runtime/p1-audio-manifest-before-fix.ts` before editing production code.

Added three real filesystem regression tests in `tests/p1-audio-manifest.test.ts`: output `audio` directory junction to an in-game source directory; output `manifest.json` file symlink to another in-game file; and a junction in an output ancestor directory. All three use isolated game `.runtime` fixtures and assert the hook rejects and the linked source bytes remain unchanged. RED command `npm test -- tests/p1-audio-manifest.test.ts` produced **3 failed / 13 passed**, with each failure showing the old hook resolved rather than rejected.

The minimal plugin fix imports `lstat` and checks every output target and existing ancestor up to the filesystem root, rejecting symbolic links and Windows junctions even if their resolved destination remains inside the game. The existing checks run before `mkdir` and again immediately before writing the output manifest; public-source and outside-game protections remain. Only the plugin, its manifest tests and this report changed, plus the explicitly requested preserved `.runtime` snapshot. No SoundManager, Vite config, other module, server, Git or design changes were made.

Final verification (2026-11-13 16:51:45): `npm test -- tests/p1-audio-manifest.test.ts` **16/16 passed**, exit 0; `npm run typecheck` **passed**, exit 0. No full suite was run for this scoped review fix. Root separately reports successful real-WAV browser override, shared-bus volume-zero control, and missing-declared-track zero requests/zero 404 checks; those browser results are root's evidence, not a claim that this agent reran browser QA.

Round 1 scope is complete and frozen for parent review. No interface changes or unresolved failures remain in the requested checks.
