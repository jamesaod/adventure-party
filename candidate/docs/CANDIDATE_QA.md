# Candidate QA Notes

Stable baseline: **R238**

## Current candidate: Rev 57 — Carl's sword and published combat sprites

The 3d studio's **Equipment** panel offers **Right hand → Medieval Sword** for Carl's existing hand rig. **Sword size**, **Adjust grip** (position and rotation), and **Reset grip** tune the attachment. The sword moves with the hand in every existing animation and appears in all six previews and newly captured sprites. Choose equipment before capturing; changing equipment or its grip requires clearing the captured sheet. Workspace reload and the same-tab combat round trip retain the equipped weapon and its settings.

The exact uploaded sword is stored separately in `assets/models/weapons/swords/medieval-sword.glb`. The current grip is a starting preset for Carl; existing motion clips and finger animation remain authored by the character model.

The previously held **Dungeon Crawler Carl Sprite Set.zip** is now imported as `assets/sprites/dungeon-crawler-carl/`. Its eighteen PNGs and reference sheet retain their exact original bytes, source frames, anchor and capture scale. `data/sprite-sets.json` explicitly assigns the package to `fighter`, fixing ordinary Combat System Test encounters that previously fell back to the old single Carl image. The imported art is the supplied sprite package, distinct from the saved V2 model and new sword-equipped studio previews.

See [UNIT_ASSETS.md](UNIT_ASSETS.md) for the formal roster and authoritative catalog locations. It lists all ten studio unit targets, the ready-only Studio Kobold variant, dedicated versus shared artwork, and missing poses.

QA checks cover ordinary combat with all eighteen Carl pose/facing combinations, fresh-page default assignment, safe fallback when a package is incomplete, sword attachment across the real animation clips, grip controls, capture locking, saved-workspace restoration, and the existing repository validation suites.

## Candidate Rev 56 — Saved Carl model in Pixel Studio

The user-provided GLB is preserved as `assets/models/dungeon-crawler-carl/v2/dungeon-crawler-carl-v2.glb` and registered as **Dungeon Crawler Carl Ver 2** in Pixel Studio's new Model library dropdown. **Load selected model** downloads it from the repository-backed site, uses the existing import and workspace persistence path, and selects Y-up plus the Fighter target. Four independent animation clips remain selectable.

The catalog is stored in `data/studio-models.json`, with source identity and checksum documented beside the model. Existing device uploads and the demo remain available. Choosing a catalog option alone leaves the active workspace intact; successfully loading a different model begins a fresh sheet. The separately uploaded Carl sprite ZIP remains on hold, and combat sprite references are unchanged.

Local validation passes the existing repository/studio/sprite suites. Focused browser QA confirms the exact menu label, catalog-relative asset load, Y-up/Fighter defaults, four clips, paused animation restoration after reload, and retention of the current model after a failed download. Repository transfer and live candidate verification remain release gates.

## Candidate Rev 55 — Shared FBX animation curves

The FBX importer now follows every valid animation-curve connection. FBX permits one curve to feed curve nodes in several takes; following only the first connection caused later takes to disappear. Regression fixtures reproduce the missing animation and verify that both takes load regardless of connection order, while retaining their distinct IDs and authored time spans.

Pixel Studio now reports selectable animations alongside the total FBX take count. A take with no supported tracks is described as such rather than assumed to be empty. The existing first-usable-layer limitation is still reported; this change does not add layer blending.

Validation includes the parser regressions, a real binary FBX, browser selection of both shared-curve takes with one active action, and the repository checks. Same-filename replacement was also verified in both directions: loading new bytes replaces the stored model, while a page refresh restores the last saved copy. The user's Tripo FBX has not been supplied, so this confirmed importer defect is not yet identified as the cause in that file.

## Candidate Rev 54 — Selectable FBX animations and named ranges

