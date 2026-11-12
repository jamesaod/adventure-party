import {SNOW_SHELTER_GLSL,snowShelterUniforms,configureSnowShelter} from './combat-snow-shelter.mjs';
import {SNOW_DEPTH_GLSL,SNOW_MAX_METRES} from './combat-snow-depth.mjs';
import {SCENE_STYLE} from './exploration-scene-style.mjs';
import {SNOW_COAT_BLEND_START,SNOW_COAT_BLEND_END} from './combat-snow-coats.mjs?v=R238C339';
import {createWeaponFlameMask} from './combat-weapon-flame.mjs?v=R238C299';
import {createFireballEffect} from './combat-fireball-effect.mjs';
import {createBurnSmoke} from './combat-burn-smoke.mjs';
import {createGpuPerformance} from './combat-gpu-performance.mjs';
import {updateSurfaceBuffers,createTargetPool,surfaceVertexCount} from './combat-render-cache.mjs?v=R238C341';
import {createGpuOutline} from './combat-gpu-outline.mjs?v=R238C306';
import {createUnitImageCache} from './combat-unit-image-cache.mjs';
import {combatPerformance as perf} from './combat-performance.mjs';
import {createFirLitter} from './combat-fir-litter.mjs';
import {configureUnitAntialiasing,unitAntialiasing} from './combat-unit-antialiasing.mjs';
import {createUnitBurnEffect} from './combat-unit-burn-effect.mjs?v=R238C299';
import {configureTreeAntialiasing,treeAntialiasing} from './combat-tree-antialiasing.mjs';
import {createSnowAccumulation} from './combat-snow.mjs?v=R238C339';
import {createProjectedShadowPass} from './combat-projected-shadows.mjs?v=R238C294';
import {combatLightGLSL,packCombatLights} from './combat-light-shader.mjs?v=R238C274';
import * as THREE from '../assets/vendor/three/three.module.min.js';

// Combat owns world coordinates and its established painter ordering. This
// backend owns GPU resources, projection, sampling and compositing only.
export function combatProjection(point,view){
 const {x,y,elevation=0}=point,[a,b,c,d,tx,ty]=view.matrix;
 return {x:view.anchor.x+(a*x+c*y+tx-view.anchor.x)*view.zoom,
  y:view.anchor.y+(b*x+d*y+ty-elevation-view.anchor.y)*view.zoom};
}
export function triangulateSurfaces(surfaces){
 const position=[],uv=[],multiply=[],boost=[],add=[],lightPoint=[],lightNormal=[],lightWorld=[],visibility=[],tint=[],sunLoss=[],snow=[];
 for(const face of surfaces){
  if(face.points.length<3)continue;
  for(let i=1;i<face.points.length-1;i++)for(const j of [0,i,i+1]){
   snow.push(face.snowEligible||0);const p=face.points[j];sunLoss.push(...(face.sunLoss||[0,0,0]));lightPoint.push(...(face.lightPoints?.[j]||[0,0,0]));lightNormal.push(...(face.lightNormal||[0,1,0]));lightWorld.push(...(face.lightWorld?.[j]||[p.x,p.y]));visibility.push(face.visibility??1);tint.push(...(face.tint||[1,1,1]));position.push(p.x,p.y,p.elevation||0);
   uv.push(...(face.uv?.[j]||[0,0]));
   multiply.push(...(face.multiply||[1,1,1]));boost.push(...(face.boost||[0,0,0]));add.push(...(face.add||[0,0,0]));
  }
 }
 return {position,uv,multiply,boost,add,lightPoint,lightNormal,lightWorld,visibility,tint,sunLoss,snow};
}
const snowHeightGLSL=`${SNOW_DEPTH_GLSL}
${SNOW_SHELTER_GLSL}
float snowSurfaceHeight(vec2 uv){return snowDeformedHeight(snowSampleDepth(snowAccumulation,uv)*firSnowExposure(snowBounds.xy+uv*snowBounds.zw),texture2D(snowFootprints,uv).rg);}
`;
const vertexShader=`
 uniform bool snowPresent,snowDisplaced; uniform sampler2D snowAccumulation,snowFootprints; uniform vec4 snowBounds; uniform vec2 snowTexel;
 attribute float surfaceSnow; varying float vSnow;
 attribute vec3 lightPoint,lightNormal,surfaceTint; attribute vec2 lightSampleWorld; attribute float surfaceVisibility;
 attribute vec3 surfaceSunLoss; attribute vec3 surfaceMultiply; attribute vec3 surfaceBoost; attribute vec3 surfaceAdd;
 uniform bool screenSpace; uniform mat3 combatView; uniform vec2 anchor; uniform float zoom;
 varying vec3 vLightPoint,vLightNormal,vTint,vSunLoss; varying vec2 vLightWorld; varying float vVisibility;
 varying vec3 vSurfacePosition; varying vec2 vUv; varying vec2 vWorld; varying vec3 vMultiply; varying vec3 vBoost; varying vec3 vAdd;
 ${snowHeightGLSL}
 void main(){
  float snowLift=0.;
  if(snowDisplaced&&surfaceSnow>0.){
   vec2 suv=(position.xy-snowBounds.xy)/snowBounds.zw;
   if(all(greaterThanEqual(suv,vec2(0.)))&&all(lessThanEqual(suv,vec2(1.)))){
    snowLift=snowSurfaceHeight(suv)*${(SCENE_STYLE.tacticalWallPixels/SCENE_STYLE.wallMetres).toFixed(6)};
   }
  }
  vec2 screen=(combatView*vec3(position.xy,1.)).xy-vec2(0.,position.z+snowLift);
  screen=anchor+(screen-anchor)*zoom;
  gl_Position=projectionMatrix*vec4(screenSpace?position.xy:screen,0.,1.);
  vSnow=surfaceSnow;vSurfacePosition=vec3(position.xy,position.z+snowLift);vSunLoss=surfaceSunLoss;vLightPoint=lightPoint;vLightNormal=lightNormal;vLightWorld=lightSampleWorld;vVisibility=surfaceVisibility;vTint=surfaceTint;
  vUv=uv;vWorld=position.xy;vMultiply=surfaceMultiply;vBoost=surfaceBoost;vAdd=surfaceAdd;
 }`;
