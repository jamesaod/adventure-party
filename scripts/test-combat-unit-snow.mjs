import assert from 'node:assert/strict';import * as T from '../assets/vendor/three/three.module.min.js';
import {unitSnowGroundMatrix,installUnitSnowOcclusion,bindUnitSnowOcclusion} from '../js/combat-unit-snow-occlusion.mjs';
const camera=new T.OrthographicCamera(-1,1,1,-1,.1,100);camera.position.set(0,4,4);camera.lookAt(0,0,0);camera.updateMatrixWorld();
for(let rotation=0;rotation<6;rotation++)for(const scale of [.5,1,2]){
 const angle=rotation*Math.PI/3,a=Math.cos(angle),b=Math.sin(angle)*.65,c=-Math.sin(angle),d=Math.cos(angle)*.65,det=a*d-b*c;
 const view={matrix:[a,b,c,d,211,122]},o={x:300,y:240,width:80*scale,height:100*scale,anchor:{x:.5,y:.8}},matrix=unitSnowGroundMatrix(camera,o,view);
 for(const p of [new T.Vector3(0,0,0),new T.Vector3(.3,0,-.2)]){
  const v=p.clone().project(camera),sx=o.x-o.width*o.anchor.x+(v.x+1)*o.width/2-211,sy=o.y-o.height*o.anchor.y+(1-v.y)*o.height/2-122,actual=p.clone().applyMatrix4(matrix);
  assert(Math.abs(actual.x-(d*sx-c*sy)/det)<1e-8);assert(Math.abs(actual.y-(-b*sx+a*sy)/det)<1e-8);
 }
}
const material=new T.MeshStandardMaterial();let prior=false;material.onBeforeCompile=()=>{prior=true;};installUnitSnowOcclusion(material);
const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};material.onBeforeCompile(shader);assert(prior);assert(shader.vertexShader.indexOf('vec3 snowWorld')>shader.vertexShader.indexOf('#include <skinning_vertex>'));assert(shader.fragmentShader.includes('discard;'));assert(shader.fragmentShader.includes('unitSnowTracks'));
const surface={texture:{},tracks:{},bounds:new T.Vector4(0,0,1,1)};bindUnitSnowOcclusion(material,surface,new T.Matrix4(),2,true);assert.equal(material.userData.unitSnow.enabled.value,true);assert.equal(material.userData.unitSnow.metres.value,2);bindUnitSnowOcclusion(material,null,new T.Matrix4(),2,true);assert.equal(material.userData.unitSnow.enabled.value,false);
console.log('PASS body-to-ground mapping at six views/three sizes, post-skinning height, trail-aware burial, and no-snow reset');

// A newly aimed Workshop camera has not necessarily been rendered yet.
camera.lookAt(.3,.2,-.4);const matrix=unitSnowGroundMatrix(camera,{x:0,y:0,width:80,height:100,anchor:{x:.5,y:.8}},{matrix:[1,0,0,1,0,0]});const before=matrix.clone();camera.updateMatrixWorld(true);assert.deepEqual(before.elements,unitSnowGroundMatrix(camera,{x:0,y:0,width:80,height:100,anchor:{x:.5,y:.8}},{matrix:[1,0,0,1,0,0]}).elements);
