# Optional audio overrides

The shipped empty `manifest.json` uses the offline, multi-track WebAudio arrangements.
No audio files are requested unless declared. Add licensed audio beneath this directory
and map supported keys to relative paths, for example:

```json
{"bgm_menu":"music/menu.ogg","bgm_battle":"garden.mp3","hit_soft":"hits/bubble.wav"}
```

Music keys: `bgm_menu` (116 BPM G-major pastoral orchestra), `bgm_battle`
(124 BPM D-dorian tactical march), `bgm_boss` (138 BPM chromatic brass showdown).
Each builtin phrase spans 16 bars: 64 quarter-note scheduler steps, with eighth
notes scheduled by their own delays. The menu uses flute, glockenspiel, pizzicato
and walking cello voices, with no noise percussion. Battle and boss use distinct
plucked/brass themes, driving bass and increasingly dense drums.
Music files loop; export seamless loops. A successfully decoded override takes priority;
missing files, invalid manifests and unsupported codecs quietly retain builtin audio.
The Vite `audioManifestPlugin()` filters the dev manifest before serving it: only known
keys with safe relative paths to existing files are returned, always as JSON with HTTP
200. Invalid JSON and missing manifests become `{}`. The public source is never edited.
At build completion the plugin filters `dist/audio/manifest.json` (or the configured
in-game output directory) against the copied files. Deploy the complete build output:
ordinary static hosts then receive no declarations for missing tracks, avoiding 404s.
The default empty installation requests only the existing manifest. Rebuild after changing
production audio files; deleting files after publishing requires republishing the manifest.

Cue keys: `ui_click`, `summon`, `shovel`, `treasure`, `merge_upgrade`, `merge_hero`,
`hit_melee`, `hit_ranged`, `hit_magic`, `hit_heavy`, `battle_start_clash`,
`elite_spawn`, `boss_spawn`, `death_rat`, `death_bug`, `death_crab`, `death_machine`,
`death_frog`, `death_boss`, `orange_lost`, `orange_gain`, `sprinkler`, `goose`,
`lottery_tick`, `lottery_win`, `victory`, `defeat`. Legacy `dig`, `upgrade`,
`legendary`, `hero_merge`, `orange`, `hit_soft` are accepted; prefer canonical names so every alias uses the same
override. If both are declared, a requested legacy cue's exact override wins.
`hit_soft` aliases `hit_melee`; `hero_merge` and `legendary` alias `merge_hero`.

Allowed file extensions: `.mp3`, `.ogg`, `.wav`, `.m4a`, `.aac` (browser codec support
varies). Filenames/directory segments may contain ASCII letters, digits, `_` and `-`.
Absolute URLs, `..`, percent escapes, backslashes, query strings and fragments are rejected.
Paths resolve relative to `audio/` under Vite's base, including subdirectory deployments.

Overrides are decoded into the same AudioContext as synthesis. Music and cues share
their respective volume sliders; overlays/hidden tabs duck music only. The music bus
uses slider × 0.65 (× 0.24 when ducked), and effects use slider × 1.15. When supported,
both feed a compressor (-10 dB threshold, 12 dB knee, 4:1 ratio, 3 ms attack, 160 ms
release), followed by 1.35 makeup gain. Minimal hosts without a compressor connect
the buses directly to the destination. Zero sliders strictly mute their bus.

Impact cues share a 45 ms minimum interval. Minion death cues use a 55 ms minimum
per family: rat/charmed rat, roach/killer bee, crab, machine, frog and other bosses.
Boss death events always bypass throttling, including the machine and frog themes.
Battle events carry `hitCue` on damage, `enemyKind` and `boss` on death, and
`elite_spawn`/`boss_spawn` effects on alerts. Event identities are consumed once.

`unlock()` must be called synchronously from a trusted gesture. It requests the
optional iOS playback audio session, resumes suspended/interrupted contexts and
primes a one-frame silent buffer before awaiting resume. A later gesture can retry
even if an earlier policy-blocked resume is still pending. `isUnlocked()` reports
the live running state. `setMusicPaused(true)` stops all builtin/decoded music and
its scheduler during the battle curtain; effects remain playable. Passing false
starts the selected arrangement cleanly without a catch-up burst. Disposal aborts
loads and stops/disconnects every source, loop, prime and bus.
