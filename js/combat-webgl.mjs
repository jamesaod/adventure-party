import {combatLightGLSL,packCombatLights} from './combat-light-shader.mjs?v=R238C250';
import * as THREE from '../assets/vendor/three/three.module.min.js';

// Combat owns world coordinates and its established painter ordering. This
// backend owns GPU resources, projection, sampling and compositing only.
export function combatProjection(point,view){
 const {x,y,elevation=0}=point,[a,b,c,d,tx,ty]=view.matrix;
 return {x:view.anchor.x+(a*x+c*y+tx-view.anchor.x)*view.zoom,
  y:view.anchor.y+(b*x+d*y+ty-elevation-view.anchor.y)*view.zoom};
}
export function triangulateSurfaces(surfaces){
 const position=[],uv=[],multiply=[],boost=[],add=[],lightPoint=[],lightNormal=[],lightWorld=[],visibility=[],tint=[];
 for(const face of surfaces){
  if(face.points.length<3)continue;
  for(let i=1;i<face.points.length-1;i++)for(const j of [0,i,i+1]){
   const p=face.points[j];lightPoint.push(...(face.lightPoints?.[j]||[0,0,0]));lightNormal.push(...(face.lightNormal||[0,1,0]));lightWorld.push(...(face.lightWorld?.[j]||[p.x,p.y]));visibility.push(face.visibility??1);tint.push(...(face.tint||[1,1,1]));position.push(p.x,p.y,p.elevation||0);
   uv.push(...(face.uv?.[j]||[0,0]));
   multiply.push(...(face.multiply||[1,1,1]));boost.push(...(face.boost||[0,0,0]));add.push(...(face.add||[0,0,0]));
  }
 }
 return {position,uv,multiply,boost,add,lightPoint,lightNormal,lightWorld,visibility,tint};
}
const vertexShader=`
 attribute vec3 lightPoint,lightNormal,surfaceTint; attribute vec2 lightSampleWorld; attribute float surfaceVisibility;
 attribute vec3 surfaceMultiply; attribute vec3 surfaceBoost; attribute vec3 surfaceAdd;
 uniform bool screenSpace; uniform mat3 combatView; uniform vec2 anchor; uniform float zoom;
 varying vec3 vLightPoint,vLightNormal,vTint; varying vec2 vLightWorld; varying float vVisibility;
 varying vec2 vUv; varying vec2 vWorld; varying vec3 vMultiply; varying vec3 vBoost; varying vec3 vAdd;
 void main(){
  vec2 screen=(combatView*vec3(position.xy,1.)).xy-vec2(0.,position.z);
  screen=anchor+(screen-anchor)*zoom;
  gl_Position=projectionMatrix*vec4(screenSpace?position.xy:screen,0.,1.);
  vLightPoint=lightPoint;vLightNormal=lightNormal;vLightWorld=lightSampleWorld;vVisibility=surfaceVisibility;vTint=surfaceTint;
  vUv=uv;vWorld=position.xy;vMultiply=surfaceMultiply;vBoost=surfaceBoost;vAdd=surfaceAdd;
 }`;
const fragmentShader=`
 ${combatLightGLSL}
 uniform bool dynamicLighting,spriteLighting; uniform float surfaceOpacity;
 uniform sampler2D artwork; uniform sampler2D lightMultiply; uniform sampler2D lightBoost;
 uniform bool useLightMap; uniform vec4 lightBounds;
 varying vec3 vLightPoint,vLightNormal,vTint; varying vec2 vLightWorld; varying float vVisibility;
 varying vec2 vUv; varying vec2 vWorld; varying vec3 vMultiply; varying vec3 vBoost; varying vec3 vAdd;
 void main(){
  vec4 texel=texture2D(artwork,vUv);
  vec3 m=vMultiply,b=vBoost;
  if(useLightMap){
   vec2 lightUv=(vWorld-lightBounds.xy)/lightBounds.zw;lightUv.y=1.-lightUv.y;
   m*=texture2D(lightMultiply,lightUv).rgb;b=texture2D(lightBoost,lightUv).rgb;
  }
  vec3 factor=m/max(vec3(.0001),vec3(1.)-b),radiance=vec3(0.);
  if(dynamicLighting){
   vec3 base=pow(max(vec3(.0001),factor),vec3(2.2));
   combatLight(vLightWorld,vLightPoint,normalize(vLightNormal),base,radiance);
   factor=pow(max(vec3(.01),base),vec3(1./2.2));
  }
  radiance*=step(.1001,vVisibility);
  vec3 lit=factor*vVisibility;
  if(spriteLighting){float brightness=clamp(dot(lit+radiance,vec3(.2126,.7152,.0722)),.02,1.);gl_FragColor=vec4(texel.rgb*brightness,texel.a*surfaceOpacity);}
  else gl_FragColor=vec4(clamp(texel.rgb*lit*vTint+vAdd+radiance,0.,1.),texel.a*surfaceOpacity);
 }`;

