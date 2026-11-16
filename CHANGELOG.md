# Changelog

Adventure Party used numbered standalone HTML releases before Git became the primary version history. This repository starts from **R158**.

## R238 — Sprite studio and combat presentation milestone

- Promoted the approved Candidate Rev 4–48 work to the stable release line and refreshed application and studio module cache versions to R238.
- Added the Spell Effects Previewer for implemented combat spells, with configurable caster/targets, deterministic outcomes, VFX/SFX controls, measured timelines, and the Electrical SFX Laboratory. Fireball and Magic Missile previews share their production execution paths.
- Added simultaneous Magic Missile volleys with individual missile target assignments, corrected Acid Arrow follow-on damage timing, and improved ordered spell-result and death presentation.
- Updated gaseous spell formation and evolving cloud outlines, branching Lightning Bolt and its illumination, localized Fireball/projectile lighting, elemental arrows, Shocking Grasp, and damage text styled by element. The retired Lightning/Fireball VFX labs remain removed; production Fireball retains the restored production renderer.
- Added and refined spell/combat audio, cleaned sample tails, removed the universal initial casting cue, and introduced spell-specific synthesized cues and animated Grease effects.
- Updated juvenile Red Dragon artwork and added the Orc Leader, third-level Orc Shaman, and 20-Orc encounter. Recovered the previously unmerged user-selected Orc and light-blue-tabard Shaman ready/action artwork, verified against the original source archive; the correct Orc Leader artwork and existing rendering dimensions are preserved.
- Added the 3d studio with local GLB/glTF/FBX loading, animation selection/playback/scrubbing, six synchronized VGA views, color/outline/lighting controls, and Z-up defaults. Capture ready, attack and prone moments into an eighteen-sprite sheet and separate asset ZIP.
- Added persistent studio workspaces, exact tested-capture restoration, direct return from combat tests, target MOB selection, four active hex footprints with a model-floor guide, and independent resolution/model-size controls. Exported size metadata drives battlefield rendering; saved sets remain resizable without recapturing their pixels.
- Added validated folder-based sprite imports, a small runtime set index, locally pinned renderer dependencies, and CI coverage for packages, projection, geometry, directional poses, footprints and studio combat exit. Preserved project workflows live separately in `workflow/`, outside published game output.

## R237 — Candidate milestone promotion

- Promoted the approved Candidate Rev 1–3 work to the stable release line.
- Restored LOS presentation for architecture and obscuring-volume blocking, with unseen tactical areas rendered using the approved 33% hidden overlay.
- Total party defeat no longer awards or presents recoverable combat loot.
- Added ordered rising combat-result beats: primary damage, secondary/rider damage, buffs, debuffs, then follow-on physical/condition messages.
- Flaming Sword +5 now presents sword damage and its fire rider as separate beats; Chill Touch likewise separates its cold rider and Strength-loss debuff.
- Casting interruption now presents a white rising `Casting Interrupted` condition beat after preceding damage/effect beats and plays its dedicated synthesized fumble SFX.
- Completed the implemented Level 1–3 area-of-effect AIM-preview audit so tactical areas, wedges, lines, walls, auras, clouds, and other implemented footprints are visible before committing the cast.
- Stable launcher no longer shows Candidate branding; Candidate revision numbering remains a development-branch QA marker.


## R236 — Floating combat information

- Added a shared over-unit floating combat-text system as a final tactical foreground pass.
- When a unit begins a spell casting interval, `Begins Casting.` appears above that unit for 1 second.
- Damage now produces red floating text in the form `-14 dmg`; it rises slowly and fades away over 1 second.
- Damage feedback hooks into the canonical `onUnitDamaged()` path, covering physical attacks, direct spell damage, AoE damage, ongoing magical damage, and other existing damage sources that use the normal engine hook.
- Multiple rapid damage events on the same unit stack vertically so individual hits remain readable.
- Added a future-facing healing presentation hook: `onUnitHealed(unit, amount)` displays green `+14 healing` text with the same 1-second rise/fade. R236 does not add healing mechanics.
- Floating text follows the unit while it remains present and supports large/multi-hex creatures and Enlarge visual scale.
- Over-unit feedback is drawn after LOS/masonry presentation but respects party visibility, so it cannot reveal hidden or invisible enemies.
- Added a dedicated animation loop that runs only while floating text is active.
- Added `AdventurePartyFloatingCombatText` diagnostics and manual test helpers.

## R235 — One-second spell interruption notice

- Fixed a presentation race where casting interruption was detected correctly but the notice was immediately overwritten by the attack/damage message that continued in the same call stack.
- `<unit name>'s spell has been interrupted.` now has exclusive ownership of the combat message bar for exactly 1 second.
- Ordinary damage/critical/death messages attempted during that one-second window are deferred instead of replacing the interruption notice.
- After the interruption notice expires, the most recent deferred combat message is restored.
- `waitForCombatActionPause()` now respects both the priority interruption window and the deferred follow-up message so combat does not race ahead while either notice is being presented.
- Casting mechanics are unchanged: the spell is still lost immediately when the caster takes damage or otherwise suffers a valid R230 interruption.
- Added `AdventurePartySpellInterruptionNotice` diagnostics.

## R234 — Binary hidden-hex LOS presentation

- Fixed an architectural LOS rendering edge case where unseen indoor floor hexes could look partially revealed because the R215 blackout was translucent.
- The underlying LOS decision remains unchanged: the center of each tactical hex is still the sole visibility sample.
- Unseen hexes are now rendered as complete opaque hidden tactical tiles rather than a 70% black veil over the existing floor/lighting.
- Bright stone-texture details, dynamic illumination, architectural shading, and other underlying floor coloration can no longer leak through and resemble partial visibility.
- Visible hexes remain completely untouched.
- Hidden indoor and outdoor hexes use separate subdued hidden-tile palettes so battlefield context remains readable without exposing the real terrain texture.
- Added a same-color edge seal to remove antialias seams between hidden hexes, then redraws a subdued tactical grid over the hidden tile.
- Added `AdventurePartyLosPresentation` diagnostics for per-hex visibility/palette inspection.

## R233 — Spell presentation audit and Minute Meteor illumination

- Audited the implemented combat-spell presentation flow and standardized it around a caster-first camera contract: every direct cast begins centered on the caster before the spell hands focus to its target, impact point, or affected units.
- Projectile spells now recenter on their destination before the projectile arrives, rather than snapping to the victim only after damage has already been applied.
- Save-based targeted spells now keep the target in view while the save/result message is shown.
- Ground/area spells inherit target-area focus through the shared area-effect path.
- Burning Hands retains its existing sequential AoE result presentation.
- Magic Missile now resolves each missile as its own readable impact beat instead of aggregating the whole volley into one damage number. Mirror Image interceptions are shown individually.
- Fireball remains mechanically simultaneous, but its post-explosion save/damage/death results are presented one creature at a time while centered on each victim.
- Flame Arrow now presents every bolt independently, including explicit target-centered miss messages and Mirror Image interceptions.
- Melf's Acid Arrow, Shocking Grasp, and Vampiric Touch now hold on the intended target for misses instead of immediately advancing the turn.
- R232 Lightning Bolt keeps its reflected-ray geometry but now presents each creature exposure and save/damage result individually after the shared electrical discharge.
- Player-directed Melf's Minute Meteors still launch the assigned volley simultaneously, then resolve each meteor's miss, Mirror Image hit, or damage as an individual target-centered beat.
- Simultaneous Minute Meteor volleys defer death transitions until all already-launched meteors have resolved, preserving the R227 rule that later meteors do not vanish just because an earlier meteor reduces the same target to 0 HP.
- Automated/Quick Minute Meteor volleys inherit the same target/result pacing.
- Added an experimental moving illumination source to every Minute Meteor projectile: 10-foot radius, dark-red light, following the meteor throughout flight and disappearing on impact/miss.
- Minute Meteor projectile lighting is injected into the existing R195 illumination system, including architectural light blocking/shadow behavior rather than using a separate decorative glow.
- Added `AdventurePartySpellPresentation` and `AdventurePartyMinuteMeteorLight` diagnostics.

