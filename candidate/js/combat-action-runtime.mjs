import {loadCombatModel} from './combat-model-source.mjs';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {readActionLibrary,validateActionLibrary,bindActionEntry,chooseDeath,actionSample} from './combat-action-clips.mjs';
import {buildSceneGraph,normalizedFrame,configureCamera,mountCombatEquipment} from './combat-mob-renderer.mjs';
import {restoreDirectMaterials,directUnitFrame} from './combat-direct-units.mjs';
import {applyWarriorRecolor,isWarriorRecolorModel} from './warrior-recolor.mjs?v=R238C127';

export async function attachCombatActions(recipe,set){
 const library=await readActionLibrary(recipe.model.id);
 if(!library?.entries?.some(e=>e.kind==='death'))return;
 validateActionLibrary(library,recipe.model.id);
 const {scene:model}=await loadCombatModel(new URL(recipe.model.url,import.meta.url).href);
 const entries=library.entries.filter(e=>e.kind==='death');
 const clips=new Map(entries.map(e=>[e.id,bindActionEntry(model,e)]));
 const localRecipe=structuredClone(recipe);
 if(isWarriorRecolorModel(recipe.model.id))applyWarriorRecolor(THREE,model,recipe.renderSettings?.appearanceRecolor);
 const group=buildSceneGraph(model,localRecipe),camera=configureCamera(localRecipe,normalizedFrame(localRecipe));
 await mountCombatEquipment(model,localRecipe);restoreDirectMaterials(group);
 let triangles=0;group.traverse(o=>{if(o.isMesh){o.frustumCulled=false;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});
 const mixer=new THREE.AnimationMixer(model),choices=new WeakMap();
 const asset={group,camera,triangles,sample(entity,now){
  const stamp=entity.deathPresentationStartedAt;
  let choice=choices.get(entity);
  if(!choice||choice.stamp!==stamp){choice={stamp,entry:chooseDeath(entries)};choices.set(entity,choice);}
  entity.deathAnimationDurationMs=choice.entry.clip.duration/choice.entry.speed*1000;
  const entry=choice.entry,elapsed=Math.max(0,(now-stamp)/1000);
  mixer.stopAllAction();
  const action=mixer.clipAction(clips.get(entry.id)).reset().setLoop(THREE.LoopOnce,1);
  action.clampWhenFinished=true;action.play();
  mixer.setTime(actionSample(entry,elapsed));group.updateMatrixWorld(true);
  return elapsed<entry.clip.duration/entry.speed;
 }};
 for(const image of Object.values({...set.images,...set.runtimeImages})){const frame=directUnitFrame(image);if(frame)frame.asset.deathActions=asset;}
}
