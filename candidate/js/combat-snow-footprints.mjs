// Animated foot contacts carve a persistent, world-space snow height field.
import {kickSnow} from './combat-snow-kickup.mjs';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {SNOW_MAX_METRES,SNOW_LAYER_METRES} from './combat-snow-depth.mjs';
let contacts=new WeakMap(),revision=0,cells=new Map(),sampleDepth=()=>0;
let cellIndex=null,indexSize=-1;
const feet=new WeakMap(),point=new THREE.Vector3(),toePoint=new THREE.Vector3();
export const snowFootprints=[];
const corpseDepressions=new Map();let corpseRevision=0;
export function clearCorpseDepressions(){corpseDepressions.clear();corpseRevision++;revision++;}
// Bake the actual final-pose silhouette onto the same ground cut field. A
// full-depth cut remains occupied independently of snowfall and foot refill.
export function pressCorpseIntoSnow(group,entity,groundMatrix){
 if(!entity||entity.alive||corpseDepressions.get(entity)?.group===group)return;
 const positions=[],keys=new Set(),p=new THREE.Vector3();
 group.updateMatrixWorld(true);
 group.traverseVisible(mesh=>{if(!mesh.isMesh)return;const g=mesh.geometry,a=g?.attributes.position;if(!a)return;const index=g.index,n=index?index.count:a.count;
  for(let i=0;i<n;i+=3){const tri=[];for(let j=0;j<3;j++){mesh.getVertexPosition(index?index.getX(i+j):i+j,p).applyMatrix4(mesh.matrixWorld);p.y=0;p.applyMatrix4(groundMatrix);tri.push({x:p.x,y:p.y});}
   const [a,b,c]=tri;if(Math.abs((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))<.00001)continue;
   for(const v of tri){positions.push(v.x,v.y,0);const cell=cellAt(v.x,v.y);if(cell)keys.add(cell.key);}
   const cell=cellAt((a.x+b.x+c.x)/3,(a.y+b.y+c.y)/3);if(cell)keys.add(cell.key);
  }
 });
 corpseDepressions.set(entity,{group,positions,keys});corpseRevision++;revision++;
}
export const snowFootprintRevision=()=>revision;
export function setFootprintCells(value,depth){cells=value;cellIndex=null;if(depth)sampleDepth=depth;}
export function clearSnowFootprints(){snowFootprints.length=0;contacts=new WeakMap();revision++;}
export function meltFootprints(keys,amount){const set=new Set(keys),remaining=1-Math.max(0,Math.min(1,amount));for(const f of snowFootprints)if(set.has(f.key)){f.depth*=remaining;revision++;}}
function cellAt(x,y){
 if(!cellIndex||indexSize!==cells.size){
  cellIndex=new Map();indexSize=cells.size;
  for(const cell of cells.values()){
   const points=cell.triangles.flatMap(t=>[t.a,t.b,t.c]);if(!points.length)continue;
   const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
   for(let gx=Math.floor(Math.min(...xs)/64);gx<=Math.floor(Math.max(...xs)/64);gx++)for(let gy=Math.floor(Math.min(...ys)/64);gy<=Math.floor(Math.max(...ys)/64);gy++){
    const key=gx+','+gy;let list=cellIndex.get(key);if(!list)cellIndex.set(key,list=[]);list.push(cell);
   }
  }
 }
 for(const cell of cellIndex.get(Math.floor(x/64)+','+Math.floor(y/64))||[])for(const {a,b,c} of cell.triangles){const cross=(p,q)=>(q.x-p.x)*(y-p.y)-(q.y-p.y)*(x-p.x),d=[cross(a,b),cross(b,c),cross(c,a)];if(d.every(v=>v>=0)||d.every(v=>v<=0))return cell;}return null;
}
function groundPoint(p,options,view,camera){p.y=0;p.project(camera);const [a,b,c,d,tx,ty]=view.matrix,det=a*d-b*c,sx=options.x-options.width*options.anchor.x+(p.x+1)*options.width/2,sy=options.y-options.height*options.anchor.y+(1-p.y)*options.height/2;return {x:(d*(sx-tx)-c*(sy-ty))/det,y:(-b*(sx-tx)+a*(sy-ty))/det};}
export function sampleSnowFootfalls(group,entity,options,view,camera){
 if(!entity?.alive||!Number.isFinite(options.poseSeconds??options.walkSeconds)){if(entity)contacts.delete(entity);return;}
 if(!cells.size)return;
 const [a,b,c,d]=view.matrix;if(Math.abs(a*d-b*c)<1e-8)return;
 let bones=feet.get(group);if(!bones){bones=[];group.traverse(n=>{if(n.isBone&&/(left|right)foot$/i.test(n.name))bones.push(n);});// Prepared standing poses are baked meshes without a skeleton. Recover two
 // sole contacts once from their lowest geometry band so pivots still carve.
 if(!bones.length){
  const inverse=group.matrixWorld.clone().invert(),vertices=[],box=new THREE.Box3();
  group.traverse(n=>{if(!n.isMesh||!n.visible)return;const a=n.geometry?.attributes.position;if(!a)return;for(let i=0;i<a.count;i++){n.getVertexPosition(i,point).applyMatrix4(n.matrixWorld).applyMatrix4(inverse);vertices.push(point.clone());box.expandByPoint(point);}});
  if(vertices.length){const height=box.max.y-box.min.y,mid=(box.min.x+box.max.x)/2;
   for(const side of [-1,1]){const sole=new THREE.Vector3();let count=0;for(const v of vertices)if(v.y<=box.min.y+height*.035&&(v.x<mid?-1:1)===side){sole.add(v);count++;}
    if(count){sole.divideScalar(count);const b=new THREE.Bone(),toe=new THREE.Bone();b.name=side<0?'leftFoot':'rightFoot';b.position.copy(sole);toe.position.z=height*.1;b.add(toe);group.add(b);bones.push(b);}
   }group.updateMatrixWorld(true);
  }
 }
 feet.set(group,bones);}
 if(!bones.length)return;
 let state=contacts.get(entity);if(!state||state.group!==group){state={group,feet:new Map(),sole:Infinity};contacts.set(entity,state);}
 // A foot joint sits above its sole. Calibrate to the lowest observed planted
 // foot, then test clearance in physical metres rather than animation phase.
 for(const bone of bones){bone.getWorldPosition(point);state.sole=Math.min(state.sole,point.y);}
 const factor=options.modelUnitsPerMetre||1,scale=options.groundMetresScale||[options.pixelsPerMetre||10,options.pixelsPerMetre||10];
 for(const bone of bones){
  const old=state.feet.get(bone.name),t=options.poseSeconds??options.walkSeconds;if(old?.t===t)continue;
  bone.getWorldPosition(point);const clearance=Math.max(0,(point.y-state.sole)/factor),p=groundPoint(point,options,view,camera),height=sampleDepth(p.x,p.y);
  const contact=height>.0005&&clearance<height+.006;
  const current={...p,t,contact,clearance,raised:!!old?.raised||clearance>.05};state.feet.set(bone.name,current);
  // Trigger at sole planting, not at entering the snow surface: deep snow
  // can surround a foot for the whole stride. No clock-based step cadence.
  if(old&&t>old.t&&t-old.t<=.2&&current.raised&&clearance<=.025){current.raised=false;if(height>.003&&options.outdoor!==false)globalThis.adventurePartySnowStep?.(Math.min(1,height/(SNOW_LAYER_METRES*3)));}
  if(!contact)continue;
  let angle=old?.angle||0;const toe=bone.children.find(n=>n.isBone);
  if(toe){toe.getWorldPosition(toePoint);const tip=groundPoint(toePoint,options,view,camera);angle=Math.atan2((tip.y-p.y)/scale[1],(tip.x-p.x)/scale[0]);}
  current.angle=angle;
  const distance=old?Math.hypot((p.x-old.x)/scale[0],(p.y-old.y)/scale[1]):0;
  const join=old?.contact&&t>old.t&&t-old.t<=.2&&distance<.8;
  // Sample short swept segments, including their owning hex, so a boundary
  // crossing cannot leave a gap and local fire can melt just its own section.
  const turn=old?.angle===undefined?0:Math.atan2(Math.sin(angle-old.angle),Math.cos(angle-old.angle));
  const steps=join?Math.max(1,Math.ceil(distance/.07),Math.ceil(Math.abs(turn)/.15)):1;
  // Idle redraws do not stamp. A pivot sweeps the boot through intermediate
  // angles; a lowered foot presses deeper even without translating.
  if(old?.contact&&distance<.001&&Math.abs(turn)<.01&&clearance>=old.clearance-.001)continue;
  if(old&&(distance>.015||Math.abs(turn)>.08))kickSnow(p.x,p.y,Math.max(0,height-clearance),scale);
  for(let i=1;i<=steps;i++){
   const u=i/steps,v=(i-1)/steps,x=join?old.x+(p.x-old.x)*u:p.x,y=join?old.y+(p.y-old.y)*u:p.y;
   const cell=cellAt(x,y),depth=Math.min(height,sampleDepth(x,y))-clearance;if(!cell||depth<=0)continue;
   snowFootprints.push({x,y,fromX:join?old.x+(p.x-old.x)*v:x,fromY:join?old.y+(p.y-old.y)*v:y,angle:join?old.angle+turn*u:angle,scaleX:scale[0],scaleY:scale[1],key:cell.key,depth:Math.min(1,depth/SNOW_MAX_METRES)});revision++;
  }
 }
 if(snowFootprints.length>4096)snowFootprints.splice(0,snowFootprints.length-4096);
}
export function createFootprintLayer(renderer,bounds){
 const target=new THREE.WebGLRenderTarget(2048,2048,{depthBuffer:false,stencilBuffer:false});
 const geometry=new THREE.BufferGeometry(),scene=new THREE.Scene(),camera=new THREE.Camera(),keys=new Set();
 // Compute banks from the union, so overlapping feet/body triangles never
 // create internal ridges. Run only when the cut texture actually changes.
 const bankTarget=target.clone(),bankScene=new THREE.Scene(),bankGeometry=new THREE.PlaneGeometry(2,2);
 const bankMaterial=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,uniforms:{cuts:{value:target.texture},reach:{value:new THREE.Vector2()}},
 vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}',
 fragmentShader:`uniform sampler2D cuts;uniform vec2 reach;varying vec2 v;
 float cut(vec2 p){return texture2D(cuts,clamp(p,0.,1.)).r;}
 void main(){float center=cut(v),edge=0.;
 for(int i=0;i<8;i++){float a=float(i)*.785398163;vec2 d=vec2(cos(a),sin(a))*reach;edge=max(edge,max(cut(v+d)*.55,cut(v+d*.5)));}
 float bank=max(0.,edge-center)*(1.-center);gl_FragColor=vec4(center,bank,0.,max(center,bank));}`});
 bankScene.add(new THREE.Mesh(bankGeometry,bankMaterial));
 // MAX prevents overlapping steps from cutting deeper than the deepest sole.
 const material=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,toneMapped:false,blending:THREE.CustomBlending,blendEquation:THREE.MaxEquation,blendSrc:THREE.OneFactor,blendDst:THREE.OneFactor,
 uniforms:{bounds:{value:bounds}},vertexShader:'uniform vec4 bounds;attribute float strength;attribute float aspect;varying vec2 q;varying float amount;varying float ratio;void main(){q=uv;amount=strength;ratio=aspect;gl_Position=vec4((position.xy-bounds.xy)/bounds.zw*2.-1.,0.,1.);}',
 fragmentShader:'varying vec2 q;varying float amount;varying float ratio;void main(){float r=length(vec2(max(abs(q.x)*ratio-(ratio-1.),0.),q.y));float cut=(1.-smoothstep(.65,1.,r))*amount;gl_FragColor=vec4(cut,0.,0.,cut);}'});
 const corpseGeometry=new THREE.BufferGeometry(),corpseMaterial=new THREE.ShaderMaterial({side:THREE.DoubleSide,depthTest:false,depthWrite:false,toneMapped:false,transparent:true,blending:THREE.CustomBlending,blendEquation:THREE.MaxEquation,blendSrc:THREE.OneFactor,blendDst:THREE.OneFactor,
 uniforms:{bounds:{value:bounds}},vertexShader:'uniform vec4 bounds;void main(){gl_Position=vec4((position.xy-bounds.xy)/bounds.zw*2.-1.,0.,1.);}',fragmentShader:'void main(){gl_FragColor=vec4(1.,0.,0.,1.);}'});
 const corpseMesh=new THREE.Mesh(corpseGeometry,corpseMaterial);corpseMesh.frustumCulled=false;scene.add(corpseMesh);let corpseVersion=-1,corpseVertices=0;
 const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;scene.add(mesh);let version=-1;
 return {texture:bankTarget.texture,hasHex:key=>keys.has(key),resize(w,h){if(target.width!==w||target.height!==h){target.setSize(w,h);bankTarget.setSize(w,h);version=-1;}},update(snowfall,force=false){
  if(snowfall>0&&snowFootprints.length){const fill=snowfall*SNOW_LAYER_METRES/SNOW_MAX_METRES;for(const f of snowFootprints)f.depth=Math.max(0,f.depth-fill);revision++;}
  for(const [entity] of corpseDepressions)if(entity.alive){corpseDepressions.delete(entity);corpseRevision++;revision++;}
  if(!force&&version===revision)return;version=revision;keys.clear();
  if(corpseVersion!==corpseRevision){corpseVersion=corpseRevision;const data=[];for(const body of corpseDepressions.values())for(const v of body.positions)data.push(v);corpseGeometry.dispose();corpseGeometry.setAttribute('position',new THREE.Float32BufferAttribute(data,3));corpseVertices=data.length/3;corpseGeometry.setDrawRange(0,corpseVertices);}
  for(const body of corpseDepressions.values())for(const key of body.keys)keys.add(key);
  let retained=0;for(const f of snowFootprints)if(f.depth>.0001)snowFootprints[retained++]=f;snowFootprints.length=retained;
  const positions=[],uv=[],strength=[],aspect=[];
  for(const f of snowFootprints){if(f.depth<=.0001)continue;keys.add(f.key);const dx=(f.x-f.fromX)/f.scaleX,dy=(f.y-f.fromY)/f.scaleY,length=Math.hypot(dx,dy),angle=length>.001?Math.atan2(dy,dx):f.angle,c=Math.cos(angle),s=Math.sin(angle),half=(length+.27)/2,width=.055;
   for(const [u,v] of [[-1,-1],[1,-1],[1,1],[-1,-1],[1,1],[-1,1]]){const x=u*half,y=v*width;positions.push((f.x+f.fromX)/2+(c*x-s*y)*f.scaleX,(f.y+f.fromY)/2+(s*x+c*y)*f.scaleY,0);uv.push(u,v);strength.push(f.depth);aspect.push(half/width);}
  }
  // Retain capacity while tracks grow; avoid disposing/uploading new buffers
  // for every step. The capped record count bounds all GPU storage.
  for(const [name,data,size] of [['position',positions,3],['uv',uv,2],['strength',strength,1],['aspect',aspect,1]]){
   let a=geometry.getAttribute(name);if(!a||a.array.length<data.length){if(a){geometry.dispose();}const capacity=Math.max(256,2**Math.ceil(Math.log2(Math.max(1,data.length))));a=new THREE.BufferAttribute(new Float32Array(Math.ceil(capacity/size)*size),size).setUsage(THREE.DynamicDrawUsage);geometry.setAttribute(name,a);}a.array.set(data);a.needsUpdate=true;
  }
  geometry.setDrawRange(0,positions.length/3);
  const old=renderer.getRenderTarget(),color=renderer.getClearColor(new THREE.Color()),alpha=renderer.getClearAlpha();renderer.setRenderTarget(target);renderer.setClearColor(0,0);renderer.clear();if(positions.length||corpseVertices)renderer.render(scene,camera);
  bankMaterial.uniforms.reach.value.set(2.5/bounds.z,1.42/bounds.w);renderer.setRenderTarget(bankTarget);renderer.render(bankScene,camera);
  renderer.setRenderTarget(old);renderer.setClearColor(color,alpha);
 },dispose(){bankTarget.dispose();bankGeometry.dispose();bankMaterial.dispose();target.dispose();geometry.dispose();material.dispose();corpseGeometry.dispose();corpseMaterial.dispose();}};
}
