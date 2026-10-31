# Staff, short sword and dagger — Candidate Rev 144

The three supplied weapons use the existing item catalog, Studio equipment manager, animation profiles and equipment-aware combat sprites. No MOB model, animation source, combat rule or Unit Package was replaced.

## Delivered assets

| Asset | Source triangles | Runtime triangles | GLB bytes | Embedded textures |
| --- | ---: | ---: | ---: | --- |
| Wooden Staff | 15,328 | 7,664 | 956,992 | Three 512 × 512 PNGs |
| Short Sword | 500 | 500 | 751,768 | Three 512 × 512 PNGs |
| Dagger | 960 | 960 | 674,844 | Three 512 × 512 PNGs |

The staff uses a 0.5 decimation ratio. The sword and dagger were already below 10,000 triangles, so further geometry reduction was unnecessary. Counts are rendered triangles, not untriangulated authoring faces. Archive sizes include unrelated packaging and are not equivalent to runtime model sizes.

Runtime SHA-256:

- Staff: `511a254c763dd9c1569dd181f1c72fa1ba83ef3b92bfc2b4f46517e0f773e1ed`
- Short sword: `8daf3818f735fc701116fc46c64e6888accc6b0e4735cca9f837d693c5e8dfdd`
- Dagger: `973428b17f5d233a06383d3c94338d191ecd837924cdb2fb08dd780bf19ca1e4`

`data/equipment-imports-144.json` records original archive and model hashes, extraction paths, texture roles and orientation. Adjacent runtime JSON files record geometry, file hashes, source-image hashes, dimensions and decoded channel means. Dagger provenance also checks its external `scene.bin`.

## Reproduce

Extract the supplied archives into separate directories under `SOURCE_ROOT`, checking that each ZIP member stays inside its destination:

- `staff/`: contents of `wooden+staff+3d+model.zip`, retaining the FBX and adjacent `.fbm` directory.
- `short-sword/`: contents of `splendid-short-sword.zip`, retaining `source/LowPoly.fbx` and `textures/`.
- `dagger/`: contents of `medieval_dagger_3d_model.zip`, retaining `scene.gltf`, `scene.bin`, `textures/` and `license.txt`.

Use Python with Pillow and Blender 5.1.1. From the repository root:

```powershell
python scripts/prepare-equipment-batch-textures.py SOURCE_ROOT work/batch-textures
New-Item -ItemType Directory -Force work/blender-temp,work/blender-user | Out-Null
$env:TEMP=(Resolve-Path work/blender-temp).Path
$env:TMP=$env:TEMP
$env:BLENDER_USER_RESOURCES=(Resolve-Path work/blender-user).Path
& 'C:/Program Files/Blender Foundation/Blender 5.1/blender.exe' --background --factory-startup --python scripts/optimize-equipment-batch.py -- SOURCE_ROOT work/batch-textures work/batch-output
```

The output directory contains the manifest's repository-relative asset paths. Inspect these scratch results before copying the GLBs and adjacent metadata into the repository. Repeating this export produced byte-identical GLBs for all three assets. Different exporter/library versions may encode differently; investigate changes before updating checksums.

To compare with original geometry and texture resolution, use `--reference` on both scripts and separate texture/output directories. This preserves source triangle counts and image sizes while applying the same normalization, material construction and lighting. Side-by-side renders verified blade, hilt, staff silhouette and color retention.

## Texture and importer details

Pillow LANCZOS resamples stored image channels to exactly 512 × 512. Pre-encode PNGs, then reload and pack them in Blender: albedo is sRGB; normal and metallic/roughness are Non-Color. Roughness goes in G and metallic in B. The staff and sword use separate original maps; dagger already has a packed map. The staff's unused 4096px `rm.PNG` is not substituted for the separate 1024px maps bound by its FBX. The sword's maps were 4096px and dagger's 1024px. No brightness multiplier or material tint is added.

Tests decode the actual GLB image slots and compare with independent source measurements (within one 8-bit level per channel). This guards against the previous spear linear/sRGB export darkening. Source albedo means:

- Staff: `[118.986546,68.645033,38.896955]`
- Short sword: `[142.488402,136.108681,130.475160]`
- Dagger: `[124.007340,122.960238,126.297522]`

