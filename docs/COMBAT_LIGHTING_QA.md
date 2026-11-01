# Candidate Rev 241 — combat visibility QA

- Friendly observers remain the visibility union and distance-fade anchor during every turn. Enemy light sources still move normally; enemy initiative never supplies a viewpoint.
- The distance layer retains the seven-hex start, ten percent steps and twenty percent minimum. Painted ambient and real light sources offset distance darkness.
- Floor overlays intersect each tactical hex with actual authored floor polygons. Samples lie on their floor portion rather than in a wall/void at the hex center. Static fragments use a spatial index and cache; projected fragments and emitter lists are shared within a frame.
- Torch and spell floor overlays clip against the continuous production light-visibility polygon, so a shadow can split a hex. Wall, window and closed-door light blocking remain authoritative.
- Solid wall/door faces receive separate lighting fragments at tactical hex boundaries, including caps. Brick texture coordinates and physical wall geometry stay continuous. Static exposure is baked once; fade, flicker and spell radiance modulate cached surfaces.
- Unit/wall ordering uses the wall depth at the unit foot position, correcting long diagonal back walls that covered heads. Foreground walls still conceal units behind them. Six camera angles are covered by regression tests.
- Spell surface emitters follow the existing Fireball projectile/explosion, Flame/Acid Arrow, casting/fire/status glows, Color Spray, fire breath, Lightning Bolt including reflection paths, Shocking Grasp, current Magic Missile volley/impacts, Flaming Sphere and Hypnotic Pattern records. Existing moving Minute Meteor sources feed the same surface shading. Burning Hands supplies a short warm surface flash before its existing resolution.
- These additional emitters are presentation data. They do not become tactical Light effects or cancel Darkness. Surface radiance remains additive above painted ambient and expires with its effect.

Validation: `test-combat-surface-lighting.mjs`, `test-combat-view-environments.mjs`, `test-exploration-rendering.mjs`, and the full Adventure Party Validation workflow. Private exported maps and browser fixtures remain outside the commit in `work/`.

## Candidate Rev 242 — solid unseen walls and combat torch clearance

Unseen wall/door prisms retain opaque coverage and receive 90% color darkening in a cached presentation. The old 10% alpha compositing allowed underlying floor grid lines to appear through rear wall surfaces. Room visibility masking stays independent.

Combat-only torch emitters sit 0.3048 metres (12 inches) in front of the rendered prism face, accounting for its thickness. Physical floor/wall exposure, glow, shadow origin, distance relief and flicker queries share that unsnapped world position. Flame/sconce artwork and exploration lighting retain their existing placement. The former nearest floor hex is retained only for sconce visibility, never as a light origin.

## Candidate Rev 243 — visible wall lighting joins

Broad wall/door faces compose their static exposure and dynamic fade/flicker/spell light using a single affine light strip per face. Per-hex samples retain their geometry, but integer strip runs cover every texel exactly once. This removes the bright seams caused by adjacent antialiased fragment clips restoring/darkening the same texture at fractional coverage. Material texture coordinates remain continuous; physical wall outlines and cap geometry remain unchanged. One scratch strip is reused across faces and frames.

## Candidate Rev 244 — sprite shading experiment

Pre-rendered unit images now receive a brightness filter from their hex ground exposure, friendly-anchored distance fade and spell radiance. Brightness caps at the original artwork brightness. Ordinary combat uses its existing hex illumination query. Mirror images share the body filter; HP bars, selection markers, casting glows and the separate terrain-shadow pass remain unaffected. Original PNGs, pose/frame caches and sprite alpha are preserved. This is presentation-only and changes no detection or targeting rules.
