# Tree production archive

Start with [the maintained runbook](../../docs/TREE_PRODUCTION_WORKFLOW.md).

- `white-oak/sources/`: nine editable SpeedTree SPM snapshots, originals untouched.
- `white-oak/source-inventory.json`: filenames, sizes, SHA-256 hashes and original location of source/export/texture files. OBJ/MTL/maps remain in that workspace; relink materials if opening these copies. This is not a self-contained material bundle.
- `historical-scripts/`: exact conversion/extraction/viewer references plus original export readmes. `.cjs.txt` prevents confusing them with current supported commands. They include workstation paths and obsolete text replacements. Do not run the historical patch chain against the current game; adapt conversion portions into staging and follow the maintained runbook.
- `validation-references/`: prior hidden-browser/geometry checks, also archived as text. Adapt paths, initialization and current expectations before running. Current repository tests are listed in the runbook.

These are local production records, not a grant to redistribute third-party SpeedTree material libraries. Preserve applicable asset license provenance.

- Sugar Maple: see [production notes](../../docs/SUGAR_MAPLE_PRODUCTION.md), editable sources and SHA-256 inventory under sugar-maple/. Original OBJ/maps remain in the documented workspace.

- Individual clubs: six native SPMs, manifest and converter reference in individual-clubs/. See [the repeatable club procedure](../../docs/TREE_AS_CLUB.md). Full export staging is in the authoring workspace outputs/tree-as-club/individuals; the archived converter needs those inputs and local paths.
