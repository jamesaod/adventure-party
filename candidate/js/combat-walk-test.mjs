import {loadCombatModel} from './combat-model-source.mjs';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {FBXLoader} from '../assets/vendor/three/addons/loaders/FBXLoader.js';
import {retargetHumanoidClip} from './mixamo-retarget.mjs?v=R238C140';
import {prepareStudioAnimations} from './studio-animations.mjs?v=R238C82';
import {restoreAnimationSkinBindPose} from './repository-fbx-animations.mjs?v=R238C178';
import {buildSceneGraph,normalizedFrame,configureCamera,mountCombatEquipment} from './combat-mob-renderer.mjs';
import {restoreDirectMaterials,directUnitFrame} from './combat-direct-units.mjs';
import {applyWarriorRecolor,isWarriorRecolorModel} from './warrior-recolor.mjs?v=R238C127';
import {createGroundedWalk} from './combat-walk-motion.mjs';

// Shared locomotion for every controller. walkTest=0 is a diagnostic opt-out.
export const walkTestEnabled=()=>typeof location!=='undefined'&&new URLSearchParams(location.search).get('walkTest')!=='0';
const sources=new Map();
export function locomotionFile(recipe){
  const equipment=recipe.equipment||{};
  return /swing|sword|axe|mace|hammer|club/i.test([equipment.poseProfileId,equipment.visualClass,equipment.itemName].join(' ')) ? 'sword-shield-run.fbx' : 'walking-test.fbx';
}
export async function attachWalkTest(recipe,set){
  if(!walkTestEnabled())return;
  const file=locomotionFile(recipe);
  if(!sources.has(file))sources.set(file, new FBXLoader().loadAsync(new URL('../assets/animations/locomotion/'+file,import.meta.url).href).then(source=>{let skinned=false;source.traverse(o=>{if(o.isSkinnedMesh)skinned=true;});if(skinned)restoreAnimationSkinBindPose(THREE,source);return source;}));
  const sourcePromise=sources.get(file);
  const [source,gltf]=await Promise.all([sourcePromise,loadCombatModel(new URL(recipe.model.url,import.meta.url).href)]);
  const model=gltf.scene,clip=retargetHumanoidClip(THREE,prepareStudioAnimations(source.animations)[0],source,model,'Walk test',{mode:'anatomical-aim',hipTranslation:'scaled-world-y'});
  // Keep locomotion in place: the combat movement owner moves the ground anchor.
  for(const track of clip.tracks){if(track.name.endsWith('.position')){for(let i=0;i<track.values.length;i+=3){track.values[i]=track.values[0];track.values[i+2]=track.values[2];}}}
  const localRecipe=structuredClone(recipe);
  if(isWarriorRecolorModel(recipe.model.id))applyWarriorRecolor(THREE,model,recipe.renderSettings?.appearanceRecolor);
  const group=buildSceneGraph(model,localRecipe),camera=configureCamera(localRecipe,normalizedFrame(localRecipe));
  await mountCombatEquipment(model,localRecipe);
  restoreDirectMaterials(group);
  const motion=createGroundedWalk(THREE,model,group,clip);
  let triangles=0;group.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});
  const walk={group,camera,triangles,sample(seconds){motion.sample(seconds);}};
  for(const image of Object.values({...set.images,...set.runtimeImages})){const frame=directUnitFrame(image);if(frame)frame.asset.walk=walk;}
}
