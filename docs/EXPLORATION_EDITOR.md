# Exploration Map Editor — Candidate Rev 209

Open **Exploration Map Editor** from the title menu. The first visit copies the Old Tollhouse into an editable Adventure Pack. Published exploration data is never overwritten by browser editing.

## Authoring workflow

1. Create a map or select the tollhouse. Maps remain 16 × 16, with an enclosed outer wall. Change the map name above the grid; generated IDs remain stable for connections.
2. Choose Floor, Wall, either door orientation, Toggle torch or Start position. Click/drag to paint, or focus a square and press Enter/Space. Select inspects a square without painting. Undo restores up to 30 operations/strokes, including map deletion or pack import.
3. Set the starting square and facing in the inspector. Entrances are named floor squares with an arrival facing; add/update them in the inspector.
4. Select a floor square, choose a destination map and named entrance, then Connect this square. Optionally create a return connection. The return destination uses an existing entrance on the source square or creates one with the selected facing. Existing exits at the target entrance are protected from silent replacement. Removing an exit removes only that directed connection.
5. Save maps stores the whole valid pack in this browser. Validation must be resolved before saving, testing or exporting. Duplicate creates a separate map with no outbound exits. Delete is blocked while other maps point to it. Referenced entrances are similarly protected.
6. Export Adventure Pack downloads one JSON containing all authored maps, entrances, exits, doors, torches and starts. Import replaces the working pack after confirmation; Undo can recover the previous pack until navigation. Save after importing. Browser save is a draft, not a repository publication; hand over the exported pack for integration.
7. Choose Map start or a named entrance and Test Map. This saves the design and creates a separate session snapshot. Gold floor rings and parchment X markers identify exits. Stepping onto an exit loads its destination and arrival facing. Arriving on a return exit does not immediately bounce back: step off and back on to use it. Escape or Return to editor restores the authoring page.

## Data and runtime

`js/exploration-authoring.mjs` owns pack validation and mutation helpers. Pack format is `adventure-party-exploration`, version 1; it contains a list of existing version-1 exploration maps extended with `entrances` and `exits`. Doors retain the original axis convention. Links reference stable map and entrance IDs, not filenames or arbitrary URLs. Validation checks map geometry, duplicate IDs, starts, entrance/exit positions, missing targets and reachability with doors open. Packs are limited to 100 maps and 2 MB on import.

`js/map-editor.mjs` owns editor UI and explicit browser draft persistence at `adventure-party:exploration-draft:v1`. Test snapshots live in sessionStorage at `adventure-party:exploration-test:v1`. Each test receives a new ID; runtime door state and discovery are scoped to that test and map. The existing renderer/movement/LOS modules run the test maps. Named entrances override the arrival state, never the authored start. Discovery and opened doors persist across map transitions within a test. A fresh Test Map starts a fresh test session; normal published exploration discovery remains separate.

The map grid, SVG map and first-person scene share one definition. This pass implements map authoring and connections only. Event authoring, encounter tables, combat handoff and campaign saves remain later work.

Run `node scripts/test-exploration-authoring.mjs` and the repository validation workflow. Browser QA should create/paint/save a map, connect two maps in both directions, test transitions and return to the editor, and verify import/export and invalid-link feedback.


Candidate Rev 210 adds location encounters and combat handoff; see [Exploration encounters](EXPLORATION_ENCOUNTERS.md). Random tables and campaign saves remain later work.
