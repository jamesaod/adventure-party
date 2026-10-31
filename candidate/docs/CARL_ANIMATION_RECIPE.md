# Carl animation recipe — recovered in Candidate Rev 140

## Historical evidence

- Rev 56 / PR #137 (`4c55ea8`): the original upload, **Dungeon Crawler Carl ver 1.glb**, was registered as Ver 2. Its four embedded motions already belonged to its own rig.
- Rev 58 / PR #139 (`36c3153`): the successful UAL2 addition used `scripts/retarget-carl-ual2.py`. The key was **world-space bind deltas**, converted back through each animated parent, plus scaled hip displacement. Mesh, skin weights, bone lengths, scales, and inverse binds stayed intact. See `assets/models/dungeon-crawler-carl/README.md`.
- Revs 108–110 (`d2b67d4`, `ce0250f`, `5a36d5e`): the Mixamo FBX bake reused that principle, added the anatomical source/target basis and a stationary XZ hip policy. The “Reattach Replacement Assets” chat explicitly records the user's “Carl looks good. Animation works.” feedback before the 17-motion expansion.
- Rev 102 / PR #192 (`b89c13a`): an Orc investigation changed the live retargeter's default to **joint-bind-relative**. That formula is not equivalent to the successful Carl bake. It also omits hip translation by default.
- Rev 139 / PR #245 accidentally used that default for Carl's 13 uploaded FBXs. Matching names, valid numeric tracks, and successful loading did not establish correct poses. This caused the reported distortion.

The original Ver 2 GLB is still byte-for-byte intact: SHA-256 `5284bd3cd0b9fe6665c5d94ec0fc7fae8ec4a5856f0628f3084ae1190b044693`. Ver 3 is its Studio identity, not a replacement rig.

## Explicit Carl recipe

`js/repository-fbx-animations.mjs` installs only the cataloged user-uploaded files (currently 22) in `data/animation-library-sources.json`, using the existing pinned FBX loader and shared retargeter. It explicitly selects `{mode: 'world-bind-delta', hipTranslation: 'scaled-world-y'}` and records recipe ID `carl-v2-mixamo-world-v1`. Studio and combat regeneration call this same loader.

1. Work from the pristine target before its mixer, view transforms, or equipment constraints are applied. The original 13 motion FBXs and Rev 147 Standing Idle contain the same reference skeleton; verify this again for any future upload.
2. Resolve semantic joints, keeping the target's actual inverse-bind orientations. Derive the source and target anatomical bases from shoulders, hips and head; let their conversion be `C`.
3. For each sampled source world orientation, compute `D = sourceAnimatedWorld × inverse(sourceBindWorld)`, then `targetAnimatedWorld = C × D × inverse(C) × targetBindWorld`.
4. Convert each result to local space using the **animated parent**. Do not copy donor local quaternions and do not substitute joint-relative or anatomical-aim Orc experiments for this Carl recipe.
5. Transfer source hip **world displacement**, rotate it by `C`, and scale by target/source bind hip height (approximately 0.00545 for these centimeter-scale FBXs). Preserve the target's world XZ position and its vertical movement; convert back through its parent. Include hip translation key times even when no rotation key occurs there.
6. Keep non-hip translations, all scales, geometry, weights, textures and original files unchanged. Preserve the stable uploaded clip IDs, labels and action profiles, including Bayonet Stab's two-handed thrust association.

This restores the historical calculation within the existing runtime adapter. It does not introduce a renderer, equipment system, or replacement mesh. The other retargeting modes remain unchanged for archived models. Device-import defaults are not a declaration of compatibility: future Carl library additions must go through this explicit recipe and its QA.

## Reproduce and validate

The recovered Rev 108 archive (`Carl_Rev108_Offline_Bake_QA.zip`, `diagnostics/fbx_parse.py`) contained a missing dependency of the checked-in offline bake. That parser is now restored as `scripts/fbx_parse.py`; the existing bake scripts are reproducible again.

To regenerate the independent acceptance fixture with Python, numpy and scipy installed:

