# Spear integration — Candidate Revs 138 / 141

The spear is ordinary catalog equipment. It uses the existing rigid right-hand attachment, secondary left-hand grip constraint, six-facing previews, Pixel Studio captures, saved workspace and combat equipment refresh. No MOB model, animation source, combat rule or Unit Package is replaced.

## Source and optimization

User source: `spear.zip`, 78,507,239 bytes. Its `source/Kopie_tip_1_NEW.fbx` has 337 vertices and 642 triangles before reduction. Source FBX SHA-256: `f27c1a6aa0d5f3644c150886683b54b6d751deda68902f000d9ccecf61685c35`.

The user requested polygon reduction and 512px textures. Blender 5.1 applies conservative 0.8 decimation, yielding **512 triangles** (20.2% fewer), retaining UVs. It normalizes length to 1 along glTF +Y, with the spearhead at +Y. Base color, normal and packed occlusion/roughness/metallic images are **512 × 512**, embedded as JPEG quality 90. The unused ground-AO preview image is excluded. The rigid GLB contains no skin or animation.

Runtime asset: `assets/models/weapons/spears/spear.glb`, **129,616 bytes** after the Rev 141 color correction. SHA-256: `9852707d7ce895ed860794a24eaa9cabfb0eb06ffa5b77f2d125e6e5c0c5ca21`. Derivation metadata is beside it in `spear.json`; catalog provenance is in `js/item-catalog.mjs`.

To reproduce, extract the source ZIP into a scratch directory and run:

```powershell
# Use workspace-owned temporary/config directories on restricted Windows hosts.
New-Item -ItemType Directory -Force work/blender-temp,work/blender-user | Out-Null
$env:TEMP=(Resolve-Path work/blender-temp).Path
$env:TMP=$env:TEMP
$env:BLENDER_USER_RESOURCES=(Resolve-Path work/blender-user).Path
& 'C:/Program Files/Blender Foundation/Blender 5.1/blender.exe' --background --factory-startup -t 2 --python scripts/optimize-spear.py -- SOURCE_DIRECTORY assets/models/weapons/spears/spear.glb
```

The script rebuilds both GLB and metadata. Review output checksums when using a different Blender version, since exporter bytes can change.

## Catalog and Studio procedure

- Item/Studio ID: `spear`; rules catalog ID: existing `spear`; damage type: piercing; two hands.
- Action profile: existing `two-handed-thrust`, displayed as **2H Stab (Pierce)**. Selecting Spear selects this capture profile. The existing Bayonet Stab source (`assets/animations/thrusting/bayonet-stab.fbx`) is already associated with this profile in `data/animation-library-sources.json`; import it through **Load animation FBX** when the selected model lacks a stab clip.
- A profile is a pose assignment, not a new embedded animation. Existing empty Ready / Wind Up / Attack / Prone assignments remain empty until captured. No global animation fallback or authored source track is changed.
- Shared mount defaults: primary grip `[0,0.35,0]`, secondary grip `[0,0.55,0]`, primary axis `[0,1,0]`, native scale `1.18`, hand-local position `[0.015,0.05,0.005]`, XYZ rotation `[-90,0,0]`, size 100%. Length calibration is provisional, about 91.7 inches relative to the existing Carl scale.

Load a compatible humanoid from **Model library**, choose **Right hand → Spear**, and verify **Action profile → 2H Stab (Pierce)**. A two-handed weapon clears the shield. Use **Weapon size** and **Adjust grip** to tune scale, XYZ mount offsets, XYZ rotation and secondary grip offsets. **Reset grip** restores the spear defaults. Inspect six directions and scrub the stab before capturing. A sheet and pose-profile JSON preserve the selected equipment settings. Changed gear or grip invalidates affected captures through the existing workflow.

## Transfer, validation and publication

Use feature branch → PR to `candidate` → Adventure Party Validation → merge → candidate publication. Granting network access restored clone/fetch in this desktop session; push failed in the Git credential helper. Use the verified connector bridge below when this occurs. Clone with `git -c core.autocrlf=false clone --branch candidate ...` on Windows: automatic CRLF conversion changes ASCII FBX parsing and imported package hashes. Do not refresh package hashes to accommodate a checkout line-ending change; preserve repository bytes instead.

If direct Git push fails, use the native GitHub blob/tree/commit approach documented in `AGENTS.md` (Revs 58, 71 and 109). The Rev 138 local-to-connector bridge is:

