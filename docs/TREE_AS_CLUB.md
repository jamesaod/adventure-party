# Individual tree clubs

Current implementation, 16 November 2026. This supersedes the earlier universal-club trial. Each of the six current battlefield specimens owns a separately authored SpeedTree source and club asset, including all three maple specimens. The stable clubId on the tree selects the catalog item on pickup; species alone cannot select a club. Newly added individual trees require their own source/export/catalog record and clubId.

## Assets and scale

Sources are preserved in tools/tree-production/individual-clubs. Complete OBJ/MTL/texture staging and the executable conversion remain in the authoring workspace outputs/tree-as-club/individuals and build-individual-clubs.py. Original standing-tree sources remain unchanged. Each club source isolates that specimen’s central trunk by hiding crown and root generators. Conversion clips the stump (1 metre above source ground; oak 1.2 metres because its ground datum is 0.2), removes the upper 15% narrow tip, caps both cut faces, retains bark and UVs, and sets the handle origin 10% from its narrow end. The heavy end runs along +Y.

Dimensions are baked in combat metres using the actual standing-tree conversion: 43.38933076913966 model units/source metre × 0.18 renderer scale × 240/210 tree draw scale ÷ (64/3.048 world units/metre). Length and thickness use the same factor. We no longer stretch a generic shape to a collision capsule. Workshop default size is 100%, native scale 1; combat converts metres using the exact calibrated body bounds after updating all parent transforms, rather than a head/foot estimate. Workshop item-specific position, rotation, shaft roll, size and secondary-grip offsets carry into combat.

| Specimen | Item ID | Length m | Triangles |
|---|---|---:|---:|
| White Oak 05 | tree-05-club | 3.314 | 486 |
| Sugar Maple 11 | tree-11-club | 3.898 | 1212 |
| Tall Sugar Maple 17 | tree-17-club | 5.144 | 1334 |
| Broad Sugar Maple 23 | tree-23-club | 3.806 | 1174 |
| American Beech 29 | tree-29-club | 3.828 | 1174 |
| Sweet Birch 35 | tree-35-club | 2.617 | 1026 |

Manifest records source/asset hashes, cut heights, conversion factor, dimensions and grips. Each export has its own texture directory so shared SpeedTree material filenames cannot overwrite another species’ bark. Runtime GLBs embed textures capped at 1024 pixels. The legacy Tree as Club entry remains available for old saved equipment; new pickups use individual entries.

## Runtime and validation

Hill Giants carry in the right hand during idle/movement and use the off-hand solver only for two-handed attacks. Each held object has its own presentation cache; all six small assets preload with the giant, with no new frame loop. Pickup removes the fallen continuous trunk and its navigation footprint as before. STR 21 remains +4 to hit and +9 damage.

165 existing combat/Workshop regressions passed; test-combat-individual-tree-clubs.mjs additionally verifies unique hashes/identities, embedded textures, GLB physical bounds, standard Workshop registration and separate saved fits. Hidden production combat verified birch-specific pickup, trunk removal, three subsequent attacks and a solved two-hand grip (0.01054 model-unit residual). No appearance load error. Final visual approval remains with the user. Keep local until publication is requested.


## Repeat an individual club

