# Title and preparation presentation — 2026-11-14

Restored Exploration Map Editor from the pre-cleanup backup, including its controller, styles, production overview, menu entry and return-from-test link. Saved map data was never removed.

Title uses the bundled Press Start 2P face. The four metadata rows separate published R238, published candidate revision 277, local R238C406, and a fixed last-update timestamp formatted in America/New_York. Published fields were verified from gh-pages/index.html and gh-pages/candidate/index.html on 2026-11-14. These are source build records, not a new remote publication.

Preparation uses a fixed 900 × 560 box, full scrollable action history, and a ready-only Space gate. The accepted Space input is consumed once, closes the modal and calls the existing beginCombatFromPrompt path. Failures retain history and offer retry/setup; cancellation releases pending readiness and restores input. Mid-combat equipment refresh retains its automatic finish behavior. Removed the stale retired music/Pixel Editor calls from the session owner.

Repaired valid UTF-8 sequences that had been misdecoded as Windows-1252 in launcher/combat text and environment/renderer errors. Gameplay rules and legitimate Unicode remain unchanged. The font-status-line removal is queued separately.

Validation: all 109 existing combat/Workshop regressions passed, plus the new preparation lifecycle test (110 total). Browser checks verified the restored editor/grid/overview; fixed box dimensions; full history scrolling; no early Space/Enter bypass; cancellation/failure recovery; and real model preparation followed by a single Space starting a real battle, without page errors. Directional sprites, battlefield fonts, MOB class/catalog parity, editor geometry and exploration authoring tests also passed.
