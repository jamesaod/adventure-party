# American Beech production record

One Fagus grandifolia specimen, authored in SpeedTree Modeler 10.2.0 on 15 November 2026. Grassy Battlefield now places it at axial (-4,3) alongside the preserved White Oak and three Sugar Maples. No dropdown replacement. Use the environmental seasons and God Tool to compare it and fell/reset it independently. Local integration only; final appearance and interactive performance review remain with the user.

## Botanical and authoring decisions

See [research and source links](../tools/tree-production/american-beech/RESEARCH_AND_AUTHORING.txt). Oregon State describes smooth blue-gray bark, spreading habit, pointed alternate leaves 5–13 cm long with 9–14 vein pairs. Virginia Tech describes about 60 ft height and gold-brown autumn foliage. This woodland-edge specimen has an asymmetrical spreading crown, silver-gray bark, tapered trunk, and gold/copper fall leaves. The mature winter version is bare; juvenile marcescence is not implemented.

Saved a new source from the broad maple as a generator scaffold, randomized once, then changed trunk length to 48 ft, primary branch length to .45 of parent and gravity to +.035. It is not a recolored maple asset. All Beech seasons preserve this new branching. Main foliage cards are 2.3 ft clusters, not 2.3 ft individual leaves. The cluster uses narrow toothed leaf artwork, alternating/distichous phyllotaxy, .4 internode length, fold .05 and curl .06; rebuilt cutouts respect the portrait texture aspect. Individual particle/litter cards are 13 cm tall and 6.86 cm wide, including petiole, with an approximately 10 cm blade. Canopy leaf sizes vary within the baked cluster.

Green and copper single-leaf artwork and smooth gray bark were generated specifically for this asset. The fall leaf is an edit of the green leaf; both native cluster seasons use the same green opacity mask for exact silhouette alignment. Cluster baking is native SpeedTree F10 at 2048 square, with safe frame, supersampling and color streaking. Bark uses the new color map with obsolete maple normal/AO/gloss textures disabled. Some internal generator/material labels retain Maple names; runtime material names are species-prefixed to avoid shared-material collisions.

## Exports and runtime mesh

Games OBJ, all LODs, feet converted to metres, scale 1, source Z-up, no flips. Raw exports remain in the workspace outputs/american-beech folder. The repository archive contains five editable SPMs, original leaf/bark artwork, baked cluster maps, conversion scripts, research and SHA-256 inventory. Source files can still reference the working folder and the original scaffold's small twig materials; this is not a fully portable dependency bundle.

| Version | Wood triangles | Foliage triangles | Total |
|---|---:|---:|---:|
| Native full | 35,674 | 46,372 | 82,046 |
| Native LOD1 | 12,188 | 25,496 | 37,684 |
| Native LOD2 | 1,977 | 10,794 | 12,771 |
| Runtime green/fall | 12,188 | 10,794 | 22,982 |
| Runtime winter | 12,188 | 0 | 12,188 |

Runtime combines LOD1 wood with native LOD2 foliage, as with our maples. Card expansion at lower LODs yields a visible mesh maximum of 18.6732 m (61.26 ft) above the authored ground; full detail is 18.2834 m (59.98 ft). Runtime crown bounds are approximately 59.42 × 58.52 ft. Source-ground Z=0, common 43.38933076913966 units/metre and runtime scale .18 are preserved, with buried roots clipped. Green/fall/winter wood is byte-identical after normalization of equivalent UV repeats.

## Game integration

Registry base 29: green, fall, winter, stump, fallen and eight detached limbs at indices 29–34. Matching stump and log use the established continuous 1 m trunk split; detached limbs are extracted from this Beech's connected LOD1 branch surfaces. Shared GPU wind/blast motion, outlines, shadows, tree snow, six-direction falls, impact leaves, weather-shelter removal, navigation obstacles and complete fallen-grass pressure remain the existing implementations.

Beech has radius-2 tree/grass exclusion with .65 feather. Ground litter is type 6, with its own portrait template, green/copper textures and GPU snow-landing state. Particle and ground artwork share the same files. Leaves remain excluded from water. No terrain textures were replaced. Ground-cover texture loading is now per botanical species rather than repeating the same maple maps for each variant; the Beech adds one litter batch and one snow-landing state, not a new animation loop.

## Reproduction and validation

Adapt package-beech.cjs from its original workspace location; it explicitly depends on the preserved maple converters and historical oak scripts. Do not replay old integration patches. The package builds glTF/bin and matching wood without editing game code. Runtime assets live under assets/terrain/american-beech.

Run scripts/test-american-beech.mjs plus existing maple catalog, ground cover and cover optimization checks. The hidden-browser check covers five simultaneous trees, all seasons, independent falls, 50 combined navigation/pressure capsules and reset. Visual approval and real interactive FPS comparison remain user QA; triangle counts alone are not a performance benchmark.

## Bark tone adjustment

User reference review: reduce textured Beech wood albedo multiplier from .45 to .30 in combat-fir-trees.mjs. This applies once to shared bark materials across seasons, stump, log and detached limbs. Leaf materials and untextured cut faces retain their existing values. The original artwork stays preserved; this runtime calibration adds no per-frame work.
