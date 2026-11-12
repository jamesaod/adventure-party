# Workshop Back equipment — local R238C306

Equipment now includes Back item and a Back entry in Edit attachment. Quiver is the initial catalog prop. Use the existing Move/Rotate handles or position, rotation and Scale fields. The attachment follows an anatomical chest frame and uses physical dimensions across metre/centimetre rigs. The default quiver keeps the accepted 0.29 scale.

Fits are saved by model, item and Back slot in browser drafts and portable Workshop projects. Loading an authored Back item in combat uses the same attachment and fit. A custom quiver supplies the existing arrow pickup's storage socket; sampling does not override its transform or add a second automatic quiver. Back equipment does not grant hand-weapon or shield bonuses.

New drafts start with None. Older projects migrate to Automatic bow quiver, preserving their current game behavior. Choose Quiver to enable placement controls, or None to omit it. Reusable hand calibration is disabled for the Back slot. The Back navigation button keeps its existing ID; the item selector uses backItem.

Validation: test-workshop-back-equipment covers physical units, moving chest bones, gizmo edits, async asset cancellation, per-model fits, portable round trips, runtime attachment and duplicate-free arrow pickup. Existing fit, project, Workshop, combat-contract, publication and arrow tests pass.

The same local revision fixes black occluded-unit outlines: Color.set(css, SRGBColorSpace) was invoking the RGB overload and producing NaN components. Color.setStyle(css, SRGBColorSpace) restores the existing allied blue and hostile red. test-hidden-unit-outline-colors checks finite, correct colors for active/inactive units in day/night; outline resizing and existing sprite outline tests also pass.