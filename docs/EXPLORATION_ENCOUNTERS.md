# Exploration encounters — Candidate Rev 210

The tollhouse now has an Orc patrol in its north room. Walk north through both doors to enter tactical combat. Press Space to begin; use the normal combat controls. Retreat to exploration saves current HP, inventory/equipment, conditions and surviving opponents. Victory returns to exploration and prevents that encounter from triggering again. Defeat requires Restart on the exploration page.

## Authoring

In Map Editor, select the northwest corner of a trigger region. Enter its name, width/height, choose an encounter-enabled MOB from the existing library, count (1–6), and the enemy deployment anchor (one-based column/row). Add/update encounter; C marks its region. Select its origin to edit or remove it. Save and Test Map. Adventure Pack export/import includes encounters. Existing saved drafts are preserved and do not automatically gain the sample patrol.

## Integration

`exploration-encounters.mjs` owns trigger validation, outcomes and square-to-hex terrain conversion. Rev 212 expands each exploration square to two tactical hex widths (1:2); tactical movement distances remain unchanged. The bounded area extends five exploration squares from the entry point. Solid wall edges and closed doors become existing engine architectural wall segments; outside cells are blocked. Deployment validates full footprints and connected movement space. Partial hexes beside walls can be conservatively blocked, so narrow passages may need widening.

`exploration-encounter-client.mjs` creates the session handoff. `exploration-combat-hooks.js` runs after ordered engine startup, uses existing makeFighter/makeLibraryMob factories, and provides retreat/finish persistence. Stable player ID remains `player`, required by the engine turn lookup. Refresh restores the initially saved encounter rather than sampling another opponent set. Units retain their sampled class levels, HP and equipment across retreat/re-entry. Results are JSON snapshots; no duplicate combat engine or asset renderer is introduced.

Normal test progress is browser-local and scoped to map geometry/encounter definitions. Editor tests use isolated session storage. Restart clears the current map's encounter progress and discovery. This is a one-character, per-map proof of concept, not a campaign party/save system. Other map tests do not share Carl's progress yet. Combat snapshots are saved at entry and explicit return; closing the browser mid-round does not save that round. Doors cannot be changed during this combat POC. Victory loot is recorded in the encounter result, but an exploration loot UI and campaign XP award are future work. Random encounter tables, mixed MOB groups and outdoor edges remain separate updates. Rev 211 enables maps up to 128×128.

## Verification

Run scripts/test-exploration-encounters.mjs and repository validation. Browser test: walk into patrol, begin combat, retreat, confirm reduced HP on party list, re-enter with the same opponents, and complete combat. Cleared region must no longer retrigger; Restart must allow a fresh test.


## Candidate Rev 211 — explicit encounter startup

Encounter navigation includes the build revision to avoid an old cached index page. An opaque Preparing encounter screen stays up while ordered scripts and sprites initialize. Missing session handoff, unavailable MOBs, interrupted starts and deployment errors show the actual error with Retry and a contextual return to the exploration/editor test, instead of leaving the launcher visible. The R shortcut cannot reset combat behind the encounter snapshot; restart from exploration instead. `scripts/test-exploration-startup.mjs` verifies delayed readiness, delayed combat initialization, missing handoff and cancelled startup recovery. Browser QA covers entry, retreat, exploration Restart and repeat entry on a 128×128 editor map.

The reported intermittent menu return was not reproduced in the local restart test. The prior implementation exposed the launcher during sprite loading and on pre-combat exceptions; these paths are now covered by explicit loading and error UI so any remaining failure is diagnosable without losing the handoff.

## Candidate Rev 212 - combat terrain rendering

The encounter crop remains five exploration squares around the entry, with a 40x32 tactical bound for the expanded terrain. Ordinary combat keeps 40x20. Floor coverage is the exact union of room polygons. Floor lighting, grid, LOS and ground shadows are clipped to that union; the LOS floor pass runs before depth-sorted walls and units. Exploration combat skips the legacy post-LOS unit repaint, which selected a Kobold fallback for library MOBs and doubled the Orc image. Darkness spell volumes still render.

The existing exploration floor.png and wall.png textures are loaded before combat starts, then used by the shared architectural renderer. Floor pattern placement is world-anchored so camera movement does not slide the texture. Combat doors and discovery of further rooms remain future work. Test with test-exploration-rendering.mjs and enter the sample patrol from exploration; check textured walls, clean room boundaries and single Orc sprites.
