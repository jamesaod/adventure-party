# Combat cleanup checkpoint — 2026-11-04

User approved incremental cleanup while preserving existing combat behavior. Keep this work local for browser QA until asked to push.

Completed first pass:
- Removed superseded duplicate declarations of drawFloor, polygonPath, terrainColor and spellSaveTargetForUnit. Retained the previously effective definitions.
- Environment AIM warnings and preview suppression now use explicit calls from updateUi, drawAimAreaPreview and drawAimFriendlyFireWarning instead of replacing those functions at script load.
- Lodged arrows remain attached to the active floor renderer; preserve the arrow rendering regression test.

Completed second pass:
- Stable public longbowAttack, slingAttack, activateAimTarget and castPreparedCombatSpell functions own environmental admission. Environment scripts no longer replace these entry points.
- Existing protection, sound, casting-time, completion targeting and result wrappers compose the internal resolveLongbowAction / resolveSlingAction / resolveAimAction / resolvePreparedSpellAction functions in their previous order. This is an intermediate boundary, not a claim that all legacy wrappers are removed.
- Magic Missile volley completion still returns through the public spell entry, preserving targeting checks.
- scripts/test-combat-action-entry.mjs: checks early rejection, melee selection, actual missile protection order, cancellation cleanup, empty-hex shots, volley handoff and stable entry ownership.

Completed third pass:
- js/combat-missile-actions.js owns bow/sling hit resolution, Protection From Normal Missiles/Wind Wall routing and protected-shot paths.
- Missile result context is now an explicit AdventurePartyCombatResults.physical call, not a replacement of missile resolver functions. Melee presentation remains unchanged.
- The new file is a classic-script module using shared engine services; this pass does not claim full dependency isolation or move projectile/equipment/LOS services.
- Existing protected-bow and protected-sling ammunition behavior is deliberately preserved; balancing/cost changes are outside this refactor.
- scripts/test-combat-missile-actions.mjs covers actual result-context integration, both controllers, early admission, protection/Wind Wall and ammunition costs.

Completed fourth pass:
- js/combat-spell-actions.js owns prepared-spell dispatch and explicit sound-context, caster-focus, completion-target cleanup and casting-context stages.
- Removed five load-time resolver wrappers from level-3 dispatch, casting-time hooks, completion-target hooks, presentation and Fireball audio.
- Scheduled non-interactive completion calls dispatchPreparedSpellEffect directly, preserving its prior bypass of casting-context setup, focus and interactive cleanup.
- Existing per-spell resolvers, resource/commit rules, AI, Previewer and target-by-target presentation remain shared. Classic-script module still depends on engine services; dependency isolation is unfinished.
- scripts/test-combat-spell-actions.mjs checks order, success/rejection, exception restoration, nested contexts, completion bypass and extended/core/priest dispatch.
- Recovered from tool-output Bad Request on this pass: files remained intact and focused tests reran successfully.

Completed fifth pass:
- combat-casting-lifecycle.js owns cast records, timing, scheduling, disruption/cancellation, completion routing, completion-time target selection, begin-cast presentation and completion-AIM cancellation.
- r230/r231 hook files retain adapters to initiative, damage/save, armor, existing commit and UI entry points, preserving their capture order. They no longer replace scheduling/completion functions.
- Casting-start floating text now uses an explicit lifecycle call rather than replacing the scheduler. Historical core files are documentation stubs and are no longer loaded.
- scripts/test-combat-casting-lifecycle.mjs covers numeric/tied/multiround timing, one-time resources, interruption, completion AIM/cancel, AI no-target resolution and rejected effects. Balancing/cost semantics unchanged.

Completed sixth pass:
- combat-turn-flow.js owns rollInitiative, beginTurn and endTurn with explicit haste/effect adjustment and castingInitiativeSlots calls.
- castingInitiativeSlots lives in combat-casting-lifecycle.js and preserves busy-caster filtering, initiative storage and future-round synthetic slots.
- Removed rollInitiative/beginTurn replacements from r226/r230 hooks. Existing status/reaction handlers and startRound remain shared services.
- Preserved synthetic completion priority before ordinary result holds, status-before-guard expiration, unseen-MOB camera rules, session pauseAfterAction and old-encounter timer guard.
- scripts/test-combat-turn-flow.mjs covers these integration boundaries; no attack-rate, opportunity attack or Ranged Ambush rule changes.

NEXT STEP TO REMIND THE USER ABOUT:
Move startRound and its per-round unit resets into combat-turn-flow.js. Audit attack/shots refresh, spell/status expiry, burning trees and round-start ordering; retain fractional attacks, haste/slow and player/AI parity. Do not alter rules while extracting.

