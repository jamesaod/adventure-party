import * as THREE from '../assets/vendor/three/three.module.min.js';
import { GLTFLoader } from '../assets/vendor/three/addons/loaders/GLTFLoader.js';
import { HEX_FACINGS, CAMERA_ELEVATION, quantizeRgba } from './studio-core.mjs?v=R238C57';
import { WEAPON_POSE_PROFILES, appearanceCacheKey } from './mob-appearance.mjs?v=R238C63';
import { studioWeapon, findRightHand, createWeaponAttachment } from './studio-equipment.mjs?v=R238C63';

const MODEL_URL='../assets/models/dungeon-crawler-carl/v2-ual2-sword-test/dungeon-crawler-carl-v2-ual2-sword-test.glb';
const DEFAULT_FRAME=Object.freeze({
  width:320,height:400,renderWidth:91.56,renderHeight:114.45,
  anchorX:160,anchorY:264.02889936721095
});
const DEFAULT_FRAME_HEIGHT=10.58668090609295;
const DEFAULT_CENTER=Object.freeze([0,2.0595906310059133,0]);
const DEFAULT_LIGHTING=Object.freeze({
  ambientIntensity:3,ambientColor:'#abc7d4',
  keyIntensity:4.85,keyColor:'#eeedc3',
  keyElevation:90,keyDirection:'SW'
});
const DEFAULT_STYLE=Object.freeze({
  brightness:1.22,contrast:.94,hue:0,saturation:1.97,outline:0
});
const FACINGS=Object.freeze(['E','NE','NW','W','SW','SE']);
const POSES=Object.freeze(['ready','attack','prone']);

const loadGltf=url=>new GLTFLoader().loadAsync(new URL(url,import.meta.url).href);
const finite=(value,fallback)=>Number.isFinite(value)?value:fallback;
const vector3=(value,fallback)=>Array.isArray(value)&&value.length===3&&value.every(Number.isFinite)
  ? value.slice() : fallback.slice();