// Ground overlays need only artwork alpha and the existing daylight snow tint.
const shadowVertexShader=`
uniform mat3 combatView; uniform vec2 anchor; uniform float zoom;
varying vec2 vUv,vWorld;
void main(){vec2 p=(combatView*vec3(position.xy,1.)).xy-vec2(0.,position.z);
p=anchor+(p-anchor)*zoom;gl_Position=projectionMatrix*vec4(p,0.,1.);vUv=uv;vWorld=position.xy;}
`;
const shadowFragmentShader=`
uniform sampler2D artwork,snowAccumulation;uniform vec4 snowBounds;
uniform bool snowSunShadow,snowPresent;uniform float surfaceOpacity;
varying vec2 vUv,vWorld;
void main(){if(any(lessThan(vUv,vec2(0.)))||any(greaterThan(vUv,vec2(1.))))discard;float alpha=texture2D(artwork,vUv).a*surfaceOpacity;if(alpha<.001)discard;
vec3 color=vec3(0.);if(snowSunShadow&&snowPresent){vec2 uv=(vWorld-snowBounds.xy)/snowBounds.zw;
color=vec3(.16,.34,.60)*texture2D(snowAccumulation,clamp(uv,0.,1.)).r;}
gl_FragColor=vec4(color,alpha);}
`;
const fragmentShader=`
 ${combatLightGLSL}
 uniform vec2 snowTexel;
 uniform bool snowPresent; uniform bool snowSunShadow; uniform sampler2D snowAccumulation,snowFootprints; uniform vec4 snowBounds; varying float vSnow;
 uniform bool useRoadNormal;uniform sampler2D roadNormal;
 uniform int scorchCount;uniform vec4 scorchMarks[8];uniform vec2 scorchEnds[8];uniform float scorchSquash;
 uniform vec2 spriteSnowHeight;uniform bool spriteSnowOcclusion;
 uniform bool dynamicLighting,spriteLighting; uniform float surfaceOpacity,spriteSaturation;
 uniform sampler2D artwork; uniform sampler2D lightMultiply; uniform sampler2D lightBoost;
 uniform bool grassMaterial; uniform bool useFirLitter;uniform sampler2D firLitter;uniform vec4 firLitterBounds;
 uniform bool useGroundScorch;uniform sampler2D groundScorchImage;uniform vec4 groundScorchBounds;
 uniform bool useLightMap; uniform vec4 lightBounds;
 varying vec3 vLightPoint,vLightNormal,vTint,vSunLoss; varying vec2 vLightWorld; varying float vVisibility;
 varying vec3 vSurfacePosition; varying vec2 vUv; varying vec2 vWorld; varying vec3 vMultiply; varying vec3 vBoost; varying vec3 vAdd;
 ${snowHeightGLSL}
 void main(){
  vec4 texel=texture2D(artwork,vUv);
  if(spriteSnowOcclusion&&snowPresent){vec2 uv=(vLightWorld-snowBounds.xy)/snowBounds.zw;if(all(greaterThanEqual(uv,vec2(0.)))&&all(lessThanEqual(uv,vec2(1.)))){float h=snowSurfaceHeight(uv);if(h>.0005&&spriteSnowHeight.x+vUv.y*spriteSnowHeight.y<h)discard;}}
  if(vSnow<0.)texel=vec4(1.); // Scatter owns its grass/stone colors.
  if(grassMaterial&&vSnow>=0.){float variation=.94+.045*sin(vWorld.x*.008+cos(vWorld.y*.009))+.015*sin(vWorld.y*.019);texel.rgb*=vec3(variation,variation,variation*.98);}
  if(grassMaterial&&vSnow>=0.&&useRoadNormal&&!dynamicLighting){vec3 n=texture2D(roadNormal,vUv).xyz*2.-1.;texel.rgb*=clamp(.96+.10*n.x-.08*n.y+.04*n.z,.82,1.12);}
  if(vSnow<0.&&snowPresent){vec2 suv=(vWorld-snowBounds.xy)/snowBounds.zw;float cover=texture2D(snowAccumulation,clamp(suv,0.,1.)).g;texel.a*=1.-smoothstep(.25,.85,cover);}

  if(useFirLitter){vec2 uv=(vWorld-firLitterBounds.xy)/firLitterBounds.zw;if(all(greaterThanEqual(uv,vec2(0.)))&&all(lessThanEqual(uv,vec2(1.)))){vec4 litter=texture2D(firLitter,vec2(uv.x,1.-uv.y));texel.rgb=mix(texel.rgb,litter.rgb,litter.a);}}
  if(useGroundScorch){
   vec2 uv=(vWorld-groundScorchBounds.xy)/groundScorchBounds.zw;
   if(all(greaterThanEqual(uv,vec2(0.)))&&all(lessThanEqual(uv,vec2(1.)))){
    uv.y=1.-uv.y;vec4 charred=texture2D(groundScorchImage,uv);
    texel.rgb=mix(texel.rgb,charred.rgb,charred.a);
   }
  }
  float scorch=0.;
  for(int i=0;i<8;i++){
   if(i>=scorchCount)break;vec4 mark=scorchMarks[i];
   vec2 local=(vSurfacePosition.xy-mark.xy)/vec2(1.,scorchSquash),span=(scorchEnds[i]-mark.xy)/vec2(1.,scorchSquash);
   float spanLength=length(span),along=dot(local,span)/max(spanLength,.0001);
   // Feather inward: never carry a capsule beyond the affected hex boundary.
   float edge=smoothstep(0.,mark.z,min(along,spanLength-along));
   float amount=edge*(1.-smoothstep(23.,45.,abs(vSurfacePosition.z-17.)))*.60;
   scorch=max(scorch,amount);
  }
  texel.rgb=mix(texel.rgb,vec3(16.,17.,18.)/255.,scorch);
  vec2 snowUv=(vWorld-snowBounds.xy)/snowBounds.zw;
 // R is the completed base, G is powder, B is the subsequent height layer.
 float snowMask=0.,snowPowder=0.,snowDepth=0.;vec2 snowSlope=vec2(0.);
 if(snowPresent&&vSnow>0.){
  float eligible=vSnow*step(0.,snowUv.x)*step(0.,snowUv.y)*step(snowUv.x,1.)*step(snowUv.y,1.);
  vec3 coats=texture2D(snowAccumulation,clamp(snowUv,0.,1.)).rgb*eligible;
  snowDepth=coats.b;
  float shelter=firSnowExposure(vWorld);
  float thin=shelter*.62*smoothstep(${SNOW_COAT_BLEND_START},${SNOW_COAT_BLEND_END},coats.r);
  snowPowder=shelter*smoothstep(${SNOW_COAT_BLEND_START},${SNOW_COAT_BLEND_END},coats.g+coats.b);
  vec3 powderColor=mix(vec3(.902,.916,.930),vec3(.88,.92,.96),smoothstep(0.,1.,snowDepth));
  texel.rgb=mix(texel.rgb,vec3(.754,.775,.796),thin);
  texel.rgb=mix(texel.rgb,powderColor,snowPowder);
  snowMask=thin+(1.-thin)*snowPowder;
  if(snowMask>0.){
   snowSlope=vec2(snowSurfaceHeight(snowUv+vec2(snowTexel.x,0.))-snowSurfaceHeight(snowUv-vec2(snowTexel.x,0.)),snowSurfaceHeight(snowUv+vec2(0.,snowTexel.y))-snowSurfaceHeight(snowUv-vec2(0.,snowTexel.y)));
   texel.rgb*=1.+clamp(dot(snowSlope,vec2(-.14,.10)),-.10,.10)*snowPowder;
  }
 }
 if(snowSunShadow){gl_FragColor=vec4(vec3(.16,.34,.60)*texture2D(snowAccumulation,clamp(snowUv,0.,1.)).r,texel.a*surfaceOpacity);return;}
 vec3 m=vMultiply,b=vBoost;
  if(useLightMap){
   vec2 lightUv=(vWorld-lightBounds.xy)/lightBounds.zw;lightUv.y=1.-lightUv.y;
   m*=texture2D(lightMultiply,lightUv).rgb;b=texture2D(lightBoost,lightUv).rgb;
  }
  vec3 factor=m/max(vec3(.0001),vec3(1.)-b),radiance=vec3(0.);
  // Apply footprints after lighting so daylight tint does not turn them blue.
  float footprint=snowMask*clamp(texture2D(snowFootprints,clamp(snowUv,0.,1.)).r*${SNOW_MAX_METRES}/max(.001,snowPhysicalDepth(texture2D(snowAccumulation,clamp(snowUv,0.,1.)))),0.,1.);
  float surfaceVisibility=vVisibility;
  if(dynamicLighting){
   vec3 base=pow(max(vec3(.0001),factor),vec3(2.2));
   vec3 ambientBase=base;
   vec3 surfaceNormal=normalize(vLightNormal);
   if(useRoadNormal&&vSnow>=0.){vec3 n=texture2D(roadNormal,vUv).xyz*2.-1.;surfaceNormal=normalize(vec3(n.x*1.3,n.z,-n.y*1.3));}
   if(snowMask>0.){
   vec3 snowNormal=normalize(vec3(-snowSlope.x*8.,1.,-snowSlope.y*8.));
   surfaceNormal=normalize(mix(surfaceNormal,snowNormal,snowMask*.95));

   }
   combatLight(vLightWorld,vLightPoint,surfaceNormal,(useRoadNormal||snowMask>0.)?1.:0.,base,radiance);
   // Light offsets distance fading at the fragment, avoiding a second
   // per-hex torch/spell relief layer. Hidden surfaces remain concealed.
   if(vVisibility>.1001)surfaceVisibility=min(1.,vVisibility+dot(pow(max(vec3(0.),base-ambientBase),vec3(1./2.2))+radiance,vec3(.2126,.7152,.0722)));
   // Baked sprites reflect local spell/fire energy through the same linear-to-display
   // conversion as physical lights; adding it after conversion made units too dark.
   if(spriteLighting){base+=radiance; radiance=vec3(0.);}
   factor=pow(max(vec3(.01),base),vec3(1./2.2));
  }
  if(any(greaterThan(vSunLoss,vec3(0.))))factor=pow(max(vec3(.01),pow(max(factor,vec3(.0001)),vec3(2.2))-vSunLoss),vec3(1./2.2));
  radiance*=step(.1001,vVisibility);
  vec3 lit=factor*surfaceVisibility;
  if(spriteLighting){float brightness=clamp(dot(lit+radiance,vec3(.2126,.7152,.0722)),.02,1.);vec3 ink=mix(vec3(dot(texel.rgb,vec3(.2126,.7152,.0722))),texel.rgb,spriteSaturation);gl_FragColor=vec4(ink*brightness,texel.a*surfaceOpacity);}
  else {
   vec3 surfaceColor=clamp(texel.rgb*lit*vTint+vAdd+radiance,0.,1.);
   vec3 trailShadow=surfaceColor*vec3(.62,.77,.93);
   gl_FragColor=vec4(mix(surfaceColor,trailShadow,footprint*.85),texel.a*surfaceOpacity);
  }
 }`;

