# Character Creator — free Quaternius workshop

Open `character-creator.html` from the title menu or the MOB Workshop header.
Choose a male/female family, Ranger/Peasant preset, individual torso/arms/legs/feet,
optional hood/shoulders, hair/beard, two outfit palettes, and tints. Hoods hide hair.
Preview Idle, Walk and Jog, pause/scrub, orbit, and inspect the shared skeleton.
Save multiple named browser designs, import/export editable JSON, or export a
textured rigged GLB with all three clips. Open the GLB in MOB Workshop using
Load model file; this does not automatically create or publish a combat MOB.

## Actual free inventory

The publisher's storefront describes the full collection, but the downloaded
Standard license explicitly says it contains only a portion of the assets.
The actual archive supplies 20 modular parts (male/female Peasant and Ranger),
four complete reference outfits, and two available palettes per outfit family.
No wizard robe or cloak is in this free archive. No purchase was made.
The matching free Universal Base Characters contains two Superhero bases and
six rigged hair/beard meshes. Heads were derived from those bases by retaining
head/neck triangles above 1.48m male / 1.43m female within 0.15m of the center.
Unused body vertices are excluded from head primitives; original archives remain
untouched in the authoring workspace. Only original deep skin is offered because
the free outfit hands do not include matching light skin textures.

## Rig and export

`character-creator-core.mjs` assembles selected meshes onto the body's 65 bone
objects by exact name, preserving each skin's inverse bind matrices and weights.
It rejects missing bones and invalid/cross-family design parts. Clothing meshes
remain separate for modularity. Additional mesh materials are cloned per assembly.
Only this curated compatible asset family is supported; this is not an arbitrary
Tripo fitting or auto-rigging tool.

Quaternius UAL1 Idle/Walk/Jog donors use true skin bind poses and local rotation
deltas, retaining target proportions. Pelvis vertical motion is scaled by height;
horizontal travel is removed for in-place preview. This adapter is limited to the
Quaternius rig family. It does not alter the game's existing retargeter.

GLTFExporter and SkeletonUtils are vendored from Three.js 0.180.0 to match the
existing engine (MIT license retained in assets/vendor/three/LICENSE).
Export restores rest transforms before serialization and restores playback after.
All selected skins reference one shared bone hierarchy, with embedded textures and
three animation clips. Textures larger than 1024px were downsampled using Windows
System.Drawing bicubic interpolation; filenames retain source-image hash keys.

## Sources and provenance

- https://quaternius.itch.io/modular-character-outfits-fantasy
- https://quaternius.itch.io/universal-base-characters
- https://quaternius.com/packs/universalanimationlibrary.html
- CC0 license copies and original archive SHA-256 hashes are in
  `assets/characters/quaternius/` and `catalog.json`.
- The catalog is separate from controls so additional properly prepared compatible
  parts can be added later. Paid content is neither present nor downloaded.

## Validation

Run `node scripts/test-workshop-character-creator.mjs` with Node 24.
The test loads actual geometry with texture loading omitted, checks every referenced
image/buffer, validates presets, shared bone identities and rest deformation,
samples animated vertices on all four presets, and exports/reloads four GLBs.
Browser texture decoding and appearance remain separate from these numeric checks.
Mixed seams, hair fit, and animation appearance require user visual review.
No combat consumers were changed. Keep this work local until asked to publish.

Verified on 2026-11-17: 55,065 animated vertex samples; four rigged GLB round trips;
browser male/female switching, mixed torso/limb parts, hair, alternate palette,
save/load, textured GLB download, and import of that GLB into MOB Workshop with
all three embedded clips. No browser warnings/errors were reported. Syntax,
title-audio and Workshop-project tests passed. The existing game-script-loader
test fails on the pre-existing `js/repository-mobs.mjs?v=scored-ai1` URL because
its assertion only accepts R238C-number cache tokens; this same URL is in the
pre-change index backup. That unrelated cache naming issue is not changed here.