Pixel Studio lists every usable embedded animation with its own number, name and duration. FBX takes retain their identity even when names are duplicated. Valid authored take boundaries are cropped and shifted to a local timeline starting at zero; boundary poses and intentional holds are preserved. Empty takes are skipped, and layered FBX takes produce an explanatory note because the viewer uses the first usable layer.

Selecting an animation stops the previous action before starting the selected one. Pausing, scrubbing and the six synchronized captures use that selected animation only. Reloading the studio or returning from combat restores the exact selected take or Rest pose, including files with duplicate or unnamed clips.

For exports containing several motions on one timeline, expand **Create animation from range**, enter a name and start/end seconds (or use the current paused time), and choose **Save as animation**. Each named range appears in the Animation dropdown and is saved with the workspace. Removing a range preserves captured sprites and the original embedded animation.

Validation includes actual FBX parsing for multiple takes, duplicate names, empty layers and authored ranges; exact vector, quaternion and morph boundary poses; single-action playback; and browser selection, reload and same-tab combat restoration. The user's own Tripo file was not supplied for this update, so its exact embedded take structure is not yet verified.

## Candidate Rev 53 — Combat tests stay in the current tab

**Test in combat** saves the exact sprite set and return workspace, then opens Combat Setup in the current tab. It no longer creates another tab or window. A failed save leaves the studio open with its captures available.

Returning from setup or combat restores the same captured sprites and settings in that tab. Victory, defeat, and manual exit retain the direct return to the studio without a loot screen.

Validation includes the existing repository checks and a focused browser round trip confirming one tab, all eighteen captured frames, and restored studio settings.

## Candidate Rev 52 — Exaggerated scale and half-window framing

Models now use **109% of the original hex-based scale (1.09×)**. Their measured height and exported battlefield dimensions include the same adjustment. The Model size slider remains 25–2000%; source resolution and occupied hexes remain independent.

Loading a model or choosing Reset view centers its bounds at **50% of the available width or height**. The camera no longer fits the entire 75-foot ruler into the window. Automatic camera compensation still preserves the view when Model size changes.

Saved captures with layout metadata receive the scale adjustment once when reopened, without recapturing or resampling their pixels. Existing exported packages remain valid at their declared size; older recovered captures without layout metadata retain their existing scale.

Validation covers half-window framing, compatible 100/109 scale metadata, saved-capture recovery, export and combat rendering, alongside the required repository checks.

## Candidate Rev 51 — Stable model view and one Carl

Model size now compensates the main camera automatically so the model keeps its on-screen size, proportions and panned position across 25–2000%. The viewing angle and manual zoom are retained; panel resizing changes aspect without undoing the compensation. The fixed physical footprint, height ruler, height readout, and exported battlefield dimensions still reflect the selected game size. Reset view remains an explicit refit.

Dungeon Crawler Carl's sprite test now uses the one canonical player against six Kobolds. It no longer adds six cloned Carl allies. The selected collection, actual Fighter rules, equipment, pose inspector, initiative, restart, and direct studio return all use that same player. Monster, Ranger, and Mage inspection formations retain their existing behavior.

Validation checks actual Three.js projection with orbit inertia, the canonical Carl through the production setup/initiative/inspection/restart/return path, and the existing sprite/studio regression suites. Browser QA checks camera size changes after manual orbit/pan/zoom and panel resize, preserved captures, and the single-Carl combat handoff.

## Candidate Rev 50 — Giant and megabeast scaling

Candidate Rev 50 extends the Model size range to **25–2000% in 5% steps** and the Model View height ruler to **0–75 feet**. The default size remains 100%. The ruler uses the same ten-foot battlefield hex calibration and its lower-right readout measures the current posed model.

The shared scale validation now accepts the larger settings through workspace recovery, capture, ZIP export/import, and combat. Display-dimension limits also accommodate a 2000% seven-hex sprite (2880 × 2400 battlefield pixels), including preserved-frame edits in the Pixel Editor. Source resolution, PNG dimensions, and occupied hexes remain independent of Model size.

Validation covers the expanded scale bounds, 75-foot calibration, maximum-size package round trips, and Pixel Editor preservation. Browser QA checks the 2000% control, camera framing, model height, saved captures, and exported metadata.

