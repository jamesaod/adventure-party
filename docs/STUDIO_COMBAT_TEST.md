# Studio combat testing (Candidate Rev 165)

## User workflow

1. In 3D Studio / Pixel Studio load the model, choose the existing **MOB / player character** archetype, weapon capture type and footprint, then capture the desired action poses. The model name does not choose new combat statistics: for example Orc Leader artwork can still be tested with Orc rules if that is the selected archetype.
2. **Test in combat** saves the exact tested workspace plus the selected weapon type's available preview frames and pose references. Combat Setup shows that model under Player Characters.
3. **+ Add MOB** chooses each opponent type, count and Hostile/Friendly faction. The roster starts empty. Empty tests stay available for solo inspection rather than immediately winning.
4. **Begin Battle** creates one controlled test character using that captured model and footprint. Configured opponents/allies use their own existing factories/artwork. There is no extra Carl and no six-copy formation. Inspect a pose before starting, or press Space for ordinary turn-based movement and combat.
5. **Add / change opponents** reopens Combat Setup. Begin Battle restarts the test with those choices. It is a setup change, not an in-progress reinforcement mechanic.
6. **Return to 3d studio**, manual exit, victory or defeat returns directly to the exact tested workspace without loot. Model, MOB, pose-library and preview scope are retained. Capture edits remain explicit; testing does not modify repository assets or replace the portable Unit Package export.

This is visual/control QA using implemented archetypes. A browser-authored MOB Creator definition still requires repository integration before its custom statistics/abilities become a live combat factory. The existing authoring gate remains in place.

## Root cause and implementation

The old `studio-kobold` mode always created Carl as the main player and placed six monster copies around him; player archetypes had separate copy/opponent paths. Adding a roster row also switched the mode to `custom`, abandoning the Studio draft. In addition, outbound navigation discarded query parameters used by `authoringWorkspaceSuffix`, so model/pose-library tests could read a different IndexedDB draft and return to the wrong workspace.

- `makeStudioTestPlayer` uses the manifest's existing factory, changes identity/control to the primary player, attaches only the selected sprite set and footprint, and validates all occupied hexes. It does not change rig, animation, equipment placement or render scaling.
- `newGame` uses `deployConfiguredCombatMobs` for both normal and Studio tests. Adding rows retains Studio mode. An empty Studio roster is a sandbox; ordinary victory behavior is unchanged.
- Existing player turn logic drives the test character. Fighter-only Sweep and character-sheet equipment synchronization must not be applied to monster test players. The read-only archetype sheet preserves their statistics. Carl's ordinary player and existing shared attack, AI and movement systems remain in use.
- `studio-capture.mjs` keeps authoring query parameters on outbound navigation. `studioReturnUrl` carries `model`, `mob`, `poseLibrary` and `preview` back with `studioRestore=1`; both links and automatic exits use it. Keep the existing atomic save-before-navigation and tested-copy restore semantics.
- `sprite-set-runtime.mjs` labels the selected test player and opens the existing opponent setup. Registered models, FBX/GLB assets, pose libraries, combat factories and Unit Package schema remain unchanged.

## Reproduction and regression checks

Use `3d-studio.html?model=orc-leader-male-uniformed&poseLibrary=humanoid-medium`, capture a Ready pose, then Test in combat. Verify the same query scope reaches the battlefield and return link. Add two hostile Kobolds through the number stepper. Verify one named Orc player, two opponents and three initiative slots; open Character and confirm Orc AC/THAC0/weapon remain unchanged. Return and check the six Ready captures survive. Repeat with an empty roster and ordinary non-Studio combat.

`test-studio-footprints.mjs` covers all existing archetypes/footprints, one player, selected sprite/scale metadata, configured allies/opponents, occupancy, character-sheet isolation, empty-test behavior and ordinary Carl regression. `test-combat-roster-setup.mjs` exercises adding rows without leaving Studio. `test-studio-combat-exit.mjs` covers scoped manual/victory/defeat returns; directional and capture tests preserve pose/facing selection. Run Adventure Party Validation and verify the published candidate bytes after merging.

## Noon shadows (Rev 168)

Studio, setup and battlefield now use fixed noon with no time sliders. Legacy `sunHour` values in URLs, preferences and restored workspace settings are ignored; outbound Test in combat removes the old parameter. Model scope and capture restoration are unchanged. See [Unit sun shadows](UNIT_SUN_SHADOWS.md).
