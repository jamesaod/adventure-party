# Meshy boulders and giant pickup proof — 19 November 2026

Local test: http://127.0.0.1:8276/boulder-pickup-test.html

Five user-supplied Meshy FBX exports were converted without polygon decimation. Runtime GLBs retain complete stones, including the buried underside. The longest source extent is normalized to one metre, +Y up, with the pivot centered in X/Z at the base. Instance scale is 1.35 in the proof. Base color, roughness and normal maps are embedded at 1024px; stone metallic is zero. Source ZIPs and full-resolution files remain unchanged in Downloads and the authoring workspace work/boulders/source. Runtime manifest stores dimensions, triangle counts, hashes and source filenames.

| Asset | Triangles |
|---|---:|
| mossy-boulder-1 | 3128 |
| mossy-boulder-2 | 3129 |
| mossy-boulder-3 | 2990 |
| mossy-boulder-4 | 3132 |
| mossy-boulder-5 | 3129 |

## Scope and operation
This is an isolated repository test map, not production combat integration. Select a rock, Pick up, then Throw. Reset restores all five rocks, holes and water. Orbit/zoom to inspect. The throw release slider is a test control, initially 65%; do not treat this as approved authored timing.

- Existing Hill Giant Workshop model and physical scale, UAL1 PickUp_Kneeling and the supplied Goalie Throw source are retargeted through the existing world-bind-delta workflow. Root travel is removed. The giant is positioned at the selected rock's pickup contact; there is no approach/pathfinding animation yet.
- One stable rock record/model passes through ground, held, flight and ground states. Right-hand following uses world transforms; release captures the hand position. Ballistic presentation lands at the target over 1.5 seconds with a 2.5m arc. This is prescribed flight, not rigid-body physics or collision damage.
- Initial burial is 0.15m. Pickup creates a persistent shallow elliptical depression based on the boulder's measured X/Z dimensions. Ground vertices displace, exposed soil uses the existing dirt texture, and grass instances are suppressed inside the footprint. The footprint is an approximation, not an exact rock-surface imprint.
- Every hole reads the same CombatWetBasins saturation/reservoir as combat. No per-hole hydrology. Already saturated ground exposes a puddle immediately. The test defaults to 20x weather time and has a saturation setup button. Water uses a lightweight test material; combat's complete puddle/rain/splash renderer is not yet connected.
- Pure boulderBlocks defines ground obstruction and removes it while held/in flight. The lab displays this state; production navigation is unchanged. Re-picking an unburied landed rock does not duplicate the original hole.
- All large-wood and giant combat behavior remain unchanged. Production map authoring/placement, AI selection, action costs, attack/damage resolution, exact collision-aware flight, snow, and save/load remain future integration work following user visual approval.

## Reproduction and checks
Converter: tools/boulder-production/convert.py. It expects numbered source/1 through source/5 extraction folders alongside it and writes out/*.glb plus manifest.json. Original authoring run is work/boulders/convert.py in the shared workspace; do not overwrite the original ZIPs.

State regression: node scripts/test-combat-boulder-proof.mjs covers stable identity, single lift, persistent hole, dry/saturated water, flight/landing and obstacle semantics. Headless Chrome exercises actual loading and pickup/throw/landing. User visual acceptance of grip, animation and ground appearance is still pending. No push/publication.

Profile polish: each asset now samples its actual underside at 65x65 on load. Ground depression and still water use the same depth field; a ragged soil margin blends with grass. A bounded 1,000-particle dirt/dust pool sheds during pickup and throw, falls under gravity and fades on the ground. No water ripple animation. This remains the isolated proof; production combat integration is not enabled.

Pickup polish: pickup clip runs at 0.5 speed; shared wetness darkens exposed soil and lowers its roughness for muddy rain response. Dirt/dust emit throughout lifting. At the held pose, emission and existing particles taper out within 0.5 real seconds. Throw shedding remains a separate effect.

Grip alignment: sample the retargeted right hand path for its lowest point. Ease root yaw from the initial facing to rock alignment by that point. Pickup timeline slider sets full grip at 20–95% of the clip; a 0.6 clip-second (1.2 real-second at half speed) blend moves and rotates the rock continuously into the exact hand centre. Initial staging still positions the giant within reach; no approach locomotion is implemented.
Pickup freeze fix: sampling the end of a clamped LoopOnce clip pauses its AnimationAction. Explicitly clear paused and restore enabled before each mixer seek, so alignment probing cannot freeze subsequent pickup playback.

Palm grip trial: derive palm centre/frame from right-hand knuckles, orient each rock underside toward the palm and offset its centre by half its height plus clearance. Apply a modest finger curl over the animation while attached; preserve held orientation into flight. This is a procedural starting fit and requires visual approval for the five shapes.

Rolling impact trial: bounded decelerating roll, distance-driven rotation with world bounds ground support, dense contact dirt/dust, persistent capsule rut with grass removal. Rut and pickup holes share wetness/water. Terrain updates at 5 Hz during rolling and once at rest; particle pool remains capped at 1,000. This is an isolated presentation approximation, not rigid-body collision against units or other rocks.

Stable rest: after rolling, minimise rock-centre support height against actual mesh vertices, then blend into that local resting orientation over 1.1 seconds. Seat against sampled terrain under the rotated vertices throughout settling. Uses the centred mesh as a mass-centre approximation; no full rigid-body solver.
User-approved throw release default: 43% of the clip. Throw animation now runs at half speed, matching pickup; projectile flight timing remains unchanged.

Ground-hit VFX: reuse createGiantImpactDust (16 depth-clipped ray-marched brown volumes, 3-second lifetime) at boulder impact. Add a 420-particle contact burst biased toward small dirt flecks, with wider outward velocities. Shared lab particle pool capped at 1,600; volumetric depth pass only while clouds are alive. Production dust module unchanged.
