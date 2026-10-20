# Adventure Party Audio Assets

Audio files are stored as real repository assets rather than embedded JavaScript payloads.

## Layout

- `sfx/combat/` — weapon, hit, miss, movement, and other combat cues
- `sfx/spells/` — spell casting, projectile, impact, and spell-specific cues
- `sfx/status/` — condition, save/effect, debuff, and status cues
- `sfx/ui/` — launcher, menu, and interface cues
- `ambient/` — longer environmental loops
- `music/` — music tracks

## Format guidance

Use WAV for short sound effects so they remain simple to replace, audition, cache, and decode in-browser. Use compressed formats for longer music or ambient tracks when file size materially benefits.

Code should reference audio by asset path; audio bytes should not be embedded in JavaScript modules.
