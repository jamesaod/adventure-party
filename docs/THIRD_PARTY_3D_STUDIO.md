# 3d studio dependencies

The studio serves its renderer and model loaders from this repository. It does not fetch JavaScript from a CDN at runtime.

## Three.js

- Version: **0.180.0 / r180**.
- Project: <https://github.com/mrdoob/three.js/tree/r180>.
- Official distribution: <https://registry.npmjs.org/three/-/three-0.180.0.tgz>.
- Distribution SHA-256: `ad66d724565ee29a2467277fa84daa5ed0211d6b8d446e9ef29f6bae0cd14144`.
- License: MIT; the complete notice is preserved in [`assets/vendor/three/LICENSE`](../assets/vendor/three/LICENSE).

The following files come from that distribution. They are unmodified except for the FBX animation-discovery patch described below:

| Repository location under `assets/vendor/three/` | Distribution location |
| --- | --- |
| `three.module.min.js` | `build/three.module.min.js` |
| `three.core.min.js` | `build/three.core.min.js` |
| `addons/controls/OrbitControls.js` | `examples/jsm/controls/OrbitControls.js` |
| `addons/loaders/GLTFLoader.js` | `examples/jsm/loaders/GLTFLoader.js` |
| `addons/loaders/FBXLoader.js` | `examples/jsm/loaders/FBXLoader.js` |
| `addons/utils/BufferGeometryUtils.js` | `examples/jsm/utils/BufferGeometryUtils.js` |
| `addons/curves/NURBSCurve.js` | `examples/jsm/curves/NURBSCurve.js` |
| `addons/curves/NURBSUtils.js` | `examples/jsm/curves/NURBSUtils.js` |
| `addons/libs/fflate.module.js` | `examples/jsm/libs/fflate.module.js` |

The HTML import map resolves `three` to the local `three.module.min.js` and `three/addons/` to the local `addons/` directory. Keep all these files on the same pinned Three.js version when updating them.

### Local FBX animation patch

`FBXLoader.js` preserves one clip per usable AnimationStack, safely skips empty/disconnected stacks and empty leading layers, and attaches stable stack identity, validated authored time spans, and discovery counts. Its ASCII and binary parsers retain named `Takes.LocalTime` records as a fallback when stack timing is absent. It retains the first usable layer; this patch does not implement FBX layer blending. The studio applies the take timing in `js/studio-animations.mjs` and displays a note for layered takes. Preserve or re-evaluate this patch when upgrading Three.js; `scripts/test-fbx-animations.mjs` exercises the production loader with an authored fixture.

The import map has a versioned exact entry for the patched FBX loader so browser caches refresh when it changes.

The parser also follows every valid parent connection of each AnimationCurve. [Autodesk's FBX data model](https://help.autodesk.com/cloudhelp/2018/ENU/FBX-Developer-Help/animation/animation_data_structures/animation_classes_interrelation.html) permits shared curves; inspecting only the first parent can incorrectly discard other takes. The parser test covers separate curves, shared curves, reversed connection order and unrelated connections. The studio reports raw take counts separately from selectable clips, so unsupported tracks are not mistaken for absent source animation.

## fflate

The FBX loader uses **fflate 0.8.2** for decompression. The sprite capture exporter and repository importer reuse that same module for ZIP packages. Its module is the copy included in the Three.js distribution above, with the original header retained. The additional complete MIT license notice is preserved at [`assets/vendor/three/addons/libs/fflate.LICENSE`](../assets/vendor/three/addons/libs/fflate.LICENSE), from <https://github.com/101arrowz/fflate/blob/v0.8.2/LICENSE>.

## Loader and renderer scope

The included loaders support ordinary glTF 2.0 (`.glb` and `.gltf`) and FBX assets, including animation clips that the loaders can decode. Separate Draco, Meshopt, and KTX2/Basis decoders are not included. Models requiring those extensions need to be exported without that compression for this version of the studio. FBX compatibility depends on the format revision and features used by the exporter.

The renderer requires WebGL 2. Model files and their companion resources are selected locally; the vendored loaders do not themselves provide an upload service.

Relevant upstream references:

- [GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html)
- [FBXLoader](https://threejs.org/docs/pages/FBXLoader.html)
- [AnimationMixer](https://threejs.org/docs/pages/AnimationMixer.html)
- [Color management](https://threejs.org/manual/pages/color-management.html)
- [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html)

The documentation links track upstream changes. The vendored r180 source is authoritative for the behavior of this build.
