import {BROADLEAF_FAMILIES,broadleafAsset} from './broadleaf-family.mjs?v=sweet-birch1';
import {createLeafSnowLanding,LEAF_SNOW_DECODE} from './leaf-snow-landing.mjs?v=tree-snow-grains1';
import {indexCoverGeometry} from './cover-geometry.mjs';
import {createCoverDepthSorter} from './cover-depth-sort.mjs';
import {createDebrisGrassPressure} from './debris-grass-pressure.mjs?v=two-tree1';
import {getSeason} from './combat-seasons.mjs';
import {LEAF_POSITIONS,LEAF_UVS,MAPLE_LEAF_POSITIONS,MAPLE_LEAF_UVS,BEECH_LEAF_POSITIONS,BIRCH_LEAF_POSITIONS,leafScatter} from './combat-tree-litter.mjs?v=sweet-birch1';
import {grassRetention} from './tree-environment-profiles.mjs?v=sweet-birch1';
import {canopyPlacements} from './grass-canopy.mjs?v=soft-grass1';
import {corpseGroundFootprints,corpseGroundFootprintRevision} from './combat-snow-footprints.mjs?v=shore-snow1';
import {createCorpseCoverIndex} from './combat-corpse-cover.mjs';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {SNOW_DEPTH_GLSL} from './combat-snow-depth.mjs?v=shore-snow1';
import {SNOW_SHELTER_GLSL,snowShelterUniforms,snowExposureAt,snowShelterRevision} from './combat-snow-shelter.mjs?v=tree-snow-grains1';
import {SCENE_STYLE} from './exploration-scene-style.mjs';

import {CANOPY_GRASS_DEFAULTS} from './grass-presets.mjs?v=foliage-restored1';
export {ORIGINAL_GRASS_DEFAULTS} from './grass-presets.mjs?v=foliage-restored1';
export const GROUND_COVER_DEFAULTS=CANOPY_GRASS_DEFAULTS;

