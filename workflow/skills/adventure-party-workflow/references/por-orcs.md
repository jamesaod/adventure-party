# User-selected Pool of Radiance Orc sprites

Use the following selection established by the user's three reference images. Reconfirm only if the user changes the selection or the supplied source conflicts with it.

Source archive: `POR_Sprite_Extraction.zip`.
Source directory inside the archive: `POR_Sprite_Extraction/Combat_CPIC/area_1/`.

| Adventure Party role | Source catalog entry | Source folder | Visual identifier | Destination stem |
| --- | --- | --- | --- | --- |
| Orc | A1 #4 ORC | `004_orc` | Red/orange skin, sword, gold/purple shield | `orc` |
| Orc Leader | A1 #5 ORC LEADER | `005_orc_leader` | Blue sleeves and axe | `orc-leader` |
| Orc Shaman | A1 #33 MACE | `033_mace` | Light blue/cyan tabard, white sleeves, mace | `orc-shaman` |

For each source folder and matching filename prefix:

- Use `<prefix>_ready_full.png` for `assets/sprites/<destination-stem>-stand.png`.
- Use `<prefix>_action_full.png` for `assets/sprites/<destination-stem>-attack.png`.
- Use the original 24×24 full-frame PNGs, enlarged 4× to 96×96 with nearest-neighbor sampling. Preserve full-frame padding instead of substituting cropped alternatives.
- Preserve the current tactical rendering metadata by inspecting the registry. The established Orc trio uses a 36×36 rendered footprint, anchor `(48, 96)` in the 96×96 workspace, and native facing `right`; apply newer explicit user instructions if these change.

For example, the Shaman standing source is `POR_Sprite_Extraction/Combat_CPIC/area_1/033_mace/033_mace_ready_full.png` even though the game role is named Orc Shaman. Do not substitute an image merely because its catalog label says Shaman. Do not substitute HOBGOBLIN artwork for the selected Orc.

Preserve provenance in the existing asset registry when supported. Keep existing usage-status flags intact; selecting artwork does not change its approval status.
