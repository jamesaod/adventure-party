# Shared MOB AI behavior catalog

Species provide intelligence, role, senses, footprint and movement attributes. They share these policies through the existing combat service entry points:

| Behavior | Owner | Purpose |
|---|---|---|
| Perception | r222-perception-darkness-volume.js | Current sight, invisibility and obscuring effects; no hidden-coordinate attacks |
| Target memory | r220-mob-hazard-awareness.js | Last observed position with confidence/expiry |
| Hazard assessment | r220-mob-hazard-awareness.js | Intelligence/role-based recognition and weighted spell risk |
| Navigation | r222-perception-darkness-volume.js | Full-footprint collision, perceived occupancy, weighted route search |
| Pursuit | Shared closest-reachable policy | Follow a complete route in turn-sized portions; allow detours that initially move away |

`window.AdventurePartyMobAI` exposes the named behavior catalog, memory, known targets and route planning for diagnostics. It reuses existing policies rather than adding a competing AI loop.

## Local navigation correction (environmentTest=62)

Planning now rejects impassable fir hexes, matching movement execution. Pursuit first finds a complete risk-weighted route to an attack/last-known-position approach hex, then follows its movement-budget prefix. The older nearest-reachable search remains a fallback when no full route exists. This prevents stalling against window walls or trees when the correct route begins by increasing distance. Routes are replanned against current geometry and perception each turn. No new omniscient target tracking or species-specific overrides.

Regression tests exercise actual production planner functions for multiple species, window detours, fir blockers, movement budgets, hidden target movement and hazard weighting. Arrow shadows use a stronger bounded GPU silhouette; sun/source direction and shared light weighting remain unchanged.