## Candidate Rev 49 — Model height and test player sprite targets

Candidate Rev 49 starts from the promoted R238 baseline (Candidate Rev 4–48). It adds:

- A 0–20-foot ruler beside the 3D model, one-foot ticks, five-foot labels, and a lower-right live model-height readout.
- Height calibration against the game's ten-foot hexes. Current-pose mesh height includes equipment and follows model size; camera zoom and source resolution do not change it. Viewing guides stay out of captured pixels and exported sheets.
- Test player sprite targets for Dungeon Crawler Carl (Fighter), Elven Ranger (Ranger), and Baub (Mage), using the existing folder-based capture/export/import workflow.
- Friendly six-facing player inspection with original class rules and Kobold opponents. Imported player collections supply the matching test player's artwork; existing monster collections keep their prior semantics.

Validation covers exact physical calibration, actual skinned/morphed pose bounds, player registration/factories/inspection, package compatibility and the existing studio suites. Browser QA checks size, axis, animation, zoom, resolution and saved-capture restoration, plus captured-pixel parity with R238.

The sections below preserve historical QA notes; retired laboratory features are not part of the current build. See [CHANGELOG.md](../CHANGELOG.md) and [3D_STUDIO.md](3D_STUDIO.md) for the milestone and current studio workflow.


## Candidate Rev 17 — Fireball VFX Laboratory

Candidate Rev 17 adds a development-only **Fireball VFX Laboratory** inside
**Spell Previewer [DEV]**. Production Fireball mechanics and production
Fireball VFX are unchanged.

### Lab sequence

Each test runs a complete miniature Fireball presentation:

1. a white-hot Fireball projectile crosses the laboratory canvas;
2. the selected explosion renderer takes over at impact;
3. embers / sparks, smoke, heat distortion, and illumination are layered over
   the selected core technique.

### Renderer A — Stable Fluids (default)

This is the preferred research-driven experiment.

The lab runs a deliberately small bounded CPU 2D fluid field with:

- horizontal / vertical velocity fields
- temperature and density fields
- semi-Lagrangian advection
- iterative pressure projection for approximately incompressible flow
- thermal buoyancy
- vorticity confinement / curl reinforcement
- cooling and density dissipation
- a hot radial initial expansion

The simulated temperature field is mapped through a fire heat ramp:

- dark red
- red-orange
- orange
- yellow
- pale yellow / near-white at the hottest regions

Cooling density can transition toward smoke.

Available field sizes are **48×32**, **56×36** (default), and **64×40**.
They are intentionally small so this laboratory cannot monopolize the browser
main thread.

### Renderer B — Procedural / Noise

This renderer keeps a particle/metaball-style construction, but the flame body
uses coherent multi-frequency displacement, evolving heat, upward buoyancy,
temperature-based color, sparks / embers, smoke, local illumination, and
optional heat shimmer.

Its purpose is to establish how far the existing Adventure Party Canvas
architecture can be pushed without a fluid solve.

### Renderer C — Volumetric Explosion

This renderer treats the blast as one expanding irregular hot volume rather
than many independent puffs.

It includes:

- a very short white ignition flash
- noise-deformed expanding volume
- internal hot-to-cool color ramp
- four staggered sub-explosions
- a short pressure / shockwave ring
- sparks and embers
- smoke
- strong local illumination
- optional heat distortion

This is conceptually based on the common real-time technique of deforming one
explosion volume and layering secondary effects around it.

### Shared controls

- Renderer
- 2D grid size
- Turbulence
- Buoyancy
- Cooling
- Glow / illumination
- Ember density
- Smoke amount
- deterministic seed
- local heat distortion toggle
- Play Sequence / Reset / New Seed

Controls are shared intentionally so the three renderers can be compared under
roughly equivalent art-direction settings.

### Rev 17 QA focus