function normalizeModel(model){
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

function lightingPosition(directionId,elevationDegrees,distance=10){
  const facing=HEX_FACINGS.find(item=>item.id===directionId) || HEX_FACINGS[0];
  const elevation=THREE.MathUtils.degToRad(finite(elevationDegrees,45));
  const horizontal=Math.cos(elevation)*distance;
  return new THREE.Vector3(
    Math.sin(facing.yawRadians)*horizontal,
    Math.sin(elevation)*distance,
    Math.cos(facing.yawRadians)*horizontal
  );
}

function buildRenderContext(model,settings){
  const captured=settings?.source==='studio-capture-workspace' && settings?.transform;
  const frame={
    width:Math.max(1,Math.round(finite(settings?.frame?.width,DEFAULT_FRAME.width))),
    height:Math.max(1,Math.round(finite(settings?.frame?.height,DEFAULT_FRAME.height))),
    renderWidth:finite(settings?.frame?.renderWidth,DEFAULT_FRAME.renderWidth),
    renderHeight:finite(settings?.frame?.renderHeight,DEFAULT_FRAME.renderHeight),
    anchorX:finite(settings?.frame?.anchorX,DEFAULT_FRAME.anchorX),
    anchorY:finite(settings?.frame?.anchorY,DEFAULT_FRAME.anchorY)
  };
  const turntable=new THREE.Group();
  let center,frameHeight;

  if(captured){
    const calibration=new THREE.Group();
    const placement=new THREE.Group();
    const axis=new THREE.Group();
    turntable.add(calibration);
    calibration.add(placement);
    placement.add(axis);
    axis.add(model);

    const factor=finite(settings.modelScalePercent,100)/100*finite(settings.hexScalePercent,100)/100;
    const transform=settings.transform;
    calibration.rotation.y=THREE.MathUtils.degToRad(finite(transform.heading,0));
    axis.rotation.x=transform.upAxis==='Z' ? -Math.PI/2 : 0;
    placement.position.fromArray(vector3(transform.placement?.position,[0,0,0])).multiplyScalar(factor);
    placement.scale.setScalar(finite(transform.placement?.scale,1)*factor);
    center=new THREE.Vector3(...vector3(transform.center,DEFAULT_CENTER)).multiplyScalar(factor);
    frameHeight=finite(transform.frameHeight,DEFAULT_FRAME_HEIGHT)*factor;
  }else{
    normalizeModel(model);
    turntable.add(model);
    center=new THREE.Vector3(...DEFAULT_CENTER);
    frameHeight=DEFAULT_FRAME_HEIGHT;
  }

  return {captured,frame,turntable,center,frameHeight};
}

function frameCanvas(renderer,target,scene,camera,turntable,yaw,frame,style){
  turntable.rotation.y=yaw;
  renderer.setRenderTarget(target);
  renderer.setClearColor(0x000000,0);
  renderer.clear(true,true,true);
  renderer.render(scene,camera);

  const raw=new Uint8Array(frame.width*frame.height*4);
  renderer.readRenderTargetPixels(target,0,0,frame.width,frame.height,raw);
  const flipped=new Uint8Array(raw.length);
  for(let y=0;y<frame.height;y++){
    flipped.set(
      raw.subarray(y*frame.width*4,(y+1)*frame.width*4),
      (frame.height-1-y)*frame.width*4
    );
  }

  const canvas=document.createElement('canvas');
  canvas.width=frame.width;
  canvas.height=frame.height;
  const ctx=canvas.getContext('2d');
  const image=ctx.createImageData(frame.width,frame.height);
  quantizeRgba(flipped,frame.width,frame.height,image.data,{
    brightness:finite(style?.brightness,DEFAULT_STYLE.brightness),
    contrast:finite(style?.contrast,DEFAULT_STYLE.contrast),
    hue:finite(style?.hue,DEFAULT_STYLE.hue),
    saturation:finite(style?.saturation,DEFAULT_STYLE.saturation),
    outline:finite(style?.outline,DEFAULT_STYLE.outline),
    transparent:true,tileWidth:frame.width,tileHeight:frame.height
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
  model.traverse(object=>{ if(object.isSkinnedMesh) object.frustumCulled=false; });

  const settings=recipe.renderSettings || {};
  const {frame,turntable,center,frameHeight}=buildRenderContext(model,settings);
  const scene=new THREE.Scene();
  scene.add(turntable);

  const lighting={...DEFAULT_LIGHTING,...(settings.lighting||{})};
  if(lighting.legacyRig){
    scene.add(new THREE.HemisphereLight(0xe5efff,0x5b4634,1.8));
  }
  scene.add(new THREE.AmbientLight(lighting.ambientColor||'#ffffff',finite(lighting.ambientIntensity,1)));
  const key=new THREE.DirectionalLight(lighting.keyColor||'#ffffff',finite(lighting.keyIntensity,2.3));
  key.position.copy(lightingPosition(lighting.keyDirection||'NW',lighting.keyElevation,10)).add(center);
  key.target.position.copy(center);
  scene.add(key,key.target);

  const aspect=frame.width/frame.height;
  const camera=new THREE.OrthographicCamera(
    -frameHeight*aspect/2,frameHeight*aspect/2,
    frameHeight/2,-frameHeight/2,.01,Math.max(100,frameHeight*6)
  );
  const distance=Math.max(8,frameHeight*2);
  camera.position.copy(center).add(
    new THREE.Vector3(0,Math.sin(CAMERA_ELEVATION),Math.cos(CAMERA_ELEVATION)).multiplyScalar(distance)
  );
  camera.up.set(0,1,0);
  camera.lookAt(center);
  camera.updateProjectionMatrix();

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
      rotation:recipe.equipment.grip?.rotationDegrees??preset.rotation,
      presetRevision:preset.presetRevision
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
      const clip=byName.get(pose.animation);
      if(!clip) throw new Error(`Carl animation ${pose.animation} is unavailable.`);

      mixer.stopAllAction();
      const action=mixer.clipAction(clip).reset().setLoop(THREE.LoopOnce,1).play();
      action.paused=true;
      action.time=Math.min(Math.max(0,finite(pose.timeSeconds,0)),clip.duration);
      mixer.update(0);

      poses[capture]={clip:clip.name,time:action.time,frames:{}};
      for(const facing of HEX_FACINGS){
        const canvas=frameCanvas(
          renderer,target,scene,camera,turntable,facing.yawRadians,
          frame,settings.style
        );
        const file=`${capture}-${facing.id.toLowerCase()}.png`;
        const src=canvas.toDataURL('image/png');
        images[file]=await loadImage(src);
        sourceUrls[file]=src;
        poses[capture].frames[facing.id]=file;
      }
    }
  }finally{
    attachment?.detach();
    mixer.stopAllAction();
    target.dispose();
    renderer.dispose();
  }

  return {
    manifest:{
      schema:'adventure-party.sprite-set',version:1,id:manifestId,
      label:`Dungeon Crawler Carl — ${recipe.equipment?.itemName||'Unarmed'} (live)`,
      frame:{
        width:frame.width,height:frame.height,
        renderWidth:frame.renderWidth,renderHeight:frame.renderHeight,
        anchorX:frame.anchorX,anchorY:frame.anchorY
      },
      facings:FACINGS,poses,
      layout:{id:settings.layoutId||'single',resolutionPercent:settings.resolutionPercent||200},
      mobType:'fighter',
      modelScalePercent:finite(settings.modelScalePercent,175),
      hexScalePercent:finite(settings.hexScalePercent,109),
      render:{
        generatedAtRuntime:true,
        appearanceKey:appearanceCacheKey(recipe),
        heightInches:recipe.mob.heightInches,
        poseRecipeSource:settings.source||'built-in-profile',
        workspaceSavedAt:settings.workspaceSavedAt||null
      }
    },
    images,sourceUrls
  };
}
