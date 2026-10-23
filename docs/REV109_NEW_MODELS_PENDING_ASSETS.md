# Rev 109 model integration — repository-backed and ready for visual QA

Three actual native Git binary objects have been added under the intended repository asset folders, with SHA-256 integrity checks in `data/new-tripo-qa-assets.json` and CI in `scripts/test-new-tripo-assets.mjs`.

1. `assets/models/dungeon-crawler-carl/new-carl/new-carl.glb`: untouched user-provided New Carl, no embedded animation.
2. `assets/models/orcs/new-orc/new-orc.glb`: untouched user-provided New Orc, no embedded animation.
3. `assets/models/dungeon-crawler-carl/new-carl/mixamo-sword-shield-qa/new-carl-sword-shield-attack-inplace-proof.glb`: New Carl with one offline-baked `Mixamo_Sword_Shield_Attack_InPlace_QA` test clip.

**Open Candidate → 3d studio → Model library**, select any of these three entries and click **Load selected model**. The model and proof now load directly from the published repository, with no local ZIP or device import. Inspect T-Pose and bare playback first, then equipment alignment.

**Visual QA is still pending.** Do not interpret a successful GLB load or SHA check as approval of the animation. The remaining 16 FBX motions from the Lite Sword and Shield Pack are not yet baked into published GLBs. The Rev 107 browser-side FBX retarget importer is an experimental path that produced visible failures; do not conflate it with the separately baked proof.

The exact bake procedure and evidence are in `docs/TRIPO_MIXAMO_ANIMATION_BAKE.md`. Previous sources, stable `main`, and candidate model alternatives remain unchanged.
