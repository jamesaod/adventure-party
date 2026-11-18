# November 17 development checkpoint

Repository snapshot of accumulated combat, environment, creature, tree-weapon, and character-workshop development. This branch is a checkpoint, not a release or approval of visual QA.

Validation: combat/workshop runner passed 196/197; the sole failure was the new helmet test requiring a CLI repository path. That runner integration is fixed and the helmet test now passes across all ten locally available variants. In clean checkouts it explicitly skips the proprietary Synty fixtures, while retaining Quaternius checks. Validation-workflow, title audio, workshop project checks and syntax checks for the game and workshop entry points passed.

Outstanding: test-game-script-loader.mjs fails because existing descriptive cache tokens (starting with repository-mobs.mjs?v=scored-ai1) do not satisfy its R238C<number> requirement. This needs resolution before candidate integration. Full release CI has not been claimed.

Excluded local assets: Synty Starter source/conversions; native tree authoring binaries and textures under tools/tree-production; scratch water-renderer backup. Local files are retained. Runtime tree/creature assets, CC0 Quaternius parts, and the user-supplied Tripo helmet are included. The Synty workshop requires its locally supplied assets and is not self-contained in this repository checkpoint.
