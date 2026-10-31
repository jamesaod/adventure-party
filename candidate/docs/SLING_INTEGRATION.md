# Sling integration - Candidate Rev 146

## Approved runtime asset

`assets/models/weapons/slings/sling.glb`: **557,844 bytes**, **9,512 triangles**, 7,384 vertices, three embedded **512 x 512 RGB PNG** PBR maps (base color, normal, metallic/roughness). SHA-256: `ed1f11ef26083a0b998f6bbd71dbc6b47926215f476f026d0baf8e1bd753c861`.

Source: [Grab3D Sling](https://grab3d.com/models/weapons/sling/), [original GLB](https://grab3d.com/dl/sling/sling.glb), CC0-1.0. Source bytes: 625,144; SHA-256 `b71ad36709993a7a5a5787ad6464366862a5ddff3edcf9d516da526a65ffcaa6`. Original license and manifest are kept beside the runtime asset. The supplier describes procedurally generated Blender geometry, with AI assistance in its generator code.

## Reproduce

Download the original GLB to a scratch folder, then run with Python and Pillow 12.3.0:

```sh
python scripts/prepare-sling.py work/sling-source.glb work/sling.glb
python scripts/test-sling-asset.py
```

The preparer requires the exact source checksum. It folds the two outward cords upward along smooth mirrored curves, bringing the finger-loop junction and release knot together at the hand, with the pouch below. It normalizes the hanging span to one unit and transforms smooth normals with the inverse-transpose deformation Jacobian. Original UV and triangle-index buffers are byte-identical; there is no decimation because the source is already under 10K triangles. All resampling operates on stored texture channels; no linear/sRGB reinterpretation or material brightening is performed. Decoded channel means remain within one 8-bit level of the source. PNG makes the final asset 10.8% smaller despite replacing source JPEG maps losslessly after resizing.

This GLB edit is deterministic and does not require Blender export. Blender 5.1.1 was used to inspect the source. Use `--factory-startup` and scratch Blender user/temp directories for background asset QA, so installed UI add-ons do not run. Do not alter the user's live Blender document.

## Studio registration and pose

- Item, Studio ID and action profile: `sling`, display **Sling** / **Slings**. One right hand, ranged bludgeoning, existing `sling` rule reference.
- Uses the same equipment mount, appearance recipe, capture/export path and combat sprite cache as existing weapons. No new renderer or combat resolver.
- Native scale 0.34 (provisional 26.5-inch hanging span), local grip `[0,0.889858,0]`, hand-local position `[0.015,0.05,0.005]`, XYZ rotation `[91.250930,79.617197,-125.014997]` degrees, initial size 100%.
- On explicit weapon selection, Carl Ver 3 opens the existing **Goalie Throw** at **47/30 seconds (1.566667 s)**, paused. This is the over-shoulder preview. The catalog's optional `previewPose` is checked against both model ID and stable animation ID before seeking. Other rigs and clips are unaffected.
- The grip rotation cancels the independently recovered hand orientation at that frame so the pouch hangs vertically. `scripts/fixtures/sling-over-shoulder-reference.json` records the reference joint orientations, generated with the recovered offline Carl evaluator at the authored frame 47. Regenerate using the method in `generate-carl-animation-reference.py`, sampling Goalie Throw at fraction `47/115`; never change retargeting policy to align equipment.
- Size, offsets and XYZ orientation remain editable and persist with the existing workspace. Shield compatibility stays available, and no melee off-hand or body IK is applied.
- The existing Slings action profile retains its separate Ready, Wind Up, Attack, Falling and Prone captures. All 13 uploaded animations remain selectable. No model/animation source, MOB identity, Unit Package data, damage, ammunition or SFX timing is changed.

This is a **static held shape**. It follows the animated hand and is suitable for captured poses. It does not simulate rope gravity, unwrap cords, or release the stone during the full throw. Scrub and adjust/capture desired frames through Studio; automatic sling dynamics are outside this asset integration.

## Verification and publishing

Run every command from `.github/workflows/adventure-party-validation.yml`. Added asset checks pin the original topology and UV data, normals, hanging shape, checksum, texture dimensions, color measurements and license. Equipment tests verify the vertical hang against the independent quaternion reference, editable pivot, absence of body IK, correct animation/profile, shield compatibility and model-specific preview seeking.

Browser QA covers all six preview directions, saved scale after reload, reset, and a six-facing Ready capture under Slings. Publish through feature branch -> PR to candidate -> successful validation -> merge -> candidate publisher/Pages. Verify the published bytes and Rev 146 Studio before reporting completion. The verified GitHub blob bridge remains documented in [Spear integration](SPEAR_INTEGRATION.md).
