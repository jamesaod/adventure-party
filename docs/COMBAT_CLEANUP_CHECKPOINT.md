## Local R238C445 — Text injury/death reactions

Replaces sampled and synthetic injury/death voices with nonrepeating onomatopoeia in the shared unit bark path. Damage result beats select light below 20% max HP and heavy at/above; death takes priority and uses the existing deferred death presentation. All unit types participate, zero damage is silent, death speech survives alive=false. Friendly blue/enemy red speech uses fixed 16 logical screen pixels independent of zoom, dark text stroke, head/trunk anchoring and overlap stacking. Shared speech now colors incantations too. Removes voice sample preload/playback but retains unrelated combat/footstep audio and archived source assets. Local only; no combat rules changed.

## Local R238C438 — Ambient fir contact and feathered snow shelter

Existing circular contact draw now removes only the ambient share, normalized against solar and local contributions using the established projected-shadow receiver/light model. Ambient contact remains at low sun and gets a subtle blue tint only where snow survives canopy shelter; directional shadows keep their separate behavior. Existing shared shelter texture is reprofiled once on configuration: roughly inner 40% of canopy radius protected, smoothly feathering to full snow beyond the canopy. CPU snow deposits/height and GPU snow presentation keep the same texture identity and revision. No additional draw pass or per-frame field rebuild. Local only; user visual QA pending. See workspace work/fir-contact for staging and rollback.

## Local R238C437 — Branch texture snow experiment

Replaced interpolated canopy shelves with an independent snow shell following actual foliage triangles and needle alpha. Reuses createCorpseSnowMap persistent grain deposition, four gated coats, map updates only when quantized tree accumulation changes. First two coats establish coverage; later coats raise the shell with a 12-inch maximum total lift, including the thin surface offset. One midpoint subdivision (at most four snow triangles per source triangle), near-vertical cards excluded. Original green geometry, accepted daylight albedo and premultiplied alpha stay intact. No additional frame loop or per-frame raycasts. Branch snow uses existing tree snowAmount, not new particle collisions or an independent weather clock. Local experiment; visual/performance acceptance pending. Reproduction and prior canopy module in workspace work/fir-snow.

## Local R238C436 — Fir daylight brightness

User supplied 08:10 as the desired noon foliage appearance. Needle material uses neutral 0.5 linear albedo multiplier; bark, snow, sun direction/intensity and world lighting remain unchanged. Retains premultiplied alpha correction and original unstretched geometry. Five-variant weather-adjusted probe at ambient 250: previous 08:10 mean foliage luminance 126.3, previous noon 146.8; calibration 0.45 at noon 122.7 and 0.65 at noon 137.4. Chosen 0.5 targets the supplied morning reference. This is a material adjustment, not a clock or shadow override. Body/top/shadow atlases rebuilt. Local only; user visual acceptance pending.

## Local R238C435 — Restore fir proportions and correct needle alpha

User rejected widened foliage as distorted. Restored original five SPM/FBX shapes, retaining 1024px color/normal exports and fine-needle cutoff. Original triangle counts unchanged. Foliage now premultiplies fractional alpha before MSAA resolve, matching the existing tree compositor. Before correction the production direct-render probe found 544 edge pixels with recovered linear green above 1.05 (maximum 2.19); after correction zero (maximum 0.733), with the same 15,085 edge pixels. No extra pass or geometry. Rebuilt all atlases; updated versioned cache chain. Source/reproduction scripts and backups: workspace work/fir-correction. Visual QA remains with user, local only.

## Local R238C434 — Fuller fir foliage

Wider native SpeedTree sprays on all five trees, 1024px exports and fine-needle alpha retention. Unchanged triangle counts and draw primitives; refreshed body/shadow/top atlases and versioned assets. See SPEEDTREE_FIRS.md. Local only; visual/performance acceptance pending.

## Local R238C433 — SpeedTree fir replacement

Five low-poly user-authored SpeedTree firs, 2,950–4,268 triangles; removed duplicated foliage, rebuilt fallback/editor atlases, preserved fire/snow/placement contracts. See [SPEEDTREE_FIRS.md](SPEEDTREE_FIRS.md). Local only; user visual QA pending.

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

## 2026-11-10 Sleep and rendering performance pass
- Living Workshop sleepers use fallingPoseStartedAt independently of attack and movement clocks. Regression: scripts/test-workshop-sleep.mjs.
- Sleep visual effects start simultaneously, with one sound and no repeated per-target camera focus.
- Identical Workshop pose samples reuse rig state; direct unit cameras are reused.
- Tree placement is cached by game, terrain, map bounds, tile set and visible tiles; occupancy and spawn clearance remain live. Explicit map-bounds filtering retained.
- Unit submissions outside the viewport are skipped before rendering.
- Solar changes invalidate tree self-shadow contents without disposing/reallocating their GPU targets.
- Counters: workshopPoseEvaluations, workshopPoseSampling, treePlacementCacheHits, treePlacementBuilds, offscreenUnitsSkipped (combatProfile=1).
- Passed: sleep regression, publication, bow visual states, attack pose handoff, enemy-only stray arrows, Workshop grounding, changed-file syntax checks. Publication rerun with workspace TEMP resolved sandbox rename issue.
- Internal browser verified local launcher loads. Full multi-target Sleep visual QA and before/after frame-time profiling remain unverified; do not claim measured FPS gains. Trees already use GPU rendering; these changes reduce CPU preparation/resource churn, not migrate gameplay rules to GPU.

## 2026-11-10 Baseline and separate corpse performance pass
- Settled corpses bake their final deformed geometry once. Subsequent frames reuse it without animation/rig sampling. Textures remain shared; geometry is independent per corpse. Resurrection, a new death, and source-asset replacement invalidate the cache.
- Unobscured living units skip silhouette-mask/outline preparation after the spatial occluder query.
- Tree ground shadows query a per-frame spatial index of floor receivers rather than scanning the complete visible floor for each tree.
- Shadow fragments outside the source silhouette UV rectangle are discarded, avoiding repeat-wrapped silhouettes on oversized receiving polygons.
- Terrain buffer mutation checks compare constant attributes once per face; per-vertex attributes and topology remain checked. Unchanged GPU buffers are reused.
- Profiler adds frame submission and corpse bake timings. Nested CPU timings must not be summed; frame submission does not include all outer animation-frame work.
- Passed: test-combat-settled-corpses.mjs, test-combat-render-cache.mjs, test-combat-performance.mjs and changed renderer syntax checks. Tests cover frozen geometry isolation, shared textures, zero repeated corpse samples, cache invalidation, mutation detection, shadow-only buffers, and randomized painter ordering.
- Internal-browser smoke test: Carl versus six published Wood Elf Archers advanced through round six with four remaining MOBs, including multiple deaths, without an observed initiative stall. Initial Orc Archer setup failed due to pre-existing missing published prepared assets. The test tab later returned to about:blank; final visual evidence and controlled before/after FPS measurements are unavailable.
- Limits: corpse draws remain separate; ground-shadow draws are not fully batched. These changes do not establish that every performance bottleneck is eliminated. Validate large encounters and zoom levels on the user's hardware with the profiler. No push/deploy performed.


## Grass scatter repair — 2026-11-11 (local QA)

Source checkout: C:/Users/james/Documents/Codex/2026-10-26/continue-development-of-adventure-party-using/work/repo. Continue using this checkout; the OneDrive workspace contains helper scripts, not the game. Local server: http://127.0.0.1:8276/. No push or deployment in this repair; preserve the other pending local changes.

The prior grass scatter derived blade dimensions/count from clipped floor-fragment area and sampled grass artwork for stones. Blades were subpixel-width and tiny; fragmentation also suppressed placements. Grass normal relief only ran under experimental dynamic lighting.

Fixed in combat-grass-scatter.mjs, combat-webgl.mjs and exploration-combat-hooks.js: explicit grass classification, deterministic world-grid placements, metre-based curved tufts, faceted stones with independent colors, inherited ground lighting/visibility, snow burial, and default-path grass microrelief. All geometry stays in the existing floor draw. Gameplay geometry is unchanged. Changed entry points use cache token R238C295; the overall historical build label was not renumbered.

Verified: test-combat-grass-scatter, test-combat-webgl, test-outdoor-grass, test-combat-render-cache, test-game-script-loader, test-combat-visibility-performance and syntax checks passed. Added scatter test to validation workflow. Production browser fixture scripts/fixtures/combat-grass.html passed: 199852 changed pixels, 1611 high-contrast scatter pixels, one floor draw. Actual Grassy Battlefield reported 2510 scatter faces and 9618 floor triangles in one draw, with no browser error logs. Visual comparison saved in the OneDrive workspace at outputs/grass-scatter-fixed.png.

Separate existing failure: scripts/test-combat-view-environments.mjs does not provide battlefieldRotationTween to its VM fixture and fails in rotateBattlefield. This repair changes no rotation logic; its own six-angle geometry checks and existing six-angle LOS checks pass. A live rotate-button recheck was unavailable after the game tab became blank. Do not claim the full suite passed.


## Layered ground snow trial — 2026-11-11 (REJECTED; replaced below)

User approved trying a translucent-looking dusting followed by opaque white buildup, inspired by the linked Unity Reddit clip. combat-webgl.mjs now uses continuous accumulation amount (green channel) for a restrained 32%-maximum dusting blend, followed by world-anchored powder patches at higher amounts. Powder drives normal replacement; thin snow preserves ground detail. Grass/scatter burial now follows depth and starts after the dusting stage. Accumulation rate, melting, footprints and indoor eligibility remain unchanged; no extra terrain draw, texture target or animation loop. This trial changes ground snow; canopy and corpse material behavior is retained. Cache token R238C296. No push/deploy.

Interactive production-renderer check: http://127.0.0.1:8276/scripts/fixtures/combat-snow-layers.html . Uses actual snow state/texture and floor shader, with an isolated accelerated clock. PASS: bare/dusting/powder/full-cover luminance 93/112/159/226; at 12% dusting all sampled ground retains color and no pixels become opaque white; full melting restores baseline, indoor snow remains zero, one floor draw. Live Combat System Test loaded and accumulated snow with no browser error logs.

Passed targeted Node checks: combat snow state, footprints, grass scatter, game script loader, WebGL surfaces/projection, renderer cache, corpse snow lighting; syntax and diff whitespace checks. Backups for this trial: OneDrive workspace work/snow-layers-before. Do not rerun the one-shot helper against an already patched file.


## Persistent particle snow — 2026-11-11 (local visual trial)

The user rejected the broad noise-patch trial and supplied six screenshots showing separate first deposits, a joining thin coat, brighter second deposits and then depth. They explicitly requested our own algorithm. Do not restore the noise-mask approximation.

combat-snow.mjs now retains an additive GPU deposit map. A bounded batch stamps randomly rotated elliptical grain clusters, accumulating mass only where they land. Visible flake landings are consumed first; additional fine snowfall samples maintain the existing rate when falling-flake display is hidden. Snow masks derive from deposited mass, not a procedural spatial pattern. Local heat multiplies down the stored deposits; clear resets them. Existing hex means still drive canopy/corpse/footprint state. CPU sampling uses binary area-weighted selection and reusable buffers; deposition updates at 4 Hz with at most 32768 grains per batch. Map dimensions are bounded to 2048 per axis.