```sh
python scripts/generate-carl-animation-reference.py
node scripts/test-fbx-animations.mjs
```

The generator uses the original `tripo_mixamo_bake_core.py` FBX Euler evaluator and `bake_mixamo_pack_v2.py` anatomical basis, independently of the JavaScript loader/retargeter. It writes only `scripts/fixtures/carl-uploaded-animation-reference.json`, never a source model or source animation. The fixture records all source hashes, 22 major joint world orientations and hip position at five authored key times per cataloged motion (currently 22 motions / 110 poses per model).

The Node test uses Carl's real inverse binds, skin weights and all mesh vertices. Rev 140 measures a maximum 0.6436-degree joint difference and 3.27e-8 native-unit hip-position difference from the offline reference. The one-degree tolerance allows the pinned loader's quaternion sampling to differ slightly from the independent Euler evaluator. It must not be relaxed to accommodate a different retargeting formula. Bounds/finite checks supplement the pose comparison; they are not the acceptance criterion by themselves.

Browser QA scrubbed all 13 motions at start, quarter, middle, three-quarter and end, without gear, and reviewed the resulting 65-pose contact sheet. Check all six facing previews, then equipment attachments separately. Human review of motion quality and artistic grip choices remains useful; this is not a guarantee for an unrelated rig or future motion family. Existing scale/grip/orientation/attachment controls remain available.

Workspace settings now record the animation recipe. Reopening a Ver 3 workspace saved before the correction preserves its captures and settings but marks captures outdated, requiring recapture before combat. Newly captured poses save the current recipe, so subsequent reloads do not repeatedly invalidate them.

Run all commands from `.github/workflows/adventure-party-validation.yml`, then use the normal candidate PR / validation / merge / Pages verification flow. On Windows the existing symlink test may require privileges; Linux CI is authoritative for that check. Check the published Rev 140 label and the actual corrected module content, not just the workflow status.


## Standing Idle - Candidate Rev 147

User source `Standing Idle.fbx` is copied byte-for-byte to `assets/animations/unarmed/standing-idle.fbx`: 724,896 bytes, SHA-256 `1b987eca58ed91ecd43f9daf8ccffb9f39f077c9c10193cfec6c5c568927a698`. It is appended to `data/animation-library-sources.json` as **Standing Idle**, ID `standing-idle`, stable clip ID `uploaded:standing-idle:0`, tagged `unarmed` / Bare Handed. It is available in the Animation selector with all equipment; the tag does not restrict selection or replace existing Ready captures. Existing 13 entries, initial Sword And Shield Idle, model bytes and saved indices remain unchanged.

The recovered offline FBX evaluator compared all 65 source bind-bone positions and rotations to Goalie Throw with zero difference. The same world-bind-delta and scaled-world-y policy is therefore used without any loader/rig changes. Regenerating `scripts/generate-carl-animation-reference.py` adds five independent reference poses; all older reference entries remain identical. `node scripts/test-fbx-animations.mjs` validates all 14 source hashes, stable IDs, durations, actual skinning and 70 poses against the independent evaluator with the unchanged one-degree tolerance.

For future supplied animations: copy the original bytes into the appropriate animation folder, append an entry with its hash/size/label and profile tags, verify source bind compatibility, regenerate the independent fixture, and run repository validation plus visual Studio playback/scrubbing. Append rather than reorder entries to preserve legacy saved clip indices. The shared catalog request uses `cache: 'no-cache'`, so adding a new asset path requires no retargeter rewrite or broad module cache changes. Publish using the normal candidate PR workflow and compare the live FBX checksum. Do not overwrite source files or reset existing captures as part of registration.

## Casting, death and idle batch — Candidate Rev 159

Eight user uploads are appended after Standing Idle, bringing the shared library to **22 animations** for Carl Ver 3 and Blond Haired Woman in Scale Mail. Source FBX bytes are copied unchanged; exact hashes and byte counts are in `data/animation-library-sources.json`. The duplicate-download suffix in `Sword And Shield Death (1).fbx` is omitted from its display label and repository filename.

