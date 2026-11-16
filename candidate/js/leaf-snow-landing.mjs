import * as THREE from '../assets/vendor/three/three.module.min.js';
import {SNOW_DEPTH_GLSL,SNOW_MAX_METRES} from './combat-snow-depth.mjs?v=shore-snow1';
import {SNOW_SHELTER_GLSL,snowShelterUniforms} from './combat-snow-shelter.mjs?v=tree-snow-grains1';
export const LEAF_SNOW_DECODE=`float leafSnowHeight(vec4 saved){return dot(saved.rg,vec2(65280.,255.))/65535.*${SNOW_MAX_METRES};}`;
// One texel per persistent leaf cluster. Capture at landing, then only lower
// its resting height when snow melts/gets compressed. Never read back to CPU.
export function createLeafSnowLanding(renderer,snow){
 const targets=[0,1].map(()=>new THREE.WebGLRenderTarget(256,1,{depthBuffer:false,stencilBuffer:false,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter}));
 const uniform={value:targets[0].texture},geometry=new THREE.BufferGeometry(),scene=new THREE.Scene(),camera=new THREE.Camera();
 const material=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,uniforms:{...snowShelterUniforms,previous:{value:targets[1].texture},snowAccumulation:{value:snow.texture},snowFootprints:{value:snow.footprintTexture},snowBounds:{value:snow.bounds},now:{value:0},rows:{value:1}},vertexShader:`attribute vec2 landing;uniform float rows,now;uniform sampler2D previous,snowAccumulation,snowFootprints;uniform vec4 snowBounds;varying vec4 result;${SNOW_DEPTH_GLSL}${SNOW_SHELTER_GLSL}${LEAF_SNOW_DECODE}
 void main(){ivec2 cell=ivec2(int(landing.x)%256,int(landing.x)/256);gl_Position=vec4((vec2(cell)+.5)/vec2(256.,rows)*2.-1.,0.,1.);gl_PointSize=1.;result=vec4(0.);if(now<landing.y)return;vec2 uv=(position.xy-snowBounds.xy)/snowBounds.zw;float height=0.;if(all(greaterThanEqual(uv,vec2(0.)))&&all(lessThanEqual(uv,vec2(1.))))height=snowDeformedHeight(snowSampleDepth(snowAccumulation,uv),texture2D(snowFootprints,uv).rg);vec4 old=texelFetch(previous,cell,0);if(old.b>.5)height=min(height,leafSnowHeight(old));float q=floor(clamp(height/${SNOW_MAX_METRES},0.,1.)*65535.+.5);result=vec4(floor(q/256.)/255.,mod(q,256.)/255.,1.,1.);}`,fragmentShader:'varying vec4 result;void main(){gl_FragColor=result;}' });
 const mesh=new THREE.Points(geometry,material);mesh.frustumCulled=false;scene.add(mesh);let source=null,lookup=new Map(),current=0,revision=null,next=Infinity,passes=0;
 return {uniform,index:key=>(lookup.get(key)??-1)+1,update(leaves,now=performance.now()/1000){
  const changed=source!==leaves;if(changed){source=leaves;lookup=new Map();const positions=[],landing=[];for(const [i,p]of (leaves||[]).entries()){lookup.set(p.key,i);positions.push(p.x,p.y,0);landing.push(i,p.field||0);}geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('landing',new THREE.Float32BufferAttribute(landing,2));geometry.setDrawRange(0,positions.length/3);const rows=Math.max(1,Math.ceil((leaves?.length||0)/256));for(const t of targets)t.setSize(256,rows);material.uniforms.rows.value=rows;revision=null;next=-Infinity;}
  if(!renderer)return;
  const nextRevision=snow.surfaceRevision;if(!changed&&nextRevision===revision&&now<next)return;
  if(!leaves?.length&&!changed)return;
  const oldTarget=renderer.getRenderTarget(),oldColor=renderer.getClearColor(new THREE.Color()),oldAlpha=renderer.getClearAlpha(),auto=renderer.autoClear;
  try{renderer.setClearColor(0,0);if(changed)for(const t of targets){renderer.setRenderTarget(t);renderer.clear();}const output=1-current;material.uniforms.previous.value=targets[current].texture;material.uniforms.now.value=now;renderer.setRenderTarget(targets[output]);renderer.clear();renderer.autoClear=false;if(leaves?.length)renderer.render(scene,camera);current=output;uniform.value=targets[current].texture;passes++;}finally{renderer.autoClear=auto;renderer.setRenderTarget(oldTarget);renderer.setClearColor(oldColor,oldAlpha);}
  revision=nextRevision;next=Infinity;for(const p of leaves||[])if(p.field>now)next=Math.min(next,p.field);
 },diagnostics:()=>({passes,leaves:lookup.size}),dispose(){for(const t of targets)t.dispose();geometry.dispose();material.dispose();}};
}
