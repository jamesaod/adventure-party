# Shared action captures — Candidate Rev 172

## Authoring

The weapon/action selector in Pixel Studio / 3D Studio offers:

- Every existing weapon profile: Ready (`ready`), Wind Up (`windup`), Attack (`attack`).
- **Magic** (`magic`): Casting Wind Up (`casting-windup`) and Casting (`cast`).
- **Death/Prone animation** (`death-prone`): Falling (`falling`) and Prone (`prone`).

Only the selected group's capture buttons and sheet rows are shown. Capture shared poses once, then switch weapon groups to author physical poses. Equipment edits mark only the current group's pixels outdated; global model/framing/lighting changes still affect all groups. Changing a library name does not invalidate pixels; changing a recipe only invalidates its affected capture when the source frame differs. Reusable recipes retain animation/source IDs and exact source times, independently of model, equipment and pixels. Model-specific grip and rendering settings remain in capture workspaces and Unit Packages.

The existing Spell Casting profile remains available for compatibility with earlier definitions; its physical ready/windup/attack slots do not replace the new shared Magic slots. Shared groups are not equipment items or new weapon types.

## Export format

Pose-library JSON now uses `adventure-party.pose-library`, `version: 2`:

```json
{
  "schema": "adventure-party.pose-library",
  "version": 2,
  "id": "humanoid-medium",
  "name": "Humanoid Medium",
  "bodyFamily": "humanoid",
  "size": "medium",
  "revision": 1,
  "profiles": {
    "one-handed-swing": {"ready": null, "windup": null, "attack": null}
  },
  "sharedActionGroups": {
    "magic": {"casting-windup": null, "cast": null},
    "death-prone": {"falling": null, "prone": null}
  }
}
```

Normalization includes every existing weapon profile; omitted poses are explicit null. Assigned values remain `{animation, sourceId, timeSeconds}`. Consumers resolve physical poses in `profiles[weaponType]`, casting in `sharedActionGroups.magic`, and death/prone in `sharedActionGroups['death-prone']`. `resolveLibraryPose()` implements that lookup for weapon IDs as well as the new shared group IDs. MOB readiness counts 3 × weapon count + 2 death/prone poses, plus 2 magic poses for spellcasters.

The ZIP retains the Unit Package v1 envelope and adds **`references.captureFormatVersion: 2`**. This version governs the captured dataset, independently of the Unit Package envelope and pose-library version:

- `profiles/<weapon-type>/manifest.json` and PNGs contain only physical poses.
- `shared/magic/manifest.json` and PNGs contain casting poses once.
- `shared/death-prone/manifest.json` and PNGs contain falling/prone once.
- `references.spriteSets[weapon-type]` contains physical pose references and a `sharedActionGroups` list referencing the available shared group IDs.
- `references.sharedActionGroups[group-id]` contains the shared manifest path and pose/frame references.
- Shared manifest metadata uses `sharedActionGroupId`; weapon manifests use `actionProfileId`. Both include `captureFormatVersion: 2`.
- `unit.actionProfiles` remains weapon IDs only. Missing/outdated captures are excluded. Each exported pose keeps its original animation ID, time, six facing filenames and model-specific captured equipment settings.

The QA PNG remains the existing seven-row layout for compatibility, with unused rows empty; the visible table shows only the active group. The PNG is not the implementation dataset. Consumers of older ZIPs (no captureFormatVersion) should continue reading per-weapon pose records. Consumers of version 2 must resolve shared groups rather than expecting seven poses in every weapon manifest.

## Compatibility and recovery

Version 1 pose libraries migrate to version 2 on read. A shared pose comes from the first assigned weapon in stable catalog order (1H Swing first). Old per-weapon shared samples remain in `legacySharedPoses`, including differing choices. In a shared group, **Restore earlier recipe** lets the author choose a prior weapon's frame. Recording or clearing a shared pose does not resurrect archived values on reload. New libraries do not contain this legacy archive.

Saved pixel workspaces retain storage version 1 and add `captureFormatVersion: 2`, `sharedActionGroups`, `legacySharedCaptures`, and `settings.weaponActionProfileId`. The active weapon's fresh old capture wins migration, otherwise the first fresh capture in catalog order; an outdated capture stays outdated if no fresh version exists. All earlier shared captures remain in the browser archive. **Restore earlier capture** explicitly brings one back for review. Archives are recovery data, not active groups; new ZIPs export only selected canonical groups. Export an old archive variant by restoring it into the appropriate shared group first.

Existing model/pose-library scopes, pinned MOB revisions, Unit Package identity, stats, animation source assets, attachment offsets and combat rules remain unchanged. Archives do not affect library signatures or coverage. No renderer or equipment system was added.

## Combat test and regression checks

Test in combat combines the last selected physical weapon profile with both shared groups. Selecting Magic or Death/Prone does not replace that physical profile. The paired return workspace preserves the editing group and all capture maps. Equipment-aware regeneration reads the same combined recipe using the existing renderer. Incompatible frame dimensions, anchors or scales are rejected before handoff instead of misaligning shared sprites.

Run repository validation, including `node scripts/test-shared-action-captures.mjs`, `test-mob-authoring.mjs`, `test-studio-weapon-sets.mjs`, and the existing combat capture parity suite. Browser QA: capture one physical pose, both Magic poses and both Death/Prone poses; switch weapons and back; reload; export JSON/ZIP; verify only one shared copy, then test combat and return to Studio.
