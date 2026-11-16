# Development checkpoint — 2026-11-09

Repository backup of direct-model combat, animation and performance work, replacement weapon assets, blue orc selection, and MOB Workshop authoring/publication integration. This is a development checkpoint, not a release or deployment.

Validation: 145/166 workflow commands passed locally on Windows / Node 24. Outstanding commands:

- node scripts/test-game-script-loader.mjs
- node scripts/test-combat-module-boundaries.mjs
- node scripts/test-flaming-sword.mjs
- node scripts/test-fbx-animations.mjs
- node scripts/test-blond-scale-mail-model.mjs
- node scripts/test-male-orc-model.mjs
- node scripts/test-orc-leader-model.mjs
- node scripts/test-orc-female-shaman-model.mjs
- node scripts/test-orc-female-shaman-v2-model.mjs
- node scripts/test-studio-batch176.mjs
- node scripts/test-studio-weapon-sets.mjs
- node scripts/test-orc-sword-profile.mjs
- node scripts/test-mob-appearance.mjs
- node scripts/test-combat-mob-renderer.mjs
- node scripts/test-combat-roster-setup.mjs
- node scripts/test-sprite-set-package.mjs
- node scripts/test-weapons-196.mjs
- node scripts/test-repository-mobs.mjs
- node scripts/test-exploration-rendering.mjs
- node scripts/test-doorway-movement.mjs
- node scripts/test-doorway-navigation.mjs

Failures include legacy sprite/catalog/axis expectations, extraction-body checks, incomplete VM harness dependencies, and Windows symlink permissions. They remain unresolved at this checkpoint; do not treat this as green CI. Workshop-specific tests pass and a controlled Workshop unit completed a browser combat test to victory. See MOB_WORKSHOP_COMBAT_AUDIT.md for incomplete advanced creature consumers.

Generated assets/combat-units caches (~1.97 GB), temporary Workshop fixture output and work/ scratch files are retained locally, excluded from this checkpoint. The model sources and preparation tools are included. Legacy combat units may require preparing assets through Studio on a fresh installation; this checkpoint is not a ready-to-deploy standalone build.
