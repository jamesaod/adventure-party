import * as THREE from '../assets/vendor/three/three.module.min.js';
import {FBXLoader} from '../assets/vendor/three/addons/loaders/FBXLoader.js';
import {GLTFLoader} from '../assets/vendor/three/addons/loaders/GLTFLoader.js';
function clone(root){
 const result=root.clone(true),copies=new Map();
 function pair(a,b){copies.set(a,b);for(let i=0;i<a.children.length;i++)pair(a.children[i],b.children[i]);}
 pair(root,result);
 root.traverse(source=>{if(!source.isSkinnedMesh)return;const target=copies.get(source);target.skeleton=source.skeleton.clone();target.skeleton.bones=source.skeleton.bones.map(b=>{const bone=copies.get(b);if(!bone)throw Error('Skinned model bone is outside its scene');return bone;});target.bindMatrix.copy(source.bindMatrix);target.bindMatrixInverse.copy(source.bindMatrixInverse);});
 return result;
}
// Parsed source assets are immutable. Every rig owns its buffers/materials;
// decoded image pixels may be shared safely between independently owned textures.
import {registerShadowGeometry} from './combat-shadow-geometry.mjs';
const sources=new Map();

const shadowModels=new Set(['male-orc-blue.glb','male-orc.glb','dungeon-crawler-carl-v2-ual2-sword-test.glb']);
async function sourceModel(key,expectedHash){
 const response=await fetch(key);if(!response.ok)throw Error('Cannot load combat model: '+response.status);
 const bytes=await response.arrayBuffer(),loader=new GLTFLoader();
 if(expectedHash){const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');if(hash!==expectedHash)throw Error('Published Workshop model checksum mismatch.');}
 const isFbx=/\.fbx$/i.test(new URL(key).pathname);
 const source=isFbx?(()=>{const scene=new FBXLoader().parse(bytes,new URL('.',key).href);return {scene,animations:scene.animations||[]};})():await loader.parseAsync(bytes,new URL('.',key).href);
 if(shadowModels.has(new URL(key).pathname.split('/').pop())){
  try{const response=await fetch(key.replace(/\.glb$/i,'.shadow.json'));if(response.ok){const pack=await response.json(),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');if(pack.version===1&&pack.sourceSha256===hash)source.shadowPack=pack;}}
  catch(error){console.warn('Optional shadow LOD unavailable; using source geometry.',error);}
 }
 return source;
}
export async function loadCombatModel(url,{sha256}={}){
 const key=new URL(url,import.meta.url).href;
 const cacheKey=key+'#'+(sha256||'');
 if(!sources.has(cacheKey))sources.set(cacheKey,sourceModel(key,sha256).catch(error=>{sources.delete(cacheKey);throw error;}));
 const source=await sources.get(cacheKey),scene=clone(source.scene),materials=new Map(),textures=new Map();
 const originalMeshes=[];source.scene.traverse(o=>{if(o.isMesh)originalMeshes.push(o);});let meshIndex=0;
 scene.traverse(o=>{if(!o.isMesh)return;const original=originalMeshes[meshIndex++],association=source.parser?.associations.get(original);o.geometry=o.geometry.clone();
  const record=source.shadowPack?.meshes[association?.meshes+':'+association?.primitives];
  if(record){const shadow=new THREE.BufferGeometry();shadow.setAttribute('position',new THREE.Float32BufferAttribute(record.position,3));shadow.setIndex(record.index);if(record.skinIndex){shadow.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(record.skinIndex,4));shadow.setAttribute('skinWeight',new THREE.Float32BufferAttribute(record.skinWeight,4));}registerShadowGeometry(o.geometry,shadow);}
  const copy=m=>{if(materials.has(m))return materials.get(m);const c=m.clone();materials.set(m,c);for(const [k,t] of Object.entries(c))if(t?.isTexture){if(!textures.has(t)){const n=t.clone();n.needsUpdate=true;textures.set(t,n);}c[k]=textures.get(t);}return c;};
  o.material=Array.isArray(o.material)?o.material.map(copy):copy(o.material);
 });
 // Keep the source cache bounded. In-flight consumers already hold their source.
 if(sources.size>8){const oldest=sources.keys().next().value;const pending=sources.get(oldest);sources.delete(oldest);pending.then(asset=>{asset.scene.traverse(o=>{o.geometry?.dispose();for(const m of [o.material].flat().filter(Boolean)){for(const t of Object.values(m))if(t?.isTexture)t.dispose();m.dispose();}});}).catch(()=>{});}
 return {...source,scene,scenes:[scene],animations:source.animations.map(c=>c.clone())};
}


