# Units and their assets

This roster describes the current candidate's unit-to-art assignments. There are **10 registered studio unit targets**: three player characters and seven monster types. The six-facing Studio Kobold is an additional artwork/test variant of the existing Kobold type.

The tables below document the existing runtime catalogs. Update the relevant catalog when changing an assignment, then update this roster; this document is not a second configuration file.

## Where the assignments live

| Definition | Authoritative location | What it controls |
| --- | --- | --- |
| Registered studio unit targets and footprints | [`js/sprite-layouts.mjs`](../js/sprite-layouts.mjs), `SPRITE_MOBS` and `SPRITE_LAYOUT_PRESETS` | Stable unit IDs, labels, player/monster classification, and default occupied hexes |
| Imported sprite packages and explicit player defaults | [`data/sprite-sets.json`](../data/sprite-sets.json) | Package manifest paths, cache revisions, and `defaultFor` unit assignments |
| An imported package's artwork | Its `assets/sprites/<set-id>/manifest.json` | Target unit, ready/attack/prone frames for all six facings, dimensions, ground anchor, footprint, and capture metadata |
| Legacy sprite geometry | [`data/sprite-asset-registry.json`](../data/sprite-asset-registry.json) | Source/workspace sizes, render dimensions, anchors, and facing for the older flat PNG assets |
| Combat factories, image references, and pose selection | [`js/adventure-party.js`](../js/adventure-party.js) | Unit statistics/encounters, `UNIT_POSE_DEFINITIONS`, player default binding, and live pose/facing selection |
| Saved 3D character models | [`data/studio-models.json`](../data/studio-models.json) | Studio model menu entries and source GLB files |
| MOB Height calibration | [`data/mob-heights.json`](../data/mob-heights.json) | Feet/inches body-height data used by the appearance pipeline; null preserves legacy scale |
| Visible equipment recipes | [`data/visible-equipment.json`](../data/visible-equipment.json) | 3D asset, attachment, grip, visual class, and pose-profile association |
| Weapon pose profiles | [`data/weapon-pose-profiles.json`](../data/weapon-pose-profiles.json) | Reproducible Ready/Attack/Prone animation samples for equipment classes |

## Player characters

All three targets use a single occupied hex by default. A registered sprite package can declare its own supported footprint.

| Character / unit ID | Current artwork | Poses and facings | Current use |
| --- | --- | --- | --- |
| **Dungeon Crawler Carl** / `fighter` | [`assets/sprites/dungeon-crawler-carl/`](../assets/sprites/dungeon-crawler-carl/), explicitly assigned with `defaultFor: "fighter"` | **18 PNGs: ready, attack, prone × E, NE, NW, W, SW, SE** | The canonical player in ordinary Combat System Test encounters. Authored Height: **6′3″ / 75 in**. His inventory includes Flaming Sword +5 and Battle Axe. Selecting his sprite test inspects that same Carl against six Kobolds; it does not add duplicate Carls. |
| **Elven Ranger** / `ranger` | No dedicated repository package assigned. Existing fallback renderer uses [`fighter.png`](../assets/sprites/fighter.png). | Fallback is one standing image mirrored for left/right. A supplied player package can provide all 18 frames. | Defined in the engine and offered as a studio capture target. Not a default party member; a selected Ranger sprite package creates the friendly inspection formation. |
| **Baub — Mage** / `mage` | No dedicated repository package assigned. Existing fallback renderer uses [`fighter.png`](../assets/sprites/fighter.png). | Fallback is one standing image mirrored for left/right. A supplied player package can provide all 18 frames. | Defined in the engine and offered as a studio capture target. Not a default party member; a selected Mage sprite package creates the friendly inspection formation. |

Carl's older [`assets/sprites/fighter.png`](../assets/sprites/fighter.png) remains a fallback if the assigned package cannot load. Its legacy specification is a 64 × 64 source, a 32 × 35 render box, and source anchor `(32, 64)`. An embedded verified image is the final decode fallback for that file. Keeping it available does not make it the intended normal Carl assignment.

### Carl's imported 18-frame package

