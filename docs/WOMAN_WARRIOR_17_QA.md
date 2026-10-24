# Woman Warrior — 17-animation QA

Source: user-supplied `Woman_Warrior+3d+model.glb` (Tripo); preserved byte-for-byte as `assets/models/humans/woman-warrior/woman-warrior.glb`.
Source SHA-256: `525ec9bb48ebac5ceadd9f6fddd8e4a22451b74608527392107dbc136ce76d4d`.

The **Woman Warrior — All 17 Sword & Shield Animations (QA)** Model Library entry loads a *separate*, non-destructive 17-clip model. Its source is **New Carl's already baked, repository-backed 17-clip Mixamo GLB**, retargeted offline with world/bind delta, target bind pose, and scaled vertical hips displacement. No original model binary, skin, mesh or material is changed.

Baked SHA-256: `2c0064194f6c201dd8c379d915d3195f0178f28d2e8ee35beb7394aeb77adea5`.

**Important:** The rig has 65 recognized Mixamo joints, but identical bone names do not ensure compatible bone axes. The Warrior's right upper-arm and right forearm bind orientations differ from Carl's corrected basis by approximately **179.23° and 118.90°**. Animation transfer has passed *structural* checks, not visual acceptance. Verify both arms stay on their anatomical sides, torso/skirt weights, hands, legs and sword/shield attachments across all 17 clips before promoting from QA.

## Reproduce

```sh
python scripts/retarget_tripo_from_baked_carrier.py \
  --carrier assets/models/dungeon-crawler-carl/new-carl/mixamo-sword-shield-full-17/new-carl-mixamo-sword-shield-full-17.glb \
  --target assets/models/humans/woman-warrior/woman-warrior.glb \
  --out assets/models/humans/woman-warrior/mixamo-sword-shield-full-17/woman-warrior-mixamo-sword-shield-full-17.glb \
  --report assets/models/humans/woman-warrior/mixamo-sword-shield-full-17/provenance.json

node scripts/test-woman-warrior-assets.mjs
```

Requires `numpy` and `scipy`. The original source is selectable independently for comparing T-pose anatomy. After opening the 17-clip QA version, choose `Mixamo_sword_and_shield_idle`, then block idle, an attack, a run and both turn clips. Add equipment only after confirming body deformation. Do not substitute Orc-specific attachment offsets.
