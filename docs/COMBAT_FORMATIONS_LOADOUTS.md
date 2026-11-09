# Opposing formations and equipment AI — local pass

Combat tests deploy two compact formations with at least ten hexes between opposing occupied cells, rather than surrounding the player. Large footprints participate in spacing and collision checks. Exploration encounter deployment is unchanged.

Friendly copies of the repository male uniformed orc use the imported blue model; hostile copies keep their original model. Allegiance does not change the MOB's rules or equipment. The blue model is also selectable in 3D Studio. Source archive: tripo_convert_765f7612-30aa-4194-880b-4e1314432573.zip. Model: 12,321 triangles, 65 bones, embedded 512px texture. Offline shadow LOD: 449 triangles.

AI movement applies a strong cost to transitions that provoke the shared leaving-melee-reach reaction. Moving alongside the same enemy is not penalized. Only perceived opponents influence this cost; this is a preference, not an absolute prohibition if no safe route is available. Both the ordinary and perception-aware path searches pass the previous hex into this calculation.

Autonomous units and Quick Command select usable weapons from their own inventory. Ranged weapons require matching ammunition; melee is preferred when threatened in melee. Ranking uses average small/medium damage and magical damage/to-hit bonuses. Empty ammunition switches to a melee weapon or unarmed combat. Equipment refresh never refills ammunition. Manual player equipment choices remain under player control.

Prepared red/blue orc equipment and unarmed combinations are saved under assets/combat-units. Preparation happens in Studio, not during battle startup. Blue live action clips reuse the existing male-orc action library and compatible bone names.

Checks: test-combat-formations-loadouts.mjs; test-mob-ai-navigation.mjs; test-orc-archer.mjs; test-carl-bow-loadout.mjs; test-studio-footprints.mjs; validate-repo.mjs. Browser validation uses local port 8276.

Update (2026-11-08): Blue uniformed orcs are a separate published MOB choice (orc-male-uniformed-blue), available to either faction. Deployment no longer selects the blue model for friendly units. Red and blue units share rules and equipment generation. Verified by test-orc-faction-selection.mjs and test-combat-formations-loadouts.mjs. Existing test-repository-mobs.mjs reaches an unrelated legacy axe-axis assertion failure with the replacement weapon catalog.
