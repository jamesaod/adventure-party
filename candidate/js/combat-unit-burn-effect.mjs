import * as THREE from '../assets/vendor/three/three.module.min.js';
// A single reusable GPU quad per burn reaction; no Canvas flame loops or textures.
export function createUnitBurnEffect(){
 const geometry=new THREE.PlaneGeometry(2,2);
 const uniforms={rect:{value:new THREE.Vector4()},viewport:{value:new THREE.Vector2()},time:{value:0},opacity:{value:0},core:{value:0},flameScale:{value:1},silhouette:{value:null}};
 const material=new THREE.ShaderMaterial({uniforms,transparent:true,depthTest:false,depthWrite:false,toneMapped:false,
 vertexShader:`uniform vec4 rect;uniform vec2 viewport;varying vec2 vUv;
 void main(){vUv=uv;vec2 p=rect.xy+vec2(uv.x,1.-uv.y)*rect.zw;gl_Position=vec4(p.x/viewport.x*2.-1.,1.-p.y/viewport.y*2.,0.,1.);}`,
 fragmentShader:`uniform float time,opacity,core,flameScale;uniform sampler2D silhouette;uniform vec4 rect;varying vec2 vUv;
 float coverage(vec2 uv){if(uv.x<0.||uv.y<0.||uv.x>1.||uv.y>1.)return 0.;return texture2D(silhouette,uv).a;}
 void main(){vec2 uv=vUv;float body=coverage(uv);float flame=0.;
 // Sample downward into the actual animated silhouette: tongues rise from its edges.
 for(int i=0;i<8;i++){float f=float(i);float pulse=.5+.5*sin(time*9.+uv.x*90.+f*2.3);
 vec2 offset=vec2(sin(time*7.+uv.y*48.+f)*(.8+f*.35),-(1.+f*1.5)*(.55+pulse*.45))*flameScale/rect.zw;
 flame=max(flame,coverage(uv+offset)*(1.-f/9.));}
 float a=max(flame*(1.-smoothstep(.03,.4,body)),body*core)*opacity;
 if(a<.015)discard;vec3 color=mix(vec3(1.,.14,.005),vec3(1.,.85,.12),pow(max(flame,body*core),2.));gl_FragColor=vec4(color,a*.88);}`});
 const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;
 return {mesh,update({texture,crop,time,opacity,core=0,scale=1},view){uniforms.silhouette.value=texture;uniforms.rect.value.set(crop.x,crop.y,crop.width,crop.height);uniforms.viewport.value.set(view.width,view.height);uniforms.time.value=time;uniforms.opacity.value=opacity;uniforms.core.value=core;uniforms.flameScale.value=scale;},dispose(){geometry.dispose();material.dispose();}};
}
