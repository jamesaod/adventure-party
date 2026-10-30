# Exploration Test — Candidate Rev 206

Open **Exploration Test** from the title menu. The Old Tollhouse is a 16 × 16 enclosed grid with an entrance hall, pillared hall, eastern gallery, guardroom and connecting passages. Every traversable square is reachable. A square represents ten feet; the camera makes one grid step or a 90-degree turn at a time with a brief visual transition.

W/S or Up/Down move forward/back. A/D step sideways; Q/E or Left/Right turn. F toggles the door directly ahead. Buttons provide the same actions. Escape returns to the title, and Restart walk restores the start and closes all doors. The optional pixel-style view limits rendering resolution. Reduced-motion preferences suppress transitions and flame flicker.

This is a standalone presentation and collision proof of concept, not an encounter engine or map editor. The right-hand name/AC/current-max HP roster is example data, has no portraits or fixed party-size limit, and does not modify combat characters. Walking state is deliberately temporary.

## Reproduction and extension

- `data/exploration/old-tollhouse.json` is the authored map: `#` wall/pillar, `.` floor, `D` door. Door axis `z` means its closed face looks north/south; `x` means east/west. Start, torches, landmarks and sample roster are explicit data.
- `js/exploration-core.mjs` owns map validation, collision and discrete walk state without graphics dependencies. A future editor should write this map schema rather than manipulating scene meshes directly.
- `js/exploration.mjs` uses the bundled Three.js module for textured walls/floors, hinged doors, torchlight and first-person camera interpolation. It does not change Studio, equipment or tactical combat rendering.
- `assets/textures/exploration/` holds original generated PNGs. `generation.json` records prompts, checksums and generation mode. They are used unchanged; no original game artwork was copied.
- Run `node scripts/test-exploration.mjs` for movement, door, reset, boundary and reachability checks, followed by repository validation. Visually check opening/crossing a door, wall collision, turning and restarting in a WebGL browser.

Future work: real party state, planned/random encounters, exploration saves and the separate authoring interface. These are intentionally not represented as functioning features in this prototype.
