# Shield QA assets

## Bronze Round Shield

User-supplied source: `bronze+round+shield+3d+model.glb`

Source identity recorded for the test:

- Bytes: **646,712**
- SHA-256: **c908d84a286a005a050934f0b5bb409c6d42b2cbfc85ae0669637802375994e0**
- glTF 2.0 binary
- 1 scene / 1 node / 1 mesh / 1 material
- no skin and no embedded animations
- Source bounds: X **-0.4997559..0.4997559**, Y **0..0.9995117**, Z **-0.1184082..0.1184082**

Candidate Rev 67 uses a lightweight procedural **QA proxy** in
`js/studio-shield.mjs`, built to the uploaded source's major dimensions. The
purpose of this pass is to tune left-hand placement and animation behavior
without coupling shield calibration to the right-hand weapon system.

The full textured source GLB is the authoritative art reference but is **not**
claimed as a byte-for-byte repository asset in Rev 67.

### Rev 67 mount

- Bone: `mixamorig:LeftHand` (Three.js also accepts the sanitized spelling)
- Native proxy scale: **0.45**
- Position: **(0, 0, 0.04)** in hand-local space
- Rotation: **(0°, 0°, 0°)**
- Rev 68 established the outside-arm side and outward-facing boss.
- Rev 69 preserves that orientation and pulls the shield inward so it sits close to the forearm with approximately one inch of visual clearance.
- Rev 70 adds three Studio controls relative to that Rev 69 base: **Closer / farther from arm**, **Up / down forearm**, and **Rotate around forearm**. Movement is expressed in inches; roll is expressed in degrees. The forearm slide/roll axis is derived from Carl's actual animated left forearm/hand relationship, and saved values are carried into Test in Combat rendering.
- Inventory/rules entry: existing `shield-medium` (+1 AC)
- Appearance ID: `bronze-round-shield`

The shield follows the animated left hand while the sword or battle axe follows
the right hand. The two attachment calibrations are independent.

### Animation scope

Rev 67 validates the mount against Carl's currently shipped Ready/Attack clips.
The proposed UAL2 shield candidates (`Idle_Shield_Loop`, `Sword_Block`,
`Shield_OneShot`, and alternate one-handed sword swings) are not yet imported
into Carl's model in this revision.
