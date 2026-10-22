import * as THREE from '../assets/vendor/three/three.module.min.js';
import { GLTFLoader } from '../assets/vendor/three/addons/loaders/GLTFLoader.js';
import { HEX_FACINGS, CAMERA_ELEVATION, quantizeRgba } from './studio-core.mjs?v=R238C57';
import { studioLightPosition } from './studio-geometry.mjs?v=R238C57';
import { WEAPON_POSE_PROFILES, appearanceCacheKey } from './mob-appearance.mjs?v=R238C71';
import { studioWeapon, findRightHand, createWeaponAttachment } from './studio-equipment.mjs?v=R238C67';
import { studioShield, findLeftHand, createRoundWoodenShieldModel, createShieldAttachment } from './studio-shield.mjs?v=R238C71';

const MODEL_URL='../assets/models/dungeon-crawler-carl/v2-ual2-sword-test/dungeon-crawler-carl-v2-ual2-sword-test.glb';
const DEFAULT_FRAME=Object.freeze({
  width:320,height:400,renderWidth:91.56,renderHeight:114.45,
  anchorX:160,anchorY:264.02889936721095
});
const DEFAULT_FRAME_HEIGHT=10.58668090609295;
const DEFAULT_CENTER=[0,2.0595906310059133,0];
const DEFAULT_LIGHTING=Object.freeze({
  ambientIntensity:3,ambientColor:'#abc7d4',keyIntensity:4.85,
  keyColor:'#eeedc3',keyElevation:90,keyDirection:'SW'
});
const DEFAULT_STYLE=Object.freeze({brightness:1.22,contrast:.94,hue:0,saturation:1.97,outline:0});
const FACINGS=['E','NE','NW','W','SW','SE'];
const POSES=['ready','attack','prone'];

const loadGltf=url=>new GLTFLoader().loadAsync(new URL(url,import.meta.url).href);
const finite=(value,fallback)=>Number.isFinite(value)?value:fallback;
const vec3=(value,fallback)=>Array.isArray(value)&&value.length===3&&value.every(Number.isFinite)?value:fallback;