Ground material maps low mass to a thin, partially revealing coat and repeated hits to brighter opaque snow. Height gradients supply relief; actual floor lift starts only at high deposited mass and is capped at 1.5 world units (about 3.5 cm). No deep drifts. Added combat-snow-deposits.mjs and its focused regression; cache token R238C297. Preserve other pending local work; no push/deploy.

Preview: http://127.0.0.1:8276/scripts/fixtures/combat-snow-particles.html . The old combat-snow-layers.html redirects here. Grass and Stone both pass browser checks for separate first deposits, persistent overlap while paused, full melt and indoor exclusion. Pause comparison excludes the framebuffer's outer two pixels, exposed by the shallow vertex lift. A stone run retained 54% untouched ground after its first five seconds; six stages rose in mean brightness from 57 to 224. One floor draw; one additional deposit draw only on update ticks replaces the old coverage-map bake. Exact matching to the reference remains the user's visual review.

Targeted passing checks: snow deposit batching/mass/time slicing/landing coordinates; snow state; footprints; grass scatter; WebGL surfaces/projection; render cache; ordered loader; syntax and whitespace. Backups: OneDrive workspace work/particle-snow-before.

Live particle-snow smoke check: Grassy Battlefield at full snowfall ran 1734 frames; last 120 averaged 33.34 ms between frames (~30 FPS), 16.61 ms CPU submission, 0.47 ms snow CPU work. This is a single-scene sample, not a general performance guarantee. No browser error logs; floor stayed at one draw. Clear/restart and final grass/stone browser regressions passed.


Local Rev 298 — snow coat coverage rules (2026-11-11):
- Thin base and opaque powder now have independent retained particle-deposit channels. Second-coat grains start only after 90% eligible ground coverage in the base. The last 10% of the base fills with targeted grains as the second progresses to 20%; every eligible base texel is covered by that point.
- combat-snow-coats.mjs tracks the same snapped grain brushes sent to WebGL, with an indexed set of remaining gaps. No runtime GPU readback, procedural coverage mask, extra terrain draw, or new animation loop. Partial/local melt updates both coat counts; clear resets both.
- test-combat-snow-coats.mjs checks the two milestones per deposited grain and local melt/restart. The particle fixture checks actual GPU texel coverage against CPU counts, both milestones, pause, clear, indoor exclusion and the single floor draw; it displays live coat percentages. Snow/footprint/corpse/renderer/cache/grass/loader checks passed locally.
- Cache chain R238C298. Local QA only; not pushed or deployed.


Accepted default snow system — 2026-11-11:
The user approved the Rev 298 particle system for the game. It is already wired unconditionally through index.html → adventure-party.js → combat-webgl.mjs → combat-snow.mjs; the preview uses that same renderer. No preview flag or alternative implementation is needed. Preserve the two coverage milestones and existing snowfall, falling-flakes, pause, clear, heat/melt and footprint controls. This approval supersedes the earlier ground-snow trial status. Existing canopy/corpse behavior remains as previously integrated. No publication requested.


Local Rev 299 — model-attached flaming sword (2026-11-11):
- Replaced the stale seven-point Canvas flame overlay with a blade silhouette drawn from the actual posed sword geometry. Model-local blade coordinates survive prepared captures and live rig animation; the mask uses the same sampled pose, view yaw and crop camera as the character. The grip is excluded and the body/shield write depth to hide rear blade surfaces.
- Reuses combat-unit-burn-effect.mjs for the rising flame edges, with a warm core fill for the sword. Unit burn reactions reset to their original edge-only mode. Lighting/gameplay emission stays on the existing item-light contract; invisible, dead, unequipped or extinguished weapons do not emit this visual.
- combat-weapon-flame.mjs owns blade tagging, source-topology matching for old prepared assets, equipment eligibility and the depth mask. No character rebake or GPU readback at runtime. Lit swords get one bounded mask pass and one flame composite; ordinary weapons retain batching. Shared animated rigs are sampled once before both model and flame draws.
- scripts/fixtures/combat-flaming-sword.html uses the production renderer and actual Carl prepared geometry/live walk rig. Browser checks cover idle/walk/attack poses across six view angles, body occlusion and switching to an ordinary sword. Node checks cover blade/grip/body tagging, prepared migration/serialization, animation/view transforms, material restoration, burn-mode reset, equipped/lit states, equipment/renderer/lighting/loader compatibility. Cache token R238C299. Local only; no push/deploy.

Rev 299 final visual QA: flame edge size follows model size and camera zoom; the low core fill keeps the metal readable. Main-game inventory successfully readied Flaming Sword +5, then camera rotation and Attack/Live inspection retained one sword-mask pass and one flame composite with no console errors. Sampled frame interval was 33.26 ms (~30 FPS), mask submission 0.027 ms CPU. The enlarged production-renderer preview passed again after the final visual tuning.


Local Rev 300 — sequential snow coats and displacement (2026-11-11):
- Latest user instruction supersedes the Rev 298 milestones: thin coat must cover 100% of eligible ground before powder deposits begin, then powder must cover 100% before independent third-layer height deposits begin. Coverage remains measured from retained particle grain texels, including their visible threshold; it is not a procedural reveal mask or a global timer.
- The persistent RGB map now stores thin coat, powder and height separately. Each coverage coat has an indexed gap list so fine snowfall can finish the last holes; visible flakes retain their actual landing texel. Local melt and clear update all three fields. A melted gap is repaired in layer order before more height can accumulate.
- Only the third channel lifts outdoor floor vertices. Height samples are filtered and smoothly mapped to the existing restrained 1.5-world-unit maximum (about 3.5 cm). Displaced outdoor floor triangles receive four subdivisions per edge (16 triangles); indoor floor, scatter and shadow buffers stay unrefined. Numeric source snapshots and unchanged buffers remain cached, with no extra terrain draw or animation loop.
- Wired directly through the normal game entry points with cache token R238C300, including the render-cache dependency. Existing canopy/corpse snow and weapon flames are preserved; object-wide displacement remains future work.
- Targeted Node checks passed for sequential coat coverage, finite completion, local melt/refill/clear, visible landings, indoor exclusion, displacement topology/UV/lighting/cache reuse, particle batches, hex snow, footprints, render cache, renderer, grass scatter and game loading. Added the displacement regression to validation CI. No browser preview or visual QA was performed for this change, as requested; user will assess appearance and performance in the game. Local integration only; no remote publication.


Local Rev 301 — correct visually incomplete snow coat transitions (2026-11-11):
- User screenshot showed brighter powder patches while the thin coat still had visual gaps. Rev 300 incorrectly treated mass 4/255 as a completed texel; at that value the material blend is practically invisible. Even one central grain (46/255) could count as complete while its coat was only about half developed. The old tests repeated that incorrect definition.
- Both coverage gates and their missing-texel indexes now require mass 87/255, the first byte reaching the shader's full .34 blend endpoint. The material ramp constants are shared between tracking and rendering. First-coat translucency remains .62; second coat reaches full powder opacity everywhere before displacement starts. Third-channel presence still uses the visibility threshold.
- Added a regression reproducing the early transition after a single grain, checking the material blend rather than merely touched pixels. Coverage, local melt/refill and clear checks now verify full material blend. Cache chain R238C301; integrated directly into the game. Visual QA stays with the user; no preview generated.


Local Rev 302 — standing shadow scale (2026-11-11):
- Snow Rev 301 targeted checks passed, including full material-blend completion, melt/refill, displacement, footprint, renderer and startup checks; the local server served the corrected entry point.
- User reported Carl casting a giant shadow while standing, with normal scale while moving. Read-only inspection of the published flaming-sword Carl pack found ready-pose stored shadow rise .53750 versus .28586 for the actual model/camera (1.8803x); attack and other captures were approximately matched. The stationary path explicitly returned null from liveShadow, selecting that stale capture.
- Removed the stationary bypass for all direct 3D units. Prepared idle/attack poses now use the same sampled geometry and capture camera as moving/Workshop poses, with per-entity transform snapshots cached by asset/pose/yaw. Existing registered GPU shadow LODs are still honored, and PNG-only units retain their silhouette fallback. No special Carl scaling and no runtime mesh simplification or CPU vertex copies were added. Static prepared meshes without LODs use their actual GPU geometry.
- Regression covers moving-to-standing transition, stable cache reuse, unrelated PNG fallback, four unit sizes, all six view angles, rejection of a deliberately oversized saved capture, and all six standing facings from the actual published Carl model. Registered live-presentation regression in CI. Normal game entry cache R238C302; visual/performance QA remains with the user, no preview generated.


Local R238C316 — validation and corpse performance hardening (2026-11-12):
- Settled body images now reuse bounded GPU targets and refresh for view, light and snow changes. Final-pose baking retains registered simplified shadow geometry. No-snow corpses skip snow lighting. See COMBAT_ARCHITECTURE.md for ownership, measurements and the reproducible numeric browser probe.
- CI uses Node 24 via .node-version, discovers 76 combat/Workshop regressions, and no longer folds multiple asset tests into one command. Shared explicit camera/audio and image fixture dependencies replace missing stubs; stale instant-rotation/cache-version assertions were corrected without weakening their behavioral checks.
- Broader validation caught a genuine mixed-catalog incompatibility: the legacy uploaded-FBX owner rejected newly added Workshop GLB entries. It now validates both supported catalog formats and loads only its FBX entries; Workshop keeps its GLB path and existing saved FBX IDs remain stable. Real-file FBX regression checks cover all 28 source hashes plus the original 23 FBX clips and recovered rig references.
- 76/76 combat/Workshop regressions passed. Remaining 148 Node CI commands passed across the complete run plus corrected footprint-fixture rerun. Browser: 12 settled corpses, zero errors, 12 image-cache hits/frame, and refresh/reuse verified after snow, melt, clear, lighting, rotation and zoom. No preview delivered; no remote publication.

Final R238C316 verification: the deferred-snow-mask build passed the saved browser probe with no JavaScript/shader errors. The same 12 corpses reused 12 images per frame, refreshed after all six view/light/snow changes, and retained 6.37 MB. Model submission averaged 0.094 ms; the initial measured final-pose preparation dropped from 45.3 ms before to 8.7 ms with no snow. Total frame submission was 15.13 ms in this sample, still at the 30 FPS cap. The report is .local/corpse-profile-r316.json. Two expected exact-key asset misses are recorded separately; the existing Carl visual-index fallback supplied the valid model. CI Python syntax checks also passed.

Local R238C317 (2026-11-12): removed grass/rock scatter from floor submission and its UI label. Snow deposition uses twice the texture resolution per axis (up to 4096), halving grain dimensions while preserving CPU/GPU coverage agreement. Corpse accumulation now runs from 0 to 3: translucent first coat completes before opaque second; upward displacement begins only after both complete. Corpse shader grain frequency doubled. Bare corpses retain deferred mask preparation and cached images; all stages invalidate the cache correctly. Blood stains use a cached source-atop snow tint; pools receive one white coat capped at 50% opacity, with local snow/melt/clear driven by their ground hex.
Orc Warrior imported as new stable ID orc-warrior using explicitly approved default AI; original ZIP preserved. Import live verification passed (male Orc, morale 11, 1d8 HP, 30 clips). Combat AI expansion recorded in USER_FOLLOW_UPS.md.
Browser check passed all three corpse layers, melting, clearing, lighting, rotation and zoom without JavaScript/shader errors; 12 settled bodies retained 12 cache hits/frame. Visual QA remains with user.

