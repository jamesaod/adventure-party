# Recurve bow asset - Candidate Rev 142

The prepared bow is published at `assets/models/weapons/bows/recurve-bow.glb`. This is the approved asset after arrow removal and texture reduction. Equipment-catalog registration, bow-hand grip calibration and animation/morph wiring are separate from this asset publication; the existing Studio model and equipment offerings remain unchanged.

## Approved asset

- GLB: **1,237,464 bytes** (1.24 MB), **3,717 triangles**.
- Five embedded **512 x 512 RGBA PNG** base-color maps. Original sRGB values are preserved through resampling; no brightness adjustment or material change is applied.
- Both authored morph targets remain: **Arms bend** and **String pull**. They are controls, not timed animation clips.
- Bow positions, normals, UVs, indices, morph deltas and original node transform are preserved. Source origin, scale and orientation remain authored values; a future equipment mount should configure its grip/axis/scale through the existing equipment workflow.
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
