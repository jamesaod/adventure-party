# Shield, Orc — Candidate Rev 198

User supplied `SM_Wep_Shield_Set_54.fbx` and `Shield_Optimised_01.png`, with a reference identifying the red/black quartered design. No external license or author was supplied; retain user-supplied provenance without inventing attribution.

The source mesh has 622 triangles, retained unchanged. Extract the 448×448 rectangle at x=2612, y=208 (top-origin) from the 4096×4096 atlas. Extraction was verified with zero decoded-pixel difference. Front planar UVs map local X/Y at radius 38.6965 to UV center 0.5 with radius 200/448. Front-facing polygons use that image; backing is plain wood and edge dark iron. This is a deliberate UV remap, not a claim that the original atlas UVs matched.

For runtime, resize the crop to 256×256, save/reload in sRGB before GLB export, bake object transforms, normalize vertical extent to one, and shift Blender Z by +0.5. glTF exports upright Y=0..1 with its face toward +Z. Reuse the established shield modelOrigin [0,0.5,0], nativeScale 0.45 and hand position [0,0,0.04]. All existing scale, XYZ rotation, offset and forearm controls remain available. This sets the same initial display size as Round Wooden Shield; user QA may refine the mount.

Runtime asset: `assets/models/shields/shield-orc.glb`, 91,180 bytes, 622 triangles, one embedded 256px PNG. SHA-256: `d3ea72f9591b911ebe953f0d751c7877c25eb89fffe6c41e70f6a2f3cc96d810`.

Register stable ID `shield-orc` in item-catalog, Studio shield presets, and combat visible shield assets. Equipment Library and MOB Creator read the catalog automatically. Rules initially match the existing medium round shield; this is not a separate PHB balance change. Preserve all other equipment and pending user adjustments.

## Connection boundary

All three pages share published catalog definitions. Studio lists registered visual presets; Equipment Library also contains nonvisual items and browser-local variants. MOB Creator consumes those local variants and exports pinned definitions. Studio does not yet discover browser-local variants automatically. Registering a new repository asset still requires its Studio/combat visual entry. Do not describe browser edits as synchronized to every screen or published to the repository.

Validation: `node scripts/test-shield-orc.mjs` checks the shared IDs, MOB off-hand availability, combat appearance mapping, exact asset bytes/hash, 622 triangles and 256px texture. Run repository CI and verify the published asset bytes after merging.
