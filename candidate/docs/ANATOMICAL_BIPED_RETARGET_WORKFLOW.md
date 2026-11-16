# Anatomical biped retargeting — reusable workflow

**Status: Candidate Rev 113; successfully observed by human QA for ONE New Orc sword-and-shield attack, other 16 clips and other bipeds NOT YET visually approved.**

This document is the permanent record for the approach developed from Candidate Revs 100–113. Before diagnosing another humanoid animation problem, inspect this workflow and existing test results. **Do not swap Left/Right bone mappings, adjust random joint rotations, or alter the original Tripo mesh/bind GLB to make a bad animation appear correct.**

## What actually caused the apparent incompatibility

- New Carl and New Orc were created using comparable Tripo/Mixamo export workflows and have 65 matching Mixamo skeleton joint names, but **different joint rest frames** (Carl's T-like arms versus the Orc's A-like lowered arms). Names do not imply equivalent quaternion axes.
- World-bind rotation-delta application can fold limbs across the torso. Joint-relative rotations can put arms on their anatomical sides but create chaotic whole-body movement.
- The older live retargeter discarded the hips translation, so even mathematically correct arm rotations could leave jumping/crouching animations looking dislocated.
- The tested Rev 112 method transfers **animated physical bone direction** from a source bone to a corresponding target bone, converted through both anatomical rig coordinate bases; it also transfers **scaled vertical hips movement**. These are the key changes, not a generic Left/Right rename.

## Rev 116: Blender correction for turning clips\n\nHuman QA identified torso stretching on spin/turn actions. Blender inspection confirmed the `anatomical-aim` method suppresses pelvis yaw even though the donor turns about 90–100 degrees. **Do not promote the original 17-clip runtime retarget as production-ready for turning animations.** We preserved a separate Blender-corrected **two-turn QA GLB** and the editable source project in the Model Library, using yaw-neutral aim plus coherent pelvis rotation and limited 39-vertex weight repair. Severe stretch improved but still remains. Detailed reproduction, commands and QA metrics are in [BLENDER_HUMANOID_ASSET_PIPELINE.md](BLENDER_HUMANOID_ASSET_PIPELINE.md). This correction is not automatically applied to the 15 other clips.\n\n## Source of truth and code

- Core function: `retargetHumanoidClip(THREE, clip, sourceModel, targetModel, label, {mode: 'anatomical-aim'})` in `js/mixamo-retarget.mjs`.
- Library configuration: `data/studio-models.json`; `retargetQa.carrier` identifies the already-baked donor GLB, `retargetQa.clips` lists clips by exact name, and `retargetQa.initialClip` optionally selects the starting test pose.
- The two early comparison modes remain: `joint-bind-relative` and `world-bind-delta`. Production callers without an explicit mode are unchanged.
- `js/3d-studio.mjs` imports and presents animations from one reusable source GLB onto the **pristine target** at load time. The original unmodified GLBs, 17-clip offline source, and Rev 112 one-clip proof remain separate library entries.

### Rotation transfer formula (diagnostic mode)

1. Resolve source and target semantic Mixamo bones using their actual hierarchies, not merely matching animation track labels. The glTF loader may address source tracks by UUID.
2. Derive each rig's anatomical right/up/forward basis using shoulder, head and hip positions. Let `C = targetBasis × inverse(sourceBasis)`.
3. For every bone with a comparable child bone:
   - Take `vSourceAnimated = sourceChildLocalTranslation` rotated by the source bone's **animated world quaternion** and `C`.
   - Take `vTargetBind = targetChildLocalTranslation` rotated by the target bone's **bind world quaternion**.
   - Compute the shortest-arc quaternion `Qaim` rotating normalized `vTargetBind` to `vSourceAnimated`.
   - Set `targetAnimatedWorld = Qaim × targetBindWorld`.