1. Open that exact specimen's green SPM. Preserve its seed and trunk shape; hide crown/leaf/root generators except Tree/Trunk. Confirm only the central trunk exports. Save a separate Specimen_IndividualID_Club.spm.
2. Export into a separate directory with its own OBJ/MTL/maps. Adapt outputs/tree-as-club/build-individual-clubs.py in the authoring workspace (archived under tools/tree-production/individual-clubs). It contains workstation-specific paths and needs the original exports; the archive is not a standalone dependency bundle.
3. Trim the stump and narrow tip, cap ends, retain UVs, and use the same uniform conversion for thickness and length. Current physical conversion is 43.38933076913966 × .18 × (240/210) ÷ (64/3.048). The denominator matches calibrated MOB display height, not the five-foot gameplay movement cell. Do not reintroduce the old 64/1.524 denominator or a hidden 75% factor.
4. Save the GLB under assets/models/weapons/tree-as-club/individuals; update hashes, dimensions and grips in js/individual-tree-clubs.mjs and the archived manifest. Assign clubId to the exact individual in combat-environment-state.js. Catalog and Studio consume the shared registry. New individuals require new assets, even within a species.
5. Pickup resolves treeClubForIndividual(ai.tree), records the selected club and source identity, removes the fallen log and enables normal combat AI. Preserve separate held-object caches for multiple giants. Carry in one hand; constrain the off hand only during two-handed attacks.
6. Store per-item fits under the JSON key [modelId, socket, itemId] in draft.equipment.fitsByItem (version 3, presetRevision 100, fitStoreVersion 1). Preserve position, rotation, roll, size and secondary-grip offsets. Loadout stays empty until pickup.
7. For implementation changes run test-combat-individual-tree-clubs.mjs, relevant tree-hauler tests, and the combat regression suite. Check physical asset dimensions, actual Workshop/combat body-to-club ratios, exact pickup identity, multiple giants, log removal and attacks. A geometry metadata check alone does not verify rendered size. Respect an explicit no-test request.

## Hill Giant saved grip and scale correction — 16 November 2026

All six individual clubs plus the legacy generic entry have model-specific fits in data/mobs/hill-giant.workshop-unit.json: scale 100%; position [-1, 1, 0.3131962381687962]; XYZ rotation degrees [103.25573048815143, -13.101534476385934, 109.007230640255]. Attachment: mixamorigRightHand, catalog grip origin. Shaft roll and secondary offsets are preserved. The original grip-only change was explicitly not tested.

The subsequent scale fix corrects two independent errors: the asset conversion used a five-foot reference instead of the MOB display's ten-foot reference, and combat measured the body before refreshing calibrated parent matrices. Six corrected GLBs retain original geometry and textures with a uniform root transform; the converter now generates these dimensions directly. Workshop now also receives inchesPerLocalUnit and the catalog preset revision. The hidden production parity check (.local/check-tree-club-scale.cjs) passes all six actual Workshop/combat size ratios; visual approval remains with the user.

Scale-fix validation: 166/166 combat regressions passed, plus all six production Workshop/combat ratio comparisons.

Hill Giant tree-club damage (16 November 2026): all individual trunks and the legacy universal trunk deal 2d6 base damage against every target size when equipped by hill-giant. Existing Strength damage is added once by the melee resolver (STR 21: +9, total 2d6+9). Ordinary clubs and other wielders retain their existing weapon rules.

## Torn club ends (16 November 2026)

The flat converter caps exported gray (0.8 RGB) despite the Blender viewport tint. scripts/repair-tree-club-breaks.mjs repairs the six existing individual GLBs using the same tearTrunkGeometry field and specimen seeds as fallen trunks/stumps. The heavy broken end and adjoining bark are subdivided/deformed together; both caps use stump brown (0x98734d) with baked grain modulation. Original asset backups live in .local/tree-club-flat-cap-backup. Source SPM/OBJ, grip origin, uniform scale and narrow-tip position remain unchanged. Jagged tips extend the measured bounds slightly; nominal trunk length remains the original cut length. Registry/manifest record fracturedBoundsMetres, refreshed hashes and triangle counts (all below 2000). Repeat the repair after rebuilding flat exports, using an intentional fresh backup for changed source exports.

## Club impact corpse order — 17 November 2026
Lethal Hill Giant tree-club hits tag the victim with the attacking unit and attack-pose timestamp. The surface actor sorter draws that victim before the attacking giant for the remainder of that pose, while retaining wall constraints. The dependency expires when the pose ends or changes. Small/Medium immediate prone timing remains at the 2.4-second thump; larger victims retain their death animation.

Corpse water fringing now intersects the cached settled mesh with the water surface, then rasterizes the segments into a shared 1024-square world-space distance mask (128 metres). The existing foam shader samples this mask. Geometry intersections and mask uploads are cached; dry and submerged bodies produce no contour. Visibility/body/level/view changes can invalidate the cached contour. This is a finite-resolution visual effect, not fluid simulation. Geometry, cache, Chrome shader/raster checks passed; user visual approval remains pending.