## R232 — Reflected Lightning Bolt geometry

- Replaced Lightning Bolt's old hex-direction reversal with a true reflected ray traced through a top-down tactical metric and projected back onto the isometric battlefield.
- Lightning Bolt now ricochets from solid architectural wall/projectile subsegments, legacy solid wall hexes, and outdoor tree trunks.
- Doorway openings remain passable; window/glass spans remain solid for Lightning Bolt, matching the engine's existing projectile-blocking rules.
- Tree collision uses a small trunk cylinder centered on the tree base rather than the entire canopy or whole tactical hex.
- Reflection uses the geometric surface normal, so glancing wall/tree hits change direction naturally while square hits can return the bolt toward the caster.
- The original 8-hex / 80-foot tactical range is conserved across all reflected segments; reflections never reset range.
- Added an eight-reflection safety cap to prevent pathological wall-to-wall loops.
- The caster is excluded from the bolt's initial origin segment but can be struck if a reflected segment crosses the caster later.
- Multi-hex creatures are counted once per ray segment, preventing one straight pass from damaging a large creature once per occupied hex.
- A creature can be exposed again when a genuinely reflected segment crosses it again.
- Lightning Bolt AIM preview now uses the exact same reflected trace as final resolution, including friendly-fire detection.
- Lightning Bolt VFX now renders the entire ricochet as one continuous electrical discharge with impact flashes at wall/tree collision points.
- Added a future-facing custom reflector hook through `game.r232LightningReflectors` plus `AdventurePartyLightningReflection` diagnostics.

## R231 — Target spells at casting completion

- Corrected spell timing so selecting a spell declares the spell but does not choose its tactical target at the beginning of casting.
- Player-controlled casters now wait through the full R230 casting-time interval; when the spell reaches its completion initiative slot, AIM opens and the player chooses the target/ground hex/direction then.
- Self-only spells still resolve automatically at completion because they require no tactical target selection.
- Range, LOS, area geometry, target legality, and current battlefield state are evaluated when the player aims at completion rather than being frozen from the beginning of casting.
- Automated Mage/Quick casters discard their start-of-cast target snapshot and reacquire Fireball, Sleep, Magic Missile, or fallback hostile targets when the casting time completes.
- Canceling completion-time AIM forfeits the already-committed spell instead of restoring it.
- Changed casting interruption presentation to the requested message: `<unit name>'s spell has been interrupted.`
- Fixed the remaining Melf's Minute Meteors next-round CAST bug: the stored-meteor reminder no longer creates a one-second combat-action hold, so CAST becomes usable immediately at the start of the following round without requiring a physical attack to refresh the UI.
- Stored Minute Meteor release remains an already-cast spell action and therefore does not incur a new casting-time delay.

## R230 — AD&D 2e spell casting time and interruption

- Implemented AD&D 2nd Edition casting-time initiative for combat spells.
- Numeric Casting Time values now delay spell resolution to the caster's rolled initiative plus the spell's Casting Time; values above 10 still resolve in the same round after later initiative slots.
- Spells with a Casting Time of `1 round` now resolve at the end of the current combat round. Multi-round and turn-based Casting Times are tracked across rounds, with the caster occupied until the final casting round.
- Beginning a spell no longer plays an incantation or casting sound. Instead, the battlefield displays the one-second notice `<unit name> begins casting a spell...`.
- Memorized spells are removed from memory when casting begins, so a disrupted spell remains lost and must be rememorized.
- The existing incantation and R225 Pool of Radiance-style casting cue now occur only when the scheduled casting completes and the spell actually resolves.
- Damage received before completion disrupts the pending spell, removes its future completion slot, and displays `<unit name>'s spell is disrupted!`.
- A failed saving throw while casting also disrupts the spell, matching the Player's Handbook casting rules.
- Casters remain stationary during the casting interval because their normal action is consumed/withheld until completion.
- Casters receive no beneficial Dexterity Armor Class adjustment while a spell is in progress.
- Existing spell targeting, LOS checks, spell VFX, persistent effects, Melf's Minute Meteors stored-volley controls, and spell-specific resolution functions remain unchanged and execute only at the scheduled completion slot.
- Added `AdventurePartyCastingTime` diagnostics for pending castings, initiative data, casting-state checks, and diagnostic interruption.

## R229 — Stored Minute Meteor CAST unlock

- Fixed the next-round state where Melf's Minute Meteors could leave CAST greyed out even though the caster still had stored meteors remaining.
- The root cause was the generic `spellCastInProgress` gate: melee attacks do not check it, while CAST does, which allowed attacks to work while CAST stayed disabled.
- Stored Minute Meteors are now treated as already-cast magic for later-round release and can clear only a stale generic spell-cast lock when no targeting action is active.
- CAST is explicitly re-enabled for a valid stored meteor remainder at the start of the caster's next usable round; no attack or other action is required first.
- Opening the Cast menu performs the same narrow stale-lock recovery as a second safety net.
- Added `AdventurePartyLevel3Spells.minuteMeteorCastGate()` diagnostics for stored count, current/last-volley round, active-unit identity, pending targeting state, and the generic spell-cast lock.

## R228 — Minute Meteor remainder recovery

- Fixed the stored Melf's Minute Meteors edge case where a positive remainder, especially exactly one meteor after the first volley, could survive in status state but fail to expose a usable release action on the following round.
- Any player-controlled caster with a positive stored meteor remainder now gets an explicit next-turn reminder to use Cast → Release Minute Meteor(s).
- The stored pool now clears any stale generic spell-cast lock at the start of the caster's next usable turn, without affecting unrelated spell resolution.
- The Cast menu rebuilds the Minute Meteor release action directly from the stored `minute-meteors` effect, so a one-meteor remainder is exposed even if normal memorized-spell menu contents have changed.
- The stored release action is singularized correctly for one remaining meteor and continues to support repeated target assignment when more than one remains.
- Added a same-round release guard so a stored volley cannot be released twice in one round.
- Added `AdventurePartyLevel3Spells.minuteMeteorRemainder()` diagnostics for stored count, last-volley round, release availability, targeting state, and spell-lock state.

## R227 — Player-directed Melf's Minute Meteors volleys

- Removed the R226 turn-start auto-fire behavior for stored Minute Meteors on normally player-controlled characters; the spell no longer takes over the character's turn.
- Casting Melf's Minute Meteors now creates the full stored meteor pool first, then enters player-controlled target assignment for the five-per-round discharge mode.
- The player assigns one target per meteor, up to five meteors per volley or the number remaining, whichever is lower.
- The same hostile creature can be selected repeatedly to assign multiple meteors to it; battlefield markers show the current per-target allocation.
- No meteors launch until the final required target is selected. The entire assigned volley then launches together with a shared simultaneous flight animation.
- Attack rolls are resolved per meteor at the spell's +2 attack bonus with no range penalty; damage is accumulated and applied after the shared flight so several meteors can legitimately be assigned to the same creature.
- Remaining stored meteors appear in the Cast menu as a deliberate **Release Minute Meteors** action on later turns instead of firing automatically.
- Canceling a stored-volley targeting sequence spends no meteors. Canceling target selection immediately after the initial casting retains the newly created pool while the original spell casting still consumes that turn.
- Automated Quick/NPC behavior retains the existing automated release path; this change specifically protects normal player control.
- Updated Melf's Minute Meteors spell text and `AdventurePartyLevel3Spells` diagnostics for the R227 targeting model.

## R226 — AD&D 2e third-level tactical wizard spells

