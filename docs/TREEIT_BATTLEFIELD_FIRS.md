# TreeIt firs in the grassy battlefield test

The grass-outdoors scenery uses five fir variants from EVOLVED's TreeIt fir sample. Twelve views per variant provide stable seeded 30-degree rotations. Changing the combat camera shifts two columns per 60-degree turn. Trunk anchors remain at the exact hex center with no random displacement.

The production hybrid renderer consumes transparent raster atlases through the existing terrain-tree draw path. This integration uses baked lighting and ground shadows. It does not load live GLB meshes or calculate tree-to-tree shadows in combat. The interactive GLB experiment remains in the separate treeit-preview workspace.

## Assets and anchors

- fir-body-atlas.png contains twelve columns by five rows of 384 by 512 pixel cells. The trunk anchor is 192,448.
- fir-shadow-atlas.png contains twelve columns by five rows of 512 by 512 pixel cells. The ground anchor is 256,448.
- Both sheets share a vertical capture span of 210 model units and a display cell height of 240 tactical pixels. All variants share one unit scale, retaining their authored size differences.
- Captures use an orthographic camera with ground compression matching HEX_ROW/(HEX_W*sqrt(3)/2), a hemisphere light, and a directional light. Foliage has the approved green tint, second rotated layer, inward shading gradient, and one-third received shadow strength. Ground shadows use filled foliage cards and PCF filtering.

Ground shadows draw before units, walls and tree bodies. Bodies remain in the existing foot-sorted actor queue. The current shared exploration converter suppresses legacy decorations, so only the combat-test grass scenario explicitly enables these trees. Authored exploration maps and the spell previewer retain their existing decoration behavior.

The five native TRE projects, OBJ/MTL exports, GLBs, texture maps and bake script are preserved in the development workspace under work/treeit-firs and work/treeit-preview/bake-battlefield.cjs. Seeds are 134, 961, 497, 567 and 953. TreeIt global scales are 700, 600, 1050, 1050 and 1050. Consult the copied sample license and ATTRIBUTIONS.md before distributing artwork.

## Verification

Repository validation, combat WebGL tests, and combat view/environment tests pass. Browser QA starts Grassy Battlefield through the common combat initializer, loads both sheets, finds all five variants, and cycles all six camera angles without script errors. The reference camera contains 23 decorated hexes. Game rules, tree coverage and scenery clustering retain their existing values.
