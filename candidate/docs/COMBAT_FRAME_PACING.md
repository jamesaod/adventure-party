# Combat frame pacing — Candidate Rev 249

Combat and the Spell Previewer share one 30 FPS presentation scheduler in
`js/combat-frame-scheduler.mjs`. Calling `draw()` invalidates the battlefield;
it no longer redraws the world synchronously. Weather, fog, casting/status
effects, floating text, Magic Missile impacts, grease and the Previewer request
ticks from that same scheduler. The combat-log layout pin still uses browser
animation frames because it performs DOM layout, not battlefield rendering.
A stopped Previewer clears its effects once, then stops its continuous tick;
Play or a new spell selection restarts it.

Each presentation tick updates its registered producers, renders the world once,
then releases animation waiters. Repeated requests coalesce. The scheduler keeps
the target phase across non-divisible display refresh rates and discards backlog
after a long stall. A slow machine can deliver fewer than 30 FPS; this is a target,
not a hardware performance guarantee. Hidden pages retain pending work without
running a busy animation loop and resume with one fresh frame.

## Half-speed visual playback

`combatEffectDuration()` doubles finite visual durations. Physical arrows and
sling stones, magical projectiles, Magic Missile volleys/impacts, meteors,
lightning, Shocking Grasp, Fireball, Color Spray, Gust of Wind, dragon breath,
application effects, casting glows, fire reactions and Enlarge transitions use
the shared rate. Combat initiative, casting initiative slots, movement delays,
round-based spell durations, dice and resource costs retain their rules timing.
Existing audio remains at its normal pitch and duration, with attack/impact
events following the production resolver's ordering.

Finite animations await actual presentation frames before clearing their visual
state or advancing the impact sequence. Motion uses elapsed time, not frame
counts. Fireball/dragon-breath geometry no longer advances in 58 ms steps, and
Color Spray no longer quantizes growth/fade to 38 ms steps. Procedural noise may
still use frame seeds; it does not quantize movement. Effect ownership checks
prevent a stopped old volley from clearing a newer Previewer animation.

The Previewer uses the same production effects and duration helper. Its labels
are drawn inside the shared presentation pass, rather than immediately after an
asynchronous invalidation request. Startup awaits the first presented frame
before removing the loading overlay.

## Profiling and limits

The battlefield's `data-frame-stats` attribute exposes target FPS, request and
render counts, coalesced requests, elapsed time, recent active presentation FPS,
and average/recent/max render cost. Idle gaps are excluded from recent FPS.
These are developer diagnostics, not a new player control.

A frozen Rev 248 looping Magic Missile preview in the development browser made
2,569 complete world draws in 18.620 seconds (about 138 draws/second). That is
redundant work, not 138 distinct display frames. Its mean world-draw cost was
2.612 ms. This sample is specific to this browser, viewport and simple arena;
it does not establish performance on a large authored map or another GPU.
The paced Magic Missile sample produced 3,054 presentations in 101.792 seconds
(30.00 per second), with a 2.855 ms mean world-render cost. The principal benefit
is avoiding redundant complete-world draws, not making each draw much cheaper.

This batch consolidates presentation and smooths visual sampling. CPU lighting,
LOS, daylight transport, GPU surface shaders and Canvas/GPU compositing remain
the renderer described in [Combat WebGL](COMBAT_WEBGL.md). GPU lighting and shadow
changes are a separate next step. Use render-cost diagnostics on the affected
map before choosing those optimizations.

## Validation

`scripts/test-combat-frame-pacing.mjs` exercises simulated 54/60/144 Hz displays,
duplicate requests, update/render order, completion waiters, hidden/resumed work,
cancellation, stalls and timestamp jitter. It runs production physical missile
and explosion functions with a simulated display clock to verify double visual
duration, terminal frames, cleanup and cancellation ownership. Both base and
active dragon-breath implementations must use continuous geometry sampling.

The existing full validation suite remains required. Browser QA covers the
looping Previewer, Stop/reset/spell changes, physical missiles, Fireball, lightning,
Magic Missile, map rotation, standalone test maps and an exploration encounter.
