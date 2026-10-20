# Candidate QA Notes

Stable baseline: **R237**

## Current candidate: Rev 12


## Candidate Rev 12 — Electrical SFX Laboratory

Candidate Rev 12 adds a development-only procedural electrical-audio test bench
inside **Spell Previewer [DEV]**. It does not change production spell audio.

### Starting voices

- **Zap** — short, dry electrical contact/discharge.
- **Lightning Bolt** — sharp snap, randomized micro-arcs, sizzle, pitch sweep,
  and a restrained low-frequency body.
- **Heavy Lightning** — larger discharge with more crackle, longer tail, and a
  stronger low-frequency body/rumble layer.
- **Custom** — appears automatically after a parameter is adjusted.

### Live controls

- Master output
- Snap
- Crackle
- Sizzle
- Arc tone
- Low body
- Number of randomized micro-arcs
- Arc start frequency
- Arc end frequency
- Tail duration
- Optional repeat audition at 0.5 / 1.0 / 2.0 second intervals

The lab reuses the application's shared Web Audio context, generated white-noise
buffer, global SFX enable/disable state, and SFX gain path. A local compressor
limits the laboratory output so stacked transients do not hard-clip.

Each trigger intentionally randomizes micro-arc timing, resonant band-pass
frequency, high-pass cutoff, duration, gain, and playback rate. This prevents
repeated electrical discharges from sounding like an identical sample.

The lab exposes `window.AdventurePartyElectricalSfxLab` for future production
integration, but Candidate Rev 12 does **not** route Lightning Bolt, Shocking
Grasp, or any other spell through these voices yet.

### Rev 12 QA focus

1. Open **Spell Previewer [DEV]** and confirm **Candidate Rev 12** appears.
2. Find **Electrical SFX Laboratory [DEV]** in the right-side controls.
3. Play **Zap**, **Lightning Bolt**, and **Heavy Lightning** and confirm each is
   audibly distinct.
4. Move each slider and confirm the value readout updates immediately.
5. Confirm changing a slider switches the Voice selector to **Custom**.
6. Confirm repeated plays of the same preset have subtle crackle variation.
7. Enable Repeat at all three intervals and confirm playback remains stable.
8. Press Esc / leave the Spell Previewer while Repeat is active and confirm the
   repeat cycle stops.
9. Turn global SFX off and confirm the lab respects the global audio setting.
10. Confirm ordinary spell previews and production combat spell audio are
    unchanged.


## Candidate Rev 11 — DQK Red Dragon sprite replacement

- Replaces the Juvenile Red Dragon standing and attack sprites with the extracted
  **Dark Queen of Krynn Red Dragon** ready/action combat pair.
- Each 48×48 source is enlarged exactly **4× to 192×192** with nearest-neighbor
  sampling. No generated pixels, smoothing, repainting, or AI reinterpretation.
- The new art is native-facing **right**.
- In combat, both poses are rendered at **89×89** so the square source is not
  stretched. The prior seven-hex footprint center, lateral bias, and bottom
  anchor are retained.
- The existing breath-weapon timing, 1.1 s action-pose hold, VFX/SFX, AI,
  footprint, HP bar, and combat rules are unchanged.

### Rev 11 QA focus

1. Start **Combat System Test** and select **Juvenile Red Dragon**.
2. Confirm the standing pose uses the DQK Red Dragon ready sprite.
3. Trigger a melee/breath action and confirm the action pose uses the matching
   DQK Red Dragon action sprite.
4. Confirm both sprites remain crisp nearest-neighbor pixel art with no
   smoothing or distortion.
5. Confirm left/right facings mirror correctly from the DQK sprite's native
   right-facing orientation.
6. Confirm the dragon remains centered/aligned over the same seven occupied
   hexes as before and does not change tactical footprint.
7. Confirm the sprite's feet/body remain on the previous ground anchor and the
   HP bar remains readable.
8. Confirm breath VFX/SFX, attack timing, targeting, LOS, movement, and AI are
   otherwise unchanged.

### Dark Queen of Krynn digitized SFX pass

Candidate Rev 10 integrates three user-selected effects extracted from the
user-provided **The Dark Queen of Krynn** sound bank.

#### DQK SFX 09 — Fireball

