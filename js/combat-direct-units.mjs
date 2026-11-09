import {shadowGeometryFor} from './combat-shadow-geometry.mjs';
import {snapshotGpuCaster} from './combat-gpu-casters.mjs';
import {combatPerformance as perf} from './combat-performance.mjs';
import * as THREE from '../assets/vendor/three/three.module.min.js';

// Actual posed geometry, shared by the six facing images and every identical
// appearance. Images remain the bridge to existing pose/equipment selection.
const frames=new WeakMap();
const resources=new Set();
const finalizer=typeof FinalizationRegistry==='function'?new FinalizationRegistry(resource=>{
  const shadow=shadowGeometryFor(resource.geometry);if(shadow!==resource.geometry)shadow.dispose();resource.geometry.dispose();for(const material of resource.materials){for(const value of Object.values(material))if(value?.isTexture)value.dispose();material.dispose();}resources.delete(resource);
}):null;

function prepareDirectMaterial(m){
  m.userData.saturation={value:1};
  m.onBeforeCompile=shader=>{shader.uniforms.unitSaturation=m.userData.saturation;
    shader.fragmentShader='uniform float unitSaturation;\n'+shader.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb=mix(vec3(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722))),diffuseColor.rgb,unitSaturation);');};
  m.customProgramCacheKey=()=>'direct-unit-saturation-1';
  m.userData.baseColor=m.color.clone();m.userData.baseOpacity=m.opacity;
}
export function restoreDirectMaterials(root){root.traverse(object=>{if(!object.isMesh)return;object.frustumCulled=false;const materials=[object.material].flat();for(const m of materials)prepareDirectMaterial(m);const resource={geometry:object.geometry,materials};resources.add(resource);finalizer?.register(object,resource);});}
export function captureDirectUnit(root,camera){
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
    const originals=Array.isArray(object.material)?object.material:[object.material];
    const materials=originals.map(source=>{
      // No captured studio lights or banding: light the original surface now.
      const m=new THREE.MeshStandardMaterial({color:source.color?.clone()||0xffffff,map:source.map?.clone()||null,
        alphaMap:source.alphaMap?.clone()||null,alphaTest:source.alphaTest||0,side:source.side,
        roughness:Math.max(.65,source.roughness??1),metalness:source.metalness||0,
        transparent:source.transparent,opacity:source.opacity,vertexColors:source.vertexColors});
      for(const key of ['normalMap','roughnessMap','metalnessMap','emissiveMap','aoMap'])if(source[key]){m[key]=source[key].clone();m[key].needsUpdate=true;}
      if(source.normalScale)m.normalScale.copy(source.normalScale);
      if(source.emissive)m.emissive.copy(source.emissive);
      m.emissiveIntensity=source.emissiveIntensity??1;m.aoMapIntensity=source.aoMapIntensity??1;
      m.visible=source.visible;
      if(m.map)m.map.needsUpdate=true;if(m.alphaMap)m.alphaMap.needsUpdate=true;
      prepareDirectMaterial(m);
      return m;
    });
    const mesh=new THREE.Mesh(geometry,Array.isArray(object.material)?materials:materials[0]);
    mesh.frustumCulled=false;group.add(mesh);triangles+=(geometry.index?.count||position.count)/3;
    const resource={geometry,materials};resources.add(resource);
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
  const result=gpu.unitScene((renderer,view)=>{
    // Shared rigs must be sampled when the batch executes, not when queued.
    const {asset,yaw,animating}=sampleDirectPose(frame,options.entity,options.walkSeconds);
    if(animating)options.requestMotionFrame?.();
    const camera=asset.camera.clone(),original=asset.camera;
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
    asset.group.traverse(object=>{if(!object.isMesh)return;for(const m of Array.isArray(object.material)?object.material:[object.material]){
      m.color.copy(m.userData.baseColor);m.userData.saturation.value=saturation;
      m.opacity=m.userData.baseOpacity*opacity;const transparent=m.opacity<1||m.userData.baseOpacity<1;if(m.transparent!==transparent){m.transparent=transparent;m.needsUpdate=true;}
    }});
    scene.add(asset.group);try{renderer.render(scene,camera);}finally{scene.remove(asset.group);}
    document.documentElement.dataset.directUnitTriangles=String(asset.triangles);
    return true;
  },{x:x-width*anchor.x,y:y-height*anchor.y,width,height});
  return result===true;
}
export const MODEL_ANIMATION_FPS=30;
export const modelPoseSeconds=seconds=>Math.floor(seconds*MODEL_ANIMATION_FPS)/MODEL_ANIMATION_FPS;
// Share animation sampling across body, shadow and occluded outline passes.
export function sampleDirectPose(frame,entity,walkSeconds=entity?.walkPresentation?.seconds,now=performance.now()){
 let asset=frame.asset,animating=false;
 if(asset.workshopSample){animating=asset.workshopSample(entity,walkSeconds,now);}
 else if(entity&&!entity.alive&&Number.isFinite(entity.deathPresentationStartedAt)&&asset.deathActions){
  asset=asset.deathActions;const time=entity.deathPresentationStartedAt+modelPoseSeconds(Math.max(0,now-entity.deathPresentationStartedAt)/1000)*1000;const prior=asset.lastPose;
  if(prior?.entity===entity&&prior.time===time)animating=prior.animating;else{animating=perf.measure('poseSampling',()=>asset.sample(entity,time));asset.lastPose={entity,time,animating};perf.count('poseSamples');}
 }else if(walkSeconds!==undefined&&asset.walk){asset=asset.walk;const time=modelPoseSeconds(walkSeconds);if(asset.lastPose?.time!==time){perf.measure('poseSampling',()=>asset.sample(time));asset.lastPose={time};perf.count('poseSamples');}animating=true;}
 const deathProgress=entity&&!entity.alive ? (globalThis.adventurePartyCorpseProgress?.(entity,now)||0) : 0;
 const yaw=frame.yaw+(entity?.deathRotationDelta||0)*deathProgress;
 asset.group.rotation.y=yaw;asset.group.updateMatrixWorld(true);
 return {asset,yaw,animating:animating||(deathProgress>0&&deathProgress<1),live:!!asset.workshopSample||asset!==frame.asset};
}
let maskRenderer;
const maskScene=new THREE.Scene(),maskMaterial=new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide});
const liveShadowCache=new WeakMap();
function liveShadow(image,entity){
 const frame=frames.get(image);if(!frame)return null;
 const pose=sampleDirectPose(frame,entity);if(!pose.live)return null;
 const time=entity?.walkPresentation?modelPoseSeconds(entity.walkPresentation.seconds):(pose.animating?modelPoseSeconds(Math.max(0,performance.now()-entity.deathPresentationStartedAt)/1000):'held');
 const key=[pose.yaw,pose.asset.workshopPoseKey??time,entity?.deathPresentationStartedAt].join(':');
 const cached=entity&&liveShadowCache.get(entity);if(cached?.key===key&&cached.asset===pose.asset)return cached.geometry;
 const geometry=perf.measure('shadowSnapshot',()=>snapshotGpuCaster(pose.asset.group,pose.asset.camera));
 if(entity)liveShadowCache.set(entity,{key,asset:pose.asset,geometry});
 return geometry;
}
function liveOutline(image,entity,width,height){
 const frame=frames.get(image);if(!frame)return null;
 const pose=sampleDirectPose(frame,entity);if(!pose.live)return null;
 maskRenderer ||= new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
 maskRenderer.setPixelRatio(1);maskRenderer.setSize(Math.max(1,Math.ceil(width)),Math.max(1,Math.ceil(height)),false);
 maskRenderer.setClearColor(0,0);maskScene.overrideMaterial=maskMaterial;maskScene.add(pose.asset.group);
 try{maskRenderer.render(maskScene,pose.asset.camera);}finally{maskScene.remove(pose.asset.group);}
 maskRenderer.domElement._liveUnitMask=true;
 return maskRenderer.domElement;
}
function gpuOutline(gpu,image,entity,options){
 const frame=frames.get(image);if(!frame||!gpu?.unitOutline)return false;
 const pose=sampleDirectPose(frame,entity),camera=pose.asset.camera.clone(),{pad,width,height}=options;
 const dx=(camera.right-camera.left)/width*pad,dy=(camera.top-camera.bottom)/height*pad;camera.left-=dx;camera.right+=dx;camera.top+=dy;camera.bottom-=dy;camera.updateProjectionMatrix();
 return gpu.unitOutline(renderer=>{maskScene.overrideMaterial=maskMaterial;maskScene.add(pose.asset.group);try{renderer.render(maskScene,camera);}finally{maskScene.remove(pose.asset.group);}},options);
}
globalThis.adventurePartyDirectUnits={draw,gpuOutline,liveShadow,liveOutline,enabled:()=>true};

