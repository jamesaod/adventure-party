# Studio weapons

Weapons remain separate GLB assets and attach rigidly beneath a supported right-hand bone. The equipment registry and grip defaults live in `js/studio-equipment.mjs`.

| Studio selection | Repository asset | Source |
| --- | --- | --- |
| Medieval Sword | `swords/medieval-sword.glb` | User upload `medieval+sword+3d+model(1).glb` |
| Battle Axe | `battle-axes/battle-axe.glb` | User upload `ornate+battle+axe+3d+model.glb` |

The sword is an exact copy of the uploaded GLB, with its embedded textures:

- Bytes: **1,104,460**
- SHA-256: **1f4a381aae5aa3779f5b1d03cca706ed7273972e4e31a03f622ea923c3d1edb6**
- One mesh and material; 27,364 triangles; three embedded 1024 × 1024 texture maps.
- Grip origin in source coordinates: `(0.34, 0.109, 0)`; the blade points along source `-X`.

## Testing on Carl

1. Load **Dungeon Crawler Carl Ver 2** in the 3d studio.
2. In **Equipment**, choose **Medieval Sword** for the right hand. The studio fits the equipped model across its animations.
3. Use **Sword size** or **Adjust grip** to tune the placement; **Reset grip** restores the Carl preset. After a large adjustment, choose **Fit all animations** before capturing.
4. Preview the animations and capture Ready, Attack and Prone. All six directions use the same equipped scene.

The attachment follows `mixamorig:RightHand`, including Three.js's sanitized `mixamorigRightHand` spelling. The 100% size preset scales the source sword to 0.55 of its native length. It starts with hand-local position `(0.015, 0.05, 0.005)` and rotation `(0°, -90°, 0°)`; these controls change the attachment without changing either GLB.

Equipment selection and grip settings save with the browser workspace and return from combat. Equipment is locked after the first captured pose, as are lighting and framing. Clear all captured poses before changing the weapon or grip so an exported sheet cannot mix armed and unarmed poses. Previously captured sprites retain their original pixels.

Models without a recognized right-hand bone show an explanation. A failed weapon load blocks further captures of that equipped set; existing captured sprites remain available. Reload the studio to retry a saved set, or clear the sheet and use **Reset grip** / **None**.

The sword follows the existing hand animation. This feature does not replace the source animation's finger pose with a new gripping animation.

## Battle Axe first-pass source

The Battle Axe is preserved byte-for-byte from the uploaded GLB:

- Bytes: **2,209,320**
- SHA-256: **d7ba2e5d2cdc15e782d05f13d4d31d6e63a2142bd336a22248b2560323938b76**
- One mesh, no skin or embedded animation; **54,706 triangles** and 31,186 position vertices.
- It uses the `one-handed-swing-v1` profile and starts from a provisional sword-style right-hand calibration. Tune the exact grip in Studio and export the Weapon Pose Profile JSON before treating a calibration as final.

Carl's body model is 18,672 triangles, so the axe intentionally serves as a relatively heavy accessory benchmark for future on-demand equipment rendering.

## Spear (Rev 138)

`./spears/spear.glb` is the optimized uploaded spear: 512 triangles, three embedded 512px PBR maps, 94,172 bytes. Catalog ID `spear` uses the existing **2H Stab (Pierce)** profile and shared adjustable two-hand mount. See [Spear integration](../../../docs/SPEAR_INTEGRATION.md) for source hashes, Blender reproduction, tuning and validation.
