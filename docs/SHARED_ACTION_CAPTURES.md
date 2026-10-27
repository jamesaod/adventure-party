# Shared action captures — Candidate Rev 172

## Authoring

The weapon/action selector in Pixel Studio / 3D Studio offers:

- Every existing weapon profile: Ready (`ready`), Wind Up (`windup`), Attack (`attack`).
- **Magic** (`magic`): Casting Wind Up (`casting-windup`) and Casting (`cast`).
- **Death/Prone animation** (`death-prone`): Falling (`falling`) and Prone (`prone`).

Only the selected group's capture buttons and sheet rows are shown. Capture shared poses once, then switch weapon groups to author physical poses. Equipment edits apply to future captures; previously captured poses keep their own grips and loadouts. Global model/framing/lighting changes still affect all groups. Changing a library name does not invalidate pixels; changing a recipe only invalidates its affected capture when the source frame differs. Reusable recipes retain animation/source IDs and exact source times, independently of model, equipment and pixels. Model-specific grip and rendering settings remain in capture workspaces and Unit Packages.

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
- `unit.actionProfiles` remains weapon IDs only. Missing captures remain absent; outdated captures are preserved separately under recovery/ as described below. Each exported pose keeps its original animation ID, time, six facing filenames and model-specific captured equipment settings.

The QA PNG remains the existing seven-row layout for compatibility, with unused rows empty; the visible table shows only the active group. The PNG is not the implementation dataset. Consumers of older ZIPs (no captureFormatVersion) should continue reading per-weapon pose records. Consumers of version 2 must resolve shared groups rather than expecting seven poses in every weapon manifest.

## Compatibility and recovery

Version 1 pose libraries migrate to version 2 on read. A shared pose comes from the first assigned weapon in stable catalog order (1H Swing first). Old per-weapon shared samples remain in `legacySharedPoses`, including differing choices. In a shared group, **Restore earlier recipe** lets the author choose a prior weapon's frame. Recording or clearing a shared pose does not resurrect archived values on reload. New libraries do not contain this legacy archive.

Saved pixel workspaces retain storage version 1 and add `captureFormatVersion: 2`, `sharedActionGroups`, `legacySharedCaptures`, and `settings.weaponActionProfileId`. The active weapon's fresh old capture wins migration, otherwise the first fresh capture in catalog order; an outdated capture stays outdated if no fresh version exists. All earlier shared captures remain in the browser archive. **Restore earlier capture** explicitly brings one back for review. Archives are recovery data, not active groups; normal ZIP groups export selected canonical captures; active outdated captures also export in the recovery section. Export an old archive variant by restoring it into the appropriate shared group first.

Existing model/pose-library scopes, pinned MOB revisions, Unit Package identity, stats, animation source assets, attachment offsets and combat rules remain unchanged. Archives do not affect library signatures or coverage. No renderer or equipment system was added.

## Combat test and regression checks

Test in combat combines the last selected physical weapon profile with both shared groups. Selecting Magic or Death/Prone does not replace that physical profile. The paired return workspace preserves the editing group and all capture maps. Equipment-aware regeneration reads the same combined recipe using the existing renderer. Incompatible frame dimensions, anchors or scales are rejected before handoff instead of misaligning shared sprites.

Run repository validation, including `node scripts/test-shared-action-captures.mjs`, `test-mob-authoring.mjs`, `test-studio-weapon-sets.mjs`, and the existing combat capture parity suite. Browser QA: capture one physical pose, both Magic poses and both Death/Prone poses; switch weapons and back; reload; export JSON/ZIP; verify only one shared copy, then test combat and return to Studio.


## Rev 173 — preserve pose snapshots and recover excluded exports

The first user-produced Scale Mail Woman ZIP contained 23 poses (276 PNGs) across nine weapon groups and the two shared groups. Eight expected physical poses were absent despite the author having captured all three poses in each group. The exporter filtered `stale` captures, while every primary/off-hand/shield grip edit invalidated previous poses in that group. The ZIP itself cannot distinguish never-captured from filtered-out poses; the reported missing slots are consistent with this invalidation path. The original archive SHA-256 is `6708a233521ac4e55fcae98103ce4abfd562cc1c153ce9f2c9d8da49d8912c80`.

Gear changes now update the preview and next capture only. Existing poses already contain independent equipment transforms, so they remain valid snapshots. Model/framing/lighting/library changes still flag affected pixels outdated. Explicit recapture replaces a slot; no historical frame is silently substituted.

ZIP export preserves every occupied current capture slot:

- Current snapshots use the existing `profiles/` and `shared/` manifests.
- Outdated snapshots each receive `recovery/<group>/<pose>/manifest.json` and their six-facing PNGs (including battlefield images when available). Each uses its own original frame dimensions and anchors, even if the current workspace resolution changed.
- Recovery pose records carry `outdated: true` and `outdatedReason`. New invalidations record their reason; older records use an explicit unknown-change message.
- `capture-recovery.json` (`adventure-party.capture-recovery`, version 1) lists group, pose, source animation ID, exact time, captured equipment, frame and manifest path. The same records appear in `unit-package.json` under `references.captureRecovery`.
- Recovery-only weapon groups remain listed in the Unit Package's weapon types. Shared groups remain independent of weapon types. Existing v2 consumers may continue using current manifests; integration/recovery tools must also inspect `references.captureRecovery` for previously excluded work.
- ZIP export does not allocate unused full QA sheets for every group/recovery record. Export status reports current and recovery pose counts. All-outdated workspaces can export. Combat and ordinary QA-sheet exports retain the current-only behavior; recovery snapshots are never silently promoted to live combat sprites.