1. Open **Spell Previewer [DEV]** and confirm **Candidate Rev 17** appears.
2. Confirm **Fireball VFX Laboratory [DEV]** appears below the lightning lab.
3. Leave the renderer on **Stable Fluids** and play several seeds.
4. Confirm the fluid blast expands rapidly, then curls/rises instead of merely
   scaling uniformly.
5. Increase Turbulence and confirm the fluid edge becomes more rolled/chaotic.
6. Increase Buoyancy and confirm the hot volume rises more aggressively after
   the initial radial blast.
7. Lower Cooling and confirm hot colors persist longer.
8. Compare **Procedural / Noise** and confirm it remains visually coherent but
   distinctly more art-directed / particle-like than Stable Fluids.
9. Compare **Volumetric Explosion** and confirm it reads as one deforming blast
   volume with ignition flash, sub-explosions, and a brief shockwave.
10. Toggle **Local heat distortion** for each renderer and confirm the effect
    remains confined to the immediate Fireball region.
11. Test all three grid sizes in Stable Fluids and confirm the browser remains
    responsive.
12. Confirm Production Fireball in ordinary Spell Previewer playback / combat
    is unchanged.
13. Confirm Lightning Bolt, Electrical SFX Lab, and DBM Lightning VFX Lab are
    unchanged.



## Candidate Rev 16 — Elemental damage presentation + casting-audio cleanup

Candidate Rev 16 is a presentation pass only, except that Lightning Bolt's
visible discharge lifetime is extended by 50%.

### Universal casting sound removed

The reconstructed Pool of Radiance initial casting cue is now disabled for
**all spells**.

Spell-specific impact/effect sounds remain unchanged, including Fireball,
Lightning Bolt, status-application cues, and other dedicated spell audio.

The Spell Previewer uses the same rule: ordinary spell previews no longer play
the universal initial casting sound.

### Lightning Bolt persistence

Lightning Bolt's production VFX duration increases from **650 ms to 975 ms**,
exactly **50% longer**. Its DBM geometry, approved Rev 14/15 tuning, reflection
path, saves, damage, and discharge WAV are unchanged.

### Floating damage text

Damage text increases from **13 px to 16.25 px**, a **25% increase**.

Damage-type presentation is now:

- **physical / generic damage:** red
- **lightning / electricity:** rapidly flickers between white and light blue
- **acid:** green
- **fire:** orange
- **cold:** light blue with a short trailing spray of icy particles

Secondary/rider damage keeps the existing ordered combat-beat behavior. When
an elemental type is known, its elemental presentation overrides the generic
secondary-damage color.

The elemental styling is presentation-only; damage types still come from the
existing combat/spell resolution data.

### Rev 16 QA focus

1. Confirm **Candidate Rev 16** appears in the launcher and Spell Previewer.
2. Cast several different spells and confirm the universal initial Pool of
   Radiance casting cue no longer plays.
3. Confirm spell-specific impact/effect sounds still play normally.
4. Cast Lightning Bolt and confirm the bolt remains visible approximately 50%
   longer than Candidate Rev 15.
5. Confirm Lightning Bolt's DBM shape, illumination, reflection behavior, and
   selected electric-sparks WAV are otherwise unchanged.
6. Deal ordinary physical damage and confirm the floating damage text is red and
   approximately 25% larger.
7. Deal lightning/electricity damage and confirm the text rapidly alternates
   between white and light blue.
8. Deal acid damage and confirm the floating damage text is green.
9. Deal fire damage and confirm the floating damage text is orange.
10. Deal cold damage and confirm the text is light blue with an icy particle
    trail following the rising number.
11. Confirm elemental text still respects hidden-unit visibility and does not
    reveal units through LOS masking.
12. Confirm ordered direct/rider/status combat beats and turn pacing remain
    unchanged.



## Candidate Rev 15 — Lightning Bolt review fixes + final SFX

Candidate Rev 15 collects the current Lightning Bolt review changes on top of
Candidate Rev 14.

### Illumination doubled

The DBM bolt geometry itself is unchanged. Only the surrounding lighting
response is increased to **2×** its Candidate Rev 14 values:

