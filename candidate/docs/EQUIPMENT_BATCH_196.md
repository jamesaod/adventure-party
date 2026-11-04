# Weapon batch — Candidate Rev 196

Nine user-supplied weapons use the existing item catalog, Studio equipment manager, capture profiles and combat renderer. Existing models, animation sources, Unit Packages and weapon assets are retained. Stable IDs remain unchanged for the display renames Medieval Sword → Long Sword, Wizard Staff Grip → Wooden Staff 1, Recurve Bow → Bow.

| Weapon | Source triangles | Runtime triangles | GLB bytes | Capture profile |
| --- | ---: | ---: | ---: | --- |
| Trident | 1,136 | 1,136 | 359,968 | two-handed-thrust |
| Scimitar | 787 | 787 | 215,340 | one-handed-swing |
| Broadsword | 174 | 174 | 98,580 | one-handed-swing |
| Lucerne Hammer | 4,498 | 4,498 | 466,808 | two-handed-swing |
| Mace | 894 | 894 | 303,360 | one-handed-swing |
| Morning Star | 12,762 | 4,800 | 334,952 | one-handed-swing |
| Flail | 70,426 | 4,800 | 416,084 | one-handed-swing |
| Club | 576 | 576 | 183,384 | one-handed-swing |
| Horse Head Staff | 449,994 | 4,800 | 595,680 | wizard-staff-grip |

Every embedded texture is 256 × 256; the hard limit is fewer than 5,000 rendered triangles per weapon. Assets already below this limit retain geometry. Morning Star, Flail and Horse Head Staff target 4,800 triangles. Flail is a rigid prop retaining the hanging chain; no chain physics is added. Horse Head Staff's separate scan display base is excluded. Its fragmented scan surface is joined and welded before decimation.

## Reproduction

Extract each uploaded ZIP into a separate SOURCE_ROOT folder named by `sourceKey` in `data/equipment-imports-196.json`. Preserve directories. Check that all archive paths resolve inside the extraction folder before extracting. Broadsword and Morning Star have nested RARs (Windows tar can extract these); Flail has a nested ZIP. The manifest records source and archive hashes, chosen files, final axis direction, provisional length and grip.

Run with Python/Pillow and Blender 5.1.1:

```text
python scripts/prepare-weapons-196.py SOURCE_ROOT TEXTURE_ROOT
blender --background --factory-startup --python scripts/optimize-weapons-196.py -- SOURCE_ROOT TEXTURE_ROOT OUTPUT_ROOT PREVIEW_ROOT
python scripts/test-weapons-196.py
node scripts/test-weapons-196.mjs
```

OUTPUT_ROOT receives repository-relative paths. Copy verified GLBs and adjacent JSON metadata into the repository. PREVIEW_ROOT is optional. On this Windows host, set TEMP/TMP and BLENDER_USER_RESOURCES to an existing writable scratch directory. The Mace source is a single static ASCII FBX; the importer reads its polygon corners and UV indices directly because Blender rejects ASCII FBX. Other sources use the established FBX/glTF importers. No source animation or rig is required for these rigid attachments.

Pillow LANCZOS resizes encoded channels before Blender loads and packs them. Albedo stays sRGB; normal/metallic/roughness maps use Non-Color. Scimitar's DirectX normal map has its green channel inverted for glTF. Metallic response is scaled to 0.25 for visibility, without tinting or darkening albedo. Tests decode the actual embedded albedo and compare channel means against the prepared pixels, in addition to file hashes, triangle counts, UVs and texture dimensions.

All new assets normalize shaft/length to local +Y with the tail at zero. PCA determines the source axis; Flail uses the handle mesh rather than the hanging chain. Preview review fixes the signed axis for Broadsword, Lucerne Hammer and Horse Head Staff. Roll around shaft, independent base XYZ, world-axis position controls, scale and copyable grip JSON continue through the shared equipment system. New Orc Leader presets reuse the corresponding calibrated +Y blade, staff or spear hand frame. Regular Orc's new one-handed +Y assets transfer the approved sword frame without overwriting legacy profiles. Grips are starting points for user QA, not a guarantee against clipping in every animation.

Trident uses two-handed thrust; Lucerne Hammer uses two-handed swing and the existing generic pole-arm rules; Horse Head Staff uses the existing one-handed staff profile. New blades, mace, morning star, flail and club use one-handed swing and are also offered off-hand. Both two-handed weapons retain shield/off-hand exclusion. Existing capture profile IDs are reused; no new animation copies or pose groups are required.

Club retains Asylum Nox CC BY 4.0 credit. Horse Head Staff retains Turku Museum Centre's original notice; the repository owner explicitly confirmed separate permission to optimize and publish it on 2026-10-29. Other archives supplied no license file; provenance is recorded without inventing a license.

Run the repository workflow validation before merge. Local Windows sprite-package tests can hit the existing sandbox EPERM; unchanged Linux CI must pass. Publish through a PR to candidate and verify live asset bytes against the tested tree. Existing custom grips remain authoritative; Reset grip adopts the catalog defaults.
