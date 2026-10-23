# Reproducible Tripo GLB → Mixamo FBX animation bake (Carl + Orc)


## Candidate Rev 112: anatomical direction + vertical hips test (visual QA pending)

Rev 111 visual feedback: joint-bind-relative transfer keeps arms on approximately the
right anatomical sides, but the animation remains chaotic. World delta also fails.
We extracted **the exact repository-identical New Carl and New Orc source GLBs** and
the 17-clip saved carrier data; source SHA-256 checks match the catalog.

**Confirmed structural differences:** Carl has outstretched arms in a T-style bind
pose; Orc has noticeably lowered arms, closer to A-pose. Actual bind world
quaternion discrepancies for the right shoulder, right upper arm, and right
forearm are approximately **156.8°, 176.5°, and 140.8°** respectively.
Thus 65+ matched Mixamo names are not evidence of interchangeable joint axes.

**Confirmed missing runtime motion:** Rev 111's Three.js runtime retargeter
transferred rotations but dropped the source's hips translation. In the selected
2.33-second `Mixamo_sword_and_shield_attack`, Carl's hips significantly
rise and fall; pinning hips causes crouches and airborne actions to deform.

The **New Orc — Bone Direction + Hip Motion (QA)** option in the same Model Library:
1. Loads the exact original, animationless `new-orc.glb`, unchanged.
2. Loads the existing Carl 17-clip baked GLB as a source carrier, but selects only
   `Mixamo_sword_and_shield_attack`, the identical clip used in Rev 111.
3. For each matching bone/child pair, rotates Orc's **bind-space physical bone
   direction** to match Carl's animated bone direction in the anatomically
   corrected world frame. This handles local axis discrepancies without
   rewriting Orc skin weights or bind matrices. Unpaired terminal bones
   retain the legacy joint-relative motion as a diagnostic fallback.
4. Retains **Y-axis hips translation**, scaled by target/source bind hips height,
   while intentionally discarding horizontal XZ travel for sprite capture.
5. Records the number of anatomically aimed bone roles and translation transfer
   in clip diagnostics. New CI tests use the actual Carl and Orc Tripo GLBs to
   check the mismatched rest frames and direction transfer.

This is a *controlled experiment*, not a guarantee of correct twists or mesh
deformation: aligning bone directions leaves the **roll/twist around each bone
axis** underconstrained. Real-time human visual QA of all three axes, joints,
mesh sleeves/thighs, and equipment is mandatory before further clips are processed.

Research references: <https://github.com/upf-gti/retargeting-threejs/blob/main/docs/Algorithm.md>
and <https://dev.epicgames.com/documentation/en-us/unreal-engine/ik-rig-animation-retargeting-in-unreal-engine>.
Both emphasize matching source and target retarget reference poses.

## Candidate Rev 111: controlled retarget diagnosis (human QA required)

Two new Model Library entries provide a controlled A/B comparison on the **same untouched**
`assets/models/orcs/new-orc/new-orc.glb`. They do **not** edit the source GLB,
skin weights, inverse binds, node rotations or repository-backed Rev 110 baked outputs.

- **New Orc — Carl Animation / World Delta (QA)**: `animatedSourceWorld × inverse(sourceBindWorld)`,
  converted by the anatomical rig basis `C`, then left-multiplied onto the Orc target bind.
  This parallels the offline 17-clip bake's rotation transfer.
- **New Orc — Carl Animation / Joint Relative (QA)**: `inverse(sourceBindWorld) × animatedSourceWorld`,
  right-multiplied after the Orc target bind. This is the older live Three.js formula.

Both options use precisely the same **already baked Carl GLB** as their animation carrier,
`new-carl-mixamo-sword-shield-full-17.glb`, and import its single
`Mixamo_sword_and_shield_attack` clip. We intentionally test **one clip** to avoid
generating more potentially broken derived assets. The comparison explicitly supports
UUID-addressed glTF animation tracks, in addition to named Mixamo tracks. The variants
appear in Studio's normal Model Library; no asset downloads or new uploads are needed.

**QA order:** Load **New Carl — All 17 Sword & Shield Animations (QA)** and play
`Mixamo_sword_and_shield_attack` as the known comparison source; then load the **Rev 110
baked Orc** and play the matching clip; finally load each of the two **Rev 111 Orc QA**
entries. Scrub at 0%, 25%, 50%, 75%, and 100% while facing front, sides, and rear.
Keep equipment unequipped for the initial check. Record whether arms remain on their
correct anatomical sides, shoulder orientation is natural, and thighs do not move with
arms. Only after the naked model passes should sword and shield sockets be evaluated.