function normalizeFallbackModel(model){
  model.updateMatrixWorld(true);
  const initial=new THREE.Box3().setFromObject(model,true);
  const size=initial.getSize(new THREE.Vector3());
  const center=initial.getCenter(new THREE.Vector3());
  const scale=2/Math.max(size.y,Math.max(size.x,size.z)*0.25,0.001);
  model.scale.setScalar(scale);
  model.position.set(-center.x*scale,-initial.min.y*scale,-center.z*scale);
  model.updateMatrixWorld(true);
}
function loadImage(src){
  return new Promise((resolve,reject)=>{
    const image=new Image();
    image.onload=()=>resolve(image);
    image.onerror=()=>reject(new Error('Generated sprite image could not be decoded.'));
    image.src=src;
  });
}
function normalizedFrame(recipe){
  const frame=recipe.renderSettings?.frame||{};
  return {
    width:Number.isInteger(frame.width)&&frame.width>0?frame.width:DEFAULT_FRAME.width,
    height:Number.isInteger(frame.height)&&frame.height>0?frame.height:DEFAULT_FRAME.height,
    renderWidth:finite(frame.renderWidth,DEFAULT_FRAME.renderWidth),
    renderHeight:finite(frame.renderHeight,DEFAULT_FRAME.renderHeight),
    anchorX:finite(frame.anchorX,DEFAULT_FRAME.anchorX),
    anchorY:finite(frame.anchorY,DEFAULT_FRAME.anchorY)
  };
}
function normalizedStyle(recipe){
  const style=recipe.renderSettings?.style||{};
  return {
    brightness:finite(style.brightness,DEFAULT_STYLE.brightness),
    contrast:finite(style.contrast,DEFAULT_STYLE.contrast),
    hue:finite(style.hue,DEFAULT_STYLE.hue),
    saturation:finite(style.saturation,DEFAULT_STYLE.saturation),
    outline:finite(style.outline,DEFAULT_STYLE.outline)
  };
}
function configureLights(scene,recipe){
  const saved=recipe.renderSettings?.lighting||{};
  const light={...DEFAULT_LIGHTING,...saved};
  scene.add(new THREE.AmbientLight(light.ambientColor||'#ffffff',finite(light.ambientIntensity,1)));
  const key=new THREE.DirectionalLight(light.keyColor||'#ffffff',finite(light.keyIntensity,2.3));
  const position=studioLightPosition(
    HEX_FACINGS.some(f=>f.id===light.keyDirection)?light.keyDirection:'NW',
    finite(light.keyElevation,45)
  );
  key.position.set(position.x,position.y,position.z);
  key.target.position.set(0,0,0);
  scene.add(key,key.target);
}
function buildSceneGraph(model,recipe){
  const turntable=new THREE.Group();
  const calibration=new THREE.Group();
  const placement=new THREE.Group();
  const upAxisGroup=new THREE.Group();
  turntable.add(calibration);
  calibration.add(placement);
  placement.add(upAxisGroup);
  upAxisGroup.add(model);

  const transform=recipe.renderSettings?.transform;
  if(transform?.placement && Number.isFinite(transform.placement.scale)){
    const modelScale=finite(recipe.renderSettings.modelScalePercent,100)/100;
    const hexScale=finite(recipe.renderSettings.hexScalePercent,100)/100;
    const factor=modelScale*hexScale;
    placement.position.fromArray(vec3(transform.placement.position,[0,0,0])).multiplyScalar(factor);
    placement.scale.setScalar(transform.placement.scale*factor);
    upAxisGroup.rotation.x=transform.upAxis==='Z'?-Math.PI/2:0;
    calibration.rotation.y=THREE.MathUtils.degToRad(finite(transform.heading,0));
  }else{
    // Fallback only for older browsers with no complete Studio capture recipe.
    normalizeFallbackModel(model);
  }
  return turntable;
}
function configureCamera(recipe,frame){
  const transform=recipe.renderSettings?.transform;
  const captured=!!transform?.placement;
  const modelScale=finite(recipe.renderSettings?.modelScalePercent,100)/100;
  const hexScale=finite(recipe.renderSettings?.hexScalePercent,100)/100;
  const factor=modelScale*hexScale;
  const frameHeight=captured?finite(transform.frameHeight,DEFAULT_FRAME_HEIGHT)*factor:DEFAULT_FRAME_HEIGHT;
  const center=new THREE.Vector3(...(captured
    ? vec3(transform.center,DEFAULT_CENTER).map(value=>value*factor)
    : DEFAULT_CENTER));
  const halfHeight=frameHeight/2;
  const camera=new THREE.OrthographicCamera(
    -halfHeight*(frame.width/frame.height),halfHeight*(frame.width/frame.height),
    halfHeight,-halfHeight,.01,Math.max(100,frameHeight*6)
  );
  const distance=Math.max(8,frameHeight*2);
  camera.position.copy(center).add(new THREE.Vector3(
    0,Math.sin(CAMERA_ELEVATION),Math.cos(CAMERA_ELEVATION)
  ).multiplyScalar(distance));
  camera.up.set(0,1,0);
  camera.lookAt(center);
  camera.updateProjectionMatrix();
  return camera;
}
function frameCanvas(renderer,target,scene,camera,turntable,yaw,frame,style){
  turntable.rotation.y=yaw;
  renderer.setRenderTarget(target);
  renderer.setClearColor(0x000000,0);
  renderer.clear(true,true,true);
  renderer.render(scene,camera);
  const raw=new Uint8Array(frame.width*frame.height*4);
  renderer.readRenderTargetPixels(target,0,0,frame.width,frame.height,raw);
  // quantizeRgba performs the one required WebGL bottom-up -> canvas top-down
  // conversion. Pre-flipping here inverted the generated frame a second time.
  const canvas=document.createElement('canvas');
  canvas.width=frame.width;
  canvas.height=frame.height;
  const ctx=canvas.getContext('2d');
  const image=ctx.createImageData(frame.width,frame.height);
  quantizeRgba(raw,frame.width,frame.height,image.data,{
    ...style,transparent:true,tileWidth:frame.width,tileHeight:frame.height
  });
  ctx.putImageData(image,0,0);
  return canvas;
}

