# Male Orc model — Candidate Rev 161

`male-orc` / **Male Orc** is available in 3D Studio / Pixel Studio and MOB Creator through the existing `data/studio-models.json` catalog. It shares all 22 uploaded FBX animations and initially selects Sword And Shield Idle. The existing model scale, orientation, primary/off-hand equipment, shield and grip controls remain available.

This is a new model identity. The archived `male-orc-fighter` and other Orc assets remain unchanged. The new entry is appended to `models` so existing first-match Orc combat fallback selection is preserved. Its ID is appended to `studioModelIds`, alongside Carl Ver 3 and the Scale Mail Woman. MOB Creator reads this same filtered catalog; no new renderer, rig adapter, combat factory or Unit Package is introduced.

## Source and runtime

- Supplied archive: `orc+3d+model.zip`, 11,682,820 bytes, SHA-256 `b2ba66853edcd1376e73daa419fcdd59de8d23c77704969c847143aed6752f25`.
- Source FBX: `tripo_convert_1df28fa1-4fa6-4e96-b710-45dbfb88080b.fbx`, 6,243,840 bytes, SHA-256 `fa547b8ceb0d0ff61dc9dc5fdd8af59fe3249b476cc1c342759c5ec9a39f2ee0`.
- Source texture: matching `.fbm/Color.png`, 5,547,583 bytes, 2048 × 2048, SHA-256 `2a5772ceaac1a449e3039dbd18a41c6b1b8a137ae5a9010994e0b7c94cea3528`.
- Runtime: `assets/models/orcs/male-orc/male-orc.glb`, **6,162,940 bytes**, SHA-256 `e02aea9d2b721ee67f1fb8c9b794b2812aa3c450dd9bfacfdce81ed79ba91335`.
- Geometry: **11,519 triangles**, 5,794 source vertices, one skinned mesh and **65 Mixamo bones**. Export may split vertices along UV/normal seams.

Original topology, UVs, skin weights and encoded texture are preserved. This model import does not downsample or recolor its 2048px texture. The material uses the established opaque base-color setup with metallic 0 / roughness 1. Runtime provenance is recorded in the adjacent `male-orc.json`.

## Reproduce the conversion

Extract the two archive entries while retaining the `.fbm/Color.png` relative path, then run Blender 5.1:

```sh
blender --background --factory-startup --python scripts/import-male-orc.py -- SOURCE_DIRECTORY assets/models/orcs/male-orc/male-orc.glb
```

The importer reuses the Scale Mail Woman workflow. It pins input hashes, ignores presentation lights, imports the FBX, and applies the armature object's 0.01 centimetre scale. This normalizes bone units for the existing metre-based equipment mounts while asserting unchanged mesh world transforms and each bone's world rest position/orientation. Only mesh and armature are exported, Y-up, without embedded motions. The original encoded sRGB PNG is embedded and checked byte-for-byte; do not resave it through Blender's floating-point image pipeline. Use a task-local `BLENDER_USER_RESOURCES` directory on Windows.

## Animation acceptance and QA

Use the existing uploaded-animation loader's explicit `world-bind-delta` / `scaled-world-y` recipe. Do not infer that the archived Orc experiments' joint-relative mode is correct for this new upload. Reproduce the independent pose fixtures with Python, numpy and scipy:

```sh
python scripts/generate-carl-animation-reference.py --target assets/models/orcs/male-orc/male-orc.glb --output scripts/fixtures/male-orc-uploaded-animation-reference.json
node scripts/test-male-orc-model.mjs
node scripts/test-fbx-animations.mjs
```

All **110 real skinned poses** (five authored sample times for each of 22 animations) match the recovered independent evaluator. Maximum joint error is **0.6435 degrees**, with maximum hip error **4.29e-8** native units, within the unchanged tolerances. Existing Carl and Scale Mail Woman references still pass unchanged. The new integrity test checks the GLB checksum, topology, unit-scale rig, texture bytes, catalog entry and unchanged legacy Orc fallback ordering.

Browser QA uses an isolated URL such as `3d-studio.html?model=male-orc&poseLibrary=humanoid-medium`, preserving the user's normal Studio workspace. Check the textured idle, sword/shield, two-handed stab with spear, and six facing previews. Pose selections and fine grip adjustments remain user-authored. Run repository validation, merge a candidate PR only after CI passes, and compare the published GLB bytes/hash after Pages finishes.

Rev 161 browser QA confirmed 20/20 humanoid roles, textured Standing Idle, Sword And Shield Idle with both props, and Bayonet Stab at 0.98 seconds with the spear. The 155% inspection scale is a local QA setting, not a new default. Six Ready facings captured successfully in the isolated workspace; the browser reported no errors. Male Orc also appears in the MOB Creator model selector.