// Presentation only. Positions use the unswung tactical ground plane; heights use metres.
export function coverHash(x,y,salt=0){let h=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(salt+1,1442695041);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;}
export function coverField(x,y){
 const noise=(x,y)=>{const ix=Math.floor(x),iy=Math.floor(y),u=x-ix,v=y-iy,a=u*u*(3-2*u),b=v*v*(3-2*v);return (coverHash(ix,iy)*(1-a)+coverHash(ix+1,iy)*a)*(1-b)+(coverHash(ix,iy+1)*(1-a)+coverHash(ix+1,iy+1)*a)*b;};
 return noise(x*.31,y*.31)*.7+noise(x*.89+19,y*.89-8)*.3;
}
export function coverContains(p,x,y){let inside=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if(((a.y>y)!==(b.y>y))&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;}
export function coverPlacements(face,tuning=GROUND_COVER_DEFAULTS){
 if(!face.grass||face.snowEligible<=0||face.points.length<3)return [];
 const unit=face.grassUnit||128/3,squash=face.grassSquash||.568329,step=.43*unit,sy=step*squash,p=face.points,out=[];
 const x0=Math.floor(Math.min(...p.map(v=>v.x))/step),x1=Math.floor(Math.max(...p.map(v=>v.x))/step),y0=Math.floor(Math.min(...p.map(v=>v.y))/sy),y1=Math.floor(Math.max(...p.map(v=>v.y))/sy);
 for(let gx=x0;gx<=x1;gx++)for(let gy=y0;gy<=y1;gy++){
  const x=(gx+.1+coverHash(gx,gy,1)*.8)*step,y=(gy+.1+coverHash(gx,gy,2)*.8)*sy;
  const field=coverField(x/unit,y/(unit*squash)),seed=coverHash(gx,gy,3),pick=coverHash(gx,gy,4);
  // Cohesive lush islands, sparse dry margins and persistent openings.
  const type=pick<.026?1:pick<.043?2:0;
  if(type===0&&tuning.canopyEnabled)continue;
  if(type===0&&seed>Math.max(.10,Math.min(.95,(field-.19)*1.7)))continue;
  // Three distinct roots per accepted grass cell; debris density stays unchanged.
  // Wrap offsets within the cell so clipping fragments cannot change placement.
  for(let tuft=0;tuft<(type===0?(tuning.tufts??3):1);tuft++){
   const px=tuft===0?x:(gx+((x/step-gx+tuft/3)%1))*step;
   const py=tuft===0?y:(gy+((y/sy-gy+tuft*.381966)%1))*sy;
   if(!coverContains(p,px,py))continue;
   if(tuning.groundWater?.(px,py,unit,squash)>.02)continue;
   if(type===0&&tuning.grassCoverage&&coverHash(gx,gy,31+tuft)>=tuning.grassCoverage(px,py,unit,squash))continue;
   out.push({x:px,y:py,unit,squash,groundElevation:tuning.groundElevation?.(px,py,unit,squash)||0,seed:coverHash(gx,gy,7+tuft),type,field,key:gx+','+gy+':'+tuft});
  }
 }
 return out.concat(canopyPlacements(face,tuning,coverHash,coverContains));
}
const elevationScale=SCENE_STYLE.tacticalWallPixels/SCENE_STYLE.wallMetres;
function templates(type,low=false,tuning={}){
 const pos=[],normal=[],uv=[],part=[],bladeAcross=[],bladeTangent=[];let bladeFrame=null;
 function tri(a,b,c,coords,kind=type){const n=new THREE.Vector3().subVectors(new THREE.Vector3(...b),new THREE.Vector3(...a)).cross(new THREE.Vector3().subVectors(new THREE.Vector3(...c),new THREE.Vector3(...a))).normalize();for(let i=0;i<3;i++){pos.push(...[a,b,c][i]);normal.push(n.x,n.y,n.z);uv.push(...coords[i]);part.push(kind);const frame=bladeFrame?.(coords[i][1]);bladeAcross.push(...(frame?.across??[0,0]));bladeTangent.push(...(frame?.tangent??[0,0,0]));}}
 if(type>=4){const positions=type===7?BIRCH_LEAF_POSITIONS:type===6?BEECH_LEAF_POSITIONS:type===5?MAPLE_LEAF_POSITIONS:LEAF_POSITIONS,uvs=type>=5?MAPLE_LEAF_UVS:LEAF_UVS;for(let i=0;i<positions.length;i+=3)tri(...positions.slice(i,i+3),uvs.slice(i,i+3),type);
 }else if(type===3){
  // Four independent, three-segment ribbons per canopy cell (20 triangles).
  // Keep full geometry at every zoom for this appearance experiment.
  for(let blade=0;blade<4;blade++){
   const r=n=>coverHash(blade,n,91),a=r(0)*Math.PI*2,ox=(r(1)-.5)*.32,oz=(r(2)-.5)*.32;
   const h=(.65+r(3)*.5)*(tuning.height??.4)/.4,w=(.014+r(4)*.012)*(tuning.width??2.3)/2.3,bend=(.13+r(5)*.2)*(tuning.bend??.9)/.9;
   bladeFrame=t=>({across:[-Math.sin(a)*w*(1-t),Math.cos(a)*w*(1-t)],tangent:[Math.cos(a)*2*bend*t,h,Math.sin(a)*2*bend*t]});
   const point=(t,side)=>[ox+Math.cos(a)*bend*t*t-Math.sin(a)*w*(1-t)*side,h*t,oz+Math.sin(a)*bend*t*t+Math.cos(a)*w*(1-t)*side];
   for(let s=0;s<3;s++){const a=s/3,b=(s+1)/3;tri(point(a,-1),point(a,1),point(b,1),[[0,a],[1,a],[1,b]],0);if(s<2)tri(point(a,-1),point(b,1),point(b,-1),[[0,a],[1,b],[0,b]],0);}
  }
 }else if(type===0){
  // Tapered, twisting blades: compact roots, varied arches and a curled tip.
  // Preserve blade count and segment budget; the material supplies the central ridge.
  for(let blade=0;blade<(low?32:56);blade++){
   const r=n=>coverHash(blade,n,12),a=r(0)*Math.PI*2,root=Math.sqrt(r(1))*.16,h=.24+r(2)*.48,w=(.009+r(3)*.014)*(low?1.45:1.)*(tuning.width??1),bend=(.10+r(4)*.24)*(tuning.bend??1);
   const twist=(r(5)-.5)*1.3,curl=.08+r(6)*.20;
   // Static ribbon frame. Project its true width before adding pixel coverage;
   // density, silhouette dimensions and high/low triangle budgets stay authored.
   bladeFrame=t=>{const angle=a+twist*t,width=w*Math.pow(1-t,.8)*(.65+1.1*t)*(tuning.spread??1);
    return {across:[-Math.sin(angle)*width,Math.cos(angle)*width],tangent:[Math.cos(a)*2*bend*t*(tuning.spread??1),h*(1-3*curl*t*t)*(tuning.height??1),Math.sin(a)*2*bend*t*(tuning.spread??1)]};};
   const point=(t,side)=>{const width=w*Math.pow(1-t,.8)*(.65+1.1*t),lean=bend*t*t,angle=a+twist*t;
    return [Math.cos(a)*(root+lean)-Math.sin(angle)*width*side,h*(t-curl*t*t*t),Math.sin(a)*(root+lean)+Math.cos(angle)*width*side];};
   for(let segment=0;segment<(low?2:4);segment++){const t=segment/(low?2:4),v=(segment+1)/(low?2:4);tri(point(t,-1),point(t,1),point(v,1),[[0,t],[1,t],[1,v]]);if(v<1)tri(point(t,-1),point(v,1),point(v,-1),[[0,t],[1,v],[0,v]]);}
  }
 }else if(type===1){
  // Three embedded stones with different irregular profiles; smooth bevel normals.
  for(let stone=0;stone<3;stone++){
   const size=[.16,.075,.045][stone],ox=[0,.19,-.14][stone],oz=[0,.09,.12][stone],g=new THREE.IcosahedronGeometry(1,1),p=g.attributes.position;
   for(let i=0;i<p.count;i+=3){const q=[];for(let j=0;j<3;j++){const v=new THREE.Vector3().fromBufferAttribute(p,i+j),rough=1+.10*Math.sin(v.x*9+v.z*7);q.push([ox+v.x*size*rough,Math.max(-.025,(v.y*.58+.34)*size),oz+v.z*size*.8]);}tri(...q,[[0,0],[1,0],[.5,1]]);}g.dispose();
  }
 }else{
  // Tapered crooked branch, with two forks and exposed ends.
  const tube=(a,b,ra,rb)=>{const direction=new THREE.Vector3(...b).sub(new THREE.Vector3(...a)).normalize(),side=new THREE.Vector3(0,1,0).cross(direction).normalize(),up=direction.clone().cross(side);const point=(p,r,k)=>new THREE.Vector3(...p).addScaledVector(side,Math.cos(k*Math.PI/3)*r).addScaledVector(up,Math.sin(k*Math.PI/3)*r).toArray();for(let k=0;k<6;k++){tri(point(a,ra,k),point(a,ra,k+1),point(b,rb,k+1),[[k/6,0],[(k+1)/6,0],[(k+1)/6,1]]);tri(point(a,ra,k),point(b,rb,k+1),point(b,rb,k),[[k/6,0],[(k+1)/6,1],[k/6,1]]);}for(let k=0;k<6;k++)tri(b,point(b,rb,k),point(b,rb,k+1),[[.5,.5],[0,0],[1,0]],4);};
  tube([-.35,.03,-.04],[-.04,.055,.01],.025,.020);tube([-.04,.055,.01],[.35,.035,.09],.020,.009);tube([-.08,.05,0],[.07,.04,-.19],.014,.004);tube([.16,.04,.05],[.30,.025,.21],.010,.003);
 }
 if(type===0){for(let i=0;i<pos.length;i+=3){pos[i]*=tuning.spread??1;pos[i+1]*=tuning.height??1;pos[i+2]*=tuning.spread??1;}}
 const g=new THREE.InstancedBufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normal,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('part',new THREE.Float32BufferAttribute(part,1));g.setAttribute('bladeAcross',new THREE.Float32BufferAttribute(bladeAcross,2));g.setAttribute('bladeTangent',new THREE.Float32BufferAttribute(bladeTangent,3));return indexCoverGeometry(g,THREE);
}
const shaderNoise=`float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}`;
const vertex=`
 uniform sampler2D instances,snowAccumulation,snowFootprints;uniform vec4 snowBounds;
 uniform mat3 combatView;uniform vec2 anchor,viewSize;uniform float zoom,time,instanceStart,kind;
 uniform sampler2D leafLandingSnow;varying float vLeafReady;
 ${LEAF_SNOW_DECODE}
 uniform bool canopyBlade,snowPress;
 uniform sampler2D debrisPressure;uniform vec4 debrisBounds;uniform float debrisStrength;
 uniform float windStrength;uniform vec2 coverViewport;uniform bool edgeAntialiasing;uniform int moverCount;uniform vec4 movers[32];
 attribute float part;attribute vec2 bladeAcross;attribute vec3 bladeTangent;varying vec2 vBladeEdge;varying vec2 vWorld,vUv;varying vec3 vNormal,vLocal;varying float vHeight,vSeed,vField,vPart,vVisibility,vBurial;
 ${SNOW_DEPTH_GLSL}${SNOW_SHELTER_GLSL}
 void main(){
 int id=gl_InstanceID+int(instanceStart);ivec2 slot=ivec2((id%128)*2,id/128);vec4 root=texelFetch(instances,slot,0),style=texelFetch(instances,slot+ivec2(1,0),0);
 // Keep root records resident while panning. Reject offscreen roots before snow/wind work.
 vec2 rootScreen=(combatView*vec3(root.xy,1.)).xy;rootScreen=anchor+(rootScreen-anchor)*zoom;
 if(rootScreen.x< -35.||rootScreen.x>viewSize.x+35.||rootScreen.y< -15.||rootScreen.y>viewSize.y+40.){gl_Position=vec4(2.,2.,2.,1.);return;}
 float angle=style.x*6.283185,cs=cos(angle),sn=sin(angle),size=.70+style.x*.65;
 // Accumulation loads the root; footprints only affect the burial surface below.
 float press=0.,woodPress=0.;vec2 rootUv=(root.xy-snowBounds.xy)/snowBounds.zw;
 if(canopyBlade&&snowPress&&all(greaterThanEqual(rootUv,vec2(0.)))&&all(lessThanEqual(rootUv,vec2(1.)))){
  float load=snowSampleDepth(snowAccumulation,rootUv);
  press=smoothstep(.008,.16,load);
 }
 if(kind<.5&&debrisStrength>0.){vec2 debrisUv=(vec2(root.x,root.y/.568329)-debrisBounds.xy)/debrisBounds.zw;if(all(greaterThanEqual(debrisUv,vec2(0.)))&&all(lessThanEqual(debrisUv,vec2(1.)))){woodPress=texture2D(debrisPressure,debrisUv).r*debrisStrength;press=max(press,woodPress);}}
 vec3 leafNormal=vec3(mat2(cs,-sn,sn,cs)*normal.xz,normal.y).xzy;
 vec3 local=position,tangent=bladeTangent;local.xz=mat2(cs,-sn,sn,cs)*local.xz*size;tangent.xz=mat2(cs,-sn,sn,cs)*tangent.xz*size;
 local.y*=kind<.5?mix(.55,1.25,style.y):size;tangent.y*=mix(.55,1.25,style.y);
 float fullHeight=max(.02,tangent.y*.5);
 if(kind<.5){float t=position.y/.72;
 float gust=sin(time*.8+root.x*.009+root.y*.007)*.6+sin(time*1.7+root.x*.031-root.y*.012)*.25;
 local.xz+=vec2(.075,.035)*gust*t*t*windStrength*(1.-press);tangent.xz+=vec2(.075,.035)*gust*2.*t*(bladeTangent.y/.72)*windStrength*(1.-press);
 for(int i=0;i<32;i++){if(i>=moverCount)break;vec2 d=(root.xy-movers[i].xy)/vec2(root.z,root.z*root.w);float distance=length(d),push=1.-smoothstep(.08,movers[i].z,distance);local.xz+=d/max(.05,distance)*push*.24*t;local.y*=1.-push*movers[i].w;tangent.xz+=d/max(.05,distance)*push*.24*(bladeTangent.y/.72);tangent.y*=1.-push*movers[i].w;}}
 if(press>0.){
  // A continuous shear and compression keeps roots fixed and lays tips sideways.
  // At full load even the tallest authored blades fit beneath a thin snow layer.
  vec2 lay=vec2(cos(angle+1.7),sin(angle+1.7));float scaleY=mix(1.,min(1.,.006/fullHeight),press)*(1.-woodPress);
  float tip=clamp(uv.y,0.,1.),slope=press*(.35+.50*tip),lift=local.y;
  local.xz+=lay*lift*press*(.35+.25*tip);local.y*=scaleY;
  tangent.xz+=lay*tangent.y*slope;tangent.y*=scaleY;
  leafNormal=normalize(vec3(leafNormal.x,(leafNormal.y-dot(lay*slope,leafNormal.xz))/max(.001,scaleY),leafNormal.z));
 }
 // Authored presentation scale: grass and stone groups use half their original size; sticks retain their size.
 local*=kind<.5?.5:(kind<1.5?.5:1.);
 vec2 world=root.xy+local.xz*vec2(root.z,root.z*root.w);float height=max(0.,local.y);
 vec2 suv=(world-snowBounds.xy)/snowBounds.zw;float burial=0.;
 if(all(greaterThanEqual(suv,vec2(0.)))&&all(lessThanEqual(suv,vec2(1.))))burial=snowDeformedHeight(snowSampleDepth(snowAccumulation,suv),texture2D(snowFootprints,suv).rg);
 vLeafReady=1.;if(kind>3.5&&style.y>0.){int leafId=int(style.y)-1;vec4 saved=texelFetch(leafLandingSnow,ivec2(leafId%256,leafId/256),0);vLeafReady=saved.b;height+=min(leafSnowHeight(saved),burial);}
 vec2 screen=(combatView*vec3(world,1.)).xy-vec2(0.,(height+style.w)*${elevationScale.toFixed(6)});screen=anchor+(screen-anchor)*zoom;
 gl_Position=projectionMatrix*vec4(screen,0.,1.);vWorld=world;vHeight=height;vBurial=burial;vSeed=style.x;vField=style.y;vVisibility=style.z;vUv=uv;vLocal=local;vPart=part;
 vNormal=leafNormal;
 vBladeEdge=vec2(0.);
 if(kind<.5&&edgeAntialiasing){
  vec2 across=mat2(cs,-sn,sn,cs)*bladeAcross*size*.5*vec2(root.z,root.z*root.w);
  vec2 along=(combatView*vec3(tangent.xz*.5*vec2(root.z,root.z*root.w),0.)).xy-vec2(0.,tangent.y*.5*${elevationScale.toFixed(6)});
  vec2 acrossPixels=(projectionMatrix*vec4((combatView*vec3(across,0.)).xy*zoom,0.,0.)).xy*coverViewport*.5;
  vec2 alongPixels=(projectionMatrix*vec4(along*zoom,0.,0.)).xy*coverViewport*.5;
  vec2 edgeNormal=vec2(-alongPixels.y,alongPixels.x)/max(.00001,length(alongPixels));
  float halfWidth=dot(acrossPixels,edgeNormal);edgeNormal*=halfWidth<0.?-1.:1.;halfWidth=abs(halfWidth);
  // A half physical pixel outside each edge lets subpixel blades reach the
  // fragment shader. Their alpha is actual coverage, not a minimum opaque width.
  float side=length(bladeAcross)<.000001?0.:uv.x*2.-1.;
  gl_Position.xy+=edgeNormal*side/coverViewport*gl_Position.w;
  vBladeEdge=vec2(side*(halfWidth+.5),halfWidth);
 }
 }`;
const fragment=`
 uniform bool canopyBlade;uniform bool edgeAntialiasing;varying vec2 vBladeEdge;
 varying float vLeafReady;
 uniform float landingTime,leafAutumn;uniform sampler2D leafArtwork;uniform vec3 grassTint;uniform float grassBrightness,dryAmount;uniform sampler2D lightMultiply,lightBoost,groundScorch;uniform vec4 lightBounds,scorchBounds;uniform bool useLightMap,useScorch;uniform vec3 sunDirection;uniform float daylight,kind;
 varying vec2 vWorld,vUv;varying vec3 vNormal,vLocal;varying float vHeight,vSeed,vField,vPart,vVisibility,vBurial;
 ${shaderNoise}
 void main(){
 float snowEdge=max(.002,fwidth(vHeight-vBurial));float alpha=smoothstep(-snowEdge,snowEdge,vHeight-vBurial-.002);if(alpha<.01)discard;
 vec3 color;float shade=1.;
 if(kind>3.5){vec4 leaf=texture2D(leafArtwork,vUv);alpha*=smoothstep(.20,.65,leaf.a);if(alpha<.01)discard;if(vLeafReady<.5)discard;color=leaf.rgb*mix(vec3(.62,.70,.48),vec3(.62,.48,.36),leafAutumn)*mix(.78,1.0,vSeed);shade=.78+daylight*.22;
 }else if(kind<.5){
 if(edgeAntialiasing)alpha*=clamp(vBladeEdge.y+.5-abs(vBladeEdge.x),0.,min(1.,2.*vBladeEdge.y));
 else{float edge=min(vUv.x,1.-vUv.x),aa=max(.025,fwidth(vUv.x)*.72);alpha*=smoothstep(0.,aa,edge);}
 vec3 green=mix(vec3(.20,.28,.085),vec3(.36,.43,.14),vSeed);vec3 dry=vec3(.49,.43,.24);color=mix(green,dry,smoothstep(.48,.76,vSeed)*(1.-vField)*dryAmount);
 if(canopyBlade){green=mix(vec3(.27,.36,.10),vec3(.40,.50,.16),clamp(vField,0.,1.));color=mix(green,vec3(.48,.42,.21),smoothstep(.60,.90,vSeed)*dryAmount*.4);color*=mix(.58,1.06,smoothstep(0.,.9,vUv.y));}
 // Gentle root occlusion and a central fold; no black texture background.
 color*=grassTint;
 color*=mix(.78,1.12,smoothstep(0.,.85,vUv.y));
 float ridge=1.-smoothstep(.025,.23,abs(vUv.x-.5));
 color*=.96+.08*ridge;
 color+=vec3(.018,.020,.006)*smoothstep(.72,1.,vUv.y);
 // Thin leaves receive diffuse light on both faces and transmit backlight.
 vec3 leafNormal=normalize(vNormal);float facing=dot(leafNormal,normalize(sunDirection));
 float diffuse=abs(facing),transmission=pow(max(0.,-facing),2.);
 shade=(.88+daylight*(.10+.16*diffuse+.14*transmission))*grassBrightness*(1.-.10*clamp(daylight,0.,1.));
 }else if(kind<1.5){float grain=noise(vLocal.xz*90.),mottle=noise(vLocal.xz*23.+vSeed*9.);color=mix(vec3(.26,.255,.22),vec3(.48,.465,.40),mottle)*(.9+.2*grain);float moss=smoothstep(.56,.76,noise(vLocal.xz*15.+vSeed*17.))*smoothstep(.02,.10,vHeight);color=mix(color,vec3(.23,.28,.12),moss*.65);shade=.65+daylight*.45*max(0.,dot(normalize(vNormal),sunDirection));
 }else{float grain=noise(vec2(vUv.x*45.,vUv.y*7.)+vSeed*8.);color=mix(vec3(.16,.115,.065),vec3(.38,.29,.16),grain);if(vPart>3.5)color=vec3(.47,.36,.21);shade=.7+daylight*.35*max(0.,dot(normalize(vNormal),sunDirection));}
 vec3 light=vec3(1.);if(useLightMap){vec2 uv=(vWorld-lightBounds.xy)/lightBounds.zw;uv.y=1.-uv.y;light=texture2D(lightMultiply,uv).rgb/max(vec3(.001),vec3(1.)-texture2D(lightBoost,uv).rgb);}
 if(useScorch){vec2 uv=(vWorld-scorchBounds.xy)/scorchBounds.zw;uv.y=1.-uv.y;float burn=texture2D(groundScorch,clamp(uv,0.,1.)).a; color=mix(color,vec3(.065,.055,.035),burn*.9);}
 gl_FragColor=vec4(clamp(color*shade*light*vVisibility,0.,1.),alpha);
 }`;
export function createGroundCover({renderer,snow,texture,paint,flush,markBackdrop,tuning={}}){
 tuning={...GROUND_COVER_DEFAULTS,...tuning};
 const leafMaps=['white-oak','sugar-maple','american-beech','sweet-birch'].map(id=>BROADLEAF_FAMILIES[id]).map(family=>Object.fromEntries(['greenLeaf','fallLeaf'].map(key=>{const map=new THREE.TextureLoader().load(broadleafAsset(family[key],family),()=>globalThis.draw?.());map.wrapS=map.wrapT=THREE.RepeatWrapping;return [key,map];})));
 const leafArtwork=leafMaps[0].fallLeaf;
 const debris=createDebrisGrassPressure(),leafSnows=leafMaps.map(()=>createLeafSnowLanding(renderer,snow));let leafSources=leafMaps.map(()=>null),leafInput=null;
 const speculative=new Map();let speculativeInstances=0,preparationRevision=0;
 const cache=new Map(),batches=[0,1,2,3,4,5,6,7].map(kind=>{
  const data=new Float32Array(2*8192*4),map=new THREE.DataTexture(data,256,64,THREE.RGBAFormat,THREE.FloatType);map.needsUpdate=true;
  const viewport=new THREE.Vector4();
  const uniforms={leafLandingSnow:leafSnows[Math.max(0,kind-4)].uniform,...debris.uniforms,landingTime:{value:0},leafAutumn:{value:1},leafArtwork:{value:leafArtwork},viewSize:{value:new THREE.Vector2()},snowPress:{value:kind===3&&tuning.snowPress!==false},canopyBlade:{value:kind===3},grassTint:{value:new THREE.Vector3(...tuning.tint)},coverViewport:{value:new THREE.Vector2(1,1)},edgeAntialiasing:{value:tuning.edgeAntialiasing!==false},windStrength:{value:tuning.wind??1},grassBrightness:{value:tuning.brightness??1},dryAmount:{value:tuning.dry??.65},...snowShelterUniforms,instances:{value:map},snowAccumulation:{value:snow.texture},snowFootprints:{value:snow.footprintTexture},snowBounds:{value:snow.bounds},combatView:{value:new THREE.Matrix3()},anchor:{value:new THREE.Vector2()},zoom:{value:1},time:{value:0},instanceStart:{value:0},kind:{value:kind===3?0:kind},moverCount:{value:0},movers:{value:new Float32Array(128)},lightMultiply:{value:null},lightBoost:{value:null},lightBounds:{value:new THREE.Vector4()},useLightMap:{value:false},useScorch:{value:false},groundScorch:{value:null},scorchBounds:{value:new THREE.Vector4()},sunDirection:{value:new THREE.Vector3(.4,.8,.3)},daylight:{value:1}};
  const mesh=new THREE.Mesh(templates(kind,false,tuning),new THREE.ShaderMaterial({uniforms,vertexShader:vertex,fragmentShader:fragment,side:THREE.DoubleSide,transparent:true,depthTest:false,depthWrite:false,toneMapped:false}));mesh.frustumCulled=false;
  // getCurrentViewport includes DPR and active render-target sizing. Reuse the
  // vectors across ordered draws; this adds no target, pass or animation loop.
  mesh.onBeforeRender=renderer=>{renderer.getCurrentViewport(viewport);uniforms.coverViewport.value.set(Math.max(1,viewport.z),Math.max(1,viewport.w));};
  return {kind,mesh,high:mesh.geometry,low:kind===0?templates(0,true,tuning):mesh.geometry,data,map,items:[],sort:createCoverDepthSorter(),cursor:0,key:''};
 });
 let faceMapSnapshot=[],faceMapVisibility=[],retainedFaceMap=null;
 let residentFaces=new Map(),depositSource=null,depositBuckets=new Map();
 let layoutSnapshot=[],layoutValid=false,corpseVersion=-1,corpseIndex=createCorpseCoverIndex([]);
 let faces=[],view,sceneId,settings=null,stats={instances:0,draws:0,triangles:0,cacheEntries:0},enabled=true;
 function begin(v){view=v;faces=[];settings=null;enabled=globalThis.adventurePartyGroundCover!==false;stats={instances:0,draws:0,triangles:0,cacheEntries:cache.size};for(const b of batches)b.cursor=0;}
 function collect(group,options){if(!enabled)return;for(const f of group)if(f.grass&&f.snowEligible>0){faces.push(f);settings=options;}}
 function prepare(movers=[],corpses=[],spreadingCrowns=[],treeExclusions=[],fallenLeaves=null,woodFootprints=null,woodPressure=0){
  debris.update(woodFootprints,woodPressure);
  if(!enabled||!settings)return;const [a,b,c,d,tx,ty]=view.matrix,seen=new Set(),shelterRevision=snowShelterRevision(),frameTime=matchMedia('(prefers-reduced-motion: reduce)').matches?0:performance.now()/1000;
  // Numeric snapshots detect in-place edits without allocating a frame-size key.
  const nextCorpseVersion=corpseGroundFootprintRevision();
  if(nextCorpseVersion!==corpseVersion){corpseVersion=nextCorpseVersion;corpseIndex=createCorpseCoverIndex(corpseGroundFootprints());}
  const corpseOrder=new Map(corpses.map(c=>[c.entity,c.sortY-ty]));
  // Camera subtraction can differ by ~1e-13 for an unchanged world point.
  // Tolerate only that projected-coordinate noise; geometry/visibility stay exact.
  const crowns=spreadingCrowns.map(t=>({...t,x:t.x-tx,y:t.y-ty,sortY:t.sortY-ty}));
  let cursor=0,rebuild=!layoutValid;const check=(value,projected=false)=>{const previous=layoutSnapshot[cursor];const sameProjection=projected&&Number.isFinite(previous)&&Math.abs(previous-value)<=1e-8;if(previous!==value&&!sameProjection){rebuild=true;layoutSnapshot[cursor]=value;}cursor++;};
  if(leafInput!==fallenLeaves){leafInput=fallenLeaves;for(let i=0;i<leafSnows.length;i++){const next=(fallenLeaves||[]).filter(p=>p.type===i+4),prior=leafSources[i];if(!prior||next.length!==prior.length||next.some((p,j)=>p!==prior[j]))leafSources[i]=next;}}for(let i=0;i<leafSnows.length;i++)leafSnows[i].update(leafSources[i]);
  const season=getSeason();check(season);check(fallenLeaves);check(treeExclusions.length);for(const t of treeExclusions)for(const key of ['x','y','width','row','radius','feather','species'])check(t[key]);
  check(crowns.length);for(const t of crowns){check(t.x,true);check(t.y,true);check(t.sortY,true);check(t.rx);check(t.ry);}
  for(const value of view.matrix.slice(0,4))check(value);check(shelterRevision);check(corpseVersion);check(corpses.length);for(const corpse of corpses){check(corpse.entity);check(corpse.sortY-ty,true);}
  // The collected floor has a guard band. Retain its root buffers until a new
  // face actually reaches the root clip rectangle; GPU clipping handles the pan.
  const faceKey=f=>f._groundKey??(f.grassUnit+':'+f.grassSquash+':'+f.points.map(p=>p.x+','+p.y).join(';'));
  const sameFaces=retainedFaceMap&&faces.length===faceMapSnapshot.length&&faces.every((f,i)=>f._groundKey!==undefined&&f===faceMapSnapshot[i]&&(f.visibility??1)===faceMapVisibility[i]);
  const currentFaces=sameFaces?retainedFaceMap:new Map(faces.map(f=>[faceKey(f),f]));
  if(!sameFaces){faceMapSnapshot=faces.slice();faceMapVisibility=faces.map(f=>f.visibility??1);retainedFaceMap=currentFaces;}stats.faceMapReused=!!sameFaces;
  const reachesView=f=>{let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;for(const p of f.points){const x=view.anchor.x+(a*p.x+c*p.y+tx-view.anchor.x)*view.zoom,y=view.anchor.y+(b*p.x+d*p.y+ty-view.anchor.y)*view.zoom;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}return right>=-35&&left<=view.width+35&&bottom>=-15&&top<=view.height+40;};
  for(const [key,f] of currentFaces){const old=residentFaces.get(key);if(old?(old.visibility??1)!==(f.visibility??1):reachesView(f))rebuild=true;}
  for(const [key,f] of residentFaces)if(!currentFaces.has(key)&&reachesView(f))rebuild=true;
  if(layoutSnapshot.length!==cursor)rebuild=true;layoutSnapshot.length=cursor;layoutValid=true;stats.layoutReused=!rebuild;
  if(fallenLeaves!==depositSource){depositSource=fallenLeaves;depositBuckets=new Map();for(const p of fallenLeaves||[]){const k=Math.floor(p.x/64)+','+Math.floor(p.y/64);if(!depositBuckets.has(k))depositBuckets.set(k,[]);depositBuckets.get(k).push(p);}}
  if(rebuild){residentFaces=new Map([...currentFaces].map(([key,f])=>[key,{...f,points:f.points.map(p=>({...p}))}]));for(const b of batches)b.items.length=0;
  for(const f of faces){const key=faceKey(f);let items=cache.get(key);if(speculative.has(key)){speculativeInstances-=speculative.get(key);speculative.delete(key);stats.preparedHits=(stats.preparedHits||0)+1;}if(!items){items=coverPlacements(f,tuning);if(cache.size>=16000)cache.delete(cache.keys().next().value);cache.set(key,items);}
   const placements=season==='fall'?items.concat(leafScatter(f,treeExclusions,tuning,coverHash,coverContains)):items.slice();
   if(fallenLeaves?.length){const xs=f.points.map(p=>p.x),ys=f.points.map(p=>p.y);for(let bx=Math.floor(Math.min(...xs)/64);bx<=Math.floor(Math.max(...xs)/64);bx++)for(let by=Math.floor(Math.min(...ys)/64);by<=Math.floor(Math.max(...ys)/64);by++)for(const p of depositBuckets.get(bx+','+by)||[]){if(coverContains(f.points,p.x,p.y)&&!(tuning.groundWater?.(p.x,p.y,f.grassUnit,f.grassSquash)>.02))placements.push({...p,unit:f.grassUnit||128/3,squash:f.grassSquash||.568329,groundElevation:tuning.groundElevation?.(p.x,p.y,f.grassUnit,f.grassSquash)||0});}}
   for(const p of placements){if(((p.type===0||p.type===3)&&tuning.grass===false)||(p.type===1&&tuning.rocks===false)||(p.type===2&&tuning.sticks===false))continue;if((p.type===0||p.type===3)&&p.seed>=grassRetention(p.x,p.y,treeExclusions))continue;if(seen.has(p.key))continue;seen.add(p.key);if(p.shelterRevision!==shelterRevision){p.exposure=snowExposureAt(p.x,p.y);p.shelterRevision=shelterRevision;}const exposure=p.exposure;if((p.type===0||p.type===3)&&exposure<.40&&p.seed>exposure)continue;if(p.type===2&&exposure>.9&&p.seed>.3)continue;const y=b*p.x+d*p.y;p.sortY=corpseOrder.size&&(p.type===0||p.type===3)?corpseIndex.sortY(p.x,p.y,y,corpseOrder):y;// Low spreading branches must composite over ground cover beneath their crown.
   // Only adjust cached painter order; root elevation and GPU wind stay unchanged.
   if(p.type===0||p.type===3){const x=a*p.x+c*p.y;for(const t of crowns)if(((x-t.x)/t.rx)**2+((y-t.y)/t.ry)**2<=1)p.sortY=Math.min(p.sortY,t.sortY-.01);}
   p.visibility=f.visibility??1;batches[p.type].items.push(p);}}
  }
  for(const batch of batches){if(rebuild)batch.sort(batch.items);const items=batch.items;
   // Pack 128 instances per texture row and grow capacity without dropping sorted rows.
   if(items.length*8>batch.data.length){const rows=2**Math.ceil(Math.log2(Math.ceil(items.length/128)));batch.data=new Float32Array(256*rows*4);batch.map.dispose();batch.map.image={data:batch.data,width:256,height:rows};batch.key='';batch.map.needsUpdate=true;}
   batch.mesh.geometry=view.zoom<.85?batch.low:batch.high;
   // Compare packed numeric records, avoiding a long joined string and temporary arrays.
   if(rebuild){let changed=false;const data=batch.data;
   let offset=0;const write=(slot,value)=>{const v=Math.fround(value);if(data[offset+slot]!==v){data[offset+slot]=v;changed=true;}};
   for(let i=0;i<items.length;i++){const p=items[i];offset=i*8;
    write(0,p.x);write(1,p.y);write(2,p.unit);write(3,p.squash);write(4,p.seed);write(5,p.type>=4&&p.field>0?leafSnows[p.type-4].index(p.key):p.field);write(6,p.visibility);write(7,p.groundElevation||0);
   }
   if(changed)batch.map.needsUpdate=true;}
   stats.instances+=items.length;const u=batch.mesh.material.uniforms;u.viewSize.value.set(view.width,view.height);u.combatView.value.set(a,c,tx,b,d,ty,0,0,1);u.anchor.value.set(view.anchor.x,view.anchor.y);u.zoom.value=view.zoom;u.time.value=frameTime;u.landingTime.value=performance.now()/1000;const weather=globalThis.getWeatherSnapshot?.();u.windStrength.value=(tuning.wind??1)*(weather?.amounts?weather.amounts.wind:1);
   u.movers.value.fill(0);u.moverCount.value=Math.min(32,movers.length);for(let i=0;i<u.moverCount.value;i++)u.movers.value.set(movers[i],i*4);
   u.leafArtwork.value=leafMaps[Math.max(0,batch.kind-4)][season==='fall'?'fallLeaf':'greenLeaf'];u.leafAutumn.value=season==='fall'?1:0;
   const light=settings.lightMap;u.useLightMap.value=!!light;if(light){u.lightMultiply.value=texture(light.layers[0]);u.lightBoost.value=texture(light.layers[1]);u.lightBounds.value.set(light.left,light.top,light.spanWidth,light.spanHeight);}
   const scorch=settings.groundScorch;u.useScorch.value=!!scorch;if(scorch){u.groundScorch.value=texture(scorch.image);u.scorchBounds.value.set(scorch.left,scorch.top,scorch.spanX,scorch.spanY);}
   const solar=globalThis.adventurePartySolar?.state?.();if(solar){u.sunDirection.value.set(solar.direction.x,solar.direction.y,solar.direction.z).normalize();u.daylight.value=solar.daylight;}
  }stats.cacheEntries=cache.size;
 }
 function drawUntil(y=Infinity){if(!enabled)return;const limit=y-view.matrix[5];for(const b of [...batches.slice(4),...batches.slice(0,4)]){const start=b.cursor;let lo=start,hi=b.items.length;while(lo<hi){const mid=(lo+hi)>>>1;if(b.mesh.material.uniforms.kind.value>3.5||b.items[mid].sortY<=limit)lo=mid+1;else hi=mid;}b.cursor=lo;const count=b.cursor-start;if(!count)continue;flush();b.mesh.geometry.instanceCount=count;b.mesh.material.uniforms.instanceStart.value=start;paint(b.mesh,'Ground cover');markBackdrop();stats.draws++;stats.triangles+=(b.mesh.geometry.index?.count??b.mesh.geometry.attributes.position.count)/3*count;}}
 function setTuning(next){
 const geometryKeys=['height','width','bend','spread'];
 const geometryChanged=geometryKeys.some(k=>next[k]!==undefined&&next[k]!==tuning[k]);
 const layoutChanged=['tufts','spread','grass','rocks','sticks','canopyEnabled'].some(k=>next[k]!==undefined&&next[k]!==tuning[k]);
 Object.assign(tuning,next);
 for(let kind=0;kind<batches.length;kind++){const b=batches[kind],u=b.mesh.material.uniforms;
 u.snowPress.value=kind===3&&tuning.snowPress!==false;u.grassBrightness.value=tuning.brightness;u.dryAmount.value=tuning.dry;
 if(next.tint)u.grassTint.value.fromArray(next.tint);
 if(geometryChanged){b.high.dispose();if(b.low!==b.high)b.low.dispose();b.high=templates(kind,false,tuning);b.low=kind===0?templates(0,true,tuning):b.high;b.mesh.geometry=b.high;}
 }
 if(layoutChanged){preparationRevision++;speculative.clear();speculativeInstances=0;cache.clear();layoutValid=false;}
 }
 function prepareAhead(face){
  if(!enabled||!face.grass||face.snowEligible<=0)return;
  const key=face._groundKey;if(!key||cache.has(key))return;
  if(speculative.size>=256||speculativeInstances>=32768)return;
  const items=coverPlacements(face,tuning);if(speculativeInstances+items.length>32768)return;
  if(cache.size>=16000)cache.delete(cache.keys().next().value);cache.set(key,items);speculative.set(key,items.length);speculativeInstances+=items.length;
 }
 return {prepareAhead,get preparationRevision(){return preparationRevision;},get preparationFull(){return speculative.size>=256||speculativeInstances>=32768;},invalidate(){preparationRevision++;speculative.clear();speculativeInstances=0;cache.clear();layoutValid=false;},setTuning,begin,collect,prepare,drawUntil,get active(){return enabled&&stats.instances>0;},diagnostics:()=>({...stats,preparedFaces:speculative.size,preparedInstances:speculativeInstances,debrisPressure:debris.diagnostics(),leafSnow:{leaves:leafSnows.reduce((n,s)=>n+s.diagnostics().leaves,0),passes:leafSnows.reduce((n,s)=>n+s.diagnostics().passes,0)},leafInstances:batches.slice(4).reduce((n,b)=>n+b.items.length,0),leafSpeciesCounts:batches.slice(4).map(b=>b.items.length),leafTriangles:(batches.slice(4).reduce((n,b)=>n+b.items.length,0))*2,canopyInstances:batches[3].items.length,canopyBlades:batches[3].items.length*4}),scene(id){if(id!==sceneId){preparationRevision++;speculative.clear();speculativeInstances=0;layoutValid=false;cache.clear();for(const b of batches)b.key='';sceneId=id;}},dispose(){for(const s of leafSnows)s.dispose();debris.dispose();for(const maps of leafMaps)for(const map of Object.values(maps))map.dispose();for(const b of batches){b.map.dispose();b.high.dispose();if(b.low!==b.high)b.low.dispose();b.mesh.material.dispose();}cache.clear();}};
}


