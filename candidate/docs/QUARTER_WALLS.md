# Wooden materials and quarter-round walls - Candidate Rev 264

Wood walls use assets/textures/exploration/wood-wall.png. Wood ceilings use wood-ceiling.png in the same directory. Both were generated with the built-in image_gen tool. Generation prompts, source output names, runtime dimensions and checksums are in wood-materials.generated.json. Door leaves retain door.png. Runtime images are 512px material copies; generated originals remain intact.

The editor offers four quarter-round orientations under Map functions, with stone/timber selection in Quarter-round walls settings. NW / NE above SW / SE makes a closed circle across a 2x2 group of floor squares. Each quarter has radius one authored square. Outer straight edges are replaced; ceilings retain the curved footprint, while floor covers both sides of the wall. Outside wedges inherit a neighbouring outer surface (outdoor preferred), or use the explicit outsideGround material. Isolated curves fall back to their own square floor. Doors/windows remain straight-edge objects; curved openings are not introduced. Remove quarter-round restores the square floor/boundary behavior. Adventure & map actions includes an unsaved wooden tower sample with an encounter for Test Map review.

Optional map.quarterWalls stores x, z, corner and material. Optional map.ceiling contains a/s/w string rows. Geometry comes from quarter-walls.mjs: 16 chords per quarter, shared by rendering, collision, LOS and light transport. Four quarters join at exact endpoints. Combat floors partition into the convex inside sector and 16 outside triangles, covering exactly one full square without overlap. Tactical movement can use either side; the actual curved wall segments block crossing. Curves block daylight and can mount sconces. Validation rejects duplicate quarter records and straight walls/openings on curved outer sides. Import/export and resize preserve authored records.

Non-combat screens return to their previous fonts. The battle retains Press Start 2P and result-panel sizing. First-person painted ambient applies to the actual Lambert materials, including wood.

## Independent faces and editor views

Optional faceMaterials: {a: 'stone'|'wood', b: 'stone'|'wood'} applies to straight edges and quarterWalls. Missing faces inherit material. For directed segments, a is the positive (-dz, dx) normal: South on horizontal edges, West on vertical edges, Inside on curves. Face b is the opposite. Cap/end faces use material. Door leaf textures are independent; these assignments affect jambs and lintels only. Existing maps retain their previous two-sided appearance. Import/export, Save maps, Test Map and resize preserve face assignments and optional outsideGround ('auto', 'grass', 'dirt', 'stone').

The View dropdown above the map switches Indoor/Outdoor, Floor Texture, Ceiling Texture, Ambient Light and Wall Texture overlays. Functional marks, encounter outlines and selection remain visible. Wall view shows paired bands: gray stone and brown wood. Click the actual band to select the wall and open settings; straight faces use cardinal labels, curves use Inside/Outside. Change either dropdown and Apply settings. Both-faces brush sets the defaults for newly painted walls. View changes do not paint or dirty the map.

This face schema is also suitable for future angled walls. Angled geometry and tools are deliberately deferred.

## Rev 265 sealed-area presentation

exploration-accessibility.mjs builds cached adjacency from actual floor polygons, including each side of curved walls. Walls and windows separate regions; every openable door connects regions regardless of its current open state. Starts, test/encounter origins and authored entrances/exits remain visible. Open exterior edges and outdoor map edges connect the surrounding ground. Regions with no route from these entries omit floor/grid, units, light sources and inward wall faces; exterior wall faces and caps stay visible. This is a presentation filter, not a change to movement, targeting or LOS rules. Static layout changes invalidate the cache; door animation and turn changes do not rebuild it.

Editor tool menus retain the current brush and painting does not reload face-material controls from the previous wall. With Select squares or Select edge active, selecting a wall band opens its face settings. Active texture brushes paint over bands without switching tools.


Rev 266: Sealed interiors are an opaque blackout, even where normal player LOS reaches an inward wall. Inward wall faces, adjoining end faces and caps draw unlit opaque black rather than being omitted; omitting them exposed the double-sided exterior face behind them. GPU batches disable all lighting on blackout surfaces. The CPU reference restores a cached visible-black mask after lighting so torch/spell effects cannot reveal the interior. Exterior faces retain ordinary appearance and LOS darkness.


## Rev 267 editor QA

Authored straight walls/openings may coexist with quarter walls, including outer square edges. Curves suppress only implicit boundaries; painting a curve no longer deletes explicit edges. Doors/windows still require floor on both sides. Export, resize, CPU LOS/movement and the production converter retain both geometries.

The editor View controls relevant Tools and Selection settings. Paintbrush and Erase operate in that view; Inspect / select opens actual selected data and retains rectangle encounter selection. Erasing a floor/ceiling texture clears its override, ambient resets to default, environment resets indoor, walls erase their edge/curve, and Objects erases only the selected object type, preserving other items on the same square. Mandatory starts and incoming entrance links remain protected. Surface Apply edits selected squares; edge/curve Apply edits the selected wall independently of the paintbrush. Wall bands have one canonical owner and explicit geometry-aligned positions. Texture previews use runtime material assets.

The upper-right overview switches Exploration Map / Combat Map. It uses shared production terrain, prism/door geometry, actual textures and ambient material injection, with full-height exploration and compact combat walls/hexes. Explorer doorway sizing remains view-only. It is a static, debounced cutaway overview with ceilings hidden, not an encounter or a separate gameplay engine. Maps are cloned for preview and never saved or mutated by rendering.

wall-joins.mjs welds display extrusion endpoints at shared joins and removes internal end caps. Actual CPU segments remain unchanged. Top-cap color no longer produces bright decorative highlights; CPU outlines do not add bright cap strokes. These fixes apply to every production combat entry.
