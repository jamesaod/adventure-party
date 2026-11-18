import * as THREE from '../assets/vendor/three/three.module.min.js';
export const SLOTS=['body','arms','legs','feet','hood','shoulders'];
export const REQUIRED=['body','arms','legs','feet'];
export function preset(catalog,gender='male',outfit='Ranger'){
 const parts=Object.fromEntries(SLOTS.map(slot=>[slot,catalog.parts.find(p=>p.gender===gender&&p.outfit===outfit&&p.slot===slot)?.id||'']));
 return {version:1,name:'New adventurer',gender,parts,hair:'',beard:'',palette:0,skin:0,tint:'#ffffff',hairColor:'#ffffff'};
}
export function validateDesign(input,catalog){
 if(input?.version!==1||!['male','female'].includes(input.gender))throw Error('This is not a supported character design.');
 const d={...preset(catalog,input.gender),...input,parts:{...input.parts}};
 d.name=String(d.name||'New adventurer').slice(0,100);
 for(const slot of SLOTS){const id=d.parts[slot];if(!id&&!REQUIRED.includes(slot)){d.parts[slot]='';continue;}if(!catalog.parts.some(p=>p.id===id&&p.slot===slot&&p.gender===d.gender))throw Error(`Choose a compatible ${slot} part.`);}
 for(const slot of ['hair','beard'])if(d[slot]&&!catalog.hair.some(p=>p.id===d[slot]&&p.slot===slot))throw Error('Unknown '+slot+' selection.');
 for(const k of ['palette','skin'])if(!Number.isInteger(d[k])||d[k]<0||d[k]>(k==='skin'?0:1))throw Error('Invalid '+k+'.');
 for(const k of ['tint','hairColor'])if(!/^#[0-9a-f]{6}$/i.test(d[k]))throw Error('Invalid color.');
 return d;
}
export function boneMap(root){const map=new Map();root.traverse(o=>{if(o.isBone){if(map.has(o.name))throw Error('Duplicate bone '+o.name);map.set(o.name,o);}});return map;}
// Preserve each part's inverse bind matrices. Every skin references the SAME bone objects.
export function assembleParts(entries){
 const body=entries.find(e=>e.slot==='body');if(!body)throw Error('A body is required.');
 const root=new THREE.Group();root.name='Character';const rig=body.scene;
 const remove=[];rig.traverse(o=>{if(o.isMesh)remove.push(o);});for(const m of remove)m.removeFromParent();root.add(rig);
 root.updateMatrixWorld(true);const bones=boneMap(root),materials=[];
 for(const entry of entries){entry.scene.updateMatrixWorld(true);const meshes=[];entry.scene.traverse(o=>{if(o.isMesh)meshes.push(o);});if(entry===body)meshes.push(...remove);
 for(const mesh of meshes){const matrix=mesh.matrixWorld.clone();if(!mesh.isSkinnedMesh)throw Error('Unrigged part: '+entry.id);
 const mapped=mesh.skeleton.bones.map(b=>{const target=bones.get(b.name);if(!target)throw Error('Missing shared bone: '+b.name);return target;});
 const skin=new THREE.Skeleton(mapped,mesh.skeleton.boneInverses.map(m=>m.clone()));const bind=mesh.bindMatrix.clone();
 root.add(mesh);matrix.decompose(mesh.position,mesh.quaternion,mesh.scale);mesh.bind(skin,bind);mesh.frustumCulled=false;
 mesh.name=entry.id+'_'+mesh.name;mesh.userData={partId:entry.id,slot:entry.slot,outfit:entry.outfit||''};
 const clone=m=>{const c=m.clone();materials.push(c);return c;};mesh.material=Array.isArray(mesh.material)?mesh.material.map(clone):clone(mesh.material);
 }
 }
 root.updateMatrixWorld(true);return {root,bones,materials};
}
// Quaternius-to-Quaternius only: transfer local rotation deltas from true skin bind poses.
export function adaptAnimation(source,clip,target){
 const skins=new Set();source.traverse(o=>{if(o.isSkinnedMesh)skins.add(o.skeleton);});for(const s of skins)s.pose();source.updateMatrixWorld(true);
 const targetBones=boneMap(target),sourceBones=boneMap(source),tracks=[];
 const sh=sourceBones.get('pelvis')?.getWorldPosition(new THREE.Vector3()).y||1;
 const th=targetBones.get('pelvis')?.getWorldPosition(new THREE.Vector3()).y||sh;
 for(const track of clip.tracks){const dot=track.name.lastIndexOf('.'),key=track.name.slice(0,dot),prop=track.name.slice(dot+1);const s=source.getObjectByName(key)||source.getObjectByProperty('uuid',key);const t=s&&targetBones.get(s.name);if(!s?.isBone||!t)continue;
 if(prop==='quaternion'){const correction=t.quaternion.clone().multiply(s.quaternion.clone().invert()),values=new Float32Array(track.values.length),q=new THREE.Quaternion();for(let i=0;i<values.length;i+=4){q.fromArray(track.values,i).premultiply(correction).normalize().toArray(values,i);}tracks.push(new THREE.QuaternionKeyframeTrack(t.name+'.quaternion',track.times.slice(),values,track.getInterpolation()));}
 else if(prop==='position'&&s.name==='pelvis'){const values=new Float32Array(track.values.length);for(let i=0;i<values.length;i+=3){values[i]=t.position.x;values[i+1]=t.position.y;values[i+2]=t.position.z+(track.values[i+2]-s.position.z)*(th/sh);}tracks.push(new THREE.VectorKeyframeTrack(t.name+'.position',track.times.slice(),values));}
 }
 if(!tracks.length)throw Error('No compatible animation tracks.');return new THREE.AnimationClip(clip.name,clip.duration,tracks);
}
export function disposeAssembly(a){if(!a)return;a.root.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.dispose();});for(const m of a.materials)m.dispose();a.root.removeFromParent();}

