> Rev 274 supersedes smooth ground sampling: whole hexes and owning wall fragments now share stepped Sun shadow decisions. See WALL_VISIBILITY_HEX_SHADOWS.md.

# Cached wall ground shadows, Rev273

First-step experiment approved after the Rev272 solar dial. No GPU shadow maps, extra renderer, lightmap atlas, continuous shadow loop or MOB shadow-generation changes are added.

## Geometry and cache

explorationWallGroundSolids is the shared production wall/aperture geometry builder used by wall drawing and ground projection. Door leaves/lintels use combatDoorSolids, including their actual hinge and open state. Straight segments, curved chords, window sills/heads and compact wall heights retain existing geometry.

wall-ground-shadows.mjs converts tactical points into authored metres and projects them opposite the solar direction onto Y=0. The convex hull of each solid's projected vertices is indexed in three-metre spatial buckets. Queries take a logical union: any number of overlaps produces one occlusion value, never stacked darkness. All walls are considered, including offscreen or unseen casters. The existing floor geometry clips receivers to actual outdoor ground; sealed blackouts remain authoritative.

At latitude38N equinox noon, wall height3.5m produces a shadow of about2.73m. Near the horizon projection is capped at six wall heights and fades below ten degrees elevation. No wall-ground shadows are produced below the horizon.

A WeakMap caches source solids by terrain identity and door geometry state. A separate projection key uses solar hour/direction. Clock changes reproject cached solids; door/terrain changes refresh source geometry. Camera movement, MOB movement, turns and flicker do not rebuild projection geometry. The existing bounded ground exposure bake samples the cached spatial index. Its cache key includes the projection revision and the on/off setting. There is no per-frame raster shadow atlas.

## Lighting composition

This reference renderer does not yet have a separate physically calibrated Sun light. For this experiment, up to55% of the existing outdoor ground illumination is treated as direct sunlight at noon, decreasing with solar daylight strength. A shadow removes only that share. The remainder is sky ambient; torch/lantern inputs are added afterward unchanged, and spell radiance keeps its current additive path. Authored indoor ambient, wall lighting/LOS and sealed-region behavior are untouched. Sprite body brightness already samples ground exposure and therefore follows the resulting ground light; its cast-shadow artwork/geometry remains unchanged.

This is a planar approximation. Shadows do not climb other walls or objects, and no new roof projection or unit-to-unit shadowing is introduced. Existing ground-exposure filtering determines edge softness. Accurate directional shadow maps or a fuller direct/indirect lighting split remain separate future work.

## Compare and diagnostics

The solar wheel includes a WALL SHADOWS checkbox, on by default. ?wallSunShadows=off starts with it disabled. The setting stays within the current page session. Clock lighting still commits on pause/release, not continuously while dragging. battlefield data-wall-sun-shadow-stats reports hour, polygon count, geometry builds and projection builds for the latest enabled field; counts should stay stable while panning or moving MOBs. The checkbox/API state indicates whether the cached field is currently enabled.

## Scope and known QA

The Rev272 dark curved-wall patches and incorrectly dark door between round structures are queued separately. Their LOS presentation is not changed by this wall-ground-shadow experiment. CPU LOS, targeting, movement and spell rules remain unchanged.

## Validation

scripts/test-wall-ground-shadows.mjs verifies physical noon length, morning/evening direction, horizon cap, union overlap, camera/unit cache reuse, door invalidation, night suppression, relative origins, preserved indoor/elevated-wall exposure and unchanged local-light inputs. Existing geometry, renderer, navigation, startup and solar tests remain required. Browser comparisons verify visible on/off ground differences, stable field builds across camera/MOB movement, and clock-driven reprojection. User evaluates final appearance and performance.
