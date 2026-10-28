import { createGroundShadowMaterial, renderGroundShadow, shadowPixelsCanvas } from './ground-shadow-geometry.mjs?v=R238C169';
import { setGroundShadow } from './unit-sun-shadow.mjs?v=R238C169';
import { SPRITE_POSES } from './sprite-set-core.mjs?v=R238C176';
import { FBXLoader } from '../assets/vendor/three/addons/loaders/FBXLoader.js?v=R238C178';
import { loadUploadedFbxAnimations } from './repository-fbx-animations.mjs?v=R238C178';
import { retargetHumanoidClip } from './mixamo-retarget.mjs?v=R238C140';
import { prepareStudioAnimations } from './studio-animations.mjs?v=R238C82';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import { GLTFLoader } from '../assets/vendor/three/addons/loaders/GLTFLoader.js';
import { HEX_FACINGS, CAMERA_ELEVATION, quantizeRgba } from './studio-core.mjs?v=R238C97';
import { preserveThinSpriteDetails } from './studio-thin-detail.mjs?v=R238C119';
import { spriteOutlinePixels } from './sprite-outline.mjs?v=R238C120';
import { resolveCombatWeaponMount } from './combat-weapon-mount.mjs?v=R238C125';
import { applyWarriorRecolor, isWarriorRecolorModel } from './warrior-recolor.mjs?v=R238C127';
import { studioLightPosition } from './studio-geometry.mjs?v=R238C97';
import { appearanceCacheKey } from './mob-appearance.mjs?v=R238C189';
import { poseProfileForHumanoid } from './humanoid-animation-catalog.mjs?v=R238C146';
import { studioWeapon, weaponAssetUrl, findWeaponHand, createWeaponAttachment, normalizeOffHandEquipment } from './studio-equipment.mjs?v=R238C176';
import { studioShield, findLeftHand, createShieldAttachment } from './studio-shield.mjs?v=R238C176';