**Decision rule:** If only one formula renders a correct Orc, prefer that formula for
this donor/rig family, then rerun a fully validated offline bake separately. If neither
works, stop and investigate joint rest-frame axes, transforms, and skinning rather than
continuing arbitrary left/right switches or changing Carl. Automated regression checks
verify mathematical modes, clip availability, provenance, and original Orc isolation;
they **cannot** certify the absence of visual arm crossing.


**Status: Candidate Rev 110 — 17 clips each baked for Carl and Orc, structurally verified; human visual Studio QA still PENDING.**

The complete, non-destructive 17-motion production scripts are now `scripts/bake_mixamo_pack_v2.py` and `scripts/tripo_mixamo_bake_core.py`. They take a pristine Tripo GLB, Mixamo X Bot reference FBX, and the original 17 sword/shield motion FBXs; use world/bind deltas and animated-parent local rotations; sample full-duration motions at 60 FPS; and remove horizontal XZ hip motion for stationary sprite capture. Python dependencies are `numpy` and `scipy`. Inspect usage with `python scripts/bake_mixamo_pack_v2.py --help`; inputs are third-party source files and are not downloaded by Studio. Verified full-bake outputs and their per-clip `provenance.json` reports are in:
- `assets/models/dungeon-crawler-carl/new-carl/mixamo-sword-shield-full-17/`
- `assets/models/orcs/new-orc/mixamo-sword-shield-full-17/`

All original Tripo data and binaries are preserved as separate Model Library entries. Never automatically mark new clips production-approved until their complete motions have been visually reviewed on both characters.


This document is the permanent development record for reproducing the original successful Carl-style animation import. Do **not** declare an animation family production-ready based only on load success or finite geometry.

## What went wrong in Rev 107

The new GLBs are Tripo-exported Mixamo-skeleton humanoids, just like the previously working Carl. However, Rev 107 sends each external Mixamo FBX through `js/mixamo-retarget.mjs` **at runtime**. This is *not* the original successful Carl pipeline. In the runtime version, a source/target anatomical basis correction was measured but not applied to the per-joint rotation; arbitrary FBX root/hip translation tracks were dropped. An apparent matching bone name is not evidence that bone bind frames or local rotation axes match. Bad target poses can still produce formally valid Three.js clips.

The successfully reviewed Carl UAL2 integration instead used `scripts/retarget-carl-ual2.py` for an offline, source-preserving world/bind-delta bake into a *separate* GLB. See `assets/models/dungeon-crawler-carl/README.md`.

## Tested source inputs for the new Carl proof

- Target: user-provided `New DCC.glb` (Tripo / Mixamo-style, 65 skin joints, no embedded clips); SHA-256 `07fd945a1c9d08690b4619c997d700b2989d238c2b0cf68674ca0cc898962156`.
- Reference: `X Bot.fbx` from `Lite Sword and Shield Pack.zip`; SHA-256 `7cda48832cd2e612224c08f75269b7dea5731fa0d798abada6040fee94002e29`.
- Motion: `sword and shield attack.fbx`; SHA-256 `ef639b9ef713e80c538278c111af7fe8d93d1b61f32931af144e7f82eb5767a3`.
- Original source GLB, older Carl models and Orc assets must remain unchanged.
- The **1-second in-place QA cut**, which limits runaway locomotion during the first sprite-studio check, is an experimental short proof rather than approval of the entire original FBX take.

## The exact adaptation algorithm

