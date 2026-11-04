import * as THREE from '../assets/vendor/three/three.module.min.js';

export const normalizedShading=value=>value==='toon-3'?'toon-3':'standard';

// Temporary material substitution keeps model assets, rigs and attachment materials intact.
// The ordinary renderer still handles skinning, morphs, alpha, lighting and capture.
export function createBandedLighting(){
 const gradient=new THREE.DataTexture(new Uint8Array([48,48,48,255,140,140,140,255,255,255,255,255]),3,1,THREE.RGBAFormat);
 gradient.minFilter=gradient.magFilter=THREE.NearestFilter;
 gradient.generateMipmaps=false;gradient.needsUpdate=true;
 const materials=new Map();
 function materialFor(source){
  if(!source||!(source.isMeshStandardMaterial||source.isMeshPhongMaterial||source.isMeshLambertMaterial))return source;
  let entry=materials.get(source);
  if(!entry){
   const material=new THREE.MeshToonMaterial({gradientMap:gradient});
   const release=()=>{material.dispose();source.removeEventListener('dispose',release);materials.delete(source);};
   entry={material,release,version:-1};materials.set(source,entry);source.addEventListener('dispose',release);
  }
  const target=entry.material;
  for(const key of ['color','emissive','normalScale'])if(source[key]&&target[key])target[key].copy(source[key]);
  for(const key of ['map','alphaMap','normalMap','normalMapType','bumpMap','bumpScale','displacementMap','displacementScale','displacementBias','emissiveMap','emissiveIntensity','aoMap','aoMapIntensity','opacity','transparent','alphaTest','side','vertexColors','depthWrite','depthTest','visible','wireframe','flatShading','fog','toneMapped','polygonOffset','polygonOffsetFactor','polygonOffsetUnits']){
   if(key in source&&key in target)target[key]=source[key];
  }
  if(entry.version!==source.version){target.needsUpdate=true;entry.version=source.version;}
  return target;
 }
 return {
  render(renderer,scene,camera,mode){
   if(normalizedShading(mode)==='standard')return renderer.render(scene,camera);
   const originals=[];
   try{
    scene.traverse(object=>{
     if(!object.isMesh||!object.material)return;
     const original=object.material;
     const replacement=Array.isArray(original)?original.map(materialFor):materialFor(original);
     if(replacement!==original){originals.push([object,original]);object.material=replacement;}
    });
    return renderer.render(scene,camera);
   }finally{for(const [object,material] of originals)object.material=material;}
  },
  dispose(){for(const entry of [...materials.values()])entry.release();gradient.dispose();}
 };
}