- Added sixteen new combat-ready Level-3 Wizard spells to the shared spell catalog; Fireball remains on its established implementation.
- Added Blink, Dispel Magic, Flame Arrow, Gust of Wind, Haste, Hold Person, Hold Undead, Infravision, Invisibility 10' Radius, Lightning Bolt, Melf's Minute Meteors, Protection From Evil 10' Radius, Protection From Normal Missiles, Slow, Vampiric Touch, and Wind Wall.
- Added the reviewed pseudo-Latin incantations: `Saltus Aetheris!`, `Magiam Dissolve!`, `Sagitta Flammea!`, `Ventus Impelle!`, `Tempus Accelera!`, `Corpus Immobile!`, `Mortui Sistite!`, `Visus Nocturnus!`, `Velum Invisibile!`, `Fulmen Feri!`, `Meteora Minuta!`, `Circulus Contra Malum!`, `Tela Repelle!`, `Tempus Retarda!`, `Vita Exhauri!`, and `Murus Venti!`.
- Lightning Bolt uses the narrow 80-foot tactical line, 1d6/level damage to a 10d6 maximum, save for half, friendly fire, and AD&D-style rebound when a solid barrier prevents the bolt from completing its path.
- Haste doubles tactical movement and attack rate, applies the −2 initiative adjustment, and cancels Slow; Slow uses its −4 save penalty, halves movement/attack rate, applies −4 attacks and +4 AC, and cancels Haste on a failed save.
- Hold Person preserves the concentrated-target save penalties (−3 for one target, −1 for two); Hold Undead enforces the caster-level Hit Dice budget and automatic holding of mindless undead.
- Melf's Minute Meteors creates one meteor per caster level and uses the five-meteors-per-round AD&D discharge mode, carrying remaining meteors into later turns.
- Protection From Normal Missiles now negates ordinary longbow arrows and sling ammunition; Protection From Evil 10' Radius extends the established evil-attack/save modifiers as a mobile one-hex aura.
- Wind Wall is a persistent tactical barrier that deflects arrows, penalizes sling missiles, disperses overlapping fog/cloud cells, and prevents later gaseous effects from occupying its wall cells.
- Gust of Wind clears fog/cloud cells in its line and applies a one-round movement impediment based on creature size.
- Invisibility 10' Radius applies only to creatures inside the initial radius; leaving the radius ends that creature's veil, while a hostile action by the central recipient collapses the shared veil.
- Dispel Magic removes eligible unit, persistent-area, Hypnotic Pattern, and Wind Wall effects using the AD&D 2e level-adjusted dispel check; a caster's own magic is automatically dispelled.
- Vampiric Touch resolves as a melee spell-touch attack, ignores undead, drains 1d6 per two caster levels to a 6d6 maximum, and tracks vitality above normal maximum as temporary vampiric hit points.
- Added persistent and transient VFX for Wind Wall, Lightning Bolt, Gust of Wind, Haste, Slow, Hold, Infravision, Blink, missile protection, protection aura, and orbiting Minute Meteors.
- The R225 universal Pool of Radiance-style casting cue automatically applies to all newly committed R226 spells.
- Added `AdventurePartyLevel3Spells` diagnostics for the new spell registry, active Wind Walls, radius-invisibility cleanup, and mobility recomputation.

## R225 — Universal Pool of Radiance-style casting sound

- Added a temporary universal spell-casting sound based on the reconstructed Pool of Radiance DOS PC-speaker SFX program #07 found in the user's uploaded PC game files.
- The implementation does not ship an SSI sampled audio file; it reconstructs the selected PC-speaker waveform through the existing Web Audio pipeline from a compact 1-bit 11.025 kHz representation.
- Every successful spell commit now plays the shared Pool of Radiance-style casting cue, including spells without a verbal component such as Hypnotic Pattern.
- Failed spell commits, including Deafness-caused verbal miscasts or unavailable memorized spells, do not play the casting cue.
- Existing spell-specific impact, cloud, damage, status, and environmental sounds are unchanged and continue to layer after the shared casting sound.
- The casting sound obeys the existing global SND toggle and shared SFX gain.
- Added `AdventurePartyCastingSound` diagnostics for manual playback and source identification.


## R224 — Hypnotic Pattern persistent VFX

- Added a dedicated persistent battlefield visual for Hypnotic Pattern without changing its established gameplay resolution.
- Hypnotic Pattern now creates a presentation-only seven-hex visual registry instead of entering `game.areaEffects`, preventing the R212 last-cast area-ownership rules from displacing unrelated Web, Grease, fog, Darkness, or other gameplay areas.
- The spell renders as a floating prismatic air-volume with five slowly weaving ribbon loops, seven rotating luminous arc segments, a softly pulsing central hypnotic focus, and 32 drifting colored motes.
- Added a restrained ground shimmer beneath the spell so its tactical footprint remains readable without turning the effect into a flat ground decal.
- The airborne volume renders only from cells currently visible to the friendly party, so Hypnotic Pattern does not reveal hidden portions of the battlefield through walls, fog, Darkness, or other LOS blockers.
- Creatures that fail their save display separate head-level prismatic rings and rotating glints, clearly distinguishing the spell's area from the units actually fascinated by it.
- Damage still removes the affected creature's Hypnotic Pattern debuff and therefore removes that creature's entrancement marker immediately.
- The pattern remains visible for the same three-round tactical window used by the existing Hypnotic Pattern implementation, even if every creature succeeds on its save.
- The persistent status animation loop now remains active while Hypnotic Pattern visuals or fascinated creatures are present.
- AIM tile inspection now reports Hypnotic Pattern on affected tactical hexes with its control-effect rules, duration, and source caster when known.
- Hypnotic Pattern remains intentionally silent: no Latin incantation is assigned because its AD&D 2e components are S, M only.
- Added `AdventurePartyHypnoticPatternFx` diagnostics for active visuals, affected units, and presentation metrics.


## R223 — LOS-aware Stinking Cloud and AIM tile effects

- Stinking Cloud now uses two presentation opacity levels without changing its gameplay rules.
- Party-visible Stinking Cloud cells retain the R219/R221 low body opacity of 0.125 so visible units remain readable through the green cloud.
- Stinking Cloud cells outside current friendly-party LOS render at 0.50 opacity, restoring a much denser cloud only over hidden tactical space.
- Wall of Fog and Fog Cloud opacity are unchanged.
- Because friendly-party visibility is a union of living friendly observers, a party member standing inside Stinking Cloud keeps its own visible cell at the low opacity while unseen neighboring cloud cells remain dense.
- AIM mode now inspects the tactical hex itself instead of preserving stale unit information when the aimed hex is empty or contains a hidden enemy.
- Persistent area effects occupying the aimed hex are shown in the right-side information panel, including fog/cloud effects, Grease, Web, Darkness, Flaming Sphere, and radial illumination fields.
- AIM tile-effect cards include the effect name, tactical rule summary, remaining duration when available, and source creature when known.
- When a visible unit occupies the aimed hex, normal unit statistics/status effects remain intact and the hex coordinates, LOS state, and area-effect cards are appended beneath them.
- Hidden enemies remain hidden from AIM inspection; environmental effect information does not reveal an unseen creature.
- Added `AdventurePartyAimTileEffects` diagnostics for effect-at-hex inspection and Stinking Cloud opacity queries.
- Added the reviewed Latin incantation set to all implemented Level-2 Wizard spells with verbal components; Hypnotic Pattern remains intentionally silent because its components are S, M only.
- Level-2 incantations now include `Caecitas!`, `Imago Tremula!`, `Lux Perpetua!`, `Orbis Tenebrarum!`, `Nubes Foetida!`, `Rete Araneum!`, and the remainder of the approved set through the shared spell-incantation framework.
- Juvenile Red Dragon breath VFX now places the outer fast-moving flame lobes directly on the mathematical cone boundary, so roughly half of each edge lobe overlaps beyond the cone edge instead of being hard-clipped inside it.
- Dragon breath flame density is substantially increased: 72 longitudinal slices with 4–12 lobes per slice, a denser muzzle bridge, 32 smoke puffs, up to 520 grain samples, and 680 ember particles.