- battlefield-wide peak flash
- broad segment illumination
- local endpoint / reflection illumination

The approved DBM geometry and core/glow tuning remain unchanged.

### Persistent AIM prompt fix

The completion-target prompt:

- **Lightning Bolt is ready: AIM in the desired line direction.**

now clears as soon as the player commits the Lightning Bolt target and spell
resolution begins. It remains persistent while AIM is genuinely awaiting input.

### Lightning Bolt casting/effect audio

- The shared Pool of Radiance casting cue is suppressed for **Lightning Bolt
  only**.
- Other spells continue to use the universal casting cue normally.
- The former synthesized generic `playMagicEffectSound("lightning")` sound is
  replaced by the user-selected WAV asset:
  `assets/audio/sfx/spells/mixkit-futuristic-electricity-sparks-2598.wav`.
- The replacement routes through the normal shared SFX gain and global audio
  toggle.

### Rev 15 QA focus

1. Confirm **Candidate Rev 15** appears in the launcher and Spell Previewer.
2. Cast Lightning Bolt and confirm the yellow persistent AIM instruction clears
   immediately once the target/direction is committed.
3. Confirm the DBM bolt itself still looks like Candidate Rev 14.
4. Confirm the battlefield illumination is visibly about twice as strong as the
   previous candidate without changing the bolt's branch/glow profile.
5. Confirm Lightning Bolt no longer plays the universal Pool of Radiance
   casting cue.
6. Confirm Lightning Bolt uses the new uploaded electric-sparks WAV for its
   discharge/effect sound.
7. Confirm other spells still use the universal casting cue normally.
8. Confirm mute/SFX controls affect the new Lightning Bolt sound.
9. Confirm wall/tree reflections, saves, half damage, immunity, repeated
   reflected exposure, and result pacing are unchanged.
10. Confirm the Lightning VFX and Electrical SFX laboratories remain available.



## Candidate Rev 14 — Production DBM Lightning Bolt + Strong Illumination

Candidate Rev 14 promotes the approved Candidate Rev 13 dielectric-breakdown
look into the **production Lightning Bolt VFX**. Spell rules are unchanged.

### Production visual profile

The production effect uses the exact approved laboratory tuning as its baseline:

- eta branchiness: **1.75**
- field: **80×45**
- potential-solver sweeps: **10**
- cell jitter: **0.38**
- glow: **1.65**
- seed: **randomized once per cast**

The DBM solve runs once per cast. Three independently jittered render variants
of that same topology are then reused as rapid return strokes, avoiding a new
field solve for each flash.

### Tactical geometry remains authoritative

The existing R232 reflected tactical ray still determines:

- initial direction and total range
- wall / solid-barrier reflections
- tree reflections
- creature exposure
- repeated reflected exposure
- friendly-fire preview
- all save / damage resolution

The DBM tree is transformed onto each already-resolved tactical ray segment as a
visual skin only. The root and terminal point are pinned to the segment
endpoints so the electrical presentation continues to hit the exact collision
points used by the rules engine.

### Strong illumination pass

The new visual presentation adds:

- a strong blue-white additive path illumination wash
- broad local light around each segment
- larger illumination bursts at reflection / impact points
- a restrained battlefield-wide flash during the strongest discharge
- brighter radial collision flashes and spark rays
- stronger tree-strike ember/splinter flecks
- three rapid return-stroke pulses followed by a fading electrical afterglow

Production spell audio is unchanged by Rev 14.

### Rev 14 QA focus

1. Open **Spell Previewer [DEV]** and confirm **Candidate Rev 14** appears.
2. Preview **Lightning Bolt** and confirm the production spell now uses the
   branching DBM appearance rather than the former sinusoidal single channel.
3. Cast Lightning Bolt several times and confirm the branch topology varies from
   cast to cast.
4. Confirm the main channel remains brightest, with dimmer secondary and side
   branches.