For an earlier incomplete ZIP, first check whether autosave succeeded. If it reports a size/quota failure, **do not reload or close the original tab**: some captures can exist only in memory. In that still-open version, use **Reusable pose library → Use existing capture references → Export pose library JSON** to back up all captured animation IDs/times, including outdated slots. This JSON does not contain per-pose grips or pixels. Keep the existing ZIP too. Verify the backups before any reload. An already persisted workspace may be older than the visible captures.

After backup, opening Rev 173 in a separate tab with the exact same site/model/MOB/library scope can read the last successful workspace without destroying the old tab's in-memory data. Export all action groups there; if the omitted slots were persisted, their original pixels and equipment references appear in recovery without recapture. A cleared workspace cannot be reconstructed from the incomplete ZIP. Legacy shared-pose archives from Rev 172 remain selectable using Restore earlier capture before export.

### Autosave storage correction

The author's follow-up screenshot showed a failed-save message claiming 256 MB. Rev 172 actually enforced 512 MiB, but retained the old message. At 500% resolution each 800×1000 six-facing RGBA capture costs 19,200,000 raw bytes; 31 poses cost 595,200,000 bytes (567.6 MiB) before model files/shadows, so a complete set could exceed autosave's cap even when its PNG ZIP was small. A failed atomic save leaves the prior saved copy intact; later unsaved captures remain only in the open tab.

Rev 173 stores capture pixel buffers with lossless gzip (`pixelEncoding: "gzip-v1"`), checks the 512 MiB limit against compressed storage, and reads older raw workspaces unchanged. Animation IDs, exact times, grips, raw RGBA bytes, shared groups, legacy archives and separate shadow buffers survive the round trip. Compression is asynchronous and cached by immutable pixel-buffer identity; editing a grip does not recompress all prior captures. Combat drafts use the same codec and remain atomically paired with their return workspace. A failed save warns before leaving the page. Storage errors explicitly say autosave failed and to keep the tab open/export before leaving; no silent clearing or pruning is allowed.

`node scripts/test-studio-workspace-codec.mjs` verifies the 31-pose 500% case above the former raw cap, exact byte round-trips, old raw reads, compression reuse, malformed data bounds and preservation of the last saved record on a failed write. The fixture's compression ratio is synthetic, not a claim about the author's real artwork.


Regression: `scripts/test-studio-capture-export.mjs` covers mixed/current-only/all-outdated groups, original differing frame sizes, exact source/time/loadout recovery, and Unit Package references. `test-studio-weapon-sets.mjs` executes the real equipment handlers and rejects capture invalidation during weapon/off-hand/shield changes.


## Rev 174 — one Action Pose Capture workflow

The author used the main Capture buttons correctly, but the separate Reusable pose library panel remained empty because capture never called its recording hook. The user chose to move forward with a unified interface and redo their captures; no existing user workspace or imported file was cleared by this change.

There is one **Action Pose Capture** panel beside the existing model/equipment layout. Choose a pose library, weapon type (or Magic/Death-Prone), action pose, animation and frame, then press **Capture selected pose**. The same operation records the exact portable source animation/time in the reusable library and the six model-specific sprite views with their equipment transforms. Library references autosave; the compressed pixel workspace keeps its linked copy. Sliced/frozen clips use `portablePoseSample` so recipes reference original source frames. Capturing an unresolvable animation fails visibly rather than silently creating a pixel-only pose.

The panel displays captured/missing/outdated slots, frame references and separate library/workspace save feedback together. Library naming, humanoid size, new/import and legacy recovery choices live in collapsed Library settings. **Preview saved pose** positions the model at the selected saved reference; it does not create another capture. The lower sprite table is labeled QA preview and contains no competing capture workflow. Pinned MOB definitions stay unchanged until explicitly updated. Reopening an editable Studio workspace retains its latest linked working library; embedded MOB previews continue honoring the pinned library.

**Export action poses (ZIP)** includes `pose-library.json`, the same library under Unit Package `references.poseLibrary`, all existing physical/shared manifests and images, and any outdated recovery records from Rev 173. There is no separate normal JSON export, Record frame, Save library, or Copy existing captures button. QA image export remains clearly separate from the integration dataset.

Older saved workspaces with captured frames but an empty starter library are seeded automatically once after their source animations load. Already assigned libraries are not overwritten on opening. Embedded MOB previews never perform this seeding/write. If local library persistence fails, the open references remain linked to the workspace/export and the panel reports the error; it never claims library-save success. Existing local-store conflict checks prevent overwriting another tab's library revision.

Validation: `test-studio-unified-capture.mjs` executes the real capture handler and library controller, checks reference-before-workspace wiring, exact physical/shared frames, automatic persistence, failed-write retention, read-only preview behavior, and the single-panel/combined-export contract. Browser QA captures multiple poses, edits equipment, switches shared groups, reloads and verifies the ZIP's JSON matches every manifest's source frame. Existing models, equipment offsets, animations, combat rules and captured dataset version 2 are unchanged.


## Rev 175 — completed capture groups

The weapon/shared-action selector prefixes a green ✅ when every required pose has a current capture: three poses for weapon types, two for Magic, and two for Death/Prone. Labels refresh on capture, clear, invalidation and workspace restore; missing or outdated slots remove the check. Stored group IDs, frame references and export data are unchanged.
