# Uniformed Orc weapon fitting

The red `male-orc` model uses anatomical palm-frame defaults for revision-100 low-poly weapons in MOB Workshop and 3D Studio. `js/orc-weapon-fit.mjs` owns these defaults. Handle +Y follows the index-to-pinky grip axis; crossbows have a transverse trigger-grip correction. Bows attach to the left hand. Other models and legacy weapon imports keep their existing mounts.

Saved manual mounts take precedence. Workshop records resolved mounts in its draft/export; use Reset attachment to apply the new default to an existing saved mount. This does not rewrite existing exported combat assets.

Workshop now restores the previous support-hand constraint before animation evaluation, then reapplies the existing two-handed solver after the authored animation and hand-pose offsets. One-handed weapons skip this solver entirely. The weapon remains attached to its animated hand bone.

Internal-browser review covered the sword/axe palm contact and two-handed sword support hand. Bow/crossbow defaults still require their own authored aiming animation and pose-specific refinement; a sword idle is not a firing pose. These defaults are not a claim of collision-free fitting across every animation.

Validation: `node scripts/test-orc-weapon-fit.mjs`, `node scripts/test-studio-equipment.mjs`, `node scripts/test-mob-workshop.mjs`, `node scripts/test-mob-workshop-fit.mjs`.
