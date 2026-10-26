# Recurve bow asset - Candidate Rev 142

The bow is published at `assets/models/weapons/bows/recurve-bow.glb` and registered as **Recurve Bow** in the existing Studio equipment selector. Selecting it uses the **Bow Weapons** action profile and the uploaded **Standing Aim Recoil** animation. The shared attachment code mounts it to the left hand; other weapons retain their existing right-hand mounts.

## Approved asset

- GLB: **1,237,464 bytes** (1.24 MB), **3,717 triangles**.
- Five embedded **512 x 512 RGBA PNG** base-color maps. Original sRGB values are preserved through resampling; the GLB receives no brightness adjustment or material change.
- Both authored morph targets remain: **Arms bend** and **String pull**. They are controls, not timed animation clips.
- Bow positions, normals, UVs, indices, morph deltas and original node transform are preserved. Source origin, scale and orientation remain authored values; the catalog configures the grip/axis/scale through the existing equipment workflow.
- SHA-256: `3314489c45b1b46ad4dc83724d2027da4e315e2119c36d5242b3192a94d964a9`.
- Metadata and color-reference measurements: `assets/models/weapons/bows/recurve-bow.json`.

## Source and cleanup

User archive: `recurve-bow.zip`, SHA-256 `86ce110727595287b4cdfb63a5db1e4677867dbb98d7121fa3afff7ec18ab692`.

Original `source/recurve bow.glb`: 5,105,876 bytes, SHA-256 `5869d8baf20cf1860b0418cd403a5d7d18346eb6a00f898f0122e60e37abefac`.

The two arrows are independent objects named `Circle.002` and `Circle.001`. `scripts/remove-bow-arrows.py` extracts the bow and prunes unused arrow data directly from glTF. The standalone asset also excludes the presentation backdrop (`Plane`, including its backdrop-only animation) and two empty scene helpers. It keeps all retained binary views byte-for-byte. The optional `--keep-scene` variant removes only the arrows and retains the scene presentation objects.

The bow-only intermediate with original 1024px textures is 3,832,872 bytes. Reducing textures to 512px saves **67.71%** against that intermediate. No polygon decimation is applied.

## Reproduction

Extract the original ZIP to a scratch directory. From the repository root, using Python with Pillow (12.3.0 was used for the verified bytes):

```sh
python -m pip install "Pillow>=11,<13"
python scripts/remove-bow-arrows.py "SOURCE_DIRECTORY/source/recurve bow.glb" work/recurve-bow-only.glb
python scripts/resize-bow-textures.py work/recurve-bow-only.glb work/recurve-bow-512.glb
```

Use a scratch output path: the resize tool emits basic derivation metadata beside its GLB; preserve the repository metadata's additional provenance and geometry hash when updating it. Compare the produced GLB SHA-256 to the approved hash above before replacing the repository asset. The removal script checks the exact source hash to avoid deleting similarly named parts from a different model.

Resampling operates on stored sRGB channels, with no linear/sRGB reinterpretation. Every retained non-image binary view is compared against its source, and decoded channel means must remain within one 8-bit level of the original. See [Spear integration](SPEAR_INTEGRATION.md) for the earlier color-export failure and why texture presence alone is insufficient.

## Validation and publication

`python scripts/test-recurve-bow.py` verifies the committed GLB checksum, topology, absence of arrow/backdrop objects, original geometry-buffer hash, both morph targets, embedded PNG dimensions and decoded color values. The existing Adventure Party Validation workflow runs this alongside the spear color regression. Blender 5.1.1 import and before/after renders verified the cleaned model and 512px textures locally.

Follow feature branch -> PR to `candidate` -> validation -> merge -> candidate publisher. Use the established binary Git blob bridge in [Spear integration](SPEAR_INTEGRATION.md) if direct push is unavailable. Compare the published GLB bytes with the committed asset; uploading a file alone does not establish publication.

## Studio equipment and mounting

Choose **Equipment -> Weapon -> Recurve Bow**. Selection clears any shield, selects the existing `bow` action profile, and chooses an uploaded clip tagged for that profile (Carl Ver 3 has Standing Aim Recoil). All uploaded clips remain selectable. Use **Weapon size** and **Adjust grip** for scale, XYZ attachment offsets and rotation. These controls, saved workspaces, six-facing captures and pose-profile JSON use the existing equipment flow.

Catalog ID and Studio ID are both `recurve-bow`. The authored bow node has an offset origin, so its scene-space grip is `[-2.91,2.17,0]`. Native scale is `0.16` (provisionally about 59 inches), hand-local position `[0,0.05,0]`, rotation XYZ `[173,12,-97]`, and primary bow axis `[0,1,0]`. The rotation was calibrated against the recovered Carl aim-pose left-hand quaternion with the bow span upright. These remain tunable defaults.

`findWeaponHand` resolves the catalog attachment hand in both Studio and the shared combat sprite renderer. The saved setting key `rightHand` is retained as the legacy weapon-slot ID for workspace compatibility; it no longer implies the physical hand. The UI labels are **Weapon** and **Shield**. A bow has no fixed secondary melee grip: its draw hand follows the authored animation, and melee off-hand IK/sliders are inactive. Existing two-handed sword/spear constraints are preserved.

The source riser material has transmission `0.0869565`. That extra transmission render pass produced ghosted/overlapping pixel atlas tiles. The bow's catalog override `{transmission:0}` is applied inside the existing shared attachment function for both Studio and combat. It keeps the GLB bytes, maps, base colors, metalness and roughness intact. No new renderer is used.

The two bow morph targets remain in the GLB, but automated string draw/release is not implemented by this equipment registration. No projectile, ammunition, damage or combat timing mechanics are changed. Capture the desired existing animation poses through the normal Bow Weapons profile.

Regression coverage includes left-hand selection (including a rig with no right hand), mount pivot under custom scale/offset/rotation, upright calibration, shield clearing, uploaded-clip selection, source textures retained by the opaque override, and preservation of melee mounts/constraints. Browser QA checks equipped poses, six previews, saved settings and a six-facing capture.