1. In `functions.exec`, call `tools.mcp__node_repl__js` with JavaScript that reads the local file using `node:fs/promises`, encodes the bytes as Base64 and returns a JSON record through `nodeRepl.write`.
2. Capture the returned tool result **inside the orchestration runtime**; parse `result.content` text there. Do not print or paste the Base64 into chat. Read one binary at a time to keep tool results bounded.
3. Pass the captured string directly to `tools.mcp__codex_apps__github_create_blob` with `encoding: "base64"`. Compare its Git blob SHA to `git hash-object` for the local file. Existing large text files can reuse their local Git blob SHA when already present; create only new or modified blobs.
4. Create a tree using the candidate base tree plus only changed paths, then create a commit and update the feature branch with an expected-head lease. Compare the remote tree SHA to the local prepared tree SHA before opening the candidate PR.
5. Require PR validation, merge, and verify the exact published spear SHA-256. This bridge transfers binary bytes without modifying the renderer, using a PNG upload gateway, or exposing credentials.


`node scripts/test-studio-equipment.mjs` verifies spear checksum, triangle reduction, JPEG dimensions, PBR slots, two-hand profile, grip pivot and adjustable settings. Run all commands in `.github/workflows/adventure-party-validation.yml`. On this Windows sandbox the sprite-package symlink test requires Linux CI; do not weaken that test. The existing model, animation and Unit Package integrity suites remain release gates.

## Visual QA limits

Local browser QA confirmed the spear in the 3D view, all six pixel previews, a six-facing capture, automatic shield removal, action-profile selection and adjustment-driven capture invalidation. Bayonet Stab imports and plays through the existing humanoid importer. The generic off-hand solver reports an unreachable secondary grip in some Carl/Bayonet frames at the provisional mount; model-specific hand alignment still needs tuning with the existing controls. These presets are starting values, not a claim that every rig and stab frame is visually approved.

## Rev 141: black-spear texture diagnosis and fix

The texture was present. The resized floating-point base-color image went through Blender 5.1's glTF image-copy export fallback, which encoded linear-looking pixel values into a JPEG that glTF interprets as sRGB. The source's mean RGB was approximately `[78.30,70.80,62.94]`; the broken embedded JPEG was `[22.00,19.45,17.42]`. Its maximum channel value was only 83. Checking for texture slots and 512px dimensions did not detect this defect.

`optimize-spear.py` now saves the resized color image directly as a quality-90 JPEG with its sRGB color space, reloads that JPEG, and packs the unchanged bytes before exporting. The exported base-color mean is `[78.71,71.28,63.45]`, consistent with source colors after reduction/compression. The glTF exporter can use the packed JPEG directly instead of copying floating-point pixels. Do not apply this conversion to the normal or occlusion/roughness/metallic maps: those remain linear data. This follows the [glTF material color-space requirements](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#materials).

Geometry, indices, UVs, node transforms, material parameters and the embedded normal/ORM image bytes were compared against Rev 138 and are unchanged. The asset still has 512 triangles and three embedded 512px textures. Preserve the approved scale, grip, rotation and attachment defaults. Do not compensate for an export error by changing scene lighting or making the metal nonmetallic. The source wood is naturally dark, and the metal still responds to the direction of light.

After rebuilding, update the catalog's runtime byte count and SHA-256 from `spear.json`. The shared equipment registry exposes that checksum; Studio and combat request the existing GLB with a checksum query parameter, and combat appearance cache keys include it. Keep `presetRevision:1`: increasing it would reset saved grip/size values. Studio saves `equipmentAssetSha256` and marks older spear captures outdated once, while retaining their pose references and adjustable mount settings. Recapture any old black-spear PNGs for export.

Run the decoded-image regression as well as the repository suite:

```sh
python -m pip install "Pillow>=11,<13"
python scripts/test-spear-texture.py
node scripts/test-studio-equipment.mjs
node scripts/test-mob-appearance.mjs
```

The image test compares the actual embedded base color against an independently measured source-color reference (three-channel tolerance of 3), checks retained texture contrast, and checks linear data-map values. Passing the Rev 138 GLB as an optional argument reproduces the failure. CI runs this test; a checksum/dimension-only check is insufficient. In Studio, inspect Bayonet Stab with Spear in multiple facings and ensure the shaft has source brown tones. Verify the exact published GLB checksum after the candidate publisher completes.
