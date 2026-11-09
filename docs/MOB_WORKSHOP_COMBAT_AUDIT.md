# Workshop to combat audit — 2026-11-09

## Current result

The basic Workshop publishing and direct-model combat path is now implemented locally. It uses the existing combat engine, not a parallel battle loop. Advanced creature rules remain incomplete and publication rejects unsupported capabilities rather than silently discarding them.

## Connected

- Portable ZIP publication: `node scripts/publish-workshop-unit.mjs <project.zip> <stable-unit-id>`. Validates first, preserves source project, writes a versioned package and content-hashed GLB, then registers the catalog entry last. Published Workshop models do not depend on browser authoring cache.
- Repository selection and independent combat instances: authored stats, HP policy, saves, inventory quantities, ammunition, hand locations and descriptive data pass through one conversion contract. Classes are recorded; authored statistics are not automatically recalculated from class levels.
- Direct models and authored animation clips: frozen Idle, Move, action ranges/speeds, 1H Swing fallback and random death variants. Windup and attack share the same clip clock. Root travel is removed without removing limb motion.
- Item-specific weapon/shield fits and hand corrections reach the runtime equipment mounts. Back remains inventory storage, not a visible fitted socket.
- Body rendering, live shadow and hidden outline use the same Workshop animation sampler.
- Default generic combat AI is supported. Custom authored behavior policies are rejected pending handlers.

## Verification

Ten Workshop tests passed during this pass, including publication, package validation, instance isolation, equipment fit serialization, hand calibration, animation timing and grounding. Publication, grounding and conversion-contract tests were rerun successfully at the end; classic combat script syntax passed.

Internal-browser fixture test loaded the actual orc GLB, sword and shield through production appearance preparation and checked animation samples and cache reuse. A subsequent real Combat Test selected that repository Workshop fixture, moved into engagement, displayed physical/fire damage and death, then reached `VICTORY — PRESS SPACE TO END` in round 2 with no pending action pause. The fixture uses synthetic clip tracks: this proves the connection, not visual quality of a finished authored animation set. A previous attack stall did not recur in the fresh run; its cause is not established. Temporary fixture catalog registration was removed after validation.

## Remaining work / limitations

- Natural attack routines, learned/innate spells and use accounting, special traits, magic resistance, special movement and multi-hex footprints still need runtime handlers. These are release gates, not completed connections.
- Right-hand shields and unsupported left-hand weapon mount types are rejected.
- A finished user-authored project still needs visual acceptance, including equipment changes, casting, multiple death variants and shadow/outline animation. No such project was available; the controlled fixture avoids making that a development blocker.
- Manual AC interaction with downstream equipment recalculation and legacy browser-local save/restore of Workshop units require additional coverage.
- No repository push or deployment was performed.

## Architecture rule

Add capability handlers at the conversion/runtime boundary and test their actual combat consumers before advertising support. Keep inventory authoritative, rendering separate from combat rules, and unsupported features visible in Review. Do not replace these gates with blanket readiness flags.