After that:
Extract action resolution into clearly owned modules, one action family at a time. Retain the shared combat session and 30 FPS frame scheduler. Keep gameplay LOS/targeting separate from visual lighting. Preserve player/AI/Previewer parity, equipment eligibility, environmental persistence and damage/death presentation timing.

Validation: scripts/test-combat-ownership.mjs, test-lodged-arrow-rendering.mjs, test-window-targeting.mjs, test-game-script-loader.mjs, test-combat-action-entry.mjs, test-combat-missile-actions.mjs, test-combat-spell-actions.mjs, test-combat-casting-lifecycle.mjs, test-combat-turn-flow.mjs, plus focused action tests as each family moves.

This checkpoint is repository memory, not a scheduled notification. At the next combat development session, mention the next step above before adding more cross-cutting patches.

## Authorized ten-step cleanup — November 5, 2026

User authorized all ten steps without further prompts. Work remains local; nothing pushed or deployed.

| Step | Result |
| --- | --- |
| 1. Round setup | startRound/per-round resets now in combat-turn-flow.js; unchanged extracted body. |
| 2. Movement/reactions | Footprints, paths and movement in combat-movement.js; reach/Guard/Ranged Ambush in combat-reactions.js. |
| 3. Melee | combat-melee-actions.js owns hit/sweep and explicit result → sound → Slow → perception ordering. |
| 4. Spell families | Damage/control/support resolvers extracted behind the shared spell dispatcher. |
| 5. Environment | Persistent environment state/geometry/fire separated from environment action orchestration. |
| 6. Visibility/targeting | CPU visibility and target selection have distinct owners; intact-window targeting rule retained. |
| 7. Rendering/lighting | Frame, surfaces, units, light services and effect animation have separate owners; shared scheduler retained. |
| 8. Encounter state | Setup, render-readiness, results, exit and encounter return consolidated in combat-session-state.js with existing runtime. |
| 9. Overrides/globals | 198 legacy stages across 125 services now use a named ordered registry and stable facades; shared state remains explicit classic-script scope, not fully isolated ES modules. |
| 10. Verification/docs | Architecture/extension guide and CI checks added; 120/120 test files pass. Browser smoke validation completed with no runtime errors. |

Extraction audit verifies 208 moved function bodies unchanged; the main file is now about 22,946 lines versus roughly 31,600 before the earlier cleanup passes. See COMBAT_ARCHITECTURE.md, COMBAT_CLEANUP_TEST_RESULTS.json and js/combat-module-manifest.json.

Final two test failures resolved: corrected documented Falling fallback expectation and fixed Wizard Staff isolation; Windows sprite-package fixture uses workspace temp directories and a junction. The full suite ran outside filesystem sandbox to exercise Windows junction protection without skipping assertions.

This supersedes the earlier NEXT STEP notes. No further cleanup is required merely to begin adding features; visual/player QA and any desired future dependency isolation remain separate work.

### Final browser validation — November 5, 2026

Internal browser, local build R238C293 at http://127.0.0.1:8276/index.html?environmentTest=17. Clean startup; Wall Test initialization; round/AI handoff; player movement; empty-hex bow shot; scheduled Shield completion and applied status; subsequent AI hit/miss and next round; exit to launcher; fresh grassy encounter and tree rendering; Spell Previewer Fireball through production dispatch, five sequential target damage results and Sequence complete; return to launcher. No browser runtime errors. Evidence: work/cleanup-wall-test.png and work/cleanup-previewer.png. These are smoke checks, not exhaustive visual QA of every spell/map combination.

Final result: all ten authorized cleanup areas implemented and documented; 120/120 regression test files passed. Files and architecture docs are saved locally; no push, merge or deployment. Shared state and legacy feature-stage implementations remain intentionally classic-script-based; the explicit registry makes their composition inspectable rather than claiming they are fully dependency-isolated.

### Repository checkpoint — November 5, 2026

Saving the completed combat cleanup, environment/window/scorch work, universal equipment fixes and shared black-shaft/white-fletching arrow rendering with soft offset shadows. Regression verification: 119/120 passed in the full run; the remaining directional-sprite startup fixture was corrected to normalize CRLF before text extraction and passed on rerun. No gameplay change was needed for that fixture. Earlier internal-browser smoke evidence remains recorded above.

Queued after this repository push: narrow arrow fletching along the shaft; replace offset arrow shadows with sun-position-based projections. Local work/ scratch files and the separate GPU oak experiment are excluded from this checkpoint.
