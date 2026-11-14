# Optional audio overrides

The shipped empty `manifest.json` uses the offline, multi-track WebAudio arrangements.
No audio files are requested unless declared. Add licensed audio beneath this directory
and map supported keys to relative paths, for example:

```json
{"bgm_menu":"music/menu.ogg","bgm_battle":"garden.mp3","hit_soft":"hits/bubble.wav"}
```

Music keys: `bgm_menu` (84 BPM), `bgm_battle` (108 BPM), `bgm_boss` (124 BPM).
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
`hit_soft`, `boss_spawn`, `orange_lost`, `orange_gain`, `sprinkler`, `goose`,
`lottery_tick`, `lottery_win`, `victory`, `defeat`. Legacy `dig`, `upgrade`,
`legendary`, `orange` are accepted; prefer canonical names so every alias uses the same
override. If both are declared, a requested legacy cue's exact override wins.

Allowed file extensions: `.mp3`, `.ogg`, `.wav`, `.m4a`, `.aac` (browser codec support
varies). Filenames/directory segments may contain ASCII letters, digits, `_` and `-`.
Absolute URLs, `..`, percent escapes, backslashes, query strings and fragments are rejected.
Paths resolve relative to `audio/` under Vite's base, including subdirectory deployments.

Overrides are decoded into the same AudioContext as synthesis. Music and cues share
their respective volume sliders; overlays/hidden tabs duck music only. Hit cues remain
globally limited to one per 95 ms. Disposal aborts loads and stops every source/loop.