## R222 — Authoritative perception and radial Darkness

- Added one authoritative automated-combat perception query that combines invisibility/special vision, blindness, architecture, fog/clouds, magical Darkness, and multi-hex occupied footprints.
- MOB Intelligence and R220 target memory now consume that perception query, so Intelligence changes decisions made from known information but never grants hidden information.
- Automated melee attacks now require current visual acquisition of the target; a final defensive gate in the central attack resolver rejects any hidden live target accidentally handed to automated combat logic.
- MOB missile attacks likewise require current visual acquisition in addition to the existing projectile-lane rules.
- Free attacks now require the attacker to actually see the creature leaving the threatened hex, closing the adjacency-awareness leak inside fog/darkness.
- Player Guard reactions now require the guarding unit to see the entering enemy instead of triggering from physical adjacency alone.
- Hostile target enumeration now returns currently visible hostiles; R220 remembered-target pursuit remains separate and continues to use last-known positions.
- MOB weighted path planning no longer treats unseen hostile units as magically known occupancy obstacles. Allies and currently perceived enemies still block planned routes normally; physical movement execution still stops if a MOB actually attempts to enter an unseen occupied hex.
- Added a public `AdventurePartyPerception` diagnostic hook exposing current visibility and perception state.
- Reworked Darkness, 15' Radius presentation from black-filled tactical hexes into a soft radial projected volume with a ground penumbra, dense central sphere, feathered edge, and upper bloom.
- Darkness gameplay remains hex-authoritative for LOS, projectiles, illumination cancellation, AI hazard reasoning, and targeting; only its presentation is radial.
- The LOS blackout no longer paints Darkness's own visible cells as generic black hex tiles. The radial Darkness volume owns those cells visually while terrain beyond the Darkness remains obscured normally.
- Magical Light interaction remains authoritative through the existing effective-Darkness query; the rendered volume fades as more of its logical cells are negated by magical illumination.


## R221 — Kobold prone normalization and amorphous cloud tops

- Fixed Kobold-family prone rendering so Normal Kobolds, Body Guards, and Slingers all use the shared `kobold-prone` render profile instead of accidentally inheriting standing-pose dimensions.
- Hardened `drawKobold()` so the shared prone sprite always receives prone-specific size, anchor, and contact-shadow treatment even if pose metadata becomes stale.
- Kept the existing shared prone art and tactical prone-state rules unchanged; this is a render/presentation correction rather than a gameplay change.
- Reworked fog/cloud upper-body rendering to remove the rectangular per-hex column that produced visible corners and stacked-box silhouettes.
- Cloud bodies now use overlapping rounded cross-sections, animated billows, multi-lobed caps, and neighbor-to-neighbor bridge puffs so connected cells read as one amorphous cloud bank.
- The tactical bottom footprint remains hex-based and readable; Wall of Fog, Fog Cloud, and Stinking Cloud gameplay occupancy, LOS blocking, saving throws, and movement rules are unchanged.
- Rebuilt fog/cloud outlines from the same rounded geometry so the outline no longer reintroduces the old boxy top silhouette.
- Preserved the R219 Stinking Cloud body opacity of 0.125 and existing fog/cloud color treatment.


## R220 — Intelligence-based MOB hazard awareness

- Added a reusable MOB hazard-awareness system instead of spell-specific avoidance logic.
- Registered Grease, Web, Wall of Fog, Fog Cloud, Stinking Cloud, magical Darkness, and Flaming Sphere as tactical hazards with severity, recognition threshold, consequence type, and melee/ranged/caster role modifiers.
- MOB Intelligence now controls hazard recognition, memory, and avoidance strength using AD&D-style bands from instinctive through exceptional.
- Current Kobolds, Kobold Body Guards, Kobold Slingers, and Orcs use Intelligence 9 (Average); the Juvenile Red Dragon uses Intelligence 16 (Exceptional). Future monsters can provide a numeric Intelligence score or standard AD&D Intelligence label.
- Pathfinding for MOB melee pursuit, limited-turn advance, ranged firing-lane search, retreat, and fleeing now applies weighted hazard costs rather than treating hazards as universally impassable.
- Multi-hex MOBs evaluate the strongest known hazard under any occupied destination hex, so large creatures do not ignore hazards merely because their anchor/center hex is clear.
- Grease/Web/Stinking Cloud risk incorporates the creature's expected saving-throw vulnerability; Web also considers Strength-based escape ability, Stinking Cloud respects undead poison immunity while retaining LOS risk, and Flaming Sphere respects fire immunity.
- Ranged and caster roles strongly prefer routes that preserve line of sight around fog/cloud/darkness, while melee creatures are more willing to push through ordinary fog when the detour is expensive.
- Panic, Spook, and Taunt reduce hazard avoidance so urgent/compelled behavior can rationally accept dangerous routes.
- MOBs learn from personal exposure and from witnessing another creature suffer a persistent-area consequence; lower-Intelligence creatures therefore become more cautious after seeing or experiencing a hazard.
- Hazard knowledge is spatially honest: recognizing a spell does not reveal portions of its area hidden behind walls or other obscuration; only perceived/experienced cells receive path cost.
- A MOB that creates its own persistent hazard is granted authored knowledge of that effect's footprint, while other MOBs still need perception, recognition, or experience.
- Added per-MOB last-known target memory. MOBs update exact target position only while they have current LOS; once sight is lost they pursue the remembered position for an Intelligence-dependent number of rounds instead of tracking hidden movement perfectly.
- Obscuring area creation snapshots visible targets before LOS is cut so Wall of Fog/Fog Cloud/Stinking Cloud produce useful last-known-position behavior.
- Player movement updates MOB target memory before and after the step, preserving the last visible hex when the player disappears behind an obstruction.
- MOB melee attacks now require current sight of the target rather than exploiting an exact hidden coordinate. The Juvenile Red Dragon likewise only plans breath attacks against currently perceived party members.
- Added a public `AdventurePartyMobHazards` debug/introspection hook so future hazards can be registered and inspected without rewriting core MOB AI.


## R219 — Spell-effect focus, visible AI pacing, and Stinking Cloud transparency

- Camera focus now follows a unit when a spell effect resolves on that unit, including persistent-area saving throws, direct spell damage, sequential area-damage results, targeted buffs/debuffs, and shared magic-effect VFX.
- Multi-target magic-effect VFX retain overlapping animation but use a readable camera handoff as each target's effect begins.
- Automated unit movement now takes twice as long per step while the destination is visible to the friendly party.
- Heard-but-unseen movement keeps its prior timing, and fully unseen movement remains immediate so hidden movement does not leak tactical information.
- Visible automated escape movement also receives the doubled presentation beat before the unit leaves the battlefield.
- Stinking Cloud body opacity is now 0.125, which is 75% less opaque than the original 0.50 fog body opacity and 50% more transparent than R218's 0.25 setting.
- Wall of Fog and Fog Cloud remain at their existing opacity, and the green Stinking Cloud footprint outline remains unchanged.


## R218 — Stinking Cloud opacity and title MIDI disable

- Reduced Stinking Cloud's rendered body opacity by 50% relative to R217, from a 0.50 global cloud alpha to 0.25.
- Wall of Fog and Fog Cloud retain their existing opacity.
- Kept the established green Stinking Cloud outline at its current strength so the affected tactical footprint remains readable.
- Disabled the title MIDI-derived music sequencer for now.
- Preserved the shared Web Audio context, combat SFX, spell sounds, weather audio, and the global SND toggle.
- Existing screen-router calls to start/stop title music remain compatibility-safe no-ops so removing the MIDI player does not disturb navigation or audio unlock behavior.
- Attack presentation pacing now holds combat progression for the full one-second standard attack pose instead of allowing the next turn/camera recenter to begin after the shorter generic turn delay.
- Authored attack poses longer than one second, such as the Juvenile Red Dragon breath pose, retain their longer duration.


