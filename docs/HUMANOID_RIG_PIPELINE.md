# Humanoid rig pipeline

Adventure Party treats a humanoid model's authoring bone names as import data, not as runtime API names.

## Semantic rig roles

The Studio rig adapter maps common skeleton conventions onto stable roles such as:

- `hips`, `spine`, `chest`, `upperChest`, `neck`, `head`
- `leftShoulder`, `leftUpperArm`, `leftForeArm`, `leftHand`
- `rightShoulder`, `rightUpperArm`, `rightForeArm`, `rightHand`
- upper/lower legs and feet on both sides
- index, middle, ring, pinky and thumb chains on both hands

The first-pass alias set recognizes Mixamo, common Blender/Rigify naming, Unreal-style side suffixes, Bip01/Biped names, and simple generic names. Renderer, equipment, IK and animation code should request semantic roles instead of checking one model's raw bone names.

## New humanoid workflow

1. Load a GLB, glTF or FBX model in **3d studio**.
2. Studio analyzes the skeleton automatically. The Model summary reports the detected rig family and mapped core-role count.
3. Correct model orientation and calibrate physical size in T-Pose.
4. Use **Load animation FBX** to add a humanoid animation. The retargeter maps source and target bones through semantic roles, derives each rig's anatomical right/up/forward basis, converts source bind-pose rotation deltas into the target basis, then applies them to the target bind pose. This allows +Z-forward and -Z-forward humanoids to share the same animation family without mirroring the limbs.
5. Equip a weapon or shield. Equipment sockets resolve `rightHand` and `leftHand` through the same rig adapter.
6. For two-handed equipment, the solver resolves the left shoulder, upper arm, forearm, hand, torso and finger chains through semantic roles.
7. Tune model-specific grip/socket offsets only when anatomy or authored pivots require an artistic correction.
8. Capture Ready, Attack and Prone poses and test them in combat.
9. Once approved, preserve the model and any model-specific corrections as catalog/profile data rather than adding renderer-specific code.

## Orc acceptance asset

The first non-Carl acceptance model supplied for this pipeline is **Male Orc Fighter 3D Model.glb**.

Observed source facts:

- SHA-256: `a0b63e9ae67c47779baf9e254660918c073ab1684237f528c43bb9f7e9f9c688`
- one skin
- 65 joints
- complete Mixamo-style body hierarchy
- five complete finger chains per hand
- no embedded animation clips in the uploaded GLB
- repository path: `assets/models/orcs/male-orc-fighter/male-orc-fighter.glb`
- Studio library ID: `male-orc-fighter`

The rig maps all 20 current core humanoid roles and therefore qualifies automatically for external humanoid animation retargeting and equipment attachment. The exact uploaded GLB is repository-backed and selectable as **Male Orc Fighter** from the Studio Model Library. Its source contains no embedded clips, but Studio now assigns it the shared repository `one-handed-swing` family and retargets `UAL2_Sword_Ready` plus `UAL2_Sword_Regular_A` when the model loads.

## Current limitations

This is a first pass, not a promise that every humanoid rig will be zero-touch.

- Animation retargeting currently bakes quaternion/rotation tracks. Root-motion and arbitrary bone translation tracks are intentionally not transferred.
- A skeleton with unusual names that do not match the alias catalog may need a saved model-specific mapping profile.
- Weapon and shield attachment bones can be found generically, but unusual hand anatomy or asset pivots may still need a small model-specific socket correction.
- The two-handed solver requires recognizable shoulder/upper-arm/forearm/hand chains. Finger wrapping requires recognizable finger chains.
- Repository-backed animation families now exist, beginning with `one-handed-swing`. The first carrier is Carl's approved UAL2 proof GLB, so loading this family currently downloads more data than a future lightweight skeleton-only animation asset will require.
- There is not yet a general animation-family picker in Studio; saved model entries opt into approved families through data, while **Load animation FBX** remains available for ad hoc testing.

The target architecture is **model + semantic rig profile + generic animation family + equipment profile**, with model-specific corrections stored as data.
