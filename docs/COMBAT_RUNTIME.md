# Shared combat runtime — Candidate Rev 260

All entry points call `startCombatSession` in `js/combat-runtime.js`. This owns renderer and material readiness, shared `newGame` / `createCombatGame`, the complete unit-render gate, optional round start, and the first presented frame. Late or cancelled startup completions cannot replace another battle.

Exploration supplies its saved map, roster and return route. Combat Test supplies its battlefield condition and configured roster. Spell Previewer supplies its observer/caster/dummies and controlled-input policy. Resetting the Previewer creates a normal battle through the same initializer and `startRound` / `beginTurn` path. A controlled actor is the only eligible initiative slot; the input adapter pauses after action completion and holds battle results inside the lab instead of navigating to loot. These policies live in the shared engine, replacing Previewer overrides of endTurn/victory/defeat. Dice, forced-save and audio/visual controls remain development inputs.

Every implemented preview spell dispatches `castPreparedCombatSpell`. Separate Sleep, Wall of Fog and Lightning Bolt simulations and the Previewer direct-damage helper are removed. Production damage/effect/death beats and cancellation remain common.

The renderer binds `combatSceneTerrain` and `combatSceneContext`. Imported maps bind their actual authored surfaces; legacy Grass/Wall scenarios provide renderer-only floor partitions and their original architectural walls. Indoor/outdoor boundary fragments cover each hex exactly once. Rendering adaptation does not replace CPU walls, spaces, bounds, deployment, LOS, targeting or movement.

All scenes use the existing shared GPU floor, solid-face and sprite stages, point-light shader, visibility-mask atlas and 30 FPS scheduler. Canonical grass/stone materials are loaded for every entry. Standalone tests no longer select a separate CPU terrain-lighting route. The explicit CPU reference option and complete >32-light fallback remain available on all entries. Current helper names containing Exploration are retained for API compatibility; render functions bind the common scene without swapping gameplay globals.

Existing player-camera/visibility rules remain CPU-owned. Material and mask caching, torch flicker, spells, door dimensions, terrain alpha transitions and context recovery retain their shared implementations.
