import {gpuCasterVertex} from './combat-gpu-casters.mjs';
import {combatPerformance as perf} from './combat-performance.mjs';
import * as THREE from '../assets/vendor/three/three.module.min.js';

// Shared GPU planar shadows. Casters supply physical 3D points + alpha artwork;
// directional/point-light projection is performed only in the vertex shader.
export const projectedShadowVertex=`
attribute vec3 casterPoint; attribute float strength; attribute vec4 silhouetteAnchor;
uniform vec4 light; uniform vec4 receiverPlane; uniform vec3 worldScale;
uniform mat3 combatView; uniform vec2 anchor; uniform float zoom;
varying vec2 vUv; varying vec3 vGround; varying vec3 vCaster; varying float vStrength;
void main(){
 vec3 ray=light.w<.5?-light.xyz:casterPoint-light.xyz;
 float den=dot(receiverPlane.xyz,ray);
 float travel=-(dot(receiverPlane.xyz,casterPoint)+receiverPlane.w)/(abs(den)<.00001?.00001:den);
 vec3 p=casterPoint+ray*max(0.,travel);
 // A flat sprite is an impostor, not a volumetric body. Use one affine
 // projection per silhouette so a point source cannot fold its head/limbs.
 if(silhouetteAnchor.w>0.&&abs(receiverPlane.y)>.5){
  vec2 slope;
  if(light.w<.5)slope=-light.xz/max(.0001,light.y);
  else{float reference=min(silhouetteAnchor.w*.55,max(.02,light.y*.6));
   slope=(silhouetteAnchor.xz-light.xz)/max(.05,light.y-reference);}
  slope*=min(1.,6./max(.0001,length(slope)));
  p=vec3(casterPoint.x+casterPoint.y*slope.x,0.,casterPoint.z+casterPoint.y*slope.y);
  // A sprite has no volume. Level-foot attack poses can become exactly edge-on
  // to a side light. Supply a small body-depth proxy above the anchored feet.
  if(length(slope)>.0001){
   vec2 direction=normalize(slope);
   vec2 right=normalize(vec2(combatView[1][1]/worldScale.x,-combatView[0][1]/worldScale.z));
   float across=abs(right.x*direction.y-right.y*direction.x);
   vec2 depth=vec2(-direction.y,direction.x);
   if(dot(depth,right)<-.0001)depth=-depth;
   float body=smoothstep(0.,max(.01,silhouetteAnchor.w*.15),casterPoint.y);
   p.xz+=depth*dot(casterPoint.xz-silhouetteAnchor.xz,right)*max(0.,.3-across)*body;
  }
  den=1.;travel=1.;
 }
 vec2 delta=p.xz-casterPoint.xz;
 float limit=max(.3,casterPoint.y*6.);
 // A directional sun needs a horizon cap. Point rays must remain exact:
 // clamping them moves out-of-range shadows back inside the lamp's light.
 if(abs(receiverPlane.y)>.5&&light.w<.5)p.xz=casterPoint.xz+delta*min(1.,limit/max(.0001,length(delta)));
 vStrength=strength*step(.00001,abs(den))*step(0.,travel);
 if(abs(receiverPlane.y)<.5&&light.w<.5&&length(delta)>limit)vStrength=0.;
 vUv=uv;vGround=p;vCaster=casterPoint;
 vec3 screen=combatView*vec3(p.x*worldScale.x,p.z*worldScale.z,1.);
 screen.xy=anchor+(screen.xy-vec2(0.,p.y*worldScale.y)-anchor)*zoom;
 gl_Position=projectionMatrix*vec4(screen.xy,0.,1.);
}`;
export const projectedShadowFragment=`
uniform sampler2D artwork; uniform sampler2D receiverMask;
uniform vec4 light; uniform vec4 maskBounds; uniform vec2 texel; uniform float softness; uniform bool wallReceiver;
uniform vec4 wallSpan; uniform float wallHeight;
uniform float shadowPixelScale; uniform float lightPower,lightRange; uniform vec2 solarAmbient;
uniform int fillCount; uniform vec4 fillPosition[32]; uniform float fillRange[32];
float sourceAt(vec3 position,vec3 source,float range){return pow(max(0.,1.-length(position.xz-source.xz)/max(.01,range)),2.);}
varying vec2 vUv; varying vec3 vGround; varying vec3 vCaster; varying float vStrength;
void main(){
 if(vStrength<=0.)discard;
 vec4 mask=vec4(0.);
 if(wallReceiver){vec2 d=wallSpan.zw-wallSpan.xy;float t=dot(vGround.xz-wallSpan.xy,d)/max(.00001,dot(d,d));
  if(t<0.||t>1.||vGround.y<0.||vGround.y>wallHeight)discard;
 }else{vec2 m=(vGround.xz-maskBounds.xy)/maskBounds.zw;
  if(any(lessThan(m,vec2(0.)))||any(greaterThan(m,vec2(1.))))discard;
  mask=texture2D(receiverMask,vec2(m.x,1.-m.y));
  if(mask.a<.5||(light.w<.5&&mask.r<.5))discard;
 }
 if(any(lessThan(vUv,vec2(0.)))||any(greaterThan(vUv,vec2(1.))))discard;
 vec2 d=texel*softness;
 float a=texture2D(artwork,vUv).a*.4;
 a+=(texture2D(artwork,vUv+vec2(d.x,0.)).a+texture2D(artwork,vUv-vec2(d.x,0.)).a+
     texture2D(artwork,vUv+vec2(0.,d.y)).a+texture2D(artwork,vUv-vec2(0.,d.y)).a)*.15;
 // Normalize the removed light against ambient + every active source.
 // The per-source mask is unioned before composition, so overlapping casters
 // cannot repeatedly subtract the same source.
 float outdoor=step(.5,mask.r);
 float ambient=mask.g*10.*2.*mix(1.,solarAmbient.y,outdoor);
 float sun=12.*solarAmbient.x*outdoor,total=ambient+sun;
 for(int i=0;i<32;i++){if(i>=fillCount)break;total+=fillPosition[i].w*sourceAt(vGround,fillPosition[i].xyz,fillRange[i]);}
 float contribution=light.w<.5?sun:lightPower*sourceAt(vGround,light.xyz,lightRange);
 float share=min(1.,contribution/max(.0001,total));
 if(wallReceiver)share=light.w<.5?1.:sourceAt(vGround,light.xyz,lightRange)*.65;
 float coverage=a*vStrength*share;
 // Finite local emitter: the penumbra grows as receiver/caster separation grows.
 // Sun keeps its established mask and composite filter exactly as before.
 float spread=0.;
 if(light.w>.5){float metres=min(.6,.08*length(vGround-vCaster)/max(.12,length(light.xyz-vCaster)));
  spread=min(1.,metres*shadowPixelScale/24.)*step(.00001,coverage);}
 gl_FragColor=vec4(spread,0.,0.,coverage);
}`;

