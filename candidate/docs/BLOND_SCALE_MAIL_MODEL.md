# Blond Haired Woman in Scale Mail — Candidate Rev 157

The Studio selector offers `blond-scale-mail-woman` / **Blond Haired Woman in Scale Mail** alongside Carl Ver 3. The existing uploaded-FBX loader supplies all 14 user-uploaded animations, initially Sword And Shield Idle. Existing primary/off-hand weapons, shields, scale, grip, orientation and attachment offsets remain adjustable. No new renderer, equipment system, combat character or Unit Package template is introduced.

## Source and runtime

- User archive: `Blond+Haired+Woman+in+Scale+Mail.zip`, 13,155,535 bytes; SHA-256 `86a1649ef71351b451e9e58e24226ca28aed12b0988fd30f57ea384ae7351078`.
- FBX: `tripo_convert_de98a781-0abc-437e-899c-cd3858e1c721.fbx`; source hashes are recorded beside the runtime GLB.
- Runtime: `assets/models/humans/blond-scale-mail-woman/blond-scale-mail-woman.glb`, **6,885,272 bytes**, SHA-256 `005801aa3139a8ca9abe489201f67a2b5a0b0e25928687d4d036c14065b9736c`.
- **10,717 triangles, 65 bones**, 20/20 recognized humanoid roles. Original mesh topology and skin weights are preserved; GLB vertices can split at UV/normal seams.
- The original **2048 × 2048** sRGB Color.png is embedded byte-for-byte. This import does not downsample or brighten it. Material uses opaque source color, metallic 0 and roughness 1.

## Reproduce

Extract the two archive entries into a source directory, retaining the `.fbm/Color.png` relative path. With Blender 5.1:

```sh
blender --background --factory-startup --python scripts/import-blond-scale-mail.py -- SOURCE_DIRECTORY assets/models/humans/blond-scale-mail-woman/blond-scale-mail-woman.glb
```

On Windows, use a task-local `BLENDER_USER_RESOURCES` directory to keep Blender extension caches out of the user's profile. The importer retains the established presentation-light workaround, selects only the mesh and armature, uses the original encoded PNG, and exports Y-up GLB without embedded motions. It writes an adjacent provenance JSON and verifies texture bytes.

**Armature units matter:** this FBX imports with a 0.01 armature object scale. Leaving that scale intact makes the existing metre-based equipment mounts 100 times too small. Apply the armature object scale in Blender before export; this adjusts bone rest data while preserving mesh world transforms and bone world positions/orientations, which the importer asserts. Do not compensate by changing global equipment sizes or renderers.

## Animation and equipment QA

Retarget through the existing world-bind-delta / scaled-world-y recipe shared by Studio and combat. The new model uses the same uploaded clip IDs and source files as Carl; no legacy embedded or UAL2 library is added. Generate independent acceptance poses using the existing offline evaluator:

```sh
python scripts/generate-carl-animation-reference.py --target assets/models/humans/blond-scale-mail-woman/blond-scale-mail-woman.glb --output scripts/fixtures/blond-scale-mail-uploaded-animation-reference.json
node scripts/test-fbx-animations.mjs
node scripts/test-blond-scale-mail-model.mjs
```

The reference generator now accepts target/output paths and evaluates full glTF parent transforms when scales or matrices are present. Its defaults remain Carl. The Node skinning test binds with GLTFLoader's identity bind matrix and measures world-space skinned bounds, so imported parent transforms are handled correctly. Angular/hip tolerances are unchanged. Both models pass 70 poses each; the new model's maximum joint error is 0.6434 degrees and hip error is 3.13e-8 native units.

Browser QA uses a separate draft scope so existing captures are preserved. Check Standing Idle, Sword And Shield Idle and Bayonet Stab, including the spear at 0.98 seconds. Verify visible sword/shield size, both spear hands and six facing previews. Model scale 155% was used for close inspection; it is a QA setting, not a new default. Grip refinement remains available through the existing controls. Run repository validation and the standard PR-to-candidate publication workflow; verify the published GLB hash after deployment.
