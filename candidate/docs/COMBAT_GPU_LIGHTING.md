# Combat point lighting - Candidate Rev 261

Rev 261 restores the earlier lighting appearance by default using the complete CPU reference route. WebGL still renders map meshes and spell effects. The per-pixel direct-light implementation below is retained as an opt-in experiment using ?combatLighting=gpu; ?combatLighting=cpu and no parameter both use the restored appearance. Test scenes now use authored exploration maps and the same LOS mask.

Rev 260

Rev 260 extends this same pipeline to Combat Test and the Spell Previewer through the shared combat runtime. See [COMBAT_RUNTIME.md](COMBAT_RUNTIME.md). The original implementation details below remain applicable, except the former standalone-terrain CPU-only limitation.

Exploration encounters now evaluate torch/lantern Lambert response, linear RGB,
metre falloff and cutoff in the WebGL fragment shader. Spell emitters use the
existing fractional-hex falloff and additive display RGB. Floors, wall faces,
caps and both sides of door leaves share this evaluator. Torch intensity uses
the existing animated flicker. This replaces the separate floor torch-glow and
spell-light Canvas passes on this route; flame/sconce artwork remains staged.

Sprite bodies and Mirror Image copies are GPU billboards in the established
painter queue. Lighting is sampled at the unit's feet, converted to neutral
luminance, and capped at original artwork brightness. Alpha, mirroring,
invisibility, anchors and Enlarge size remain intact. Health bars, text,
casting silhouettes and ground shadows retain their independent rendering.

## CPU/GPU boundary

- CPU: ambient and daylight-through-openings exposure, wall/door/window light
  silhouettes, magical darkness, friendly-party LOS, distance visibility and
  light-based distance relief. Enemy initiative never changes the observer.
- GPU: per-fragment direct light color, distance, cutoff and surface normal;
  spell color/falloff; exposure composition and sprite brightness.
- Gameplay: original illumination/rules queries are unchanged. This introduces
  no GPU readback into the simulation, save migration or new animation loop.

The CPU rasterizes each light's production visibility polygon into a cached
256-square tile in a 2048×1024 RGBA8 atlas. Each tile covers that emitter's
range in world coordinates, independent of camera rotation. The GPU samples
nearest-neighbor silhouettes; it does not trace rays. Wall samples move 2.5 cm
outside the solid face to avoid self-occlusion. Thin-edge accuracy is bounded
by mask resolution; shadow filtering and GPU shadow maps are future work.
Opening a door, changing the viewport, moving an emitter or changing darkness
invalidates the corresponding silhouette. Flicker/color alone do not.

32 emitters fit the guaranteed WebGL 2 fragment-uniform budget. If a frame
contains more, the entire frame uses the complete existing CPU light route;
no source is silently dropped. Standalone Grass/Wall Test and the Spell Previewer use the same shader route.
The production effect sources, durations and shared 30 FPS scheduler remain
common to these modes. Legacy terrain is adapted to the same floor/solid meshes and shader.

`?combatLighting=cpu` selects the reference route for development comparisons.
`#battlefield[data-gpu-stats]` reports `lighting` and `shaderLights`; existing
`data-frame-stats` reports CPU render submission cost, not GPU completion time.

## Validation

- `node scripts/test-combat-gpu-lighting.mjs`: units/color spaces, surface
  samples, overflow, static mask reuse and door invalidation.
- `node scripts/test-combat-webgl.mjs`: projection, solid geometry, painter
  order and reference-route wall transport.
- `scripts/fixtures/combat-webgl.html`: real WebGL readbacks compare the
  physical shader against CPU calculations within two display levels; split
  surfaces, spell color, neutral sprite shading, resource reuse and context
  recovery run against the production backend.
- Controlled indoor/outdoor encounter: three torches, a party lantern, an
  opening to a bright courtyard, another closed door, and Fireball. Compare
  identical view/zoom with the reference query, sequentially to avoid competing
  animated tabs. Do not report browser background throttling as GPU throughput.

Ambient/daylight bakes, CPU silhouettes, actor geometry and Canvas framebuffer
copies still cost time. This pass does not promise universal 30 FPS or a full
GPU lighting/shadow engine.

Local sequential sample (same courtyard, view 60 degrees): 378 shader-route
frames over 47.3 s averaged 11.27 ms CPU submission; 370 reference frames over
46.3 s averaged 11.97 ms. This is a small single-session observation, not GPU
timing or a general FPS claim. Torch invalidation was about eight updates/s
in both routes; the scheduler still caps requested animation frames at 30.
