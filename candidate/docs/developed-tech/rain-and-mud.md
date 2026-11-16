# Rain and mud prototype

Local entry: `/rain-mud-lab.html`. Isolated from combat; no saved-game schema changes.

Uses the published Orc Warrior and Workshop move clip. An 81 × 81 grid over 16 metres stores moisture, water depth and persistent soil displacement. Surface updates run at 10 Hz; rendering follows display refresh. Rain and splashes have fixed particle budgets. Pairwise shallow-water redistribution conserves transfers; boundary drainage, infiltration and evaporation are simplified. Soil and grass accept shallow footprint stamps; stone does not. Foot contact timing is approximate, not bone-driven.

Controls: rainfall, drying, softness, wind, walking, roof visibility, pause, dry reset and pre-soak. Roof visibility does not change shelter exposure. Click terrain for a manual footprint. Rain is accelerated for inspection.

Limitations: no scene reflections, no fluid physics, no grass geometry, no mud carried on boots. Puddle patches are discrete cells. Footprints use a bounded height-field stamp and raised rim, not a volume-conserving soil solver. Drying preserves tracks; rain erosion and terrain integration are future work. Renderer submission and surface-update costs are shown; these are not GPU timings. User visual QA remains pending.

Validation: `node scripts/test-rain-mud.mjs`.

## Grassy-field revision

The lab now starts dry with shelter disabled, using battlefield grass-short-v1, its normal map and dirt-path-v1 textures. `rain-field-cover.mjs` adapts the production `createGroundCover` geometry, deterministic placement, wind, rocks, sticks and blade-edge filtering to the lab perspective camera. It preserves shared combat modules and changes only lab projection/depth behavior. The field is entirely grass/soil rather than three artificial material strips. The production worn-patch formula supplies bare areas. This is an isolated field sample, not a loaded combat encounter.

Wetness darkening, cell puddles and deformation are provisional visualization controls, not accepted gameplay rules. Next design: separate water/wetness from soil softness and churn, using an inverse-snow style signed deformation field. No new production mud architecture is implemented in this revision. Technical browser smoke check loads the Orc, textures and grass with no console errors; visual matching remains user QA.
