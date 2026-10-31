# Exploration encounters — Candidate Rev 210

The tollhouse now has an Orc patrol in its north room. Walk north through both doors to enter tactical combat. Press Space to begin; use the normal combat controls. Retreat to exploration saves current HP, inventory/equipment, conditions and surviving opponents. Victory returns to exploration and prevents that encounter from triggering again. Defeat requires Restart on the exploration page.

## Authoring

In Map Editor, select the northwest corner of a trigger region. Enter its name, width/height, choose an encounter-enabled MOB from the existing library, count (1–6), and the enemy deployment anchor (one-based column/row). Add/update encounter; C marks its region. Select its origin to edit or remove it. Save and Test Map. Adventure Pack export/import includes encounters. Existing saved drafts are preserved and do not automatically gain the sample patrol.

## Integration

`exploration-encounters.mjs` owns trigger validation, outcomes and square-to-hex terrain conversion. Rev 212 expands each exploration square to two tactical hex widths (1:2); tactical movement distances remain unchanged. The bounded area extends five exploration squares from the entry point. Solid wall edges and closed doors become existing engine architectural wall segments; outside cells are blocked. Deployment validates full footprints and connected movement space. Partial hexes beside walls can be conservatively blocked, so narrow passages may need widening.

`exploration-encounter-client.mjs` creates the session handoff. `exploration-combat-hooks.js` runs after ordered engine startup, uses existing makeFighter/makeLibraryMob factories, and provides retreat/finish persistence. Stable player ID remains `player`, required by the engine turn lookup. Refresh restores the initially saved encounter rather than sampling another opponent set. Units retain their sampled class levels, HP and equipment across retreat/re-entry. Results are JSON snapshots; no duplicate combat engine or asset renderer is introduced.

Normal test progress is browser-local and scoped to map geometry/encounter definitions. Editor tests use isolated session storage. Restart clears the current map's encounter progress and discovery. This is a one-character, per-map proof of concept, not a campaign party/save system. Other map tests do not share Carl's progress yet. Combat snapshots are saved at entry and explicit return; closing the browser mid-round does not save that round. Doors cannot be changed during this combat POC. Victory loot is recorded in the encounter result, but an exploration loot UI and campaign XP award are future work. Random encounter tables, mixed MOB groups and outdoor edges remain separate updates. Rev 211 enables maps up to 128×128.

## Verification

Run scripts/test-exploration-encounters.mjs and repository validation. Browser test: walk into patrol, begin combat, retreat, confirm reduced HP on party list, re-enter with the same opponents, and complete combat. Cleared region must no longer retrigger; Restart must allow a fresh test.


## Candidate Rev 211 — explicit encounter startup

Encounter navigation includes the build revision to avoid an old cached index page. An opaque Preparing encounter screen stays up while ordered scripts and sprites initialize. Missing session handoff, unavailable MOBs, interrupted starts and deployment errors show the actual error with Retry and a contextual return to the exploration/editor test, instead of leaving the launcher visible. The R shortcut cannot reset combat behind the encounter snapshot; restart from exploration instead. `scripts/test-exploration-startup.mjs` verifies delayed readiness, delayed combat initialization, missing handoff and cancelled startup recovery. Browser QA covers entry, retreat, exploration Restart and repeat entry on a 128×128 editor map.

The reported intermittent menu return was not reproduced in the local restart test. The prior implementation exposed the launcher during sprite loading and on pre-combat exceptions; these paths are now covered by explicit loading and error UI so any remaining failure is diagnosable without losing the handoff.

## Candidate Rev 212 - combat terrain rendering

The encounter crop remains five exploration squares around the entry, with a 40x32 tactical bound for the expanded terrain. Ordinary combat keeps 40x20. Floor coverage is the exact union of room polygons. Floor lighting, grid, LOS and ground shadows are clipped to that union; the LOS floor pass runs before depth-sorted walls and units. Exploration combat skips the legacy post-LOS unit repaint, which selected a Kobold fallback for library MOBs and doubled the Orc image. Darkness spell volumes still render.

The existing exploration floor.png and wall.png textures are loaded before combat starts, then used by the shared architectural renderer. Floor pattern placement is world-anchored so camera movement does not slide the texture. Combat doors and discovery of further rooms remain future work. Test with test-exploration-rendering.mjs and enter the sample patrol from exploration; check textured walls, clean room boundaries and single Orc sprites.

## Candidate Rev 214 - room edges, filtered materials and torches

Exploration floor presentation uses the existing observer LOS polygons directly, clipped to room floors. Hex-center classification no longer darkens the visible side of a wall-bisected hex. Tactical unit visibility and movement still use existing rules; obscuring spells retain their tactical mask. The fixed architectural test-sun shadows are disabled only for indoor exploration encounters.

Original exploration texture files remain unchanged. Combat caches a progressive high-quality reduction to 64px per source, then repeats the stone over two exploration cells. This removes undersampling grain while preserving the source colors and stone joints. No image-generation step or external tool is required to reproduce the material.

Map torches within the encounter crop project to nearby valid floor hexes. They enter the shared illuminationSources pipeline with warm RGB 255/166/77, intensity 1.2 and a three-hex radius, using existing wall occlusion, floor lighting and wall-face glow. Visible torches have a depth-sorted flame/stand marker. They are map fixtures, not inventory items or new spell effects; no fuel timer is introduced. Static lighting avoids a continuous redraw loop. Floor ambient presentation is dimmed slightly to retain contrast around the torch pools.

