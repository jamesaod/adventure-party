# Exploration stone-wall relief, Rev271

First-person-only material experiment. Combat retains Rev270 rendering and armor fixes. Removed wall UV lightmaps and dynamic combat shadow passes are not restored.

## Compare

Stone wall appearance offers Original (previous Lambert material) or Enhanced depth (test), with matte Phong shading, normal strength .65, shininess 6 and restrained specular color 0x111111. Enhanced is initially selected; the choice is remembered per exploration URL path. Switching replaces only references to stone-wall material, including frames and curved chords. Timber faces, ceilings, floors, door leaves, geometry, lights, existing shadows, ambient paint and map state stay unchanged. No scene rebuild, extra render pass, CPU bake or new animation loop is introduced.

The readout measures frame arrivals using the existing exploration loop: FPS and average milliseconds between frames, not GPU execution time. Compare modes from the same position and Pixel-style setting. Initial shader compilation can slow the first frames. Hidden-page gaps reset the measurement. User visual/performance QA is required; no universal speed claim is made.

## Asset and integration

assets/textures/exploration/wall-normal.png is 512x512 RGB tangent-space data derived offline from existing wall.png. Color artwork and attribution remain unchanged. Joint guides plus dark-mortar detection constrain relief to masonry seams instead of treating every photographic dark stain as a hole. Smoothed mortar bevels and mild stone detail become normalized tangent vectors, with periodic filtering/derivatives for repeating UVs. This is an approximation, not scanned brick geometry.

Reproduce: python scripts/generate-wall-normal.py from repository root, using Pillow and NumPy. No runtime image processing occurs. The normal uses NoColorSpace and matches the color map wrap, repeat, offset, rotation and anisotropy.

explorationMaterials loads normals only with wallRelief:true, supplied by the first-person page. Editor overview retains its original material path. Both comparison materials receive the existing painted-ambient shader injection. Future floor/timber changes require separate approval.

## Validation

scripts/test-exploration-wall-relief.mjs checks data dimensions, color space, UV alignment, matte settings, reversible material swaps, independent timber faces, unchanged scene/light counts and painted ambient on both shader types. Browser QA checks shader compilation, live switching, visual differences, saved preference and frame readout.