export function createCombatRenderer(canvas,raster,{onLost=()=>{},onRestored=()=>{}}={}){
 const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:true,stencil:false,preserveDrawingBuffer:false,powerPreference:'default'});
 if(!gl)throw Error('Combat requires WebGL 2. Enable browser hardware acceleration and check your graphics driver, then retry.');
 const renderer=new THREE.WebGLRenderer({canvas,context:gl,antialias:false});
 renderer.autoClear=false;renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.info.autoReset=false;
 const gpuPerf=createGpuPerformance(gl);globalThis.adventurePartyGpuPerformance=gpuPerf;
 renderer.setClearColor(0x08080c,1);renderer.toneMapping=THREE.NoToneMapping;
 renderer.debug.onShaderError=(gl,program,vertex,fragment)=>{throw Error('Combat shader compilation failed: '+gl.getProgramInfoLog(program)+' '+gl.getShaderInfoLog(vertex)+' '+gl.getShaderInfoLog(fragment));};
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
 // Resolve foliage coverage separately so sprites, terrain and UI retain their
 // existing sampling. Reuse one buffer in painter order, rather than one/tree.
 // Query both attachment formats: MAX_SAMPLES alone does not guarantee a
 // particular sample count is supported by color AND depth renderbuffers.
 configureTreeAntialiasing(Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER,gl.RGBA8,gl.SAMPLES)||[]),Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,gl.SAMPLES)||[]));
 configureUnitAntialiasing(Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER,gl.RGBA8,gl.SAMPLES)||[]),Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,gl.SAMPLES)||[]));
 const fireballEffect=createFireballEffect(renderer);
 const burnEffect=createUnitBurnEffect();const burnSmoke=createBurnSmoke();
 const weaponFlameMask=createWeaponFlameMask();
 const weaponFlameTargets=createTargetPool((width,height,samples)=>new THREE.WebGLRenderTarget(width,height,{samples,depthBuffer:true,stencilBuffer:false}),{limit:4,budget:8*1024*1024});
 const corpseSnowHDR=!!gl.getExtension('EXT_color_buffer_float');
 const corpseType=corpseSnowHDR?THREE.HalfFloatType:THREE.UnsignedByteType;
 const corpseSamples=corpseSnowHDR?Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER,gl.RGBA16F,gl.SAMPLES)||[]):null;
 const corpseTarget=(width,height,samples)=>new THREE.WebGLRenderTarget(width,height,{type:corpseType,samples,depthBuffer:true,stencilBuffer:false});
 const corpseScratch=createTargetPool(corpseTarget,{limit:2,bytesPerPixel:corpseSnowHDR?12:8});
 let corpseSceneId;
 const corpseImages=createUnitImageCache(corpseTarget,{bytesPerPixel:corpseSnowHDR?12:8});
 const unitTargets=createTargetPool((width,height,samples)=>new THREE.WebGLRenderTarget(width,height,{samples,depthBuffer:true,stencilBuffer:false}));
 const treeTarget=new THREE.WebGLRenderTarget(1,1,{samples:treeAntialiasing().samples,depthBuffer:true,stencilBuffer:false});
 const treeCompositeMaterial=new THREE.ShaderMaterial({
  uniforms:{artwork:{value:treeTarget.texture},rect:{value:new THREE.Vector4()},viewport:{value:new THREE.Vector2()}},
  vertexShader:'uniform vec4 rect;uniform vec2 viewport;varying vec2 vUv;void main(){vUv=uv;vec2 p=rect.xy+vec2(uv.x,1.-uv.y)*rect.zw;gl_Position=vec4(p.x/viewport.x*2.-1.,1.-p.y/viewport.y*2.,0.,1.);}',
  fragmentShader:`uniform sampler2D artwork;varying vec2 vUv;
   void main(){vec4 t=texture2D(artwork,vUv);if(t.a<=0.)discard;
    gl_FragColor=vec4(t.rgb/max(t.a,.00001),t.a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    gl_FragColor.rgb*=gl_FragColor.a;
   }`,
  transparent:true,premultipliedAlpha:true,depthTest:false,depthWrite:false});
 const treeComposite=new THREE.Mesh(quadGeometry,treeCompositeMaterial);treeComposite.frustumCulled=false;
 const snow=createSnowAccumulation(renderer);
 const unitSnowSurface={texture:snow.texture,tracks:snow.footprintTexture,bounds:snow.bounds};
 let litter=null,litterId=null;
 const records=[],textures=new Map();let slot=0,lost=false,disposed=false,view;
 let dirty=false,frameOpen=false,needsBackdrop=false,lighting=null;
 let pendingUnits=[];
 const maskTexture=new THREE.CanvasTexture(raster);maskTexture.colorSpace=THREE.NoColorSpace;maskTexture.generateMipmaps=false;maskTexture.minFilter=maskTexture.magFilter=THREE.NearestFilter;maskTexture.flipY=true;
 const raw=raster.getContext('2d');
 const drawing=new Set(['fill','stroke','fillRect','strokeRect','fillText','strokeText','drawImage','putImageData']);
 // Keep Canvas 2D for sprite/VFX/UI authoring; flush only when it actually drew.
 const canvasMethods=new Map();
 const context=new Proxy(raw,{get(target,key){const value=Reflect.get(target,key,target);if(typeof value!=='function')return value;if(canvasMethods.has(key))return canvasMethods.get(key);const method=(...args)=>{if(drawing.has(key)){flushUnits();if(raw.globalCompositeOperation!=='source-over')prepareBackdrop();dirty=true;}return value.apply(target,args);};canvasMethods.set(key,method);return method;},set(target,key,value){Reflect.set(target,key,value,target);return true;}});
 function clearRaster(){raw.save();raw.setTransform(1,0,0,1,0,0);raw.clearRect(0,0,raster.width,raster.height);raw.restore();dirty=false;}
 function paint(mesh,category='Other surfaces'){scene.add(mesh);const label=mesh===quad||mesh===treeComposite?'Composite':category;perf.count('draws:'+label);gpuPerf.measure(label,()=>renderer.render(scene,camera));scene.remove(mesh);}
 function prepareOverlay(){ /* Source-over overlays need no GPU readback. */ }
 function prepareBackdrop(){
  if(!needsBackdrop||lost||disposed)return;
  if(dirty)flush();
  // Canvas effects use destination-dependent blends (lighter, multiply, etc.).
  // Seed their batch with the current GPU scene so those operations retain
  // their exact semantics. Call before installing an effect's local clip.
  raw.save();raw.setTransform(1,0,0,1,0,0);raw.globalAlpha=1;raw.globalCompositeOperation='copy';raw.filter='none';raw.shadowBlur=0;raw.shadowColor='transparent';
  perf.count('gpuToCanvasCopies');perf.measure('backdropCopy',()=>raw.drawImage(canvas,0,0));raw.restore();needsBackdrop=false;
 }
 function texture(image,repeat=false){
  if(image.isTexture)return image;
  let t=textures.get(image);if(t)return t;
  // Resize only opted-in static floor artwork, once per cached GPU texture.
  // Do not resize atlases, normal maps, masks, sprites, or render targets.
  let source=image;
  const limit=image.combatTextureLimit,width=image.naturalWidth||image.width,height=image.naturalHeight||image.height;
  if(limit>0&&Math.max(width,height)>limit){
   const scale=limit/Math.max(width,height),tile=document.createElement('canvas');
   tile.width=Math.max(1,Math.round(width*scale));tile.height=Math.max(1,Math.round(height*scale));
   const c=tile.getContext('2d');c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(image,0,0,tile.width,tile.height);source=tile;
  }
  t=new THREE.Texture(source);t.colorSpace=THREE.NoColorSpace;
  t.wrapS=t.wrapT=repeat?THREE.RepeatWrapping:THREE.ClampToEdgeWrapping;
  t.generateMipmaps=repeat;t.minFilter=repeat?THREE.LinearMipmapLinearFilter:THREE.LinearFilter;
  t.magFilter=THREE.LinearFilter;t.anisotropy=repeat?Math.min(image.combatTextureLimit?2:4,renderer.capabilities.getMaxAnisotropy()):1;
  t.needsUpdate=true;textures.set(image,t);return t;
 }
 function flushUnits(){
  if(!pendingUnits.length)return;const batch=pendingUnits;pendingUnits=[];
  const left=Math.min(...batch.map(b=>b.bounds.x)),top=Math.min(...batch.map(b=>b.bounds.y));
  const right=Math.max(...batch.map(b=>b.bounds.x+b.bounds.width)),bottom=Math.max(...batch.map(b=>b.bounds.y+b.bounds.height));
  api.treeScene((gpu,view)=>{for(const item of batch){gpu.clearDepth();item.callback(gpu,view);}},{unit:true,bounds:{x:left,y:top,width:right-left,height:bottom-top}});
  perf.count('unitCompositeBatches');perf.count('unitBatchMembers',batch.length);
 }
 function flush(){flushUnits();if(!dirty||lost||disposed)return;perf.count('canvasUploads');rasterTexture.needsUpdate=true;paint(quad);clearRaster();needsBackdrop=true;}
 function release(record){record.mesh.geometry.dispose();record.mesh.material.dispose();}
 const projectedShadows=createProjectedShadowPass({renderer,camera,texture,flush,getView:()=>view,getSnow:()=>snow,onPaint:()=>{needsBackdrop=true;}});
 const outlines=createGpuOutline(renderer,flush,()=>view,()=>{needsBackdrop=true;});
 const lostListener=event=>{event.preventDefault();lost=true;corpseImages.clear();onLost();};
 const restoredListener=()=>{lost=false;for(const t of textures.values())t.needsUpdate=true;rasterTexture.needsUpdate=true;maskTexture.needsUpdate=true;onRestored();};
 canvas.addEventListener('webglcontextlost',lostListener);canvas.addEventListener('webglcontextrestored',restoredListener);
 const api={
  context,
  get unitSnowRevision(){return snow.surfaceRevision;},
  get unitSnowSurface(){return snow.hasCoverage?unitSnowSurface:null;},
  snowScene:(id,extent)=>{if(id!==corpseSceneId){corpseImages.clear();corpseSceneId=id;}return snow.scene(id,extent);},
  firLitter(id,trees,bounds,radius,squash=1){const shelterKey=JSON.stringify([bounds,radius,squash,trees]);if(snowShelterUniforms.snowShelter.value.userData.shelterKey!==shelterKey){configureSnowShelter(trees,bounds,radius,squash);snowShelterUniforms.snowShelter.value.userData.shelterKey=shelterKey;}if(id!==litterId){if(litter){const old=textures.get(litter.image);old?.dispose();textures.delete(litter.image);}litterId=id;litter=createFirLitter(trees,bounds,radius);}},
  snowGround:faces=>snow.setGround(faces),
  snowCoatCoverage:()=>snow.coatCoverage,
  snowAmount:(x,y)=>snow.hexes.get(x+','+y)?.amount||0,
  snowHeat:sources=>snow.setHeat(sources),
  meltSnow:(cells,amount)=>snow.melt(cells,amount),
  projectedShadows,corpseSnowHDR,
  get available(){return !lost&&!disposed;},
  prepareOverlay,
  fireball(options){if(lost||disposed||!frameOpen)return false;flush();gpuPerf.measure('Fireball',()=>fireballEffect.draw(options,view));needsBackdrop=true;return true;},
  unitOutline(callback,options){if(lost||disposed||!frameOpen)return false;flush();return gpuPerf.measure('Outlines',()=>outlines.draw(callback,options));},
  burnSmoke(options){if(lost||disposed||!frameOpen)return false;flush();burnSmoke.update(options,view);paint(burnSmoke.mesh);return true;},
  unitScene(callback,bounds,burn=null,weaponFlame=null,cache=null){
   if(lost||disposed||!frameOpen)return false;
   const bx=view.anchor.x+(bounds.x-view.anchor.x)*view.zoom,by=view.anchor.y+(bounds.y-view.anchor.y)*view.zoom;
   if(bx+bounds.width*view.zoom<0||by+bounds.height*view.zoom<0||bx>view.width||by>view.height){perf.count('offscreenUnitsSkipped');return true;}
   if(burn||weaponFlame){flush();const pad=Math.max(1,weaponFlame?.scale||1);return api.treeScene(callback,{unit:true,bounds:{x:bounds.x-16*pad,y:bounds.y-18*pad,width:bounds.width+32*pad,height:bounds.height+36*pad},burn,weaponFlame});}
   if(cache){flush();return api.treeScene(callback,{unit:true,bounds,cache});}
   if(dirty)flush();
   // Overlapping silhouettes must be tone-mapped/composited separately.
   if(pendingUnits.some(item=>{const b=item.bounds;return bounds.x<b.x+b.width+6&&bounds.x+bounds.width+6>b.x&&bounds.y<b.y+b.height+6&&bounds.y+bounds.height+6>b.y;}))flushUnits();
   pendingUnits.push({callback,bounds});return true;
  },
  treeScene(callback,{unit=false,bounds=null,burn=null,weaponFlame=null,cache=null}={}){
   if(lost||disposed||!frameOpen)return null;flush();
   const clearColor=renderer.getClearColor(new THREE.Color()),clearAlpha=renderer.getClearAlpha();
   const target=renderer.getRenderTarget(),tone=renderer.toneMapping,exposure=renderer.toneMappingExposure,shadows=renderer.shadowMap.enabled;
   try{renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.shadowMap.enabled=!unit;renderer.shadowMap.type=THREE.PCFShadowMap;
     let samples=unit?unitAntialiasing().samples:treeAntialiasing().samples;
     if(cache&&corpseSamples)samples=Math.max(0,...corpseSamples.filter(n=>n<=samples));
     if(!unit&&treeTarget.samples!==samples){treeTarget.dispose();treeTarget.samples=samples;}
     const left=bounds?Math.floor(view.anchor.x+(bounds.x-view.anchor.x)*view.zoom-3):0;
     const top=bounds?Math.floor(view.anchor.y+(bounds.y-view.anchor.y)*view.zoom-3):0;
     const crop={x:Math.max(0,left),y:Math.max(0,top)};
     crop.width=bounds?Math.min(view.width,left+Math.ceil(bounds.width*view.zoom+6))-crop.x:view.width;
     crop.height=bounds?Math.min(view.height,top+Math.ceil(bounds.height*view.zoom+6))-crop.y:view.height;
     if(crop.width<=0||crop.height<=0){perf.count('offscreenModelPassesSkipped');return true;}
     const targetWidth=Math.max(1,Math.ceil(crop.width*canvas.width/view.width)),targetHeight=Math.max(1,Math.ceil(crop.height*canvas.height/view.height));
     const imageKey=cache&&JSON.stringify([cache.key,view.zoom,view.anchor,view.width,view.height,crop,canvas.width,canvas.height]);
     const retained=cache&&corpseImages.get(cache.owner,imageKey,targetWidth,targetHeight,samples);
     let renderTarget=treeTarget;
     if(retained)renderTarget=retained.target;
     else if(cache)renderTarget=corpseScratch.get(targetWidth,targetHeight,samples);
     else if(bounds)renderTarget=unitTargets.get(targetWidth,targetHeight,samples);
     else if(treeTarget.width!==targetWidth||treeTarget.height!==targetHeight)treeTarget.setSize(targetWidth,targetHeight);
     treeCompositeMaterial.uniforms.artwork.value=renderTarget.texture;
     treeCompositeMaterial.uniforms.rect.value.set(crop.x,crop.y,crop.width,crop.height);treeCompositeMaterial.uniforms.viewport.value.set(view.width,view.height);
     perf.count(unit?'unitTargetPixels':'treeTargetPixels',targetWidth*targetHeight);
     let result=true;
     if(retained?.ready){perf.count('corpseImageCacheHits');}
     else{
      renderer.setRenderTarget(renderTarget);renderer.setClearColor(0,0);renderer.clear(true,true,false);
      perf.count(unit?'unitPasses':'treePasses');if(cache)perf.count('corpseImageCacheMisses');
      result=perf.measure(unit?'unitSubmission':'treeSubmission',()=>gpuPerf.measure(unit?'Models':'Trees',()=>callback(renderer,{...view,crop})));
      if(retained)retained.ready=result===true;
     }
     let bladeTexture=null;
     if(weaponFlame?.root){
      const bladeTarget=weaponFlameTargets.get(targetWidth,targetHeight,samples);
      renderer.setRenderTarget(bladeTarget);renderer.clear(true,true,false);
      const visible=perf.measure('weaponFlame',()=>weaponFlameMask.draw(renderer,weaponFlame.root,weaponFlame.camera));
      if(visible){bladeTexture=bladeTarget.texture;perf.count('weaponFlameMaskPasses');}
     }
     // Render targets contain linear, premultiplied coverage. Tone-map once,
     // after resolving MSAA, then composite without dark fringes at the leaves.
     renderer.setRenderTarget(target);if(burn){burnEffect.update({texture:renderTarget.texture,crop,...burn},view);paint(burnEffect.mesh);}paint(treeComposite);if(bladeTexture){burnEffect.update({texture:bladeTexture,crop,...weaponFlame,scale:weaponFlame.scale*view.zoom},view);paint(burnEffect.mesh);perf.count('weaponFlameComposites');}return result;
   }finally{renderer.setRenderTarget(target);renderer.toneMapping=tone;renderer.toneMappingExposure=exposure;renderer.shadowMap.enabled=shadows;renderer.setClearColor(clearColor,clearAlpha);needsBackdrop=true;}
  },
  setLighting(next){lighting=next;if(next){next.packed=packCombatLights(next.lights);if(next.mask!==maskTexture.image||next.maskRevision!==maskTexture.userData.revision){if(maskTexture.image.width!==next.mask.width||maskTexture.image.height!==next.mask.height)maskTexture.dispose();maskTexture.image=next.mask;maskTexture.userData.revision=next.maskRevision;maskTexture.needsUpdate=true;}}},
  presentOverlay(){flush();},
  begin(nextView){
   if(lost||disposed)return false;
   gpuPerf.begin();perf.begin();view=nextView;snow.begin();projectedShadows.begin();lighting=null;slot=0;frameOpen=true;needsBackdrop=false;clearRaster();renderer.info.reset();
   const width=canvas.width,height=canvas.height;
   if(width>renderer.capabilities.maxTextureSize||height>renderer.capabilities.maxTextureSize)throw Error('Combat resolution exceeds this device’s graphics limits.');
   if(raster.width!==width||raster.height!==height){rasterTexture.dispose();raster.width=width;raster.height=height;}
   renderer.setViewport(0,0,width,height);renderer.clear(true,false,false);
   camera.right=view.width;camera.bottom=view.height;camera.updateProjectionMatrix();return true;
  },
  surface(surfaces,image,{grassMaterial=false,lightMap=null,dynamicLighting=false,spriteLighting=false,spriteSnowHeight=null,saturation=1,screenSpace=false,opacity=1,scorch=[],scorchSquash=1,groundScorch=null,normalMap=null,sunShadow=false,needleLitter=false,category='Other surfaces'}={}){
   if(lost||!frameOpen||!surfaces.length||!image)return;
   const shadowOnly=category==='Ground shadows'||category==='Fir contact';
   if(!shadowOnly)snow.collect(surfaces);
   // Ground artwork remains; decorative grass/rock scatter is disabled.
   flush();const recordSlot=slot++;let record=records[recordSlot];
   if(record&&record.shadowOnly!==shadowOnly){release(record);record=null;}
   if(!record){
    const geometry=new THREE.BufferGeometry(),material=new THREE.ShaderMaterial({vertexShader:shadowOnly?shadowVertexShader:vertexShader,fragmentShader:shadowOnly?shadowFragmentShader:fragmentShader,
     uniforms:{...snowShelterUniforms,snowDisplaced:{value:false},snowTexel:{value:snow.texelSize},grassMaterial:{value:false},snowPresent:{value:false},useFirLitter:{value:false},firLitter:{value:null},firLitterBounds:{value:new THREE.Vector4()},snowSunShadow:{value:false},snowFootprints:{value:snow.footprintTexture},snowAccumulation:{value:snow.texture},snowBounds:{value:snow.bounds},useRoadNormal:{value:false},roadNormal:{value:null},useGroundScorch:{value:false},groundScorchImage:{value:null},groundScorchBounds:{value:new THREE.Vector4()},scorchCount:{value:0},scorchEnds:{value:new Float32Array(16)},scorchMarks:{value:new Float32Array(32)},scorchSquash:{value:1},dynamicLighting:{value:false},spriteLighting:{value:false},spriteSaturation:{value:1},spriteSnowHeight:{value:new THREE.Vector2()},spriteSnowOcclusion:{value:false},screenSpace:{value:false},surfaceOpacity:{value:1},emitterCount:{value:0},emitterPosition:{value:new Float32Array(128)},emitterColor:{value:new Float32Array(128)},emitterShape:{value:new Float32Array(128)},emitterBounds:{value:new Float32Array(128)},emitterMask:{value:maskTexture},lightWorld:{value:new THREE.Vector4(1,1,0,0)},artwork:{value:null},lightMultiply:{value:null},lightBoost:{value:null},useLightMap:{value:false},lightBounds:{value:new THREE.Vector4()},combatView:{value:new THREE.Matrix3()},anchor:{value:new THREE.Vector2()},zoom:{value:1}},
     depthTest:false,depthWrite:false,side:THREE.DoubleSide,transparent:true,toneMapped:false});
    const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;records[recordSlot]=record={mesh,shadowOnly};
   }
   let geometry=record.mesh.geometry;
   // Refine only the displaced outdoor floor; retain source snapshots and the
   // existing single floor draw. Shared edge subdivision avoids cracks at melt/track boundaries.
   const snowDivisions=category==='Floor'&&snow.hasCoverage?8:1;
   // Uniform edge vertices keep melted and tracked neighbours watertight.
   const vertices=surfaceVertexCount(surfaces,snowDivisions);
   if(geometry.getAttribute('position')&&geometry.getAttribute('position').count!==vertices){geometry.dispose();record.mesh.geometry=geometry=new THREE.BufferGeometry();}
   perf.measure('surfaceBuffers',()=>updateSurfaceBuffers(geometry,surfaces,THREE,(name)=>perf.count(name),shadowOnly,snowDivisions));
   perf.count('triangles:'+category,vertices/3);perf.count('faces:'+category,surfaces.length);
   const u=record.mesh.material.uniforms,[a,b,c,d,tx,ty]=view.matrix;

   u.useFirLitter.value=!!(needleLitter&&litter);u.firLitter.value=litter?texture(litter.image):null;if(litter)u.firLitterBounds.value.fromArray(litter.bounds);
   u.grassMaterial.value=grassMaterial;
   u.snowDisplaced.value=snow.hasCoverage;u.snowPresent.value=snow.hasCoverage;u.snowSunShadow.value=sunShadow;
   u.combatView.value.set(a,c,tx,b,d,ty,0,0,1);u.anchor.value.set(view.anchor.x,view.anchor.y);u.zoom.value=view.zoom;
   u.scorchCount.value=Math.min(8,scorch?.length||0);u.scorchSquash.value=scorchSquash;
   u.scorchEnds.value.fill(0);u.scorchMarks.value.fill(0);for(let i=0;i<u.scorchCount.value;i++){const mark=scorch[i];u.scorchMarks.value.set([mark.x,mark.y,mark.radius,1],i*4);u.scorchEnds.value.set([mark.endX??mark.x,mark.endY??mark.y],i*2);}
   u.dynamicLighting.value=!!(dynamicLighting&&lighting);u.spriteLighting.value=spriteLighting;u.spriteSnowOcclusion.value=!!spriteSnowHeight;if(spriteSnowHeight)u.spriteSnowHeight.value.fromArray(spriteSnowHeight);u.spriteSaturation.value=saturation;u.screenSpace.value=screenSpace;u.surfaceOpacity.value=opacity;
   u.emitterCount.value=lighting?.lights.length||0;
   if(lighting){const p=lighting.packed;u.emitterPosition.value=p.position;u.emitterColor.value=p.color;u.emitterShape.value=p.shape;u.emitterBounds.value=p.bounds;u.lightWorld.value.fromArray(lighting.world);}
   u.artwork.value=texture(image,!spriteLighting);u.useLightMap.value=!!lightMap;
   u.useRoadNormal.value=!!normalMap;u.roadNormal.value=normalMap?texture(normalMap,!!normalMap.combatRepeat):null;
   u.useGroundScorch.value=!!groundScorch;
   if(groundScorch){u.groundScorchImage.value=texture(groundScorch.image);u.groundScorchBounds.value.set(groundScorch.left,groundScorch.top,groundScorch.spanX,groundScorch.spanY);}
   else u.groundScorchImage.value=null;
   if(lightMap){
    u.lightBounds.value.set(lightMap.left,lightMap.top,lightMap.spanWidth,lightMap.spanHeight);
    u.lightMultiply.value=texture(lightMap.layers[0]);u.lightBoost.value=texture(lightMap.layers[1]);
   }else{u.lightMultiply.value=null;u.lightBoost.value=null;}
   paint(record.mesh,category);needsBackdrop=true;
  },
  end(){if(!frameOpen)return;perf.measure('shadowDraw',()=>gpuPerf.measure('Shadows',()=>{projectedShadows.flush();projectedShadows.end();}));flush();perf.measure('snow',()=>gpuPerf.measure('Snow',()=>snow.end(view)));gpuPerf.end();perf.end();if(perf.enabled)canvas.dataset.combatProfile=JSON.stringify(perf.snapshot());frameOpen=false;
   // A larger previous scene must not retain one GPU buffer per old wall.
   while(records.length>slot)release(records.pop());
   // Exposure maps are replaced after movement/door changes; release old maps.
   const retainedTextures=new Set(records.flatMap(r=>{const u=r.mesh.material.uniforms;return [u.roadNormal.value,u.artwork.value,u.lightMultiply.value,u.lightBoost.value,u.groundScorchImage.value];}));
   for(const [image,t] of textures)if(image!==litter?.image&&image.tagName==='CANVAS'&&!projectedShadows.uses(image)&&!retainedTextures.has(t)){t.dispose();textures.delete(image);}
   canvas.dataset.combatRenderer='three-webgl2';
   canvas.dataset.gpuStats=JSON.stringify({calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,shadowBatches:projectedShadows.diagnostics().batches,shadowTriangles:projectedShadows.diagnostics().triangles,shaderLights:lighting?.lights.length||0,lighting:lighting?'gpu-point-lights':'cpu-reference'});
  },
  diagnostics(){return {backend:'three-webgl2',targetPool:unitTargets.stats(),corpseImageCache:corpseImages.stats(),contextLost:lost,drawCalls:renderer.info.render.calls,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures};},
  dispose(){if(disposed)return;disposed=true;canvas.removeEventListener('webglcontextlost',lostListener);canvas.removeEventListener('webglcontextrestored',restoredListener);
   weaponFlameMask.dispose();weaponFlameTargets.dispose();fireballEffect.dispose();burnSmoke.dispose();burnEffect.dispose();gpuPerf.dispose();pendingUnits=[];outlines.dispose();snow.dispose();projectedShadows.dispose();records.forEach(release);textures.forEach(t=>t.dispose());treeTarget.dispose();unitTargets.dispose();corpseScratch.dispose();corpseImages.clear();treeCompositeMaterial.dispose();quadGeometry.dispose();quadMaterial.dispose();rasterTexture.dispose();maskTexture.dispose();renderer.dispose();}
 };
 return api;
}
