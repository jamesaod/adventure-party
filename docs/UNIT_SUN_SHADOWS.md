# Unit sun shadows — Candidate Rev 168

## Current behavior

Studio's 3D view, six Pixel previews and combat use **noon** (12:00). Time sliders have been removed from Studio, Combat Setup and the combat sidebar. Old `sunHour` URL values, browser preferences and workspace fields cannot override noon. Test in combat removes that obsolete parameter; Return to Studio retains the existing model/MOB/pose-library scope.

Noon uses the existing fixed sun path: 60 degrees high toward the south. Shadow opacity remains 45%. Material textures, model lighting, visibility/LOS, combat rules and spell light are unchanged. Existing captured PNGs and Unit Packages remain shadow-free; no recapture is required. Save PNG and QA sheet/export still export the original character artwork. Use a screenshot to record the displayed shadow.

## Shared implementation

- `js/unit-sun-shadow.mjs` owns the fixed runtime hour, sun vector, alpha-mask caching, contact detection and projected silhouette. It imports the existing `CAMERA_ELEVATION` for Studio/battlefield parity. Pure time-normalization and sun-path functions remain for future environment controls, but runtime `unitSun` always draws at noon.
- Transparent character alpha is copied to a black mask using `source-in`; the original source is never edited. Static masks/contact lines are cached by decoded image identity. Studio atlas masks are keyed by tile and render revision, retaining only the current six tiles.
- Height is approximated by distance above the visible foot-contact line. The shared affine transform leaves both contact points fixed at their sprite positions while preserving source padding, render scale, enlargement and mirroring. Reflecting a unit must not reflect world sun direction. This is a silhouette approximation, not depth/terrain ray tracing.
- Studio composites the shadow beneath the character over the grass preview. Its orbit view displays the same silhouette on a ground mesh using the contact line's ground depth. The mesh is hidden during every atlas render and excluded from model bounds, animation fitting, capture and export.
- Combat draws shadows through the production unit paths in a ground-only pass before the actor depth queue. This uses the exact pose, footprint center, scale and rounded sprite anchor. Walls, trees, units and fog then render over it. Invisible or unseen units must not reveal themselves through shadows; mirror-image ghosts do not gain independent physical shadows.
- `sprite-set-runtime.mjs` exposes the shared sun to the classic combat engine. Environment presentation does not alter model definitions, pose libraries or captured data.

## Foot-contact correction

Rev 166 projected onto a horizontal line at the unit pivot. Rev 167 instead fitted visible feet from connected components below 60% of the opaque bounds and increased opacity from 30% to 45%.

That fixed cut still joined the Orc's bent legs in some facings, so only one boot was detected. **Rev 168 progressively lowers the cut until the two substantial lower silhouettes separate**, then fits their contact line. It reuses visitation memory and caches the result with the mask. Nearly overlapping feet retain the lowest-contact fallback when no stable two-foot line is available. This changes neither sprite placement nor captured pixels.

The real alpha fixture `scripts/fixtures/orc-wide-stance-shadow.json` comes from Studio's Orc, Male, Uniformed with Spear, Bayonet Stab at 0.98 seconds, NW facing and 155% model size, exported at 160 × 200. Each nonempty row stores Y followed by opaque X start/end pairs (end exclusive, alpha threshold 64). The original fixed cut produced one contact; the revised detector finds both boots at (61, 129.5) and (113, 136.5). Keeping this fixture avoids relying only on an artificial stance whose legs were already disconnected.

## Reproduce and validate

1. Open Studio with `?model=male-orc&poseLibrary=humanoid-medium&sunHour=15`. Verify there is no time slider and noon shadows appear despite the old parameter. Pause Bayonet Stab at 0.98 seconds with Spear and inspect the NW-facing wide stance.
2. Capture Ready in a test workspace, then Test in combat. Verify one controlled Orc, no time controls in setup or battle, and shadows below both visible boots. Check different facings, map zoom and existing opponent selection.
3. Return to Studio and reload. Verify model/pose-library scope and the six Ready captures survive; no old hour is restored. Inspect the orbit view and six previews for the same contact behavior.

Run `node scripts/test-unit-sun-shadow.mjs`, existing capture/directional/footprint tests and full Adventure Party Validation. The shadow regression proves both real Orc contacts stay at their sprite positions for mirrors and three scales, in addition to the existing synthetic multi-hour fixture. It also checks legacy-hour rejection, noon rendering, absent time controls, mask reuse, invisibility and shadow-free capture wiring. Verify published candidate bytes after merge.
