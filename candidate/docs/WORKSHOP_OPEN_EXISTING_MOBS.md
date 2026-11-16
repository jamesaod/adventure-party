# Reopening published Workshop MOBs — local R238C307

Model & animations now begins with Open existing MOB. Select a published Workshop MOB and choose Open for editing. Refresh list discovers newly published entries without reloading the page. The existing model-source controls still create/load a model, and Import Workshop ZIP still accepts exported projects.

The selector reads Workshop-package entries from data/mob-library.json. Older non-Workshop MOB formats are excluded, as requested. Opening fetches the full authored package and its immutable model asset, verifies the model SHA-256, and uses the normal project restoration path. Animation tracks and assignments, stats, inventory, model settings and all per-item fits are retained. The published ID is preserved in draft.publishedSource for subsequent exports. The editor opens the Model tab and displays the saved idle pose.

Downloads and validation happen before replacing the open draft. Existing restore rollback handles model/animation-binding errors. Edits use Save draft and Export Workshop ZIP; existing repository publication remains separate.

Validation: test-workshop-open-published uses the real Wood Elf Archer, checks complete data/model preservation, Back-fit ZIP round trips, source isolation, bad checksums, missing models, invalid references and UI handler failure order. Project and Back-slot regression tests pass. The same loader was also exercised over the running local HTTP server.