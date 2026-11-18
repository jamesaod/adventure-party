import fs from 'node:fs';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';import {registerHooks} from 'node:module';
const root=process.argv[2]?pathToFileURL(process.argv[2].replace(/\\/g,'/')+'/'):new URL('../',import.meta.url),three=new URL('assets/vendor/three/three.module.min.js',root).href;registerHooks({resolve(s,c,n){return s==='three'?{url:three,shortCircuit:true}:n(s,c);}});
globalThis.ProgressEvent=class{};globalThis.FileReader=class{readAsArrayBuffer(b){b.arrayBuffer().then(r=>{this.result=r;this.onloadend?.();});}};
const T=await import(three),{GLTFLoader}=await import(new URL('assets/vendor/three/addons/loaders/GLTFLoader.js',root)),{GLTFExporter}=await import(new URL('assets/vendor/three/addons/exporters/GLTFExporter.js',root));
const {clone}=await import(new URL('assets/vendor/three/addons/utils/SkeletonUtils.js',root)),{attachHelmet,helmetSettings}=await import(new URL('js/workshop-helmet.mjs',root));const loader=new GLTFLoader();
async function load(url){const b=fs.readFileSync(url);let g,bin;if(url.pathname.endsWith('.glb')){const n=b.readUInt32LE(12);g=JSON.parse(b.subarray(20,20+n));bin=b.subarray(28+n);}else{g=JSON.parse(b);bin=fs.readFileSync(new URL(g.buffers[0].uri,url));}delete g.images;delete g.textures;delete g.samplers;g.materials=(g.materials||[]).map(m=>({name:m.name}));g.buffers=[{uri:'data:application/octet-stream;base64,'+bin.toString('base64'),byteLength:bin.length}];return loader.parseAsync(JSON.stringify(g),'');}
const helmet=await load(new URL('assets/characters/custom/tripo-helmet.glb',root));
for(const family of ['quaternius','synty-starter']){
 if(family==='synty-starter'&&!fs.existsSync(new URL('assets/characters/synty-starter/catalog.json',root))){console.log('SKIP optional local Synty assets');continue;}
 const base=new URL('assets/characters/'+family+'/',root),catalog=JSON.parse(fs.readFileSync(new URL('catalog.json',base))),core=await import(new URL('js/'+(family==='quaternius'?'character-creator':'synty-workshop')+'-core.mjs',root));
 const variants=family==='quaternius'?['male','female']:catalog.presets.map(p=>p.id);
 for(const variant of variants){const d=core.preset(catalog,variant),parts=catalog.parts.filter(p=>Object.values(d.parts).includes(p.id));if(family==='quaternius')parts.push({...catalog.heads.find(h=>h.gender===variant),slot:'head'});
 const entries=await Promise.all(parts.map(async p=>({...p,slot:p.slot==='Torso'?'body':p.slot,scene:clone((await load(new URL(p.file,base))).scene)}))),a=core.assembleParts(entries);core.applyShape?.(a.root,d);
 attachHelmet(a,helmet.scene,{enabled:true,hideHead:true});a.root.updateMatrixWorld(true);const f=a.helmet,bone=f.wrapper.parent,relative=f.wrapper.matrix.clone();
 a.root.traverse(m=>{if(['head','Head','EyeLeft','EyeRight','Nose'].includes(m.userData.slot))assert(m.visible,'Head and face must remain visible, including legacy saved designs');});
 for(const m of a.materials.filter(m=>m.userData.customHelmet)){assert.equal(m.transparent,false);assert.equal(m.opacity,1);assert.equal(m.depthWrite,true);}
 console.log(family+' / '+variant+' passed');
 for(const anim of catalog.animations){const donor=await load(new URL(anim.file,base)),clip=core.adaptAnimation(clone(donor.scene),donor.animations[0],a.root),mixer=new T.AnimationMixer(a.root),action=mixer.clipAction(clip).play();action.time=clip.duration*.4;mixer.update(0);a.root.updateMatrixWorld(true);const actual=bone.matrixWorld.clone().invert().multiply(f.wrapper.matrixWorld);assert(actual.elements.every((v,i)=>Math.abs(v-relative.elements[i])<1e-4),'helmet must follow head');mixer.stopAllAction();}
 const bytes=await new GLTFExporter().parseAsync(a.root,{binary:true,onlyVisible:true});const rt=await loader.parseAsync(bytes,'');const exported=rt.scene.getObjectByName('Tripo_Horned_Helmet');assert(exported);assert.equal(exported.parent.name.toLowerCase(),'head');
 }
}
assert.throws(()=>helmetSettings({scale:NaN}));console.log('Helmet head-follow and GLB attachment round trips passed for available character variants.');


