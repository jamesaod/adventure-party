import * as T from '../assets/vendor/three/three.module.min.js';
import {PUDDLE_PARTICLE_LIMIT} from './combat-puddle-effects.mjs?v=R238C450';
export function createPuddleParticles(){
 const geometry=new T.BufferGeometry(),positions=new Float32Array(PUDDLE_PARTICLE_LIMIT*3),alpha=new Float32Array(PUDDLE_PARTICLE_LIMIT);
 geometry.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));geometry.setAttribute('opacity',new T.BufferAttribute(alpha,1).setUsage(T.DynamicDrawUsage));
 const material=new T.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,toneMapped:false,uniforms:{view:{value:new T.Matrix3()},anchor:{value:new T.Vector2()},zoom:{value:1},pixelDensity:{value:1}},
 vertexShader:'uniform mat3 view;uniform vec2 anchor;uniform float zoom,pixelDensity;attribute float opacity;varying float a;void main(){vec2 p=(view*vec3(position.xy,1.)).xy-vec2(0.,position.z*10.);p=anchor+(p-anchor)*zoom;gl_Position=projectionMatrix*vec4(p,0.,1.);gl_PointSize=clamp(3.5*zoom,2.,7.)*pixelDensity;a=opacity;}',
 fragmentShader:'varying float a;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;gl_FragColor=vec4(.72,.83,.86,a*(1.-smoothstep(.4,1.,d)));}'});
 const mesh=new T.Points(geometry,material);mesh.frustumCulled=false;
 return {mesh,update(effects,view,pixelDensity=1){let count=0;for(const p of effects.particles){if(!effects.sampleFace(p.face,p.x,p.y))continue;const t=p.age,h=p.vz*t-1.8*t*t;if(h<0)continue;positions.set([p.x+p.vx*t*p.unit,p.y+p.vy*t*p.unit*p.squash,p.height+h],count*3);alpha[count++]=(1-t/p.life)*.9*p.visibility;}
  geometry.setDrawRange(0,count);geometry.attributes.position.needsUpdate=true;geometry.attributes.opacity.needsUpdate=true;const [a,b,c,d,tx,ty]=view.matrix;material.uniforms.view.value.set(a,c,tx,b,d,ty,0,0,1);material.uniforms.anchor.value.set(view.anchor.x,view.anchor.y);material.uniforms.zoom.value=view.zoom;material.uniforms.pixelDensity.value=pixelDensity;return count;
 },dispose(){geometry.dispose();material.dispose();}};
}

