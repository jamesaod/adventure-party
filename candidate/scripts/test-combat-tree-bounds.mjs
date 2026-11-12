import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {treeScreenBounds} from '../js/combat-tree-bounds.mjs';
const camera=new THREE.OrthographicCamera(-80,80,180,-30,1,1800);
camera.position.set(0,568,823);camera.lookAt(0,0,0);camera.updateMatrixWorld();
const box=new THREE.Box3(new THREE.Vector3(-40,0,-35),new THREE.Vector3(40,180,35));
for(let step=0;step<12;step++){
 const yaw=step*Math.PI/6,b=treeScreenBounds(box,camera.matrixWorldInverse,yaw);
 const fire=treeScreenBounds(box,camera.matrixWorldInverse,yaw,true);
 assert.ok(fire.width>b.width&&fire.height>b.height);
 for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
  const p=new THREE.Vector3(x,y,z).applyAxisAngle(new THREE.Vector3(0,1,0),yaw).applyMatrix4(camera.matrixWorldInverse);
  assert.ok(p.x>=b.x&&p.x<=b.x+b.width&&-p.y>=b.y&&-p.y<=b.y+b.height);
 }
 // Cropping must preserve pixel placement, including zoom and partial offscreen bounds.
 for(const zoom of [.5,1,2])for(const cx of [-20,400]){
  const scale=zoom,cy=300,crop={x:Math.max(0,cx+b.x*scale),y:Math.max(0,cy+b.y*scale),width:b.width*scale,height:b.height*scale};
  const left=(crop.x-cx)/scale,top=(cy-crop.y)/scale;
  const px=12,py=80;
  assert.ok(Math.abs(crop.x+(px-left)*scale-(cx+px*scale))<1e-8);
  assert.ok(Math.abs(crop.y+(top-py)*scale-(cy-py*scale))<1e-8);
 }
}
console.log('PASS tree bounds at 12 rotations, fire margin, zoom and cropped camera alignment');