// Per-source union mask: R stores local penumbra radius, A stores shadow coverage.
export const projectedShadowComposite=`
uniform sampler2D snowMask;uniform vec4 snowBounds;uniform mat3 inverseView;uniform vec2 viewport,viewAnchor;uniform float viewZoom;uniform bool snowGround;
uniform sampler2D mask;uniform vec2 texel;uniform bool localShadow;varying vec2 vUv;
void main(){
 float a;
 if(!localShadow){
  // Preserve the sun's existing edge filter.
  a=texture2D(mask,vUv).a*.6;
  a+=(texture2D(mask,vUv+vec2(texel.x,0.)).a+texture2D(mask,vUv-vec2(texel.x,0.)).a+
      texture2D(mask,vUv+vec2(0.,texel.y)).a+texture2D(mask,vUv-vec2(0.,texel.y)).a)*.1;
 }else{
  vec4 center=texture2D(mask,vUv);float radius=center.r,nearby=center.a;
  // Extend the radius field outside the silhouette so softness expands its edge.
  for(int i=0;i<8;i++){
   float angle=float(i)*.78539816339;vec2 offset=vec2(cos(angle),sin(angle))*texel*18.;
   vec4 sampleValue=texture2D(mask,vUv+offset);radius=max(radius,sampleValue.r);nearby=max(nearby,sampleValue.a);
  }
  if(nearby<.00001)discard;
  vec2 spread=texel*(.35+24.*radius);
  a=center.a*.2;
  for(int i=0;i<4;i++){
   float angle=float(i)*1.57079632679;
   a+=texture2D(mask,vUv+vec2(cos(angle),sin(angle))*spread*.45).a*.1;
  }
  for(int i=0;i<8;i++){
   float angle=float(i)*.78539816339;
   a+=texture2D(mask,vUv+vec2(cos(angle),sin(angle))*spread).a*.05;
  }
 }
 vec2 screen=vec2(vUv.x,1.-vUv.y)*viewport;
 vec2 world=(inverseView*vec3(viewAnchor+(screen-viewAnchor)/viewZoom,1.)).xy;
 vec2 suv=(world-snowBounds.xy)/snowBounds.zw;
 float snow=0.;if(!localShadow&&snowGround&&all(greaterThanEqual(suv,vec2(0.)))&&all(lessThanEqual(suv,vec2(1.))))snow=texture2D(snowMask,suv).r;
 gl_FragColor=vec4(vec3(.16,.34,.60)*snow,a);
}`;

