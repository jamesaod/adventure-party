# Local combat environment experiment

## Tree fire research / scorch cleanup — November 5, 2026

Scorched-ground lighting fix: the cached material-dependent char image is now sampled in the GPU floor shader before direct local lighting/radiance. Previously its Canvas overlay covered the already-lit floor, suppressing the visible tree-fire light. The GPU route skips that duplicate overlay; the CPU reference keeps its prior ordering. Source radii/intensity, char marks/edges and gameplay lighting remain unchanged. Real WebGL readbacks verify scorched terrain brightens under spell/fire radiance and that scorch uniforms do not leak into later surfaces; lighting/rendering/scorch/boundary regressions pass.

Free audio candidate found (not downloaded or integrated): [fire crackling loop.wav — soundofsong, Freesound #650574](https://freesound.org/people/soundofsong/sounds/650574/). The source page lists a looped outdoor fire recording, duration 5.030 seconds, stereo WAV, 44.1 kHz / 16-bit, CC0. Download requires a Freesound login. License and metadata verified on the source page; no listening-quality or seamlessness claim beyond its author's loop description. OpenGameArt also lists a CC0 Fireplace Sound loop, but its detail page returned 403 in this session, so Freesound is the verified candidate.

GPU-particle experiment implemented: `combat-tree-fire-particles.mjs` replaces the simple point sprites with one bounded instanced-quad flame/ember pool. Flames use two-octave value-noise shaping, curved tongues, upward drift, varied size/lifetime/phase, yellow cores and orange/red edges; sparse embers have longer upward travel. This is procedural particle shading, not a fluid simulation or a new flipbook asset. Stable tree-mesh anchors are cached by sample set/instance phase, with the correct Three.js Y rotation, and reused while GPU time animates the particles. The existing 192-particle per-tree cap, 2,048 shared budget, depth test/painter integration, 30 FPS scheduler, two-round burn, black foliage, fire-light sources and charred aftermath remain. There are no extra fire lights or render loops. A quad costs two triangles rather than one point; unchanged particle count does not guarantee unchanged GPU time, especially with larger overlapping flames.

Validation: `test-tree-fire-particles.mjs` checks bounded counts, seeds, cached/stable anchors, empty/low-budget behavior and disposal. `scripts/fixtures/tree-fire-particles.html` compiles the real shader, reads animated flame pixels, and renders it through the production fir-tree path; the internal browser passed with no errors. Shared runtime, WebGL and module-boundary tests pass. Visual tuning and multi-tree performance remain user QA.

Removed pale ash coloration from the ground scorch bake; material-dependent dark char and irregular soft boundaries remain. Wall scorch no longer varies its coverage with small noisy light flecks; average char strength and the outer feather remain. Wall clipping/occlusion and production WebGL checks pass. The initial research/scorch-cleanup pass did not change flames; the subsequent particle implementation is described above.

Current fire uses GPU point sprites sampled around actual tree meshes, with procedural flame/ember shapes. Candidate upgrades:

- Animated textured/flipbook particles or noise-shaped flame quads: retain GPU animation and mesh-based emission, add coherent upward tongues, varied size/phase/lifetime, separate sparse embers/smoke. My recommended first comparison because it extends the existing particle path. [Particle-Based Real-Time Flame Rendering, Mabuchi et al., 2011](https://www.jstage.jst.go.jp/article/iieej/40/4/40_4_541/_article/-char/en) supports the broader particle-rendering approach; flipbook animation is a production option, not a claim about that paper's specific algorithm.
- Procedural volumetric fire: curve-deformed volumes, noise and a fire profile create true spatial depth without solving combustion fluids. [Fuller et al., Real-time Procedural Volumetric Fire, 2007](https://web.cs.ucdavis.edu/~hamann/FullerKrishnanMahrousHamannJoyFirePaperFor_I3D2007AsSubmitted11012006.pdf). A small number of crown/branch flame volumes would be an adaptation for our trees; screen coverage, slices and noise octaves need measurement.
- GPU fluid simulation + volume rendering: simulate flow/buoyancy and render the resulting fire/smoke field. Higher implementation, memory and fill-rate cost; not the recommended initial browser experiment. [GPU Gems 3, Chapter 30](https://developer.nvidia.com/gpugems/gpugems3/part-v-physics-simulation/chapter-30-real-time-simulation-and-rendering-3d-fluids). Old published FPS is not a prediction for our current hardware or WebGL renderer.
- Tree-aware combustion is a separate behavior layer: [Pirk et al., Interactive Wood Combustion for Botanical Tree Models, SIGGRAPH Asia 2017](https://storage.googleapis.com/pirk.io/projects/fire_trees/index.html) models connected branch particles, surface combustion, moisture/charring, fuel consumption and branch motion. Borrow progressive ignition/fuel weighting without importing their complete physics system; keep the current two-round gameplay duration unless changed by the user.

Performance guidance: [GPU Gems 3, Chapter 23, High-Speed Off-Screen Particles](https://developer.nvidia.com/gpugems/gpugems3/part-iv-image-effects/chapter-23-high-speed-screen-particles) explains transparent overdraw and reduced-resolution particle targets. In our renderer, any soft-particle/low-resolution composite must explicitly respect shared painter ordering/occlusion; a complete world depth buffer is not automatically available. Keep one small light set per tree rather than one light per flame, preserve current red/yellow/orange lighting and black burning foliage, and benchmark several simultaneously burning trees. Costs above are engineering assessments, not measured results.

Not published yet. Both standalone Combat Test and exploration encounters load the same environment-action script after the existing attack/result wrappers.

- In AIM with a bow/crossbow equipped, click an empty hex to shoot. The existing ammunition, range and shots-per-round budget applies. The first wall or pane on the trajectory intercepts the shot.
- Break Window spends one attack when adjacent. Enemy AI can do the same when a window blocks its line to a hostile. Broken panes retain their frame, admit missiles, and remain impassable. Glass was already transparent to gameplay LOS/light; shattering does not reveal hidden enemies.
- Glass shatters into 24 fading shards using the existing frame scheduler. The user-selected replacement glass recording plays once per pane, respecting the sound toggle. See ATTRIBUTIONS.md and the bundled license.
- Fireball marks only the wall face exposed to its blast. Feathered soot modifies the existing wall texture in the current GPU surface pass; no shadow maps or extra render loop.
- All spell and missile targeting rejects hexes beyond intact panes before the action is committed. The pane’s own hex remains a valid environmental target. Broken panes allow targeting through the opening. Fireball also shatters exposed panes, and its immediate spillover hexes beyond each pane receive half the original roll, then their normal save for half. A unit is resolved once at its greatest exposure. Spillover does not recursively break more windows.
- Missed arrows stop at walls or fall beyond their target and remain as capped encounter-local decoration (256 maximum). Near armor deflections fall at the target.
- Firing into melee chooses the actual recipient before the attack roll, with size weighting. This can select an ally. The optional Stray arrows (test) checkbox is a separate house rule, OFF by default: at most one creature farther along the resolved missed trajectory receives a separate attack roll at −6, with ordinary armor and missile protections. It never consumes another arrow.

Environment damage is encounter-local in this experiment; it does not modify the editor source or save a campaign destruction history.

## Validation

Browser checks exercised live WebGL shader compilation and wall rendering, OGG decoding, an empty-hex arrow breaking the pane, projectile/movement parity after breakage, ammunition and shot accounting, persistent ground arrows, blast spillover/one-sided soot, adjacent breaking and the optional stray-hit path. Existing startup, edge geometry, spell-results and renderer regression checks also apply.

Wall Test now has seven windows across its north wall. Invalid window-blocked targets show a red aim outline, no area preview, an INVALID — INTACT WINDOW label, and a disabled Cast button. LOS and illumination still pass through glass.

Wall scorch correction: affected hex polygons clip the actual wall spans. There is no neighbouring-hex padding or whole-section expansion, and the shader feathers inward only. Stone soot now uses the floor’s neutral colour and 0.75 strength / 0.68–0.92 opacity modulation, retaining the masonry detail.

Wall scorch endpoint fades use the floor mask’s .88-hex radius / .52 transition width (about 0.46 hex), fading inward from the exact clipped boundary. This softens the outer wall/hex junction without expanding the blast.

Equipment rule: every humanoid uses the same catalogue-backed equipment behavior, independent of identity, faction or repository registration. Only explicit class/race eligibility rules may exclude equipment. The legacy missile sync helper no longer contains a repository/player identity gate. Carl’s bow and 20 arrows are a standalone combat-test starting loadout, not a special bow-use implementation.

Local follow-up after checkpoint b792dbd: physical arrows use narrow white vanes along a black shaft. Presentation-only arrow shadows project from the shared solar direction and scene scale onto ground or the receiving wall face, with a six-height horizon cap and no solar shadows at night or indoors. Focused tests cover reversed sun direction, ground/wall receivers, night suppression and existing visibility/missile invariants. These follow-up changes have not been pushed.

Arrow blood local prototype: damaging bow/crossbow hits emit 8–12 ballistic droplets at the direct damage presentation beat (including optional stray-arrow hits). Misses, Mirror Images and protected shots emit none. Droplets stop at nearby architecture and settle once into encounter-local terrain stains. Grass uses broken flecks; hard floors use connected spots. Per-hex 128px stamps rebuild only when drops land, inherit floor brightness, clip to friendly LOS and stay below scenery and units. Storage is capped at 768 settled marks and 16 live bursts; a new battle clears the effect. The existing transient scheduler owns animation.

Blood spread update: droplets now sample a uniform 360-degree direction and a 0–1.5-hex radius with Beta(1,3) falloff (quadratically declining radial probability). Nearby marks are common, maximum-range marks rare. Wall clipping and encounter-local persistence remain.

Blood now applies to all shared physical attacks: melee (including sweep, reaction and natural attacks), bows/crossbows and slings. The physical damage beat emits one burst; elemental riders and fire/acid/cold/electrical/magical/poison damage do not. Physical damage admission is centralized in AdventurePartyCombatResults.physicalHit. The melee extraction audit records this intentional post-extraction feature change.

## Local fire-sword / tree-audio pass (environmentTest=53)

- Replaced the three fixed victim flames and jumping square motes with continuous curved flame tongues, soft additive glow, and rising embers. Secondary damage beat timing remains unchanged.
- Flaming Sword +5 alone retains projected mounted-weapon bounds per generated pose/facing. Its live flame overlay follows those capture coordinates; other swords remain unchanged. Small orange light uses existing shared lighting sources. Flame overlays use Canvas presentation, not a new GPU particle pass.
- Burning trees share one decoded CC0 fire loop but each has its own looping BufferSource, gain, stereo position and random start offset. Distance attenuation follows the controlled party actor; aggregate gain is moderated for groups. Voices stop on burnout, mute or leaving combat. No autoplay bypass.
- The source is soundofsong's Freesound 650574 public HQ MP3 preview; provenance is in ATTRIBUTIONS.md. Original WAV requires login.
- Existing 30 FPS combat scheduler drives flames; guarded scheduling avoids a duplicate transient callback when a frame requests animation.
- Targeted module/runtime/rendering/lighting tests and tree-audio lifecycle tests passed. Internal-browser combat startup passed without console errors. Full visual flame/audio balance remains for user QA; no repo push.

### Equipped-sword blackout correction (environmentTest=54)
The new sword source accidentally supplied a CSS hex string instead of the shared RGB-array contract. GPU packing called color.map and aborted rendering. Corrected to [255,128,28]. Regression test exercises actual illuminationSources output through packCombatLights, including equip/unequip and ordinary-sword exclusion. Internal-browser inventory equip now retains the battlefield with no console errors.


### Sword-side occlusion and carried light (environmentTest=55)
Seven blade anchors now test camera rays against the actual posed body/shield during sprite generation; hidden anchors do not emit visible flame overlays. No per-frame model raycasting. The combat adapter excludes its automatic party lantern; authored torches and explicit spell/item lights remain. Flaming Sword +5 supplies warm RGB light with three-frequency torch-like flicker. Tests cover front/rear blade depth, lantern removal, shader color transport and updated no-lantern exposure caching.


### Sword illumination range and visual scale (environmentTest=56)
Corrected height to heightMetres:1.1 (previous unrecognized height field caused 2.2m fallback). Radius is three hexes with stronger warm flicker, putting ground well inside the Euclidean light volume. Blade flame width/height now scale with captured sprite draw height instead of fixed pixels, including enlarge and facing changes. Regression checks validate nontrivial ground radiance and changing intensity over time.


### Sword light sway (environmentTest=57)
Raised Flaming Sword source intensity from 2.2 to 3.3 (50%). Added smooth independent source sway up to 3.5cm on each horizontal axis and 2cm vertically. GPU lighting and projected shadow emitters consume the same offset and source height; source ownership remains intact, so the sword bearer does not cast a shadow from its own light. Gameplay source hex/LOS and cached occlusion mask bounds stay fixed. Tests cover bounded varying offsets, fixed gameplay location and exact brightness multiplier.


### Unit illumination correction (environmentTest=58)
Sprite shader now incorporates local spell/fire radiance before linear-to-display brightness conversion, consistent with its physical-light path. Former display-space addition left dark baked sprites underlit relative to floors. Neutral artwork hue, corpse saturation and source-art brightness cap remain. Browser GPU readback fixture verifies a nearby sword raises a dark unit red channel by more than 35 display levels while preserving its red/green ratio and brightness cap. Existing WebGL and GPU-lighting tests pass.

### Blade-only sword flames (environmentTest=60)
Inspected medieval-sword GLB geometry: grip at x=.34, crossguard approximately x=.20–.30, blade tip at x=-.50. Added explicit asset-local flame span from [.17,.109,0] to [-.48,.109,0]. Flame anchors now use this span instead of whole-weapon bounds, preserving existing pose projection and body/shield occlusion. Targeted tests verify the production endpoints exclude the guard and handle. Local change after repo checkpoint 8558c6f.

### Direct physical attack target focus (environmentTest=61)
Melee now centers its defender before windup, shared by ordinary attacks, extra attacks and melee reactions. Successful bow/sling hits explicitly center targets even when already on-screen; misses retain target focus and protected bow/sling misses now focus on arrival too. The off-screen-only helper remains the default for other callers, preserving spell presentation. Targeted camera-policy, missile, reaction and module-boundary checks pass.

