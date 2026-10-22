import * as THREE from '../assets/vendor/three/three.module.min.js';
import { GLTFLoader } from '../assets/vendor/three/addons/loaders/GLTFLoader.js';
import { HEX_FACINGS, CAMERA_ELEVATION, quantizeRgba } from './studio-core.mjs?v=R238C57';
import { WEAPON_POSE_PROFILES, appearanceCacheKey } from './mob-appearance.mjs?v=R238C61';
import { studioWeapon, findRightHand, createWeaponAttachment } from './studio-equipment.mjs?v=R238C61';

const MODEL_URL='../assets/models/dungeon-crawler-carl/v2-ual2-sword-test/dungeon-crawler-carl-v2-ual2-sword-test.glb';
const WIDTH=320, HEIGHT=400;
const RENDER_WIDTH=91.56, RENDER_HEIGHT=114.45;
const FRAME_HEIGHT=10.58668090609295;
const CENTER=new THREE.Vector3(0,2.0595906310059133,0);
const LIGHTING={ambientIntensity:3,ambientColor:'#abc7d4',keyIntensity:4.85,keyColor:'#eeedc3'};
const FACINGS=['E','NE','NW','W','SW','SE'];
const POSES=[['ready','stand'],['attack','attack'],['prone','prone']];

let modelPromise=null;
const loadGltf=url=>new GLTFLoader().loadAsync(new URL(url,import.meta.url).href);
async function baseModel(){
  if(!modelPromise) modelPromise=loadGltf(MODEL_URL);
  return modelPromise;
}
function cloneObject(source){
  const clone=source.clone(true);
  const sourceSkinned=[],cloneSkinned=[];
  source.traverse(o=>{if(o.isSkinnedMesh) sourceSkinned.push(o);});
  clone.traverse(o=>{if(o.isSkinnedMesh) cloneSkinned.push(o);});
  for(let i=0;i<sourceSkinned.length;i++){
    const src=sourceSkinned[i], dst=cloneSkinned[i];
    if(!src?.skeleton||!dst) continue;
    const bones=src.skeleton.bones.map(b=>clone.getObjectByName(b.name)).filter(Boolean);
    if(bones.length===src.skeleton.bones.length) dst.bind(new THREE.Skeleton(bones,src.skeleton.boneInverses),dst.bindMatrix);
  }
  return clone;
}
function loadImage(src){
  return new Promise((resolve,reject)=>{
    const image=new Image();
    image.onload=()=>resolve(image);
    image.onerror=()=>reject(new Error('Generated sprite image could not be decoded.'));
    image.src=src;
  });
}
function frameCanvas(renderer,target,scene,camera,turntable,yaw,options){
  turntable.rotation.y=yaw;
  renderer.setRenderTarget(target);
  renderer.setClearColor(0x000000,0);
  renderer.clear(true,true,true);
  renderer.render(scene,camera);
  const raw=new Uint8Array(WIDTH*HEIGHT*4);
  renderer.readRenderTargetPixels(target,0,0,WIDTH,HEIGHT,raw);
  const flipped=new Uint8Array(raw.length);
  for(let y=0;y<HEIGHT;y++) flipped.set(raw.subarray(y*WIDTH*4,(y+1)*WIDTH*4),(HEIGHT-1-y)*WIDTH*4);
  const canvas=document.createElement('canvas');
  canvas.width=WIDTH; canvas.height=HEIGHT;
  const ctx=canvas.getContext('2d');
  const image=ctx.createImageData(WIDTH,HEIGHT);
  quantizeRgba(flipped,WIDTH,HEIGHT,image.data,{brightness:1.22,contrast:.94,hue:0,saturation:1.97,outline:0,transparent:true,tileWidth:WIDTH,tileHeight:HEIGHT});
  ctx.putImageData(image,0,0);
  return canvas;
}
export async function generateCombatSpriteSet(recipe){
  if(recipe?.mob?.type!=='fighter') throw new Error('On-the-fly rendering is currently limited to Dungeon Crawler Carl.');
  const gltf=await baseModel();
  const model=cloneObject(gltf.scene);
  model.traverse(o=>{if(o.isSkinnedMesh)o.frustumCulled=false;});
  const scene=new THREE.Scene();
  const turntable=new THREE.Group();
  turntable.add(model); scene.add(turntable);
  scene.add(new THREE.AmbientLight(LIGHTING.ambientColor,LIGHTING.ambientIntensity));
  const key=new THREE.DirectionalLight(LIGHTING.keyColor,LIGHTING.keyIntensity);
  key.position.set(-1,8,-1); scene.add(key); scene.add(key.target);
  const camera=new THREE.OrthographicCamera(-FRAME_HEIGHT*WIDTH/HEIGHT/2,FRAME_HEIGHT*WIDTH/HEIGHT/2,FRAME_HEIGHT/2,-FRAME_HEIGHT/2,.01,100);
  const distance=22;
  camera.position.copy(CENTER).add(new THREE.Vector3(0,Math.sin(CAMERA_ELEVATION),Math.cos(CAMERA_ELEVATION)).multiplyScalar(distance));
  camera.lookAt(CENTER); camera.updateProjectionMatrix();
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:false,preserveDrawingBuffer:false});
  renderer.setSize(WIDTH,HEIGHT,false); renderer.outputColorSpace=THREE.SRGBColorSpace;
  const target=new THREE.WebGLRenderTarget(WIDTH,HEIGHT,{format:THREE.RGBAFormat,type:THREE.UnsignedByteType,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,depthBuffer:true,stencilBuffer:false});
  target.texture.colorSpace=THREE.SRGBColorSpace;
  let attachment=null;
  if(recipe.equipment){
    const id=recipe.equipment.appearanceId==='battle-axe'?'battle-axe':'medieval-sword';
    const preset=studioWeapon(id);
    const hand=findRightHand(model);
    if(!preset||!hand) throw new Error('The equipped weapon cannot be attached to Carl.');
    const weaponGltf=await loadGltf('../'+recipe.equipment.asset);
    attachment=createWeaponAttachment(THREE,hand,weaponGltf.scene,{
      rightHand:id,
      sizePercent:recipe.equipment.grip?.sizePercent??preset.defaultSizePercent??100,
      position:recipe.equipment.grip?.position??preset.position,
      rotation:recipe.equipment.grip?.rotationDegrees??preset.rotation
    });
  }
  const mixer=new THREE.AnimationMixer(model);
  const profile=recipe.poseProfile||WEAPON_POSE_PROFILES['one-handed-swing-v1'];
  const byName=new Map(gltf.animations.map(c=>[c.name,c]));
  const keyId=appearanceCacheKey(recipe).replace(/^mob-appearance-v1-/,'');
  const manifestId='carl-live-'+keyId;
  const images={}, sourceUrls={}, poses={};
  try{
    for(const [capture] of POSES){
      const pose=profile.poses[capture];
      const clip=byName.get(pose.animation);
      if(!clip) throw new Error(`Carl animation ${pose.animation} is unavailable.`);
      mixer.stopAllAction();
      const action=mixer.clipAction(clip).reset().setLoop(THREE.LoopOnce,1).play();
      action.paused=true; action.time=Math.min(Math.max(0,pose.timeSeconds||0),clip.duration);
      mixer.update(0);
      poses[capture]={clip:clip.name,time:action.time,frames:{}};
      for(const facing of HEX_FACINGS){
        const canvas=frameCanvas(renderer,target,scene,camera,turntable,facing.yawRadians);
        const file=`${capture}-${facing.id.toLowerCase()}.png`;
        const src=canvas.toDataURL('image/png');
        images[file]=await loadImage(src);
        sourceUrls[file]=src;
        poses[capture].frames[facing.id]=file;
      }
    }
  } finally {
    attachment?.detach();
    mixer.stopAllAction();
    target.dispose(); renderer.dispose();
  }
  return {
    manifest:{
      schema:'adventure-party.sprite-set',version:1,id:manifestId,
      label:`Dungeon Crawler Carl — ${recipe.equipment?.itemName||'Unarmed'} (live)`,
      frame:{width:WIDTH,height:HEIGHT,renderWidth:RENDER_WIDTH,renderHeight:RENDER_HEIGHT,anchorX:160,anchorY:264.02889936721095},
      facings:FACINGS,poses,layout:{id:'single',resolutionPercent:200},mobType:'fighter',modelScalePercent:175,hexScalePercent:109,
      render:{generatedAtRuntime:true,appearanceKey:appearanceCacheKey(recipe),heightInches:recipe.mob.heightInches}
    },
    images,sourceUrls
  };
}
