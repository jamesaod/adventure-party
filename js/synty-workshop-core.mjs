import * as THREE from '../assets/vendor/three/three.module.min.js';
import {retargetHumanoidClip} from './mixamo-retarget.mjs';
import {assembleParts as assembleShared,boneMap} from './character-creator-core.mjs';
export {disposeAssembly} from './character-creator-core.mjs';
export function assembleParts(entries){
 const body=entries.find(e=>e.slot==='body');if(!body)throw Error('A torso is required.');const bones=boneMap(body.scene);
 for(const e of entries)e.scene.traverse(b=>{if(!b.isBone||bones.has(b.name))return;const parent=bones.get(b.parent?.name);if(!parent)throw Error('Missing accessory parent for '+b.name);const added=b.clone(false);parent.add(added);bones.set(b.name,added);});
 return assembleShared(entries);
}
export function preset(catalog,id='Starter_01'){
 const p=catalog.presets.find(p=>p.id===id);if(!p)throw Error('Unknown starter preset.');
 return {version:1,collection:'synty-starter',name:'Synty adventurer',preset:id,parts:Object.fromEntries(catalog.slots.map(s=>[s,p.parts[s]||''])),palette:p.palette,shape:p.shape,size:p.size,muscle:p.muscle,tint:'#ffffff'};
}
export function validateDesign(input,catalog){
 if(input?.version!==1||input.collection!=='synty-starter')throw Error('Choose a Synty workshop design file.');
 const d={...preset(catalog,input.preset),...input,parts:{...input.parts}};d.name=String(d.name||'Synty adventurer').slice(0,100);
 for(const s of catalog.slots){if(!d.parts[s]&&s!=='Torso'){d.parts[s]='';continue;}if(!catalog.parts.some(p=>p.slot===s&&p.id===d.parts[s]))throw Error('Unknown part for '+s);}
 if(!catalog.palettes.some(p=>p.id===d.palette))throw Error('Unknown palette.');
 for(const k of ['shape','size','muscle'])if(!Number.isFinite(d[k])||d[k]<(k==='size'?-1:0)||d[k]>1)throw Error('Invalid body shape.');
 if(!/^#[0-9a-f]{6}$/i.test(d.tint))throw Error('Invalid tint.');return d;
}
export function applyShape(root,d){root.traverse(o=>{if(!o.morphTargetDictionary)return;const weights={masculineFeminine:d.shape,defaultHeavy:Math.max(0,d.size),defaultSkinny:Math.max(0,-d.size),defaultBuff:d.muscle};for(const [name,v]of Object.entries(weights)){const i=o.morphTargetDictionary[name];if(i!==undefined)o.morphTargetInfluences[i]=v;}});}
export function adaptAnimation(source,clip,target){
 const skins=new Set();source.traverse(o=>{if(o.isSkinnedMesh)skins.add(o.skeleton);});for(const s of skins)s.pose();source.updateMatrixWorld(true);
 // The imported GLTF skins use identity bind matrices beneath a scaled FBX
 // armature. Supply the canonical rest rig directly, avoiding a second mesh
 // transform in the general retargeter's inverse-bind reconstruction.
 const rig=target.clone(true),remove=[];rig.traverse(o=>{if(o.isMesh)remove.push(o);});remove.forEach(o=>o.removeFromParent());rig.updateMatrixWorld(true);
 const result=retargetHumanoidClip(THREE,clip,source,rig,clip.name,{mode:'world-bind-delta',hipTranslation:'scaled-world-y'});
 for(const t of result.tracks){const dot=t.name.lastIndexOf('.'),b=rig.getObjectByProperty('uuid',t.name.slice(0,dot));if(b)t.name=b.name+t.name.slice(dot);}
 return result;
}
