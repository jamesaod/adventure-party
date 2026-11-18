import * as T from '../assets/vendor/three/three.module.min.js';
// Transient bounded volumes. Opaque depth clips the march inside each puff.
export function createGiantImpactDust(renderer,scene){
 const group=new T.Group();scene.add(group);const clouds=[],size=new T.Vector2();
 const target=new T.WebGLRenderTarget(1,1);target.depthTexture=new T.DepthTexture(1,1);
 const geometry=new T.BoxGeometry(2,2,2);let cost=0;
 const vertexShader=`varying vec3 localP;void main(){localP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
 const fragmentShader=`precision highp float;
 varying vec3 localP;uniform mat4 invWorld,invProjection,worldCamera;uniform vec2 screenSize;uniform sampler2D sceneDepth;uniform float density,clock;uniform vec3 tint;
 float noise(vec3 p){return .5+.22*sin(p.x*3.1+sin(p.z*2.7))*sin(p.y*4.3+p.z*2.1)+.13*sin(p.x*9.7+p.z*7.1+p.y*6.3);}
 vec3 unproject(vec2 uv,float d){vec4 p=invProjection*vec4(uv*2.-1.,d*2.-1.,1.);return (worldCamera*vec4(p.xyz/p.w,1.)).xyz;}
 void main(){vec2 uv=gl_FragCoord.xy/screenSize;vec3 start=(invWorld*vec4(unproject(uv,0.),1.)).xyz;vec3 stop=(invWorld*vec4(unproject(uv,texture2D(sceneDepth,uv).r),1.)).xyz;vec3 dir=normalize(localP-start);vec3 ri=1./dir;vec3 a=(-vec3(1.)-start)*ri,b=(vec3(1.)-start)*ri;vec3 lo=min(a,b),hi=max(a,b);float begin=max(0.,max(lo.x,max(lo.y,lo.z))),end=min(length(stop-start),min(hi.x,min(hi.y,hi.z)));if(end<=begin)discard;float ds=(end-begin)/24.,alpha=0.;for(int i=0;i<24;i++){vec3 p=start+dir*(begin+(float(i)+.5)*ds);float d=(1.-smoothstep(.15,1.,length(p)))*noise(p*2.+vec3(clock*.1,0.,0.));alpha+=(1.-alpha)*(1.-exp(-d*density*ds));}gl_FragColor=vec4(tint,alpha);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`;
 function clear(){for(const c of clouds){group.remove(c.mesh);c.mesh.material.dispose();}clouds.length=0;}
 function emit(outline,origin,time){if(!outline.length)return;clear();const sorted=[...outline].sort((a,b)=>Math.atan2(a.z,a.x)-Math.atan2(b.z,b.x));for(let i=0;i<16;i++){const p=sorted[Math.floor(i*sorted.length/16)];const material=new T.ShaderMaterial({vertexShader,fragmentShader,transparent:true,depthWrite:false,depthTest:false,side:T.BackSide,uniforms:{invWorld:{value:new T.Matrix4()},invProjection:{value:new T.Matrix4()},worldCamera:{value:new T.Matrix4()},screenSize:{value:size},sceneDepth:{value:target.depthTexture},density:{value:0},clock:{value:0},tint:{value:new T.Color()}}});const mesh=new T.Mesh(geometry,material);group.add(mesh);clouds.push({mesh,p,origin:origin.clone(),born:time});}}
 function update(time){for(let i=clouds.length-1;i>=0;i--){const c=clouds[i],t=time-c.born;if(t>=3){group.remove(c.mesh);c.mesh.material.dispose();clouds.splice(i,1);continue;}const travel=1.5*(1-Math.exp(-t*1.5));c.mesh.position.set(c.origin.x+c.p.x+c.p.nx*travel,.2+t*.23,c.origin.z+c.p.z+c.p.nz*travel);c.mesh.scale.set(.5+t*.45,.25+t*.3,.5+t*.45);c.mesh.material.uniforms.density.value=2.8*Math.min(1,t/.12)*Math.pow(1-t/3,1.5);c.mesh.material.uniforms.clock.value=t;}}
 function render(camera,hemi,sun,fire){const start=performance.now();if(!clouds.length){renderer.render(scene,camera);cost=0;return;}renderer.getDrawingBufferSize(size);if(target.width!==size.x||target.height!==size.y)target.setSize(size.x,size.y);const previous=renderer.getRenderTarget();group.visible=false;renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.setRenderTarget(previous);group.visible=true;
 for(const c of clouds){c.mesh.updateMatrixWorld();const u=c.mesh.material.uniforms;u.invWorld.value.copy(c.mesh.matrixWorld).invert();u.invProjection.value.copy(camera.projectionMatrixInverse);u.worldCamera.value.copy(camera.matrixWorld);u.tint.value.setRGB(.27,.17,.075).multiplyScalar(hemi.intensity*.25+sun.intensity*.22);const distance=c.mesh.position.distanceTo(fire.position);u.tint.value.r+=fire.intensity*.04/(1+distance*distance);u.tint.value.g+=fire.intensity*.012/(1+distance*distance);}
 renderer.render(scene,camera);cost=performance.now()-start;}
 return {emit,update,clear,render,get active(){return clouds.length>0;},get count(){return clouds.length;},get submitMs(){return cost;},dispose(){clear();geometry.dispose();target.dispose();scene.remove(group);}};
}
