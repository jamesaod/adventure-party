# Terrain tuning lab — R238C448

Open Terrain Tuning Lab from the main menu, or terrain-lab.html. The iframe runs the real combat grass scene; terrainLab=1 holds it at round zero after asset preparation. No separate renderer or weather simulation. Drag pans, wheel zooms, Shift+wheel rotates. Inputs in the parent cannot trigger combat shortcuts.

Controls: snow/rain/cloud/wind, flakes, snow pause/clear/depth/full coverage, time, ambient percentage, tree outline color/width/opacity, supported tree MSAA, grass tint/brightness/dryness/shape/density/wind, rocks and sticks, performance overlay.

JSON format adventure-party-terrain-look, version 1. Exports validated presentation settings only, not maps or accumulated weather state. Imports reject unsupported versions, unknown fields, wrong types, nonfinite/out-of-range values and malformed colors before applying. Missing settings receive current defaults. Reset restores accepted defaults and clears snow. Lab settings are session-only and do not change normal combat defaults.

Ground cover setters update uniforms directly; geometry is rebuilt only on shape edits and placement caches cleared only on density/toggle edits. Outline stays in the existing compositor. No extra render loop or render pass. Ambient edits replace the map's ambient rows, letting daylight revisions invalidate the lighting cache. The original game remains the visual/performance reference.
