import * as THREE from '../assets/vendor/three/three.module.min.js';
// Bounded, clearly visible transient smoke plumes. Existing combat scheduler supplies elapsed time.
export function createBurnSmoke(){
 const geometry=new THREE.PlaneGeometry(2,2),uniforms={rect:{value:new THREE.Vector4()},viewport:{value:new THREE.Vector2()},age:{value:0},fade:{value:0},seed:{value:0}};
 const material=new THREE.ShaderMaterial({uniforms,transparent:true,depthTest:false,depthWrite:false,toneMapped:false,
 vertexShader:`uniform vec4 rect;uniform vec2 viewport;varying vec2 vUv;void main(){vUv=uv;vec2 p=rect.xy+vec2(uv.x,1.-uv.y)*rect.zw;gl_Position=vec4(p.x/viewport.x*2.-1.,1.-p.y/viewport.y*2.,0.,1.);}`,
 fragmentShader:`uniform float age,fade,seed;varying vec2 vUv;void main(){float density=0.;for(int i=0;i<5;i++){float f=float(i),t=fract(age*.23+f*.2);vec2 center=vec2(.5+sin(t*5.+seed+f)*(.06+t*.14),t*.85+.06);vec2 d=(vUv-center)/vec2(.13+t*.20,.12+t*.14);density+=exp(-dot(d,d)*2.)*sin(t*3.14159);}float a=min(.68,density*.60)*fade;if(a<.005)discard;gl_FragColor=vec4(mix(vec3(.24,.25,.26),vec3(.62,.63,.64),vUv.y),a);}`});
 const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;
 return {mesh,update({x,y,width,height,age,fade,seed},view){uniforms.rect.value.set(view.anchor.x+(x-width/2-view.anchor.x)*view.zoom,view.anchor.y+(y-height-view.anchor.y)*view.zoom,width*view.zoom,height*view.zoom);uniforms.viewport.value.set(view.width,view.height);uniforms.age.value=age;uniforms.fade.value=fade;uniforms.seed.value=seed;},dispose(){geometry.dispose();material.dispose();}};
}
