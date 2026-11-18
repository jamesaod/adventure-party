WHITE OAK FAMILY - SPEEDTREE STUDY
Preview: http://127.0.0.1:8791/family.html
Use comparison/StartComparison.cmd if the local server is stopped.

Editable SpeedTree sources: WhiteOak_RaisedCrown.spm, WhiteOak_Fall.spm,
WhiteOak_Winter.spm, WhiteOak_Fallen.spm, WhiteOak_Stump.spm.
Each has OBJ/MTL exports and six detail levels (base and LOD1-5).

Actual triangle counts, highest to lowest:
Summer: 14447, 11111, 9639, 8303, 7117, 6114
Fall:   13894, 10758, 9397, 8149, 7081, 6046
Winter: 9036, 6410, 5281, 4292, 3679, 2950
Log:    1726, 917, 684, 493, 392, 281
Stump:  326, 161, 163, 129, 109, 97

Native OBJ units: metres, Z-up. Standing ground datum: source Z=0.20m.
Summer height above datum: 25.473m. Exterior crown outside a 2m radius begins
at 7.6308m above datum; this is an exterior clearance check, not a branch
attachment measurement. Preview gold marker: 10 feet / 3.048m.
Carl: 1.9304m. Stump: about 0.98m above ground. Log translated onto preview ground.

Summer primary branch start raised; downward gravity reduced.
Fall uses native SpeedTree autumn materials.
Winter hides leaves and baked leaf-bearing twig cards, reducing some twig detail.
Fallen log is modeled horizontally with roots disabled and capped broken limbs.
Stump retains roots, disables crown, and has a Knot Cap end-grain material.
Breaks are blunt weathered forms, not elaborate splinters.

First-pass review set: raising branches makes summer/fall crowns more open than
the original full-crown oak. Original sources and in-game oak are preserved.
Seasonal switching and debris placement are not wired into gameplay.

Validation: hidden Chrome loaded without script or missing-asset errors;
season and debris screenshots inspected. Export counts and bounds recorded in
comparison/assets/family/manifest.json.