## R217 — Shared obscuring-volume line of sight

- Added one shared obscuring-volume LOS system for Wall of Fog, Fog Cloud, Stinking Cloud, and effective magical Darkness.
- Normal sight now traces from tactical hex center to tactical hex center through the same obstruction query used by targeting and projectile-lane checks.
- A creature standing inside dense fog/darkness can see its own tactical hex but cannot acquire a normal-vision target outside that hex, matching the few-feet visibility abstraction on the 10-foot tactical grid.
- From outside a cloud, entering any obscuring hex terminates LOS; creatures occupying the cloud are hidden from observers outside it, and terrain/units beyond the cloud remain under the LOS blackout.
- Fog presentation is explicitly separated from fog gameplay opacity: visible cloud volumes are repainted after the LOS mask so the fog itself remains visible even though sight does not continue through it.
- Generalized the LOS blackout to open battlefields when an obscuring volume is active. Open maps without fog/darkness remain visually unchanged.
- Enemy rendering now obeys party visibility behind fog on both indoor and outdoor battlefields; friendly party members remain represented for player awareness.
- Missile/projectile firing lanes and LOS-dependent spell targeting use the same obscuring-volume centerline rule.
- Preserved R215's center-based tactical visibility and R216's rendering-only exception for non-passable wall-bisected boundary hexes.


## R216 — Visible-side correction for wall-bisected hexes

- Fixed dark wedges appearing on the viewer-facing side of architectural walls after the R215 center-only LOS change.
- Normal playable tactical hexes remain strictly binary: the center determines whether the entire hex is visible or under the 70% blackout.
- Wall-bisected hexes are already non-passable architectural boundary cells, so their render mask now uses the continuous wall-blocked LOS polygon only inside that blocked cell.
- This presentation-only exception reveals the physically visible side of a wall boundary without revealing the obscured side.
- Gameplay LOS, targeting, hidden-unit detection, multi-hex visibility, and magical fog/cloud blocking remain governed by the R215 center-based rule.


## R215 — Hex-center line-of-sight visibility

- Reworked Wall Test LOS from a continuously revealed/feathered world-space cone into binary tactical-hex visibility.
- Architectural LOS is still generated as a continuous wall-blocked visibility polygon for each living friendly observer, but only the center point of a hex is tested against that polygon.
- If a hex center is visible, the entire hex is rendered fully visible; if the center is not visible, the entire hex remains under the 70% LOS blackout.
- Removed the former seven-point per-hex visibility sampling and the feathered LOS-mask bands, eliminating partial hex reveals around corners.
- Hex visibility, hidden-unit logic, friendly-fire warning visibility, and battlefield masking now use the same center-based rule.
- Multi-hex units become visible when the center of any occupied hex is visible to the party; once detected, the entity is rendered whole rather than clipped by the LOS boundary.
- Obscuring magical effects still block gameplay sight along the center-to-center hex path.
- Fog volumes use the same center-in-architectural-LOS test for foreground rendering while ignoring their own self-obscuration, allowing the visible face of a cloud to remain drawable.


## R214 — EB Garamond Bold UI typography

- Replaced the local Gold Box font dependency with EB Garamond Bold (700) as the project-wide UI typeface.
- Loads EB Garamond 700 through the Google Fonts web-font endpoint; no local OS font installation or project TTF is required.
- Updated the root UI font stack to EB Garamond with Georgia/Times serif fallbacks and set the interface to weight 700.
- Updated canvas-rendered combat messages, battlefield barks, scale-test labels, and other canvas text to use EB Garamond Bold as well as DOM/CSS UI.
- Replaced the launcher Gold Box local-font check with an EB Garamond web-font status check and serif fallback state.


## R213 — Stinking Cloud audio and continuous fog animation

- Added a dedicated procedural magical casting sound for Stinking Cloud.
- Creatures that fail a Stinking Cloud poison save now play a coughing/coughing/gagging reaction SFX alongside the Nauseated result.
- Updated the Nauseated result message to explicitly describe coughing and gagging.
- Added a dedicated requestAnimationFrame loop for active fog spell volumes so Wall of Fog, Fog Cloud, and Stinking Cloud continuously billow and drift even when the mouse is stationary and weather is Clear.
- When weather animation is active, the fog loop remains alive but lets the weather redraw cadence drive the shared battlefield render, avoiding duplicate full-canvas redraws.
- Fog animation automatically starts when a fog effect is created, stops when no animated fog remains, and can restart when the combat screen is redrawn.


## R212 — Persistent area spell interaction and saving-throw presentation

- Added a shared persistent-area interaction pipeline for Grease, Web, and Stinking Cloud.
- When one of those spells is cast over a creature, or a creature moves into any affected hex, the creature immediately makes the appropriate saving throw.
- Moving from one affected hex to another affected hex triggers a new saving throw on every movement step.
- Saving-throw notifications now show the save category, raw d20, modifiers, modified result, target number, and SUCCESS/FAILED result, and hold combat for one second.
- Failed saves produce a second one-second combat message describing the resulting condition: Prone from Grease, Webbed from Web, or Nauseated from Stinking Cloud.
- A failed persistent-area save halts the creature's remaining movement for that turn.
- Web and Grease no longer generate an extra save merely because a creature begins its turn standing still in the same affected hex.
- Stinking Cloud retains the R211 nausea recovery rule: an already-nauseated creature makes a fresh poison save at the start of each turn, recovering immediately on success and losing the turn on failure.
- Persistent area spells now use last-cast ownership per hex. Casting a new area spell over an older one removes only the overlapping hexes from the older spell; all non-overlapping hexes remain active.
- If replacement removes the Web from beneath a Webbed creature, the Webbed condition is cleared immediately.


## R211 — Stinking Cloud palette and recurring nausea saves

- Recolored Stinking Cloud from ordinary grey fog to a dedicated animated mixture of olive, moss, deep green, yellow-green, and pale sickly-green billows while preserving normal Wall of Fog/Fog Cloud colors.
- Stinking Cloud's nausea no longer lasts for a fixed 1d4+1 rounds after a failed save.
- A nauseated creature now makes a fresh saving throw vs. poison at the start of every affected turn; success removes Nauseated immediately and allows the creature to act, while failure costs that turn.
- Creatures currently inside Stinking Cloud that are not already nauseated still make the normal exposure save at the start of their turn.
- A creature already making its nausea recovery save does not make a second Stinking Cloud save during the same turn.


## R210 — Web duration balance cap

- Reduced Web's tactical duration to 1 round per caster level, with a maximum duration of 6 rounds.
- Web now expires after 1–6 rounds instead of using the original 2-turns-per-level duration in combat.
- The spell catalog, Spell Book duration text, runtime area-effect expiration, and combat cast message all use the same capped duration rule.
- Web's initial save vs. spell at −2, Strength-based escape progress, fire interaction, area footprint, and all other behavior remain unchanged.


## R209 — Level 1 incantations and Level 2 Wizard combat expansion