The short-sword FBX includes presentation lights. Blender 5.1's FBX importer accesses the removed Cycles light `cast_shadow` property. The script temporarily substitutes a placeholder light reader and restores it in `finally`; only the selected equipment mesh is exported. It does not edit Blender's installation. `use_image_search=False` avoids a recursive filesystem search because materials are reconstructed from explicit texture paths.

Apply normalization through object transforms so custom split normals rotate with the vertices. Explicitly set `rotation_mode='XYZ'` before assigning Euler rotation: glTF imports may use quaternion mode and otherwise silently ignore the Euler correction. Update the view layer before reading imported world transforms. Regression tests check actual POSITION bounds, normals and identity node transforms.

## Studio integration

All assets are normalized to unit length along glTF **+Y**, with bottom/pommel at 0 and staff top/blade tip at 1. The source sword points along Blender -X and the source dagger along Blender +Y; do not assume all imported assets share an axis.

| Selection | Existing rule ID | Profile / initial uploaded clip | Hands | Native scale | Primary grip | Secondary grip |
| --- | --- | --- | ---: | ---: | --- | --- |
| Wooden Staff | `staff` | `two-handed-swing` / Great Sword Idle | 2 | 0.925 | `[0,0.42,0]` | `[0,0.62,0]` |
| Short Sword | `sword-short` | `one-handed-thrust` / Stabbing | 1 | 0.39 | `[0,0.14,0]` | — |
| Dagger | `dagger` | `one-handed-thrust` / Stabbing | 1 | 0.205 | `[0,0.18,0]` | — |

The staff is bludgeoning; the sword and dagger follow their existing piercing rules. All mount to the right hand with position `[0.015,0.05,0.005]`, XYZ rotation `[-90,0,0]` and initial size 100%. Approximate calibrated lengths are 72, 30.3 and 15.9 inches. These are tunable defaults, not authored real-world dimensions or perfect grips for every frame.

Staff selection clears a shield and uses the existing melee secondary-grip solver. The one-handed blades can retain a shield. All 13 newly uploaded Carl animations remain available. Scale, rotation, attachment offsets, staff off-hand offsets, pose capture and workspace persistence use the established controls. Asset hashes invalidate equipment-aware sprite caches; the recovered Carl animation recipe is unchanged.

Dagger credit: **Mordius**, CC BY 4.0. Preserve `assets/models/weapons/daggers/LICENSE-Mordius.txt`, `ATTRIBUTIONS.md`, and the original author/source/license fields retained in the GLB `asset.extras`. Both game and Studio expose the existing attribution document through an Asset credits link. Source archives for the staff and sword did not supply corresponding attribution files; their provenance is recorded without inventing a license.

## Validation and publication

Run every command in `.github/workflows/adventure-party-validation.yml`, including `python scripts/test-equipment-batch-assets.py`. Coverage includes actual triangle counts, 512px embedded image slots, decoded source colors, UVs/normals, unit +Y geometry, hashes, credits, adjustable shared mounts, automatic clip/profile selection, shield handling and appearance cache identity. Existing model/animation/Unit Package checks remain required.

Local Windows validation passed 70 of 71 Node commands; the existing sprite-package symlink test requires permissions unavailable on this host. Run it unchanged in Linux CI and require the complete workflow to pass before merge. Existing spear, bow and crossbow image regressions also pass.

Use feature branch → PR to `candidate` → passing validation → merge → candidate publisher and Pages deployment. The native blob bridge documented in [Spear integration](SPEAR_INTEGRATION.md) transfers local binary bytes if ordinary Git push credentials fail. Verify blob hashes and complete tree equality before creating the remote commit. After publication, compare live GLBs and changed modules byte-for-byte with the merged candidate, then test all three selections, animation playback, adjustable scale persistence and six-facing capture on the published Studio.

## Candidate Rev 145 follow-up

[Wizard Staff Grip and blade visibility](WIZARD_STAFF_AND_BLADE_VISIBILITY.md) records the dedicated one-handed staff equipment/action profile and the short sword/dagger material adaptation. Blade texture pixels and geometry remain unchanged; current sizes/hashes and reproducible export settings are in the follow-up. Keep the original two-handed staff behavior and source-color regression checks.
