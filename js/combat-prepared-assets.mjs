import * as THREE from '../assets/vendor/three/three.module.min.js';
import {appearanceCacheKey} from './mob-appearance.mjs?v=R238C204';
import {directUnitFrame,setDirectUnit,restoreDirectMaterials} from './combat-direct-units.mjs';
import {getModelShadow,setModelShadow} from './combat-model-shadow.mjs';
import {readPreparedAsset,requestPreparedAsset} from './combat-prepared-store.mjs';

export const PREPARED_VERSION=1;
export function preparedAssetKey(recipe){return `direct-v${PREPARED_VERSION}-${appearanceCacheKey(recipe)}`;}
export function validatePreparedAsset(pack,key){
  if(pack?.format!=='adventure-party-direct-unit'||pack.version!==PREPARED_VERSION||pack.key!==key||!pack.scene||!pack.manifest||!pack.frames||!pack.sources)
    throw Error('Prepared combat model is missing, outdated, or belongs to another equipment recipe. Rebuild it in 3D Studio.');
  if(!Object.keys(pack.frames).length)throw Error("Prepared model contains no poses.");
  for(const [file,frame] of Object.entries(pack.frames)){
    if(!pack.sources[file]||!frame.object||!Number.isFinite(frame.yaw)||!frame.camera||!frame.shadow?.positions?.length||!frame.shadow?.indices?.length)
      throw Error(`Incomplete prepared model frame: ${file}`);
  }
  return pack;
}
// Called ONLY by the Studio build. The mesh collection shares textures across poses.
export function serializePreparedAsset(recipe,set){
  const root=new THREE.Group(),assets=new Map(),frames={};
  for(const [file,image] of Object.entries({...set.images,...set.runtimeImages})){
    const frame=directUnitFrame(image);if(!frame)throw Error(`Missing actual model for ${file}`);
    const {asset,yaw}=frame;asset.camera.updateMatrixWorld(true);
    if(!assets.has(asset)){const copy=asset.group.clone();copy.rotation.set(0,0,0);root.add(copy);assets.set(asset,copy.uuid);}
    const shadow=getModelShadow(image);
    frames[file]={object:assets.get(asset),yaw,camera:asset.camera.toJSON(),triangles:asset.triangles,
      shadow:{positions:Array.from(shadow.positions),indices:Array.from(shadow.indices),stats:shadow.stats},
      blade:globalThis.adventurePartyFlamingBlades?.get(image)||null};
  }
  const pack={equipmentLodVersion:1,cameraFrameVersion:1,format:'adventure-party-direct-unit',version:PREPARED_VERSION,key:preparedAssetKey(recipe),
    recipe:structuredClone(recipe),manifest:set.manifest,scene:root.toJSON(),frames,sources:set.sourceUrls};
  return validatePreparedAsset(pack,pack.key);
}
const decodeImage=src=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Prepared silhouette could not be loaded.'));image.src=src;});
export async function hydratePreparedAsset(pack){
  validatePreparedAsset(pack,pack.key);
  const loader=new THREE.ObjectLoader(),root=await loader.parseAsync(pack.scene),assets=new Map(),images={},runtimeImages={};
  for(const [file,frame] of Object.entries(pack.frames)){
    let asset=assets.get(frame.object);
    if(!asset){const group=root.getObjectByProperty('uuid',frame.object);if(!group)throw Error('Prepared pose geometry is missing.');root.remove(group);restoreDirectMaterials(group);
      asset={group,camera:await loader.parseAsync(frame.camera),triangles:frame.triangles};assets.set(frame.object,asset);}
    const image=await decodeImage(pack.sources[file]);
    (file.endsWith('-battlefield.png')?runtimeImages:images)[file]=image;
    setDirectUnit(image,asset,frame.yaw);
    setModelShadow(image,{positions:new Float32Array(frame.shadow.positions),indices:new Uint32Array(frame.shadow.indices),stats:frame.shadow.stats});
    if(frame.blade){globalThis.adventurePartyFlamingBlades ||= new WeakMap();globalThis.adventurePartyFlamingBlades.set(image,frame.blade);}
  }
  return {manifest:pack.manifest,images,runtimeImages,sourceUrls:pack.sources};
}
export async function loadPreparedCombatUnit(recipe,{onProgress}={}){
  if(recipe.renderSettings?.workshopUnit){const {loadWorkshopCombatUnit}=await import('./combat-workshop-unit.mjs');return loadWorkshopCombatUnit(recipe,{onProgress});}
  const key=preparedAssetKey(recipe);onProgress?.({step:'Loading prepared 3D model',reason:'Reading saved geometry and shadow meshes; no sprite generation or simplification.'});
  const started=performance.now();
  let pack=null;
  if(new URLSearchParams(location.search).get('preparedAssets')!=='files'){
    try{pack=await readPreparedAsset(key);}catch(error){console.warn('Prepared model cache unavailable; using asset files.',error);}
  }
  if(pack?.cameraFrameVersion!==1 || (pack && !pack.equipmentLodVersion && pack.scene?.geometries?.some(g=>[54706,27364].includes((g.data?.index?.array?.length||0)/3))))pack=null;
  if(!pack){const response=await fetch(new URL(`../assets/combat-units/${key}.json.gz`,import.meta.url));
    if(response.ok){const stream=response.body.pipeThrough(new DecompressionStream('gzip'));pack=await new Response(stream).json();}
    else if(response.status!==404)throw Error(`Prepared model load failed (${response.status}).`);}
  if(!pack){await requestPreparedAsset(key,recipe);throw Error('This model/equipment combination needs a 3D Studio build. Open 3D Studio → Prepared battlefield models → Build pending models. Combat will not generate it.');}
  validatePreparedAsset(pack,key);
  const result=await hydratePreparedAsset(pack);
  if(new URLSearchParams(location.search).get('walkTest')!=='0'){
    onProgress?.({step:'Loading experimental walk rig',reason:'Playing the supplied walk animation on the actual model; no sprite baking.'});
    const {attachWalkTest}=await import('./combat-walk-test.mjs');
    await attachWalkTest(pack.recipe,result);
  }
  try{
    const {attachCombatActions}=await import('./combat-action-runtime.mjs');
    await attachCombatActions(pack.recipe,result);
  }catch(error){console.warn('Saved action animations could not load; using prepared poses.',error);}
  const elapsed=performance.now()-started;
  document.documentElement.dataset.preparedModelLoadMs=elapsed.toFixed(0);
  onProgress?.({step:'3D model ready',reason:`Loaded saved assets in ${(elapsed/1000).toFixed(2)} seconds. No pose baking or mesh simplification during combat.`});
  return result;
}
