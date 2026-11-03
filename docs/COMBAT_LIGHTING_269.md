# Combat lighting, Candidate Rev 269

Rev 268 was a failed test. Its entire change set is reverted, including the 25%-ambient-outside-LOS rule and corner precision changes. Rev 267 is the baseline. Sealed regions remain opaque black; ordinary unseen terrain uses the Rev267 presentation.

## Armor investigation

The shared chainmail entry already has base AC 5. Two reproducible resolution gaps are fixed: an inventory record carrying only catalogItemId (chain-mail) previously missed the engine catalog, and a null saved baseArmorClass erased the valid catalog AC. resolveArmorItem accepts both IDs and nested rules, falls back past invalid values, and preserves finite explicit variant AC. An equipped shield variant now retains its own bonus. Combat AC and the equipment breakdown use the same resolver. Armor 5 plus an ordinary shield is AC 4 before Dexterity and other adjustments. This does not retroactively rewrite authored enchanted items or guess that every unusual AC is invalid.

## Independent wall light UVs

wall-lightmap.mjs assigns padded UV islands independently of artwork UVs, including wall faces, curved chords, caps and ends. Each existing tactical fragment retains its own exposure, preserving the hex-based appearance. Gutter pixels repeat island colors; brick/wood artwork still repeats at its physical scale. One atlas pair is shared by all faces of a wall and is cached with the existing transport key. Visibility, torch flicker, spell emission and GPU shadow correction remain separate.

This is a runtime cached reference-exposure lightmap, not an offline global-illumination/AO bake. Ambient/daylight and physical lamp exposure still come from the CPU reference evaluator. Moving the lantern or changing doors invalidates that exposure as before. A later finer ambient/AO bake can reuse the independent channel.

## Dynamic depth shadows

combat-shadow-maps.mjs renders actual wall/aperture and door-leaf proxy triangles into 256px RGBA depth cubemaps using the existing WebGL2 renderer. Drawing and shadow casting reuse explorationWallSolids and combatDoorSolids. Each point light needs six depth faces; at most two lights receive this pass: the party lantern and the strongest active spell. Fixed sconces retain existing CPU visibility silhouettes. Other illumination is retained; frames above the 32-emitter compatibility budget use the complete CPU fallback.

Depth maps refresh only when geometry/door state or source position/range changes. Camera rotation and intensity/color flicker do not refresh depth. The existing shared 30 FPS scheduler remains the sole presentation loop. Four depth comparisons soften the edge. Small normal/depth biases avoid self-shadowing.

The default retains reference exposure and applies a direct-light shadow correction; unchanged lit pixels keep their prior colors. Ambient/daylight is included separately so shadows do not remove it. Spell floor emission uses a production additive GPU pass with the existing fractional hex anchor and continuous source visibility mask, preserving per-hex falloff rather than a broad smooth light blob. Walls retain their hex-fragment radiance with shadow attenuation. The opt-in full per-pixel experiment also samples depth maps.

CPU visibility silhouettes remain a conservative bound on direct light. This is not full 3D global illumination or replacement of portal/daylight transport. Sprite units do not cast new volumetric shadows in this pass; their contact/sun shadows remain. Accurate unit proxies can be added separately.

## Controls and diagnostics

- Default: CPU-reference appearance plus bounded dynamic depth shadows.
- ?combatShadows=off: reference appearance without new depth shadows.
- ?combatLighting=cpu: complete CPU comparison route.
- ?combatLighting=gpu: existing experimental per-pixel route with depth shadows.
- battlefield data-gpu-stats includes shadowLights and shadowPasses. A stationary frame should report zero new shadow passes.

## Validation

Armor regressions cover portable-ID chainmail, null snapshots, explicit variants, equipped shield overrides and carried-weight/movement rules. Wall tests cover padded islands, triangle transport and light priorities. scripts/fixtures/combat-shadows.html uses production-renderer GPU readbacks for wall shadows, moving sources, caster removal, unchanged lit colors, ambient preservation, static/flicker depth reuse and hex-anchored spell shadows. The existing WebGL fixture remains passing. Visual review remains with the user; no universal 30 FPS claim is made.
