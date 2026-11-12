# Bow arrow pickup — local R238C304

Animated Workshop bows now use the existing Notch lead-in for an arrow pickup. The existing quiver GLB is attached to the upper torso, calibrated once at the pickup pose. A single arrow moves from the quiver to the drawing hand and then into the existing drawn-string alignment; release hides that arrow as the projectile launches. View rotation, body motion and shadow sampling share the actual geometry.

Source-clip timing is preserved. Optional bowTiming.pickup may specify the grasp time; older clips default to 35% of the Start-to-Draw interval. Clips with no lead-in keep their existing behavior. No new arm pose, attack delay, ammunition award or frame loop is added. Ammo visibility and unequipping remove spare/held arrows appropriately.

arrow-visual-profile.mjs supplies shaft width, feather dimensions, head dimensions and colors to the held geometry and the shared flying/lodged renderer. The held shaft is now thicker to match the established tactical projectile. Quiver arrows use that same geometry.

The selected draw recording stays at gain 0.425 (half its original 0.85) and starts no earlier than the actual draw phase. Release, flight, Flesh and Mud Thud routing are unchanged.

Validation: test-arrow-pickup exercises the actual UAL2 Notch clip, hand contact, four facings, string rest before nocking, release, ammo visibility, cleanup and shared dimensions. Related procedural-bow, marker/sequence, audio, lodged-arrow, grounding, sleep, missile and module-boundary checks pass. The user performs visual QA in the game.
## Local R238C305 scale correction

The held/carried/spare arrows now convert the existing 16 logical-pixel map length and 0.85-pixel shaft width through the actual model camera and battlefield frame size. This replaces the incorrect assumption that model scene units directly equal map metres. The shaft no longer stretches with the distance between the hands. Body, shadow and outline sampling receive the same frame size, with scale included in the pose cache key. Map arrows are unchanged.

The quiver model's width, height and depth are each halved: scale 0.58 becomes 0.29. Its mouth remains under the pickup point, and spare-arrow spacing is halved. The selected draw sound remains at half volume.

Validated held and spare arrow dimensions at three model frame widths, plus pickup, release, ammunition visibility, bowed string, audio, lodged arrows, direct rendering and shadow regressions. Visual QA remains with the user.
