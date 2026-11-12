# Unit sun shadows — Candidate Rev 169

## Current behavior

Studio's orbit view, six Pixel previews and combat use **noon** (12:00, sun 60 degrees high toward the south), with 45% shadow opacity and no time sliders. Old hour preferences cannot override noon. Model shadows now come from the evaluated 3D geometry projected flat onto the floor, including standing, falling and prone poses.

Material lighting, geometry assets, animations, equipment calibration and combat rules are unchanged. Character captures, Save PNG, QA sheets and Unit Package PNGs remain shadow-free. Model/animation/frame references remain the portable export data. Use a screenshot to record the displayed shadow.

Existing captures are retained. New captures carry their precise geometry shadow into combat automatically. Recapture an old pose to add that shadow; older prone PNG-only artwork has a conservative contact-shadow fallback instead of the displaced standing-style projection.

## Projection and rendering

`js/ground-shadow-geometry.mjs` supplies one shared projection matrix and override material to the **existing** Studio and combat WebGL renderers. No extra renderer, equipment system, animation evaluation or model normalization is introduced.

The vertex shader runs after morph targets and skinning, then applies the model's world matrix. For a world vertex (x, y, z) it projects to:

- X = x + sun.groundX × max(0, y)
- Y = 0.004 (a small floor separation to avoid z-fighting)
- Z = z + sun.groundZ × max(0, y)

Ground depth Z is preserved independently of height Y. This is the missing information in the earlier 2D foot-line approximation: a lying body extends across the floor, not vertically above a foot. Every projected vertex lies on the same horizontal plane, at every model facing. The sun remains world-aligned. Below-floor vertices clamp height to zero instead of reversing the shadow direction.

Studio saves the untouched character atlas before reusing the same render target for a separate opaque black geometry pass. The override material is restored in `finally`. Helpers and the displayed shadow quad are excluded from the atlas. The shadow atlas is reduced tile by tile to native battlefield size. Six previews composite it with the exact body frame and anchor; the orbit view maps it back onto the horizontal floor without a second shear.

Equipment-regenerated combat sprites use that same material, projection and existing renderer. `unit-sun-shadow.mjs` composites the already-projected mask at the body's exact normalized anchor and draw scale. It does not estimate another foot line or project the shadow again.

Combat retains its ground-only pass before the actor depth queue. Walls, trees, bodies and fog draw above shadows. Invisible/unseen units do not reveal themselves through shadows. Noon/opacity are presentation settings; sunlight occlusion by terrain, trees or buildings remains outside this implementation.

## Capture and compatibility

- A new capture stores `groundShadowRgba` separately from `raw`/`battlefieldRaw`. It is a top-down six-facing atlas at the captured native battlefield dimensions. Workspace validation checks its type/length and existing size limits apply. Derived `shadowFrames` are rebuilt on restore rather than duplicated in saved workspaces.
- Test in combat encodes those optional frames into a separate `shadows` map. It is saved atomically with the normal PNG files and exact return workspace. Shadow bytes count toward the existing 64 MiB draft cap; filenames must match ordinary image names.
- Keys are **full-resolution character filenames**, even though shadow images have native battlefield dimensions. Combat currently draws the full-resolution decoded character image, so attach the shadow to that exact image identity. Attaching only to the optional battlefield derivative silently loses the shadow.
- Missing old sidecars are valid. Corrupt optional shadow images do not prevent valid character art from loading. The source character PNG is never edited. Unit Package/export image schema is unchanged; runtime equipment renders regenerate shadows from the model recipe.
- Legacy upright PNGs retain the cached alpha/foot-contact fallback from Revs 167–168. Legacy `prone` images instead use their close silhouette under the body with at most one source-pixel offset. This conservative fallback cannot recover 3D depth; recapture for precise shadows.

## Reproduce and validate

1. Load Orc, Male, Uniformed with Spear in Studio. Check Standing Idle and a wide Bayonet Stab frame, then Standing Death Forward 01 at its final frame. Compare all six previews and orbit the model: the shadow remains on the floor beside the fallen body.
2. Capture Ready and Prone, Test in combat, then choose Prone in Inspect sprite poses. Check map zoom and the grounded shadow. Return to Studio and verify both captures and their exact frame references survive.
3. Save a PNG or export a QA sheet and confirm it contains only the character. Existing old captures must remain available; no automatic recapture or model-setting rewrite is performed.
4. Check an equipment-regenerated combat model and invisible-unit handling. Ground projection must use the world matrix after skinning, not unposed local geometry or an independently rotated sun.

Run `scripts/test-ground-shadow-geometry.mjs`, `scripts/test-unit-sun-shadow.mjs` and Adventure Party Validation. Tests cover standing/prone ground-depth invariants in six facings, shader skinning order, override restoration after failure, exact shadow anchoring without double projection, atomic optional sidecars, full-resolution render-source association, older-draft compatibility and invisible-unit handling. Browser QA covers the final death pose, six previews and captured combat/return flow.

## History

Rev 166 inferred height above the unit pivot. Rev 167 fitted visible foot contacts and increased opacity to 45%. Rev 168 lowered the alpha cut to separate connected legs and fixed noon. The real Orc alpha fixture in `scripts/fixtures/orc-wide-stance-shadow.json` remains useful for the legacy upright fallback. Rev 169 supersedes that inference for model-based rendering with the true floor projection described above.