- Added the approved Latin-style spoken incantations for Level 1 Wizard spells that previously lacked them: Armor, Burning Hands, Charm Person, Chill Touch, Enlarge, Grease, Light, Protection From Evil, Shield, Shocking Grasp, Sleep, Spook, and Taunt.
- Implemented the approved AD&D 2nd Edition Level 2 Wizard combat spell set: Blindness, Blur, Continual Light, Darkness 15' Radius, Deafness, Detect Invisibility, Flaming Sphere, Fog Cloud, Glitterdust, Hypnotic Pattern, Invisibility, Melf's Acid Arrow, Mirror Image, Pyrotechnics, Ray of Enfeeblement, Scare, Spectral Hand, Stinking Cloud, Strength, Tasha's Uncontrollable Hideous Laughter, and Web.
- Integrated the new spells with the existing targeting, saving throw, status, illumination/LOS, area-effect, projectile, hidden-unit, damage-over-time, panic, and persistent VFX systems rather than introducing parallel combat paths.
- Invisibility breaks on offensive action and interacts with Detect Invisibility and Glitterdust; Mirror Image intercepts attacks; Blur tracks first/subsequent attacks by attacker; Deafness can interfere with verbal spellcasting.
- Continual Light and Darkness participate in battlefield illumination; Fog Cloud and Stinking Cloud use persistent fog-area behavior; Flaming Sphere and Web create persistent tactical hazards.
- Web supports restraint/escape behavior and fire removal; Melf's Acid Arrow applies continuing acid damage; Scare reuses the established panic/flee system; Spectral Hand extends touch-spell delivery.
- Knock and Wizard Lock remain intentionally deferred until functional doors are implemented.



## R208 — Charm Person and battle-side allegiance

- Added the Level 1 Wizard spell Charm Person to the spell catalog and combat casting system.
- Charm Person uses a 12-hex tactical range, one living humanoid target of Medium size or smaller, and a save vs. spell to negate.
- Current Kobolds, Kobold Body Guards, Kobold Slingers, and Orcs are explicitly classified as humanoids; the Juvenile Red Dragon is not eligible.
- On a failed save, the target changes to the caster's faction for the current battle while retaining its existing initiative slot, equipment, statistics, and MOB AI.
- Charmed creatures remain AI-controlled; they are never converted into player-controlled party members.
- MOB melee/ranged targeting now respects current faction, allowing a charmed creature to attack its former allies and allowing those former allies to target it in return.
- Player targeting, movement, Guard reactions, MOB Guard reactions, and Kobold morale counts now respect the temporary allegiance change.
- A successful charm clears stale Taunt and ordinary group-morale panic instructions so the converted AI does not immediately obey an obsolete enemy-side command.
- Added a persistent Charmed status with orbiting heart VFX and explicit "Charmed AI" / "Charmed — Friendly AI" unit-panel labels.
- Charm Person lasts for the battle; the target's original faction is restored automatically when combat finishes.
- Victory now occurs when no hostile combatants remain, including the case where surviving enemies have changed sides.
- R207 wall-illumination tuning and prior terrain/architecture behavior are otherwise unchanged.



## R207 — Softer wall illumination

- Reduced dynamic illumination painted onto visible architectural wall faces by 50% relative to R206.
- Wall-light occlusion, visible-face filtering, terrain/floor illumination, LOS, shadows, thresholds, and all other rendering remain unchanged.



## R206 — Wall-aligned thresholds, black indoor grid, and cap union outline

- Threshold depth now matches architectural wall thickness exactly, centered on the wall axis with no extra overhang.
- Converted the existing west-wall entrance into an authored vertical doorway opening on one continuous wall, preserving the same passable gap while allowing the shared threshold renderer to handle it.
- Doorway thresholds now render correctly for horizontal and vertical walls using the same tangent/normal geometry.
- Indoor tactical hex-border portions are now black; outdoor portions remain green.
- Added a dedicated two-pixel black outline around the union of all upward-facing wall-cap surfaces.
- Cap outlines use the combined wall-top mask, so connected wall tops read as one shape rather than receiving per-segment borders.
- Doorway gaps are respected by the cap union outline.
- R205 isometric floor tiling and R204 corrected wall-lighting behavior remain unchanged.



## R205 — Isometric stone-floor tiling and doorway thresholds

- Reprojected the PamNawi stone-floor repeating texture into the same axial/isometric surface basis used by the tactical battlefield instead of leaving the source tile screen-aligned.
- Reduced the stone-floor source scale from 35% to 17.5%, exactly halving the R204 repeat size.
- The transformed tile remains anchored to world origin, so camera movement does not cause texture swimming.
- Added a generic dark-grey threshold renderer for authored doorway gaps.
- Each threshold spans the complete doorway width and the full wall slab depth plus a small overlap, covering outdoor terrain that previously showed halfway through the open entrance.
- Thresholds are presentation-only and do not change doorway movement, LOS, light transmission, or projectile behavior.
- R204 wall-lighting correction and indoor grey/outdoor green hex-border behavior remain unchanged.



## R204 — Stone interior floor, indoor grid color, and visible-face wall lighting

- Added PamNawi's "Handpainted Stone Floor Texture" (CC BY 4.0) as the Wall Test building's indoor floor material.
- Added repository-level third-party attribution in `ATTRIBUTIONS.md` and linked it from the README.
- Uses the original PamNawi `StoneFloorTexture.png`, not the later Nicoto-corrected variant.
- The texture is scaled to 35% and tiled continuously in world space so it does not swim when the camera moves.
- Indoor portions of tactical hex borders are repainted grey; portions remaining over outdoor terrain stay green, including boundary hexes split by the building footprint.
- Added a camera-facing wall-surface test for dynamic illumination. Horizontal walls only show glow when the light source is on the visible face side; sources on the hidden/opposite side no longer brighten the visible wall face.
- East/west wall faces remain effectively edge-on and do not receive broad wall-face glow.
- R203 window centering and combat-log fixes remain unchanged.



## R203 — Centered windows and reliable newest-log visibility

- Window planes are now centered vertically on the wall face instead of sitting at two-thirds wall height.
- The window aperture and rendered frame/glass continue to share the same centered geometry.
- Combat log now reserves explicit bottom padding plus a small terminal spacer, so the newest event cannot sit flush against the lower viewport edge.
- Bottom pinning still occurs immediately and across two animation frames, with an additional delayed correction for late font/layout reflow.
- Existing R202 wall lighting, wall-cap, corner-seam, doorway, LOS, and projectile behavior is unchanged.



## R202 — Hard wall shadows and readable corners

- Added a second, conservative architectural light-occlusion pass. Every solid wall subsection now casts an extruded world-space shadow volume away from each point light, and that shadow is subtracted from the rendered light layer.
- This makes the solid wall surface authoritative even when a visibility ray lands exactly on a wall endpoint/corner and avoids the repeated light bleed seen through solid wall sections.
- Light-transmitting gaps still work geometrically: full doorway gaps and window-glass apertures are omitted from the light-blocking wall subsections, so only those openings can transmit illumination.
- Old-wood texture is now limited to vertical wall faces. Wall tops use the flat cap material again and no longer display the repeating wood-board texture.
- Added explicit two-pixel vertical seams at connected 90-degree wall joints. Straight wall runs remain seamless, while inside/building corners regain the vertical depth cue needed to distinguish the two meeting wall planes.
- R201 hex-aligned doorway/window placement and window projectile blocking remain unchanged.



## R201 — Exact wall light clipping and hex-aligned openings

- Replaced Wall Test illumination's per-hex wall clipping with a continuous world-space light visibility polygon built from the actual thick architectural wall faces.
- Dynamic light now stops at the near face of solid walls instead of allowing an illuminated hex to paint pixels past the wall.
- Doorway and window apertures are still honored by the light polygon: door gaps and glass transmit illumination, solid wall surface does not.
- Added explicit opening-to-hex anchoring. North, south, and east windows are centered on actual tactical hex centers rather than arbitrary percentages between centers.
- Rebuilt the south doorway as a literal one-hex-wide wall gap centered on hex (-3,5). Its edges land on that hex's left/right borders, so the doorway is visually open and fully passable like the west entrance.
- The south window is centered over adjacent hex (-2,5), preventing overlap with the widened doorway.
- Split architectural ray rules into vision, light, and projectile modes.
- Window glass passes vision and light but blocks physical missile fire. Longbows, slings, and ranged AI now require a clear projectile lane; doorways remain valid firing openings.
- Spell LOS behavior is unchanged in this revision and continues to use vision LOS.



