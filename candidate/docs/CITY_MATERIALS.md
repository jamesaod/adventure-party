# Illustrated city materials

Local integration adds City Red Brick and City Beige Stone to the wall brush and both face inspectors. Shared material IDs survive save/export/resize, curved walls, windows, doors, exploration, editor overview and combat conversion. Existing walls are unchanged. New wall artwork uses approximately six courses at full wall height; geometry, movement and LOS are unchanged.

City Wood Floor is a persistent floor paint selection (`w` in ground rows). It uses the generated plank artwork at a shared two-square repeat with world-aligned phase, including partial curved floors. Editor swatches use the real assets. Materials use existing matte lighting; no additional lighting pass or generated normal map was added.

Assets: assets/textures/exploration/city-wall-red-brick-v1.png, city-wall-beige-stone-v1.png, city-wood-floor-v1.png. These reference-based built-in image-generation assets remain local pending user visual QA. Exact texture seam appearance remains for visual review.

Validation: test-city-materials plus wall-surfaces, quarter-walls, exploration-edges, terrain-transitions, editor-qa, exploration-rendering, combat-runtime, combat-webgl and combat-gpu-lighting.

Gray floors: City Gray Stone Floor (`c`) and City Gray Flagstone Floor (`f`) join the shared city floor registry. They share the wood floor world-aligned two-square texture repeat and matte material pipeline in exploration, overview and combat. Floor paint, inspector, actual artwork swatches, save/export/resize and combat handoff support both. No normal maps added in this asset integration pass.

Opening brush correction: Objects > New opening settings now offers Surround material, defaulting to Match existing wall. Placement omits material overrides in this mode so paintEdge preserves both authored faces. Explicit choices apply both faces. This fixes the opening brush previously copying the hidden wall brush and replacing masonry unintentionally. Door leaf artwork remains wooden.

Red brick size adjustment: doubled horizontal and vertical texture repeats, halving brick width and height in exploration, overview and combat. Beige stone, door leaf and wall geometry remain unchanged.
