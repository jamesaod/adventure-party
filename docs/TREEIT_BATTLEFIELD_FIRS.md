# TreeIt firs in the grassy battlefield test

Five TreeIt fir variants are centered on decorated grass hexes with stable seeded rotations. The test map now paints outdoor ambient light at 250% (previously the default 100%).

`combat-fir-trees.mjs` loads the exported model geometry and original shared textures. It produces transparent GPU renders for the existing foot-sorted combat compositor. Results are cached by tree variant, rotation, sun time, ambient setting and camera orientation; there is no extra animation loop. Sun or camera changes regenerate the needed views.

The foliage preserves the preview's green tint, second rotated layer, canopy-depth shading and one-third received shadow strength. Hemisphere illumination and canopy fill respond to ambient light and the solar clock. Ground shadows project the actual branch and foliage-card geometry along the current sun direction, merge its silhouette, and soften its edges. Sun shadows disappear at night. These renders provide self-shading; tree-to-tree shadows and local torch/spell illumination on tree bodies are not included in this pass.

The original body and shadow atlases remain as a fallback. Body capture dimensions are 384×512 with trunk anchor 192,448, a vertical span of 210 model units, and display height 240 tactical pixels. Authored size differences are retained. Ground shadows draw before actors; tree bodies retain the existing actor order. Gameplay LOS, targeting and tree coverage are unchanged.

The native TRE projects, OBJ/MTL exports, GLBs and preparation scripts are preserved in the development workspace under work/treeit-firs and work/treeit-preview. Seeds are 134, 961, 497, 567 and 953. Consult SAMPLE-LICENSE.txt and ATTRIBUTIONS.md before distributing artwork.

Validation: repository and combat renderer/environment checks; browser launch through the common combat initializer; morning/noon/afternoon/night visual checks. A fixed-view pixel check measured mean opaque tree brightness increasing from 58.7 at 100% ambient to 101.6 at 250%; nighttime produces no sun shadow. No browser script or shader errors were observed.
