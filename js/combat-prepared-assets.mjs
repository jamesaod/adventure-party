import {markFlamingBlade,preparedBladeTemplates,restorePreparedBlade} from './combat-weapon-flame.mjs?v=R238C299';
import {studioWeapon,weaponAssetUrl} from './studio-equipment.mjs?v=R238C312';
import {preparedVisualKey} from './prepared-visual-key.mjs';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {appearanceCacheKey} from './mob-appearance.mjs?v=R238C204';
import {directUnitFrame,setDirectUnit,restoreDirectMaterials} from './combat-direct-units.mjs';
import {getModelShadow,setModelShadow} from './combat-model-shadow.mjs';
import {readPreparedAsset,requestPreparedAsset} from './combat-prepared-store.mjs';
import {expandPreparedChunks} from './combat-prepared-chunks.mjs';

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
      shadow:{positions:Array.from(shadow.positions),indices:Array.from(shadow.indices),stats:shadow.stats}};
  }
  const pack={equipmentLodVersion:1,cameraFrameVersion:1,format:'adventure-party-direct-unit',version:PREPARED_VERSION,key:preparedAssetKey(recipe),
    recipe:structuredClone(recipe),manifest:set.manifest,scene:root.toJSON(),frames,sources:set.sourceUrls};
  return validatePreparedAsset(pack,pack.key);
}
const decodeImage=src=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Prepared silhouette could not be loaded.'));image.src=src;});
const bladeTemplates=new Map();
async function restorePreparedSwordFlame(group,recipe){
 if(recipe?.equipment?.appearanceId!=='flaming-sword-5')return;
 let marked=false;group.traverse(m=>{if(m.geometry?.getAttribute('flameBlade'))marked=true;});if(marked)return;
 const preset=studioWeapon(recipe.equipment.studioId||recipe.equipment.appearanceId);if(!preset?.flameSpan)return;
 // Older saves contain the original -X sword; match the file actually baked.
 const legacy=recipe.equipment.asset?.endsWith('/swords/medieval-sword.glb');
 const span=legacy?{base:[.17,.109,0],tip:[-.48,.109,0]}:preset.flameSpan;
 const source=legacy?{file:recipe.equipment.asset,assetSha256:recipe.equipment.assetSha256}:preset;
 const url=weaponAssetUrl(source,new URL('../',import.meta.url)).href;
 if(!bladeTemplates.has(url))bladeTemplates.set(url,import('./combat-model-source.mjs').then(({loadCombatModel})=>loadCombatModel(url)).then(({scene})=>{
  markFlamingBlade(scene,span);const templates=preparedBladeTemplates(scene);
  scene.traverse(o=>{o.geometry?.dispose();for(const m of [].concat(o.material||[])){for(const v of Object.values(m))if(v?.isTexture)v.dispose();m.dispose();}});return templates;
 }).catch(error=>{bladeTemplates.delete(url);throw error;}));
 if(!restorePreparedBlade(group,await bladeTemplates.get(url)))throw Error('Prepared flaming sword does not match its source geometry.');
}
export async function hydratePreparedAsset(pack){
  validatePreparedAsset(pack,pack.key);
  const loader=new THREE.ObjectLoader(),root=await loader.parseAsync(pack.scene),assets=new Map(),images={},runtimeImages={};
  for(const [file,frame] of Object.entries(pack.frames)){
    let asset=assets.get(frame.object);
    if(!asset){const group=root.getObjectByProperty('uuid',frame.object);if(!group)throw Error('Prepared pose geometry is missing.');root.remove(group);await restorePreparedSwordFlame(group,pack.recipe);restoreDirectMaterials(group);
      asset={group,camera:await loader.parseAsync(frame.camera),triangles:frame.triangles};assets.set(frame.object,asset);}
    const image=await decodeImage(pack.sources[file]);
    (file.endsWith('-battlefield.png')?runtimeImages:images)[file]=image;
    setDirectUnit(image,asset,frame.yaw);
    setModelShadow(image,{positions:new Float32Array(frame.shadow.positions),indices:new Uint32Array(frame.shadow.indices),stats:frame.shadow.stats});
  }
  return {manifest:pack.manifest,images,runtimeImages,sourceUrls:pack.sources};
}
export async function loadPreparedCombatUnit(recipe,{onProgress}={}){
  if(recipe.renderSettings?.workshopUnit){const {loadWorkshopCombatUnit}=await import('./combat-workshop-unit.mjs?v=R238C313');return loadWorkshopCombatUnit(recipe,{onProgress});}
  const key=preparedAssetKey(recipe);onProgress?.({step:'Loading prepared 3D model',reason:'Reading saved geometry and shadow meshes; no sprite generation or simplification.'});
  const started=performance.now();
  let pack=null;
  if(new URLSearchParams(location.search).get('preparedAssets')!=='files'){
    try{pack=await readPreparedAsset(key);}catch(error){console.warn('Prepared model cache unavailable; using asset files.',error);}
  }
  if(pack?.cameraFrameVersion!==1 || (pack && !pack.equipmentLodVersion && pack.scene?.geometries?.some(g=>[54706,27364].includes((g.data?.index?.array?.length||0)/3))))pack=null;
  if(!pack){const response=await fetch(new URL(`../assets/prepared-combat/${key}.json.gz`,import.meta.url));
    if(response.ok){pack=await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json();
      await expandPreparedChunks(pack,async hash=>{
        const chunk=await fetch(new URL(`../assets/prepared-combat/chunks/${hash}.json.gz`,import.meta.url));
        if(!chunk.ok)throw Error(`Prepared geometry chunk load failed (${chunk.status}).`);
        return new Response(chunk.body.pipeThrough(new DecompressionStream('gzip'))).json();
      });
    }else if(response.status!==404)throw Error(`Prepared model load failed (${response.status}).`);
  }
  if(!pack){const response=await fetch(new URL(`../assets/combat-units/${key}.json.gz`,import.meta.url));
    if(response.ok){const stream=response.body.pipeThrough(new DecompressionStream('gzip'));pack=await new Response(stream).json();}
    else if(response.status!==404)throw Error(`Prepared model load failed (${response.status}).`);}
  if(!pack && recipe.mob?.type==='fighter' && recipe.renderSettings?.source==='built-in-profile'){
    const indexResponse=await fetch(new URL('../assets/prepared-combat/carl-visual-index.json',import.meta.url));
    if(indexResponse.ok){
      const savedKey=(await indexResponse.json()).entries?.[preparedVisualKey(recipe)];
      if(/^direct-v1-mob-appearance-v1-[a-f0-9]{8}$/.test(savedKey||'')){
        const response=await fetch(new URL('../assets/prepared-combat/'+savedKey+'.json.gz',import.meta.url));
        if(response.ok){
          const saved=await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json();
          validatePreparedAsset(saved,savedKey);
          if(preparedVisualKey(saved.recipe)===preparedVisualKey(recipe)){
            await expandPreparedChunks(saved,async hash=>{
              const chunk=await fetch(new URL('../assets/prepared-combat/chunks/'+hash+'.json.gz',import.meta.url));
              if(!chunk.ok)throw Error('Prepared geometry chunk load failed ('+chunk.status+').');
              return new Response(chunk.body.pipeThrough(new DecompressionStream('gzip'))).json();
            });
            pack={...saved,key,recipe:structuredClone(recipe)};
          }
        }
      }
    }
  }
  if(!pack){await requestPreparedAsset(key,recipe);throw Error('Published battlefield assets are missing for this model/equipment combination. Publish its prepared assets through the authoring pipeline; combat will not generate them.');}
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
