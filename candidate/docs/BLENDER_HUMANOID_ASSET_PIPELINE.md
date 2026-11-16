# Blender as an offline humanoid asset-import and retarget QA stage

**Candidate Rev 116.** Blender 5.2.2 LTS is a recommended **offline preparation and diagnostic stage**, not a runtime dependency of Adventure Party. This procedure is **experimental** and is not yet the production import standard for every biped.

## Why Blender

The original New Orc is a valid skinned GLB, but its Mixamo-style bone names do not guarantee the same anatomical reference axes as Carl. Our runtime `anatomical-aim` transfer solved crossing arms but discarded pelvis-facing yaw in turning actions: aiming an upright spine only determines its direction, not its twist. Rotation and mesh weight issues must be separated rather than introducing ad hoc renderer changes.

For **the two sword-and-shield turning clips only**, the repair:

1. Computes the source pelvis yaw about the character's up axis.
2. Removes that yaw from the source animated directions before aiming the target limbs.
3. Reapplies yaw coherently to the target's skeleton while preserving scaled vertical hip motion.
4. Opens the resulting two-clip model in Blender to inspect the 66-bone armature and its mesh skin weights.
5. Conservatively removes mixed opposite arm/leg influences from 39 vertices. This modification slightly improves some mesh metrics but **does not resolve all stretching**.
6. Exports a separately named self-contained GLB, preserving the untouched source models and existing 17-clip QA models, and saves the exact editable Blender project.

## Saved assets and known results

- **Model Library choice:** `New Orc — Blender-Corrected Turns (2 Clips QA)`
- **QA GLB:** `assets/models/orcs/new-orc/blender-turn-qa/new-orc-turn-corrected-blender-qa.glb`
- **Editable source:** `assets/models/orcs/new-orc/blender-turn-qa/new-orc-turn-correction.blend`
- **Detailed weight/deformation report:** `assets/models/orcs/new-orc/blender-turn-qa/qa-report.json`
- **Checksums and immutable source provenance:** `data/blender-orc-turn-qa.json`
- **Automated checks:** `node scripts/test-blender-orc-turns.mjs`
- **Animations:** `Orc_Corrected_sword_and_shield_turn`, `Orc_Corrected_sword_and_shield_turn_2`.
- The exported GLB has one skin with **66 joints**, both turning clips (198 Blender transform channels each), and the original textured material. Blender re-export may split mesh vertices at material/normal boundaries; it is **not byte-for-byte mesh-identical** to the original Tripo GLB.

At the midpoint of the first turn, 128 mesh edges previously stretched more than 2×. The yaw-neutral retarget reduces that to 55 before the Blender weight cleanup; the edited export still has 56. **Residual distortion remains.** This is not evidence that all 17 animations are corrected, nor an approved production character.

## Reproduce the two-clip proof from repository assets

Requires Python 3 with NumPy and SciPy for the offline quaternion math and a working **Blender 5.2.2 LTS** executable. On machines without Blender, the completed GLB and source .blend remain available in the repository. No Blender binary or proprietary model is checked in by this pipeline.

From the repository root:

```bash
mkdir -p /tmp/adventure-orc-blender-qa

python scripts/blender/retarget-yaw-neutral-turns.py \
  --source assets/models/dungeon-crawler-carl/new-carl/mixamo-sword-shield-full-17/new-carl-mixamo-sword-shield-full-17.glb \
  --target assets/models/orcs/new-orc/new-orc.glb \
  --output-dir /tmp/adventure-orc-blender-qa

python scripts/blender/combine-turns.py \
  --target assets/models/orcs/new-orc/new-orc.glb \
  --source-dir /tmp/adventure-orc-blender-qa \
  --output /tmp/adventure-orc-blender-qa/orc-yaw-decoupled-turns-preblender.glb

blender -b -t 2 --python scripts/blender/blender-cleanup-turns.py -- \
  --input /tmp/adventure-orc-blender-qa/orc-yaw-decoupled-turns-preblender.glb \
  --output-glb /tmp/adventure-orc-blender-qa/orc-turn-corrected-blender-qa.glb \
  --output-blend /tmp/adventure-orc-blender-qa/orc-turn-correction.blend \
  --report /tmp/adventure-orc-blender-qa/qa-report.json
```

The two Python retarget/combine stages reproduce the **pre-Blender GLB byte-for-byte** from the checked-in inputs, based on the local verification. Blender re-export's GLB JSON and clip structure were identical on repeated runs, but floating-point mesh bytes can differ slightly, so use structural/pose tests and record an export SHA rather than requiring exact binary output hashes across Blender runs.

**Only after human visual approval** should we consider adapting the validated method to all turns in a production full-17 GLB or generalizing the approach to other bipeds.

## Future reusable import checklist

1. Archive the untouched uploaded GLB and calculate SHA-256.
2. Run a skeleton/bone-role, bind-pose and mesh/skin-weight inspection in Blender.
3. Prepare **idle, block and turns** first to catch both twist and rest-frame issues; then attacks and locomotion.
4. Correct root/pelvis-facing and bone twist before changing weights. Do not mask erroneous skeleton movement with indiscriminate weight painting.
5. Keep the model-specific Blender project, derived GLB, scripts, original checksums, metrics and human QA verdict together.
6. Validate 6 facing directions, full motion durations, shield and sword sockets, and all 17 clips as appropriate.
7. After approval, consider generating a complete derived model and updating the catalog. Do not overwrite raw Tripo models, previously working clips, or stable `main`.

Related: [Anatomical Biped Retarget Workflow](ANATOMICAL_BIPED_RETARGET_WORKFLOW.md) and [Weapon Attachment Profiles](WEAPON_ATTACHMENT_PROFILES.md).
