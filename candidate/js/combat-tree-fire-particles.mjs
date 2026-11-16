import * as THREE from '../assets/vendor/three/three.module.min.js';

// One reusable instanced flame/ember pool. All motion and flame breakup run on
// the GPU; mesh samples remain stable throughout the burn, not resampled in time.
export function createTreeFireParticles(capacity=192){
 const geometry=new THREE.InstancedBufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute([-.5,-.5,0,.5,-.5,0,.5,.5,0,-.5,.5,0],3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));geometry.setIndex([0,1,2,0,2,3]);
 const seeds=new Float32Array(capacity),embers=new Float32Array(capacity);
 for(let i=0;i<capacity;i++){const n=Math.sin(i*127.1+19.7)*43758.5453;seeds[i]=n-Math.floor(n);embers[i]=i%7===6?1:0;}
 geometry.setAttribute('anchor',new THREE.InstancedBufferAttribute(new Float32Array(capacity*3),3));
 geometry.setAttribute('seed',new THREE.InstancedBufferAttribute(seeds,1));geometry.setAttribute('ember',new THREE.InstancedBufferAttribute(embers,1));
 const uniforms={time:{value:0},yaw:{value:0},phase:{value:0}};
 const material=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,blending:THREE.AdditiveBlending,
  vertexShader:`attribute vec3 anchor;attribute float seed,ember;uniform float time,yaw,phase;
   varying vec2 flameUv;varying float life,isEmber,variation;
   void main(){
    float t=fract(time*mix(.62+seed*.38,.30+seed*.2,ember)+seed+phase);life=t;isEmber=ember;variation=seed;flameUv=uv;
    float c=cos(yaw),s=sin(yaw);vec3 p=anchor;p.xz=mat2(c,-s,s,c)*p.xz;
    float curl=time*(1.5+seed)+seed*31.+t*5.;
    p.y+=t*mix(25.+seed*18.,80.+seed*40.,ember);
    p.x+=sin(curl)*t*mix(5.,12.,ember);p.z+=cos(curl*.83)*t*mix(4.,9.,ember);
    vec4 view=viewMatrix*vec4(p,1.);
    vec2 size=mix(vec2(10.+seed*10.,22.+seed*20.)*(1.-t*.35),vec2(1.1+seed),ember);
    view.xy+=position.xy*size;gl_Position=projectionMatrix*view;
   }`,
  fragmentShader:`uniform float time;varying vec2 flameUv;varying float life,isEmber,variation;
   float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
   void main(){
    vec2 uv=flameUv;float age=smoothstep(0.,.12,life)*(1.-smoothstep(.55,1.,life));
    if(isEmber>.5){float d=length(uv*2.-1.);float a=(1.-smoothstep(.15,1.,d))*age;if(a<.01)discard;gl_FragColor=vec4(1.,.32+.35*(1.-life),.025,a*.8);return;}
    vec2 flow=vec2(uv.x*3.+variation*19.,uv.y*4.-time*(2.+variation));
    float turbulence=noise(flow)*.65+noise(flow*2.1+7.)*.35;
    float bend=sin(uv.y*5.-time*3.+variation*30.)*uv.y*.16+(turbulence-.5)*.28;
    float width=mix(.42,.025,uv.y)*( .8+turbulence*.4);
    float edge=abs(uv.x-.5-bend)/max(.01,width);
    float body=1.-smoothstep(.55,1.,edge);
    float tip=1.-smoothstep(.60+turbulence*.25,1.,uv.y);
    float alpha=body*tip*smoothstep(0.,.08,uv.y)*age*.85;
    if(alpha<.015)discard;
    float heat=clamp((1.-edge)*.75+(1.-uv.y)*.3,0.,1.);
    vec3 color=mix(vec3(.95,.055,.006),vec3(1.,.78,.12),smoothstep(.15,.9,heat));
    gl_FragColor=vec4(color,alpha);
   }`
 });
 const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.renderOrder=10;
 const anchorCache=new WeakMap();
 return {mesh,update({samples,yaw=0,phase=0,time=0,count=capacity}){
  geometry.instanceCount=samples?.length?Math.max(0,Math.min(capacity,Math.floor(count))):0;
  uniforms.time.value=time;uniforms.yaw.value=yaw;uniforms.phase.value=phase;
  if(!geometry.instanceCount)return;
  let cache=anchorCache.get(samples);if(!cache){cache=new Map();anchorCache.set(samples,cache);}
  const key=Math.floor(phase*101);let anchors=cache.get(key);
  if(!anchors){anchors=new Float32Array(capacity*3);for(let i=0;i<capacity;i++){const p=samples[((i*137+key)%samples.length+samples.length)%samples.length];anchors.set([p.x,p.y,p.z],i*3);}if(cache.size>=32)cache.delete(cache.keys().next().value);cache.set(key,anchors);}
  const attribute=geometry.attributes.anchor;if(attribute.array!==anchors){attribute.array=anchors;attribute.needsUpdate=true;}
 },dispose(){geometry.dispose();material.dispose();}};
}
