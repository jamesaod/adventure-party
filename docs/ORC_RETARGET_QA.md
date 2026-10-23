# Rev 111 — Orc crossed-arm retarget diagnosis

**Status:** opt-in visual QA, not a production fix. The Rev 110 Orc looks correct in T-pose but its arms cross the torso during sword-and-shield animation. Carl looks correct with the same motions.

## Why the same Tripo workflow can produce different results

Bone *names* and source animation coverage do not establish that two models share compatible bind frames, rest-pose shoulder positions, local bone axes, mesh skin weights or glTF inverse-bind matrices. Both Rev 110 bake reports recorded 65 matched Mixamo joints. They recorded different source-to-target anatomical corrections: Carl **3.8123°**, Orc **8.0405°**. This alone does not explain the defect, but rules out assuming identical rigs solely from identical exports.

The new `scripts/test-orc-retarget-qa.mjs` audits the actual uploaded source GLB skin-joint names and their immediate parents, and prints the local orientation differences in all eight shoulder/arm/hand bones. It also verifies which quaternion multiplication order each test mode uses in a controlled arm-bind fixture.

**Verified by Rev 111 CI against the two original source GLBs:** Carl has **65** skinned joints; the Orc has **66**, including an additional `neutral_bone`. The other **65 joint labels and all their immediate parent names match**. The measured Carl-to-Orc local rest-quaternion differences are: LeftShoulder 20.23°, **RightShoulder 148.83°**, LeftArm 53.39°, RightArm 61.51°, LeftForeArm 14.23°, RightForeArm 77.26°, LeftHand 15.07°, RightHand 29.59°. These angles demonstrate different local bind axes; they do not establish which algorithm looks right without in-browser QA.


## Test models in Model library

All three new entries preserve the unmodified original Orc GLB. They retarget **the same one-second, known-good baked Carl sword/shield reference animation** dynamically, using a selectable math strategy:

- **New Orc — Carl Reference: Anatomical World Delta (QA).** Compute `D = S_world_animated × inverse(S_world_bind)`, rotate delta using anatomical basis correction `C`, then `T_world_animated = C × D × inverse(C) × T_world_bind`. This mirrors the documented world/bind delta approach used in our offline baker.
- **New Orc — Carl Reference: Joint Bind Relative (QA).** Existing Three.js approach: `T_world_animated = T_world_bind × inverse(S_world_bind) × S_world_animated`. Unmodified default baseline.
- **New Orc — Carl Reference: Local Bind Delta (QA).** Isolate each bone's local joint orientation: `T_local_animated = T_local_bind × inverse(S_local_bind) × S_local_animated`. Helpful for diagnosing per-joint rest-axis mismatch versus parent world-space accumulation.

The same 65-bone Carl animation is the donor for all three. No original GLB binaries, baked clips, meshes, inverse-bind matrices, skin weights, or equipment are overwritten.

## Manual visual acceptance

1. Load **New Carl — Offline Sword & Shield Attack QA** and verify the one-second reference clip.
2. For each **New Orc — Carl Reference** model in the library, select the `Mixamo_Sword_Shield_Attack_InPlace_QA` animation, remove sword and shield, and scrub start/middle/end from front/back and sides.
3. Check whether hands and elbows remain connected to their correct shoulders, and whether arms pass through or switch sides of the torso. Also inspect shoulders and feet.
4. Report which variant looks right, or if all fail. The new variants are exploratory, and a passing CI run does not mean visual success. **Do not replace the production Orc animation pipeline until a visually correct strategy is verified.**

If all three fail, compare original skin weights and inverse-bind orientation to actual geometry and isolate left/right arm movements before changing either rig. Avoid speculative mesh repairs or silent bone-flipping.

## Reusability gate

Any future Tripo upload must pass name/hierarchy and orientation audits, have intact inverse-bind data, and visually pass one short joint-isolation animation before importing entire motion packs. Preserve the original source model in the catalog.