| Animation | Source ID | Duration (seconds) | FBX bytes |
| --- | --- | ---: | ---: |
| Great Sword Casting | `great-sword-casting` | 4.800 | 590,992 |
| Magic Heal | `magic-heal` | 2.667 | 518,368 |
| Standing React Death Forward | `standing-react-death-forward` | 3.667 | 674,960 |
| Standing Death Forward 01 | `standing-death-forward-01` | 3.167 | 566,960 |
| Two Handed Sword Death | `two-handed-sword-death` | 2.400 | 493,632 |
| Sword And Shield Death | `sword-and-shield-death` | 3.900 | 575,152 |
| Unarmed Idle 01 | `unarmed-idle-01` | 11.600 | 1,204,720 |
| Standing Torch Idle 01 | `standing-torch-idle-01` | 8.100 | 860,032 |

Every new source matches all 65 reference bind-bone positions and rotations of Goalie Throw exactly. Use the unchanged world-bind-delta / scaled-world-y recipe. Great Sword Casting and Magic Heal have casting tags; weapon-specific deaths retain their weapon tags. General death and torch-idle motions have no weapon restriction. No pose frames are automatically assigned: the user chooses frames for the existing capture slots. All animations remain selectable with every equipment loadout.

The first 14 catalog entries and their stable `uploaded:<source-id>:0` IDs retain their order. Existing model bytes, initial animations, equipment mounts, combat systems and saved captures are unchanged. The catalog already loads with `cache: 'no-cache'`, and each new FBX has a new path, so no loader changes or broad cache reset are needed.

Reproduce by copying each supplied FBX byte-for-byte to its manifest path, checking its source bind with `fbx_skeleton` from `scripts/tripo_mixamo_bake_core.py`, appending its manifest entry, and regenerating both independent fixtures:

```sh
python scripts/generate-carl-animation-reference.py
python scripts/generate-carl-animation-reference.py --target assets/models/humans/blond-scale-mail-woman/blond-scale-mail-woman.glb --output scripts/fixtures/blond-scale-mail-uploaded-animation-reference.json
node scripts/test-fbx-animations.mjs
```

Keep the existing joint/hip tolerances. Automated checks cover 110 skinned poses per model (220 total), file hashes, duration, finite tracks and preserved clip IDs. Run repository validation and verify all eight published FBX hashes after the candidate PR is merged. At the user's request, visual playback and pose/grip QA for these new motions are left to the user.

## Staff Pose proof of concept — Candidate Rev 177

The supplied Meshy ZIP contains `Animation_Axe_Stance_without_skin.fbx`, registered as **Staff Pose** (`uploaded:staff-pose:0`), 301,324 bytes and 6.10 seconds. The original FBX bytes are preserved at `assets/animations/staff/staff-pose.fbx`; checksum is pinned in the animation catalog. Its unrelated texture files are not needed for this skeleton-only animation.

This Mixamo-named skeleton has an authored starting stance, no neutral bind-pose record and fewer finger bones than our existing Mixamo uploads. A world-bind delta would erase that initial stance. Only this catalog entry opts into the existing `anatomical-aim` retargeting mode, which transfers child-bone directions. The previous 22 sources keep their world-bind recipe unchanged. This is a proof of concept: missing finger detail and axial hand twist cannot be fully recovered from limb directions; artistic staff grip QA remains necessary. No capture slots are assigned automatically.

`test-fbx-animations.mjs` compares eight transferred limb directions at five times against the loaded source animation on all five models, checks finite skinning, source checksum/duration and stable IDs, and retains every earlier independent 110-pose reference. The offline world-bind fixture generator excludes explicitly direction-retargeted sources, which have the separate direction assertions. Future animation exports should include a neutral reference skeleton/bind pose when available.

## Candidate Rev 178 — Axe Stance correction

Rev 177 Staff Pose direction retargeting is superseded by the with-skin neutral-bind source and time-aligned FBX axis curves. Preserve the stable source ID and all earlier animation recipes. Reproduction, model import, independent Blender validation and capture recovery: [Orc Shaman V2 and Axe Stance](ORC_FEMALE_SHAMAN_V2_MODEL.md).
