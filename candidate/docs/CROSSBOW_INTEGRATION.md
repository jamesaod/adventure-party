# Crossbow integration - Candidate Rev 143

The optimized crossbow is registered as **Crossbow** in the existing equipment catalog and Studio selector. It uses the **Direct Fire Weapons (Crossbow)** action profile and the uploaded **Rifle Aim To Down** animation. No renderer, combat system, MOB model, animation source or Unit Package is replaced.

## Source and result

User archive: `crossbow.zip`, **48,483,986 bytes**, SHA-256 `82433296c046f554dac864529740f2a18b1f1e567da584a3af55f6779bfe3838`. Its `source/crossbow.zip` contains `crossbow.FBX` and duplicates of the external textures. Extract that nested archive into the outer `source/` directory. Use the outer `textures/` maps: their decoded pixels agree with the nested copies.

Source FBX: **395,520 bytes**, SHA-256 `9df0fe0254720f5dfb227f2a8c5f0ca8fec24a0fa966d06368feba086388b4b0`.

| Part | Source triangles | Optimized triangles |
| --- | ---: | ---: |
| Crossbow body | 8,904 | 4,006 |
| String (`rope`) | 1,620 | 404 |
| Trigger/lever (`Object001`) | 116 | 116 |
| Metal hardware (`Rope-Metal`) | 152 | 152 |
| Total | 10,792 | 4,678 |

The result has **56.7% fewer triangles**. All four parts and their UVs remain. Blender decimation ratios are 0.45 for the body and 0.25 for the string; the small mechanical parts retain their original triangle counts. A side-by-side source/optimized render verified the silhouette and visible details.

Runtime asset: `assets/models/weapons/crossbows/crossbow.glb`, **1,030,700 bytes** (1.03 MB), SHA-256 `505c542372cee565a1a267476ec44d63b5ada0dd956d4b393c03c16fa847c6c8`. A comparable full-geometry, 4096px reference GLB was 24,792,420 bytes; the runtime file is about 95.8% smaller. The original ZIP size includes duplicate texture files and is not an equivalent GLB comparison.

## Reproduce the optimization

Python with Pillow prepares the textures; Blender 5.1.1 performs geometry reduction and GLB export. Run from the repository root after extracting both archives as described above:

```powershell
python scripts/prepare-crossbow-textures.py SOURCE_DIRECTORY work/crossbow-textures-512
New-Item -ItemType Directory -Force work/blender-temp,work/blender-user | Out-Null
$env:TEMP=(Resolve-Path work/blender-temp).Path
$env:TMP=$env:TEMP
$env:BLENDER_USER_RESOURCES=(Resolve-Path work/blender-user).Path
& 'C:/Program Files/Blender Foundation/Blender 5.1/blender.exe' --background --factory-startup -t 2 --python scripts/optimize-crossbow.py -- SOURCE_DIRECTORY work/crossbow-textures-512 work/crossbow.glb
```

Inspect and validate the scratch result before replacing the repository asset and adjacent metadata. The optimizer checks the source FBX hash. Different Blender or Pillow versions can produce different encoded bytes; update recorded hashes only after checking the result.

All four 4096px source maps are resampled with Pillow LANCZOS to 512px. The GLB embeds three lossless PNGs: albedo, tangent-space normal, and packed metallic/roughness (roughness in G, metallic in B). No AO map was supplied. Albedo is sRGB; the normal and metallic/roughness images are linear data. Images are saved first, reloaded and packed into Blender so the glTF exporter retains the encoded colors instead of exporting incorrectly interpreted floating-point pixels. No brightness multiplier is introduced.

Source albedo mean RGB `[124.6568,105.2559,96.3301]` becomes `[124.6567,105.2547,96.3286]`. The metadata records source hashes and channel measurements. Source brightness, normal and PBR channel regressions run against the actual embedded GLB images.

## Mount and animation

Choose **Equipment -> Weapon -> Crossbow**. Selection clears any shield, chooses `direct-fire`, and selects the uploaded clip tagged for that profile. Carl Ver 3 has **Rifle Aim To Down**. All other uploaded clips remain selectable.

The asset is normalized to length 1, glTF **+Z forward / +Y up**. Source Blender +X pointed forward. Apply rotation/scale as an object transform so authored split normals rotate with the geometry. Shared mount defaults: right hand, grip `[0,-0.015,0.30]`, native scale `0.42` (provisionally 32.6 inches), position `[0.015,0.05,0.005]`, XYZ rotation `[-87,29,0]`, size 100%. Rotation was calibrated using Carl's independently recovered rifle-aim hand quaternions and the line between the two hands. Keep scale, XYZ grip offsets and rotation adjustable through the existing controls and saved equipment settings.

The uploaded direct-fire animation supplies the support-arm pose. As with the recurve bow, the crossbow does not invoke the melee body/finger IK solver; its secondary melee-grip sliders are disabled. This preserves the authored aim and lowering motion. These are tunable defaults, not a claim that every frame on every rig has a perfect grip.

The asset has no skin, embedded animation or morph targets. This registration adds no firing, bolt, reload, damage or ammunition mechanic. Capture desired poses through the existing profile workflow.

## Validation and publishing

Run all commands in `.github/workflows/adventure-party-validation.yml`, including `python scripts/test-crossbow-asset.py`. The crossbow checks cover actual triangle counts and four preserved parts, UV/normal attributes, embedded 512px PBR slots, source color values, checksum, shared right-hand mounting, adjustable grip, upright aim, shield clearing, direct-fire clip selection and equipment-aware appearance recipes. Existing MOB, animation and Unit Package integrity checks remain required. On restricted Windows hosts, the sprite-package symlink test runs in Linux CI; do not weaken it.

Use feature branch -> PR to `candidate` -> passing validation -> merge -> successful candidate publisher and Pages deployment. Use the verified native Git blob bridge from [Spear integration](SPEAR_INTEGRATION.md) when Git push credentials are unavailable. Compare live GLB bytes and changed modules to the merged commit, then check selection, animation playback, scale persistence and six-direction capture on the published Studio.
