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


## Candidate Rev 211 — map dimensions

Width and Height above the grid accept 8–128 independently. Resize keeps northwest coordinates, existing cells and metadata; new space is floor enclosed by a new outer wall. Old boundary walls remain editable internal walls. Shrinking crops terrain but refuses to cut out starts, entrances, exits, doors, torches, landmarks or encounter regions/anchors: move or remove those first. Undo restores the prior map, including terrain. Save/Adventure Pack export preserve dimensions. The editor scrolls large grids with readable cells. Exploration uses instanced wall/floor/ceiling tiles, dynamic parchment bounds and the same movement/discovery logic for rectangular maps. Boundary doors and open outdoor edges are still separate work.

Validation includes 128×128 and rectangular round trips, preservation, boundary collision and shrink protection in `scripts/test-exploration-sizes.mjs`.

## Candidate Rev 225 — encounter-area selection

Use Select to drag a rectangle. Shift-click/drag adds squares; Alt-click/drag subtracts. The Selection mode menu offers the same Replace / Add / Subtract operations without modifiers. New encounter area clears selection and starts drawing a new area. With Select, clicking any existing colored encounter square selects its entire area; the C-number/name buttons also select areas. Encounter area tool draws individual squares/rectangles without automatically selecting a whole existing area, useful for partial removal.

Save encounter area writes the chosen floor/door squares, color, name, MOB/count and deployment anchor. Walls and outer boundaries are skipped. Areas cannot overlap. Selected cells have cyan outlines; saved areas have translucent colors, boundary edges, C-number labels and a named legend. Existing rectangles remain readable and convert to explicit cells only when edited. Shift/Alt additions can produce irregular or disconnected shapes sharing one encounter identity.

Remove selected squares from areas trims every touched encounter. Delete selected encounter areas removes entire touched encounters. Removing the last trigger square removes that encounter. Both operations support ordinary editor Undo, as do area creation and edits. Selection itself is transient and does not alter the design. Save maps and Adventure Pack export retain cell sets, identity and color. Painting walls over explicit encounter squares is blocked until those squares are removed from the area. Resizing refuses to crop encounter cells or deployment anchors.

The bounded encounter still extends five exploration squares around entry: keep its enemy anchor within five squares of every trigger square. Each cell triggers the same ID, so retreat survivors and victory clearing apply to the whole area. This is a trigger region, not a room-filling enemy distribution setting.