5. Confirm the bolt produces multiple rapid return-stroke flashes rather than a
   single smooth 650 ms sine fade.
6. Confirm the battlefield around the bolt brightens strongly during the
   primary discharge and reflection points produce larger localized flashes.
7. Test a wall reflection and confirm the bright DBM channel remains pinned to
   the exact reflected ray endpoint.
8. Test a tree reflection and confirm the tree impact receives the enhanced
   flash / spark / warm fleck treatment.
9. Confirm the 8-hex total range and remaining-range reflection behavior are
   unchanged.
10. Confirm Lightning Bolt saves, half damage, immunity handling, result pacing,
    and repeated reflected exposure remain unchanged.
11. Confirm the Candidate Rev 13 DBM laboratory is still available for further
    tuning and remains independent of the production effect.
12. Confirm other line spells / gust VFX are unchanged.



## Candidate Rev 13 — DBM Lightning VFX Laboratory

Candidate Rev 13 adds a development-only 2D lightning visual laboratory based
on the **dielectric breakdown model (DBM)** described by Theodore Kim and Ming
C. Lin in *Fast Animation of Lightning Using an Adaptive Mesh*.

This first browser trial evaluates the visual growth model before porting the
paper's full quadtree / ICCG adaptive-mesh acceleration. Production Lightning
Bolt geometry, reflection rules, damage, timing, and SFX are unchanged.

### Implemented from the paper

- A 2D electrical-potential field with the growing discharge fixed at
  `phi = 0` and the target electrode fixed at `phi = 1`.
- Repeated Laplace relaxation between growth steps.
- Candidate growth only along cells adjacent to the existing discharge.
- Paper Eq. 2 growth weighting:
  `p_i = phi_i^eta / sum(phi_j^eta)`.
- Live **eta** control from 1 to 4:
  - near 1 = dense branching;
  - larger values = progressively straighter / less branchy.
- A parent/child tree recorded as the discharge grows.
- Main channel classification by tracing the terminal strike back to the root.
- Secondary channels selected from the longest paths branching from the main
  channel; remaining growth is rendered as side channels.
- Random interior-of-cell vertex jitter to suppress visible grid regularity,
  matching the paper's jittering recommendation.
- Separate luminance/glow strengths for main, secondary, and side channels.

### Browser-lab simplification

The paper's production implementation accelerates the same DBM using a balanced
adaptive quadtree and an ICCG Poisson solver. Rev 13 intentionally uses a small,
bounded 2D field with Gauss-Seidel relaxation so the visual character can be
evaluated safely in-browser before we invest in the larger solver port.

Default work is capped at a 48×28 field, 10 potential sweeps per growth step,
and a bounded growth-cell budget. Larger 64×36 and 80×45 fields are available
for comparison but remain capped to avoid long UI stalls.

### Controls

- Generate
- Animate Growth
- New Seed
- eta branchiness
- field resolution
- potential-solver sweeps
- cell jitter
- glow amount
- deterministic seed
- optional simulation-grid overlay

### Rev 13 QA focus

1. Open **Spell Previewer [DEV]** and confirm **Candidate Rev 13** appears.
2. Confirm **Adaptive-Mesh Lightning VFX Laboratory [DEV]** appears below the
   Electrical SFX Laboratory.
3. Generate several seeds at eta 1.0–1.5 and confirm dense branching.
4. Raise eta toward 3–4 and confirm the dominant discharge becomes straighter
   and side growth decreases.
5. Toggle **Show simulation grid** and confirm the lightning remains visibly
   jittered off exact cell centers.
6. Confirm main channel is the brightest, secondary paths are dimmer, and side
   channels are faint.
7. Press **Animate Growth** and confirm the stored discharge grows from the
   left electrode toward the right target.
8. Test 48×28, 64×36, and 80×45 fields and confirm the browser remains
   responsive.
9. Confirm the ordinary Lightning Bolt spell preview and production combat
   Lightning Bolt remain unchanged.
10. Confirm the existing Electrical SFX Laboratory remains unchanged.



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