Source: the user-provided **Dungeon Crawler Carl Sprite Set.zip**. The export originally identified itself as `stylized-character-3d-model`, captured from `stylized+character+3d+model.glb`. Its managed repository ID is `dungeon-crawler-carl`, and its display label is **Dungeon Crawler Carl**. The PNG bytes, full-frame padding, transparency, and authored scale/anchor are preserved.

| Package field | Value |
| --- | --- |
| Manifest | [`assets/sprites/dungeon-crawler-carl/manifest.json`](../assets/sprites/dungeon-crawler-carl/manifest.json) |
| Ready files | `ready-e.png`, `ready-ne.png`, `ready-nw.png`, `ready-w.png`, `ready-sw.png`, `ready-se.png` |
| Attack files | Same six suffixes with the `attack-` prefix |
| Prone files | Same six suffixes with the `prone-` prefix |
| Reference sheet | [`sheet.png`](../assets/sprites/dungeon-crawler-carl/sheet.png), six columns × three rows |
| Individual source frame | 320 × 400 px, 200% capture resolution |
| Render frame | 91.56 × 114.45 battlefield pixels, including the original 175% model size and 109% hex calibration |
| Ground anchor in source pixels | `(160, 264.02889936721095)` |
| Footprint | `single` — one occupied hex |
| Captured motion | Ready: `box_02`; attack: `box_02`; prone: `fall` |

The render frame includes transparent padding; its dimensions are not the visible body's exact width and height. Pose files share the same frame and ground anchor, so changing direction or pose does not require cropping or repositioning the artwork.

The package's `mobType: "fighter"` connects its art to Carl's existing unit rules. The index's `defaultFor: "fighter"` makes that package the explicit normal assignment. A deliberately selected player sprite test can override the artwork for that browser session. If the explicit default cannot load, the runtime retains the legacy fallback instead of choosing a different optional package by name.

## Monsters and test artwork

Paths in the asset column are relative to [`assets/sprites/`](../assets/sprites/). “Single view” means an authored right-facing image with runtime mirroring for left-facing presentation, rather than six independently rendered directions.

| Unit / ID | Assigned PNG assets | Available poses and facings | Footprint | Current use |
| --- | --- | --- | --- | --- |
| **Kobold** / `kobold` | `kobold-stand.png`, `kobold-attack.png`, `kobold-prone.png` | Standing, attack, prone; single view/mirrored | 1 hex | Ordinary Kobold encounter; also opponents for player sprite tests |
| **Kobold Body Guard** / `kobold-bodyguard` | `kobold-bodyguard-stand.png`, `kobold-bodyguard-attack.png`; shared `kobold-prone.png` | Standing, attack, shared prone; single view/mirrored | 1 hex | Ordinary Kobold encounter |
| **Kobold Slinger** / `kobold-slinger` | `kobold-slinger-stand.png`, `kobold-slinger-attack.png`; shared `kobold-prone.png` | Standing, attack, shared prone; single view/mirrored | 1 hex | Ordinary Kobold encounter |
| **Orc** / `orc` | `orc-stand.png`, `orc-attack.png` | Standing and attack; single view/mirrored. No dedicated prone frame. | 1 hex | Orc Warband encounter |
| **Orc Leader** / `orc-leader` | `orc-leader-stand.png`, `orc-leader-attack.png` | Standing and attack; single view/mirrored. No dedicated prone frame. | 1 hex | Orc Warband encounter |
| **Orc Shaman** / `orc-shaman` | `orc-shaman-stand.png`, `orc-shaman-attack.png` | Standing and attack; single view/mirrored. No dedicated prone frame. | 1 hex | Orc Warband encounter |
| **Juvenile Red Dragon** / `juvenile-red-dragon` | `juvenile-red-dragon.png`, `juvenile-red-dragon-attack.png` | Standing and attack; single view/mirrored. No dedicated prone frame. | 7 hexes, center + ring | Juvenile Red Dragon encounter |
| **6-facing Studio Kobold** / sprite variant `studio-kobold`, unit type `kobold` | `studio-kobold-ready-e.png`, `-ne.png`, `-nw.png`, `-w.png`, `-sw.png`, `-se.png` | Six ready facings. Attack uses the ready frame for the current facing; no dedicated prone set. | 1 hex | Existing six-facing inspection encounter; uses Kobold rules |

