# Blender-assisted Orc turning repair — controlled asset pipeline

**Status: Candidate test, not production approved.** The final visual QA of the two turning clips is still outstanding. Do not replace the original Orc, overwrite the 17-clip derived GLB, or promote this candidate to stable `main`.

## Why this stage exists

The original anatomical-direction retargeter reproduced limb **direction** but lost turn yaw/twist about the torso's long axis. In `Mixamo_sword_and_shield_turn` and `Mixamo_sword_and_shield_turn_2`, Carl turns ~90–100 degrees while the old Orc pelvis barely turns. The skinned torso then stretches because body sections disagree about orientation.

Offline Blender testing used **yaw-neutral limb aiming plus coherent whole-character turning** and a conservative disconnected-component skin-weight check. At the halfway frame of the first turn, edges stretched beyond 2x were reduced from 128 to 55 **before** skin-weight adjustments, measured over the same edges. The limited weight-cleanup did not remove all residual deformation.

## Files and provenance

- Original target: `assets/models/orcs/new-orc/new-orc.glb`, SHA-256 `50f2c69c60c8f72a0c2d60941d4cae853e023babaa75e969573aabc581a0b909`.
- Existing donor: `assets/models/dungeon-crawler-carl/new-carl/mixamo-sword-shield-full-17/new-carl-mixamo-sword-shield-full-17.glb`.
- Locally exported two-clip Blender QA model: `orc-turn-corrected-blender-qa.glb`, SHA-256 `670434096914dbab807695b784856deb051272898915a0cc1cad315131eabe11`, 1,369,064 bytes, two turning clips.
- Blender 5.2.2 LTS. Source code for the repeatable **post-retarget** Blender repair/export stage: `scripts/blender_repair_orc_turns.py`.
- Source `.blend` workspace: `orc-turn-correction.blend` (kept separate from the raw uploaded Orc GLB).

The exported binary has **not been committed by this text-only GitHub integration**. Do not add a Model Library entry referencing it until the GLB is committed and SHA checked. Keep this distinction explicit.

## Steps to reproduce when pre-Blender two-turn GLB is available

1. Generate a new two-turn GLB from original Orc and donor Carl using the yaw-decoupled retarget formula:
   - Calculate the animated source pelvis yaw relative to its bind orientation.
   - Convert it to target anatomical coordinates, remove it from each animated limb aim direction, then apply it **once** to all target world bone rotations.
   - Convert to parent-relative local rotations, keeping vertical hips motion and original target bind and skin data.
   - The above **animation retargeting stage must be independently packaged and tested** before claiming an end-to-end automated pipeline.
2. Run the Blender stage:
   ```sh
   blender -b -t 2 --python scripts/blender_repair_orc_turns.py -- \
     --source /path/to/orc-yaw-decoupled-turns-preblender.glb \
     --output /path/to/orc-turn-corrected-blender-qa.glb \
     --blend /path/to/orc-turn-correction.blend \
     --report /path/to/turn-qa-report.json --repair-weights
   ```
3. Reimport into Blender; verify one armature, both actions, mesh materials, and no invalid cross-limb weights or unexpectedly changed bind pose.
4. Record both SHA hashes and all modified weight indices. Assess edge-stretch percentiles for each action at 0%, 25%, 50%, 75%, and 100%.
5. Run **human visual QA** from all six directions: look for pinned front torso, hip/spine twist, detached skirt, finger distortions, knee collapse and weapon clipping. Only after a satisfactory QA pass may the new model be registered as a separate, repository-backed QA entry.
6. After approval, integrate yaw/twist preservation into the common import pipeline and validate **all 17** animations. Keep model-specific skin fixes as saved profiles rather than global remapping.

## Reuse and limits

Blender is appropriate as an **optional offline asset preparation/inspection stage** with reproducible scripts, bind-pose/skin audits, QA renders, and self-contained GLB export. It is not required at runtime; existing browser playback should remain lightweight. Do not assume Blender automatically repairs every biped: additional skeleton geometries and bone weights still need case-by-case tests.

The original Blender QA deliverables remain available in the ChatGPT project conversation. Do not assume conversational download URLs are stable repository asset paths.