Local R238C318 (2026-11-12): pending lethal hits stay on the unit's normal render route and depth ordering until deathPresentationStartedAt is set by the death beat. The corpse queue starts at that boundary, preserving legacy Orc rendering and avoiding a premature renderer switch. The shared rule applies to player, allies and enemies; gameplay alive/dead state is unchanged. New regression verifies legacy and Workshop Orcs draw exactly once during alive, pending, falling and settled stages. Death scene, cached corpse and ordered-loader checks passed. User visual QA pending; no remote publication.


Local R238C319 (2026-11-12): corpse crossing, snow brightness, outline work.
- Sort feet use the same walking interpolation as rendered sprites. Settled bodies add local corpse-before-live constraints within their ground footprint using existing spatial buckets; intervening wall-side constraints win. Falling bodies retain ordinary ordering. Regression covers six view directions, movement and wall separation.
- Settled corpse buffers use RGBA16F where EXT_color_buffer_float is supported, with supported MSAA counts and correctly budgeted 12-byte color/depth accounting. This removes the RGBA8 pre-ACES highlight cap on corpse snow; removed extra 3% dimming. Scratch fallback uses the same format, and unsupported hardware retains the previous bounded color conversion. Conversion follows the actual render target, including transient/burning paths. Other unit/tree targets remain unchanged.
- Outlines means hidden-unit faction silhouettes behind scenery. Flush ordinary queued models BEFORE starting its GPU query, so model/composite costs are no longer misattributed. Transparent tree-atlas mask regions now exit before GPU silhouette rendering; blue/red outlines remain enabled for real coverage. Canvas alpha inspection uses a read-optimized mask canvas. Active-unit lookup supports the actual string ID.
- 80/80 combat/Workshop regressions passed. Isolated browser probe: no JS/shader errors; 12 settled corpse image hits/frame, one live model pass; all three snow stages, melt/clear, lighting, rotation and zoom refreshed/reused correctly. No outline GPU pass was submitted in the unobstructed test scene. Retained corpse memory 9,551,520 bytes / 64 MiB cap (higher precision costs 50% more per target); no claim of FPS improvement from corrected timer attribution. Report .local/corpse-profile-r319.json. User visual QA pending; no previews or remote publication.

Local R238C320: reproduced Orc disappearance in a full browser draw using the imported Orc Warrior. Pending-death corpseSnowAmount compared undefined cache.started with undefined deathPresentationStartedAt, then dereferenced cached.asset. The caught exception aborted the body draw until the death beat supplied a timestamp. Require an actual cached body and finite death timestamp before reading snow. Regression includes missing entity, living, pending death and uncached falling states. Browser transition probe retained as scripts/probe-orc-death-transition.cjs; visual QA stays with user.

Local R238C321: snow first/powder colors have 65% less authored blue bias at similar luminance. Per user follow-up, original cool undertone returns gradually with third-layer depth on terrain and corpses. HDR inverse-ACES conversion now compresses negative out-of-gamut channels toward neutral instead of clipping them independently; preserves HDR brightness and avoids amplified cyan. Color tests cover HDR/fallback and layer tint boundaries. Visual QA remains with user.


### Local R238C322 � display submission optimization (2026-11-12)
CPU sampling identified repeated Canvas clip construction and exhaustive indoor-space queries as major recurring costs. clipExplorationFloor now retains one Path2D keyed by spaces identity/length and the exact camera projection. Architectural space queries retain up to 8,192 exact point results, including misses; encounter geometry replacement or length changes discard them. The terrain/session owners replace architecturalSpaces rather than editing its polygons in place. Future in-place geometry editors must explicitly clear architecturalSpaceAtWorldPoint.cache and clipExplorationFloor.cache (or replace the spaces array). Original polygon predicate and reverse overlap priority remain authoritative. Canvas adapter method wrappers are also retained rather than allocated on every method access; flush/backdrop semantics are unchanged.

Seeded Chrome 1600x1000, same terrain/camera/12 models plus player, 100 measured frames after 35 warmup frames: living submission 14.288 -> 8.719 ms (39.0% lower); corpse submission 13.926 -> 8.480 ms (39.1% lower). Terrain CPU 5.075 -> 2.489 ms. Floor triangles remained 2,628 and corpse-scene composite draws remained 39. Retained corpse targets remain 9,551,520 bytes, with 12 cache hits/frame. Both builds remained at the existing 30 FPS cap. This is scene-specific CPU headroom, not a universal FPS claim. Baseline/after reports: .local/display-r322-baseline.json and .local/display-r322-after.json.

Validation: 81/81 combat/Workshop regressions passed. Browser checks retained correct invalidation for three snow layers, melt/clear, light, rotation and zoom. 24 pixel-exact clipping comparisons (grass/wall, six rotations, two camera positions) matched the original immediate Canvas path; live frames had no rendering errors. New scripts/profile-combat-display.cjs uses deterministic seed 322 and accepts optional CPU_PROFILE output; scripts/probe-combat-display-clipping.cjs performs the pixel checks. Same PLAYWRIGHT_MODULE / BROWSER_EXECUTABLE environment conventions as the corpse profiler. No visual previews or remote publication; user visual QA pending.

Local R238C323 (2026-11-12): corpse snow no longer increments directly from elapsed snowfall (earnedSnow). Ground coat coverage maintains incremental sums of the exact shader blend for first/powder layers and normalized depth, updated only at touched texels; recount/configure/clear/melt preserve those sums. Successful particle batches advance corpses by actual ground progress, so queue backlogs, granularity and strict layer gates affect both. No full texture scan per frame or GPU readback added. A bounded deposition clock retains measured progress per deposited grain so newly fallen bodies still coat after the ground reaches its three-layer cap. New bodies start bare; indoors, pause and local melt/clear retain their existing controls. Corpse first-layer opacity now matches ground (.62); full-coverage shader shortcut requires 1.0 instead of .995. New tests verify progress against independently sampled ground texels, synchronized layer transitions, saturation/new corpses, pause, indoors, melt and reset. 82/82 combat regressions passed; visual QA remains with user.


Local R238C324 (2026-11-12): user supersedes third-layer-only displacement. Snow now reaches cumulative 3 / 6 / 9 inches (0.0762 / 0.1524 / 0.2286 m). Shared combat-snow-depth.mjs converts the actual ground coat channels into physical height. Ground uses the established vertical world scale; corpse material uniforms convert metres into its model/camera units, with the same per-layer height. Existing strict layer timing remains.

Replaced the old rise-triggered enlarged oval markers and grey shading with sampled animated foot contacts and short swept capsule depressions. Sole clearance is compared with local deposited snow height; lifted feet stop carving, contacts connect only within the same continuous motion, and clock resets/teleports cannot draw long rails. Tracks use world coordinates, actual physical ground scales, spatially indexed receiver cells, bounded 4,096 records, retained GPU attribute capacity and one shared height-cut texture. MAX blending prevents repeated/overlapping contacts digging below the deepest sole. Dead/indoors/bare-ground cases do not add tracks. New snowfall refills cuts from the shared deposition clock, and local melt/clear remain supported. Cleared/refilled records are pruned.

Ground vertex height subtracts the cut texture; fragment normals sample the carved height field and groove shading uses a cool blue tint instead of greyscale. Floor subdivision begins with first-layer snow; only hexes containing active tracks refine to 16 subdivisions (else 4 for snowy floor, 1 when bare). Geometry/gameplay collision remains unchanged. No new frame loop or image readback in production. Track texture matches snow-map resolution.

Validation: 82/82 combat/Workshop tests passed including 3/6/9-inch conversion, new contact/drag/lift/reset/duplicate/melt/refill cases and adaptive geometry. Numeric browser shader/cache probe passed all snow stages, lighting, rotation and zoom with no errors; bare-scene frame submission remained about 7.1 ms in the seeded living-unit sample. Dedicated GPU probe filled real ground snow, generated swept tracks and verified full-depth snow versus a cut pixel ([255,0,255,255]), then verified snowfall refill. Imported Orc Warrior walking rig produced finite swept tracks from both actual foot bones (101 contact segments in the isolated 60-sample check). scripts/probe-combat-snow-trails.cjs is the reproducible GPU check. Heavy-snow/trail visual and gameplay-scale QA remains with user; no previews or remote publication.

Local R238C325: carried item lights now expose a visualPosition from the same from/to/t walk interpolation as the holder. explorationRenderLights consumes it for GPU floor/wall lighting, light masks, tree/model lights and projected light shadows; illuminationSources keeps its original occupied-hex coordinates for tactical illumination/LOS. drawDirectCombatUnit also computes the holder's physical light origin from its moving position, avoiding a relative offset against its own light. Equipped/lit rules, flicker and sway remain unchanged. Regression covers interpolation endpoints/intermediates and stationary arrival; browser checked 15 rendered movement positions across three camera rotations with no errors. scripts/probe-combat-moving-light.cjs retains the integration check. Local only; user visual QA pending.

Local R238C326: unit anchors were already at hex base height; painter-order model compositing made feet appear on top of raised snow. Added shared material snow occlusion for all living direct MOBs (prepared static and Workshop/skinned geometry): post-skinning model world height is compared against the existing physical snow depth minus trail cuts. Ground coordinates use the same capture-camera/view inverse as foot contacts, so gait, camera rotation, pan and model scale remain aligned. Submerged fragments are discarded to expose the already-rendered snow; no new pass, marker, model lift, collision or gameplay elevation change. Indoor/no-snow/dead paths disable this mask; corpse accumulation remains separately handled. Sprite-only GPU MOBs use their existing ground anchor to estimate height and apply the same depth/cut mask. Moving sprite origins follow walk interpolation.
Validation: browser shader/corpse cache probe had no errors and about 7.0 ms living-unit submission in the seeded bare test scene. Dedicated real-GPU probe tested both static and skinned legs: visible pixels fell 216 -> 184 -> 152 -> 120 at bare/3/6/9 inches; fully carved tracks restored 216. Lifted feet and disabled/indoor path passed. Matrix tests cover six rotations and three model sizes. scripts/probe-combat-snow-burial.cjs retains the GPU check. User visual QA pending; no previews or remote publication.

Local R238C327: added FULL SNOW ACCUMULATION (fills all three outdoor ground channels and existing registered corpses to 9 inches, clears old track cuts, works paused, leaves snowfall intensity unchanged). CPU coverage, GPU accumulation target and per-hex/blood state are updated together; new tracks and melting remain functional. Full accumulation primes deposition-rate accounting so subsequent corpses can still receive snow. Follow-up shared-scheduler redraw makes full/clear immediately visible even while paused. Added HIDE/SHOW PERFORMANCE STATS toggle covering CPU/GPU charts and FPS readout. Removed the unit AA slider/label and Break Window button/listener; default antialiasing and gameplay window-breaking behavior remain intact.
Validation: 83/83 combat regressions passed; additional fill/clear/indoor-corpse timing checks passed. Actual browser controls test verified removed controls, hide/show, paused full accumulation, unchanged snowfall intensity, and corpse/ground clearing. GPU full-fill probe verified 9-inch depth, trail carving and refill. scripts/probe-combat-controls.cjs retains the UI regression. Local only; user visual QA pending.