- Fireball's explosion/effect sound now uses **DQK SFX 09**.
- The universal Pool of Radiance casting cue remains separate and unchanged.
- Flaming Sphere and other callers of the older Fireball-style synthesized
  sound keep their existing audio; SFX 09 is scoped specifically to Fireball.
- The Spell Previewer Fireball profile also uses SFX 09 for direct QA.

#### DQK SFX 02 — hostile spell successfully takes hold

SFX 02 plays when a hostile spell condition is actually applied to a creature,
rather than merely when a saving throw is rolled.

Covered condition families include:

- Charm Person
- Sleep
- Hold Person / Hold Undead
- Blindness / hostile Light / Glitterdust blindness
- Deafness
- Spook
- Taunt
- Hypnotic Pattern
- Ray of Enfeeblement
- Scare
- Stinking Cloud nausea
- Tasha's Hideous Laughter
- Web
- Slow
- Grease prone
- Color Spray incapacitating conditions

This deliberately also covers Sleep-style successful spell effects even when
the underlying AD&D rule does not use an ordinary saving throw.

Repeated refreshes of an already-present condition do not replay the cue merely
because the duration was refreshed.

#### DQK SFX 07 — adjacent physical miss

- SFX 07 is the miss cue for an **adjacent, non-ranged physical attack**.
- Generic melee attacks, free strikes, guards, and other physical attacks that
  route through the melee attack function receive the new miss cue.
- Longbow, sling, missile spell, and other ranged/projectile misses retain their
  established ranged miss sound.
- The rule checks both adjacency/reach and that the attacker is not currently
  using a ranged weapon.

### Audio assets

Rev 10 stores short effects as real WAV assets under the standardized `assets/audio/sfx/` tree:

- `assets/audio/sfx/spells/dqk-sfx-09-fireball.wav`
- `assets/audio/sfx/status/dqk-sfx-02-spell-affect.wav`
- `assets/audio/sfx/combat/dqk-sfx-07-melee-miss.wav`

They are fetched as ordinary repository audio assets by the candidate audio module and decoded into the existing
Web Audio / SFX gain path. Therefore the normal global SFX level and the Spell
Previewer's VFX-only suppression continue to apply.

### Retained Rev 9 gaseous presentation

- Individual gaseous tufts remain soft and unoutlined.
- One evolving union outline follows the total visible cloud mass during the
  one-second bottom-to-top build.
- Fog / Wall of Fog use a dark union outline; Stinking Cloud uses green.
- LOS obscuration remains immediate.

### Retained Rev 10 QA focus

1. Open **Spell Previewer [DEV]** and confirm **Candidate Rev 10** appears.
2. Select Fireball and confirm the explosion uses the new DQK SFX 09.
3. Confirm the universal casting cue still precedes the Fireball effect sound.
4. Select Flaming Sphere and confirm it has **not** inherited Fireball SFX 09.
5. Test Charm Person with a failed save and confirm SFX 02 plays when Charm
   actually takes hold.
6. Test Sleep and confirm each newly affected sleeper receives the successful
   spell-affect cue.
7. Test Hold Person, Blindness, Slow, Stinking Cloud, Web, and Hideous Laughter
   with failed saves and confirm SFX 02 accompanies the applied condition.
8. Force successful saves in the Previewer and confirm SFX 02 does **not** play
   when the condition is resisted.
9. Confirm refreshing an already-present condition does not create an extra
   successful-affect sound merely from the refresh.
10. In Combat System Test, make an adjacent physical attack miss and confirm
    DQK SFX 07 is used.
11. Confirm Guard/free-strike adjacent misses use the same cue.
12. Fire a Longbow or other ranged attack that misses and confirm the existing
    ranged miss sound remains in use.
13. Confirm missile-spell misses likewise do not use the melee miss cue.
14. Test Full Sequence / VFX Only / SFX Only in the Spell Previewer; VFX Only
    should suppress the new DQK sounds.
15. Confirm Rev 9 gaseous cloud formation/outline behavior is unchanged.
16. Return to ordinary combat and confirm initiative, targeting, saves, damage,
    LOS, and turn flow are otherwise unchanged.

### Candidate lineage retained from R237

- 33% hidden LOS overlay and obscuring-volume visibility presentation.
- No loot on total party defeat.
- Ordered result beats: direct damage → rider damage → buffs → debuffs → conditions.
- White rising **Casting Interrupted** feedback and dedicated fumble SFX.
- Level 1–3 AoE AIM-footprint preview audit.
