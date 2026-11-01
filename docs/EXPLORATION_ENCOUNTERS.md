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

## Candidate Rev 226 - exploration-matched combat materials

Combat retains 512px filtered source tiles instead of the Rev 214/215 64px reduction, preserving stone detail at tactical zoom. Floor texture still repeats once per exploration square. Wall material uses the exploration source proportions (3m width, 3.5m height), independent of the 35px tactical wall: the compact face crops the texture instead of squeezing a full masonry tile into its height. Horizontal wall seams are world anchored across neighboring segments. Original source PNGs are unchanged.

Exploration combat uses warm ambient surface shading, soft-light torch pools instead of additive bleaching, stronger warm wall-face illumination and a warm wall rim. Hex grid opacity is reduced from 50% to 28%. Existing light polygons, visibility, source radii, wall movement/LOS blocking, 1:2 terrain scale and 35px wall height remain unchanged. This approximates the first-person material appearance in the tactical canvas; it does not replace combat with the perspective renderer. Check normal and enlarged battlefield zoom, pan stability and walls hiding unseen floors.

## Candidate Rev 227 - shared scene style

SHARED_SCENE_STYLE.md supersedes Rev 226 wall texture cropping and separate warm overlays. Six courses occupy the complete 35px face. Shared material/light/object definitions support the 1:2 footprint without stretching door/window artwork. Display-footprint mip filtering, shared hemisphere/torch/lantern exposure and world-anchored exposure caches preserve detail. Perspective torches now cast shadows. Closed broad-face doors use the existing wood texture through the aspect-preserving display contract. Window/prop authoring and open combat door interactions remain future work.

## Candidate Rev 228 - door approaches and crossing

Closed doors no longer mark their entire exploration tile as a wall. Floor hexes on either side are standing spaces; the existing architectural door plane blocks crossing, and core-bisected hexes remain invalid. This fixes the hex immediately in front of a closed door without allowing wall clipping.

For player-controlled units, THROUGH DOOR [F] connects aligned legal standing hexes across an already-open doorway, skipping the intermediate NW/NE corner cells as standing destinations. Cost is two movement points. The existing full-move threshold, occupancy/footprint checks, departure reactions, landing area effects and guard reactions remain in the movement pipeline. No crossing is offered through closed doors, other walls, occupied landings or insufficient movement. Combat opening/closing of doors remains unimplemented; the command uses the exploration door snapshot. Ordinary AI pathfinding retains its normal hex steps.

## Rev 229 — open doors during combat

A player-controlled active unit beside a closed exploration doorway can use **OPEN DOOR [O]**, costing one movement point. The command is unavailable during startup, targeting, overlays, reactions and pauses. Both doorway axes use a near-side reach check and reject intervening architectural walls. If two doors are reachable, move closer to one. Opening shares the normal half-move/Full Move attack threshold; it does not move the unit. **THROUGH DOOR [F]** remains a separate two-point crossing with the existing occupancy, footprint and reaction rules. Closing, locks, traps and NPC door interactions are future work.

The opened-door list is saved into the encounter handoff before mutating combat rules. A storage failure leaves movement and door state unchanged. Rebuilding terrain removes the closed-door plane from movement, LOS, volume and light blocking immediately. The handoff survives combat reload and the existing return-to-exploration restore uses the updated list. The wider tactical leaf and oblique edge-on cutaway are described in SHARED_SCENE_STYLE.md. Test with scripts/test-doorway-movement.mjs and an authored room in both axes.

## Rev 231 - edge architecture

Version-2 maps project canonical edges into the existing architectural-wall engine. Floor still expands 1:2; wall height remains 35px. Closed door leaves block their actual aperture; stone jambs persist after opening. Windows reuse mode-specific wall openings: movement/volume/projectiles blocked, sight/light transmitted through the opening. Door records carry stable edge identities through open/cross commands and the saved exploration handoff. No whole floor square becomes a wall merely because an edge is blocked. Production footprint/core and transition checks remain authoritative where square edges cross the hex lattice. F remains the two-MP crossing; O remains one MP to open.

## Rev 233 - retain distant edge architecture

Version-2 combat now imports the complete authored map, superseding the five-square entry crop. The old crop could discard an authored thin wall six or more rows from an encounter entry and seal the floor with an artificial crop boundary. Tactical axial bounds now cover the full projected map, including skew, so imported floor and walls remain reachable as units move. Legacy version-1 terrain keeps its existing bounded behavior. Wall height, door widths and LOS rules are unchanged.

Blocked hexes use the same core/segment intersection test, evaluated only near each segment instead of scanning every wall for every map cell. Floor exposure is baked around the viewport rather than allocating a full-map lighting bitmap. test-exploration-combat-bounds.mjs covers the missing-wall coordinates, render visibility, 128-square bounds and collision parity.

## Rev 234 - full-map performance recovery

