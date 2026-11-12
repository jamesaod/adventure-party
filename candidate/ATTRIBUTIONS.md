# Third-Party Asset Attributions

Adventure Party includes or uses the following third-party art assets.

## Handpainted Stone Floor Texture

- **Title:** Handpainted Stone Floor Texture
- **Creator:** PamNawi
- **Source:** https://opengameart.org/content/handpainted-stone-floor-texture
- **License:** Creative Commons Attribution 4.0 International (CC BY 4.0)
- **License URL:** https://creativecommons.org/licenses/by/4.0/
- **File used:** `assets/terrain/stone-floor-pamnawi.png` (vendored byte-for-byte from `StoneFloorTexture.png`) (the original PamNawi version, not the later Nicoto-corrected variant)
- **Use/modifications:** The source bitmap is used as a repeating indoor-floor material. Adventure Party scales the texture to 17.5%, projects the repeating tile into the battlefield's axial/isometric floor plane at runtime, and then applies normal in-engine lighting/overlays. No source-pixel repainting is performed by this project.
- **Attribution:** “Handpainted Stone Floor Texture” by PamNawi, licensed under CC BY 4.0.

The attribution above is not intended to imply that PamNawi endorses Adventure Party or its developers.

## Medieval dagger 3d model

[Medieval dagger 3d model](https://sketchfab.com/3d-models/medieval-dagger-3d-model-b41c89d1740845d9999e53b7ff8983f1) by [Mordius](https://sketchfab.com/Mordius), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

- **File used:** `assets/models/weapons/daggers/medieval-dagger.glb`
- **Modifications:** PBR textures reduced to 512 x 512; orientation and length normalized for adjustable equipment attachment; all 960 source triangles retained. Candidate Rev 145 reduces the material metallic factor to 0.25 for clearer appearance under game lighting; embedded texture pixels are unchanged.
- **Original notice:** `assets/models/weapons/daggers/LICENSE-Mordius.txt`. Author, source and license also remain embedded in the GLB metadata.

## Sling - Candidate Rev 146

[Grab3D Sling](https://grab3d.com/models/weapons/sling/), by Grab3D, [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/).

- File: `assets/models/weapons/slings/sling.glb`.
- Modifications: folded into a hanging held shape; normalized scale; three PBR maps resized to 512 x 512. All 9,512 triangles and original UVs retained.
- Source license and provenance: `assets/models/weapons/slings/grab3d-LICENSE.txt` and `grab3d-manifest.json`.

## Club

Model Information:
* title:	Neolithic Stone Club
* source:	https://sketchfab.com/3d-models/neolithic-stone-club-4a14743e04cd46b9b5075af5997cc439
* author:	Asylum Nox (https://sketchfab.com/peter.pottiez)

Model License:
* license type:	CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)
* requirements:	Author must be credited. Commercial use is allowed.

If you use this 3D model in your project be sure to copy paste this credit wherever you share it:
This work is based on "Neolithic Stone Club" (https://sketchfab.com/3d-models/neolithic-stone-club-4a14743e04cd46b9b5075af5997cc439) by Asylum Nox (https://sketchfab.com/peter.pottiez) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)
Modified: normalized grip orientation, reduced geometry and 256px textures.

## Horse Head Staff

Model Information:
* title:	TMK 21816:KP14913 shamaanin sauva - Shaman staff
* source:	https://sketchfab.com/3d-models/tmk-21816kp14913-shamaanin-sauva-shaman-staff-a4399b18b844429ba3b7e1074e57ceff
* author:	Turku Museum Centre - Turun museokeskus (https://sketchfab.com/turunmuseokeskus)

Model License:
* license type:	CC-BY-NC-ND-4.0 (http://creativecommons.org/licenses/by-nc-nd/4.0/)
* requirements:	Author must be credited. No commercial use. Modified versions can not be distributed.

If you use this 3D model in your project be sure to copy paste this credit wherever you share it:
This work is based on "TMK 21816:KP14913 shamaanin sauva - Shaman staff" (https://sketchfab.com/3d-models/tmk-21816kp14913-shamaanin-sauva-shaman-staff-a4399b18b844429ba3b7e1074e57ceff) by Turku Museum Centre - Turun museokeskus (https://sketchfab.com/turunmuseokeskus) licensed under CC-BY-NC-ND-4.0 (http://creativecommons.org/licenses/by-nc-nd/4.0/)
Modified: normalized grip orientation, reduced geometry and 256px textures. Repository owner confirmed separate permission to optimize and publish (2026-10-29).

## Shield, Orc

User-supplied `SM_Wep_Shield_Set_54.fbx` and `Shield_Optimised_01.png` (2026-10-29). Red/black design selected by the repository owner. Original author/license metadata was not supplied. Modified: atlas crop and front UV remap, plain wood/iron backing materials, normalized shared shield frame and 256px runtime texture; 622 triangles preserved. See docs/SHIELD_ORC.md.

## Outdoor grass test textures (Rev 246)

`assets/textures/exploration/grass-short-v1.png` and `grass-worn-v1.png` were generated for this project with the built-in image_gen tool on 2026-11-01. Original generated PNGs are preserved without pixel edits. Exact prompts, dimensions and SHA-256 checksums are recorded in `assets/textures/exploration/grass-generation-v1.json`. Short grass is the experimental Outdoor / sky floor material; worn grass is retained for comparison.

## Combat result pixel font

Press Start 2P, Copyright 2012 The Press Start 2P Project Authors
(cody@zone38.net), Reserved Font Name "Press Start 2P".
Vendored unmodified from https://github.com/google/fonts/tree/main/ofl/pressstart2p
and distributed under SIL Open Font License 1.1. The complete copyright/license
is included at assets/fonts/press-start-2p-OFL.txt.


## Dirt paths and grass fringe (Rev 258)

`assets/textures/exploration/dirt-path-v1.png` and `grass-fringe-v1.png` were generated for this project with the built-in image_gen tool on 2026-11-02. Original PNGs are preserved, including the fringe alpha channel. Generation prompts, dimensions and checksums are in `assets/textures/exploration/terrain-transition-generation-v1.json`. A shared runtime alpha mask composes these with the existing short grass material; it is generated from neighbouring terrain rather than baked into each hex.

## TreeIt fir battlefield artwork

The five fir variants derive from the fir sample in EVOLVED's TreeIt sample library.
Source and credit — EVOLVED / evolved-software, https://www.evolved-software.com/treeit/treeit
The supplied library license permits commercial copying and modification with attribution. Its original text is preserved at assets/terrain/treeit-firs/SAMPLE-LICENSE.txt and calls itself Creative Commons Attribution International without specifying a version.
Changes include randomized seeds and scale, a second rotated foliage layer, green tint, interior shading, and twelve rendered rotation views per tree. Ground shadows are rendered separately from the actual branch and foliage-card geometry with filtered edges.

## Window-breaking sound

`assets/audio/sfx/environment/kenney-glass-break.ogg` is the unmodified `impactGlass_heavy_000.ogg` from Kenney’s [Impact Sounds](https://kenney.nl/assets/impact-sounds), licensed CC0. The original license is preserved alongside it as `KENNEY-LICENSE.txt`.

## Selected replacement glass sound (local test)

`assets/audio/sfx/environment/glass-break-selected.wav` derives from the user-selected “Glass Breaking Sound Effect HD | Glass Shattering Sound Effect” by Car Features: https://www.youtube.com/watch?v=TcnufvBffcY . Leading/trailing silence was trimmed (source 0.734104–4.078521 seconds); converted to 48 kHz stereo PCM WAV. This replaces the Kenney sound for the current local test. No CC0 license is claimed for this replacement.

## Burning-tree fire loop
“fire crackling loop.wav” by soundofsong, Freesound 650574, CC0. Game uses the public HQ MP3 preview. Source: https://freesound.org/people/soundofsong/sounds/650574/ — https://creativecommons.org/publicdomain/zero/1.0/

## Exploration sky panoramas (CC0)
Local 2048×1024 JPEG derivatives of Poly Haven's tonemapped equirectangular panoramas.
- Clear Noon: Qwantani Noon (Pure Sky), Greg Zaal / Jarod Guest — https://polyhaven.com/a/qwantani_noon_puresky
- Sunny Clouds: Kloofendal 48d Partly Cloudy (Pure Sky), Greg Zaal / Jarod Guest — https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky
- Clear Morning: Autumn Field (Pure Sky), Sergej Majboroda / Jarod Guest — https://polyhaven.com/a/autumn_field_puresky
License: https://polyhaven.com/license (CC0). Sky artwork selection does not replace authored ambient lighting.

## User-provided UI and title audio
- `assets/audio/sfx/ui/page-open.wav` — supplied as Inventory_Close_01.wav, requested for page/panel opening.
- `assets/audio/sfx/ui/page-back.wav` — supplied as Inventory_Close_02.wav, requested for closing/back navigation.
- `assets/audio/music/arcane-dust.wav` — supplied as 068_Arcane_Dust.wav, requested as the looping title-screen track.
These files were supplied by the project owner for integration. Source licensing was not independently established in this pass.

## Tileable Grass Textures — Set 1
- Author: **Cethiel**
- Source: https://opengameart.org/content/tileable-grass-textures-set-1
- License: **CC0 1.0 Universal** — https://creativecommons.org/publicdomain/zero/1.0/
- Local assets: `assets/textures/grass-cethiel-set-1/Grass_01.png` through `Grass_04.png`, and their matching `Grass_01_Nrm.png` through `Grass_04_Nrm.png` normal maps.
- Original PNG files retained unmodified; used as selectable battlefield grass materials. The website preview is not used.

## Snow footsteps - qubodup
Four dry snow steps by Iwan (qubodup) Gabovitch, CC0-1.0.
Source: https://opengameart.org/content/4-dry-snow-steps
License: https://creativecommons.org/publicdomain/zero/1.0/
Runtime: assets/audio/sfx/snow/step-1.wav through step-4.wav. Original FLACs and author note are retained alongside them. Trimmed silence, normalized peaks to 0.7 and converted to mono 16-bit PCM WAV. SOURCE.json records exact sample rates, trim bounds, gains and original/output SHA-256 hashes.