The standard Kobold encounter currently creates 10 ordinary Kobolds, 3 Body Guards, and 3 Slingers. The Orc Warband creates 18 ordinary Orcs, 1 Leader, and 1 Shaman. These are encounter compositions, not additional unit definitions.

The shared [`death-marker.png`](../assets/sprites/death-marker.png) is the skull-and-crossbones status artwork. It is separate from each living unit's pose collection.

The engine also contains a generic `makeClericCharacter()` class constructor, but `cleric` is not a registered studio target, has no assigned unit pose set, and is not created by the current ordinary encounter setup. Class and spell support alone should not be counted as an implemented visual unit.

## 3D source models and equipment

| Studio asset | Source | Association |
| --- | --- | --- |
| **Dungeon Crawler Carl Ver 2** | [`assets/models/dungeon-crawler-carl/v2/dungeon-crawler-carl-v2.glb`](../assets/models/dungeon-crawler-carl/v2/dungeon-crawler-carl-v2.glb) | Saved character model for studio target `fighter`. Embedded clips: `box_01`, `fall`, `box_02`, `box_03`. Source identity is recorded in the [model README](../assets/models/dungeon-crawler-carl/README.md). |
| **Dungeon Crawler Carl Ver 2 — UAL2 Sword Test** | [`assets/models/dungeon-crawler-carl/v2-ual2-sword-test/dungeon-crawler-carl-v2-ual2-sword-test.glb`](../assets/models/dungeon-crawler-carl/v2-ual2-sword-test/dungeon-crawler-carl-v2-ual2-sword-test.glb) | Studio QA alternate for `fighter`, retaining the four original clips and adding `UAL2_Sword_Ready` (1-second held stance) and `UAL2_Sword_Regular_A` (1.4-second attack/recovery). Quaternius animation sources and CC0 attribution are recorded in the [model README](../assets/models/dungeon-crawler-carl/README.md#version-2--ual2-sword-test). This model is not a new combat sprite assignment. |
| **Male Orc Fighter** | [`assets/models/orcs/male-orc-fighter/male-orc-fighter.glb`](../assets/models/orcs/male-orc-fighter/male-orc-fighter.glb) | Saved `orc` Studio model and first repository-backed non-Carl humanoid rig acceptance asset. Exact user-supplied GLB: 1,413,200 bytes, SHA-256 `a0b63e9ae67c47779baf9e254660918c073ab1684237f528c43bb9f7e9f9c688`. One 65-joint Mixamo-style skin, no embedded animation clips; external humanoid FBX animations are retargeted through the semantic rig adapter. |
| **Medieval Sword** | [`assets/models/weapons/swords/medieval-sword.glb`](../assets/models/weapons/swords/medieval-sword.glb) | Separate studio equipment, attached through Carl's right-hand bone and a calibrated grip transform. |
| **Battle Axe** | [`assets/models/weapons/battle-axes/battle-axe.glb`](../assets/models/weapons/battle-axes/battle-axe.glb) | Separate studio equipment for the first one-handed swing profile. Provisional grip is tunable/exportable in Studio. Source benchmark: 54,706 triangles. |

These source models and the imported battle sprite package have separate identities. The imported Carl package records its original `stylized+character+3d+model.glb` capture source; it is not labeled as a new capture from **Dungeon Crawler Carl Ver 2**. Equipping the sword in the studio changes the live model and newly captured images. To publish a new sword-equipped battle set, capture the three poses, export, and import that package through the normal candidate workflow.

## Updating a unit's artwork

Use the existing [sprite-set import procedure](SPRITE_SET_IMPORT.md) for complete studio packages. Preserve the chosen stable package ID on re-import, verify its `mobType`, and retain or intentionally update the explicit `defaultFor` assignment for a player. Imported monster sets remain selectable tests until the corresponding ordinary encounter is intentionally linked to them.

For legacy PNG replacements, keep the established asset paths and adjust [`data/sprite-asset-registry.json`](../data/sprite-asset-registry.json) only when dimensions or anchors require it. Update the cache revision, run the repository's existing PNG/package checks, and inspect the real combat render before merging to candidate. See [GIT_WORKFLOW.md](GIT_WORKFLOW.md) and [DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md).
