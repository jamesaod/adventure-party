# MOB Workshop experiment

Entry: title menu → MOB Workshop [Experiment], or `mob-workshop.html`.

This separate authoring experiment uses direct Three.js model previews. It does not generate sprites or replace the existing Studio, MOB Creator, or combat registry.

## Workflow

1. Load a repository model or embedded GLB/FBX, name it, review height/ground alignment.
2. Load shared animation clips or import FBX/GLB animations. Preview a clip, set start/end/speed, then drag it into an action slot or click Assign selected. Reassign to save edited ranges. Death accepts multiple variants.
3. Choose equipment and adjust weapon/shield attachments while previewing animation. Armor and ammunition are data only. Review loadout.
4. Enter statistics, abilities and notes. Abilities are authoring text, not executable combat rules.
5. Review the automatically populated checklist. Export becomes available when the checks pass.

Save draft stores model bytes and animation tracks in browser IndexedDB. Export Workshop ZIP is a portable authoring project containing the original model and JSON metadata; import it here to resume. It is **not yet a production combat unit package**. Equipped assets currently refer to the repository catalog.

## Modules

- `js/mob-workshop-core.mjs`: schema, module/action catalog, assignments and readiness validation.
- `js/mob-workshop.mjs`: viewer, retargeting, attachment adapters, UI and storage.
- `mob-workshop.html`, `css/mob-workshop.css`: experimental workspace.
- `scripts/test-mob-workshop.mjs`: range, required-slot, death-variant and checklist regressions.

Next integration work: adapt reviewed projects into the existing prepared-model/MOB package schema, preserve species-specific model repairs, and expose catalog-backed abilities/AI modules. Manual ground review does not automatically correct feet. Imported rigs must be compatible with the existing humanoid retargeter.

## Equipment Fit step 1
The Equipment step now has move/rotate gizmos on existing catalog grip sockets, local/world axes, optional snapping, a hand close-up, numeric transforms and reset. Dragging pauses animation. Adjustments are per-MOB draft, saved/exported in existing grips metadata; catalog defaults are unchanged. The hand bone is selected by the shared equipment adapter (main/off-hand/shield). Secondary-hand IK and finger authoring are later stages. Matching Three.js r180 TransformControls is vendored from the upstream MIT source. Follow-up notes: USER_FOLLOW_UPS.md.

## Equipment Fit step 2
Primary right-hand grasp authoring adds wrist offsets, signed per-finger curls, thumb opposition, presets, and a yellow attachment contact marker. Unsupported finger chains are disabled. Corrections are restored before animation evaluation to prevent accumulating rotations. Rig-specific bend axes are manually selectable; presets are starting points, not automatic collision/contact solving. Settings are stored in equipment.primaryHandPose in the Workshop draft/ZIP; runtime combat consumption remains a later integration step. Weapon scale is unchanged.

Reusable hand fit: Equipment Fit now saves a per-model, per-hand position/quaternion correction composed with catalog weapon defaults. It applies to newly selected weapons, preserves per-item refinements, and persists with the Workshop equipment data. Shield mounts remain separate. Replacing the model clears calibration. This is a manual reusable calibration, not automatic anatomical inference or two-hand IK. Finger/wrist controls are collapsed under Advanced.