export function createCombatRenderer(canvas,raster,{onLost=()=>{},onRestored=()=>{}}={}){
 const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false,powerPreference:'default'});
 if(!gl)throw Error('Combat requires WebGL 2. Enable browser hardware acceleration and check your graphics driver, then retry.');
 const renderer=new THREE.WebGLRenderer({canvas,context:gl,antialias:false});
 renderer.autoClear=false;renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.info.autoReset=false;
 renderer.setClearColor(0x08080c,1);renderer.toneMapping=THREE.NoToneMapping;
 renderer.debug.onShaderError=()=>{throw Error('The combat graphics shader could not compile on this device.');};
 const camera=new THREE.OrthographicCamera(0,1080,0,600,-1,1),scene=new THREE.Scene();
 const rasterTexture=new THREE.CanvasTexture(raster);
 // Match existing artwork/display RGB arithmetic; no second gamma conversion.
 rasterTexture.colorSpace=THREE.NoColorSpace;rasterTexture.generateMipmaps=false;
 rasterTexture.minFilter=rasterTexture.magFilter=THREE.LinearFilter;
 const quadGeometry=new THREE.PlaneGeometry(2,2);
 const quadMaterial=new THREE.ShaderMaterial({uniforms:{artwork:{value:rasterTexture}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader:'uniform sampler2D artwork;varying vec2 vUv;void main(){gl_FragColor=texture2D(artwork,vUv);}',
  transparent:true,depthTest:false,depthWrite:false,toneMapped:false});
 const quad=new THREE.Mesh(quadGeometry,quadMaterial);quad.frustumCulled=false;
 const records=[],textures=new Map();let slot=0,lost=false,disposed=false,view;
 let dirty=false,frameOpen=false,needsBackdrop=false,lighting=null;
 const maskTexture=new THREE.CanvasTexture(raster);maskTexture.colorSpace=THREE.NoColorSpace;maskTexture.generateMipmaps=false;maskTexture.minFilter=maskTexture.magFilter=THREE.NearestFilter;maskTexture.flipY=true;
 const raw=raster.getContext('2d');
 const drawing=new Set(['fill','stroke','fillRect','strokeRect','fillText','strokeText','drawImage','putImageData']);
 // Keep Canvas 2D for sprite/VFX/UI authoring; flush only when it actually drew.
 const context=new Proxy(raw,{get(target,key){const value=Reflect.get(target,key,target);if(typeof value!=='function')return value;
  return (...args)=>{if(drawing.has(key)){prepareOverlay();dirty=true;}return value.apply(target,args);};},set(target,key,value){Reflect.set(target,key,value,target);return true;}});
 function clearRaster(){raw.save();raw.setTransform(1,0,0,1,0,0);raw.clearRect(0,0,raster.width,raster.height);raw.restore();dirty=false;}
 function paint(mesh){scene.add(mesh);renderer.render(scene,camera);scene.remove(mesh);}
 function prepareOverlay(){
  if(!needsBackdrop||lost||disposed)return;
  // Canvas effects use destination-dependent blends (lighter, multiply, etc.).
  // Seed their batch with the current GPU scene so those operations retain
  // their exact semantics. Call before installing an effect's local clip.
  raw.save();raw.setTransform(1,0,0,1,0,0);raw.globalAlpha=1;raw.globalCompositeOperation='copy';raw.filter='none';raw.shadowBlur=0;raw.shadowColor='transparent';
  raw.drawImage(canvas,0,0);raw.restore();needsBackdrop=false;
 }
 function texture(image,repeat=false){
  let t=textures.get(image);if(t)return t;
  t=new THREE.Texture(image);t.colorSpace=THREE.NoColorSpace;
  t.wrapS=t.wrapT=repeat?THREE.RepeatWrapping:THREE.ClampToEdgeWrapping;
  t.generateMipmaps=repeat;t.minFilter=repeat?THREE.LinearMipmapLinearFilter:THREE.LinearFilter;
  t.magFilter=THREE.LinearFilter;t.anisotropy=repeat?Math.min(4,renderer.capabilities.getMaxAnisotropy()):1;
  t.needsUpdate=true;textures.set(image,t);return t;
 }
 function flush(){if(!dirty||lost||disposed)return;rasterTexture.needsUpdate=true;paint(quad);clearRaster();needsBackdrop=true;}
 function release(record){record.mesh.geometry.dispose();record.mesh.material.dispose();}
 const lostListener=event=>{event.preventDefault();lost=true;onLost();};
 const restoredListener=()=>{lost=false;for(const t of textures.values())t.needsUpdate=true;rasterTexture.needsUpdate=true;maskTexture.needsUpdate=true;onRestored();};
 canvas.addEventListener('webglcontextlost',lostListener);canvas.addEventListener('webglcontextrestored',restoredListener);
 return {
  context,
  get available(){return !lost&&!disposed;},
  prepareOverlay,
  setLighting(next){lighting=next;if(next){next.packed=packCombatLights(next.lights);if(next.mask!==maskTexture.image||next.maskRevision!==maskTexture.userData.revision){if(maskTexture.image.width!==next.mask.width||maskTexture.image.height!==next.mask.height)maskTexture.dispose();maskTexture.image=next.mask;maskTexture.userData.revision=next.maskRevision;maskTexture.needsUpdate=true;}}},
  presentOverlay(){flush();},
  begin(nextView){
   if(lost||disposed)return false;
   view=nextView;lighting=null;slot=0;frameOpen=true;needsBackdrop=false;clearRaster();renderer.info.reset();
   const width=canvas.width,height=canvas.height;
   if(width>renderer.capabilities.maxTextureSize||height>renderer.capabilities.maxTextureSize)throw Error('Combat resolution exceeds this device’s graphics limits.');
   if(raster.width!==width||raster.height!==height){raster.width=width;raster.height=height;}
   renderer.setViewport(0,0,width,height);renderer.clear(true,false,false);
   camera.right=view.width;camera.bottom=view.height;camera.updateProjectionMatrix();return true;
  },
  surface(surfaces,image,{lightMap=null,dynamicLighting=false,spriteLighting=false,screenSpace=false,opacity=1}={}){
   if(lost||!frameOpen||!surfaces.length||!image)return;
   flush();let record=records[slot++];
   if(!record){
    const geometry=new THREE.BufferGeometry(),material=new THREE.ShaderMaterial({vertexShader,fragmentShader,
     uniforms:{dynamicLighting:{value:false},spriteLighting:{value:false},screenSpace:{value:false},surfaceOpacity:{value:1},emitterCount:{value:0},emitterPosition:{value:new Float32Array(128)},emitterColor:{value:new Float32Array(128)},emitterShape:{value:new Float32Array(128)},emitterBounds:{value:new Float32Array(128)},emitterMask:{value:maskTexture},lightWorld:{value:new THREE.Vector4(1,1,0,0)},artwork:{value:null},lightMultiply:{value:null},lightBoost:{value:null},useLightMap:{value:false},lightBounds:{value:new THREE.Vector4()},combatView:{value:new THREE.Matrix3()},anchor:{value:new THREE.Vector2()},zoom:{value:1}},
     depthTest:false,depthWrite:false,side:THREE.DoubleSide,transparent:true,toneMapped:false});
    const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;records.push(record={mesh});
   }
   const data=triangulateSurfaces(surfaces);let geometry=record.mesh.geometry;
   if(geometry.getAttribute('position')&&geometry.getAttribute('position').array.length!==data.position.length){
    // Dispose uploaded attributes before replacing their sizes: merely calling
    // setAttribute would orphan the previous driver's buffers.
    geometry.dispose();record.mesh.geometry=geometry=new THREE.BufferGeometry();
   }
   for(const [name,values,size] of [['lightPoint',data.lightPoint,3],['lightNormal',data.lightNormal,3],['lightSampleWorld',data.lightWorld,2],['surfaceVisibility',data.visibility,1],['surfaceTint',data.tint,3],['position',data.position,3],['uv',data.uv,2],['surfaceMultiply',data.multiply,3],['surfaceBoost',data.boost,3],['surfaceAdd',data.add,3]]){
    let attribute=geometry.getAttribute(name);
    if(!attribute||attribute.array.length!==values.length)geometry.setAttribute(name,new THREE.Float32BufferAttribute(values,size).setUsage(THREE.DynamicDrawUsage));
    else{attribute.array.set(values);attribute.needsUpdate=true;}
   }
   const u=record.mesh.material.uniforms,[a,b,c,d,tx,ty]=view.matrix;
   u.combatView.value.set(a,c,tx,b,d,ty,0,0,1);u.anchor.value.set(view.anchor.x,view.anchor.y);u.zoom.value=view.zoom;
   u.dynamicLighting.value=!!(dynamicLighting&&lighting);u.spriteLighting.value=spriteLighting;u.screenSpace.value=screenSpace;u.surfaceOpacity.value=opacity;
   u.emitterCount.value=lighting?.lights.length||0;
   if(lighting){const p=lighting.packed;u.emitterPosition.value=p.position;u.emitterColor.value=p.color;u.emitterShape.value=p.shape;u.emitterBounds.value=p.bounds;u.lightWorld.value.fromArray(lighting.world);}
   u.artwork.value=texture(image,!spriteLighting);u.useLightMap.value=!!lightMap;
   if(lightMap){
    u.lightBounds.value.set(lightMap.left,lightMap.top,lightMap.spanWidth,lightMap.spanHeight);
    u.lightMultiply.value=texture(lightMap.layers[0]);u.lightBoost.value=texture(lightMap.layers[1]);
   }else{u.lightMultiply.value=null;u.lightBoost.value=null;}
   paint(record.mesh);needsBackdrop=true;
  },
  end(){if(!frameOpen)return;flush();frameOpen=false;
   // A larger previous scene must not retain one GPU buffer per old wall.
   while(records.length>slot)release(records.pop());
   // Exposure maps are replaced after movement/door changes; release old maps.
   for(const [image,t] of textures)if(image.tagName==='CANVAS'&&!records.some(r=>r.mesh.material.uniforms.artwork.value===t||r.mesh.material.uniforms.lightMultiply.value===t||r.mesh.material.uniforms.lightBoost.value===t)){t.dispose();textures.delete(image);}
   canvas.dataset.combatRenderer='three-webgl2';
   canvas.dataset.gpuStats=JSON.stringify({calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,shaderLights:lighting?.lights.length||0,lighting:lighting?'gpu-point-lights':'cpu-reference'});
  },
  diagnostics(){return {backend:'three-webgl2',contextLost:lost,drawCalls:renderer.info.render.calls,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures};},
  dispose(){if(disposed)return;disposed=true;canvas.removeEventListener('webglcontextlost',lostListener);canvas.removeEventListener('webglcontextrestored',restoredListener);
   records.forEach(release);textures.forEach(t=>t.dispose());quadGeometry.dispose();quadMaterial.dispose();rasterTexture.dispose();maskTexture.dispose();renderer.dispose();}
 };
}
