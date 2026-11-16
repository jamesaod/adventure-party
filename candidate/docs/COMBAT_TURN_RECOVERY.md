# Intermittent post-death initiative recovery

November 7, 2026: the reported live battle remained at AWAITING INITIATIVE after a death, without a visible console exception. The precise live trigger has not been reproduced.

The existing death-result protection catches presentation exceptions. It did not protect the subsequent shared aiTimer handoff. Turn handoffs now retain a separate recovery timer and ownership by game object, round and initiative index. If the normal callback is lost, the recovery callback resumes the unchanged idle slot two seconds after its scheduled deadline. Result holds are reevaluated normally. Active actors, ended/replaced battles and intentional preview pauses are never restarted. Overlapping callbacks cannot claim the same handoff twice.

Recovery logs `Recovered idle combat initiative` and records `game.turnRecovery` with round/index/reason. This is a targeted fail-safe, not evidence that the exact reported live failure has been identified. If the issue persists, inspect active actor, order/index, presentation hold and queued-result state before expanding recovery to additional states.

Regression: `node scripts/test-combat-turn-recovery.mjs` runs 200 post-death handoffs, deliberately removes 100 timers, checks death holds, dead-slot skipping, exactly-once starts, replacement battles and preview pause. Existing turn-flow, death-scene and beat recovery tests remain separate.
