# Animated explosion knockback and recovery

Accepted by the project owner on 2026-11-13 after the posed-body grounding correction.

## Behavior

Orcs start in a circle with random initial facings. A blast turns each Orc toward its outward travel direction, moves its root along a short eased arc, and plays UAL1 Source Death02. The final pose stays face-down. Survivors blend into Crawl_Exit, play the stand-up, then blend to Idle while keeping their outward heading. A 0–100% variation slider independently varies outward/upward launch values; its default is 50%.

The active prototype creates no physics world, rigid bodies or joints. Weapons and shields remain attached. The earlier solver-based dropped-equipment experiment remains in the repository, but is not the active page.

## Run and source map

Open `http://127.0.0.1:8276/ragdoll-test.html` with the repository's local server running.

- `../../ragdoll-test.html`: test controls and entry point.
- `../../js/ragdoll-lab-animation.mjs`: active scene, launch, scheduling and recovery states.
- `../../js/ragdoll-lab-rig.mjs`: published Orc loading, retargeting, pose sampling, trajectory and grounding.
- `../../js/ragdoll-lab-pose.mjs`: pose application/blending.
- `../../js/combat-model-source.mjs`: existing skeleton-safe clone export used by the lab.
- `../../assets/animations/ual1/ual1-death02-source.glb`: unchanged non-root-motion UAL1 Source asset supplied by the owner; contains Death02 and Crawl_Exit.
- `../../assets/animations/ual1/ual1-death02-source.json`: checksum and clip provenance. CC0 license and attribution are retained in the repository.
- `../../scripts/test-combat-ragdoll-lab.mjs`: asset identity and legacy physics regression coverage.

## Details that must be preserved

The published Orc is authored +Z-forward. Both clips must sample with LoopOnce and clampWhenFinished; default repeating actions wrap the exact final sample to frame zero and cause the erroneous stand–fall–stand sequence.

Grounding measures current skinned body vertices, excludes held weapon/shield socket subtrees, and adjusts only root height after the flight arc and during recovery. Cached bind-pose bounds caused floating. Horizontal landing alignment must remain stable. The current grounding loop visits mesh vertices; optimize or precompute contact offsets before using this on large crowds.

## Validation and limits

The latest grounding change passed the existing 105/105 combat regressions and was subsequently accepted visually by the owner. The suite does not independently prove visual contact quality. Earlier animation-only measurements were about 0.05/0.17/0.24 ms mean pose update for 1/4/8 Orcs; these predate the vertex-based grounding fix and must not be treated as current performance figures.

This is an isolated flat-ground prototype. Terrain, obstacle collision, gameplay damage, legal destinations, turn timing and inventory integration remain future work. The outward/upward controls drive a stylized arc, not a physical ballistic simulation. Recheck repeated launches, ground contact, recovery anchoring and large-crowd cost when integrating.

## Preservation

Keep the page, modules, supplied assets and their existing shared repository dependencies together. A copy of the repository working files can be kept in the owner's OneDrive workspace for recovery; cloud protection depends on OneDrive completing sync. No remote Git publication is implied by this note.