## Animated snow contacts and fir shelter � R238C328 (local)

Foot contacts now sample the shared 30 FPS presentation clock for turning and all rendered animations, rather than requiring walkSeconds. Actual foot bones sweep short contact segments and intermediate boot angles; stationary redraws and raised soles do not stamp. Baked standing meshes recover cached sole contacts once from their lowest geometry band. Existing MAX cuts, blue groove shading, snowfall refill, teleport limits and bounded record storage remain.

Ground snow burial now also applies to dying and settled direct models: their base anchor stays at ground level while surrounding snow hides submerged surfaces. Their exposed top retains the three-layer snow shell. Retained corpse images include the ground/trail/shelter revision so filling, melting or nearby tracks cannot leave stale burial pixels; bare-ground image reuse remains intact.

Fir placement builds a static 1024-square single-channel shelter texture: zero snow in the inner 12% of the litter radius, smooth growth to full exposure at the outer radius, with overlapping shelter taking the minimum. Ground opacity and physical depth use this field, as do CPU foot contact depth and model burial. It does not modify gameplay coordinates or add a rendering pass/animation loop. Deposited coat completion remains global; sheltered ground deliberately stays thinner even at Full Snow.

Validation: 84/84 combat/Workshop regressions; GPU static/skinned 3/6/9-inch burial and trail reopening; fir-trunk GPU exposure; integrated corpse image cache/light/view/snow checks. User retains visual QA; local changes only, no preview delivery or remote publication.

R238C329: Corrected fir snow shelter to the battlefield ground metric (HEX_ROW / (HEX_W * sqrt(3)/2)), preserving a circular ground footprint through view rotations. Radius now follows each tree model canopy bounds and rendered tree scale. Retain all-map decoration metadata; invalidate the static shelter field when model radii become available. Targeted shelter tests and integrated GPU display/cache checks pass with no rendering errors. Local visual QA remains with user.

R238C330: Corpse burial now tests original baked body height, not the snow-displaced shell. Previously, raising the shell before testing ground depth re-exposed submerged surfaces. The animated/live burial path is unchanged; corpse top snow keeps its accumulation and displacement. Enabled existing sprite burial fallback for dead units too. GPU regression explicitly checks a shallow fully snow-coated corpse remains submerged; integrated display/cache checks report zero errors.

R238C331: Settled corpses now bake their actual final-pose mesh triangles into a persistent full-depth cut in the shared snow footprint texture. The top-down world silhouette (limbs/equipment and gaps, not an oval) subtracts the maximum nine-inch depth, clamping ground height to zero beneath the body. These occupied cuts are separate from foot records, survive snowfall/refill/full-snow/clear, and reset on scene replacement or revival. Exposed corpse snow accumulation remains unchanged. Bakes happen once per settled body, retained geometry updates only on membership changes; affected hexes use existing local snow refinement. GPU silhouette/full-depth/refill/revival checks passed; integrated renderer/cache checks reported zero errors, and 84/84 combat regressions passed. Local only; user visual QA.

R238C332 depth trial: user requested cumulative 6/12/18 inches, replacing 3/6/9. Shared SNOW_LAYER_METRES is now 6*.0254; terrain, corpse coating, foot cuts and occupied corpse depressions inherit the same 18-inch maximum. Accumulation timing/layer gates unchanged. Targeted foot/surface tests and GPU burial/depression checks passed. Local visual QA trial.

R238C333: Added modest pushed-snow banks around the union of foot trails and corpse depressions. A cached edge pass updates only when the cut field changes; red retains the exact cut and green stores its outside rim. Overlapping impressions have no internal ridge. Shared snowDeformedHeight applies up to 16% of local displaced snow depth (2.88 inches at full 18-inch snow), suppresses banks inside cuts and on bare ground, and drives terrain relief/normals and body burial consistently. Foot banks fade with refill; corpse cuts/banks remain occupied. GPU checks verify outside rims, no rim inside full cuts, and preserved corpse silhouettes/refill blocking. Integrated game checks report zero errors and retained corpse cache hits. User performs visual QA; local only.

R238C334: Corrected shared model snow burial in two places. Workshop capture cameras must update matrixWorld before scale conversion, contact projection and ground mapping; their live paths previously used stale matrices while corpse capture refreshed them. Burial now also samples the foreground terrain along the viewing ray (bounded eight samples below maximum snow height), so occupants of zero-depth cuts no longer draw over the near snow wall. No global downward body offset. Same deformed ground/cut/rim/shelter field is used. Actual published Wood Elf and Orc models, alive and fallen, now have regression GPU coverage with authored display sizes and anchors. 84/84 regressions, isolated GPU burial and eight integrated render/cache checks pass; no integrated rendering errors. Local only; visual QA remains with user.

R238C335: Replaced procedural corpse snow coverage with a separate retained 64x64 RGB particle-deposit map over each final-pose top silhouette. Reuses createSnowCoatCoverage and its exact grain brushes, full-first/full-second gates, material ramps and physical depth function. Each map advances to the existing ground-synchronized deposition progress; full fill/melt/clear and idle image caching remain supported. Height is added above the body's exposed top vertices; the ground depression stays independent and occupied. Per-corpse maps dispose on reset/revival. Added foot-contact kickup particles for movement/pivots through snow, capped at 256 with ballistic motion/short lifetime, using the existing snow draw and shared scheduler. Kickup remains visible when falling flakes are hidden. 85/85 regressions passed, GPU corpse burial shader check passed, and integrated display/cache checks report zero errors and retained corpse cache hits. Local visual QA only.

R238C336: Integrated qubodup's four CC0 dry snow footsteps. Original FLACs/author note retained; normalized, trimmed mono PCM WAVs with exact processing/hash metadata in assets/audio/sfx/snow/SOURCE.json; credit added to ATTRIBUTIONS.md. Animated foot sampler rearms only after a sole lifts, triggers when it plants, and suppresses idle/duplicate/bare/indoor contacts. Local snow depth scales gain via .65*sqrt(depth/maxDepth). Existing mixer/mute/session controls, max eight simultaneous voices, no late decode playback or cadence timer. 86/86 regressions and eight integrated rendering checks passed with no errors.

R238C337: Elven bow AI now seeks its weapon's medium band, retreats from visible short-range melee pressure, and advances from long range. Shared friendly/hostile policy uses bounded legal-hex search, firing visibility, hazard avoidance, and opportunity-attack checks on every edge and again at execution. Adjacent eligible melee threats cause a stationary melee response/guard; unsafe legacy firing-lane fallback is suppressed for Elven archers. Existing taunt/flee priorities remain. Repositioning charges actual steps and ends the action beyond half movement. Added tactical regressions for medium hold, retreat/approach, engagement, blocked paths, move budget, other races and ammo. Existing 86/86 regressions plus the new tactics test passed. Snow-step gain reduced from .65 to .325 (50% reduction), retaining depth scaling.

R238C338: Fixed corpse snow appearing prematurely opaque: removed duplicate albedo/final-light blends and perform the coat blend in the same display color space as terrain, then inverse-encode for the retained model target's later ACES composite. First coat is exactly .62 snow/.38 original at completion; powder waits for a fully rendered first coat. Corpse maps use nearest grain samples to avoid cross-layer interpolation at boundaries. Actual grain-deposition progression comparison verifies ground/corpse timing and strict gates. Blood splatters and pools become opaque red on snowy ground with no white wash, cached per stamp; bare-ground alpha unchanged. GPU measured first-coat RGB 123/123/126 vs expected 122.6/122.5/125.8, powder 230/234/237. 87/87 regressions and integrated rendering checks pass. User visual QA, local only.

R238C339 (2026-11-12): Replaced Full Snow with side-by-side minus/plus one-inch controls, clamped to 0–36 inches, including existing corpses. Natural accumulation retains the 6/12/18-inch coat stages; texture alpha holds additional manual test depth. Foot contacts and burial consume the extended depth. Snow footstep gain halved to .1625 with the original 18-inch audio normalization retained. Snow blood is opaque bright red (220,20,30). Validation: 88/88 combat regressions; browser controls and GPU static/skinned burial probes passed. Visual QA remains with user. Changes local only.

R238C340 (2026-11-12): Contextual tactical grid appears during aiming or battlefield hover on the controlled unit's idle turn. Green reachable destinations share a bounded full-footprint BFS with click movement. Clicking follows the whole route, preserving costs, opportunity attacks, guards, and area-spell checkpoints. Shared player/AI presentation rounds intermediate corners and sweeps body clearance against blocked hexes, units, firs, and movement wall segments; narrow corridors and rotating large footprints retain conservative turns. Reactive AI providers carry small validated off-center offsets. Existing walkPresentation drives sprites, lighting, shadows, and snow contacts together. No new frame loop. Validation: 89/89 regression tests and live three-hex destination/contextual-grid probe. User performs visual QA; local only. Snow controls remain +/-3 inches, maximum 36 inches.

R238C341 (2026-11-12): Fixed snow deforming baked corpse body/equipment vertices. Body stays fixed; powder/depth uses an independent closed top-surface snow mesh, registered with existing resource cleanup and burial binding. Thin translucent coat remains on the body. Ground snow uses matching eight-way subdivisions instead of 4/16 neighbours, eliminating displaced T-junctions; terrain and body burial share a one-texel physical-height bevel across melt masks. Coat coverage thresholds unchanged. Validation: 89/89 combat regressions, GPU static/skinned burial and independent cap test, first-coat/powder opacity probe, production 12-corpse display/cache probe with all eight invalidation checks and no browser errors. User handles visual QA. Local only.

R238C343 local follow-up after candidate publication c7d527d / PR 388: removed ground blood stain and death-pool generation/rendering, including old encounter residue/cache cleanup. Airborne hit and fourfold staggered death bursts retain their timing, wall clipping and visibility behavior. Drops disappear on landing and no pool prolongs the effects loop. This follow-up has not been pushed.

R238C344 local: Corpse snow now has four independent half-inch grain layers (RGBA), each fully covering the eligible top surface before the next starts. Each covered layer adds 25% alpha and 0.0127 metres to the independent cap; the original corpse geometry and shading remain fixed. Natural accumulation takes 30 seconds of active snowfall per layer (120 seconds total), independent of ground mass/intensity, pausing when snowfall stops or is paused. Hard cap four layers/two inches, including manual snow controls; melt and clear supported. Retained map changes run at existing deposition cadence and no new loop is added. Validation: 89/89 regressions, GPU alpha 64/127/191/255, deep burial, manual controls, eight production display/cache checks and no browser errors. Local only; pending alongside blood-particles-only follow-up.

