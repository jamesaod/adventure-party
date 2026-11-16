# MOB library — Candidate Rev 202

1. In 3D Studio select the model and capture its poses. Use **Use in MOB Creator** to pass the current model, footprint, appearance and pose references directly to the sheet. The existing JSON/ZIP exports remain backups and publication artifacts.
2. In MOB Creator choose a saved MOB, or New / Duplicate. Previous and Next cycle through saved sheets. Save or discard edits before changing sheets.
3. Edit stats, weighted equipment/class choices and spells. The visual card uses the existing combat renderer and a deterministic example equipment roll; it does not change the template's probabilities. Select a pose or T-pose to inspect it.
4. Optional height in feet/inches scales the neutral body, excluding equipment. Blank preserves imported Studio scale. The shared combat renderer computes scale from neutral geometry and feet-per-hex framing once, then keeps it across poses. Changing pose or weapon must not refit body height.
5. Turn Combat ON and Save. Green requires a known model, Studio appearance, valid equipment generation and required pose assignments or supported fallbacks. OFF sheets stay editable but leave encounter choices. Save & Test opens the existing combat setup with the MOB as the player, or as an opponent; add opponents there.
6. Save writes to this browser/site folder. The sheet, catalog and encounter selector read the same merged library. Published entries and browser overrides merge by stable MOB ID, without duplicate rows. Export MOB JSON for repository publication; browser saves never claim to commit to GitHub.
7. Delete removes the local entry from the library and encounter choices and hides a published seed locally. Undo delete restores the last deleted sheet during the current page session. Repository files remain intact. Other tabs cannot resurrect a deleted MOB by saving stale edits.

## Repository integration

Add a normalized Unit Package under `data/mobs/` and one unique manifest entry in `data/mob-library.json`. No new factory or renderer is required. Existing Orc Fighter and Orc Archer are seeded this way. Older Kobold, Orc Leader/Shaman and dragon factory definitions remain explicitly labelled built-ins until converted into complete authored sheets; they are not invented editable packages.

`js/mob-library.mjs` owns merge/readiness/availability; `authoring-store.mjs` owns browser persistence and revision checks; `repository-mobs.mjs` adapts packages to existing combat rules and appearance recipes. `mob-preview.mjs` uses `combat-mob-renderer.mjs` for the sheet and catalog. Candidate and stable browser stores are isolated by path. Unit height is `mob.heightInches`; availability is `mob.encounterEnabled`. Old browser drafts default OFF; the published manifest seeds default ON.

Validation: `node scripts/test-mob-library.mjs` covers merging, deduplication, enable/disable, missing data, height roundtrip, scaling, stale edits, deletion/restore and storage isolation. Existing repository-MOB, equipment, pose and roster tests remain required.

For Minimum HP and no-class source selection, see [Monster baselines](MONSTER_BASELINES.md).
