# Wizard tactical AI

This pass covers all 38 combat-enabled Wizard entries in the MOB Workshop catalog. It does not expand that catalog or change priest AI. Additional runtime-only spell extensions need catalog admission and their own evaluators before Workshop AI can use them.

## Ownership

- js/combat-wizard-tactics.js: purpose metadata, candidate aim points, eligibility and utility scoring.
- js/combat-caster-ai.js: shared perception, melee comparison and decision explanations; delegates mage scoring to the wizard owner.
- js/adventure-party.js, repositoryCasterTurn: bounded position search and action execution.
- js/combat-spells-*.js: authoritative spell effects, resources, saves and animations. AI scoring never rolls saves or applies effects.
- scripts/test-combat-wizard-tactics.mjs: catalog coverage and a useful scenario for every spell, plus negative cases.

## Scoring policy

Damage scores use expected useful HP loss and a finishing bonus; saves and attack rolls receive fixed probability discounts, not hidden enemy save knowledge. Control scores favor active threats and honor creature eligibility, target limits and HD budgets. Buffs require an actual benefit and use execution effect IDs to avoid duplicate casts. Weapon attacks remain competitive, especially against helpless adjacent targets.

Ground spells consider visible enemies and neighboring aim hexes (at most 96 candidates per spell). Cones use the actual wedge helper, and area spells use existing shape/occupancy helpers. Allied exposure vetoes harmful area effects by default. Screen spells compare blocked enemy firing lanes against blocked friendly lanes. Existing persistent areas reduce duplicate value. These are tactical estimates, not perfect future simulation.

Detection uses recent last-seen memory, never hidden live coordinates. Pyrotechnics requires a caster-visible Flaming Sphere, its currently supported fire source. Illumination is useful only in darkness. Taunt requires nearby protection and healthy caster; Deafness favors casters. Spectral Hand requires remaining touch magic and enough HP.

The existing role, spending, risk and friendly-fire Workshop controls modify scores. Enable Explain AI decisions to log choices; unit.lastSpellAiDecision also retains the latest result and rejected reasons. Candidate/area caches live only for one synchronous decision and are rebuilt after movement.

## Purposes

| Spell ID | Role | Tactical purpose | Effect checked |
|---|---|---|---|
| armor | defensive | Improve weak armor | armor-spell |
| burning-hands | offensive | Burn a close enemy fan | — |
| charm-person | controller | Turn an eligible humanoid | charm-person |
| chill-touch | support | Prepare for imminent melee | chill-touch |
| color-spray | controller | Disable a close enemy fan | color-spray |
| enlarge | support | Strengthen an engaged weapon user | enlarge |
| grease | controller | Trip an active enemy | prone |
| light | controller | Blind an enemy or illuminate an ally | blind |
| magic-missile | offensive | Reliable finishing damage | — |
| protection-from-evil | defensive | Protect an ally facing evil | protection-from-evil |
| shield | defensive | Protect the caster under threat | shield |
| shocking-grasp | offensive | Deliver electrical touch damage | — |
| sleep | controller | Disable low-HD active enemies | sleep |
| spook | controller | Drive a living threat away | spook |
| taunt | controller | Draw ranged foes toward a protected caster | taunt |
| wall-of-fog | controller | Screen allies from ranged threats | — |
| blindness | controller | Impair an active enemy | blind |
| blur | defensive | Reduce incoming attacks | blur |
| continual-light | controller | Blind an enemy or provide lasting light | blind |
| darkness-15-radius | controller | Deny enemy firing lanes | — |
| deafness | controller | Disrupt verbal spellcasting | deafness |
| detect-invisibility | support | Investigate a recently lost nearby foe | detect-invisibility |
| flaming-sphere | offensive | Burn an occupied position and its neighbors | — |
| fog-cloud | controller | Screen allies from enemy missiles | — |
| glitterdust | controller | Blind a group and reveal concealment | blind |
| hypnotic-pattern | controller | Fascinate a group within the HD budget | hypnotic-pattern |
| invisibility | defensive | Protect a wounded or exposed ally | invisibility |
| melfs-acid-arrow | offensive | Apply ongoing damage to a durable foe | acid-arrow |
| mirror-image | defensive | Protect the caster with decoys | mirror-image |
| pyrotechnics | controller | Use an existing sphere to blind enemies | blind |
| ray-of-enfeeblement | controller | Weaken an active weapon threat | ray-enfeeblement |
| scare | controller | Scatter eligible low-HD enemies | scare |
| spectral-hand | support | Prepare safe delivery of a remaining touch spell | spectral-hand |
| stinking-cloud | controller | Disable an enemy group with nausea | nauseated |
| strength | support | Increase an engaged ally’s weapon strength | strength-spell |
| tashas-hideous-laughter | controller | Disable intelligent enemies | hideous-laughter |
| web | controller | Restrain advancing enemies | webbed |
| fireball | offensive | Damage a safely isolated enemy group | — |

## Extending safely

Add a catalog entry and execution handler first. Add a purpose/evaluator here using the same target shape, eligibility and effect IDs. Test both a useful scenario and rejection cases (allies, duplicate effects, invisible targets, prerequisites). Keep evaluation read-only; use the normal prepared-spell execution path. Run scripts/run-combat-regressions.mjs.

## Controlled decision tuning — 2026-11-17

Run node scripts/test-combat-wizard-scenarios.mjs for deterministic scorer + turn-planner checks. The fixture controls visibility, geometry, movement, and action recording; it does not substitute for visual battle QA. Decision explanations are enabled in every scenario. Run scripts/probe-combat-wizard-decisions.cjs against the local server with PLAYWRIGHT_MODULE and BROWSER_EXECUTABLE configured for real browser spell execution.

| Scenario | Verified decision/outcome |
|---|---|
| Three grouped enemies | Sleep |
| Enemy surrounded by allies | Magic Missile instead of unsafe Fireball |
| Two enemies beside an ally | Off-center Sleep excludes the ally |
| Full movement required | Move without casting; cast on following turn |
| Adjacent sleeping enemy | Preserve spells and use ordinary melee fallback |
| Adjacent held enemy | Preserve spells and use ordinary melee fallback |
| Empty preparations | Ordinary combat fallback |
| Conserve last missile against durable enemy | Preserve spell |
| Last missile can finish target | Spend the spell |
| Darkness | Light |
| Daylight with no target | Do not waste Light |
| Short move to spell range | Move two steps, then cast |
| Blocked casting lane | Move to open lane, then cast |
| Hidden enemy | No targeting of hidden coordinates |
| Low-health caster with escape available | Retreat to safer ground |
| Cornered wounded caster | Shield instead of weak melee |

The last case exposed excessive casting-risk penalties for emergency self-protection. Defensive spells on the caster now receive one quarter of the usual close-combat risk penalty below 35% HP. Ordinary offensive risk and clerical scoring are unchanged. Duplicate same-round decision explanations are suppressed while retaining rejected reasons.

Live browser verification: Shield applied and consumed its preparation; Sleep affected both test orcs and consumed its preparation; no page errors. These are controlled outcomes, not evidence of optimal balance across every encounter.