// A point above a lamp cannot cast onto the floor below it. Clip crossing
// triangles before projection rather than folding their invalid rays backward.
export function clipShadowTriangleAtLight(points,uv,lightHeight){
 const limit=lightHeight-.02,result=[];
 for(let i=0;i<3;i++){
  const a=points[i],b=points[(i+1)%3],ua=uv[i],ub=uv[(i+1)%3],insideA=a[1]<=limit,insideB=b[1]<=limit;
  if(insideA)result.push({point:a,uv:ua});
  if(insideA!==insideB){const t=(limit-a[1])/(b[1]-a[1]);result.push({point:a.map((v,j)=>v+(b[j]-v)*t),uv:ua.map((v,j)=>v+(ub[j]-v)*t)});}
 }
 return result;
}

export function createProjectedShadowPass({renderer,camera,texture,flush,getView,getSnow=()=>null,onPaint}){
 const solidMask=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1);solidMask.needsUpdate=true;
 const palettes=new Map(),identityBones=new Float32Array(new THREE.Matrix4().elements);let paletteFrame=0;
 const scene=new THREE.Scene(),records=[],batches=new Map(),ids=new WeakMap();let lighting={solar:null,sources:[]};let sequence=0,slot=0,receiver=null,stats={batches:0,triangles:0};
 const maskTarget=new THREE.WebGLRenderTarget(1,1,{depthBuffer:false,stencilBuffer:false});
 const maskQuad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({uniforms:{snowMask:{value:null},snowBounds:{value:new THREE.Vector4()},inverseView:{value:new THREE.Matrix3()},viewport:{value:new THREE.Vector2()},viewAnchor:{value:new THREE.Vector2()},viewZoom:{value:1},snowGround:{value:false},mask:{value:maskTarget.texture},texel:{value:new THREE.Vector2(1,1)},localShadow:{value:false}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader:projectedShadowComposite,transparent:true,depthTest:false,depthWrite:false}));
 maskQuad.frustumCulled=false;
 function id(image){if(!ids.has(image))ids.set(image,++sequence);return ids.get(image);}
 function release(record){record.geometry.dispose();record.material.dispose();}
 return {
  begin(){paletteFrame++;batches.clear();slot=0;stats={batches:0,triangles:0};},
  receiver(value){receiver=value;},
  lighting(value){lighting=value;},
  modelGeometry(geometry){return {...geometry,image:solidMask};},
  queueModel({capture,transform,light,scale,opacity}){
   if(!receiver)return;
   for(const part of capture.parts){const key='model:'+sequence++;
    batches.set(key,{gpu:true,part,capture,transform,image:solidMask,light,scale,plane:[0,1,0,0],wall:null,softness:0,opacity});
   }
  },
  queue({points,uv,indices,image,light,plane=[0,1,0,0],wall=null,opacity=.3,scale,softness=1,silhouetteAnchor=null}){
   if(!receiver||!image||!light||!points.length)return;
   const key=[id(image),light.id,wall?.id||'ground',softness].join(':');
   let batch=batches.get(key);if(!batch){batch={positions:[],uv:[],strength:[],anchors:[],image,light,plane,wall,scale,softness};batches.set(key,batch);}
   const append=(point,tex)=>{batch.positions.push(...point);batch.uv.push(...tex);batch.strength.push(opacity);batch.anchors.push(...(silhouetteAnchor||[0,0,0,0]));};
   if(light.vector[3]>.5&&!wall&&!silhouetteAnchor){
    const limit=light.vector[1]-.02;
    for(let i=0;i<indices.length;i+=3){const a=indices[i],b=indices[i+1],c=indices[i+2],aboveA=points[a][1]>limit,aboveB=points[b][1]>limit,aboveC=points[c][1]>limit;
     if(aboveA&&aboveB&&aboveC)continue;
     if(!aboveA&&!aboveB&&!aboveC){append(points[a],uv[a]);append(points[b],uv[b]);append(points[c],uv[c]);continue;}
     const polygon=clipShadowTriangleAtLight([points[a],points[b],points[c]],[uv[a],uv[b],uv[c]],light.vector[1]);
     for(let j=1;j<polygon.length-1;j++)for(const v of [polygon[0],polygon[j],polygon[j+1]])append(v.point,v.uv);
    }
   }else for(const index of indices)append(points[index],uv[index]);
  },
  flush(){
   if(!batches.size||!receiver)return;flush();const view=getView();
   const fillPosition=new Float32Array(128),fillRange=new Float32Array(32),fillCount=Math.min(32,lighting.sources.length);
   for(let i=0;i<fillCount;i++){const l=lighting.sources[i];fillPosition.set([...l.vector.slice(0,3),l.power],i*4);fillRange[i]=l.range;}
   const groups=new Map();for(const batch of batches.values()){if(!groups.has(batch.light.id))groups.set(batch.light.id,[]);groups.get(batch.light.id).push(batch);}
   const target=renderer.getRenderTarget(),oldColor=renderer.getClearColor(new THREE.Color()),oldAlpha=renderer.getClearAlpha();
   const size=renderer.getDrawingBufferSize(new THREE.Vector2()),factor=Math.min(1,1024/Math.max(size.x,size.y));
   const width=Math.max(1,Math.round(size.x*factor)),height=Math.max(1,Math.round(size.y*factor));
   if(maskTarget.width!==width||maskTarget.height!==height)maskTarget.setSize(width,height);maskQuad.material.uniforms.texel.value.set(1/width,1/height);
   try{for(const group of groups.values()){
    renderer.setRenderTarget(maskTarget);renderer.setClearColor(0,0);renderer.clear(true,false,false);
    for(const batch of group){
    let record=records[slot++];
    if(record&&record.gpu!==!!batch.gpu){release(record);records[slot-1]=record=null;}
    if(!record){const geometry=new THREE.BufferGeometry(),material=new THREE.ShaderMaterial({vertexShader:batch.gpu?gpuCasterVertex(projectedShadowVertex):projectedShadowVertex,fragmentShader:batch.gpu?projectedShadowFragment.replace('varying vec3 vGround;','varying vec3 vProjected;').replace('void main(){','void main(){vec3 vGround=light.w>.5?vec3(vProjected.x/vProjected.y,0.,vProjected.z/vProjected.y):vProjected;'):projectedShadowFragment,
      uniforms:{casterModel:{value:new THREE.Matrix4()},captureCamera:{value:new THREE.Matrix4()},frameToWorld:{value:new THREE.Matrix4()},bindMatrix:{value:new THREE.Matrix4()},bindMatrixInverse:{value:new THREE.Matrix4()},hasSkin:{value:false},bonePalette:{value:null},bonePaletteHeight:{value:1},strength:{value:1},shadowPixelScale:{value:1},lightPower:{value:1},lightRange:{value:1},solarAmbient:{value:new THREE.Vector2()},fillCount:{value:0},fillPosition:{value:new Float32Array(128)},fillRange:{value:new Float32Array(32)},light:{value:new THREE.Vector4()},receiverPlane:{value:new THREE.Vector4()},worldScale:{value:new THREE.Vector3()},combatView:{value:new THREE.Matrix3()},anchor:{value:new THREE.Vector2()},zoom:{value:1},
       artwork:{value:null},receiverMask:{value:null},maskBounds:{value:new THREE.Vector4()},texel:{value:new THREE.Vector2()},softness:{value:1},wallReceiver:{value:false},wallSpan:{value:new THREE.Vector4()},wallHeight:{value:3.5}},
      side:THREE.DoubleSide,forceSinglePass:true,blending:THREE.CustomBlending,blendEquation:THREE.MaxEquation,blendEquationAlpha:THREE.MaxEquation,blendSrc:THREE.OneFactor,blendDst:THREE.OneFactor,transparent:true,depthTest:false,depthWrite:false,toneMapped:false});
     const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;record={geometry,material,mesh,gpu:!!batch.gpu};records[slot-1]=record;}
    if(batch.gpu){
     const part=batch.part,u=record.material.uniforms;
     if(record.source!==part.geometry){record.geometry.dispose();record.geometry=part.geometry.clone();record.mesh.geometry=record.geometry;record.source=part.geometry;}
     const bones=part.bones||identityBones;
     let palette=palettes.get(bones);
     if(!palette){const texture=new THREE.DataTexture(bones,4,bones.length/16,THREE.RGBAFormat,THREE.FloatType);texture.needsUpdate=true;palette={texture,frame:paletteFrame};palettes.set(bones,palette);perf.count('shadowPaletteUploads');}
     else perf.count('shadowPaletteReuses');
     palette.frame=paletteFrame;
     u.bonePalette.value=palette.texture;u.bonePaletteHeight.value=bones.length/16;u.hasSkin.value=!!part.bones;
     if(part.bind)u.bindMatrix.value.copy(part.bind);if(part.unbind)u.bindMatrixInverse.value.copy(part.unbind);
     u.casterModel.value.copy(part.matrix);u.captureCamera.value.copy(batch.capture.camera);u.frameToWorld.value.fromArray(batch.transform);u.strength.value=batch.opacity;
    }else{
    if(record.geometry.getAttribute('casterPoint')?.array.length!==batch.positions.length){record.geometry.dispose();record.geometry=new THREE.BufferGeometry();record.mesh.geometry=record.geometry;}
    for(const [name,array,size] of [['casterPoint',batch.positions,3],['uv',batch.uv,2],['strength',batch.strength,1],['silhouetteAnchor',batch.anchors,4]]){
     let attribute=record.geometry.getAttribute(name);
     if(!attribute||attribute.array.length!==array.length){record.geometry.setAttribute(name,new THREE.Float32BufferAttribute(array,size).setUsage(THREE.DynamicDrawUsage));}
     else{attribute.array.set(array);attribute.needsUpdate=true;}
    }
    // Three.js requires a position attribute to determine non-indexed draw count.
    record.geometry.setAttribute('position',record.geometry.getAttribute('casterPoint'));
    }
    const u=record.material.uniforms,[a,b,c,d,tx,ty]=view.matrix;
    u.shadowPixelScale.value=Math.max(Math.hypot(a*batch.scale[0],b*batch.scale[0]),Math.hypot(c*batch.scale[2],d*batch.scale[2]))*view.zoom*factor;
    u.lightPower.value=batch.light.power||1;u.lightRange.value=batch.light.range||1;
    u.solarAmbient.value.set(lighting.solar?.daylight||0,lighting.solar?.sky??1);
    u.fillCount.value=fillCount;u.fillPosition.value=fillPosition;u.fillRange.value=fillRange;
    u.light.value.fromArray(batch.light.vector);u.receiverPlane.value.fromArray(batch.plane);u.worldScale.value.fromArray(batch.scale);
    u.combatView.value.set(a,c,tx,b,d,ty,0,0,1);u.anchor.value.set(view.anchor.x,view.anchor.y);u.zoom.value=view.zoom;
    u.artwork.value=texture(batch.image);u.receiverMask.value=texture(receiver.image);u.maskBounds.value.fromArray(receiver.bounds);
    u.texel.value.set(1/(batch.image.width||batch.image.naturalWidth||1),1/(batch.image.height||batch.image.naturalHeight||1));u.softness.value=batch.softness;
    u.wallReceiver.value=!!batch.wall;if(batch.wall){u.wallSpan.value.fromArray(batch.wall.span);u.wallHeight.value=batch.wall.height;}
    scene.add(record.mesh);
    if(batch.gpu){const range=batch.part.geometry.drawRange;record.geometry.clearGroups();for(const g of batch.part.groups){const start=Math.max(g.start,range.start),end=Math.min(g.start+g.count,range.start+range.count);record.geometry.addGroup(start,Math.max(0,end-start),0);stats.triangles+=Math.max(0,end-start)/3;}record.geometry.setDrawRange(range.start,range.count);record.mesh.material=[record.material];perf.count('gpuModelShadowDraws');}
    else stats.triangles+=batch.positions.length/9;
    stats.batches++;
    }renderer.render(scene,camera);scene.clear();perf.count('shadowSceneSubmissions');const su=maskQuad.material.uniforms,snow=getSnow();su.snowGround.value=!!snow&&!group[0].wall;if(snow){su.snowMask.value=snow.texture;su.snowBounds.value.copy(snow.bounds);}const [va,vb,vc,vd,vtx,vty]=view.matrix;su.inverseView.value.set(va,vc,vtx,vb,vd,vty,0,0,1).invert();su.viewport.value.set(view.width,view.height);su.viewAnchor.value.set(view.anchor.x,view.anchor.y);su.viewZoom.value=view.zoom;
 maskQuad.material.uniforms.localShadow.value=group[0].light.vector[3]>.5;renderer.setRenderTarget(target);scene.add(maskQuad);renderer.render(scene,camera);scene.remove(maskQuad);
   }}finally{scene.clear();renderer.setRenderTarget(target);renderer.setClearColor(oldColor,oldAlpha);}
   batches.clear();onPaint();
  },
  end(){while(records.length>slot)release(records.pop());for(const [key,p] of palettes)if(p.frame!==paletteFrame){p.texture.dispose();palettes.delete(key);}},
  uses(image){return records.slice(0,slot).some(r=>r.material.uniforms.artwork.value?.image===image||r.material.uniforms.receiverMask.value?.image===image);},
  diagnostics(){return {...stats};},dispose(){for(const p of palettes.values())p.texture.dispose();palettes.clear();records.forEach(release);records.length=0;batches.clear();solidMask.dispose();maskTarget.dispose();maskQuad.geometry.dispose();maskQuad.material.dispose();}
 };
}
