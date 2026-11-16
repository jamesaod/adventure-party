# Quiver arrow bundle — local revision 312

MOB Workshop's Equipment page has controls for arrow width in the quiver (5–100%), maximum visible arrows (0–30), and bundle spacing (0–300%). Defaults are 40% width, four arrows, and 100% spacing. Width scales the arrow's cross-section, including head and feathers, without changing its length. Carried arrows regain their normal game width during the first 20% of the pickup-to-draw interval; nocked, launched and lodged arrow dimensions remain unchanged.

Choose **Move / rotate arrow bundle**, or **Quiver arrow bundle** in Edit attachment, to use the existing attachment gizmo and numeric XYZ controls. Bundle translation and rotation are relative to the quiver pickup point and move independently of the housing. The cyan marker follows the edited pickup origin. **Reset attachment** while editing the bundle resets only its settings. Handles require a compatible bow and a Bow animation with a pickup interval, for both Automatic bow quiver and manually fitted Quiver.

Settings live in `arrows` on the existing per-model/per-item Back fit. They survive draft/project/package export and published MOB reopening. Workshop preview and combat consume `quiver-arrow-settings.mjs` and the same `bow-arrow-pickup.mjs` renderer. The bundle uses stable concentric hexagonal rings; count changes prepare cloned shared geometry only when edited, never during frame sampling. Ammo caps visible arrows. A display count of zero hides stored arrows while retaining ordinary firing and ammunition behavior.

The automatic quiver remains calibrated against the authored pickup pose. Bundle edits retain this calibration frame, and repeated edits reuse the gizmo target. Manual housing position, rotation and size remain independently authored. No extra animation loop or rendering pass is introduced.

## Close misses

An arrow miss at a target with `hexDistance(attacker, target) < 3` always scatters beyond the target. At exactly three hexes and beyond, the existing short/long scatter remains. Physical walls still intercept the resolved trajectory; hits, empty-hex aim, ammunition and attack rolls are unchanged.

## Checks

`test-quiver-arrows.mjs` covers width, count, spacing, gizmo math, ammo visibility, independent housing, animated orientation, metre/centimetre rigs, auto/manual attachments, cleanup, and portable published fits. Real-asset pickup and Workshop preview tests check the unchanged hand/string timing. `test-lodged-arrow-rendering.mjs` exercises close misses in six directions, the three-hex boundary, wall interception and empty-hex aim. Visual QA remains with the user.
