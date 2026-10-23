# Rev 109 binary asset integration — pending exact GLB objects

The Studio entries have been prepared on this feature branch but **must not be merged or published until GitHub actually contains the three binary files**. Source and derived binary filenames are stable. Do not replace them with a JSON stub or a Git LFS pointer.

Expected GitHub file paths:

1. `assets/models/dungeon-crawler-carl/new-carl/new-carl.glb` — exact source `New+DCC(1).glb`
2. `assets/models/orcs/new-orc/new-orc.glb` — exact source `New+Orc(1).glb`
3. `assets/models/dungeon-crawler-carl/new-carl/mixamo-sword-shield-qa/new-carl-sword-shield-attack-inplace-proof.glb` — Rev 108 offline baked proof

Exact expected byte sizes and SHA-256 are recorded in `data/new-tripo-qa-assets.json`, independently checked from the uploaded source files. Verify binary content with `node scripts/test-new-tripo-assets.mjs`.

Only the derived Carl QA GLB has an embedded animation: `Mixamo_Sword_Shield_Attack_InPlace_QA`. New Carl and New Orc source GLBs are intentionally animationless. The remaining 16 sword-and-shield animations have **not** been baked and must not be represented as already approved.

When these binaries are present, the three entries in `data/studio-models.json` become selectable from the repository-backed **Model library** without another browser-local ZIP import or ChatGPT download. Confirm all three load, that the original sources show correctly in T-Pose, and visually QA Carl's one-second clip before expanding to the Orc.

The developer GitHub connector available during this session accepts only *text or base64 contents* and cannot directly stream from local `/mnt/data/` binary attachments. That is why this is a pending integration branch rather than an untested public Candidate release.

Once assets are checked in, test GitHub Actions and merge this PR into `candidate`. Publish Candidate revision 109 only then; preserve stable `main` and all previous model entries. See `docs/TRIPO_MIXAMO_ANIMATION_BAKE.md` for the reproducible retargeting and visual QA steps.
