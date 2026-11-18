import assert from 'node:assert/strict';
import fs from 'node:fs';
import {registerHooks} from 'node:module';
const root=new URL('../',import.meta.url),three=new URL('assets/vendor/three/three.module.min.js',root).href;
registerHooks({resolve(specifier,context,next){if(specifier==='three')return {url:three,shortCircuit:true};return next(specifier,context);}});
globalThis.ProgressEvent=class ProgressEvent{constructor(type,data){this.type=type;Object.assign(this,data);}};
globalThis.FileReader=class FileReader{readAsArrayBuffer(blob){blob.arrayBuffer().then(r=>{this.result=r;this.onloadend?.();});}readAsDataURL(blob){blob.arrayBuffer().then(r=>{this.result='data:application/octet-stream;base64,'+Buffer.from(r).toString('base64');this.onloadend?.();});}};
const THREE=await import(three),{GLTFLoader}=await import(new URL('assets/vendor/three/addons/loaders/GLTFLoader.js',root)),{GLTFExporter}=await import(new URL('assets/vendor/three/addons/exporters/GLTFExporter.js',root));
const {clone}=await import(new URL('assets/vendor/three/addons/utils/SkeletonUtils.js',root));
const {preset,validateDesign,assembleParts,adaptAnimation}=await import(new URL('js/character-creator-core.mjs',root));
const base=new URL('assets/characters/quaternius/',root),catalog=JSON.parse(fs.readFileSync(new URL('catalog.json',base))),loader=new GLTFLoader();
async function load(file){const bytes=fs.readFileSync(new URL(file,base));let g,bin;
 if(file.endsWith('.glb')){const len=bytes.readUInt32LE(12);g=JSON.parse(bytes.subarray(20,20+len));bin=bytes.subarray(28+len);}else{g=JSON.parse(bytes);bin=fs.readFileSync(new URL(g.buffers[0].uri,base));}
 // GPU texture decoding is deliberately outside this structural/deformation test.
 for(const image of g.images||[])if(image.uri)assert(fs.existsSync(new URL(image.uri,base)),image.uri);
 delete g.images;delete g.textures;delete g.samplers;g.materials=(g.materials||[]).map(m=>({name:m.name,pbrMetallicRoughness:{baseColorFactor:[1,1,1,1]}}));g.buffers=[{uri:'data:application/octet-stream;base64,'+bin.toString('base64'),byteLength:bin.length}];
 return loader.parseAsync(JSON.stringify(g),'');
}
assert.equal(catalog.parts.length,20);let samples=0,exports=0;
const donors=await Promise.all(catalog.animations.map(a=>load(a.file)));
for(const gender of ['male','female'])for(const outfit of ['Peasant','Ranger']){
 const d=validateDesign(preset(catalog,gender,outfit),catalog);
 assert.throws(()=>validateDesign({...d,parts:{...d.parts,body:'bad'}},catalog));
 const entries=catalog.parts.filter(p=>Object.values(d.parts).includes(p.id));entries.push({...catalog.heads.find(h=>h.gender===gender),slot:'head'});
 if(outfit==='Peasant')entries.push(...catalog.hair.filter(h=>['Hair_Beard','Hair_Long'].includes(h.id)));
 const loaded=await Promise.all(entries.map(async e=>({...e,scene:clone((await load(e.file)).scene)}))),a=assembleParts(loaded),meshes=[];a.root.traverse(o=>{if(o.isMesh)meshes.push(o);});
 assert(meshes.length>=5);assert.equal(a.bones.size,65);
 for(const m of meshes){for(const b of m.skeleton.bones)assert.equal(b,a.bones.get(b.name),'shared bone identity');const pos=m.geometry.attributes.position;let maxRest=0;
 for(let i=0;i<pos.count;i+=Math.max(1,Math.floor(pos.count/70))){const v=new THREE.Vector3().fromBufferAttribute(pos,i),original=v.clone();m.skeleton.update();m.applyBoneTransform(i,v);assert(v.toArray().every(Number.isFinite));if(m.userData.slot!=='hair'&&m.userData.slot!=='beard')maxRest=Math.max(maxRest,v.distanceTo(original));}
 assert(maxRest<.015,`${gender} ${m.name}: unexpected bind shift ${maxRest}`);
 }
 const clips=donors.map((donor,i)=>{const c=adaptAnimation(clone(donor.scene),donor.animations[0],a.root);c.name=catalog.animations[i].label;return c;});
 const mixer=new THREE.AnimationMixer(a.root);
 for(const clip of clips){assert(clip.tracks.length>40);const action=mixer.clipAction(clip).play();for(const frac of [0,.25,.5,.75,.99]){action.time=frac*clip.duration;mixer.update(0);a.root.updateMatrixWorld(true);for(const m of meshes){m.skeleton.update();const pos=m.geometry.attributes.position;for(let i=0;i<pos.count;i+=Math.max(1,Math.floor(pos.count/80))){const v=new THREE.Vector3().fromBufferAttribute(pos,i);m.applyBoneTransform(i,v);assert(v.toArray().every(Number.isFinite));assert(v.length()<4,`${m.name} exploding vertex`);samples++;}}}mixer.stopAllAction();}
 const bytes=await new GLTFExporter().parseAsync(a.root,{binary:true,animations:clips});assert(bytes.byteLength>10000);const rt=await loader.parseAsync(bytes,'');assert.equal(rt.animations.length,3);const bones=new Set();rt.scene.traverse(o=>{if(o.isBone){assert(!bones.has(o.name));bones.add(o.name);}});assert.equal(bones.size,65);exports++;
}
// Every listed part and hairstyle loads; no missing images, buffers, or skinned meshes.
for(const item of [...catalog.parts,...catalog.hair,...catalog.heads]){const g=await load(item.file);let n=0;g.scene.traverse(o=>{if(o.isSkinnedMesh)n++;});assert(n>0,item.id);}
console.log(`Character Creator passed: 20 parts, 2 heads, 6 hair/beard assets; ${samples} animated vertex samples; ${exports} rigged GLB round trips.`);
