# Reusable weapon attachment profiles (Candidate Rev 115)

This file records the **equipment-orientation workflow** separately from animation retargeting. A correct humanoid motion clip can still hold an asset at the wrong angle because the source sword pivot and right-hand local frame are not guaranteed to match. Do **not** modify animations, swap bone names, or rotate the whole character to fix an individual weapon.

## First Orc sword calibration — awaiting visual QA

User QA on Candidate Rev 113 found the animation and shield correct, but the sword needed reorientation. Rev 114 experimented with a downward-pointing blade at [0,-90,-115], which the user rejected as the wrong direction. The latest red markup instead shows the blade projecting **diagonally up and right** from the guard while keeping the hilt in the fist. Rev 115 corrects the guard rotation sign and retains the same hilt position.

A small **model-scoped** mount preset is now defined in `data/studio-models.json`:

- **Profile ID:** `tripo-mixamo-orc-one-hand-sword-upward-v2`
- **Weapon:** `medieval-sword` (`assets/models/weapons/swords/medieval-sword.glb`)
- **Mount position (hand local):** `[0.015, 0.05, 0.005]` (unchanged).
- **Rotation (degrees, XYZ hand local):** `[0, -90, 90]` (experimental candidate).
- **Grip point:** unchanged asset-local `[0.34, 0.109, 0]`.
- **Original global/Carl sword rotation:** `[0, -90, 0]` (unchanged).
- **Shield, model geometry, animation tracks, skinning, left hand and equipment scale:** unchanged.

**Visual approval is still pending.** The +90-degree hand-local rotation is a revised QA candidate selected to produce an up/right guard direction in the default southeast-facing Studio projection. Do not declare it universal or fully approved until the user visually reviews idle, block, and attack.

Every saved **New Orc** Model Library entry explicitly references the above profile ID using `weaponAttachmentProfileId`. The Studio loads and validates that profile, applies it when the Medieval Sword is selected, and uses it again on **Reset grip**. Hand-edited grip values survive workspace save/restore. Carl, axes and two-handed swords use their original independent defaults. Profile-driven equipment is **not** automatically approved for other Tripo exports.

## Procedure for a new compatible humanoid

1. Preserve the original source GLB and confirm the Mixamo semantic `rightHand` bone.
2. Retarget and visually inspect **idle and block animations first** (see [Anatomical Biped Retarget Workflow](ANATOMICAL_BIPED_RETARGET_WORKFLOW.md)).
3. Select the sword. Inspect hilt-in-hand placement and **blade pointing direction separately**. Do not confuse a sword mount rotation error with a skeleton error.
4. If its hand frame matches the New Orc, test the existing `tripo-mixamo-orc-one-hand-sword-upward-v2` profile by setting the new model's `weaponAttachmentProfileId` to that ID. Otherwise, create a **new** profile under `weaponAttachmentProfiles` with the correct weapon ID, position and XYZ rotation. Do not change the shared Carl defaults.
5. Verify six facings and the entire **idle, block, attack, draw and sheathe** motions; also check hilt collision with the hand and the blade clearing the shield/torso.
6. Only after in-engine visual approval mark the profile as approved and reuse it for further bipedal models of the same compatible rig/hand orientation. Model-specific offsets should remain data, not custom renderer branches.
7. Run `node scripts/test-orc-sword-profile.mjs`, `node scripts/test-studio-equipment.mjs` and the existing repository validation checks.

**Implementation:** `js/3d-studio.mjs` reads the catalog's `weaponAttachmentProfiles` and uses `defaultEquipmentSettingsForModel(weaponId)` on selection and Reset grip; the unchanged generic `createWeaponAttachment` in `js/studio-equipment.mjs` still attaches the weapon to the animated right hand. The right-hand socket rotates around the original asset grip pivot; the baseline Carl/other equipment paths are deliberately unchanged.

The completed candidate must be visually approved before this profile is treated as a production default.
