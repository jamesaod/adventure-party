ONE-OFF CHARACTER WORKFLOW — ACCEPTED MILESTONE, 2026-11-19

User approved the Tripo elf / CC5 AccuRIG / workshop result as the process for one-off characters. This proves a finished single-mesh character pipeline. Modular clothing, hair swapping and body-shape customization are NOT established by this test.

1. Create consistent front/back/left/right T-pose references. Keep proportions, costume and silhouette consistent. Omit separate weapons and troublesome cloaks unless specifically needed. Reference image beside this file is the user's supplied source sheet.
2. Generate the character in Tripo. Export an unrigged FBX with its texture. Preserve that source unchanged. This elf is 10,703 triangles, 5,452 source vertices, one material and a 1024x1024 color texture. No additional reduction was needed.
3. In CC5, Create Character > FBX > Humanoid (Non-Standard). Exit initial characterization, enter AccuRIG, Create Guides. Inspect guides before generating the skeleton. For THIS elf only, both knee guide Z values were changed from 29.420 to 35.500 because automatic guides landed at boot tops. These values are not universal presets. Generate Skeleton with five fingers, Bind Skin, exit AccuRIG and save an editable ccProject.
4. Apply the existing assigned rlMotion files with Ctrl+I. Check idle, jog, bow notch/shoot and swing, especially shoulders, wrists, knees and skirt. Each new mesh needs guide placement and binding, but the accepted motion library can be reused; do not repeat the original UAL-to-rlMotion conversion unnecessarily. Imported height is 3.27 feet, not an approved gameplay stature.
5. Export FBX using Maya, Mesh and Motion, Embed Textures ON, 60 FPS, all seven assigned motions in Custom. First Frame Pose OFF, Export Mesh and Motion Individually ON, Save One Motion per File ON, InstaLOD OFF. Use a short destination/name to avoid CC5 path-length failures. Preserve the native CC5 master before future edits or reductions.
6. Package using build-workshop.py and Blender 5.1 in background mode. Blender is only a format/animation packager here, not a decimator or second retargeter. This exact export needs +90 degrees X on mesh object bind transform. Zero and 180 degrees failed visual verification. Do not generalize the correction to other export presets. Script verifies matching bone sets/rest transforms and bakes all pose channels, including static helpers, onto the matching rig. FBX rounding tolerance is 0.01 source units (0.1 mm at the imported 0.01 armature scale). glTF keeps the strongest four weights per vertex, normalized.
7. Load the GLB in the separate workshop. Use native CC5 animation tracks, not browser retargeting. Seven source clips: Idle, Jog, One Handed Swing, Bow Notch, Bow Shoot, Death Forward, Death Sword. Combined bow uses 0.08-second overlap; total 3.086667 seconds. Inspect actual rendered motion, not merely successful conversion or numerical tests.

ACCEPTANCE AND LIMITS
User visually approved the result. Automated workshop checks sampled 61 poses for each of eight selectable clips, checking expected durations, hand rotation tracks and finite bounded deformation. Assistant inspected idle, jog and bow draw. This does not establish every frame as artifact-free. Tunic hem still stretches with raised thighs. Hair and outfit are part of one mesh, not modular components. No new facial rig or cloth physics was established. Production game integration and final world scale remain separate steps.

FOLDER CONTENTS
Tripo-Elf-AccuRIG.ccProject: editable rigged source; open in CC5.
elf-reference-four-view.png: exact user-uploaded reference image.
original-tripo/: unmodified input FBX and texture folder.
cc5-export/: mesh FBX, seven motion-only FBXs, profiles, JSON and textures.
Tripo-Elf-CC5.glb: verified workshop output.
build-workshop.py: standalone packaging script, reads cc5-export/t.fbx and writes output here. Run Blender 5.1 --background --factory-startup --python <absolute script path>.
tripo-export-audit.json / tripo-runtime-test.json: export and sampled runtime checks.

Workshop URL on this computer: http://127.0.0.1:8288/?quality=tripo
This folder is source data, not a registration of the model in the production game.
