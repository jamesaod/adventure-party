import * as THREE from '../assets/vendor/three/three.module.min.js';
import {combatPerformance as perf} from './combat-performance.mjs';
export function createGpuOutline(renderer,flush,getView,onPaint){
 const target=new THREE.WebGLRenderTarget(1,1,{depthBuffer:true}),occlusion=new THREE.CanvasTexture(null);
 occlusion.generateMipmaps=false;occlusion.minFilter=occlusion.magFilter=THREE.LinearFilter;
 let maskWidth=0,maskHeight=0;
 const scene=new THREE.Scene(),camera=new THREE.Camera(),material=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,toneMapped:false,
 uniforms:{shape:{value:target.texture},occlusion:{value:occlusion},texel:{value:new THREE.Vector2()},radius:{value:1},color:{value:new THREE.Color()},alpha:{value:new THREE.Vector2()},rect:{value:new THREE.Vector4()},viewport:{value:new THREE.Vector2()}},
 vertexShader:'uniform vec4 rect;uniform vec2 viewport;varying vec2 vUv;void main(){vUv=uv;vec2 p=rect.xy+vec2(uv.x,1.-uv.y)*rect.zw;gl_Position=vec4(p.x/viewport.x*2.-1.,1.-p.y/viewport.y*2.,0.,1.);}',
 fragmentShader:`uniform sampler2D shape,occlusion;uniform vec2 texel,alpha;uniform float radius;uniform vec3 color;varying vec2 vUv;
 void main(){float center=texture2D(shape,vUv).a,inner=0.,outer=0.;for(int i=0;i<12;i++){float a=float(i)*.5235987756;vec2 d=vec2(cos(a),sin(a))*texel*radius;inner=max(inner,texture2D(shape,vUv+d*1.5).a);outer=max(outer,texture2D(shape,vUv+d*2.6).a);}float cover=texture2D(occlusion,vUv).a;float r=max(0.,inner-center)*alpha.y*cover,b=max(0.,outer-center)*alpha.x*cover;float a=r+b*(1.-r);if(a<.001)discard;gl_FragColor=vec4((color*r+color*.45*b*(1.-r))/a,a);}`});
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);mesh.frustumCulled=false;scene.add(mesh);
 return {draw(callback,{mask,left,top,color,active,daylight}){
  flush();const view=getView(),old=renderer.getRenderTarget(),clear=renderer.getClearColor(new THREE.Color()),clearAlpha=renderer.getClearAlpha();
  if(target.width!==mask.width||target.height!==mask.height)target.setSize(mask.width,mask.height);
  try{renderer.setRenderTarget(target);renderer.setClearColor(0,0);renderer.clear(true,true,false);callback(renderer);
   renderer.setRenderTarget(old);
   // WebGL2 storage is immutable. Poses/zoom change mask sizes, even on reused canvases.
   if(maskWidth!==mask.width||maskHeight!==mask.height){occlusion.dispose();maskWidth=mask.width;maskHeight=mask.height;}
   occlusion.image=mask;occlusion.needsUpdate=true;
   const u=material.uniforms;u.texel.value.set(1/mask.width,1/mask.height);u.radius.value=1/view.zoom;u.color.value.set(color,THREE.SRGBColorSpace).convertLinearToSRGB();u.alpha.value.set(.45+.4*daylight,Math.min(1,(active?.92:.78)+daylight*.1));
   u.rect.value.set(view.anchor.x+(left-view.anchor.x)*view.zoom,view.anchor.y+(top-view.anchor.y)*view.zoom,mask.width*view.zoom,mask.height*view.zoom);u.viewport.value.set(view.width,view.height);
   renderer.render(scene,camera);perf.count('gpuOutlinePasses');onPaint();return true;
  }finally{renderer.setRenderTarget(old);renderer.setClearColor(clear,clearAlpha);}
 },dispose(){target.dispose();occlusion.dispose();mesh.geometry.dispose();material.dispose();}};
}
