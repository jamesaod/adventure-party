# Hill Giant boulders — combat integration

Local implementation, 19 November 2026. The isolated boulder lab remains available.

## Agreed rules

- Tactical hexes are 10 feet. Maximum throw is the user's 10-hex (100-foot) cap.
- Short 1–3: +0; medium 4–6: -2; long 7–10: -5. Longer throws are rejected.
- Base damage is 2d8, from the AD&D 2E Hill Giant entry. Do not add the giant's tree-club Strength damage.
- Roll a normal missile attack against AC. A miss scatters uniformly into a valid adjacent hex; at a map edge only eligible neighbors participate.
- Direct hit: full damage. Other occupants of a missed landing or rolling contact save vs. breath weapon: success avoids damage; failure takes floor(rolled 2d8 / 2).
- From impact, roll along the closest continuing hex direction for at most two hexes. Units stop the rock on contact even if they save. Walls, trees, existing boulders and map edges stop it before entry.
- Resting rocks block movement. Ruts remain passable and use the existing ground wear/water system.
- Giants without tree clubs seek the nearest reachable boulder no farther away than the nearest standing tree; otherwise the existing tree objective runs. Acquiring a boulder consumes the objective turn. A subsequent turn throws or approaches a visible target within range. After throwing, seek resources again.
- Successful tree pickup retains normal tree-club combat; it does not discard the club to seek rocks.
- Pickup and throw use the shared animation scheduler at half clip speed. Release is 43%. No dive animation yet.

## Owners

combat-boulders.js owns encounter rocks, AI and throw resolution. combat-boulder-rules.mjs owns pure range/scatter/damage helpers. combat-boulder-render.mjs draws the five supplied models through the existing GPU scene queue and reuses volumetric impact dust. tree-hauler-presentation.mjs supplies pickup/throw clips and the held rock. Ground wear stamping updates dirt, depth and slopes; the existing mud, grass coverage and shared water field consume those changes.

Twelve spaced rocks are scattered on dry, outdoor, unoccupied grass combat-test terrain, using all five variants. New encounters reset dynamic ground edits. Exploration maps are not randomly populated by this combat-test placement.

The combat settling/rolling path is a presentation approximation constrained by hex rules, not a general rigid-body solver. Pickup scars sample each rock underside at load; rolling scars use swept rounded stamps at rock width. Keep final appearance approval with the user.

## Sources

- AD&D 2E Monstrous Manual, Hill Giant: rock damage 2d8, listed maximum range 200 yards. User overrides range to 10 tactical hexes.
- https://anyflip.com/cmjgl/rupt/basic/51-98 — Against the Giants: Liberation of Geoff, hill giant statistics repeat 2d8 / 200 yards.
- https://frpworld.com/downloads/ruleandaccs/dl/Advanced%20Dungeons%26Dragons%202nd%20Edition%20Player%27s%20Handbook.PDF — standard medium -2 / long -5 missile penalties.

Scatter, rolling, breath saves and half damage are user house rules, not claims about the published hill giant rules.
Validation: complete suite 202/203 passed on the final run; the remaining boulder fixture lacked HEX_W after physical-width integration. Adding that fixture dependency and rerunning test-combat-boulders passed all its cases (203 tests passing across final run plus targeted rerun). Live headless combat loaded 12 rocks and a Hill Giant, picked up, threw, dealt exactly 8 damage for forced 4+4, and stopped at unit contact; no page or shader errors. Optional prepared-unit cache probes returned 404 and successfully fell back to source model preparation. Appearance approval remains with the user. No remote publication.
