import * as THREE from '../assets/vendor/three/three.module.min.js';
import {SCENE_STYLE} from './exploration-scene-style.mjs?v=R238C228';
export {SCENE_STYLE,torchPlacement} from './exploration-scene-style.mjs?v=R238C228';
export const CELL=SCENE_STYLE.cellMetres,HEIGHT=SCENE_STYLE.wallMetres;
export async function explorationMaterials(renderer){
 const loader=new THREE.TextureLoader();
 const textures=await Promise.all(['wall','floor','door'].map(name=>loader.loadAsync(new URL(`../assets/textures/exploration/${name}.png?v=R238C206`,import.meta.url).href)));
 for(const texture of textures){texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());}
 const m=SCENE_STYLE.materials;
 textures[0].wrapS=textures[0].wrapT=textures[1].wrapS=textures[1].wrapT=THREE.RepeatWrapping;
 textures[0].repeat.set(1/m.wallWidthScale,m.wallRows/m.sourceWallRows);textures[1].repeat.set(m.floorSlabs/m.sourceFloorSlabs,m.floorSlabs/m.sourceFloorSlabs);
 return {textures,wall:new THREE.MeshLambertMaterial({map:textures[0]}),floor:new THREE.MeshLambertMaterial({map:textures[1]}),wood:new THREE.MeshLambertMaterial({map:textures[2]}),ceiling:new THREE.MeshLambertMaterial({map:textures[0],color:0x777066})};
}
export function explorationDoor(wall,wood,open=false){
 const root=new THREE.Group();
 const box=(w,h,d,m,x,y,z)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;};
 const d=SCENE_STYLE.door;
 for(const x of [-1,1].map(sign=>sign*(CELL/2-d.frameWidth/2)))box(d.frameWidth,HEIGHT,d.frameDepth,wall,x,HEIGHT/2,0);
 box(CELL,d.lintelHeight,d.frameDepth,wall,0,HEIGHT-d.lintelHeight/2,0);
 const hinge=new THREE.Group();hinge.position.set(d.hingeX,0,0);root.add(hinge);
 const leaf=box(d.width,d.height,d.depth,wood,d.width/2,d.height/2,0);root.remove(leaf);hinge.add(leaf);
 if(open)hinge.rotation.y=-Math.PI/2;
 return {root,hinge};
}
