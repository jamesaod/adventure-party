# Candidate Rev 274: wall visibility and stepped sunlight

Whole floor hexes sample cached projected wall shadows at their tactical center. Wall fragments use their owning hex, uniformly across the fragment. This is a ground-based solar approximation, not a 3D wall shadow map. Authored indoor areas retain their own lighting.

The filtered floor exposure bitmap contains ambient and local light without solar shadowing. A constant per-face linear Sun-loss attribute removes only the outdoor direct-sun share after exposure sampling; torch/spell gradients remain independent. Zero correction retains the original shader output exactly, including sealed black surfaces. Door/time changes invalidate the existing shadow field; camera/MOB movement reuses it. No extra pass, depth map, atlas or animation loop.

Rendered wall thickness is compressed while CPU LOS footprints are not. Friendly wall-visibility probes now exit the owning wall and immediately joined shells toward the observer before testing the existing visibility polygon. Unrelated occluders, face direction, sealed blackouts, movement and targeting stay authoritative.

Checks: compressed/diagonal/door probes; joined-neighbour cache; constant GPU attributes; production exposure isolation; existing visibility, sealed-room and rendering suites. Isolated browser fixture uses two sealed towers and a closed connecting door, with shadow toggle, time changes and geometry-cache checks. User performs final visual QA.
