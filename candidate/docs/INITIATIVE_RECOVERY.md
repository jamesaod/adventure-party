# Initiative wait investigation — 2026-11-07

User reported Awaiting Initiative after an orc death in mixed-faction combat.
The supplied console screenshot contains favicon and optional action-library
404s, not a JavaScript exception. `readActionLibrary` handles HTTP 404 by
returning null. The original trigger is not yet reproduced or established.

Internal-browser reproduction: Carl, 15 hostile uniformed orcs, 10 friendly
uniformed orcs, all-friendly Quick Command. Completed six rounds to Victory
without console errors on the existing optimization build.

Confirmed separate failure path: an exception in a result-presentation callback
previously prevented scheduling the next result and left the active-result
flag true forever. Initiative polls that flag, causing a permanent wait.
The queue now reports presentation errors and continues its one-second cadence.
A generation guard prevents a callback that clears combat from rescheduling
an obsolete queue. No damage, initiative ordering, or AI rules changed.

Validation: test-combat-beat-recovery (failure reproduced before fix, passes
after fix), test-combat-turn-flow, test-spell-target-results, validate-repo.
The recovery test also covers cancellation inside a callback followed by a
new result. Changes remain local; original user lockup needs further evidence
if it recurs.

## Screenshot console errors follow-up (2026-11-07)

Fixed immutable WebGL texture storage in the hidden-unit outline pass. Mask
canvases change dimensions between animated units/poses; the old implementation
uploaded larger canvases into the first allocation. Track allocated dimensions
independently of the mutable canvas and dispose storage before a size change.
The battlefield raster texture likewise reallocates on canvas resizing.

Added an explicit empty optional action library for Carl's current model (keeps
existing fallback poses; no invented animation) and an inline empty favicon to
eliminate the two screenshot 404 requests.

Evidence: internal-browser outline regression reproduced GL_INVALID_VALUE 1281
three times with the old implementation; the fixed pass reported zero errors.
Node outline-resize, beat-recovery, turn-flow, spell-target-results, formations-
loadouts and repository validation passed. The internal browser ran 12 hostile
archers against 10 friendly fighters plus Carl through round 3 to VICTORY with
no captured console warnings/errors. The original user's exact initiative stall
was not independently reproduced; do not claim these GPU warnings proved its
cause. No orc appearance or rig changes in this fix. Local QA: environmentTest=56.
