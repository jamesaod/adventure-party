# Three-band cartoon proof of concept — Rev 205

In Studio, open **Pixel rendering & lighting → Lighting → Shading** and compare **Standard** with **Cartoon — 3 bands (experimental)**. Standard remains the default for old workspaces and packages. Compare the same paused pose at native sprite size. Existing outline, palette and color controls still apply; this experiment adds no new outline pass.

`js/banded-lighting.mjs` temporarily substitutes Three.js toon materials for lit Standard/Physical, Phong and Lambert materials during an ordinary render. A nearest-filtered three-texel gradient creates the lighting bands. Texture color, alpha, normal/bump maps, skinning and morphs are retained. Metallic/specular shading is deliberately absent; emissive color remains. Environmental fill and texture shading can soften visible band boundaries. This is a shading comparison, not texture simplification.

Original materials are restored in `finally`, including on render failure. Materials shared by meshes use one cached toon counterpart; source disposal releases it. Only the gradient and substituted materials are owned by this helper, never the model's textures. Unlit helpers and the separate ground-shadow pass retain their original materials.

`lighting.shading` stores `standard` or `toon-3` in the existing workspace/capture/appearance settings. The main viewport, six-facing atlas and future PNG captures share this setting. Changing it uses the existing lighting invalidation: captured pixels remain preserved but need recapture for the new look. Combat's existing equipment-aware renderer honors the saved flag, and its full-recipe cache distinguishes the modes. Nothing is rewritten in model assets or animation data.

Validation: `scripts/test-banded-lighting.mjs` verifies default passthrough, material arrays, texture/color/alpha preservation, restoration on failure, cache reuse and disposal ownership. Browser QA must compile the actual shader and compare a textured model in both modes; structural tests alone cannot establish visual quality.