R238C346 local: Corpse snow now uses the same soft 5/7-texel grain brushes and .015/.34 blend ramp as terrain, with linear filtering and four independently gated channels. Retains half-inch stages, 25% opacity increments, 120 active seconds and two-inch cap. Corrected perceived opacity by blending snow and corpse in display space and skipping repeat tone mapping in the retained composite. A nearest-cap depth pass prevents alpha stacking from closed/overlapping cap faces. Corpse snow receives actual point-light diffuse illumination (sword, fire, torches) on top of ambient/sun baseline; CPU baseline excludes duplicate local lights. Snowfall slider now emits 0–3500 flakes/sec, five times the prior maximum, with 20480 bounded flake slots plus 256 kick-up slots; ground/corpse accumulation rates unchanged. Validation: 90/90 regressions; production-path GPU body blending at 25/50/75% and full opacity, local warm light response, burial, and all eight display/cache checks without errors. No preview generated; local only.

R238C347 local: Broader collision-checked movement curves bypass intermediate hex centers. Walking uses an arc-length lookup for even physical speed and duration proportional to route length. Per-frame heading follows the curve tangent with a bounded shortest-angle turn, shared with direct models/shadows/feet; logical six-way facing and per-hex costs/reactions remain authoritative. Final visual heading persists into idle, avoiding an end-of-route snap. Player and AI use the same presentation helper; rotating large footprints retain conservative route geometry. Validation: existing 90 regressions plus new curved-heading/model-yaw/speed test, and live three-hex destination probe all pass. Local only.


R238C348 local: Fireball cells retain heat for three combat rounds; burning firs refresh heat in their own and six neighboring hexes. Heat clears all four snow channels after deposition, including manual deep snow. Pale steam shares the existing smoke shader and FX scheduler, respects visibility, and fades without melting snow. Quick-controlled archers now use the shared Elf range policy. Validation: 92/92 combat regressions, actual 36-inch GPU melt (RGBA 255 to 0), friendly Workshop archer equipment/range-plan check. Track investigation found the existing 4,096-stamp FIFO cap; no track storage change. Not published.

R238C349 local experiment: corpse whitening now follows the local hex first-coat material coverage minus 25 percentage points, clamped to 0-75%. Supersedes the independent two-minute corpse clock during gameplay. Uses retained soft coat maps and display-space lighting; averages real ground texels per occupied corpse hex, cached by surface revision. Local melt/clear and manual snow adjustments update bodies too.

R238C350 local: Tactical hex grid and hover outlines now filter by reachable remaining movement or the active missile/spell range. Canvas CSS uses smooth scaling instead of pixelated scaling, retaining native antialiased strokes. Mouse wheel zooms combat; Shift-wheel retains Wall of Fog orientation. Updated aim prompts. Validation: 94/94 regressions and live Chrome wheel zoom/smooth-style check passed. Not published.

R238C351/352 local: Fireball melts adjacent snow with per-texel distance falloff through all four depth channels; steam color is pure white. Fixed R350 active-highlight regression: grid range predicate had incorrectly referenced undefined x/y inside drawActiveHex, aborting frames after Space. Restored contextual visibility gate. Added active-highlight regression and live Space-start grid probe.

R238C353/354 local: Elf bow AI ranks legal targets by evaluated d20 hit chance (same AC, Dexterity, range and effect inputs as bow attacks), then proximity, HP and stable ID. Shared by friendly/hostile/Quick AI; hostile volleys reevaluate per arrow. Warm ground no longer erases deposition in the same frame: continuous heat permits brief settling, with 350ms grain phase then 850ms pure-white puff. Bounded 512 grain/puff slots share the existing snow point pass and frame scheduler. Validation: 96/96 regressions; live hot-snow probe confirmed grains and steam calls with no shader errors. No publication.

R238C355 local correction: separate body albedo whitening from settled snow. Snow cap follows local coverage through all four coats to 100% opacity; underlying body material whitens by settled coverage minus 25 percentage points, capped at 75%, under normal lighting. GPU probe verifies full alpha 255 and independently whitening body, with local light response intact. Threshold regression passed.

R238C356 local regression fix: newly fallen corpses again accumulate over 120 snowfall-active seconds, not inherited full ground coverage. Body whitening remains independently 25 points behind its own settled snow, maximum 75%; cap can reach 100%. Hot deposits use bounded temporary grain/puff presentation and never rebuild persistent coverage; disable global missing-texel redirection while heat exists to prevent concentration into melted holes. Validated 96/96 regressions, active snowfall/melt/fresh corpse browser probe, and 36-inch GPU melt plus feather readback (all RGBA channels zero).

R238C357 focused audit complete. Removed abandoned corpse sync and unused coverage reader; replaced stale tests with active timed lifecycle regression; restored original newlines; added browser regression runner. 96/96 unit checks and six real-browser checks passed. Scope and remaining maintenance risks recorded in COMBAT_ARCHITECTURE.md. Local only.

R238C358 targeted cleanup complete: shared read-only bow roll inputs, event/round-driven heat updates and separate steam ticking, equivalent squared-distance gradient optimization. 96/96 unit regressions, 6/6 browser checks, reference gradient equivalence and heat event tests passed. 2048 texture CPU gradient median 628.9ms -> 171.6ms, GPU upload not included. Local only.

R238C359 local: one-time snow impact burst when a fallen body's final ground silhouette is registered. Samples local snow depth across the body, scales count/spread/lift with depth, emits nothing on dry ground. Shares existing 256-particle kickup pool and scheduler; cached draws/rebuilt corpse meshes do not repeat the burst. 97/97 regressions passed plus actual contact-hook repeat suppression checks. No publication.

## Local R238C360 — meadow ground cover (2026-11-12)

User authorized replacing the rejected sparse scatter with a substantially richer local combat pass. `combat-ground-cover.mjs` owns deterministic clustered curved blades, irregular embedded stone groups and tapered branching sticks. These are original procedural meshes/materials; no external assets were imported. Root positions survive floor fragmentation, movement and camera rotation. Sparse tree-base grass and preferential woodland branches use the existing canopy field. Two grass geometry levels reduce triangles when zoomed out; shader edge coverage softens thin silhouettes. Broad ground-color variation complements the geometry.

The renderer collects eligible outdoor grass fragments while drawing floors, then submits ordered instance intervals between existing actor draws. This preserves the hybrid painter pipeline instead of pretending unit images share a terrain depth buffer. It is root-order occlusion, not per-pixel 3D depth; tall vegetation and complex wall crossings remain a future depth-integration concern. Plants use ground exposure textures (including local light in the default CPU lighting path), shared physical snow height, canopy shelter, and track cuts. Snow buries cover without raising its roots. Up to 32 visible unit/corpse contacts bend/flatten nearby grass; no gameplay collision or persistent grass-track state was added.

Wind runs on the existing combat scheduler, stops outside active combat, and respects reduced-motion preference. GPU instance textures and geometry are reused, placement caches are bounded and cleared at scene changes, and resources are disposed with the renderer. CPU/GPU charts now expose Ground cover. `adventurePartyGroundCover=false` is a developer A/B switch; no new player controls. Keep local for user visual QA; no push/deployment.

Validation: 98/98 combat checks; six existing browser regression checks; new `probe-combat-ground-cover.cjs` verifies actual GPU pixels for dry grass, reduced light, progressive burial, complete 36-inch burial, track re-exposure, ordered draw intervals and lower zoom geometry. `test-combat-ground-cover.mjs` checks stable split-fragment placement, bounded density, all three classes and indoor exclusions. User visual approval remains pending.

R238C360 measured follow-up: same seeded 1600x1000 Chrome battle, 15 warmup + 60 sampled frames per mode, cover disabled/enabled in one session: median CPU submission 5.4 / 6.9 ms, p95 6.1 / 7.6 ms. Enabled scene: 2,059 cover instances, 243,360 submitted cover triangles, 85 cover draws (total draws 128 -> 213). This is a measured cost, not a speedup or universal performance guarantee. The GPU chart reports cover separately; its rolling history spanned both A/B modes, so that snapshot is not an isolated enabled-only GPU benchmark. All six rotations at three zooms (18 cases) rendered without exceptions. Existing CRLF line endings preserved; diff check passes with cr-at-eol.

## Local R238C366 — Poly Haven grass trial (2026-11-12)

Grass now uses Poly Haven Grass Medium 01 by Rico Cilliers (modeling) and Rob Tuytel (photography), CC0: https://polyhaven.com/a/grass_medium_01 . Local geometry, unchanged 1K diffuse/alpha/OpenGL normal textures, original download metadata and SHA-256 hashes are in `assets/models/ground-cover/polyhaven-grass-medium-01/source.json`. Source downloads were verified against the API's MD5 values. Selected `grass_medium_01_small_a_LOD0`, rooted and normalized uniformly to 0.72m before the existing half-size instance setting. High detail retains all 833 source triangles; low detail retains 15 of 30 connected blade/card components (430 triangles), without changing their original UVs. Showcase layout/node offsets are omitted. Current triple tuft placement density is preserved; authored plant blades replace the procedural 56-blade template. Stones and sticks remain unchanged.

`createGroundCover.ready` exposes asynchronous asset readiness; diagnostics report loading/polyhaven/fallback. Failed loads keep the prior procedural geometry and log the failure. Disposal during loading disposes completed resources; textures/meshes are renderer-owned. Cutout alpha uses derivative-smoothed coverage rather than treating the source diffuse JPEG as opaque. Original UV orientation is retained with flipY=false. Diffuse, normal detail, root shading, local ground exposure, wind, actor bending, snow burial and trail cuts share the existing shader pipeline. No remote runtime requests; all assets are vendored locally.

Validation: 98/98 combat regression checks; real GPU probe explicitly awaits Poly Haven readiness and verifies visible pixels, lower exposure, shallow/deep snow, trail cuts, interval ordering and lower-detail geometry. Seeded 1600x1000 Chrome battle: 5,899 ground-cover instances; 85 cover draws, 4,826,400 submitted triangles including debris; median total CPU submission 7.7 ms, p95 9.0 ms; sampled Ground cover GPU time about 2.93 ms. These are scene/device-specific measurements, not directly comparable to earlier lower-density passes. Local user visual QA pending; no publication.

## Local R238C369 — authored dense grass clumps (2026-11-12)

Supersedes the sparse small-mesh trial. Inspection of the original Blender scene and a standard-material comparison identified large_a/large_c as the requested bushy clumps. Runtime now uses complete large_a authored LOD1 (2,301 triangles) and LOD2 (1,011 triangles), original UVs/normals, uniform normalization and the existing half-size setting. No blade removal or vertical compression. Low LOD is used below zoom 1.5. The source manifest records Blender provenance, transformations and hashes.

Imported plant elevation now respects the ground projection's metre scale and camera squash; snow burial uses the same converted elevation. Alpha cutout rejects near-black texels before bounded derivative smoothing, preventing dark atlas-background fringes. Added the author's roughness texture and an approximate leaf-transmission contribution. This remains the game's custom lighting shader, not a full reproduction of Blender's material. Placement density, stones, sticks and gameplay remain unchanged.

