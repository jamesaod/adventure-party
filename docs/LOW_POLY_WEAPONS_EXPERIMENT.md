# Experimental low-poly weapon integration

Local test: http://127.0.0.1:8276/index.html?weaponTest=1
Select Dungeon Crawler Carl in Combat Test, begin battle, and open Inventory.
The opt-in test adds weightless samples of the new weapons. Normal catalog weights are unchanged.

The source is the user's Low Poly Medieval Weapons Unity package and weapon-mapping.json.
25 selected source meshes were exported without polygon reduction, using the red palette
(terracotta/brown handles and pale matte metal). Importer: scripts/import-low-poly-weapons.py.
Catalog bindings and initial fits: js/low-poly-weapons.mjs. Revision 100 invalidates old
asset-specific grips; subsequent Equipment Fit edits at that revision remain authoritative.

Great Mace: 20 gp, 20 lb, M, B, speed 10, 1d8+1 / 2d4, two hands.
Two-Handed Battle Axe: 10 gp, 10 lb, M, S, speed 9, 1d10 / 2d8, two hands.
Maul: 5 gp, 10 lb, L, B, speed 9, 2d4 / 1d10, two hands.
Two-Handed Falchion uses Two-Handed Sword stats. Staff uses Quarterstaff stats.

Original unselected equipment remains available. Bow GLBs contain rest/drawn nodes;
the authored windup capture selects the drawn node. Continuous bow draw animation is
not added by this experiment. Arrow and quiver meshes are catalog resources, not
replacement projectile effects or attached quivers.

Prepared Carl equipment combinations are built outside combat and saved under
assets/combat-units. The local authoring helper weapon-preparation.html reads the
existing preparation queue. Its loopback writer is work/weapon-asset-writer.cjs on
port 8278, used only while preparing assets. Combat never generates these models.
Other MOB/body/armor combinations still require the normal Studio preparation flow.

Fits and physical lengths are first-pass defaults for visual review, not final
weapon-specific hand/animation calibrations. No push or deployment in this pass.
