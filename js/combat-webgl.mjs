import {solarState,solarPalette} from './solar-clock.mjs?v=R238C380';
import {createTransientTarget} from './combat-transient-target.mjs';
import {createGpuSurface,GPU_SURFACE_DECLARATIONS,GPU_SURFACE_SETUP} from './combat-gpu-surface.mjs';
import {createStreamShoreDistance} from './stream-shore-distance.mjs';
import {createStreamSnowLimit} from './stream-snow-limit.mjs?v=shore-snow1';
import {createStreamField,STREAM_DEFAULTS,streamBankWear,streamSettings} from './combat-stream-field.mjs?v=stream-banks2';
import {CONTACT_GLSL,contactUniforms,updateContactUniforms,featherTrunkShelter} from './combat-fir-contact.mjs?v=R238C438';
import {CombatPuddleEffects,PUDDLE_RING_LIMIT} from './combat-puddle-effects.mjs?v=snow-water1';
import {createPuddleParticles} from './combat-puddle-particles.mjs?v=R238C450';
import {CombatWetBasins,BASIN_MAX_METRES} from './combat-wet-basins.mjs';
import {modelPixelCrop} from './combat-model-crop.mjs';
import {orderSurfaceActors} from './combat-surface-lighting.mjs';
import {createGroundWear,WEAR_SETTINGS} from './combat-ground-wear.mjs?v=tree-snow-grains1';
import {createGroundCover} from './combat-ground-cover.mjs?v=tree-snow-grains1';
import {SNOW_SHELTER_GLSL,snowShelterUniforms,configureSnowShelter,finalizeSnowShelter} from './combat-snow-shelter.mjs?v=tree-snow-grains1';
import {SNOW_DEPTH_GLSL,SNOW_MAX_METRES} from './combat-snow-depth.mjs?v=shore-snow1';
import {SCENE_STYLE} from './exploration-scene-style.mjs';
import {SNOW_COAT_BLEND_START,SNOW_COAT_BLEND_END} from './combat-snow-coats.mjs?v=tree-snow-grains1';
import {createWeaponFlameMask} from './combat-weapon-flame.mjs?v=R238C299';
import {createFireballEffect} from './combat-fireball-effect.mjs?v=R238C386';
import {createBurnSmoke} from './combat-burn-smoke.mjs?v=R238C386';
import {createGpuPerformance} from './combat-gpu-performance.mjs';
import {updateSurfaceBuffers,createTargetPool,surfaceVertexCount} from './combat-render-cache.mjs?v=R238C432';
import {createGpuOutline} from './combat-gpu-outline.mjs?v=outline-cache1';
import {createUnitImageCache} from './combat-unit-image-cache.mjs';
import {combatPerformance as perf} from './combat-performance.mjs';
import {createFirLitter} from './combat-fir-litter.mjs?v=rain-shadow1';
import {configureUnitAntialiasing,unitAntialiasing} from './combat-unit-antialiasing.mjs?v=R238C403';
import {createUnitBurnEffect} from './combat-unit-burn-effect.mjs?v=R238C299';
import {configureTreeAntialiasing,treeAntialiasing} from './combat-tree-antialiasing.mjs?v=R238C449';
import {createSnowAccumulation} from './combat-snow.mjs?v=tree-snow-grains1';
import {createProjectedShadowPass} from './combat-projected-shadows.mjs?v=R238C438';
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
float snowSurfaceHeight(vec2 uv){return snowDeformedHeight(snowSampleDepth(snowAccumulation,uv),texture2D(snowFootprints,uv).rg);}
`;
const vertexShader=`
 uniform vec3 streamMotion;uniform sampler2D streamMap;uniform vec4 streamBounds;uniform bool streamEnabled;uniform bool basinSurface;uniform sampler2D groundWearMap;uniform vec2 groundWearScale,basinWeather;
 uniform bool snowPresent,snowDisplaced; uniform sampler2D snowAccumulation,snowFootprints; uniform vec4 snowBounds; uniform vec2 snowTexel;
 attribute float surfaceSnow; varying float vSnow;
 attribute vec3 lightPoint,lightNormal,surfaceTint; attribute vec2 lightSampleWorld; attribute float surfaceVisibility;
 attribute vec3 surfaceSunLoss; attribute vec3 surfaceMultiply; attribute vec3 surfaceBoost; attribute vec3 surfaceAdd;
 uniform bool screenSpace; uniform mat3 combatView; uniform vec2 anchor; uniform float zoom;
 varying vec3 vLightPoint,vLightNormal,vTint,vSunLoss; varying vec2 vLightWorld; varying float vVisibility;
 varying vec3 vSurfacePosition; varying vec2 vUv; varying vec2 vWorld; varying vec3 vMultiply; varying vec3 vBoost; varying vec3 vAdd;
 ${snowHeightGLSL}
 #ifdef GPU_SURFACE
 ${GPU_SURFACE_DECLARATIONS}
 #endif
 void main(){
 #ifdef GPU_SURFACE
 ${GPU_SURFACE_SETUP}
 #endif
  float snowLift=0.,surfaceWater=0.;float basinDepth=basinSurface&&surfaceSnow>0.?texture2D(groundWearMap,position.xy/groundWearScale/128.+.5).g*.1524:0.;float basinDrop=(basinDepth-max(0.,basinWeather.y-.1524+basinDepth))*10.;
  surfaceWater=basinSurface?max(0.,basinWeather.y-.1524+basinDepth):0.;
  if(basinSurface&&surfaceSnow>0.&&streamEnabled){vec4 channel=texture2D(streamMap,(position.xy/groundWearScale-streamBounds.xy)/streamBounds.zw);if(channel.r>.001)surfaceWater=channel.g;float bankWear=max(smoothstep(0.,.14,channel.r),smoothstep(0.,.02,channel.g));basinDrop=mix(basinDrop,(channel.r-channel.g)*10.,bankWear);}
  if(snowDisplaced&&surfaceSnow>0.&&surfaceWater<=0.){
   vec2 suv=(position.xy-snowBounds.xy)/snowBounds.zw;
   if(all(greaterThanEqual(suv,vec2(0.)))&&all(lessThanEqual(suv,vec2(1.)))){
    snowLift=snowSurfaceHeight(suv)*${(SCENE_STYLE.tacticalWallPixels/SCENE_STYLE.wallMetres).toFixed(6)};
   }
  }
  vec2 screen=(combatView*vec3(position.xy,1.)).xy-vec2(0.,position.z+snowLift-basinDrop);
  screen=anchor+(screen-anchor)*zoom;
  gl_Position=projectionMatrix*vec4(screenSpace?position.xy:screen,0.,1.);
  vSnow=surfaceSnow;vSurfacePosition=vec3(position.xy,position.z+snowLift-basinDrop);vSunLoss=surfaceSunLoss;vLightPoint=lightPoint;vLightNormal=lightNormal;vLightWorld=lightSampleWorld;vVisibility=surfaceVisibility;vTint=surfaceTint;
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
${CONTACT_GLSL}
${SNOW_SHELTER_GLSL}
uniform sampler2D artwork,snowAccumulation;uniform vec4 snowBounds;
uniform bool snowSunShadow,snowPresent;uniform float surfaceOpacity;
varying vec2 vUv,vWorld;
void main(){if(any(lessThan(vUv,vec2(0.)))||any(greaterThan(vUv,vec2(1.))))discard;float alpha=texture2D(artwork,vUv).a*surfaceOpacity;if(alpha<.001)discard;
if(ambientContact)alpha*=firAmbientShare(vWorld);
vec3 color=vec3(0.);if((snowSunShadow||ambientContact)&&snowPresent){vec2 uv=(vWorld-snowBounds.xy)/snowBounds.zw;
float inside=step(0.,uv.x)*step(0.,uv.y)*step(uv.x,1.)*step(uv.y,1.);
float cover=texture2D(snowAccumulation,clamp(uv,0.,1.)).r*inside;

color=(ambientContact?vec3(.08,.14,.24):vec3(.16,.34,.60))*cover;}
gl_FragColor=vec4(color,alpha);}
`;
const fragmentShader=`
 uniform sampler2D streamShoreMap;
 uniform vec3 waterSun,waterSunColor,waterView;uniform vec2 waterLight;
 uniform vec3 streamMotion;uniform sampler2D streamMap;uniform vec4 streamBounds;uniform bool streamEnabled;uniform bool basinSurface;uniform vec2 basinWeather;uniform int puddleRingCount;uniform vec4 puddleRings[${PUDDLE_RING_LIMIT}];
 ${combatLightGLSL}
 uniform vec2 snowTexel;
 uniform bool snowPresent; uniform bool snowSunShadow; uniform sampler2D snowAccumulation,snowFootprints; uniform vec4 snowBounds; varying float vSnow;
 uniform bool useRoadNormal;uniform sampler2D roadNormal;
 uniform int scorchCount;uniform vec4 scorchMarks[8];uniform vec2 scorchEnds[8];uniform float scorchSquash;
 uniform vec2 spriteSnowHeight;uniform bool spriteSnowOcclusion;uniform float spriteWaterDepth;
 uniform bool dynamicLighting,spriteLighting; uniform float surfaceOpacity,spriteSaturation,spriteWetShade;
 uniform sampler2D artwork; uniform sampler2D lightMultiply; uniform sampler2D lightBoost;
 uniform sampler2D groundWearMap,groundWearSoil;uniform vec2 groundWearScale;uniform float groundWearRelief;uniform bool groundArrow;uniform bool grassMaterial; uniform bool useFirLitter;uniform sampler2D firLitter;uniform vec4 firLitterBounds;
 uniform bool useGroundScorch;uniform sampler2D groundScorchImage;uniform vec4 groundScorchBounds;
 uniform bool useLightMap; uniform vec4 lightBounds;
 varying vec3 vLightPoint,vLightNormal,vTint,vSunLoss; varying vec2 vLightWorld; varying float vVisibility;
 varying vec3 vSurfacePosition; varying vec2 vUv; varying vec2 vWorld; varying vec3 vMultiply; varying vec3 vBoost; varying vec3 vAdd;
 ${snowHeightGLSL}
 void main(){
  vec4 texel=texture2D(artwork,vUv);
  vec3 waterReflection=vec3(0.),waterGlint=vec3(0.),waterNormal=vec3(0.,1.,0.);float waterReflectMix=0.,streamSurface=0.;
  vec2 waterWorld=vWorld/groundWearScale,waterDx=dFdx(waterWorld),waterDy=dFdy(waterWorld);
  if(groundArrow){
   vec2 metres=vWorld/vec2(128./3.,128./3.*.568329);
   vec4 channel=streamEnabled?texture2D(streamMap,(metres-streamBounds.xy)/streamBounds.zw):vec4(0.);
   float depth=texture2D(groundWearMap,metres/128.+.5).g*.1524;
   float water=max(0.,basinWeather.y-.1524+depth);
   if(channel.r>.001){depth=channel.r;water=channel.g;}
   if(water>.002&&vSurfacePosition.z/10.<water-depth)discard;
  }
  if(groundArrow&&snowPresent){vec2 suv=(vWorld-snowBounds.xy)/snowBounds.zw;if(all(greaterThanEqual(suv,vec2(0.)))&&all(lessThanEqual(suv,vec2(1.)))){float snowHeight=snowSurfaceHeight(suv);if(snowHeight>vSurfacePosition.z/10.)discard;}}

  if(spriteWaterDepth>0.&&spriteSnowHeight.x+vUv.y*spriteSnowHeight.y<spriteWaterDepth)discard;
  if(spriteSnowOcclusion&&snowPresent){vec2 uv=(vLightWorld-snowBounds.xy)/snowBounds.zw;if(all(greaterThanEqual(uv,vec2(0.)))&&all(lessThanEqual(uv,vec2(1.)))){float h=snowSurfaceHeight(uv);if(h>.0005&&spriteSnowHeight.x+vUv.y*spriteSnowHeight.y<h)discard;}}
  if(vSnow<0.)texel=vec4(1.); // Scatter owns its grass/stone colors.
  if(grassMaterial&&vSnow>=0.){float broad=.5+.5*sin(vWorld.x*.009+sin(vWorld.y*.012)*1.7);float detail=.5+.5*sin(vWorld.y*.029+sin(vWorld.x*.021));float variation=.79+.18*broad+.07*detail;texel.rgb*=vec3(variation,variation,variation*.94);texel.rgb=mix(texel.rgb,texel.rgb*vec3(1.12,.96,.78),smoothstep(.68,.94,broad)*.42);}
  if(grassMaterial&&vSnow>=0.&&useRoadNormal&&!dynamicLighting){vec3 n=texture2D(roadNormal,vUv).xyz*2.-1.;texel.rgb*=clamp(.96+.10*n.x-.08*n.y+.04*n.z,.82,1.12);}
  if(grassMaterial&&vSnow>=0.){vec2 wearUv=vWorld/groundWearScale/128.+.5;vec4 basin=texture2D(groundWearMap,wearUv);float wear=basin.r;vec4 channel=streamEnabled?texture2D(streamMap,(vWorld/groundWearScale-streamBounds.xy)/streamBounds.zw):vec4(0.);float bankWear=max(smoothstep(0.,.14,channel.r),smoothstep(0.,.02,channel.g));wear=max(wear,bankWear);
   vec2 soilUv=vec2(vWorld.x/groundWearScale.x/3.+.5,.5-vWorld.y/groundWearScale.y/3.);vec3 soil=texture2D(groundWearSoil,soilUv).rgb;
   vec2 stepUv=1./vec2(textureSize(groundWearSoil,0));vec3 lum=vec3(.2126,.7152,.0722);
   float dx=dot(texture2D(groundWearSoil,soilUv+vec2(stepUv.x,0.)).rgb-texture2D(groundWearSoil,soilUv-vec2(stepUv.x,0.)).rgb,lum);
   float dy=dot(texture2D(groundWearSoil,soilUv+vec2(0.,stepUv.y)).rgb-texture2D(groundWearSoil,soilUv-vec2(0.,stepUv.y)).rgb,lum);
   soil*=clamp(1.+groundWearRelief*(dx*.7-dy*.6),.65,1.35);
   if(basinSurface&&vSnow>0.){
    float depth=basin.g*.1524,wet=basinWeather.x,water=max(0.,basinWeather.y-.1524+depth);
    if(channel.r>.001){depth=channel.r;water=channel.g;wet=max(wet,bankWear);}
    vec2 slope=basin.ba*2.-1.;float relief=channel.r>.001?1.:clamp(1.+dot(slope,vec2(.65,-.55)),.78,1.18);
    soil*=relief*(1.-wet*.36);soil=mix(soil,soil*vec3(.84,.78,.66),smoothstep(.55,.95,wet)*.25);
    float edgeWidth=max(.0055,fwidth(water)*.75);float pool=smoothstep(.0065-edgeWidth,.0065+edgeWidth,water)*smoothstep(0.,.002,water);vec3 puddle=mix(soil*.65,vec3(.25,.29,.28),.38);
    soil=mix(soil,puddle,pool);
    // Deep stream water obscures the soil; shallow edges retain their bed.
    if(channel.g>0.)soil=mix(soil,vec3(.075,.105,.115),pool*(1.-exp(-2.6*max(0.,water)))*.9);
    soil+=vec3(.035,.042,.045)*pool;
    // Small world-space wave slopes, filtered at distance. Reflection stays in
    // the existing floor pass; no scene capture or additional geometry.
    float travel=streamMotion.x*streamMotion.y;
    float phaseA=(channel.b-travel)*9.+sin(channel.a*5.)*.7;
    float phaseB=(channel.b-travel*.73)*17.+channel.a*7.;
    if(channel.g>0.&&streamMotion.y>0.&&streamMotion.z>0.){
     float flow=sin(phaseA)*.6/(1.+pow(fwidth(phaseA),2.))+sin(phaseB)*.4/(1.+pow(fwidth(phaseB),2.));
     soil+=vec3(.027,.033,.036)*flow*streamMotion.z*smoothstep(.015,.25,channel.g)*pool;
    }
    // Two virtual foam sheets: angled patterns with independent vertical
    // oscillations. Depth confines their intersections to the wet bank.
    // Stored water/bed geometry is unchanged; both sheets share this pass.
    float shoreDistance=texture2D(streamShoreMap,(waterWorld-streamBounds.xy)/streamBounds.zw).r;
    float fringeTime=travel*2.;
    vec2 fringePoint=waterWorld;
    float fringeA=dot(fringePoint,vec2(.94,.34));
    float fringeB=dot(fringePoint,vec2(.57,-.82));
    float fringeLevelA=.065+.025*sin(fringeTime*1.13)+.014*sin(fringeA*1.7);
    float fringeLevelB=.12+.035*sin(fringeTime*.797+2.1)+.016*sin(fringeB*1.3);
    float fringeAA=max(.006,fwidth(shoreDistance));
    float fringeBandA=1.-smoothstep(.012,.025+fringeAA,abs(shoreDistance-fringeLevelA));
    float fringeBandB=1.-smoothstep(.010,.024+fringeAA,abs(shoreDistance-fringeLevelB));
    float fringePhaseA=fringeA*7.-travel*.7+sin(fringeB*2.3);
    float fringePhaseB=fringeB*9.+travel*.43+sin(fringeA*1.9);
    float fringeBreakA=smoothstep(.18,.72,abs(sin(fringePhaseA)*.65+sin(fringeA*2.1+1.)*.35));
    float fringeBreakB=smoothstep(.25,.76,abs(sin(fringePhaseB)*.65+sin(fringeB*2.7)*.35));
    float fringeFilterA=1./(1.+pow(fwidth(fringePhaseA),2.));
    float fringeFilterB=1./(1.+pow(fwidth(fringePhaseB),2.));
    float fringeMask=step(.001,channel.g)*pool*(1.-smoothstep(.20,.28,shoreDistance));
    float fringe=clamp(fringeBandA*fringeBreakA*fringeFilterA+fringeBandB*fringeBreakB*fringeFilterB,0.,1.)*fringeMask*min(1.,streamMotion.z*2.);
    // Foam receives ordinary scene lighting, never an emissive white outline.
    soil=mix(soil,vec3(.48,.53,.50),fringe*.30);
    // Differentiate the sine analytically, not its sampled height: adjacent
    // fragments retain smooth normals instead of sharing a stepped quad slope.
    vec2 waveScreen=(cos(phaseA)*.006*vec2(dFdx(phaseA),dFdy(phaseA))/(1.+pow(fwidth(phaseA),2.))+cos(phaseB)*.003*vec2(dFdx(phaseB),dFdy(phaseB))/(1.+pow(fwidth(phaseB),2.)))*streamMotion.z;
    float determinant=waterDx.x*waterDy.y-waterDx.y*waterDy.x;
    vec2 waterSlope=abs(determinant)>.00000001?vec2(waveScreen.x*waterDy.y-waveScreen.y*waterDx.y,waterDx.x*waveScreen.y-waterDy.x*waveScreen.x)/determinant:vec2(0.);
    if(pool>0.)for(int i=0;i<${PUDDLE_RING_LIMIT};i++){if(i>=puddleRingCount)break;vec4 ring=puddleRings[i];vec2 delta=(vWorld-ring.xy)/groundWearScale;float distance=length(delta),offset=distance-ring.z;float band=exp(-pow(offset/.035,2.));soil+=vec3(.09,.105,.11)*(1.-smoothstep(.008,.025,abs(offset)))*ring.w*pool;waterSlope+=delta/max(.001,distance)*(-offset/.035)*band*ring.w*.12;}
    if(channel.g>0.){
     vec3 normal=normalize(vec3(-waterSlope.x,1.,-waterSlope.y));waterNormal=normal;streamSurface=pool;
     float facing=clamp(dot(normal,waterView),0.,1.);
     float fresnel=.02+.98*pow(1.-facing,5.);
     vec3 reflected=reflect(-waterView,normal);
     vec3 sky=mix(vec3(.34,.38,.40),vec3(.15,.25,.36),clamp(reflected.y,0.,1.));
     float warm=1.-min(1.,waterSun.y*3.);
     sky=mix(sky,waterSunColor*.34,warm*waterLight.y*.35);
     sky*=clamp(waterLight.x,0.,1.2);
     float glint=pow(max(0.,dot(reflected,waterSun)),96.);
     float visibility=step(.1001,vVisibility)*vVisibility;
     float sunVisible=1.-clamp(max(vSunLoss.r,max(vSunLoss.g,vSunLoss.b))*4.,0.,1.);
     waterReflectMix=pool*mix(.10,.28,smoothstep(.02,.75,water))*clamp(.5+fresnel*3.,.5,1.);
     waterReflection=sky*visibility;
     waterGlint=waterSunColor*glint*waterLight.y*sunVisible*.24*visibility*pool;
    }

   }
   texel.rgb=mix(texel.rgb,soil,wear);
  }
  if(vSnow<0.&&snowPresent){vec2 suv=(vWorld-snowBounds.xy)/snowBounds.zw;float cover=texture2D(snowAccumulation,clamp(suv,0.,1.)).g;texel.a*=1.-smoothstep(.25,.85,cover);}

  if(useFirLitter){vec2 uv=(vWorld-firLitterBounds.xy)/firLitterBounds.zw;if(all(greaterThanEqual(uv,vec2(0.)))&&all(lessThanEqual(uv,vec2(1.)))){vec4 litter=texture2D(firLitter,vec2(uv.x,1.-uv.y));// Ground litter cannot paint over stream or rain-filled basin water.
   float litterWater=0.;
   if(grassMaterial&&vSnow>0.){float depth=texture2D(groundWearMap,vWorld/groundWearScale/128.+.5).g*.1524;litterWater=max(0.,basinWeather.y-.1524+depth);if(streamEnabled){vec4 channel=texture2D(streamMap,(vWorld/groundWearScale-streamBounds.xy)/streamBounds.zw);if(channel.r>.001)litterWater=channel.g;}}
   float dryGround=1.-smoothstep(0.,.002,litterWater);
   texel.rgb=mix(texel.rgb,litter.rgb,litter.a*dryGround);}}
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
 float snowWater=0.;if(snowPresent&&grassMaterial&&vSnow>0.){float depth=texture2D(groundWearMap,vWorld/groundWearScale/128.+.5).g*.1524;snowWater=max(0.,basinWeather.y-.1524+depth);if(streamEnabled){vec4 channel=texture2D(streamMap,(vWorld/groundWearScale-streamBounds.xy)/streamBounds.zw);if(channel.r>.001)snowWater=channel.g;}}
 if(snowPresent&&vSnow>0.&&snowWater<=0.){
  float eligible=vSnow*step(0.,snowUv.x)*step(0.,snowUv.y)*step(snowUv.x,1.)*step(snowUv.y,1.);
  vec3 coats=texture2D(snowAccumulation,clamp(snowUv,0.,1.)).rgb*eligible;
  snowDepth=coats.b;
  float shelter=1.; // Retained coats already account for canopy interception.
  float thin=shelter*.62*smoothstep(${SNOW_COAT_BLEND_START},${SNOW_COAT_BLEND_END},coats.r);
  // Powder targets total opacity, accounting for the thin coat already blended below.
  float powderTarget=shelter*mix(.82,1.,smoothstep(0.,1.,snowDepth));
  snowPowder=clamp((powderTarget-thin)/max(.0001,1.-thin),0.,1.)*smoothstep(${SNOW_COAT_BLEND_START},${SNOW_COAT_BLEND_END},coats.g+coats.b);
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
   // Water absorbs most diffuse light. Keep local source energy in directional
   // reflections rather than painting the entire stream with the fire color.
   if(streamSurface>0.){
    base=mix(base,ambientBase+(base-ambientBase)*.18,streamSurface);
    radiance*=1.-streamSurface*.88;
    vec3 localReflection=vec3(0.);
    for(int i=0;i<32;i++){
     if(i>=emitterCount)break;
     vec4 source=emitterPosition[i],shape=emitterShape[i],color=emitterColor[i];
     if(color.a<=0.)continue;
     vec3 origin=source.xyz;float radius=shape.x;
     if(source.w>=.5){vec2 ground=vec2((source.x+source.y*.5)*64.,source.y*31.5)*lightWorld.xy+lightWorld.zw;origin=vec3(ground.x,source.z,ground.y);radius*=64.*lightWorld.x;}
     vec3 delta=origin-vLightPoint;float distanceSquared=dot(delta,delta);
     if(radius<=0.||distanceSquared>=radius*radius||delta.y<=0.)continue;
     if(emitterVisibility(i,vLightWorld,vec3(0.,1.,0.))<.5)continue;
     float distance=max(.01,sqrt(distanceSquared)),ratio=distanceSquared/(radius*radius);
     float strength=color.a;
     if(source.w<.5)strength*=pow(1.-ratio*ratio,2.)/(3.14159265*max(.01,pow(distance,shape.y)));
     else strength*=.18*pow(1.-ratio,2.);
     vec3 halfDirection=normalize(delta/distance+waterView);
     float alignment=max(0.,dot(waterNormal,halfDirection));
     float highlight=pow(alignment,24.)*.55+pow(alignment,64.)*1.35;
     localReflection+=color.rgb*strength*highlight;
    }
    waterGlint+=min(vec3(.8),localReflection)*streamSurface*step(.1001,vVisibility)*vVisibility;
   }
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
  if(spriteLighting){float brightness=clamp(dot(lit+radiance,vec3(.2126,.7152,.0722)),.02,1.);vec3 ink=mix(vec3(dot(texel.rgb,vec3(.2126,.7152,.0722))),texel.rgb,spriteSaturation);gl_FragColor=vec4(ink*brightness*spriteWetShade,texel.a*surfaceOpacity);}
  else {
   vec3 surfaceColor=clamp(texel.rgb*lit*vTint+vAdd+radiance,0.,1.);
   surfaceColor=clamp(mix(surfaceColor,waterReflection,waterReflectMix)+waterGlint,0.,1.);
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
 const woodTargets=createTransientTarget((width,height,samples)=>new THREE.WebGLRenderTarget(width,height,{samples,depthBuffer:true,stencilBuffer:false}));
 const particleTargets=createTransientTarget((width,height,samples)=>new THREE.WebGLRenderTarget(width,height,{samples,depthBuffer:true,stencilBuffer:false}));
 const treeCompositeMaterial=new THREE.ShaderMaterial({
  uniforms:{woodMask:{value:null},woodOutline:{value:false},woodOpacity:{value:.83},outlineOpacity:{value:.83},outlineColor:{value:new THREE.Vector3(.025,.055,.015)},snowOutline:{value:0},firOutline:{value:false},outlineStep:{value:new THREE.Vector2()},displaySpace:{value:false},artwork:{value:treeTarget.texture},rect:{value:new THREE.Vector4()},viewport:{value:new THREE.Vector2()}},
  vertexShader:'uniform vec4 rect;uniform vec2 viewport;varying vec2 vUv;void main(){vUv=uv;vec2 p=rect.xy+vec2(uv.x,1.-uv.y)*rect.zw;gl_Position=vec4(p.x/viewport.x*2.-1.,1.-p.y/viewport.y*2.,0.,1.);}',
  fragmentShader:`uniform sampler2D woodMask;uniform bool woodOutline;uniform float woodOpacity;uniform float outlineOpacity;uniform vec3 outlineColor;uniform float snowOutline;uniform bool firOutline;uniform vec2 outlineStep;uniform bool displaySpace;uniform sampler2D artwork;varying vec2 vUv;
   void main(){vec4 t=texture2D(artwork,vUv);float edge=0.;
    if(firOutline){
     float nearby=max(max(texture2D(artwork,vUv+vec2(outlineStep.x,0.)).a,texture2D(artwork,vUv-vec2(outlineStep.x,0.)).a),max(texture2D(artwork,vUv+vec2(0.,outlineStep.y)).a,texture2D(artwork,vUv-vec2(0.,outlineStep.y)).a));
     vec2 diagonal=outlineStep*.70710678;
     nearby=max(nearby,max(max(texture2D(artwork,vUv+diagonal).a,texture2D(artwork,vUv-diagonal).a),max(texture2D(artwork,vUv+vec2(diagonal.x,-diagonal.y)).a,texture2D(artwork,vUv+vec2(-diagonal.x,diagonal.y)).a)));
     edge=max(0.,nearby-t.a)*outlineOpacity;
    }
    float woodEdge=0.;if(woodOutline){float center=texture2D(woodMask,vUv).r,nearby=center;for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){vec2 stepOffset=vec2(float(x),float(y))*outlineStep*(x!=0&&y!=0?.70710678:1.);nearby=max(nearby,texture2D(woodMask,vUv+stepOffset).r);}woodEdge=max(0.,nearby-center)*woodOpacity;edge*=1.-nearby;}
    if(t.a<=0.&&edge<=0.&&woodEdge<=0.)discard;
    gl_FragColor=vec4(t.rgb/max(t.a,.00001),t.a);
    if(!displaySpace){
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }
    gl_FragColor.rgb*=gl_FragColor.a;
    // Faint dark-green fringe behind coverage, in display space.
    gl_FragColor.rgb+=mix(outlineColor,vec3(.40,.52,.65),snowOutline)*edge*(1.-t.a);
    gl_FragColor.a+=edge*(1.-t.a);
    gl_FragColor.rgb*=1.-woodEdge;gl_FragColor.a+=woodEdge*(1.-gl_FragColor.a);
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
 function paint(mesh,category='Other surfaces'){scene.add(mesh);const label=mesh===quad||mesh===treeComposite?'Composite':category;perf.count('draws:'+label);perf.measure(label==='Composite'?'composite':'surfaceDraw',()=>gpuPerf.measure(label,()=>renderer.render(scene,camera)));scene.remove(mesh);}
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
 function release(record){record.gpuSurface?.dispose();record.mesh.geometry.dispose();record.mesh.material.dispose();}
 const projectedShadows=createProjectedShadowPass({renderer,camera,texture,flush,getView:()=>view,getSnow:()=>snow,onPaint:()=>{needsBackdrop=true;}});
 const outlines=createGpuOutline(renderer,flush,()=>view,()=>{needsBackdrop=true;});
 const lostListener=event=>{event.preventDefault();lost=true;corpseImages.clear();onLost();};
 const restoredListener=()=>{lost=false;projectedShadows.invalidate();for(const t of textures.values())t.needsUpdate=true;rasterTexture.needsUpdate=true;maskTexture.needsUpdate=true;onRestored();};
 canvas.addEventListener('webglcontextlost',lostListener);canvas.addEventListener('webglcontextrestored',restoredListener);
 const groundWear=createGroundWear(),wetBasins=new CombatWetBasins();
 const stream=createStreamField({size:1024,fit:true,groundDepth:(x,y)=>-groundWear.elevation(x,y,1,1)}),streamPixels=new Uint16Array(stream.data.length),streamMap=new THREE.DataTexture(streamPixels,stream.size,stream.size,THREE.RGBAFormat,THREE.HalfFloatType);streamMap.minFilter=streamMap.magFilter=THREE.LinearFilter;streamMap.needsUpdate=true;
 const streamSnowLimit=createStreamSnowLimit();
 const streamShoreDistance=createStreamShoreDistance(),streamShorePixels=new Uint16Array(stream.size*stream.size),streamShoreMap=new THREE.DataTexture(streamShorePixels,stream.size,stream.size,THREE.RedFormat,THREE.HalfFloatType);streamShoreMap.minFilter=streamShoreMap.magFilter=THREE.LinearFilter;streamShoreMap.needsUpdate=true;
 let streamScene=null,streamPath=null,streamOptions={...STREAM_DEFAULTS};
 const streamAt=(x,y,unit=128/3,squash=.568329)=>stream.sample(x/unit,y/(unit*squash));
 let streamGeometryKey='';
 function configureStream(options=streamOptions){if(options.path)streamPath=options.path;streamOptions=streamSettings({...streamOptions,...options});const points=streamPath||streamScene?.streamPath||[],enabled=!!streamScene?.streamPath&&streamOptions.enabled,key=JSON.stringify([points,enabled,streamOptions.width,streamOptions.depth,streamOptions.level]);if(key===streamGeometryKey)return;stream.configure(points,{...streamOptions,enabled});streamSnowLimit.configure(stream);streamShoreDistance.configure(stream);for(let i=0;i<streamShorePixels.length;i++)streamShorePixels[i]=THREE.DataUtils.toHalfFloat(Math.min(2,streamShoreDistance.data?.[i]||0));streamShoreMap.needsUpdate=true;streamGeometryKey=key;for(let i=0;i<stream.data.length;i++){streamPixels[i]=THREE.DataUtils.toHalfFloat(stream.data[i]);}streamMap.needsUpdate=true;}
 const groundElevation=(x,y,unit,squash)=>{const channel=streamAt(x,y,unit,squash);const wear=streamBankWear(channel.depth,channel.water);return groundWear.elevation(x,y,unit,squash)*(1-wear)-channel.depth*wear;};
 const groundCoverage=(x,y,unit,squash)=>{const channel=streamAt(x,y,unit,squash);return Math.min(groundWear.coverage(x,y,unit,squash),1-streamBankWear(channel.depth,channel.water));};
 const waterAt=(x,y,unit,squash)=>{const channel=streamAt(x,y,unit,squash);return channel.depth>.001?channel:null;};
 snow.setWaterSource(()=>({revision:stream.revision,level:wetBasins.water,snowLimit:(x,y)=>streamSnowLimit.fraction(x/(128/3),y/((128/3)*.568329)),threshold:(x,y)=>{const channel=streamAt(x,y);if(channel.depth>.001)return channel.water>0?-Infinity:Infinity;return .1524+groundWear.elevation(x,y);}}));
 const puddles=new CombatPuddleEffects({step:(x,y,entity,f)=>{const unit=f.grassUnit||128/3,squash=f.grassSquash||.568329,wear=1-groundWear.coverage(x,y,unit,squash),depth=f.grass?-groundWear.elevation(x,y,unit,squash):0;const kind=globalThis.combatFootstepSurface?.({kind:f.groundKind||'grass',wear,wetness:wetBasins.wet,water:waterAt(x,y,unit,squash)?.water??Math.max(0,wetBasins.water-.1524+depth)});if(kind)globalThis.adventurePartyTerrainStep?.(kind);},waterAt,permanent:()=>stream.settings.enabled,elevation:groundWear.elevation,water:()=>wetBasins.water,visible:f=>{const h=f.snowHex?.split(',').map(Number);return !h||globalThis.isHexVisibleToFriendlyParty?.(...h)!==false;}}),puddleParticles=createPuddleParticles(),puddleRings=new Float32Array(PUDDLE_RING_LIMIT*4);
 let firOutlineWidth=.75,defaultTreeOutlineOpacity=.83;const defaultTreeOutlineColor=[.025,.055,.015];
 const groundCover=createGroundCover({renderer,tuning:{grassCoverage:groundCoverage,groundElevation,groundWater:(x,y,unit,squash)=>streamAt(x,y,unit,squash).water},snow,texture,paint,flush,markBackdrop:()=>{needsBackdrop=true;}});
 const api={
  groundCover,
  setStreamScene(id){if(streamScene!==id){streamScene=id;streamPath=null;streamOptions={...STREAM_DEFAULTS,...id?.streamSettings};configureStream();groundCover.invalidate();}},
  configureStream(options){const revision=stream.revision;configureStream(options);if(stream.revision!==revision)groundCover.invalidate();},
  streamState:()=>({...stream.settings,speed:streamOptions.speed,ripple:streamOptions.ripple,rockCount:0,revision:stream.revision,path:stream.path}),
  streamSample:streamAt,
  unitGroundSample(x,y){const channel=streamAt(x,y);if(channel.depth>.001)return {...channel,bedDepth:-groundElevation(x,y,128/3,.568329)};const depth=-groundWear.elevation(x,y);return {depth,bedDepth:depth,water:Math.max(0,wetBasins.water-.1524+depth)};},
  get unitWaterSurface(){return {stream:streamMap,bounds:stream.bounds,enabled:stream.settings.enabled,basins:groundWear.mask,level:wetBasins.water,revision:stream.revision,active:stream.settings.enabled||wetBasins.water>0};},
  setTerrainTuning(options){groundCover.setTuning(options.grass);firOutlineWidth=options.outline.width;defaultTreeOutlineOpacity=options.outline.opacity;defaultTreeOutlineColor.splice(0,3,...options.outline.color);},
  context,
  get unitSnowRevision(){return snow.surfaceRevision;},
  get unitSnowSurface(){return snow.hasCoverage?unitSnowSurface:null;},
  wetGroundActive:()=>wetBasins.active||puddles.active||(stream.settings.enabled&&streamOptions.speed>0&&streamOptions.ripple>0),
  streamMotionActive:()=>stream.settings.enabled&&streamOptions.speed>0&&streamOptions.ripple>0,
  puddleEffectsActive:()=>puddles.active,
  trackGroundFootfalls:entity=>puddles.trackRig(entity),
  groundFootfall:(entity,x,y)=>puddles.plant(entity,x,y),
  puddleEffectsState:()=>puddles.snapshot(),
  drawPuddles(movers){puddles.walk(movers);if(puddleParticles.update(puddles,view,canvas.width/view.width)){flush();paint(puddleParticles.mesh,'Puddle splashes');needsBackdrop=true;}},
  wetGroundState:()=>wetBasins.snapshot(),
  snowScene:(id,extent)=>{if(streamScene!==id){streamScene=id;streamPath=null;streamOptions={...STREAM_DEFAULTS,...id?.streamSettings};configureStream();}wetBasins.scene(id);puddles.scene(id);groundCover.scene(id);if(id!==corpseSceneId){corpseImages.clear();corpseSceneId=id;}return snow.scene(id,extent);},
  firLitter(id,trees,bounds,radius,squash=1){const shelterKey=JSON.stringify([bounds,radius,squash,trees]);if(snowShelterUniforms.snowShelter.value.userData.shelterKey!==shelterKey){configureSnowShelter(trees,bounds,radius,squash);featherTrunkShelter(snowShelterUniforms.snowShelter.value.image.data);finalizeSnowShelter(snow.hasCoverage);snowShelterUniforms.snowShelter.value.userData.shelterKey=shelterKey;}if(shelterKey!==litterId){if(litter){const old=textures.get(litter.image);old?.dispose();textures.delete(litter.image);}litterId=shelterKey;litter=createFirLitter(trees,bounds,radius,squash);}},
  snowGround:faces=>snow.setGround(faces),
  snowCoatCoverage:()=>snow.coatCoverage,
  snowGroundSample:(x,y)=>snow.sampleGround(x,y),
  snowAmount:(x,y)=>snow.hexes.get(x+','+y)?.amount||0,
  treeSnowAmount:(x,y)=>Math.floor(Math.min(snow.coatProgress/4,snow.hexes.get(x+','+y)?.amount||0)*400)/400,
  snowHeat:sources=>snow.setHeat(sources),
  meltSnow:(cells,amount)=>snow.melt(cells,amount),
  featherSnow:(cells,radius,squash)=>snow.featherMelt(cells,radius,squash),
  projectedShadows,corpseSnowHDR,
  get available(){return !lost&&!disposed;},
  prepareOverlay,
  fireball(options){if(lost||disposed||!frameOpen)return false;flush();gpuPerf.measure('Fireball',()=>fireballEffect.draw(options,view));needsBackdrop=true;return true;},
  unitOutline(callback,options){if(lost||disposed||!frameOpen)return false;flush();return gpuPerf.measure('Outlines',()=>outlines.draw(callback,options));},
  burnSmoke(options){if(lost||disposed||!frameOpen)return false;burnSmoke.update(options,view);if(!burnSmoke.mesh.visible)return true;flush();paint(burnSmoke.mesh);return true;},
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
  treeScene(callback,{particles=false,unit=false,bounds=null,burn=null,weaponFlame=null,cache=null,woodMask=null,firOutline=false,outlineColor=null,outlineFade=1,displaySpace=false,snowOutline=0}={}){
   return perf.measure(unit?'modelTotal':particles?'particleTotal':'treeTotal',()=>{
   if(lost||disposed||!frameOpen)return null;flush();
   const clearColor=renderer.getClearColor(new THREE.Color()),clearAlpha=renderer.getClearAlpha();
   const target=renderer.getRenderTarget(),tone=renderer.toneMapping,exposure=renderer.toneMappingExposure,shadows=renderer.shadowMap.enabled;
   try{renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.shadowMap.enabled=!unit;renderer.shadowMap.type=THREE.PCFShadowMap;
     let samples=unit?unitAntialiasing().samples:treeAntialiasing().samples;
     if(cache&&corpseSamples)samples=Math.max(0,...corpseSamples.filter(n=>n<=samples));
     if(!unit&&treeTarget.samples!==samples){treeTarget.dispose();treeTarget.samples=samples;}
     if((firOutline||woodMask)&&bounds){const pad=2/view.zoom;bounds={x:bounds.x-pad,y:bounds.y-pad,width:bounds.width+pad*2,height:bounds.height+pad*2};}
     const {crop,targetWidth,targetHeight}=modelPixelCrop(bounds,view,canvas.width,canvas.height);
     if(targetWidth<=0||targetHeight<=0){perf.count('offscreenModelPassesSkipped');return true;}
     const imageKey=cache&&JSON.stringify([cache.key,view.zoom,view.anchor,view.width,view.height,crop,canvas.width,canvas.height]);
     const retained=cache&&corpseImages.get(cache.owner,imageKey,targetWidth,targetHeight,samples);
     let renderTarget=treeTarget;
     if(retained)renderTarget=retained.target;
     else if(cache)renderTarget=corpseScratch.get(targetWidth,targetHeight,samples);
     else if(particles)renderTarget=particleTargets.get(targetWidth,targetHeight,samples);
     else if(bounds)renderTarget=unitTargets.get(targetWidth,targetHeight,samples);
     else if(treeTarget.width!==targetWidth||treeTarget.height!==targetHeight)treeTarget.setSize(targetWidth,targetHeight);
     treeCompositeMaterial.uniforms.firOutline.value=firOutline&&!unit;treeCompositeMaterial.uniforms.snowOutline.value=unit?0:snowOutline;
     treeCompositeMaterial.uniforms.outlineOpacity.value=defaultTreeOutlineOpacity*Math.max(0,Math.min(1,outlineFade));
     treeCompositeMaterial.uniforms.outlineColor.value.fromArray(outlineColor||defaultTreeOutlineColor);
     treeCompositeMaterial.uniforms.outlineStep.value.set(firOutlineWidth/crop.width,firOutlineWidth/crop.height);
     treeCompositeMaterial.uniforms.artwork.value=renderTarget.texture;
     treeCompositeMaterial.uniforms.rect.value.set(crop.x,crop.y,crop.width,crop.height);treeCompositeMaterial.uniforms.viewport.value.set(view.width,view.height);
     perf.count(unit?'unitTargetPixels':'treeTargetPixels',targetWidth*targetHeight);
     let result=true;
     if(retained?.ready){perf.count('corpseImageCacheHits');}
     else{
      renderTarget.userData??={};renderTarget.userData.corpseDisplaySpace=false;renderer.setRenderTarget(renderTarget);renderer.setClearColor(0,0);renderer.clear(true,true,false);
      perf.count(unit?'unitPasses':'treePasses');if(cache)perf.count('corpseImageCacheMisses');
      result=perf.measure(unit?'unitSubmission':'treeSubmission',()=>gpuPerf.measure(unit?'Models':'Trees',()=>callback(renderer,{...view,crop})));
      if(retained)retained.ready=result===true;
     }
     treeCompositeMaterial.uniforms.woodOutline.value=!!woodMask&&!unit;treeCompositeMaterial.uniforms.woodOpacity.value=.83;
     if(woodMask&&!unit){const maskTarget=woodTargets.get(targetWidth,targetHeight,samples);renderer.setRenderTarget(maskTarget);renderer.setClearColor(0,0);renderer.clear(true,true,false);perf.measure('woodMasks',()=>gpuPerf.measure('Wood outline mask',()=>woodMask(renderer,{...view,crop})));treeCompositeMaterial.uniforms.woodMask.value=maskTarget.texture;}
     let bladeTexture=null;
     if(weaponFlame?.root){
      const bladeTarget=weaponFlameTargets.get(targetWidth,targetHeight,samples);
      renderer.setRenderTarget(bladeTarget);renderer.clear(true,true,false);
      const visible=perf.measure('weaponFlame',()=>weaponFlameMask.draw(renderer,weaponFlame.root,weaponFlame.camera));
      if(visible){bladeTexture=bladeTarget.texture;perf.count('weaponFlameMaskPasses');}
     }
     // Render targets contain linear, premultiplied coverage. Tone-map once,
     // after resolving MSAA, then composite without dark fringes at the leaves.
     treeCompositeMaterial.uniforms.displaySpace.value=displaySpace||!!renderTarget.userData?.corpseDisplaySpace;renderer.setRenderTarget(target);if(burn){burnEffect.update({texture:renderTarget.texture,crop,...burn},view);paint(burnEffect.mesh);}paint(treeComposite);if(bladeTexture){burnEffect.update({texture:bladeTexture,crop,...weaponFlame,scale:weaponFlame.scale*view.zoom},view);paint(burnEffect.mesh);perf.count('weaponFlameComposites');}return result;
   }finally{renderer.setRenderTarget(target);renderer.toneMapping=tone;renderer.toneMappingExposure=exposure;renderer.shadowMap.enabled=shadows;renderer.setClearColor(clearColor,clearAlpha);needsBackdrop=true;}
   });
  },
  setLighting(next){lighting=next;if(next){next.packed=packCombatLights(next.lights);if(next.mask!==maskTexture.image||next.maskRevision!==maskTexture.userData.revision){if(maskTexture.image.width!==next.mask.width||maskTexture.image.height!==next.mask.height)maskTexture.dispose();maskTexture.image=next.mask;maskTexture.userData.revision=next.maskRevision;maskTexture.needsUpdate=true;}}},
  presentOverlay(){flush();},
  begin(nextView){
   if(lost||disposed)return false;
   wetBasins.update(performance.now(),globalThis.getWeatherSnapshot?.(),globalThis.document?.visibilityState==='hidden');
   puddles.begin(performance.now(),globalThis.getWeatherSnapshot?.(),{hidden:globalThis.document?.visibilityState==='hidden',snow:snow.hasCoverage});puddleRings.fill(0);for(let i=0;i<puddles.rings.length;i++){const p=puddles.rings[i];puddleRings.set([p.x,p.y,.02+p.reach*p.age/p.life,(1-p.age/p.life)*(p.strength??.75)],i*4);}
   gpuPerf.begin();perf.begin();view=nextView;groundCover.begin(view);snow.begin();projectedShadows.begin();lighting=null;slot=0;frameOpen=true;needsBackdrop=false;clearRaster();renderer.info.reset();
   const width=canvas.width,height=canvas.height;
   if(width>renderer.capabilities.maxTextureSize||height>renderer.capabilities.maxTextureSize)throw Error('Combat resolution exceeds this device’s graphics limits.');
   if(raster.width!==width||raster.height!==height){rasterTexture.dispose();raster.width=width;raster.height=height;}
   renderer.setViewport(0,0,width,height);renderer.clear(true,false,false);
   camera.right=view.width;camera.bottom=view.height;camera.updateProjectionMatrix();return true;
  },
  surface(surfaces,image,{groundArrow=false,grassMaterial=false,lightMap=null,dynamicLighting=false,spriteLighting=false,spriteSnowHeight=null,spriteWaterDepth=0,spriteWetShade=1,saturation=1,screenSpace=false,opacity=1,scorch=[],scorchSquash=1,groundScorch=null,normalMap=null,sunShadow=false,needleLitter=false,contactScale=[1,1,1],category='Other surfaces'}={}){
   if(lost||!frameOpen||!surfaces.length||!image)return;
   const shadowOnly=category==='Ground shadows'||category==='Fir contact';
   if(category==='Fir contact'&&!api.projectedShadows.contactLighting().receiver)return;
   if(!shadowOnly)snow.collect(surfaces);
   // Collect decoration separately; its roots participate in actor painter ordering.
   if(category==='Floor'){groundCover.collect(surfaces,{lightMap,groundScorch});puddles.collect(surfaces);}
   const basinSurface=category==='Floor'&&grassMaterial;
   const snowDivisions=category==='Floor'&&snow.hasCoverage?8:basinSurface&&stream.settings.enabled?4:1;
   const useGpuSurface=!shadowOnly&&category==='Floor'&&snowDivisions>1&&surfaces.every(f=>f.snowEligible>0&&f.points.length>=3);
   flush();const recordSlot=slot++;let record=records[recordSlot];
   if(record&&(record.shadowOnly!==shadowOnly||!!record.gpuSurface!==useGpuSurface)){release(record);record=null;}
   if(!record){
    const gpuSurface=useGpuSurface?createGpuSurface():null;
    const geometry=new THREE.BufferGeometry(),material=new THREE.ShaderMaterial({defines:useGpuSurface?{GPU_SURFACE:1}:{},vertexShader:shadowOnly?shadowVertexShader:vertexShader,fragmentShader:shadowOnly?shadowFragmentShader:fragmentShader,
     uniforms:{streamShoreMap:{value:streamShoreMap},waterSun:{value:new THREE.Vector3()},waterSunColor:{value:new THREE.Vector3(1,1,1)},waterView:{value:new THREE.Vector3(0,.568329,.8228)},waterLight:{value:new THREE.Vector2(1,1)},surfaceSource:{value:gpuSurface?.texture||null},streamMotion:{value:new THREE.Vector3()},streamMap:{value:streamMap},streamBounds:{value:new THREE.Vector4()},streamEnabled:{value:false},...contactUniforms(),puddleRingCount:{value:0},puddleRings:{value:puddleRings},basinSurface:{value:false},basinWeather:{value:new THREE.Vector2()},groundArrow:{value:false},groundWearMap:{value:groundWear.mask},groundWearSoil:{value:groundWear.soil},groundWearScale:{value:new THREE.Vector2(128/3,128/3*.568329)},groundWearRelief:{value:WEAR_SETTINGS.soilRelief},...snowShelterUniforms,snowDisplaced:{value:false},snowTexel:{value:snow.texelSize},grassMaterial:{value:false},snowPresent:{value:false},useFirLitter:{value:false},firLitter:{value:null},firLitterBounds:{value:new THREE.Vector4()},snowSunShadow:{value:false},snowFootprints:{value:snow.footprintTexture},snowAccumulation:{value:snow.texture},snowBounds:{value:snow.bounds},useRoadNormal:{value:false},roadNormal:{value:null},useGroundScorch:{value:false},groundScorchImage:{value:null},groundScorchBounds:{value:new THREE.Vector4()},scorchCount:{value:0},scorchEnds:{value:new Float32Array(16)},scorchMarks:{value:new Float32Array(32)},scorchSquash:{value:1},dynamicLighting:{value:false},spriteLighting:{value:false},spriteSaturation:{value:1},spriteWetShade:{value:1},spriteWaterDepth:{value:0},spriteSnowHeight:{value:new THREE.Vector2()},spriteSnowOcclusion:{value:false},screenSpace:{value:false},surfaceOpacity:{value:1},emitterCount:{value:0},emitterPosition:{value:new Float32Array(128)},emitterColor:{value:new Float32Array(128)},emitterShape:{value:new Float32Array(128)},emitterBounds:{value:new Float32Array(128)},emitterMask:{value:maskTexture},lightWorld:{value:new THREE.Vector4(1,1,0,0)},artwork:{value:null},lightMultiply:{value:null},lightBoost:{value:null},useLightMap:{value:false},lightBounds:{value:new THREE.Vector4()},combatView:{value:new THREE.Matrix3()},anchor:{value:new THREE.Vector2()},zoom:{value:1}},
     depthTest:false,depthWrite:false,side:THREE.DoubleSide,transparent:true,toneMapped:false});
    const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;records[recordSlot]=record={mesh,shadowOnly,gpuSurface};
   }
   let geometry=record.mesh.geometry;
   // Refine only the displaced outdoor floor; retain source snapshots and the
   // existing single floor draw. Shared edge subdivision avoids cracks at melt/track boundaries.
   if(record.gpuSurface){
    const triangles=perf.measure('surfaceBuffers',()=>record.gpuSurface.update(surfaces,snowDivisions,(name,value)=>perf.count(name,value)));
    if(record.mesh.geometry!==record.gpuSurface.geometry){record.mesh.geometry.dispose();record.mesh.geometry=record.gpuSurface.geometry;}
    perf.count('triangles:'+category,triangles);perf.count('faces:'+category,surfaces.length);
   }else{
    const vertices=surfaceVertexCount(surfaces,snowDivisions,snowDivisions>1);
    if(geometry.getAttribute('position')&&geometry.getAttribute('position').count!==vertices){geometry.dispose();record.mesh.geometry=geometry=new THREE.BufferGeometry();}
    perf.measure('surfaceBuffers',()=>updateSurfaceBuffers(geometry,surfaces,THREE,name=>perf.count(name),shadowOnly,snowDivisions,snowDivisions>1));
    perf.count('triangles:'+category,(geometry.index?.count||vertices)/3);perf.count('faces:'+category,surfaces.length);
   }
   const u=record.mesh.material.uniforms,[a,b,c,d,tx,ty]=view.matrix;

   u.useFirLitter.value=!!(needleLitter&&litter);u.firLitter.value=litter?texture(litter.image):null;if(litter)u.firLitterBounds.value.fromArray(litter.bounds);
   const waterSolar=globalThis.adventurePartySolar?.state?.()||solarState(12),waterPalette=solarPalette(waterSolar);
   u.waterSun.value.set(waterSolar.direction.x,waterSolar.direction.y,waterSolar.direction.z).normalize();u.waterSunColor.value.set(...waterPalette.sun);u.waterLight.value.set(waterSolar.sky,waterSolar.altitude>0?waterSolar.daylight:0);
   const viewGround=Math.hypot(b,d*.568329)||1;u.waterView.value.set(b/viewGround*.8228,.568329,d*.568329/viewGround*.8228).normalize();
   u.streamMotion.value.set(performance.now()/1000,streamOptions.speed,streamOptions.ripple);u.streamBounds.value.fromArray(stream.bounds);u.streamEnabled.value=stream.settings.enabled;u.puddleRingCount.value=puddles.rings.length;u.basinSurface.value=basinSurface;u.basinWeather.value.set(wetBasins.wet,wetBasins.water);u.groundArrow.value=groundArrow;u.grassMaterial.value=grassMaterial;const grassFace=surfaces.find(f=>f.grass);if(grassFace)u.groundWearScale.value.set(grassFace.grassUnit||128/3,(grassFace.grassUnit||128/3)*(grassFace.grassSquash||.568329));
   u.ambientContact.value=false;if(category==='Fir contact')updateContactUniforms(u,api.projectedShadows.contactLighting(),contactScale,texture);
   u.snowDisplaced.value=snow.hasCoverage;u.snowPresent.value=snow.hasCoverage;u.snowSunShadow.value=sunShadow;
   u.combatView.value.set(a,c,tx,b,d,ty,0,0,1);u.anchor.value.set(view.anchor.x,view.anchor.y);u.zoom.value=view.zoom;
   u.scorchCount.value=Math.min(8,scorch?.length||0);u.scorchSquash.value=scorchSquash;
   u.scorchEnds.value.fill(0);u.scorchMarks.value.fill(0);for(let i=0;i<u.scorchCount.value;i++){const mark=scorch[i];u.scorchMarks.value.set([mark.x,mark.y,mark.radius,1],i*4);u.scorchEnds.value.set([mark.endX??mark.x,mark.endY??mark.y],i*2);}
   u.dynamicLighting.value=!!(dynamicLighting&&lighting);u.spriteLighting.value=spriteLighting;u.spriteWaterDepth.value=spriteWaterDepth;u.spriteSnowOcclusion.value=!!spriteSnowHeight;if(spriteSnowHeight)u.spriteSnowHeight.value.fromArray(spriteSnowHeight);u.spriteSaturation.value=saturation;u.spriteWetShade.value=spriteWetShade;u.screenSpace.value=screenSpace;u.surfaceOpacity.value=opacity;
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
  flushProjectedShadows(){return perf.measure('shadowDraw',()=>gpuPerf.measure('Shadows',()=>projectedShadows.flush()));},
  end(){if(!frameOpen)return;perf.measure('shadowDraw',()=>gpuPerf.measure('Shadows',()=>{projectedShadows.flush();projectedShadows.end();}));flush();perf.measure('snow',()=>gpuPerf.measure('Snow',()=>snow.end(view)));gpuPerf.end();perf.end();if(perf.enabled)canvas.dataset.combatProfile=JSON.stringify(perf.snapshot());frameOpen=false;
   // A larger previous scene must not retain one GPU buffer per old wall.
   while(records.length>slot)release(records.pop());
   // Exposure maps are replaced after movement/door changes; release old maps.
   const retainedTextures=new Set(records.flatMap(r=>{const u=r.mesh.material.uniforms;return [u.roadNormal.value,u.artwork.value,u.lightMultiply.value,u.lightBoost.value,u.groundScorchImage.value];}));
   for(const [image,t] of textures)if(image!==litter?.image&&image.tagName==='CANVAS'&&!projectedShadows.uses(image)&&!retainedTextures.has(t)){t.dispose();textures.delete(image);}
   canvas.dataset.combatRenderer='three-webgl2';
   canvas.dataset.gpuStats=JSON.stringify({calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,shadowBatches:projectedShadows.diagnostics().batches,shadowTriangles:projectedShadows.diagnostics().triangles,shaderLights:lighting?.lights.length||0,lighting:lighting?'gpu-point-lights':'cpu-reference'});
  },
  orderSurfaceActors,
  diagnostics(){return {backend:'three-webgl2',targetPool:unitTargets.stats(),particleTarget:particleTargets.stats(),woodTarget:woodTargets.stats(),corpseImageCache:corpseImages.stats(),groundCover:groundCover.diagnostics(),contextLost:lost,drawCalls:renderer.info.render.calls,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures};},
  dispose(){if(disposed)return;disposed=true;canvas.removeEventListener('webglcontextlost',lostListener);canvas.removeEventListener('webglcontextrestored',restoredListener);
   streamShoreMap.dispose();streamMap.dispose();puddleParticles.dispose();groundWear.dispose();groundCover.dispose();weaponFlameMask.dispose();weaponFlameTargets.dispose();fireballEffect.dispose();burnSmoke.dispose();burnEffect.dispose();gpuPerf.dispose();pendingUnits=[];outlines.dispose();snow.dispose();projectedShadows.dispose();records.forEach(release);textures.forEach(t=>t.dispose());treeTarget.dispose();woodTargets.dispose();particleTargets.dispose();unitTargets.dispose();corpseScratch.dispose();corpseImages.clear();treeCompositeMaterial.dispose();quadGeometry.dispose();quadMaterial.dispose();rasterTexture.dispose();maskTexture.dispose();renderer.dispose();}
 };
 return api;
}











