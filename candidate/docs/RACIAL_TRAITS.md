# Racial traits — local revision 311

MOB Workshop page 1 owns Race, Gender, and Morale. Identity survives project saves, portable Workshop packages, published MOB reopening, and combat instantiation. Stable `raceId` values identify related MOB types independently of model, name, or allegiance; future encounter group behavior can use this field.

## Elf rules

- Morale defaults to **13**, as requested. Other races keep the existing default of 10 until authored rules are supplied.
- Bows and swords receive **+1 to hit and +1 damage**. The shared combat modifiers inspect the actual equipped catalog weapon and explicit physical attack kind. Crossbows, slings, other weapons, natural attacks, and spell attacks do not receive this bonus.
- Elves have **90% resistance to Sleep and charm-related spells**, checked once per eligible target after cast commitment and before the normal saving throw. A successful resistance prevents the effect; a failed resistance preserves the ordinary save and resolution. Resisted Sleep targets retain their allocated HD cost.
- Implemented routes: Sleep, Charm Person, Taunt, Hypnotic Pattern, Ray of Enfeeblement, Scare, Tasha's Hideous Laughter, wizard Hold Person, priest Command, and priest Hold Person. Beneficial Remove Fear is unchanged.

`js/racial-traits.mjs` owns race profiles, normalization, weapon affinity, and resistance rules. `js/combat-racial-traits.js` provides the existing combat log, result beat, and action completion integration. New spell handlers must use this shared gate when adding hostile Sleep/Charm effects.

## Identity and compatibility

Race and Gender are explicit selectors; identity is not inferred from a model or a MOB's display name. Older Workshop definitions migrate recognized `stats.species` values, including Wood Elf, to the stable race ID. Half-elves remain distinct and do not inherit Elf bonuses. Gender is metadata and does not change combat statistics.

Morale normally inherits the race profile. The page-one override checkbox permits an individual value from 2 through 20. Older definitions with the former default of 10, or their racial default, inherit the race value; other authored values become explicit overrides. Users can explicitly override an Elf to 10 if desired. Combat receives the effective morale and race ID; this change does not implement new group AI.

## Verification

`node scripts/test-racial-traits.mjs` checks migration and export, page-one controls, published Wood Elf encounter readiness, physical combat modifier stacking, spell-attack exclusion, both sides of the 90/91 resistance boundary, normal saving throws, interrupted casts, and all ten implemented spell routes. The test is registered in repository validation CI. Visual QA remains with the user.
