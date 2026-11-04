# Orc Shaman, Female — Candidate Rev 176

Model ID: `orc-female-shaman`. Appended to `data/studio-models.json` and Studio offerings; MOB Creator uses the same catalog. Existing models, combat factories and their fallback ordering remain intact. The shared 22-clip uploaded-FBX library uses `world-bind-delta` and `scaled-world-y`; do not substitute archived Orc retargeting experiments.

Source archive: `Orc+female+shaman+3d+model.zip`, 1,896,822 bytes, SHA-256 `a027775e48f7046f99391679e5461fff4e60f5b678f01d09fba5aee097266cc6`. Extract keeping the FBX and its `.fbm/Color.png` relative paths. Run:

```sh
blender --background --factory-startup --python scripts/import-orc-female-shaman.py -- SOURCE_DIRECTORY assets/models/orcs/orc-female-shaman/orc-female-shaman.glb
python scripts/generate-carl-animation-reference.py --target assets/models/orcs/orc-female-shaman/orc-female-shaman.glb --output scripts/fixtures/orc-female-shaman-uploaded-animation-reference.json
node scripts/test-orc-female-shaman-model.mjs
node scripts/test-fbx-animations.mjs
```

Use Blender 5.1, task-local `BLENDER_USER_RESOURCES`, and numpy/scipy for the reference generator as documented for the earlier Orc imports. Normalize centimetre armature scale while asserting unchanged world bind matrices. Preserve topology, skin weights and original encoded PNG bytes.

Runtime GLB: 1,349,808 bytes, SHA-256 `0c12d8e3c8a63e53b34372fcfd9486f8701b51ed26538b2986abf315a7fb671b`. Geometry is 13,094 triangles / 7,143 source vertices. The texture already is 512×512. All 65 source Mixamo bones remain; Blender adds `neutral_bone` for unweighted vertices, making 66 exported skin joints. Preserve this neutral bind support rather than dropping vertices or inventing weights. Source/runtime hashes are also in the adjacent metadata JSON.

All 110 independently evaluated animation poses pass: maximum joint error 0.6440 degrees, hip error 3.88e-8. Browser check loads all 22 animations and 20/20 humanoid roles. Default equipment is the same shared catalog used by Carl and Orc Leader; no unrequested model-specific grip calibration is applied. Final visual pose/grip tuning remains user QA.

## Batched equipment controls and visibility

Primary, off-hand and shield XYZ position sliders now display offsets from the hand in fixed world axes. `equipment-adjustments.mjs` transforms a world-axis edit through the inverse hand world matrix and saves the existing hand-local vector. Rotation/scale and bone animation still work normally; equipment follows the hand after scrubbing and in all six facings. Old saved mounts are not reinterpreted, migrated or reset. Shield retains distance, forearm slide and roll controls in addition to XYZ. This is an editor-coordinate conversion, not a new attachment system.

Two-Handed Sword and Round Wooden Shield declare material overrides in the item catalog: metallic factor 0.15 and linear color gain 1.4. The same attachment path applies them in Studio and combat. The original GLB, texture bytes, normals and mounts remain unchanged; the bow's existing opaque-material override is preserved. New renders reflect brightness; previously captured PNGs retain their original appearance until recaptured.

`test-studio-batch176.mjs` checks explicit-pose priority, all fallback cases, stale-image/assignment status separation, exact single-axis motion under rotated and nonuniformly scaled parents for all three equipment slots, saved-mount round trips and brighter materials. Run repository validation before merging and verify published asset bytes after Pages finishes.
