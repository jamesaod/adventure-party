# Orc Leader, Male, Uniformed — Candidate Rev 164

`orc-leader-male-uniformed` is a new selectable model in 3D Studio / Pixel Studio and MOB Creator. It reuses the Male Orc import recipe, shared renderer, 22 uploaded FBX clips, editable equipment mounts and existing Unit Package export. The stable `male-orc` and archived Orc identities remain intact. This is a model catalog addition; existing combat MOB definitions and pose libraries are unchanged.

## Source and preserved runtime asset

- Archive: `orc leader+3d+model.zip`, 11,515,384 bytes; SHA-256 `bbe4360c4070fcaeb0462d8db20694c8df047f06394d951aed99677d44c8203c`.
- FBX: `tripo_convert_0f898e57-ea78-4732-b917-0b13598f8f8a.fbx`, 6,162,480 bytes; SHA-256 `6be98c41dcba5d9a9b7200a0433bbb79eb68a84a346777074c6adc6eb4033057`.
- Color PNG: 5,462,216 bytes, 2048 × 2048; SHA-256 `572bcee73f8860208f8232feb531ece12086d22195de34795cb697a031b8ae27`.
- Runtime: `assets/models/orcs/orc-leader-male-uniformed/orc-leader-male-uniformed.glb`, **6,083,572 bytes**; SHA-256 `8d51b1f56bfd57c796fc5bcda54430e9da1eae837a2280e116e3ab66473d4fd4`.
- Geometry: **11,451 triangles**, 5,832 source vertices, one skinned mesh, **65 Mixamo bones**.

Original topology, UVs, skin weights, texture resolution and encoded PNG bytes are preserved. Normalize the FBX armature's 0.01 scale while checking that the mesh world transform and every bone's world bind pose remain unchanged. The existing opaque, nonmetallic base-color material keeps source colors. Do not apply the archived Orc experiment's retarget mode: use the recovered `world-bind-delta` / `scaled-world-y` animation recipe.

## Reproduce

Extract the supplied FBX and matching `.fbm/Color.png` directory without changing relative paths. Use Blender 5.1 with a task-local `BLENDER_USER_RESOURCES` directory on Windows:

```sh
blender --background --factory-startup --python scripts/import-orc-leader.py -- SOURCE_DIRECTORY assets/models/orcs/orc-leader-male-uniformed/orc-leader-male-uniformed.glb
python scripts/generate-carl-animation-reference.py --target assets/models/orcs/orc-leader-male-uniformed/orc-leader-male-uniformed.glb --output scripts/fixtures/orc-leader-uploaded-animation-reference.json
node scripts/test-orc-leader-model.mjs
node scripts/test-male-orc-model.mjs
node scripts/test-fbx-animations.mjs
```

The reference generator requires numpy/scipy. When using task-local Python packages, set `PYTHONPATH` to their directory and `PYTHONPYCACHEPREFIX` to a scratch directory. Pin source hashes in the importer; verify original PNG bytes after GLB export. Append the model to `models` and `studioModelIds` in `data/studio-models.json` so archived combat fallback ordering stays stable. `animationLibrary: uploaded-fbx` and `initialAnimation: Sword And Shield Idle` reuse existing code. MOB Creator consumes the same filtered catalog.

## Original Rev 163 Orc equipment calibrations

Rev 163 assigned both models the same three `weaponAttachmentProfileIds`. **Rev 164 removes these opt-ins from the Leader for comparison with Carl.** The regular `male-orc` retains the calibration below. Off-hand and shield controls keep their existing settings.

| Primary equipment | Position XYZ | Rotation XYZ (degrees) |
| --- | --- | --- |
| One-handed: sword, axe, short sword, dagger, wizard staff, sling | -0.020, 0.050, 0.005 | 161, -46, 15 |
| Two-Handed Sword | -0.045, 0.065, 0.060 | -114, -16, -30 |
| Spear (100% weapon size) | -0.010, 0.030, -0.060 | 100, 77, -43 |

Choose the weapon or press **Reset grip** to apply the model profile. Older custom workspace values are preserved; reset and recapture deliberately when replacing them. The existing export records actual per-pose equipment snapshots. All offsets, scale and secondary-grip controls remain adjustable.

## Acceptance

All **110 skinned reference poses** for the Leader's 22 clips pass with maximum joint error **0.6434 degrees** and hip error **3.33e-8** native units. Carl, Scale Mail Woman and the first uniformed Orc references remain valid. Integrity tests verify source/GLB texture hashes, triangle count, unit-scale joints, selector membership and shared grip IDs. The existing profile resolver test exercises exact spear values on both Orc models and preserves other model/weapon defaults and custom grips.

A brief local browser check loaded the Leader with **20/20 humanoid roles**, all 22 animations, exact spear slider values and six rendered facing previews. Bayonet Stab at **0.98 seconds** rendered without browser errors. The 155% model scale used for inspection is a local QA preference, not a new global default. Use `3d-studio.html?model=orc-leader-male-uniformed&poseLibrary=humanoid-medium` for an isolated workspace. Detailed pose/placement QA remains with the user. Require candidate CI before merge and verify the published GLB and changed text files byte-for-byte after Pages deployment.

## Rev 164 — Carl equipment defaults for Leader QA

The Leader now uses the same global per-weapon mount defaults as Dungeon Crawler Carl Ver 3. Remove only the Leader's `weaponAttachmentProfileIds` from `data/studio-models.json`; do not copy its custom Orc values into the global equipment catalog. The regular Orc keeps all three approved profiles. This is a catalog-only change: assets, rigs, animations, pose libraries and runtime code remain unchanged.

Reload Studio, select Orc Leader, then choose the weapon or press **Reset grip** to apply Carl's defaults. Previously saved custom grips remain intact until explicitly reset; recapture any poses whose equipment changes. Off-hand and shield defaults already use the same shared equipment paths as Carl. Existing resolver checks verify both Carl and Leader against every global weapon preset, while retaining the regular Orc's exact calibrated values.

## Rev 192: axe blade roll and Leader hand basis

The regular Orc axe adds a 90-degree local shaft twist to Rev 191: `Q191 * axisAngle(normalize([4,5,0]), 90deg)`. Shaft direction and grip position stay fixed. The Leader uses a separate axe profile: `inverse(QLeaderHandBindWorld) * QOrcHandBindWorld * QOrcAxe`; apply the same hand-basis delta to the grip position. Read neutral world quaternions from each GLB hierarchy, not bone names alone. This overrides Carl defaults only for the Leader axe. Other weapons and custom saved settings remain unchanged. Reload and Reset grip for Battle Axe to adopt new defaults. Local Studio QA checked neutral/idle and slash placement; regression checks cover roll, shaft direction and both actual GLB hand bases.