export async function generateCombatSpriteSet(recipe){
  if(recipe?.mob?.type!=='fighter'){
    throw new Error('On-the-fly rendering is currently limited to Dungeon Crawler Carl.');
  }
  const gltf=await loadGltf(MODEL_URL);
  const model=gltf.scene;
  model.traverse(object=>{if(object.isSkinnedMesh)object.frustumCulled=false;});

  const frame=normalizedFrame(recipe);
  const style=normalizedStyle(recipe);
  const scene=new THREE.Scene();
  const turntable=buildSceneGraph(model,recipe);
  scene.add(turntable);
  configureLights(scene,recipe);
  const camera=configureCamera(recipe,frame);

  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:false,preserveDrawingBuffer:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(1);
  renderer.setSize(frame.width,frame.height,false);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1;
  const target=new THREE.WebGLRenderTarget(frame.width,frame.height,{
    format:THREE.RGBAFormat,type:THREE.UnsignedByteType,
    minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,
    depthBuffer:true,stencilBuffer:false,samples:0
  });
  target.texture.colorSpace=THREE.SRGBColorSpace;

  let attachment=null,shieldAttachment=null;
  if(recipe.equipment){
    const id=recipe.equipment.appearanceId==='battle-axe'?'battle-axe':'medieval-sword';
    const preset=studioWeapon(id);
    const hand=findRightHand(model);
    if(!preset||!hand) throw new Error('The equipped weapon cannot be attached to Carl.');
    const weaponGltf=await loadGltf('../'+recipe.equipment.asset);
    attachment=createWeaponAttachment(THREE,hand,weaponGltf.scene,{
      rightHand:id,
      presetRevision:preset.presetRevision||0,
      sizePercent:recipe.equipment.grip?.sizePercent??100,
      position:recipe.equipment.grip?.position??preset.position,
      rotation:recipe.equipment.grip?.rotationDegrees??preset.rotation
    });
  }
  if(recipe.shield){
    const preset=studioShield(recipe.shield.studioId||recipe.shield.appearanceId);
    const leftHand=findLeftHand(model);
    if(!preset||!leftHand) throw new Error('The equipped shield cannot be attached to Carl.');
    const shieldModel=await createRoundWoodenShieldModel(THREE,new URL('../',import.meta.url));
    const savedShield=studioShield(recipe.renderSettings?.shield?.leftHandShield)?.id===preset.id
      ? recipe.renderSettings.shield : null;
    shieldAttachment=createShieldAttachment(THREE,leftHand,shieldModel,{
      leftHandShield:preset.id,
      presetRevision:preset.presetRevision||0,
      sizePercent:finite(savedShield?.sizePercent,recipe.shield.mount?.sizePercent??100),
      position:savedShield?.position??recipe.shield.mount?.position??preset.position,
      rotation:savedShield?.rotation??recipe.shield.mount?.rotationDegrees??preset.rotation,
      distanceInches:finite(savedShield?.distanceInches,0),
      forearmSlideInches:finite(savedShield?.forearmSlideInches,0),
      forearmRollDegrees:finite(savedShield?.forearmRollDegrees,0)
    });
  }

  const mixer=new THREE.AnimationMixer(model);
  const profile=recipe.poseProfile||WEAPON_POSE_PROFILES['one-handed-swing-v1'];
  const byName=new Map(gltf.animations.map(clip=>[clip.name,clip]));
  const keyId=appearanceCacheKey(recipe).replace(/^mob-appearance-v1-/,'');
  const manifestId='carl-live-'+keyId;
  const images={},sourceUrls={},poses={};
  try{
    for(const capture of POSES){
      const pose=profile?.poses?.[capture];
      if(!pose) throw new Error(`Combat pose recipe is missing ${capture}.`);
      const clip=byName.get(pose.animation)||byName.get(pose.sourceId);
      if(!clip) throw new Error(`Carl animation ${pose.animation} is unavailable.`);
      mixer.stopAllAction();
      const action=mixer.clipAction(clip).reset().setLoop(THREE.LoopOnce,1).play();
      action.paused=true;
      action.time=Math.min(Math.max(0,pose.timeSeconds||0),clip.duration);
      mixer.update(0);
      poses[capture]={clip:clip.name,time:action.time,frames:{}};
      for(const facing of HEX_FACINGS){
        const canvas=frameCanvas(renderer,target,scene,camera,turntable,facing.yawRadians,frame,style);
        const file=`${capture}-${facing.id.toLowerCase()}.png`;
        const src=canvas.toDataURL('image/png');
        images[file]=await loadImage(src);
        sourceUrls[file]=src;
        poses[capture].frames[facing.id]=file;
      }
    }
  }finally{
    attachment?.detach();
    shieldAttachment?.detach();
    shieldAttachment?.model?.traverse(object=>{
      object.geometry?.dispose?.();
      const material=object.material;
      if(Array.isArray(material)) material.forEach(item=>item?.dispose?.());
      else material?.dispose?.();
    });
    mixer.stopAllAction();
    target.dispose();
    renderer.dispose();
  }

  return {
    manifest:{
      schema:'adventure-party.sprite-set',version:1,id:manifestId,
      label:`Dungeon Crawler Carl — ${recipe.equipment?.itemName||'Unarmed'}${recipe.shield?` + ${recipe.shield.itemName}`:''} (generated)`,
      frame:{...frame},
      facings:FACINGS,
      poses,
      layout:{id:recipe.renderSettings?.layoutId||'single',resolutionPercent:finite(recipe.renderSettings?.resolutionPercent,200)},
      mobType:'fighter',
      modelScalePercent:finite(recipe.renderSettings?.modelScalePercent,175),
      hexScalePercent:finite(recipe.renderSettings?.hexScalePercent,109),
      render:{
        generatedAtRuntime:true,
        poseSource:recipe.renderSettings?.source||'built-in-profile',
        appearanceKey:appearanceCacheKey(recipe),
        heightInches:recipe.mob.heightInches,
        equipmentAppearanceId:recipe.equipment?.appearanceId||null,
        shieldAppearanceId:recipe.shield?.appearanceId||null
      }
    },
    images,
    sourceUrls
  };
}