Regression tests cover polygon-based floor masking, cached texture reduction, removal of indoor test-sun shadows and valid/crop-bounded torch placement. Browser QA: enter the patrol, check floor/wall boundaries, torch pools and source visibility, then begin combat.

## Candidate Rev 215 - smaller filtered stone and unit-render gate

Combat stone repeats at one exploration cell (half Rev 214 in each floor dimension), retaining progressive 64px prefiltering and enabling smoothing only for the floor/wall material passes. Tactical grid opacity is 50%. Original source images and unit pixel sampling are unchanged. Canvas scaling reference: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Using_images .

showCombat covers the battlefield with Please wait, rendering Units until all initial unit appearance promises finish. It follows superseding promises and reports render failure or a two-minute timeout with Retry, rather than revealing fallback sprites. The same gate is used by ordinary combat and exploration entry. No extra render jobs are started by the gate.

## Candidate Rev 216 - shared exploration wall and door meshes

exploration-materials.mjs is now the common source for the original sRGB textures, Lambert materials, anisotropic filtering and framed hinged-door geometry. Both the first-person exploration scene and combat use it. Combat creates the same 3x3x3.5 stone block geometry for wall cells bordering floor. Closed and open doors use their exploration hinge pose.

exploration-combat-scenery.mjs renders these meshes through an orthographic camera aligned to the 1:2 tactical projection, caches the small set of wall/door images, then disposes its WebGL context. Existing combat actors depth-sort the cached scenery with unit sprites. This avoids new WebGL work every combat frame. Wall sprites retain full exploration height and can obscure units behind foreground walls; a cutaway presentation is a possible later refinement. Lighting of the cached wall art uses the exploration hemisphere/lantern setup; existing map torch floor lighting remains. Real-time wall relighting and interactive combat doors are not part of this pass.

The exploration floor conversion, tactical collision/LOS, 50% grid and unit-render wait remain. Startup waits for scenery preparation as well. Tests cover shared door dimensions/hinges, mapping of visual wall cells to existing collision boundaries, and open/closed snapshot poses. Browser QA walks through both exploration doors and enters combat using the shared materials.

## Candidate Rev 217 - restore 1:1 scale

One exploration square again spans one tactical hex width. The shared terrain projection drives floor, wall/door scenery size, torch placement and collision together. This supersedes the Rev 212 expansion; current 3D wall/door materials, loading gate and 50% grid remain. The five-square crop and tactical movement rules are unchanged.

## Candidate Rev 218 - restore compact combat walls

Reverts the Rev 216 combat scenery presentation to the existing tactical wall renderer (35px height, 3px thickness). The 1:1 terrain projection, filtered exploration textures, torchlight, 50% grid and unit-render loading gate remain. Shared full-height geometry still serves first-person exploration; combat no longer creates the cached 3D wall/door scenery.

## Candidate Rev 219 - light and sight boundaries

Unseen floor is opaque, not a 33-percent tint. Torch floor illumination uses the existing light-mode visibility polygon and projected radial falloff; party LOS is applied afterward. Hidden torch markers are suppressed. Compact walls and 1:1 terrain remain.

Projection callbacks must wrap screenPointForWorld(point): passing it directly to Array.map injects each vertex index into its optional elevation argument and warps LOS/light masks. The regression stub now checks zero elevation.

## Candidate Rev 220 - solid wall footprints

Terrain retains solidBlocks for occupied map cells. Existing floor-facing boundaries remain authoritative for movement/LOS/light; no internal block edges are added. Visible wall boundaries reveal their corresponding stone caps at the existing 35px height. Adjacent visible caps merge into row spans with shared world-anchored texture and no internal outlines, depth-sorted with existing faces and units. Doors remain separate boundaries. Hidden blocks do not reveal caps.

## Candidate Rev 224 - reference LOS baseline

User reference screenshot requires compact floor-facing wall boundaries with black unseen space, without the solid textured top caps introduced in Rev 220. Restored the Rev 219 exploration rendering/terrain path, preserving opaque floor LOS, correct zero-elevation polygon projection, wall-clipped torch illumination, 1:1 scale, encounter persistence and unit-render startup gate. This is a baseline for further user-directed LOS refinement, not final visual approval. Revs 221-223 remain superseded. See PERSISTENT_GAME_LOOP.md for the recovered architecture and remaining campaign work.

## Candidate Rev 225 — area triggers and 1:2 horizontal scale

Explicit encounter cells support irregular trigger areas; legacy x/z/width/height rectangles still load. Shared encounterContains/encounterCells helpers govern editor display, validation and runtime triggers. Stable encounter IDs preserve whole-area victory semantics. Explicit cells, colors and bounds survive pack export/import; overlap and invalid cells are rejected. Existing geometry/encounter-based progress scoping remains unchanged, so editing an area's definition starts a different scoped test/progress record.

One exploration square now spans two tactical hex widths in the floor plane. Projected floor dimensions, wall lengths, closed-door spans, spawn placement and torches use the same scale=2 conversion. Wall height remains 35px and thickness remains 3px; compact wall/LOS rendering from Rev 224 is retained. Ordinary combat dimensions, movement distances and unit scale are unchanged. Production collision tests traverse one-square corridors and both orientations of an open doorway; the same doors block when closed. No full-height wall meshes or solid top caps are reintroduced.

Encounter snapshots now record terrainScale. Existing untagged 1:1 enemy positions are doubled on re-entry; HP, equipment and survivor state remain intact. Newly saved 1:2 positions are not scaled again.