## R200 — Directional wall light and true window planes

- Wall illumination now paints only the physical half-face oriented toward each light source; the opposite side of the same wall is no longer brightened by that source.
- The old-wood wall sprite is scaled across the wall's complete visible slab height and vertically aligned so the top of the supplied texture reaches the actual top of the wall.
- North/south windows now cut a complete rectangular aperture through the rendered wall before the window frame/glass is drawn.
- The window art is placed on the wall center plane rather than pasted onto a surface face.
- East/west window planes are treated as edge-on in the current projection: their face-on texture and rectangular cutout are suppressed visually, while their authored LOS/illumination aperture remains active.
- Pure white window pixels remain translucent glass; source alpha outside the authored frame is preserved.
- Doorways remain literal geometric wall gaps from R199.
- Combat event log layout now permits true internal scrolling, and new entries are re-pinned to the bottom after layout/paint so the newest event remains visible.


## R199 — Centered wider windows and geometric doorways

- Removed the R198 doorway texture from the runtime presentation. Doorways now use the earlier architectural treatment: a literal gap between wall segments.
- South doorway remains in the test building at its current location, but no doorway sprite or white-pixel texture mask is involved.
- Centered every test-building window on its wall placement; the south window moves from its R198 offset to the horizontal center.
- Increased window visual width by 50% while retaining the existing window height and 2/3-wall-height vertical center.
- Expanded the window LOS/illumination aperture from 24 world units to 36 world units, matching the requested 50% widening.
- Window lattice/frame is visual only. LOS and illumination do not trace individual panes or bars; they use one continuous clear aperture spanning the apparent glass opening width.
- Windows still block movement and physical volumetric propagation.
- Wall silhouette generation and wall rendering now use movement-solid subsegments so doorways are genuine gaps in both the visible wall body and the exterior outline.
- Wall caps and wall illumination also respect those geometric doorway gaps.
- R197 wall height, old-wood texture, exterior-only outline, and reduced wall-light intensity remain unchanged.

## R198 — Old-wood walls, windows, and doorway

- Added the user-supplied old wooden wall tile as the repeating material for the Wall Test building.
- Added the user-supplied window and doorway artwork without generative alteration; pure-white pixels are interpreted semantically at runtime.
- Window white panes are rendered as translucent glass and cut through the wall face so terrain/units remain visible behind them.
- Window glass allows LOS and illumination to pass, while still blocking movement and physical volumetric propagation.
- Doorway white space is fully open: movement, LOS, illumination, and volumetric effects can pass through it.
- Window visual placement is horizontally centered on its opening position and vertically centered at two-thirds of the 35 px wall height.
- Added one centered north-facing window, one centered east-facing window, one south-facing window, and one south doorway on the test building.
- The south doorway and south window are separated along the same wall so both can be inspected at once.
- Architectural wall blocking is now opening-aware through reusable wall subsegments, including the LOS blackout ray geometry.
- The existing west-side open entrance remains in place for regression comparison.
- Doorway-aware wall shadows leave the open passage unshadowed.
- R197's 2 px exterior-only building outline, 35 px wall height, solid wall cap, and reduced wall-light response remain intact.

## R197 — Clean architectural wall silhouette

- Reduced architectural wall height from 45 px to 35 px after visual review.
- Reduced dynamic wall illumination intensity by 50% while preserving source-facing behavior, distance falloff, source color, and wall occlusion.
- Removed all per-segment black base seams, end seams, and individual segment borders that produced internal lines at connected wall joints.
- Added a structure-level wall silhouette pass: all visible wall slabs are rasterized into one union mask, dilated by 2 px, and the original mask is subtracted.
- The resulting 2 px black outline appears only around the exterior of the combined wall shape, so joined segments read as one continuous stylized structure.
- Wall faces remain a solid unbanded masonry color and wall tops remain one flat solid cap color.
- The same exterior-only outline logic is used in both the primary battlefield pass and the post-LOS visible-wall repaint.
- Wall shadows automatically track the revised 35 px height.
- Movement, collision, LOS, volumetric blocking, and R195 illumination mechanics are unchanged.

## R196 — Taller illuminated architectural walls

- Increased architectural wall height from 30 px to 45 px, a 50% increase. Wall blocking mechanics are unchanged.
- Reworked wall rendering to remove the former per-height shade banding and use a solid masonry face color.
- Replaced the striped/highlighted wall top treatment with a single solid-color cap.
- Added a crisp 2 px black outline around each authored wall segment, including top, base, and vertical end seams.
- Wall cast shadows automatically lengthen with the new 45 px wall height.
- Integrated R195 dynamic illumination into wall rendering.
- A nearby light source brightens a wall surface only when the source has a meaningful component toward that wall face.
- Light intensity on walls uses source radius, radial distance falloff, and wall-face alignment.
- Other architectural walls can occlude a light source before it reaches a wall surface, preventing light from passing through intervening masonry.
- Long wall segments receive localized radial illumination near the source instead of uniformly brightening end-to-end.
- Wall top caps remain solid and are not dynamically banded by the wall-lighting pass for easier visual inspection.

## R195 — Illumination system and Light spell VFX

- Introduced a reusable battlefield illumination mechanic separate from line of sight.
- Added ambient illumination queries for outdoor and indoor/wall-test battlefields plus reusable dynamic illumination sources.
- Added moving unit-attached light sources and static area-light sources, with additive stacking and radial distance falloff.
- Dynamic illumination respects architectural LOS blockers, so magical light does not bleed through solid walls.
- Added shared queries for dynamic illumination, total illumination, and whether a hex counts as illuminated for future darkness/infravision/AI rules.
- The 1st-level Wizard spell Light now creates an actual 20-foot-radius illumination source for its full duration.
- Friendly Light targets carry the light source with them and visibly illuminate surrounding terrain.
- Hostile targets that fail their save are both blinded and illuminated; the light follows the affected creature.
- Hostile targets that save cause Light to form as a static source immediately behind them, preserving the existing spell behavior while still illuminating terrain.
- Added a persistent pale yellow-white unit aura with soft radial glow, restrained rays, and orbiting motes.
- Terrain uses aligned radial gradients clipped to reachable hexes, producing a continuous-looking pool of light rather than independent bright hex fills.
- The first illumination pass does not alter party LOS/detection yet; illumination and visibility are deliberately separate systems for later refinement.
- Existing Light blindness penalties and duration remain unchanged.

## R194 — Shield spell visual effect

- Added a persistent translucent magical Shield VFX for the 1st-level Wizard spell Shield.
- The barrier is drawn slightly forward of the affected unit and follows the unit's live six-direction tactical facing every frame.
- Shield VFX remains visible for the entire spell duration and disappears automatically when the buff expires.
- Added a pale blue-white translucent pane, brighter rim glow, subtle pulse, inner curvature highlight, and traveling glint.
- The barrier scales visually with Enlarge so it stays proportionate to an enlarged unit, while neither spell changes the unit's tactical footprint.
- Shield joins the shared persistent-status animation loop so its shimmer continues even while the battlefield is otherwise idle.
- Existing Shield mechanics are unchanged: frontal Magic Missile negation, AC 3 vs arrows/bolts/bullets, AC 4 vs other attacks, +1 applicable saves, and 5 rounds/level duration.

## R193 — Enlarge visual transformation

