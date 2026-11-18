# Synty Starter workshop

Open `synty-workshop.html`, or choose Synty Creator [Workshop] from the game title. This separate experiment uses the user-supplied SIDEKICK Starter Unity 2021.3 v1.0.4 archive. No purchase or Unity editor installation is required to use this browser adaptation.

157 individual FBX parts were converted to GLB with Blender 5.1. The parts-layout FBX is excluded. Eight supplied .sk presets and their matching color maps are available. Torso provides the canonical rig; parts reference the same bone objects, retaining their inverse bind matrices. Additional accessory/hair bones are retained under their matching parents. The four shared body morphs are driven together across the selected pieces. Rest-pose assembly is checked against each original imported part in world space.

Idle, Walk and Jog are retargeted from the project's Quaternius Universal Animation Library (CC0), using the existing semantic humanoid retargeter. These are preview clips, not original Synty animations. Extra hair bones follow their parent; no secondary-motion simulation is provided. Facial expressions, Unity shader effects and Synty's editor features are outside this workshop. Colors use the supplied palette textures with simplified standard shading. Mixed outfits and extreme shapes can clip; user visual QA remains necessary.

Save locally in browser storage, or export/import an editable `.character.json`. Export rigged GLB includes selected meshes, body morph weights, textures and three clips. Open it using Load model file in MOB Workshop. The export retains one shared skeleton, with accessory bones where needed.

Synty assets are proprietary, not CC0. License: https://syntystore.com/pages/one-time-purchase-licence . Keep this experiment and source/export assets within the licensed project; no public deployment was performed. Original archive and extracted assets remain in the local working folder; package-inventory.json records hashes. Do not add this asset directory to a public repository or public asset download.

Validation: `node scripts/test-synty-workshop.mjs` checks all 157 assets, all eight presets, shared bone identity, neutral assembly alignment, sampled animated/morphed vertices and eight GLB export/import round trips. It does not certify every possible outfit mix.
