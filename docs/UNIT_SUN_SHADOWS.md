# Unit sun shadows — Candidate Rev 166

## Use

**Time of day** appears above Studio's six Pixel previews, in Combat Setup and in the combat unit panel. It uses 15-minute steps from 00:00 through 23:45; noon is the default. The label shows sun direction/elevation. Studio and combat use the same hour and calculation. The slider stays usable during a battle without spending a turn; focused slider keys do not issue movement commands.

For this first pass, sunrise is 06:00 in the east, noon reaches 60 degrees toward the south, and sunset is 18:00 in the west. Morning shadows extend west, afternoon shadows east, and noon shadows are shorter. Near the horizon they fade and are capped at six body heights; at night there is no solar shadow. This is a fixed game-day arc, not a date/latitude astronomy simulation or advancing combat clock.

Only ground shadows change. Material textures, environmental/directional lighting, visibility/LOS, combat rules and spell light are unaffected. The selected pose, equipped weapons and facing supply the silhouette. Existing captured PNGs, source data and Unit Packages remain shadow-free, allowing the same pose collection to work at any hour without recapturing. Save PNG/QA sheet/export data still exports the original character artwork; use a screenshot to record the displayed terrain/shadow preview.

The hour is saved in the Studio workspace and in a browser preference scoped to the site folder (candidate and stable stay separate). The `sunHour` navigation parameter carries it through Test in combat and Return to Studio; editing the slider updates that parameter so reload preserves the new hour. An explicit URL hour takes precedence over an older restored workspace. Nothing is written back to a model or pose-library definition.

## Shared implementation

- `js/unit-sun-shadow.mjs` owns time normalization, the fixed sun vector, horizon bounds, projected silhouette drawing, alpha-mask caching and synchronized controls. It imports the existing `CAMERA_ELEVATION` so Studio and the battlefield use the same ground projection. Do not implement an independent combat sun formula.
- Transparent character alpha is copied to a separate black canvas with `source-in`; the source image is never edited. Static masks are cached by image identity; Studio atlas masks are keyed by tile and render revision, retaining only the current six tiles. Changing time reuses the underlying sprite artwork.
- The ground projection approximates height from each pixel's distance above the saved ground anchor. It preserves source padding, render dimensions, enlargement and legacy horizontal mirroring. Mirroring the silhouette must not mirror the world-fixed sun direction. It is a sprite silhouette projection, not a 3D depth/terrain ray trace. Building, canopy and terrain occlusion of sunlight are outside this pass.
- Studio composites the shadow beneath the character over its grass preview using the existing native battlefield atlas. Its orbit view displays that same silhouette on a ground-plane mesh. The mesh is hidden for every atlas render and excluded from model bounds, animation fitting, capture and export; never bake it into the sprites or their lighting recipe.
- Combat reuses the production unit draw paths in a ground-only pass before the actor depth queue. This supplies the exact current pose, footprint center, scale and anchor. Then ordinary walls, trees, units and fog render over it. The old fixed character ovals are removed. Invisible units and units excluded by party visibility must not reveal themselves through shadows; mirror-image ghosts do not gain independent physical shadows.
- `sprite-set-runtime.mjs` exposes the shared sun to the existing classic engine and binds setup/battle controls. `studio-capture.mjs` and `studioReturnUrl` preserve the hour without changing atomic capture-save/restore behavior.

## Reproduce and validate

1. Load a rigged model in Studio with a weapon and pause on an animation frame. Compare 09:00, 12:00 and 15:00 in all six previews and the orbit view. Sun direction must stay fixed when the model turns; the weapon belongs to the silhouette.
2. Try 00:00, 06:00 and 18:00: no solar shadow. Near 06:00/18:00 the shadow remains finite and fades. Existing Ready captures must remain fresh when only time changes.
3. Test in combat at 15:00, add opponents, and start a round. Change time using the slider's arrow keys: hour changes without moving the player or spending its turn. Check shadows under units/trees rather than over them, night removal, and no browser errors.
4. Return to Studio after changing the battle hour. Verify the latest hour and exact captures survive; reload retains them. Test ordinary Carl and selected-model paths using the shared renderer.

Run `node scripts/test-unit-sun-shadow.mjs`, the existing directional/footprint/capture tests, and full Adventure Party Validation. Tests cover sun-vector symmetry, noon elevation, horizon cap/fade, nighttime, anchor/scale/mirroring, mask reuse/invalidation, UI synchronization, invisible-unit handling, focused-input isolation and shadow-free capture wiring. Browser QA on Orc Leader with Spear verified morning/afternoon/night, six retained Ready captures, combat control, and the scoped return path.
