# Live action animation authoring — local pass, 2026-11-06

3D Studio → Battlefield action animations stores model-specific trimmed clips with start/end seconds and playback speed. Preview plays once and holds the end. Save several Death entries to enable uniform random selection per death. JSON export/import preserves the complete trimmed tracks (no source FBX required at runtime). Local edits live in IndexedDB, scoped by app path; shipped defaults live in assets/animations/actions/<model-id>.json. Never apply one model's bone bindings to another model.

Shipped first sample: male-orc, Standing Death Forward 01 and Sword And Shield Death. Combat loads the original rig and mounted equipment once per prepared appearance when death clips exist. Clips bind by unique node names to fresh UUIDs. Rendering samples the chosen clip, then holds its last frame. Existing corpse facing, placement, desaturation, blood and gameplay occupancy remain owned by existing combat systems. Animation refresh uses the shared combat scheduler. No sprite generation or mesh simplification was added.

Attack clip authoring/preview/export is available, but replacing attack action/result timing is the NEXT step: wire a complete clip into the action owner and align the damage event before removing the old wind-up/attack stages. This pass does not silently alter attack timing. Existing prepared silhouettes/shadow meshes still follow the old pose selection; synchronizing them with live animation remains follow-up work.

NPC movement (friendly and hostile) now has no added inter-hex sleep in either the base owners or active R219 service overrides. Walking supplies transition time in the walkTest=1 experiment. Opportunity/guard reactions and area effects retain their rule-driven waits. Unseen movement does not reveal models.

Validation: movement timing/cancellation and production overrides (including no inter-step sleeps); portable clip trimming, speed, random selection, final pose; actual male-orc GLB binding and prone endpoint for both shipped clips; prepared assets and direct-unit regression tests. Internal-browser Studio: selected model, previewed and saved both death choices, exported library.

### Equipment and locomotion trial
Battle Axe and Medieval Sword now load offline reduced GLBs (1,799 and 900 triangles). Original GLBs remain intact; logical equipment paths and saved grips stay stable. Prepared geometry was reduced offline and carries equipmentLodVersion 1 so stale high-poly browser caches are bypassed.
The walkTest=1 trial selects Sword And Shield Run for sword, axe, mace, hammer, club, and swing profiles; other loadouts retain walking. NPC path steps retain pose phase through transitions, and the active marker switches at the midpoint boundary. Pose sampling remains 10 FPS. Combat reactions still interrupt movement.

Locomotion is now enabled by default for all controllers (walkTest=0 is a diagnostic opt-out). Base and registered AI paths plus player Quick Command share continuous timing. Held keyboard movement chains the same segments until key release, a blocked step, or turn change; combat reactions remain authoritative.

Death settling now eases from the original anchor/facing to a randomized offset inside the central half-radius hex region and a random full-circle orientation over the selected death clip duration. Corpses remain visible; skull overlays are removed. Model pose sampling is 30 FPS.
