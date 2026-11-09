# MOB pipeline audit and deferred cleanup — 2026-11-06

User wants the following remembered; broad cleanup is deferred while testing walking.

1. MOB Creator sprite previewer is deprecated. Remove its automatic calls and controls; preserve height/pose/equipment authoring and Studio links.
2. Replace frozen complete loadout packages with reusable rigged characters, pose libraries, and independent socket-mounted equipment.
3. Validate actual dependencies in encounter readiness (currently it can pass despite missing prepared equipment combinations).
4. Seven current prepared packages total about 241 MiB compressed. Deduplicate geometry/textures/poses before sacrificing quality.
5. Classify production, experimental, and legacy catalog records; canonical IDs with migration aliases. Keep gameplay definitions independent of visuals.
6. Replace image-object identity bridge with explicit visual instances. Outline/shadow consumers still require migration.
7. Use content hashes/revisions, one scale/ground-origin authority, explicit GPU resource disposal and memory budgets.
8. Batch compatible direct unit rendering passes while preserving environmental occlusion; consume shared lighting definitions.
9. Do not delete legacy kobold/orc assets blindly: some remain selectable. No kobold model was found in the inspected model catalog. Browser Studio drafts contain source models and pose metadata alongside sprites; preserve/export before cleanup.

Target: Studio prepares character/rig, gear/socket data and low-poly shadow assets once; combat instantiates, poses and equips them without sprite generation or per-loadout baking.

## Isolated walk test

Opt in with `?walkTest=1` (or append `&walkTest=1`). Ordinary links stay unchanged.
Source: user's earlier PixelStudio_Blender_Clothing_v4 inputs/Walking.fbx, copied locally as assets/animations/locomotion/walking-test.fbx. This is a local experiment, not a newly licensed distributable asset.
Live rig only during movement; prepared standing/attack/death assets remain unchanged. No sprites generated for walking. One 650 ms hex transition on the existing presentation scheduler. CPU movement legality and reactions remain in their owners.
Before-edit copies of the six modified implementation files are in work/walk-test-backup. Do not restore these wholesale after subsequent unrelated changes. Removing walkTest from the URL disables the experiment immediately.
Known experimental limitation: existing outline silhouettes and simplified shadows still use the prepared pose, not the animated rig. Sword overlay attachment remains based on the prepared pose. These need migration if walking is accepted.

Walk correction: anatomical limb-direction transfer replaces bind-delta transfer for this skeleton-only source. Receiving foot/toe contacts ground each sample to its original foot plane; full gait cycle takes two hex transitions. Actual Carl rig tested at 79 samples with foot-plane error below 1e-5. Internal browser movement smoke check passed without console errors. Start/stop pose blending remains future work.
