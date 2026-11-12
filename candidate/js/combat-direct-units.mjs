import {installUnitSnowOcclusion,bindUnitSnowOcclusion,unitSnowGroundMatrix} from './combat-unit-snow-occlusion.mjs';
import {arrowScaleForFrame} from './arrow-visual-profile.mjs?v=R238C305';
import {hasFlamingSword} from './combat-weapon-flame.mjs?v=R238C299';
import {sampleSnowFootfalls,pressCorpseIntoSnow} from './combat-snow-footprints.mjs';
import {prepareCorpseSnow,updateCorpseSnowMap,registerCorpseSnow,snowDisplayToLinear,corpseSnowTint} from './combat-corpse-snow.mjs';
import {warmBowMaterials} from './equipment-visual-states.mjs';
import {shadowGeometryFor,registerShadowGeometry,captureShadowGeometry} from './combat-shadow-geometry.mjs';
import {snapshotGpuCaster} from './combat-gpu-casters.mjs';
import {combatPerformance as perf} from './combat-performance.mjs';
import * as THREE from '../assets/vendor/three/three.module.min.js';

// Actual posed geometry, shared by the six facing images and every identical
// appearance. Images remain the bridge to existing pose/equipment selection.
const frames=new WeakMap();
const snowGroundMatrix=new THREE.Matrix4();
const resources=new Set();
const finalizer=typeof FinalizationRegistry==='function'?new FinalizationRegistry(resource=>{
  const shadow=shadowGeometryFor(resource.geometry);if(shadow!==resource.geometry)shadow.dispose();resource.geometry.dispose();for(const material of resource.materials){if(!resource.sharedTextures)for(const value of Object.values(material))if(value?.isTexture)value.dispose();material.dispose();}resources.delete(resource);
}):null;

function prepareDirectMaterial(m){
  m.userData.saturation={value:1};
  m.onBeforeCompile=shader=>{shader.uniforms.unitSaturation=m.userData.saturation;
    shader.fragmentShader='uniform float unitSaturation;\n'+shader.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb=mix(vec3(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722))),diffuseColor.rgb,unitSaturation);');};
  m.customProgramCacheKey=()=>'direct-unit-saturation-1';
  m.userData.baseColor=m.color.clone();m.userData.baseOpacity=m.opacity;installUnitSnowOcclusion(m);
}
export function restoreDirectMaterials(root){root.traverse(object=>{if(!object.isMesh)return;object.frustumCulled=false;const materials=[object.material].flat();for(const m of materials)prepareDirectMaterial(m);const resource={geometry:object.geometry,materials};resources.add(resource);finalizer?.register(object,resource);});}
export function captureDirectUnit(root,camera,{shareTextures=false}={}){
  const copyTexture=t=>t?(shareTextures?t:t.clone()):null;
  const started=performance.now(),group=new THREE.Group(),inverse=new THREE.Matrix4();
  root.updateMatrixWorld(true);inverse.copy(root.matrixWorld).invert();
  let triangles=0;
  root.traverseVisible(object=>{
    if(!object.isMesh||!object.geometry?.attributes.position)return;
    object.skeleton?.update();
    const geometry=object.geometry.clone(),position=geometry.attributes.position;
    const matrix=new THREE.Matrix4().multiplyMatrices(inverse,object.matrixWorld),p=new THREE.Vector3();
    for(let i=0;i<position.count;i++){object.getVertexPosition(i,p).applyMatrix4(matrix);position.setXYZ(i,p.x,p.y,p.z);}
    geometry.deleteAttribute('skinIndex');geometry.deleteAttribute('skinWeight');geometry.morphAttributes={};
    geometry.computeVertexNormals();geometry.computeBoundingSphere();
    const shadow=captureShadowGeometry(object,matrix);if(shadow)registerShadowGeometry(geometry,shadow);
    const originals=Array.isArray(object.material)?object.material:[object.material];
    const materials=originals.map(source=>{
      // No captured studio lights or banding: light the original surface now.
      const m=new THREE.MeshStandardMaterial({color:source.color?.clone()||0xffffff,map:copyTexture(source.map),
        alphaMap:copyTexture(source.alphaMap),alphaTest:source.alphaTest||0,side:source.side,
        roughness:Math.max(.65,source.roughness??1),metalness:source.metalness||0,
        transparent:source.transparent,opacity:source.opacity,vertexColors:source.vertexColors});
      for(const key of ['normalMap','roughnessMap','metalnessMap','emissiveMap','aoMap'])if(source[key]){m[key]=copyTexture(source[key]);if(!shareTextures)m[key].needsUpdate=true;}
      if(source.normalScale)m.normalScale.copy(source.normalScale);
      if(source.emissive)m.emissive.copy(source.emissive);
      m.emissiveIntensity=source.emissiveIntensity??1;m.aoMapIntensity=source.aoMapIntensity??1;
      m.visible=source.visible;
      if(!shareTextures){if(m.map)m.map.needsUpdate=true;if(m.alphaMap)m.alphaMap.needsUpdate=true;}
      prepareDirectMaterial(m);
      return m;
    });
    const mesh=new THREE.Mesh(geometry,Array.isArray(object.material)?materials:materials[0]);
    mesh.frustumCulled=false;group.add(mesh);triangles+=(geometry.index?.count||position.count)/3;
    const resource={geometry,materials,sharedTextures:shareTextures};resources.add(resource);
    // The token holds resources, never the mesh itself.
    finalizer?.register(mesh,resource);
  });
  camera.updateMatrixWorld(true);
  return {group,camera:camera.clone(),triangles,preparationMs:performance.now()-started};
}
export function setDirectUnit(image,asset,yaw){frames.set(image,{asset,yaw});}
export function directUnitFrame(image){return frames.get(image);}