4. Derive a target bone's local animation quaternion from its **animated parent world orientation**, not the parent's static bind quaternion.
5. For `Hips`, keep the target's original XZ bind position and transfer the source's **vertical difference from source rest**, scaled by the ratio of the target/source bind hips heights. Horizontal source travel is deliberately removed for **stationary combat sprite capture**. Locomotion in a world-space game would need a different root-motion policy.
6. Resample keyframe times into each clip's new target quaternion and hip-translation tracks; preserve the original source/target rigs and source animation recordings.

### Known limits / do not over-generalize

**Bone direction alone does NOT determine twist (roll) about that bone's axis.** The test can still fail on wrist, forearm, shoulder twist, elbows, crossed grips, mesh skinning, skirts, or special motions. Bones without suitable corresponding child segments fall back to the older joint-relative transfer. IK, root motion, feet sliding, contact physics and inverse-bind anomalies can need distinct corrections.

This is a candidate for **Mixamo-compatible bipedal rigs** with comparable semantic bones and correctly weighted skinned geometry, *not* a guarantee for all bipeds. Skeletons with tails, wings, multiple joint chains, missing legs/hands, different axis conventions, or unusual deformation need a capability audit and additional QA. A passing automated regression test establishes data consistency, not visually correct motion.

## Repeatable acceptance sequence

1. Save the uploaded raw humanoid `.glb` under its own character folder. Record SHA-256, bone list, bind transformations, full skin weights, joint hierarchy, height and forward axis. Never overwrite the original.
2. Compare actual bind-pose world transforms to the source donor, especially upper arms, forearms, hands, pelvis, and lower legs. Distinguish skeleton naming coverage from anatomical orientation agreement.
3. Test **one short animation** first. Load the source donor and unmodified target, choose `anatomical-aim`, and confirm hips Y translation is present. Verify rotation tracks for 60+ compatible Mixamo bones; flag otherwise.
4. Check all 6 Studio angles without equipment. Inspect shoulder/elbow directions, hands, hip height, feet, knee folds, clothing and material attachments. Test **idle, block idle and block first**, because quiet poses expose twist defects better than fast attacks.
5. Only after that, include every relevant clip (e.g. the existing 17 sword-and-shield motions). Validate the actual source-GLB clip list, sample ranges and 65 quaternion/1 hip channels per clip, then scrub each motion from start to finish.
6. Attach swords/shields and examine the authored hand grip and equipment socket relationship separately. A misplaced shield does not prove the bone retargeter is wrong.
7. Run regression suites (`scripts/test-orc-anatomical-aim.mjs`, `scripts/test-orc-full-anatomical-qa.mjs`, `scripts/test-orc-retarget-comparison.mjs`), repository validation, visual QA and all six directional previews. **Human visual QA remains mandatory.**
8. When all motions truly pass, approve the rig/motion family. For performance and reproducibility, consider an offline **derived GLB bake** using this mathematically reviewed mapping, with unchanged original node/skin/Mesh/BIN prefix and hashes. The current Rev 113 QA dynamically computes the clips and does **not** yet commit a derived 17-clip anatomical Orc GLB.
9. Keep a provenance report with source and target hashes, chosen algorithm, root-translation policy, source clip names, target compatibility, known limits, QA decision and human reviewer.

## Candidate Rev 113 testing shortcut

In **Model library**, choose **New Orc — Bone Direction + Hip Motion / All 17 (QA)**; it loads the original `new-orc.glb` and the previously saved **Carl 17-clip donor GLB**. It starts on `Mixamo_sword_and_shield_idle`. Test `Mixamo_sword_and_shield_block_idle` and `Mixamo_sword_and_shield_block` next, then the remaining animations. The original Rev 112 one-clip proof is separately selectable.

See `docs/TRIPO_MIXAMO_ANIMATION_BAKE.md` for the older offline-bake path and complete source-asset provenance. Do not confuse the runtime anatomical QA method with that older world-bind-delta offline bake.