1. Inspect both glTF JSON and FBX metadata **before touching animation**. Verify the GLB header, skin joint list, inverse-bind matrices and bone hierarchy. Verify that the donor motion and `X Bot.fbx` have matching names and compatible *world-space* reference poses. Refuse mismatches, missing bones, unsupported FBX rotation orders, unexpected transforms or non-finite values.
2. In a **binary FBX 7700 reader**, evaluate every bone's default local and animated transforms. For this pack, the FBX rotation evaluator must use XYZ Euler and `R_local = R_pre × R_animated × inverse(R_post)`, with parent transforms evaluated recursively. Crucially, the intuitive reversed Euler convention originally placed hands above the head: a correct reference T-pose is a required acceptance test. FBX translations are in a different scale from Tripo GLB; calculate the target-to-source hips height ratio.
3. From the reference FBX, obtain each joint's **world reference orientation** `S_bind[j]`. At 60 FPS, sample the source motion and obtain `S_motion[j,t]`. Construct `D[j,t] = S_motion[j,t] × inverse(S_bind[j])`.
4. Derive right, up and forward from semantic shoulders, hips and head in each model's *reference pose*; calculate the source-to-target orientation `C`. Convert source world deltas to target anatomical space as `D_target = C × D × inverse(C)`.
5. Preserve the target's existing world bind orientation `T_bind[j]`. The animated world orientation is `T_world[j,t] = D_target[j,t] × T_bind[j]`.
6. Convert back to local quaternions using the **animated parent world orientation**: `T_local[j,t] = inverse(T_world[parent(j),t]) × T_world[j,t]`. Enforce quaternion hemisphere continuity across frames. Do not copy foreign donor local joint quaternions onto the Tripo joints.
7. Transfer the hips translation **deliberately**, converting coordinates and scale. For stationary combat actions remove horizontal travel (or trim to a defensible in-place segment) and preserve only physically plausible vertical movement. Do not blindly include forward walk/run travel in stationary attacks.
8. Append glTF animation accessors, buffer views, samplers and channels into a **new** self-contained GLB. Copy the original BIN chunk as an *exact prefix* and leave existing nodes, meshes, materials, textures and inverse-bind matrices untouched. Name the new clip distinctly. Record hashes and source selection in a provenance report.
9. Check exact source preservation, normalized quaternion tracks, matching rotation joint count, root/hip displacement, bone anatomical placement and at least 15 uniformly spaced frames of CPU-skinned geometry. Check rest-pose skin error and reasonable body bounds, plus all 6 Studio facings.
10. **Human visual QA in Studio is the acceptance gate**: inspect rest/T-pose first, then the 1-second clip with no gear, then sword/shield attached; scrub attacks frame-by-frame. Inspect feet, knees, thighs, hands, shoulders, shields and any fabric around them. Do not process other clips or new characters until this passes.

## Rev 108 QA proof

- Output: `new-carl-sword-shield-attack-inplace-proof.glb`; output SHA-256 `208cc1fd496346aa035fdd83b56f1540d464a8efc2d7a40d9f633f47c7a7f392`.
- Embedded clip: `Mixamo_Sword_Shield_Attack_InPlace_QA`; **1 second, 60 FPS, 65 joint quaternion tracks + 1 hip translation track**.
- Audited GLB vertex count 13,168; maximum original rest skin deviation about `3.21e-7` units; 15 sampled animation poses had finite deformation, head above hips and bounded geometry.
- Rotations were baked offline rather than calling runtime `retargetHumanoidClip`.
- Original New Carl source and previous models are preserved. This GLB is a separate binary **available as a ChatGPT testing artifact**, not automatically installed in the public GitHub catalog due to binary transfer constraints.

### Tester instructions

1. Open the **Candidate 3D Studio** and select **Load from device**. Choose the **baked GLB proof**, not the Rev 107 local combined QA pack.
2. Start with **T-Pose** (no equipment) to verify the untouched original source skeleton and body. Check `Model's up direction = Y`.
3. Select `Mixamo_Sword_Shield_Attack_InPlace_QA`, scrub from 0.00 to 1.00s without equipment, compare all six directions.
4. Only after that, add the sword and shield and inspect attachment sockets. These are separate from retargeting QA.
5. Report whether the pose and body deform correctly; **stop here if not**. Do not test the Orc or auto-retarget another 16 FBX clips until this single baked proof is visually approved.

## Rules for every future Tripo humanoid

Preserve the untouched uploaded GLB in `assets/models/<character>/<version>/` and catalog it as an animationless reference. Save each derived, approved animated GLB under a separate sibling path and record original hashes, bind diagnostics, clip names, author/license, export scale/axis and proof screenshots. Use configuration/catalog entries for model identity, height, equipment, animation family and calibrated sockets. Never silently replace source assets or apply broad skin-weight corrections to bypass animation mapping errors. Require review on both Carl and an independent Orc before declaring a generic family pipeline solved.

**Next milestone:** human approves New Carl's single baked clip; then incorporate and document the full offline command-line baker and the 17-clip workflow in the repository, rather than preserving an unreviewed inference as a production rule.