Validation: 98/98 combat regressions, deterministic placement test and GPU coverage/light/snow/LOD probe passed. Internal actual-game inspection confirms leafy clumps replace sparse twig silhouettes; user visual QA remains authoritative. Seeded 1600x1000 Chrome sample: 5,899 cover instances, 85 cover draws, 5,851,680 cover triangles, median CPU submission 8.6 ms / p95 10.2 ms; Ground cover GPU approximately 3.37 ms. Higher geometry cost than the sparse trial; scene/device-specific measurements. Local only, no push.

## Local R238C370 — revert rejected Poly Haven grass trial

User rejected the visual result. Restored the exact pre-Poly-Haven procedural ground-cover renderer, retaining the latest half-size grass, triple tufts, stones, sticks, lighting, snow and ordering behavior. Removed imported-material/mesh runtime loading and restored the GPU probe to procedural LOD checks. Cache chain advanced to R238C370. Downloaded source assets and provenance remain unused for historical reference. No other game changes reverted; no push.

## Local R238C371 — tutorial-inspired procedural grass

Applied the blade-shaping and foliage-lighting principles from the user's Timothy Dries tutorial to the restored procedural grass. Neighboring tufts now use independent deterministic seeds; blades retain tapered widths with varied twist and curled tips. Root shading is gentler, a subtle central fold is shaded analytically, and leaf lighting includes both-face diffuse response plus transmission. No texture atlas is used, so texture dilation/baking instructions do not apply. Poly Haven runtime remains reverted. Existing size settings, placement counts, blade/triangle budgets, debris, snow and gameplay are preserved.

Validation: deterministic placement test and real GPU probe passed (local exposure, shallow/deep burial, trail re-exposure, ordered intervals, zoom LOD). Fixture high/low triangle totals remain 53,232 / 16,752. Diff whitespace check passed. User visual QA pending; local only.

## Local grass/scatter tuning lab (2026-11-13)

Added grass-scatter-test.html and js/grass-scatter-lab.mjs, using createGroundCover directly with optional per-instance tuning. Sliders: blade height/width/bend, clump spread, tuft count, wind, brightness, dry color, light and zoom; toggles: rocks/sticks/wind animation. Reset and versioned JSON export allow user-selected settings to be sent back. Game defaults unchanged; no global tuning persistence. Ground backdrop is a plain swatch, not the full battlefield floor/actor pipeline. Geometry is rebuilt after debounced changes and disposed; page skips hidden-tab rendering. Existing triangle/instance counters shown.

Validation: browser smoke tested slider edits, reset, JSON download and absence of page errors. Default placement and GPU light/snow/LOD probes passed. Local only.

## Local R238C372 — lab scale reference, capacity and measurements (2026-11-13)

Removed the sorted 8,192-instance truncation that erased lower rows. Instance textures now pack 128 instances per row and grow geometrically when needed; shader texel addressing matches the packed layout. Growth disposes the previous GPU allocation and forces upload. Dense browser case rendered 68,692 instances / 8,837,152 scatter triangles; default GPU light/snow/LOD probe passed. High density still increases work and memory.

Lab now includes the published Orc Warrior GLB normalized to its authored 1.8288 m height, at patch center, with a visibility toggle. It is a static model scale reference (bind pose), not a full combat actor/equipment/animation simulation. Ground uses actual grass-short-v1 color/normal textures, matching three-metre repeat, squash, zoom and light level.

Added rolling FPS, CPU submission milliseconds and asynchronous EXT_disjoint_timer_query_webgl2 GPU timing, with unsupported/warmup reporting and disjoint query invalidation. No GPU waits; at most four outstanding queries. Total triangle/draw counters include ground and Orc; CPU timing covers lab submission only, not system CPU utilization. Pausing wind suspends continuous drawing and labels the panel paused. Browser verified controls/reset/export without errors; sample timer readings populated. Local only, no push.

## Local R238C373 — selected grass preset and efficiency pass (2026-11-13)

Applied user screenshot settings through shared GROUND_COVER_DEFAULTS: height 2.15, width 2.7, spread .95, bend 1.6, two tufts/cell, wind 1.5, brightness 1.2, dry mix .8. Stones/sticks stay enabled. Lab reset shares these defaults; screenshot zoom/light remain preview controls, not combat camera/solar overrides.

Efficiency: omit the collapsed second triangle at each blade tip (no covered area); reuse instance arrays and cached placement objects; cache canopy exposure with snowShelterRevision invalidation; replace per-frame joined identity strings and temporary upload arrays with packed numeric comparisons; compute reduced-motion time once and avoid mover slices. GPU upload occurs only when records change. Preserve painter intervals, scene-cache invalidation, live visibility, snow burial and growable capacity.

Seeded 1600x1000 battle before/after optimization, same selected preset: 3,980 instances / 85 cover draws both; cover triangles 1,749,088 -> 1,533,992 (12.3% fewer). Median total CPU submission 9.5 -> 8.5 ms; p95 11.0 -> 11.3 ms. GPU cover sample 1.81 -> 2.15 ms, so this run does not establish a GPU-time improvement; retain the concrete geometry/allocation reduction without claiming universal FPS gains. User machine and scene determine actual cost.

Validation: 98/98 combat regressions, deterministic placement, GPU exposure/snow burial/re-exposure/ordering/LOD probe, lab reset/export/browser checks, and whitespace check. Local only; user visual QA pending.

R238C374: user changed shared grass blade-height multiplier from 2.15 to 0.5. All other selected settings unchanged; game and lab cache versions advanced.

R238C375: shared grass blade-height multiplier changed to 0.75 at user request. Other settings unchanged; game and lab cache versions advanced.

R238C376: corpse snowfall clock now scales linearly with the 0–1 snowfall slider. Full four-layer/two-inch coverage takes 120 seconds at 100%, 240 at 50%, 480 at 25%; zero stops accumulation. Pause/hidden-tab guards and one-second elapsed cap preserved. Timing and corpse exposure/melt/reset tests passed. Corpse draw ordering unchanged.

Local grass lab wear experiment: added patch coverage, size, softness, wear amount and soil bump sliders. A cached 512-square world-space mask drives dirt-path-v1 blending and optional placement-time grassCoverage filtering; game defaults do not supply that hook. Bilinear CPU sampling matches GPU mask sampling. Texture-derived soil microrelief is shading only, not authored displacement. Mask rebuild is debounced with control changes; no per-frame mask generation. Existing JSON export/reset includes controls. Browser tested shader compilation, thinning (2353 -> 531 instances in test), reset and download; placement test passed. Combat terrain unchanged.

Grass lab: soil bump strength now ranges from -3 to +3. Negative values invert texture-derived relief shading; no geometric displacement. Default stays +1.

## Local R238C377 — battlefield worn grass patches

Applied user-approved coverage .25, size 3.4m, softness .4, wear 1 and bump -1.8. combat-ground-wear.mjs bakes a 1024-square, 128m world-space wear mask once per renderer; bilinear CPU sampling removes grass with the same field used by the ground shader. Terrain scale/squash comes from each grass face. Soil uses existing dirt-path-v1 color and signed luminance-derived microrelief, blended before snow/scorch/lighting. No geometric depression. Mask uses clamped bounds outside its 128m region; larger exploration maps will need tiled/chunked masks. Lab defaults updated; its existing mask sampling resolution/bounds differ from battlefield, so exact patch edges may differ slightly.

No additional terrain draw pass. Soil detail adds texture samples; reduced tuft count offsets some workload. Seeded game sample: 3330 cover instances, 85 cover draws, 1,279,192 triangles; median total CPU submission 7.5ms, p95 8.2ms, floor GPU .15ms and ground cover GPU 1.50ms (device/scene-specific). Actual game loaded and rendered without page errors. Assets remain local; user visual QA pending.

## Local R238C378 — retained arrows, corpse stacking, muted bow leather

Ground impacts now submit a reusable arrow artwork quad through the ground-surface GPU pipeline at bare-ground height. Per-fragment snow height (including canopy and footprint cuts) clips submerged arrow pixels; arrows no longer float over the snowy floor. Wall and flying arrows retain existing paths. Surface ordering applies on ordinary battlefields as well as exploration.

Overlapping settled corpses constrain later deathPresentationStartedAt units above them during falling and after settling, while preserving existing wall constraints and nonoverlapping painter order. Added regression for both death phases; living crossing tests remain green.

Composite longbow and automatic/explicit quiver attachment paths apply an isolated reddish-pixel material treatment toward muted brown. Original GLBs/textures/checksums unchanged; neutral metal/string/feather pixels remain unaffected. Treatment is idempotent and preserves prior shader hooks.

Validation: 98/98 combat regressions, equipment suite, expanded corpse crossing and lodged-arrow tests; actual game ground-arrow GPU shader smoke with bare/full snow; isolated material hook test. User visual QA pending. Local only.

## Local R238C379 — noon sky calibration and matte units

User confirmed direction: adjust battlefield toward grass/scatter tester. Removed weatherSolarState's extra 35% daytime sky multiplier; clear noon now has sky=1, matching the tester's unit light level. Retained weather attenuation, solar direction/daylight and night sky. This calibrates ambient sky, not an exact pixel match: battlefield shadows, local lights and terrain shading remain active.

Combat direct/prepared model materials now use roughness >= .92 and metalness <= .1. Shader limits run after texture modulation so roughness/metalness maps cannot restore glossy metallic highlights. Covers captured and restored geometry, living units and corpses; local light intensity/color and emissive effects retained. Versioned shared direct-model imports and fixture imports stay aligned to avoid split frame registries.

Validation: 99/99 combat regression checks; explicit clear-noon/weather/night and post-texture matte tests; prepared geometry/material/shadow round trip and 54 published packs; actual battlefield browser render. User visual QA pending. Local only.

## Local R238C380 — correct lighting calibration direction

User clarified that the tester must follow the battlefield. Restored weatherSolarState's original 35% daytime sky boost exactly; R238C379's matte combat material change remains. Tester now reads shared clear-noon solar/weather state for sky gain, sun direction and daylight, includes battlefield ground color modulation, and uses combat hemisphere/sun colors and intensities with ACES exposure 1.15 for its Orc reference. Tester still lacks full battlefield shadow/visibility/local-light context, so this is a clear-noon reference rather than pixel-identical scene output.

Validation: 99/99 combat regressions, explicit restored-noon/weather/night/matte checks, browser tester controls/reset/export. Game lighting restored; no push.

R238C381: computer-controlled active units now use frame-rate-independent camera following of walkPresentation interpolation (including curved paths). Includes NPCs, hostile/friendly MOBs and Quick-controlled players. Existing visibility guards suppress unseen-hostile tracking. AI centerCameraOn no longer snaps to committed hexes; turn changes ease toward the new subject through the existing scheduler. Explicit ranged framing temporarily owns the camera; manual players retain existing behavior. Tests: 99/99 existing combat regressions plus new controller/interpolation/visibility camera test and actual game smoke. Local only.

R238C382: bow drawback sound starts 300 ms earlier, clamped to windup start. Recording pitch, duration, volume and release/impact timing unchanged.

## Local R238C383 — shield specular-off diagnostic

