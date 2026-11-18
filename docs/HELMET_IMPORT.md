# Tripo helmet workshop experiment

Both local character creators include the user-supplied horned helmet. Open `character-creator.html?helmet=tripo` or `synty-workshop.html?helmet=tripo` to start with it selected. Choose No custom helmet to restore the original head, hair and accessories. Size, position and yaw adjustments are saved in editable designs and baked into GLB exports.

The FBX and texture were extracted from `tripo_convert_8e3b1e2a-3677-4327-8ec8-d3a7b153e706.zip` and converted with Blender 5.1. The custom GLB keeps the texture and geometry. Preview/export material uses metalness 0.15 and roughness 0.7 for visibility without environment lighting. The helmet remains a rigid mesh parented to the Head/head bone, preserving its fitted rest transform; it needs no skin weights. Its chainmail section also follows the head rigidly, so shoulder clipping in some poses remains possible. This method does not provide robe/cloak deformation or cloth simulation.

The full head and facial parts always remain visible, including when importing older designs that requested a hidden head. The imported alpha-blended helmet material is explicitly rendered opaque with depth writing; geometric openings remain open. Quaternius head width includes ears and receives a separate fit factor. Synty body shapes and outfit swaps rebuild the attachment when the character assembly is rebuilt. Live shape sliders can require a fit adjustment or Reset helmet fit.

The supplied helmet is separate from Quaternius CC0 and Synty's proprietary assets; no new license is assigned to it. No publishing performed.

Validation: both browser GLBs contain their helmet under the head bone, embedded textures and three animation clips. The helmet regression checks head-relative transform invariance during animation and GLB round trips for two Quaternius bodies and eight Synty presets. Both original workshop suites pass. Run `node scripts/test-workshop-helmet.mjs <absolute-repo-path>`.

