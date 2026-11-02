# Shared combat runtime - Candidate Rev 261

All entry points use startCombatSession, newGame/createCombatGame, the common renderer/material/sprite readiness gate and the production round/turn loop. Cancelled or superseded startup cannot replace a newer battle. Previewer controls only its roster, actor, fixed inputs and pause/result policies; every spell uses production resolution.

Exploration supplies its editor-format map and campaign return route. Combat Test and Previewer generate ordinary version-2 maps in combat-test-map.mjs. Wall Test has authored stone edges, doors, a window, sconces and indoor/outdoor cells. All use configureCombatMap and terrainForEncounter for their gameplay walls, bounds, walkability, surfaces and door geometry. The old synthetic renderer adapter is removed. The legacy hardcoded Wall Test room is bypassed during production startup.

The same continuous wall/opening LOS mask applies to every authored scene, leaving unseen floors at 10%. Authored indoor/outdoor cells also supply gameplay environment queries. Test door interactions change only the in-memory scene; they do not overwrite an exploration handoff or campaign progress. Real exploration encounters preserve their existing save/return behavior.

Lighting defaults to the complete earlier reference route, including per-hex spell illumination and wall fragments. WebGL still renders floor/solid meshes and spell effects through the shared 30 FPS scheduler. Shader direct lighting remains an explicit ?combatLighting=gpu experiment until its appearance is approved. No parameter and ?combatLighting=cpu use the restored appearance. Gameplay LOS and targeting remain CPU-owned.
