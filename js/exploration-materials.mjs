import * as THREE from '../assets/vendor/three/three.module.min.js';
export const CELL=3,HEIGHT=3.5;
export async function explorationMaterials(renderer){
 const loader=new THREE.TextureLoader();
 const textures=await Promise.all(['wall','floor','door'].map(name=>loader.loadAsync(new URL(`../assets/textures/exploration/${name}.png?v=R238C206`,import.meta.url).href)));
 for(const texture of textures){texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());}
 return {textures,wall:new THREE.MeshLambertMaterial({map:textures[0]}),floor:new THREE.MeshLambertMaterial({map:textures[1]}),wood:new THREE.MeshLambertMaterial({map:textures[2]}),ceiling:new THREE.MeshLambertMaterial({map:textures[0],color:0x777066})};
}
export function explorationDoor(wall,wood,open=false){
 const root=new THREE.Group();
 const box=(w,h,d,m,x,y,z)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;};
 for(const x of [-1.38,1.38])box(.24,HEIGHT,.36,wall,x,HEIGHT/2,0);
 box(CELL,.4,.36,wall,0,HEIGHT-.2,0);
 const hinge=new THREE.Group();hinge.position.set(-1.25,0,0);root.add(hinge);
 const leaf=box(2.5,3.08,.14,wood,1.25,1.54,0);root.remove(leaf);hinge.add(leaf);
 if(open)hinge.rotation.y=-Math.PI/2;
 return {root,hinge};
}