- Added full visual presentation for the already-implemented 1st-level Wizard spell Enlarge.
- The affected unit sprite grows from its current size to the spell's final size over exactly 1 second.
- Enlarge changes sprite render size only; occupied hexes, collision, pathfinding, melee reach, targeting footprint, and multi-hex occupancy remain unchanged.
- The growing unit uses the same white silhouette-glow treatment as the casting effect during the entire transformation.
- Added a synthesized one-second rising "growing" SFX synchronized to the enlargement.
- When Enlarge expires, the spell effect is removed normally but a retained transient visual interpolates the unit sprite back to normal size over 1 second.
- Expiration uses the same white glow in reverse and a matching descending "shrinking" SFX.
- HP bars move upward with the enlarged presentation so they remain above the scaled sprite.
- Existing Enlarge rules remain intact: 10% size increase per caster level, 5 rounds/level duration, hostile save to negate, unchanged HP/AC/attack rolls, and proportional weapon base-damage scaling.

## R192 — Tighter conical dragon breath

- Rebuilt the dragon-breath visual body as a true geometric cone from the attack-sprite muzzle instead of filling the tactical breath cells.
- Gameplay targeting still uses the same wall-aware breath cells; only the presentation geometry changed.
- Replaced the large R191 circles with much smaller overlapping flame lobes distributed continuously along 52 cone slices.
- The visual cone now widens gradually with distance instead of jumping from one tactical lane to three, removing the hex-fill appearance.
- Added a narrow independent white-hot center stream so the brightest flame stays on the cone axis.
- Smoke, grain, and embers now sample the mathematical cone rather than individual hex cells.
- Retained the R191 near-white palette, additive bloom, distal smoke, dragon attack pose, SFX, damage, saves, recharge, and multi-hex hover behavior.

## R191 — White-hot dragon breath

- Retuned the Juvenile Red Dragon breath toward the supplied bright fire-jet reference while preserving the pixel/tactical presentation.
- Increased flame sampling from 9 to 13 lobes per tactical breath cell and reduced positional jitter so the effect reads as one continuous projected jet.
- Shifted the heat palette toward pale yellow and near-white, enlarged the hot inner core, and made the main flame body nearly opaque.
- Added an additive blurred bloom pass plus a final hot additive pass so the breath reads as self-luminous rather than simply orange/yellow.
- Added dark gray smoke concentrated in the final third of the cone, leaving the mouth and near field clean and bright.
- Increased flame grain density and ember count while slightly reducing ember opacity so the jet itself remains the dominant visual.
- Breath mechanics, damage, saving throws, recharge, wall interaction, targeting cells, SFX, dragon poses, and multi-hex hover behavior are unchanged.

## R190 — Dedicated Red Dragon standing and attack poses

- Replaced the prior juvenile Red Dragon art with the user-supplied standing sprite.
- Added the user-supplied attacking sprite as a true action pose for breath attacks and the claw/claw/bite routine.
- Removed the source-image background programmatically while preserving the original pixel artwork; no generative image editing was used.
- Measured the user's seven-hex placement reference instead of estimating scale: the new dragon renders at 89 px wide, 104 px tall standing / 107 px tall attacking, with its bottom anchor 41 px below the footprint centroid and a 3 px facing-aware lateral bias.
- The new source art faces left natively, so engine mirroring now uses left as the canonical dragon facing.
- Dragon breath VFX now originates from a muzzle position measured against the attacking sprite.
- R189 full-footprint hover behavior and dense Fireball-style breath rendering remain unchanged.

## R189 — Multi-hex hover and denser dragon breath

- Hovering any visible multi-hex MOB now highlights every hex in its occupied footprint instead of only the single hex beneath the pointer.
- Wall/LOS visibility safeguards remain intact so hover highlighting does not reveal hidden hostile footprints.
- Dragon breath density is substantially increased: nine overlapping lobe samples per tactical breath cell, larger overlapping flame volumes, reduced jitter, broader hot-core fills, heavier grain, and more than twice the ember particle count.
- Breath weapon rules and affected tactical cells are unchanged.

## R188 — Dragon placement and Fireball-style breath VFX

- Retuned the Juvenile Red Dragon sprite to match the user-supplied seven-hex scale/placement template: approximately two hexes wide with its feet planted inside the lower half of the occupied footprint.
- Rebuilt the dragon breath renderer using the current Fireball construction method: one combined offscreen flame body, overlapping volumetric lobes, outside-only 2-pixel black silhouette, 75% translucent body, grain, and dense ember particles.
- Breath VFX now begins at an estimated mouth position derived from the same sprite anchor used for the battlefield dragon render, preventing the flame from appearing detached from the creature.
- Breath weapon rules, affected tactical cells, damage, saving throws, recharge timing, SFX, and wall interaction are unchanged.

## R187 — Juvenile Red Dragon multi-hex test

- Replaced the temporary Orc-backed 7-hex test MOB with a dedicated transparent juvenile red dragon sprite.
- Implemented the AD&D 2e juvenile red dragon combat profile for the test: 15 HD, AC -3, THAC0 7, movement 9, Fanatic morale, fire immunity, and 12,000 XP.
- Added the full claw/claw/bite routine with the juvenile +4 physical-damage combat modifier.
- Added a 90-foot cone of fire breath weapon at 8d10+4, save vs. breath for half, usable once every three rounds.
- Added wall-aware multi-hex breath targeting, procedural animated flame-cone VFX, and synthesized WebAudio breath SFX.
- Fireball now respects creature fire immunity.

## R159 — Grease VFX/SFX

- Grease now renders as a persistent animated glossy oil slick with an irregular puddle silhouette, moving specular streaks, and subtle oil-sheen colors.
- Casting Grease produces a short target-hex splash ring and viscous droplet burst.
- Added a synthesized wet magical splat / oily shimmer sound through the shared WebAudio SFX engine.
- Grease mechanics, saving throws, duration, and affected hex remain unchanged.

## R158 — Initial Git baseline

- Color Spray incantation set to **Coloris Aspersio**.
- Universal spellcasting glow remains active for every successfully committed spell.
- Current standalone development build promoted to the repository baseline.

## Recent pre-Git milestones

### R157
- Reduced Wall of Fog exterior outline thickness.
- Added a single exterior black outline around the complete Color Spray effect.

### R156
- Casting glow moved to the central spell-commit path so every successfully cast spell receives it, including spells without incantations.

### R155
- Mouse wheel rotates Wall of Fog orientation in 60° steps during targeting.
- Live area preview reflects the selected orientation.

### R154
- Corrected Wall of Fog versus architectural-wall depth ordering.

### R153
- Wall of Fog stopped using conserved-volume flood filling.
- Fog wall now terminates at map edges and solid obstacles.

### R152
- Added AD&D 2e-style confined-space Fireball volume behavior.
- Indoor Fireball uses a larger confined-space volume budget and converts remaining indoor volume to reduced outdoor spread when escaping through openings.

### R151
- Wall of Fog incantation set to **Murus Nebula!**
- Added animated fog and a single exterior outline.

### R150
- Added reusable architecture-aware volumetric propagation foundation.
- Wall of Fog later diverged from this behavior in R153.

### R149
- Casting glow changed to white and reduced in opacity.

### R148
- Color Spray simplified into seven broad solid rainbow arcs.

### R147
- Casting glow changed to a one-second 0% → peak → 0% opacity envelope with distance falloff and no particles.

### R144
- Large particle-density pass for Fireball and fire-hit effects.

### R143
- Corrected Fireball transparency so underlying terrain remains visible through the flames.

### R141
- Fireball changed to one exterior outline around the full effect rather than per-lobe outlines.

### R137
- Corrected sprite/wall clipping.
- Added spellcaster LOS repositioning.
- Added Listen/Hear Noise handling for off-LOS hostile movement.

## Older history

Earlier numbered releases established the core combat engine, sprites, morale, initiative, ranged AI, spells, status effects, architectural Wall Test, LOS rendering, launcher, character UI, and other foundational systems.

From this point forward, **Git commits and tags are the authoritative version history**.