Enabled a shield-only test that zeros direct/indirect specular after the lighting accumulation stage. Diffuse light, colors, sword light strength and other model surfaces are unchanged. Shield identity is detected from the attachment ancestry and retained through captured geometry/material userData for corpse recapture. globalThis.adventurePartyShieldSpecularTest=false restores the previous matte specular response for A/B comparison; default is enabled. This tests whether the remaining pale shield patch is reflection versus diffuse-light saturation; no diffuse compression applied yet.

Validation: shield/body exclusion, runtime A/B uniform and corpse metadata test; actual game render; combat suite 100/101 initially, with the only failure a stale expected bow-draw timestamp from the earlier requested 300ms lead. Updated that expectation and the bow audio suite passed. User visual comparison remains pending. Local only.

R238C384: camera follow now requires an active walkPresentation AND adventurePartyWalkBusy, so idle turns, attacks, ranged framing and retained poses during reactions cannot pull the view back. Outside movement the original explicit centerCameraOn behavior is restored. Added attack/framing/retained-pose guards to the camera regression. User also changed shared grass leaf brightness from 1.2 to 1.0; lab and game cache versions advanced.

## Local R238C385 — render efficiency pass

Profiled the seeded 1600x1000 battlefield. Ground cover rebuilt/projected/sorted/upload-compared every instance each animated frame even when its layout was static. Added a reusable numeric snapshot of camera matrix/viewport/zoom/anchor, face geometry/visibility/scale and shelter revision. Unchanged layouts retain the ordered instance lists and bypass projection, sorting and packed-record comparisons. Per-frame wind, movers, light textures, scorch and snow bindings continue updating. Scene changes explicitly invalidate; mutable geometry/visibility are checked by value. No density, LOD or draw-order changes.

Baseline CPU median/p95 8.1/9.7ms; first optimized 7.1/9.1ms; repeat 5.5/6.4ms demonstrates timing variability, not a guaranteed speedup. All runs 3330 instances, 85 cover draws, 1,279,192 cover triangles and 213 total draws. A 36.5ms model GPU outlier in the first optimized sample did not reproduce (repeat .038ms). GPU work was not reduced; no GPU-speedup claim. Repeat trees 1.81ms, ground cover 1.20ms, floor .22ms on this device.

Validation: 101/101 combat regressions; extended real GPU grass probe verifies stable layout reuse and invalidation on visibility edits, in-place geometry edits and scene changes, plus existing snow/light/trail/LOD/order checks. Local only.


### R238C386 - VFX efficiency

Fireball targets use 64-pixel-aligned effect bounds with 50px blur padding.
Body/sparks retain full resolution; glow targets use half resolution with the
original world-pixel blur radius. Only active shape vertices are uploaded.
Offscreen/transparent smoke skips rendering and the preceding batch flush.
Tree snow coverage invalidates its own entry, not the entire tree image cache.
Corpse cache dependencies and empty-outline rejection were audited and retained.
Local RTX 3070 Chrome isolated 1600x1000 blast: median GPU 0.73ms -> 0.076ms,
CPU ~0.10ms unchanged. Center, edge, offscreen and zoom pixel comparisons differ
by at most 2/255 per channel. This is not a whole-frame FPS claim.
Combat regression suite: 101/101 passed before added cache regression.

### R238C387 - Grass beneath corpses
Reuse final-pose ground triangles from the corpse depression owner for grass ordering, even without snow. A 16px spatial index rebuilds only on corpse footprint revisions. During cached grass-layout rebuilds, roots inside a corpse footprint sort before that corpse; outside/foreground roots retain their original ordering. No new render pass or shader samples. Living/revived and absent corpses do not constrain ordering. Existing stone/stick behavior is unchanged. Tests: 103/103 combat regressions, GPU grass drawing/burial/LOD probe, and live battlefield smoke test passed. User performs final visual QA.


## Local R238C388 — ranged continuation and outdoor lighting lab (2026-11-13)

Ranged framing skips its 700 ms interpolation when the requested view is already within half a projected pixel and zoom agrees. Different targets, manual camera movement and zoom changes retain framing; draw/release, projectile, result and death timing remain unchanged. Six-rotation regression covers first framing, repeated shot, manual pan and retargeting.

Corrected model point-light colors: byte/sRGB colors now decode to linear before light accumulation, removing excess green/blue energy in warm lights. Shared combat-lighting-profile.mjs applies a soft knee to intense diffuse reflection while preserving channel ratios, low-light response and emissive effects. This is an artistic highlight-control calibration, not a global exposure or source-strength change. Shield specular remains disabled by default. Corpse snow uses 80% local diffuse reflectance and applies its highlight knee after display conversion, since the terrain-matched baseline is inverse-encoded display color. Compressing that encoded baseline in linear space was rejected during lab inspection because it shifted snow blue. Existing snow opacity/deposition, body whitening, scene sky calibration and physical light powers remain unchanged.

Corpse shader program keys retain the underlying shield/body key so snow cannot merge distinct material programs. Prepared material userData vectors are reconstructed after JSON hydration. Corpse image-cache keys include lab lighting settings and the shield A/B flag. Production defaults reuse one frozen profile and add no render pass or animation loop.

lighting-lab.html loads the published Orc Workshop package with the production loader, samples its authored death pose, and draws the living Orc, snow-covered corpse and original wooden-shield GLB through createCombatRenderer and the shared direct-unit/snow code. Day/night/snowy presets, lamp position/strength, material controls, snow amount, rotation, zoom, previous/current lighting comparison and settings export stay isolated from game preferences. It is an outdoor material fixture, not an encounter replay: battlefield architecture, visibility and cast shadows are deliberately absent. The Before comparison restores pre-correction highlight, color conversion and snow-reflectance behavior for the same current controls; it does not revert gameplay or prior fixes.

Validation: 104/104 combat regressions, separate six-view ranged framing test, startup loader and 54 prepared packs/234 chunks passed. Local browser rendered real assets and corpse snow, and clear-noon/current/before controls were inspected without shader or script errors. User is evaluating the open lab; further scene-specific visual QA remains with them. Local only; no push or deployment.


## Local R238C389 — material shader startup regression

R238C388's new diffuse hook assumed Standard's local totalDiffuse variable existed in every restored material. Other lit shader families and unlit helpers do not declare that variable, so startup could fail while compiling a real model/equipment rig. The hook now uses shared ReflectedLight components for Standard/Physical, Lambert, Phong and Toon materials, and skips unlit Basic material correction. Authored helper colors and the prior lighting/camera corrections are preserved. Direct-unit frame-registry imports stay aligned at R238C389.

Node regression covers all six material families. scripts/fixtures/combat-material-lighting.html compiles/renders 24 real GPU variants (six families, shield/body, bare/snow), with shader diagnostics promoted to failures; scripts/probe-combat-material-lighting.cjs runs it through the existing combat browser runner. All 24 GPU variants and 104/104 combat regressions pass. The previous lab-only visual check did not cover the full combat roster; full-game startup must be checked for this class of change. Local only.

R238C389 full-game verification: selected Dungeon Crawler Carl, added Orc Warrior and Wood Elf Archer through Combat Setup, loaded the battlefield and began Round 1. No shader or JavaScript errors were recorded. The user must reload the game page to replace already-loaded ES modules; Retry alone may reuse the failed old shader hook.



## Local R238C390 — grass edge antialiasing (2026-11-13)

Grass previously faded only inside its triangles. Thin blades could miss pixel centers altogether, causing scrolling shimmer and lost coverage. Static template attributes now carry each blade's cross-section and tangent. The vertex shader follows yaw, wind and actor bending, projects the true half-width and expands each side by half a physical framebuffer pixel; fragment alpha integrates approximate ribbon coverage, including blades narrower than a pixel. Point tips retain their authored geometry. Actual getCurrentViewport dimensions keep the filter correct for DPR and render targets. Stones and branches retain their existing fragment shading.

No new target, pass, animation loop, geometry rebuild or per-frame vector allocation. Existing placements, two-tuft preset, snow/footprint burial, actor/corpse sorting, layout caching and high/low triangle counts remain unchanged. Wider raster support and additional vertex math do add some work; this is not a whole-frame FPS claim. Antialiased grass retains more of the authored thin-blade coverage than the old fade, so patches can look fuller. The per-renderer tuning.edgeAntialiasing=false diagnostic retains the old fade for regression comparison; production defaults on. Main game and grass-scatter lab cache chains updated.

scripts/fixtures/combat-grass-antialiasing.html renders the production renderer through 12 subpixel camera offsets per case and compares image/temporal differences against an 8x-resolution reference. Tested far/near zoom, rotated views, physical DPR 1/2, low local light, default framebuffer plus targets, snow burial/cut exposure, actor bending, layout reuse and equal draw/instance/triangle budgets. Temporal mean-square error ratios (new/old) were .355, .251, .198 and .366 in local browser GPU checks (63–80% less error in these fixtures, not a guarantee of eliminating all scene shimmer). Added its probe to the existing browser regression runner. 104/104 combat regressions and scoped whitespace checks pass. Live grassy combat with Carl and Wood Elf Archer reached Round 1 and rendered at changed zoom without shader/script errors; only the pre-existing FBX extra-skin-weight warning was logged. Full scrolling feel remains user visual QA. Local only, no push/deploy. Reload the game page to replace its loaded modules.


## Local R238C391 — retain snow ambient color, bound local reflections (2026-11-13)

The R238C388 snow highlight knee compressed ambient snow together with point-light reflection. Bright terrain snow could remain white while corpse caps became gray/blue. Replaced the inverse-ACES ambient round trip and total-color knee: snowAmbientDisplay now carries the terrain's already-tinted, clamped display RGB directly into the cap. Body lighting and display-space alpha blending remain separate. Existing powder/depth tint and accumulation/occlusion are preserved.

apSnowDisplay/composeSnowDisplay retain that ambient baseline and add only a bounded local-light increment. At full correction, lamp display RGB is scaled by .35/(.35+peak) and per-channel remaining range (1-ambient). A lamp cannot darken snow or add more than 35% of the remaining range; bright ambient snow is not capped below its surroundings. This is an artistic highlight response, not a scene exposure or light-power change. The old inverse encoding helper and its tests were replaced with direct display-color contracts. No new render target, pass, shader sample or frame loop. Corpse uniform is explicitly named corpseSnowGroundDisplay. Direct-frame registry imports align at R238C391.

The lighting lab has an optional ambient snow background swatch matching ground powder/depth color, with its ambient-only scope labeled. The comparison now says Highlight limits off and toggles only compression, retaining current light colors and reflectance; it no longer claims to reproduce every historical R238C387 setting. The existing user lab tab was left untouched. Reload game/lab to update loaded modules.

Validation: 104/104 combat regressions. New production GPU fixture scripts/fixtures/combat-snow-ambient.html compares actual ground-snow surface shader output with a fully coated cap through the real unit compositor. Sample RGB matched exactly: night 18/26/39, twilight 67/82/103, overcast 157/174/191, bright powder 224/235/245, clipped noon 255/255/255. A warm point source from .01 to 1,000,000 power remained monotonic, above ambient and bounded (maximum sampled cap 101/86/72). Partial cap opacity and RGBA8/HDR target agreement pass. Probe added to the browser regression runner. All 24 material-family/body/shield/snow GPU variants pass. Actual Orc/corpse/shield lab assets render at noon and warm-light night without script/shader errors. Scene-specific visual QA remains with the user. Local only, no push/deploy.


