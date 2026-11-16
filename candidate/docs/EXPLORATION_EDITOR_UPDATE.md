# Exploration editor update — 2026-11-05

- A larger 3D overview is an independent panel at the top right, with selection settings underneath. At narrower widths it moves above the editing panels. Exploration/Combat toggle retains production geometry.
- Map-wide Skybox selector: Classic sky (backward-compatible default), Clear Noon, Sunny Clouds, Clear Morning. Skybox IDs are validated and retained through map save, export/import, duplication, resize and editor test snapshots. The first-person renderer loads a local 2048×1024 CC0 equirectangular JPEG and falls back to the classic sky on loading failure. This is background artwork; ambient paint is unchanged.
- View → Wall Construction / Removal provides straight walls, edge removal, solid fill, solid removal/create floor, and quarter-round wall tools. Brush stays selected for painting. Erase removes the selected construction type; Undo remains available. Start/entrance/encounter safeguards still apply.
- Browser QA: enlarged preview renders; solid square becomes floor and Undo restores it; selected Sunny Clouds reaches first-person Test Map with no console errors.
- Repository checkpoint also preserves the accumulated local combat work since b792dbd: actual-model simplified GPU shadows, local-light shadow softness and ownership, GPU fire particles, fire loop audio per tree, sword flames/light/flicker, scorch lighting, blood/death/corpses, Chain Mail +5 and battle-end acknowledgement. Scratch experiments under work/ are excluded.

Validation: full local Node suite passed 129/129. Browser WebGL fixture and exploration editor/Test Map checks passed.
