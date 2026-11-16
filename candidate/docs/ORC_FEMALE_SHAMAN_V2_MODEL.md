# Orc Shaman, Female Ver 2 and Axe Stance — Candidate Rev 178

The user archive `Meshy_AI_tripo_convert_10960f4_biped (1).zip` supplies a neutral Character_output FBX and a matching Axe_Stance_withSkin FBX. Import the character as `orc-female-shaman-v2` (Orc Shaman, Female Ver 2), keeping the earlier Shaman and every existing model. The shared upload library exposes Axe Stance to all opted-in humanoids, including device imports. Equipment uses the existing hand mounts and adjustable grips.

## Reproduce the model

Extract the archive to a working directory. Resize its `*_texture_0.png` with Pillow: `Image.open(path).convert('RGB').resize((512,512), Image.Resampling.LANCZOS).save(output/'base-color-512.png')`. This resizes encoded sRGB color without Blender float-image darkening. Run Blender 5.1 in background with `--factory-startup --python scripts/import-orc-female-shaman-v2.py -- SOURCE_DIRECTORY assets/models/orcs/orc-female-shaman-v2/orc-female-shaman-v2.glb`.

The importer pins source FBX and resized PNG hashes, clears the rest action, applies armature rotation and scale while asserting unchanged world bind transforms, and exports a Y-up GLB. Keep all 13,086 triangles, original skin weights and 32 bones. The GLB is 2,616,128 bytes with one byte-preserved embedded 512px base-color PNG. Material is opaque/nonmetallic, as in the earlier Shaman; the archive's separate normal, roughness and metallic maps are not used. Adjacent JSON records exact hashes and counts.

## Recover the animation correctly

The 8,007,004-byte with-skin FBX is copied unchanged to `assets/animations/staff/axe-stance-bind-v2.fbx`. Its 184 frames at 30 fps give 6.1 seconds. Keep the stable source ID `uploaded:staff-pose:0`, but label it Axe Stance. The previous 22 sources keep their existing recipe.

Rev 177's direction-only retargeting is superseded. Bone names alone did not establish a matching neutral rig. Restore this source's true bind from inverse skin matrices before calculating the established world-bind deltas and scaled vertical hip translation. Derive each local bone transform from its parent's bind world matrix, including non-bone ancestors. Calling Skeleton.pose() directly here incorrectly applies the scaled Armature parent twice.

This FBX also simplifies X/Y/Z animation curves independently. FBXLoader must merge their key times and interpolate each axis at those times before combining Euler rotations or vector components. Pairing by key index distorts the pose even with a correct bind. Equal-time legacy tracks keep their existing behavior.

## Validation and recovery

Run `node scripts/test-orc-female-shaman-v2-model.mjs` and `node scripts/test-fbx-animations.mjs`, then repository validation. The latter retains the 22-animation independent reference on all six models and checks 22 joint world rotations plus hip translation at five Axe Stance times against Blender. To regenerate the independent Axe fixture, run Blender with `--background --factory-startup --python scripts/generate-axe-stance-reference.py`. It samples Blender's authored source pose, not our runtime retargeter. Use the existing generate-carl-animation-reference.py for the new model's legacy animation reference.

Browser QA checked the new and earlier Shaman, beginning/end poses and staff attachment, with no console errors. User artistic grip QA remains available. Old Staff Pose source frames retain their IDs; saved snapshots from the previous recipe are marked outdated on restoration and need recapture. Other animations' captures are preserved. Revision cache updates cover both Studio and combat loaders.

## Candidate Rev 179 — Green texture

The user-supplied `Meshy_AI_tripo_convert_10960f4_biped_texture_0 Green.png` replaces only V2 base color, downsampled to 512px in encoded sRGB with Pillow LANCZOS. Reproduce after the original import with `python scripts/update-shaman-v2-texture.py INPUT_PNG`. The script asserts every non-image buffer view is byte-identical, preserving geometry, UVs, rig and weights. Updated hashes and original PNG checksum are recorded in the model JSON. Select Load selected model to replace an older saved browser model; existing captured PNGs retain their original appearance until recaptured.

## Candidate Rev 180 — Green and red texture

Replaced V2 base color with the user-supplied `Meshy_AI_tripo_convert_10960f4_biped_texture_0 Green  and Red  Update.png` through the same 512px replacement script. Non-image buffers remain byte-identical. Update the animation reference fixture model checksum after a texture-only replacement; retain its independently sampled pose values. Source and output hashes remain in the model JSON.