## Local R238C392 — explosion ragdoll test page (2026-11-13)

Added `ragdoll-test.html` using the published Orc rig, equipment and materials through existing Workshop loading and skeleton-safe cloning. Thirteen simple Rapier bodies per unit run at 60 Hz under the shared 30 FPS presentation scheduler. Real ground/wall collision, optional unit collision, 1/4/8 units, pause/step, frozen corpses, manual/automatic survivor recovery and device measurements are isolated from combat. Settled actors lose their physics bodies/joints; corpses use the existing one-time static-pose capture. The scene scheduler stops when idle. Arena controls and expanding camera framing support the narrow browser panel. Reset releases cloned skeleton textures and baked corpse resources.

The Orc package has no get-up animation. Recovery is explicitly labeled a prototype: landed-pose blend, reversed authored forward fall, blend to ready at the landing position. Dedicated get-up clips and terrain/hex integration remain future production work. Only existing production-code change is exporting its established rig clone; lighting, snow, grass and combat timing stay on their current chain. Direct-unit registry imports remain R238C391; lab entry R238C392.

Validation: 105/105 automatic combat regressions including actual Rapier settlement, joint removal, idle steps, reset and wall collision. Browser: real Orc manual recovery with physics stopped, complete 1/4/8 survivor run and four static corpses. Eight Orcs measured 0.45 ms mean / 1.30 ms peak physics steps in one local run; maximum single corpse bake 4.30 ms in the separate four-corpse run. These exclude rendering and are device/fixture measurements. Idle corpse run retained exactly 284 solver steps and 289 presentation frames across observations. See `docs/RAGDOLL_LAB.md` for controls, scope, dependency provenance and limitations. Local only, no commit/push/deployment.


## Local R238C392A — authored GroundSit Exit recovery (2026-11-13)

The local ragdoll lab now puts Orcs in an even ring around the blast marker and sets their root facing outward. That root direction persists through physics and recovery, so the recovered Orc faces its blast travel. The user supplied Quaternius Universal Animation Library 1 Standard; its requested GroundSit_Exit is the `Sitting_Exit` take inside the supplied source GLB. The lab loads it locally, retargets it once to the published Orc using the same semantic world-bind-delta path as the existing UAL1 Orc clips, then samples the actual result. Recovery blends ragdoll → GroundSit Exit opening → authored forward stand-up → existing UAL1 Idle. No game package assignments or combat animation behavior changed. Asset checksum/provenance is at `assets/animations/ual1/ground-sit-exit-source.json`; CC0 license already preserved.


## Local R238C392B — airborne blast heading (2026-11-13)

Blast orientation now derives at launch from the actual outgoing velocity, not merely the spawn slot. Units retain their outward root turn for recovery; during their first 0.9 airborne seconds a capped yaw-only torque on hips/spine corrects toward that heading. Random initial tumble keeps pitch/roll but drops yaw spin, so the character reads as traveling outward without a permanently constrained ragdoll. The correction ends before landing and settled bodies still leave the solver entirely. Focused Rapier coverage verifies a backward hip receives a positive turn toward the outgoing vector.


## Local R238C392C — directional impact lean (2026-11-13)

Supersedes R392B’s continuous airborne yaw steering, which was too chaotic. Orc root heading still remains outward through recovery. A one-time, yaw-free launch bias now affects only hips/spine and is calculated relative to the Orc pre-blast facing: force from behind pitches the torso forward, while force from the front pitches it backward. Arms and legs remain free to react through the joints. Focused Rapier coverage verifies the forward hip/spine bias and zero yaw; live diagnostics record each selected lean vector.


## Local R238C392D — published Orc forward axis (2026-11-13)

Corrected the local lab root-facing transform after verification against the existing combat renderer: the published Orc is authored +Z-forward, not -Z-forward. The prior transform inverted the ring, so Orcs faced back toward the blast and the impact-lead direction was visually misleading. The lab now maps +Z to the outgoing vector before physics and preserves that root direction through GroundSit Exit and Idle recovery. The page module cache token was advanced to R238C392C so a normal reload fetches this correction.


## Local R238C392D — published Orc forward axis and visible impact lead (2026-11-13)

Corrected the local lab root-facing transform after verification against the existing combat renderer: the published Orc is authored +Z-forward, not -Z-forward. The prior transform inverted the ring, so Orcs faced back toward the blast and the impact-lead direction was visually misleading. The lab now maps +Z to the outgoing vector before physics and preserves that root direction through GroundSit Exit and Idle recovery. A one-time torso velocity split now makes the pitch read visibly: for a rear blast spine leads forward and hips lag, with a small matching pitch velocity; the front case is the inverse. No yaw controller is present. Main, rig and physics module cache tokens advanced to R238C392D so a normal reload fetches all corrections.


## Local R238C392E — random setup, outward launch (2026-11-13)

The lab now randomizes only the Orcs’ pre-blast presentation facings. At detonation it turns each real +Z-forward root outward from the blast, then creates the physics bodies from that outward pose. The finite yaw-free torso lead is therefore always outward: spine leads and hips lag slightly, with a small matching forward pitch; arms and legs remain unconstrained. This makes the flight and the recovered Idle orientation agree without any in-air yaw controller.


## Local R238C392F — dropped weapon and shield (2026-11-13)

The isolated ragdoll lab now detaches the actual published Orc attachment sockets 0.12 seconds into flight: `StudioRightHandEquipment` and `StudioLeftHandShield`. Each reparented visual retains its real mesh/materials, gets one local Rapier cuboid body at its measured world-space bounds, inherits the hips velocity plus a small outward/lateral impulse and rolls without a yaw controller. Gear settles independently, then its body is deleted while the visual remains on terrain; survivors recover unequipped. Reset removes the holders and rigid bodies. This is local presentation physics only: no inventory, combat or published model asset changes.


## Local R238C392G — readable dropped-equipment separation (2026-11-13)

The dropped-gear impulse was tuned after live inspection so the actual weapon and shield visibly separate from the Orc in flight rather than remaining visually overlapped: the weapon has a slightly larger forward/lateral throw than the shield, while both retain the Orc hips velocity and independent collision/settling. Main, rig and physics local module tokens advanced to R238C392G for normal reloads.


## Local R238C392H — clean equipment clearance (2026-11-13)

Dropped equipment now collides only with the fixed local arena, not the originating ragdoll or other dynamic units. This prevents the weapon/shield’s measured collider from snagging during the first detachment frames, while preserving gravity, ground/wall collision, independent settling and rigid-body removal. Main, rig and physics local module tokens advanced to R238C392H.


## Local R238C392I — flat dropped-equipment rest (2026-11-13)

At independent equipment settlement, the local holder now rotates the real attachment visual onto its thinnest measured face and lowers its actual bounds to 4 mm above the arena. This replaces unstable edge rest or a suspended visual with a deterministic flat final pose, after normal airborne physics has finished. The final-placement callback is covered by the focused equipment fixture. Main, rig and physics local module tokens advanced to R238C392I.


## Local R238C392J — frame dropped equipment (2026-11-13)

The local automatic camera framing now includes each dropped equipment holder as well as live/recovered Orc bones. Fast-thrown weapon and shield final poses stay inspectable instead of leaving the narrow test-panel viewport. Main, rig and physics local module tokens advanced to R238C392J.


## Local R238C392K — independent dropped-equipment animation (2026-11-13)

Fixed an animation ownership leak: the lab’s recovery pose list included the original equipment sockets, so a dropped item could still receive position/quaternion samples after reparenting. Detached socket subtrees now carry a local detached marker; pose application and blending skip them entirely. Weapons/shields remain independent physics/settled scene objects throughout recovery. Focused coverage verifies both pose and blend ignore a detached node. Main, rig and physics local module tokens advanced to R238C392K.


## Local R238C392L — per-Orc launch variation (2026-11-13)

Added a local 0–100% Launch variation slider, defaulting to 50%. At detonation it independently samples each Orc’s outward speed, upward speed and tumble within plus/minus the selected percentage of its configured value. Thus 0% remains deterministic and 100% spans 0–200%; impact lean and outward-facing orientation remain unchanged. Live diagnostics record the actual three sampled values per launch. This stays isolated to the local lab. Main, rig and physics local module tokens advanced to R238C392L.


## Local R238C392M — authored Death02 knockback prototype (2026-11-13)

Supersedes the local lab’s solver-driven blast path with an animation-only comparison. The project-owner-supplied Universal Animation Library Source archive provides the actual `Death02` take in its non-root-motion `UAL1.glb`; the local page retargets and samples that take onto the published Orc. At a blast, the root turns +Z-forward toward outgoing travel, follows a short deterministic outward/upward arc while Death02 plays, and ends prone facing outward. Survivors smoothly blend from the final Death02 pose into the already-proven GroundSit Exit then Idle. No Rapier import/world, rigid body, joint, dropped-equipment solver, collider or corpse bake is created by the page; equipment stays in the authored pose. The existing 0–100% slider now varies only outward/upward launch, because Death02 supplies its own authored tumble. Source asset checksum/provenance is `assets/animations/ual1/ual1-death02-source.json`; CC0 license was already preserved. Local only, no combat integration.


## Local R238C392N — Crawl Exit recovery (2026-11-13)

The animation-only Death02 prototype now recovers using the actual `Crawl_Exit` take in the same supplied UAL1 Source `UAL1.glb`, rather than GroundSit Exit from the separate Standard archive. The lab samples Death02 → Crawl Exit → existing Idle while retaining the outward root heading and zero rigid bodies. `ual1-death02-source.json` records both selected clips; focused coverage confirms both names exist in the checksum-verified source asset. Main and rig module cache tokens advanced to R238C392N.


## Local R238C392O — clamp authored recovery endpoints (2026-11-13)

Fixed the animation-only lab’s endpoint sampling: Death02 and Crawl Exit were sampled at their exact durations while their actions retained the default repeat loop, wrapping the terminal pose back to frame zero. That made an Orc stand at the end of Death02, then fall into Crawl Exit, and eventually blend from Crawl’s opening pose. Both samplers now use one-shot, clamped actions, so Death02 stays face-down at its real final frame and Crawl Exit finishes standing before the Idle blend. Main and rig module cache tokens advanced to R238C392O.


R238C445 validation: 131/131 combat regressions passed, including threshold, nonrepeat, each-hit timing, death override/visibility, zoom-independent font, overlap handling, expiration and audio removal. Spell-target results regression passed after declaring the new presentation dependency in its shared fixture. Required workflow totals 128/131 after that rerun; only the existing loader URL, Rev267 label and exploration camera mock failures remain. Live browser captured blue and red speech at zoom .5/1/2, always 16px, including a fallen unit's death cry; no voice sample requests and no script/shader errors. Footstep entry point retained. Live harness now waits for full script-loader readiness before starting combat.


Local 2026-11-15: environmental architecture pass and rejected branch-cap rollback. See COMBAT_ARCHITECTURE.md, Environmental ownership audit. Preserve collision metadata/loader ownership and active wind-service activation. Keep local; user visual QA pending.
