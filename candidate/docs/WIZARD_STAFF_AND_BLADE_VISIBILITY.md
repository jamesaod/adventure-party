# Brighter blades and Wizard Staff Grip — Candidate Rev 145

This revision responds to QA that the short sword and dagger appeared nearly black, and adds a separate one-handed **Wizard Staff Grip** listing using the existing staff model.

## Blade visibility

The Rev 144 source-color checks passed: embedded textures were present and their decoded sRGB colors were preserved. The highly metallic source PBR maps suppressed the diffuse lighting contribution, leaving blades dark in Studio/game lighting without an environment reflection map.

Set `pbrMetallicRoughness.metallicFactor` to **0.25** for both blades. This retains mapped metallic variation and highlights while making more of the original color respond to existing lighting. No global light, renderer, texture pixel, normal, roughness, geometry, scale or grip changes. Source texture brightness is preserved, with no glow or emissive workaround. The complete binary chunks compare byte-for-byte with Rev 144; only the JSON material factor changes.

| Asset | Triangles | GLB bytes | SHA-256 |
| --- | ---: | ---: | --- |
| Short Sword | 500 | 751,792 | `0ee9dc416fe68ad516dc2ef99aa5b3c5b574a91718474171fcb19fb919f31261` |
| Dagger | 960 | 674,868 | `625b794a045968d3d1643bfdb3bb10c73eb51b582d5f0471f9a3b3661810ae56` |

Each retains its three embedded 512 × 512 PNGs. Each GLB grows by 24 bytes for the material property. Catalog hashes refresh asset requests and combat sprite caches. Existing saved transforms remain valid; old captures are marked outdated through the established equipment-hash check.

`data/equipment-imports-144.json` now includes `runtimeMetallicFactor: 0.25` for these two items. The existing optimizer applies it only to runtime exports; `--reference` keeps source material behavior. Adjacent JSON records the deliberate adaptation. Run the same preparation/export commands in [the batch recipe](EQUIPMENT_BATCH_144.md). A fresh export reproduced all three current GLBs exactly. Keep source-color regression checks; do not replace their expected colors to conceal an export color-space error.

## Wizard Staff Grip

`wizard-staff-grip` is a separate item/equipment identity and action profile. It reuses `assets/models/weapons/staves/wooden-staff.glb` and its unchanged checksum `511a254c763dd9c1569dd181f1c72fa1ba83ef3b92bfc2b4f46517e0f773e1ed`. It adds no duplicated model or texture files.

- Label: **Wizard Staff Grip** in Equipment and Action profile.
- One right hand; bludgeoning; existing `staff` gameplay rule reference. No new damage, magic, ammunition or casting mechanic is introduced.
- Native scale `0.925` (provisionally 72 inches), primary grip `[0,0.55,0]`, position `[0.015,0.05,0.005]`, XYZ rotation `[-69.201659,-33.008024,46.485403]`, initial size 100%.
- No secondary grip and no two-handed body/finger solver. The left arm follows its authored animation and a shield remains compatible.
- Initial animation: the existing uploaded **Sword And Shield Idle**, additionally tagged for `wizard-staff-grip`. The rotation places the staff upright at the beginning of that recovered Carl pose. All 13 uploaded animations, including casting, remain selectable.
- Scale, attachment position and orientation remain editable and saved independently by equipment identity. The original Wooden Staff retains its two-handed defaults and solver.

The dedicated action profile stores its own Ready, Wind Up, Attack, Falling and Prone captures. Missing wizard poses use the normal fallback sprite, not captures with another weapon's grip. The humanoid semantic catalog records one-handed staff intent; its generic legacy pose fallback remains the existing one-handed family. Studio and Unit Package capture behavior continues through the shared action-profile system.

## Checks and publication

Run repository validation, including the existing equipment asset Python test. Added coverage checks the one-handed semantic type, separate capture profile, shared staff bytes, upright axis against the independently recovered animation quaternion, unchanged free-hand/spine pose, shield compatibility, editable palm pivot, blade material factors, unchanged texture colors, and preserved saved grips.

Local QA compared the short sword before/after in the same pose and lighting and inspected both brighter blades. The wizard staff holds upright in one hand with the other arm free; capture and persistence are checked through Studio. The Windows symlink test must pass unchanged in Linux CI before merge. Publish through feature PR → candidate → CI → merge → publisher/Pages, then compare live assets and modules against the merge and perform live Studio QA.
