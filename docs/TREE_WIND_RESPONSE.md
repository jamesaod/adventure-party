# Tree wind and explosion response

Local first pass, 15 November 2026. Applies to the White Oak and Sugar Maple in the grass Combat Test. No SpeedTree source changes, mesh simplification, new animation loop, or gameplay damage changes.

## Motion model

`js/tree-motion.mjs` supplies a continuous GPU deformation field shared by wood, foliage and snow shells. Height-weighted trunk sway, radial branch motion and faster outer-crown movement use the existing Wind amount. The bottom .5 m remains fixed. Normals follow the bend using local GPU tangent samples. This is an approximate connected bend field, not per-branch skeletal simulation or native SpeedTree wind data. Individual branch stiffness and authored attachment weights remain possible refinements.

The current weather system exposes wind strength, not a direction control; the first pass uses a fixed world direction [.8,.6]. Inverse tree yaw keeps it stable as the map rotates. Both species react, including bare winter branches. Fallen trees disable the field so their existing fall/settling transforms remain authoritative.

## Render integration and cost

One timestamp is captured per combat frame and shared by body, outline/wood mask, snow and shadow passes. The shared 30 FPS scheduler drives visible motion. Material and depth shaders share uniforms; projected ground shadows call the same deformation. Self/ground shadow targets are retained and refreshed when the motion timestamp changes, with static caching restored at rest. Conservative bounds include motion to prevent clipping.

The CPU updates a small set of uniforms and evaluates at most eight recent event records per tree. All vertex movement and normal deformation happen on the GPU; no per-frame vertex scans, mesh uploads, synchronous readbacks or physics simulation. Animated shadows add GPU rendering cost compared with the former static cache. This implementation does not claim an FPS gain. Diagnostic counters record active and impulse-bearing draws; the last draw may be a static silhouette request, so its active flag alone is not a scene-wide status.

## Spell impulses

The production `animateFireballExplosion` hook emits one impulse at detonation. Direction points away from the blast; strength fades quadratically with distance. The visual influence radius is (damage radius in hexes + 3) times HEX_W. This additional range affects presentation only. Recoil is a damped oscillation ending after three seconds. At most eight events are retained, and at most four recent in-range impulses reach a tree shader. Combined displacement is clamped.

Reusable service: `adventurePartyTreeMotion.blast({x,z,radius,strength,started})`. Coordinates use the existing flat world plane: x from worldPointForHex, z = its y / .568329; radius is in that plane's units; started is performance.now()/1000. Other explosion spells can call this service at their actual impact event. Fireball is the only spell connected in this pass. No branch breakage, automatic felling, unit damage, LOS changes or extra leaf shedding is added.

New combat/session reset clears impulses. Reduced-motion preference disables tree motion. Wind settings remain controlled by the existing environmental slider.

## Validation

Hidden-browser GPU readback test (test-only) verifies roots/lower trunk stay fixed, crown displacement, outward blast response, distance rejection, recovery and disabled/fallen behavior. Production rendering covers green, fall and bare winter trees, outlines, shadows and shader compilation. Fireball delivery is checked via impulse-bearing draw counters; reduced motion is checked separately. Existing tree cache, shared frame pacing and spell-result/target-order tests pass. Check scripts are archived with tree production references.

Queued separately in USER_FOLLOW_UPS.md: foggy light shafts through branches and upward beams beneath trees. That is a thought experiment, not an implemented lighting feature.
