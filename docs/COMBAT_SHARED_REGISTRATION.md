# Shared combat appearance registration — R238C431

Identical prepared appearances already shared asset loading and in-flight promises. Combat nevertheless registered the same loaded sprite set for every unit, rebuilding pose lookups, validating all directional frames, scanning asset entries and dispatching registry notifications repeatedly.

MobAppearanceRuntime now holds a weak identity cache of successful registrations. Combat assigns the resulting ID to each unit, retaining per-unit revision guards, equipment signatures, footprint and ready events. Before reuse, the cached registry record must still be the current record: deletion or another registration with the same ID forces registration again. Newly loaded appearance objects also register normally. Direct authoring/Studio registration is unchanged, retaining validation and intentional replacement behavior. Prepared result objects are treated as immutable; new visual content must use a new result or replace the registry record.

The appearance recipe/key path and per-unit combat state are unchanged. This does not claim to eliminate all unit-count-dependent setup or first-frame cost. No renderer or gameplay changes.

Validation: 125/125 combat regressions; existing appearance cache/stale-result tests and directional-sprite tests passed. New tests cover one load/registration for 10 and 25 matching orcs, replaced/deleted registration records, different appearances and failed registrations. Browser registration timings are recorded separately in the task workspace. A randomly generated orc loadout lacked prepared assets during the initial benchmark, so the comparison uses a known saved uniformed-orc appearance instead. Local only; not published.

Browser measurement of the actual registration stage using the hydrated saved uniformed-orc package: 10 units, 10 registrations / 1.3 ms baseline versus 1 registration / 0.1 ms shared; 25 units, 25 registrations / 2.3 ms baseline versus 1 registration / 0.1 ms shared. These single-run timings exclude loading and full battle setup and do not explain a multi-second preparation delay. Saved-package hydration was used because recipe-based lookup did not resolve that package in the current fixture.

