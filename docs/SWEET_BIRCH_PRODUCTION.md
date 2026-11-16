# Sweet Birch production

16 November 2026 — Betula lenta, local integration. Final appearance and interactive performance review remain with James.

## Botanical reference and authoring

Research: [UConn](https://plantdatabase.uconn.edu/detail.php?pid=64), [Virginia Tech](https://dendro.cnre.vt.edu/dendrology/syllabus/factsheet.cfm?ID=11), [Morton Arboretum](https://mortonarb.org/plant-and-protect/trees-and-plants/sweet-birch/). Sweet birch has dark cherry-brown bark with horizontal lenticels, pointed serrated ovate leaves and golden autumn foliage. It does not have white paper-birch bark. Reference photographs were not copied into game assets.

Authored in SpeedTree Modeler 10.2.0 from a separate copy of the Beech generator scaffold: trunk absolute length 37 ft, primary branch length .32 of parent, primary branching randomized once, start .36 and end .90 of parent, gravity .035. The resulting specimen is smaller and narrower than the Beech. The saved SPM preserves the seed and complete generator settings. Green, Fall and Winter sources are separate; Winter hides the leaf generator and retains the authored wood.

Major branch generation starts nominally 13.32 ft up the parent spine. This is not a guarantee of 10 ft clearance everywhere: secondary branches droop, with wood outside a 2 m trunk radius reaching 1.44871 m above ground. Source maximum is 12.1715 m (39.93 ft); editor displayed 40.29 ft. LOD card expansion raises the runtime maximum to 12.5573 m (41.20 ft), with approximately 36.23 by 38.84 ft crown extents. The earlier 45 ft / 24–30 ft outline was a proposal, not the final measured shape.

New green leaf, gold leaf and dark bark artwork was generated specifically for this tree. Leaf images are 1086 × 1448, and native green/fall cluster bakes are 2048 square. The Fall cluster uses the same green opacity silhouette. Existing Sample cutout encloses the new leaf outline; inherited leaf geometry can make canopy leaves appear narrower than the individual particle artwork. No catkins are modeled. Small twig material and internal Maple labels remain from the scaffold. Main bark uses Birch_Bark_Color.png with obsolete normal/AO/gloss maps disabled.

## Exports and runtime

Native Games OBJ, all LODs, feet converted to metres, Z-up, scale 1, no flips. Source datum Z=0; runtime position is (x,z,-y) × 43.38933076913966, model scale .18. Buried roots retain the existing clipping path.

| Version | Wood | Foliage | Total triangles |
|---|---:|---:|---:|
| Native full green/fall | 23,997 | 21,312 | 45,309 |
| Native LOD1 green/fall | 7,958 | 11,718 | 19,676 |
| Native LOD2 green/fall | 1,439 | 4,960 | 6,399 |
| Native winter LOD1 | 7,940 | 0 | 7,940 |
| Runtime green/fall | 7,958 | 4,960 | 12,918 |
| Runtime winter | 7,958 | 0 | 7,958 |

Runtime combines LOD1 wood and LOD2 foliage. Native leaf-hidden LOD1 omits 18 twig triangles, so runtime winter explicitly reuses green LOD1 wood. Green/fall/winter wood, normals and UVs are byte-identical. Stump and log derive from the same wood using the existing continuous 1 m split; eight detached limbs retain source surfaces and pivot metadata. Original native exports remain untouched.

Species `sweet-birch`, registry base 35 (models 35–40), runtime directory assets/terrain/sweet-birch. Grassy Battlefield adds a sixth specimen alongside the five preserved trees; observed test placement (5,-2). It uses the existing God Tool, seasons, wind, snow, outlines, fall sounds, navigation and grass-pressure systems. Offline collision poses include all three seasonal forms and 24 orientations; existing five species' collision datasets remain exactly preserved.

Tree spacing profile is radius 2 hexes with .65 feather. Birch litter is type 7, with a separate artwork batch and snow-landing state. Individual particle and litter cards share Birch_Leaf_Green/Fall.png, 13 cm high × 9.75 cm wide including petiole, nominal blade 10 cm. Water rejection and snow burial retain the existing logic. There is no new animation loop. No FPS improvement is claimed from triangle counts.

## Reproduction and preservation

Workspace outputs/sweet-birch contains native SPMs, OBJ/MTL/LOD exports, artwork, cluster bakes, export inventory, measured wood components, staging converters, browser checks and before-birch backups. Repository tools/tree-production/sweet-birch contains the native sources, species artwork and cluster bakes, research, conversion scripts and SHA-256 inventory. Sources may reference workspace paths or scaffold twig materials; this is not a fully portable dependency bundle. The initial Working SPM is retained as an intermediate, not the final asset.

Run package-birch.cjs from the workspace to recreate runtime assets; it reads preserved historical oak and maple conversion utilities. install-birch.cjs is a one-time backed-up local patch and must not be replayed against future game revisions.

## Validation

Passed species asset tests: finite geometry and dependencies, exact seasonal wood, eight limbs, leaf proportions, separate litter type and water exclusion; existing Beech and Maple asset checks remain passing. Passed tree order/cache/bounds/antialiasing, grass pan, ground cover, debris grass pressure, destination movement, Studio footprints and bare-branch snow regressions.

Hidden Chrome: six distinct trees, all four seasons, independent falls, 60 total debris capsules and reset passed without runtime errors. Birch-specific test observed 295 standing litter leaves, 786 after falling, impact deposits exclusively type 7, GPU snow-landing records and reset, without shader errors. These are functional checks, not final visual acceptance or an FPS benchmark.

Matching torn/clean-cut fracture geometry also passed for all 18 seasonal models, including the three new birch models.

Final validation: 158/158 combat regressions passed. All 18,306 detached-limb vertices match source seasonal wood within 0.0000195 model units.