const scene=new THREE.Scene(),ambient=new THREE.HemisphereLight(0xdce8ff,0x655a43,1),sun=new THREE.DirectionalLight(0xfff1d7,1);
const lights=Array.from({length:4},()=>new THREE.PointLight(0xffffff,0));
scene.add(ambient,sun,...lights);
function draw(gpu,image,options){
  const frame=frames.get(image);if(!frame||!gpu?.unitScene)return false;

  const {x,y,width,height,anchor,solar,ambientPercent,outdoor,localLights,opacity=1,saturation=1}=options;
  const burnState=options.entity?.burnReaction,now=performance.now();
  const burnT=burnState?(now-burnState.started)/burnState.duration:2;
  const burn=burnT>=0&&burnT<1?{time:(now-burnState.started)/1000,opacity:Math.min(1,burnT*9,(1-burnT)*3)}:null;
  const weaponFlame=options.equipmentEffects!==false&&hasFlamingSword(options.entity)?{time:now/1000,opacity:opacity*.95,core:.25,scale:Math.max(.5,Math.min(4,height/160))}:null;
  if(weaponFlame)options.requestMotionFrame?.();
  const result=gpu.unitScene((renderer,view)=>{
    // Shared rigs must be sampled when the batch executes, not when queued.
    const {asset,yaw,animating}=sampleDirectPose(frame,options.entity,options.walkSeconds,undefined,width);
    if(animating)options.requestMotionFrame?.();
    if(asset.corpseSnow?.value>0&&!asset.corpseSnowPrepared){
      perf.measure('corpseSnowBake',()=>prepareCorpseSnow(asset.group,options.entity,asset.corpseSnow));asset.corpseSnowPrepared=true;
      asset.group.traverse(mesh=>{if(!mesh.userData.corpseSnowShell)return;const resource={geometry:mesh.geometry,materials:[mesh.material],sharedTextures:true};resources.add(resource);finalizer?.register(mesh,resource);});
    }
    if(asset.corpseSnowPrepared)updateCorpseSnowMap(asset.corpseSnow);
    const camera=asset.drawCamera||(asset.drawCamera=asset.camera.clone()),original=asset.camera;
    original.updateMatrixWorld(true); // Workshop cameras are captured without a prior renderer update.
    const scaleX=width*view.zoom/(original.right-original.left),scaleY=height*view.zoom/(original.top-original.bottom);
    const left=(x-width*anchor.x)*view.zoom+view.anchor.x*(1-view.zoom);
    const top=(y-height*anchor.y)*view.zoom+view.anchor.y*(1-view.zoom);
    camera.left=original.left-(left-(view.crop?.x||0))/scaleX;camera.right=camera.left+(view.crop?.width||view.width)/scaleX;
    camera.top=original.top+(top-(view.crop?.y||0))/scaleY;camera.bottom=camera.top-(view.crop?.height||view.height)/scaleY;camera.updateProjectionMatrix();
    const rotation=options.rotation||0,c=Math.cos(rotation),s=Math.sin(rotation);
    const d=solar?.direction||{x:0,y:1,z:0};sun.position.set(c*d.x-s*d.z,d.y,s*d.x+c*d.z);
    sun.intensity=outdoor?2.2*(solar?.daylight??1):0;
    ambient.intensity=Math.max(.015,ambientPercent/100*(outdoor?(solar?.sky??1):1)*.65);
    // Units/metre are derived from the same captured frame and standing height
    // used by sprites; light coordinates are supplied in physical metres.
    const factor=options.pixelsPerMetre*(original.top-original.bottom)/height/Math.sqrt(1-original.matrixWorld.elements[6]**2);
    lights.forEach((light,i)=>{const source=localLights[i];light.intensity=0;if(!source)return;
      const [lx,ly,lz]=source.position;light.position.set((c*lx-s*lz)*factor,ly*factor,(s*lx+c*lz)*factor);
      light.color.setRGB(...source.color);light.distance=source.range*factor;light.decay=2;light.intensity=source.intensity*factor*factor;
    });
    asset.group.rotation.y=yaw;
    asset.group.updateMatrixWorld(true);
    if(weaponFlame){weaponFlame.root=asset.group;weaponFlame.camera=camera;}
    sampleSnowFootfalls(asset.group,options.entity,{...options,poseSeconds:modelPoseSeconds(now/1000),modelUnitsPerMetre:factor},view,original);
    asset.group.traverse(node=>{
      if(!node.userData.drawnArrow||!node.visible||!options.entity)return;
      const tip=node.localToWorld(new THREE.Vector3(0,1,0)).project(original);
      options.entity.bowReleaseScreenPoint={x:x-width*anchor.x+(tip.x+1)*width/2,y:y-height*anchor.y+(1-tip.y)*height/2};
    });
    const snowSurface=options.entity&&options.outdoor!==false?gpu.unitSnowSurface:null;
    if(snowSurface||asset.workshopPoseKey==='settled')unitSnowGroundMatrix(original,options,view,snowGroundMatrix);
    if(asset.workshopPoseKey==='settled'&&options.outdoor!==false)pressCorpseIntoSnow(asset.group,options.entity,snowGroundMatrix);
    const snowTint=asset.corpseSnow?.value>0?corpseSnowTint(asset.corpseSnow.value):null;
    const snowLight=asset.corpseSnow?.value>0?snowDisplayToLinear((options.snowGroundLight||[0,0,0]).map((v,i)=>v*snowTint[i]),renderer.getRenderTarget?.()?.texture?.type===THREE.HalfFloatType):null;
    asset.group.traverse(object=>{if(!object.isMesh)return;for(const m of Array.isArray(object.material)?object.material:[object.material]){
      bindUnitSnowOcclusion(m,snowSurface,snowGroundMatrix,factor,!!options.entity);
      if(m.userData.corpseSnowMetres)m.userData.corpseSnowMetres.value=factor;
      if(snowLight&&m.userData.corpseSnowGroundLight)m.userData.corpseSnowGroundLight.value.copy(snowLight);
      m.color.copy(m.userData.baseColor);if(options.entity?.fireDeath&&!options.entity.alive)m.color.multiplyScalar(.045);m.userData.saturation.value=options.entity?.fireDeath&&!options.entity.alive?0:saturation;
      m.opacity=m.userData.baseOpacity*opacity;const transparent=m.opacity<1||m.userData.baseOpacity<1;if(m.transparent!==transparent){m.transparent=transparent;m.needsUpdate=true;}
    }});
    scene.add(asset.group);try{warmBowMaterials(renderer,scene,camera,asset.group);renderer.render(scene,camera);}finally{scene.remove(asset.group);}
    document.documentElement.dataset.directUnitTriangles=String(asset.triangles);
    return true;
  },{x:x-width*anchor.x,y:y-height*anchor.y,width,height},burn,weaponFlame,settledCorpseImage(frame,{...options,snowSurfaceRevision:gpu.unitSnowSurface?gpu.unitSnowRevision:null}));
  return result===true;
}
export const MODEL_ANIMATION_FPS=30;
export const modelPoseSeconds=seconds=>Math.floor(seconds*MODEL_ANIMATION_FPS)/MODEL_ANIMATION_FPS;
// A settled corpse owns a baked pose, never resampling the shared live rig.
const settledCorpses=new WeakMap();
export function corpseSnowAmount(entity){const cached=settledCorpses.get(entity);return entity&&!entity.alive&&cached&&Number.isFinite(entity.deathPresentationStartedAt)&&cached.started===entity.deathPresentationStartedAt?cached.asset.corpseSnow?.value||0:0;}
export function settledCorpseImage(frame,options){
 const e=options.entity,c=settledCorpses.get(e);
 if(!e||e.alive||!c||c.source!==frame.asset||c.started!==e.deathPresentationStartedAt)return null;
 const {x,y,width,height,anchor,rotation,solar,ambientPercent,outdoor,localLights,opacity=1,saturation=1,snowGroundLight}=options;
 return {owner:c.asset,key:JSON.stringify([frame.yaw,globalThis.adventurePartyUnitViewYawOffset?.()||0,e.aimYawOffset||0,e.deathRotationDelta||0,
  x,y,width,height,anchor,rotation,solar,ambientPercent,outdoor,localLights,opacity,saturation,options.pixelsPerMetre,!!e.fireDeath,c.asset.corpseSnow?.value||0,snowGroundLight,options.snowSurfaceRevision])};
}
// Share animation sampling across body, shadow and occluded outline passes.
export function sampleDirectPose(frame,entity,walkSeconds=entity?.walkPresentation?.seconds,now=performance.now(),width){
 let asset=frame.asset,animating=false;
 const corpse=entity&&!entity.alive&&Number.isFinite(entity.deathPresentationStartedAt);
 const cached=corpse&&settledCorpses.get(entity);
 const frozen=cached&&cached.source===frame.asset&&cached.started===entity.deathPresentationStartedAt;
 if(frozen){asset=cached.asset;perf.count('settledCorpseCacheHits');}
 else
 if(asset.workshopSample){animating=perf.measure('workshopPoseSampling',()=>asset.workshopSample(entity,walkSeconds,now,arrowScaleForFrame(asset.camera,width)));}
 else if(entity&&!entity.alive&&Number.isFinite(entity.deathPresentationStartedAt)&&asset.deathActions){
  asset=asset.deathActions;const time=entity.deathPresentationStartedAt+modelPoseSeconds(Math.max(0,now-entity.deathPresentationStartedAt)/1000)*1000;const prior=asset.lastPose;
  if(prior?.entity===entity&&prior.time===time)animating=prior.animating;else{animating=perf.measure('poseSampling',()=>asset.sample(entity,time));asset.lastPose={entity,time,animating};perf.count('poseSamples');}
 }else if(walkSeconds!==undefined&&asset.walk){asset=asset.walk;const time=modelPoseSeconds(walkSeconds);if(asset.lastPose?.time!==time){perf.measure('poseSampling',()=>asset.sample(time));asset.lastPose={time};perf.count('poseSamples');}animating=true;}
 const deathProgress=entity&&!entity.alive ? (globalThis.adventurePartyCorpseProgress?.(entity,now)||0) : 0;
 if(corpse&&!frozen&&!animating&&deathProgress>=1){
  const source=asset;
  asset=perf.measure('corpseBake',()=>captureDirectUnit(source.group,source.camera,{shareTextures:true}));
  asset.workshopPoseKey='settled';
  asset.corpseSnow=registerCorpseSnow(entity);
  settledCorpses.set(entity,{source:frame.asset,started:entity.deathPresentationStartedAt,asset});
  perf.count('corpseBakes');
 }
 const viewOffset=globalThis.adventurePartyUnitViewYawOffset?.()||0;
 const yaw=frame.yaw+viewOffset+(entity?.aimYawOffset||0)+(entity?.deathRotationDelta||0)*deathProgress;
 asset.group.rotation.y=yaw;asset.group.updateMatrixWorld(true);
 return {asset,yaw,animating:animating||(deathProgress>0&&deathProgress<1),live:!!asset.workshopSample||asset!==frame.asset};
}
let maskRenderer;
const maskScene=new THREE.Scene(),maskMaterial=new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide});
const liveShadowCache=new WeakMap();
function liveShadow(image,entity,width){
 const frame=frames.get(image);if(!frame)return null;
 // Prepared standing poses must use the same geometry/camera as the body too.
 // Older saved 2D shadow captures can have a different pose or scale.
 const pose=sampleDirectPose(frame,entity,undefined,undefined,width);
 const time=entity?.walkPresentation?modelPoseSeconds(entity.walkPresentation.seconds):(pose.animating?modelPoseSeconds(Math.max(0,performance.now()-entity.deathPresentationStartedAt)/1000):'held');
 const key=[pose.yaw,pose.asset.workshopPoseKey??time,entity?.deathPresentationStartedAt].join(':');
 const cached=entity&&liveShadowCache.get(entity);if(cached?.key===key&&cached.asset===pose.asset)return cached.geometry;
 const geometry=perf.measure('shadowSnapshot',()=>snapshotGpuCaster(pose.asset.group,pose.asset.camera));
 if(entity)liveShadowCache.set(entity,{key,asset:pose.asset,geometry});
 return geometry;
}
function liveOutline(image,entity,width,height){
 const frame=frames.get(image);if(!frame)return null;
 const pose=sampleDirectPose(frame,entity,undefined,undefined,width);if(!pose.live)return null;
 maskRenderer ||= new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
 maskRenderer.setPixelRatio(1);maskRenderer.setSize(Math.max(1,Math.ceil(width)),Math.max(1,Math.ceil(height)),false);
 maskRenderer.setClearColor(0,0);maskScene.overrideMaterial=maskMaterial;maskScene.add(pose.asset.group);
 try{maskRenderer.render(maskScene,pose.asset.camera);}finally{maskScene.remove(pose.asset.group);}
 maskRenderer.domElement._liveUnitMask=true;
 return maskRenderer.domElement;
}
function gpuOutline(gpu,image,entity,options){
 const frame=frames.get(image);if(!frame||!gpu?.unitOutline)return false;
 const {pad,width,height}=options,pose=sampleDirectPose(frame,entity,undefined,undefined,width),camera=pose.asset.camera.clone();
 const dx=(camera.right-camera.left)/width*pad,dy=(camera.top-camera.bottom)/height*pad;camera.left-=dx;camera.right+=dx;camera.top+=dy;camera.bottom-=dy;camera.updateProjectionMatrix();
 return gpu.unitOutline(renderer=>{maskScene.overrideMaterial=maskMaterial;maskScene.add(pose.asset.group);try{renderer.render(maskScene,camera);}finally{maskScene.remove(pose.asset.group);}},options);
}
globalThis.adventurePartyDirectUnits={draw,gpuOutline,liveShadow,liveOutline,corpseSnowAmount,enabled:()=>true};

