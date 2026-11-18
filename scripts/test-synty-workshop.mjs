import assert from 'node:assert/strict';
import fs from 'node:fs';
import {registerHooks} from 'node:module';
const root=new URL('../',import.meta.url),three=new URL('assets/vendor/three/three.module.min.js',root).href;
registerHooks({resolve(s,c,next){return s==='three'?{url:three,shortCircuit:true}:next(s,c);}});
globalThis.ProgressEvent=class{constructor(type,data){Object.assign(this,{type},data);}};
globalThis.FileReader=class{readAsArrayBuffer(b){b.arrayBuffer().then(r=>{this.result=r;this.onloadend?.();});}};
const THREE=await import(three),{GLTFLoader}=await import(new URL('assets/vendor/three/addons/loaders/GLTFLoader.js',root)),{GLTFExporter}=await import(new URL('assets/vendor/three/addons/exporters/GLTFExporter.js',root)),{clone}=await import(new URL('assets/vendor/three/addons/utils/SkeletonUtils.js',root));
const {preset,validateDesign,assembleParts,applyShape,adaptAnimation}=await import(new URL('js/synty-workshop-core.mjs',root));
const base=new URL('assets/characters/synty-starter/',root),catalog=JSON.parse(fs.readFileSync(new URL('catalog.json',base))),loader=new GLTFLoader(),cache=new Map();
async function load(file){if(!cache.has(file)){const bytes=fs.readFileSync(new URL(file,base));cache.set(file,loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),''));}return cache.get(file);}
const donors=await Promise.all(catalog.animations.map(a=>load(a.file)));let samples=0,exports=0;
assert.equal(catalog.parts.length,157);assert.equal(catalog.presets.length,8);
for(const p of catalog.parts){const g=await load(p.file);assert(g.scene.getObjectByProperty('isSkinnedMesh',true),p.id);assert(p.slot);}
for(const p of catalog.presets){
 const d=validateDesign(preset(catalog,p.id),catalog);assert.throws(()=>validateDesign({...d,parts:{...d.parts,Torso:'bad'}},catalog));
 const entries=await Promise.all(catalog.parts.filter(p=>d.parts[p.slot]===p.id).map(async p=>({...p,slot:p.slot==='Torso'?'body':p.slot,scene:clone((await load(p.file)).scene)})));
 const baseline=new Map();for(const e of entries){e.scene.updateMatrixWorld(true);e.scene.traverse(m=>{if(!m.isSkinnedMesh)return;m.skeleton.update();const pts=[];for(let i=0;i<m.geometry.attributes.position.count;i+=23)pts.push(m.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(m.matrixWorld));baseline.set(e.id,pts);});}
 const a=assembleParts(entries),meshes=[];a.root.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});assert(a.bones.size>=88);
 for(const m of meshes){m.skeleton.update();for(const b of m.skeleton.bones)assert.equal(b,a.bones.get(b.name));let max=0,j=0;for(let i=0;i<m.geometry.attributes.position.count;i+=23){const v=m.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(m.matrixWorld);max=Math.max(max,v.distanceTo(baseline.get(m.userData.partId)[j++]));}assert(max<.002,`${p.id}: bind shift ${max} in ${m.name}`);}
 applyShape(a.root,d);const clips=donors.map((g,i)=>{const c=adaptAnimation(clone(g.scene),g.animations[0],a.root);c.name=catalog.animations[i].label;return c;});const mixer=new THREE.AnimationMixer(a.root);
 for(const c of clips){assert(c.tracks.length>=20);const action=mixer.clipAction(c).play();for(const f of [0,.25,.5,.75]){action.time=c.duration*f;mixer.update(0);a.root.updateMatrixWorld(true);assert(a.bones.get('head').getWorldPosition(new THREE.Vector3()).y-a.bones.get('pelvis').getWorldPosition(new THREE.Vector3()).y>.35,'Locomotion must stay upright');for(const m of meshes){m.skeleton.update();for(let i=0;i<m.geometry.attributes.position.count;i+=23){const v=m.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(m.matrixWorld);assert(v.toArray().every(Number.isFinite));assert(v.length()<4,`${p.id}: exploded ${m.name}: ${v.toArray()}`);samples++;}}}mixer.stopAllAction();}
 const bytes=await new GLTFExporter().parseAsync(a.root,{binary:true,animations:clips});const rt=await loader.parseAsync(bytes,'');assert.equal(rt.animations.length,3);let bones=0;rt.scene.traverse(o=>{if(o.isBone)bones++;if(o.morphTargetDictionary?.masculineFeminine!==undefined)assert(Math.abs(o.morphTargetInfluences[o.morphTargetDictionary.masculineFeminine]-d.shape)<1e-6);});assert.equal(bones,a.bones.size);exports++;
 console.log(p.id+' passed');
}
console.log(`Synty workshop: 157 parts; 8 presets; ${samples} animated vertex samples; ${exports} GLB round trips passed.`);

