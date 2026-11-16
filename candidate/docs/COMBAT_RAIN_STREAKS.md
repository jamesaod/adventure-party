# Rain streak presentation — local R238C429

Only falling streak presentation changed. Three cached 8x64 soft-alpha sprites replace hard uniform lines. Brightness follows the existing solar sky value; dawn/dusk can select a warm tint and night a subdued cool tint. This is an artistic daylight approximation, not individual point-light scattering or true 3D depth.

Wind drives integrated sideways travel and streak angle from the same velocity. Two smooth gust frequencies modulate wind strength; zero wind remains vertical. Frame deltas are capped after pauses, and altering wind no longer multiplies the whole elapsed session time into the position. Existing intensity-dependent particle budget remains at most 660; no new renderer, GPU passes, frame loops, per-drop collision or per-drop gradients were added.

Ground splash rings, water-impact particles, wetness simulation and the existing small screen-space splash strokes are preserved. The quieter grass footstep gain stays at 0.48. This supersedes the rejected WebGPU trial without restoring its files or runtime.

Targeted validation checked the streak budget, vertical calm rain, wind direction/angle, lower night brightness and byte-identical legacy splash block. Full combat and browser smoke checks are recorded in the task completion. User owns visual QA. Local only.

## R238C430: zoom coverage and caret removal

Removed the obsolete V-shaped screen-space splash strokes (the reported carrots); actual puddle rings and impact particles are unchanged. Falling rain now saves the current transform, uses render density without map zoom, clips to the logical battlefield viewport, then restores the previous transform. Both the weather tint and streak distribution therefore cover the viewport at every map zoom, with the same bounded 660-drop maximum rather than simulating the whole map. This remains a viewport effect; it does not introduce new world-depth or line-of-sight occlusion.