Rev 233 exposed repeated quadratic visibility work on the larger map. Cache stationary observer polygons across rules/UI/render queries; invalidate on observer/camera movement, viewport size, mode, replaced walls or explicit terrain rebuild. Visibility ray casting walks spatial buckets and stops at the nearest exact hit. Mode-specific wall intersections likewise use cached segment buckets, preserving windows, doors and projectiles. The full authored map remains imported.

Floor illumination uses a 12-screen-pixel sampling grid with smooth interpolation and unchanged material textures. Linear light colors and ambient terms are reused. A production-code benchmark on the supplied 136-wall map reduced ten identical visibility queries from about 4386ms to 18ms, and moved-party floor-light rebuilding from about 263ms (after intersection indexing alone) to 68ms with bounded illumination sampling. These are local component timings, not an overall FPS claim. CI compares indexed intersections to complete scans, verifies nearest-hit parity, checks cache invalidation, and requires substantially fewer ray tests.

Rev 235: unseen room floors retain 10% visibility under a 90% dark mask. Unit visibility and opaque magical obscuration are unchanged.

Rev 235 doorway update: normal adjacent movement now passes open edge doors without a crossing command or surcharge. Full-hex core inflation no longer seals open jambs; movement clearance provides a minimum one-hex lane to account for square/hex alignment. Physical artwork and LOS/light/projectile apertures remain authored. Open/close uses O/F, saves both states and rebuilds terrain/caches; occupied doorways cannot be closed. Regression tests cover both axes at 18 different grid alignments, using the production movement pipeline at 1 MP per step.

## Candidate Rev 236 — environment and experimental view controls

Combat compass N/W/E/S sits at the bottom of the right panel. Rotate Left/Right rotates the entire tactical view in sixty-degree steps about the camera anchor; six steps return to the original view. This is an isolated experimental canvas presentation, including scenery and sprite artwork, rather than new three-dimensional camera geometry. Unit/hex coordinates, movement keys, doors and tactical rules retain world directions; mouse targeting inversely transforms the rotated view. The compass follows world north. Rotation is temporary for the page and can be removed independently.

LOS boundary polygons, cache keys, terrain culling and both blackout canvases use the inverse-transformed zoom/rotation viewport. Hidden exploration floors retain ten-percent visibility, with hidden units still excluded. Door leaf top/end faces show depth equal to half the compact wall thickness; shared perspective geometry also uses half the thin-wall depth. Height, width, hinge anchors and ordinary one-point passage are preserved.

Indoor/outdoor markers travel with the source map. Combat exposure selects the shared indoor or daylight ambient profile per sampled map square, retaining wall-blocked torches and lanterns. Outdoor exploration squares omit ceiling tiles and expose the procedural sky background; their floor receives local daylight without brightening every indoor room. No weather/time simulation is introduced.

Successful spell commits face the caster toward the selected hex before incantation/action animation. Invalid/uncommitted and self-targeted casts preserve facing. Both the player dispatcher and direct targeted NPC/scroll resolvers use the common commit path.

Validation: test-combat-view-environments covers environment export/resize/defaults, local ambient, shared thickness, all six rotations at three zoom levels, inverse mouse targeting and spell commit facing. Visibility performance tests retain exact indexed/oracle parity and stationary reuse.

## Candidate Rev 237 — isometric azimuth and solid architecture

Supersedes Rev 236 flat image rotation. The existing ground plane is uncompressed, rotated in sixty-degree increments, then projected with the original vertical compression. Vertical height is subtracted after projection, keeping walls, doors, units and labels upright. Hex coordinates, footprints, facing rules and movement costs remain in world space. Six-direction artwork resolves view-relative facings; two-direction legacy sprites mirror to their visible side. Camera, world viewport, mouse picking and LOS use matching inverse transforms. Floor textures and baked illumination use the same affine projection. Compass labels remain readable and indicate projected cardinal directions.

exploration-combat-geometry.mjs describes solid rectangular wall/door footprints with independent elevation. Every leaf has two broad faces, two end faces and a top face. Open doors rotate ninety degrees about the same grounded hinge and preserve their physical width/height; depth is half the wall depth. Existing jamb geometry and a solid lintel surround the aperture. Closed-door collision remains authoritative, while its artwork is owned by the wooden leaf rather than a duplicate masonry block. Windows retain physical openings, projected glass and bars.

All map walls stay in the architecture pass. Walls, frames and leaves outside party LOS are rendered into an opaque local layer and then composited once at ten-percent visibility; overlapping faces do not accidentally accumulate full brightness. Hidden units retain the existing visibility guard. Full authored geometry is still used for collision and LOS.

Solid layers cache by owner identity, azimuth, display density, light/door state and texture readiness. Camera translation reuses the cached pixels. Viewport rejection happens before canvas allocation; distant walls do not allocate full-screen layers. Regression tests cover solid faces/hinges on both axes and both hinge ends, six azimuths, vertical height, inverse picking at three zoom levels, unseen compositing, cache reuse and invalidation.