const DEFAULT_FIGHTER_MODEL_URL='../assets/models/dungeon-crawler-carl/v2-ual2-sword-test/dungeon-crawler-carl-v2-ual2-sword-test.glb';
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
const LEGACY_POSES=['ready','attack','prone'];
const WINDUP_POSES = SPRITE_POSES;

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
    outline:finite(style.outline,DEFAULT_STYLE.outline),
    outlineInches:Number.isFinite(style.outlineInches)?Math.max(0,style.outlineInches):null
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
    if(transform.normalizeRest)normalizeFallbackModel(model);
    placement.position.fromArray(vec3(transform.placement.position,[0,0,0])).multiplyScalar(factor);
    placement.scale.setScalar(transform.placement.scale*factor);
    upAxisGroup.rotation.x=transform.upAxis==='Z'?-Math.PI/2:0;
    calibration.rotation.y=THREE.MathUtils.degToRad(finite(transform.heading,0));
  }else{
    // Fallback only for older browsers with no complete Studio capture recipe.
    normalizeFallbackModel(model);
    // The legacy frame/camera already includes the authored 175% model and
    // 109% hex calibration. Apply that same factor to the normalized body;
    // otherwise the async equipment render replaces it at roughly half size.
    const modelScale=finite(recipe.renderSettings?.modelScalePercent,175)/100;
    const hexScale=finite(recipe.renderSettings?.hexScalePercent,109)/100;
    placement.scale.setScalar(modelScale*hexScale);
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
function topDownRgba(raw,width,height){
  const result=new Uint8ClampedArray(raw.length);
  const stride=width*4;
  for(let y=0;y<height;y++){
    const from=(height-1-y)*stride;
    result.set(raw.subarray(from,from+stride),y*stride);
  }
  return result;
}

function quantizedCanvas(source,width,height,style,{flipY=true}={}){
  const canvas=document.createElement('canvas');
  canvas.width=width;
  canvas.height=height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const image=ctx.createImageData(width,height);
  quantizeRgba(source,width,height,image.data,{
    ...style,transparent:true,tileWidth:width,tileHeight:height,flipY
  });
  ctx.putImageData(image,0,0);
  return canvas;
}

function frameCanvases(renderer,target,scene,camera,turntable,yaw,frame,style,shadowMaterial){
  turntable.rotation.y=yaw;
  renderer.setRenderTarget(target);
  renderer.setClearColor(0x000000,0);
  renderer.clear(true,true,true);
  renderer.render(scene,camera);

  const raw=new Uint8Array(frame.width*frame.height*4);
  renderer.readRenderTargetPixels(target,0,0,frame.width,frame.height,raw);

  // Preserve the high-resolution editor image, but convert the physical
  // outline to this frame's pixel density.
  const nativeWidth=Math.max(1,Math.round(frame.renderWidth));
  const nativeHeight=Math.max(1,Math.round(frame.renderHeight));
  const sourceCanvas=quantizedCanvas(raw,frame.width,frame.height,{
    ...style,
    outline:spriteOutlinePixels(style,frame.width,nativeWidth,frame.width)
  });

  // Downsample raw WebGL pixels before palette and outline, just like Studio.
  // Source-frame outline pixels MUST NOT be reused at native combat size.
  const sourceTopDown=topDownRgba(raw,frame.width,frame.height);
  const supersample=document.createElement('canvas');
  supersample.width=frame.width;
  supersample.height=frame.height;
  const supersampleCtx=supersample.getContext('2d',{willReadFrequently:true});
  supersampleCtx.putImageData(new ImageData(sourceTopDown,frame.width,frame.height),0,0);

  const reduced=document.createElement('canvas');
  reduced.width=nativeWidth;
  reduced.height=nativeHeight;
  const reducedCtx=reduced.getContext('2d',{willReadFrequently:true});
  reducedCtx.clearRect(0,0,nativeWidth,nativeHeight);
  reducedCtx.imageSmoothingEnabled=true;
  reducedCtx.imageSmoothingQuality='high';
  reducedCtx.drawImage(
    supersample,0,0,frame.width,frame.height,
    0,0,nativeWidth,nativeHeight
  );
  const reducedRgba=reducedCtx.getImageData(0,0,nativeWidth,nativeHeight).data;
  // Studio's thin-detail protection must also apply to regenerated equipment.
  // Each runtime facing is its own atlas tile, hence columns=rows=1.
  preserveThinSpriteDetails(sourceTopDown,frame.width,frame.height,
    reducedRgba,nativeWidth,nativeHeight,1,1);
  const battlefieldCanvas=quantizedCanvas(
    reducedRgba,nativeWidth,nativeHeight,{
      ...style,
      outline:spriteOutlinePixels(style,nativeWidth,nativeWidth,frame.width)
    },{flipY:false}
  );

  renderer.clear(true,true,true);
  renderGroundShadow(renderer,scene,camera,shadowMaterial);
  const shadowRaw=new Uint8Array(raw.length);
  renderer.readRenderTargetPixels(target,0,0,frame.width,frame.height,shadowRaw);
  const groundShadow=shadowPixelsCanvas(shadowRaw,frame.width,frame.height);
  return {sourceCanvas,battlefieldCanvas,nativeWidth,nativeHeight,groundShadow};
}

export async function generateCombatSpriteSet(recipe){
  const modelUrl=recipe?.model?.url||(recipe?.mob?.type==='fighter'?DEFAULT_FIGHTER_MODEL_URL:null);
  if(!modelUrl)throw new Error(`No humanoid runtime model is registered for ${recipe?.mob?.type||'this MOB'}.`);
  const gltf=await loadGltf(modelUrl);
  const model=gltf.scene;
  // Source-only GLBs use the catalog's animation library, just as Studio does.
  // Keep the ID fallback for older Carl recipes without this metadata.
  if(recipe?.model?.animationLibrary==='uploaded-fbx'||recipe?.model?.id==='dungeon-crawler-carl-v3'){
    gltf.animations=await loadUploadedFbxAnimations({
      appRoot:new URL('../',import.meta.url),targetModel:model,FBXLoader,THREE,
      prepareStudioAnimations,retargetHumanoidClip,
      disposeModel(source){source.traverse(object=>{
        object.geometry?.dispose?.();
        for(const material of [object.material].flat().filter(Boolean))material.dispose?.();
      });}
    });
  }
  model.traverse(object=>{if(object.isSkinnedMesh)object.frustumCulled=false;});
  if(isWarriorRecolorModel(recipe?.model?.id)){
    applyWarriorRecolor(THREE,model,recipe.renderSettings?.appearanceRecolor);
  }

  const frame=normalizedFrame(recipe);
  const style=normalizedStyle(recipe);
  const scene=new THREE.Scene();
  const turntable=buildSceneGraph(model,recipe);
  scene.add(turntable);
  configureLights(scene,recipe);
  const camera=configureCamera(recipe,frame);

  // Match the Studio's source WebGL antialiasing before native-size
  // downsampling. The battlefield pixels must come from the same capture
  // resolution and silhouette detail as the saved Studio test.
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:false,powerPreference:'high-performance'});
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

  let attachment=null,shieldAttachment=null,offHandAttachment=null;
  if(recipe.equipment){
    const id=recipe.equipment.studioId||recipe.equipment.appearanceId;
    const preset=studioWeapon(id);
    const hand=findWeaponHand(model,preset);
    if(!preset||!hand) throw new Error('The equipped weapon cannot be attached to this humanoid.');
    const weaponUrl=weaponAssetUrl({file:recipe.equipment.asset,
      assetSha256:recipe.equipment.asset===preset.file ? preset.assetSha256 : null},new URL('../',import.meta.url));
    const weaponGltf=await loadGltf(weaponUrl.href);
    const mount=resolveCombatWeaponMount(recipe.equipment,recipe.renderSettings,preset);
    attachment=createWeaponAttachment(THREE,hand,weaponGltf.scene,{
      rightHand:id,
      presetRevision:preset.presetRevision||0,
      sizePercent:mount.sizePercent,
      position:mount.position,
      rotation:mount.rotation
    });
  }
  const savedOffHand=normalizeOffHandEquipment(recipe.renderSettings?.offHandEquipment||{});
  const primaryId=recipe.equipment?.studioId||recipe.equipment?.appearanceId||'none';
  const samePrimary=(recipe.renderSettings?.equipment?.rightHand||'none')===primaryId;
  if(savedOffHand.rightHand!=='none'&&samePrimary&&!recipe.shield&&studioWeapon(primaryId)?.handsRequired!==2){
    const preset=studioWeapon(savedOffHand.rightHand),hand=findLeftHand(model);
    if(!hand)throw new Error('The off-hand weapon needs a left-hand bone.');
    const loaded=await loadGltf(weaponAssetUrl(preset,new URL('../',import.meta.url)).href);
    offHandAttachment=createWeaponAttachment(THREE,hand,loaded.scene,savedOffHand,{attachmentHand:'left'});
  }
  if(recipe.shield){
    const preset=studioShield(recipe.shield.studioId||recipe.shield.appearanceId);
    const leftHand=findLeftHand(model);
    if(!preset||!leftHand) throw new Error('The equipped shield cannot be attached to this humanoid.');
    const shieldGltf=await loadGltf('../'+recipe.shield.asset);
    const savedShield=studioShield(recipe.renderSettings?.shield?.leftHandShield)?.id===preset.id
      ? recipe.renderSettings.shield : null;
    shieldAttachment=createShieldAttachment(THREE,leftHand,shieldGltf.scene,{
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
  const profile=recipe.poseProfile||poseProfileForHumanoid(recipe.animation?.semanticId||'one-handed-swing');
  const byName=new Map(gltf.animations.map(clip=>[clip.name,clip]));
  const keyId=appearanceCacheKey(recipe).replace(/^mob-appearance-v1-/,'');
  const manifestId=`${recipe.mob?.type||'humanoid'}-live-${keyId}`;
  const poseNames=WINDUP_POSES.filter(name=>profile?.poses?.[name]);
  const images={},runtimeImages={},sourceUrls={},poses={};
  const shadowMaterial=createGroundShadowMaterial();
  try{
    for(const capture of poseNames){
      const pose=profile?.poses?.[capture];
      if(!pose) continue; // Absent pose is represented by fallback art in the combat renderer.
      // Prefer the captured clip from the matching baked model, but a stale
      // clip name must not disable equipment rendering altogether.
      const defaultPose=poseProfileForHumanoid('one-handed-swing').poses[capture];
      const clip=[pose.animation,pose.sourceId,defaultPose?.animation,defaultPose?.sourceId,
        capture==='ready'?'Mixamo_sword_and_shield_idle':null,
        capture==='attack'?'Mixamo_sword_and_shield_attack':null,
        capture==='prone'?'Mixamo_sword_and_shield_death':null]
        .map(name=>name&&byName.get(name)).find(Boolean)||gltf.animations[0];
      if(!clip) throw new Error('The selected combat model has no playable animation clips.');
      mixer.stopAllAction();
      const action=mixer.clipAction(clip).reset().setLoop(THREE.LoopOnce,1).play();
      action.paused=true;
      action.time=Math.min(Math.max(0,pose.timeSeconds||0),clip.duration);
      mixer.update(0);
      poses[capture]={clip:clip.name,time:action.time,frames:{}};
      for(const facing of HEX_FACINGS){
        const rendered=frameCanvases(
          renderer,target,scene,camera,turntable,facing.yawRadians,frame,style,shadowMaterial
        );
        const file=`${capture}-${facing.id.toLowerCase()}.png`;
        const src=rendered.sourceCanvas.toDataURL('image/png');
        images[file]=await loadImage(src);
        setGroundShadow(images[file],rendered.groundShadow);
        sourceUrls[file]=src;
        poses[capture].frames[facing.id]=file;

        const runtimeFile=`${capture}-${facing.id.toLowerCase()}-battlefield.png`;
        const runtimeSrc=rendered.battlefieldCanvas.toDataURL('image/png');
        runtimeImages[runtimeFile]=await loadImage(runtimeSrc);
        setGroundShadow(runtimeImages[runtimeFile],rendered.groundShadow);
        sourceUrls[runtimeFile]=runtimeSrc;
      }
    }
  }finally{
    attachment?.detach();
    offHandAttachment?.detach();
    offHandAttachment?.model?.traverse(object=>{
      object.geometry?.dispose?.();
      for(const material of Array.isArray(object.material)?object.material:[object.material]){
        if(!material)continue;
        for(const value of Object.values(material))if(value?.isTexture)value.dispose();
        material.dispose?.();
      }
    });
    shieldAttachment?.detach();
    shieldAttachment?.model?.traverse(object=>{
      object.geometry?.dispose?.();
      const material=object.material;
      if(Array.isArray(material)) material.forEach(item=>item?.dispose?.());
      else material?.dispose?.();
    });
    mixer.stopAllAction();
    shadowMaterial.dispose();
    target.dispose();
    renderer.dispose();
  }

  return {
    manifest:{
      schema:'adventure-party.sprite-set',version:1,id:manifestId,
      label:`${recipe.mob?.name||recipe.mob?.type||'Humanoid'} — ${recipe.equipment?.itemName||'Unarmed'}${recipe.shield?` + ${recipe.shield.itemName}`:''} (generated)`,
      frame:{...frame},
      facings:FACINGS,
      poses,partialPoses:true,actionProfileId:recipe.animation?.semanticId||profile?.semanticId||'one-handed-swing',
      layout:{id:recipe.renderSettings?.layoutId||'single',resolutionPercent:finite(recipe.renderSettings?.resolutionPercent,200)},
      mobType:recipe.mob?.type||null,
      modelScalePercent:finite(recipe.renderSettings?.modelScalePercent,175),
      hexScalePercent:finite(recipe.renderSettings?.hexScalePercent,109),
      windupDurationMs:profile?.poses?.windup ? Math.max(0,Math.min(1500,Number(recipe.renderSettings?.windupDurationMs ?? 250))) : undefined,
      sheet:{file:'sheet.png',columns:6,rows:WINDUP_POSES.length,poses:[...WINDUP_POSES],facings:FACINGS},
      battlefield:{
        renderer:'supersampled-battlefield-v2',
        width:Math.max(1,Math.round(frame.renderWidth)),
        height:Math.max(1,Math.round(frame.renderHeight)),
        anchorX:frame.anchorX/frame.width*Math.max(1,Math.round(frame.renderWidth)),
        anchorY:frame.anchorY/frame.height*Math.max(1,Math.round(frame.renderHeight)),
        poses:Object.fromEntries(poseNames.map(capture=>[capture,{
          frames:Object.fromEntries(FACINGS.map(facing=>[
            facing,`${capture}-${facing.toLowerCase()}-battlefield.png`
          ]))
        }]))
      },
      render:{
        generatedAtRuntime:true,
        renderer:'supersampled-battlefield-v2',
        poseSource:recipe.renderSettings?.source||'built-in-profile',
        appearanceKey:appearanceCacheKey(recipe),
        heightInches:recipe.mob.heightInches,
        equipmentAppearanceId:recipe.equipment?.appearanceId||null,
        shieldAppearanceId:recipe.shield?.appearanceId||null
      }
    },
    images,
    runtimeImages,
    sourceUrls
  };
}
