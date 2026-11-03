import {WOOD_TEXTURES} from './quarter-walls.mjs?v=R238C266';
import {GRASS_TEXTURES,GROUND_TEXTURES} from './exploration-ground.mjs?v=R238C266';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {SCENE_STYLE} from './exploration-scene-style.mjs?v=R238C266';
export {SCENE_STYLE,torchPlacement} from './exploration-scene-style.mjs?v=R238C266';
export const CELL=SCENE_STYLE.cellMetres,HEIGHT=SCENE_STYLE.wallMetres;
export async function explorationMaterials(renderer,{outdoor=false,dirt=false}={}){
 const loader=new THREE.TextureLoader();
 const textures=await Promise.all(['wall','floor','door'].map(name=>loader.loadAsync(new URL(`../assets/textures/exploration/${name}.png?v=R238C206`,import.meta.url).href)));
 if(outdoor||dirt)textures.push(await loader.loadAsync(new URL('../'+GRASS_TEXTURES.short+'?v=R238C246',import.meta.url).href));
 if(dirt)for(const name of ['dirt','fringe'])textures.push(await loader.loadAsync(new URL('../'+GROUND_TEXTURES[name]+'?v=R238C258',import.meta.url).href));
 for(const texture of textures){texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());}
 const timber=await Promise.all([WOOD_TEXTURES.wall,WOOD_TEXTURES.ceiling].map(path=>loader.loadAsync(new URL('../'+path+'?v=R238C266',import.meta.url).href)));
 for(const texture of timber){texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());}timber[0].repeat.set(2,1);
 const m=SCENE_STYLE.materials;
 textures[0].wrapS=textures[0].wrapT=textures[1].wrapS=textures[1].wrapT=THREE.RepeatWrapping;
 textures[0].repeat.set(1/m.wallWidthScale,m.wallRows/m.sourceWallRows);textures[1].repeat.set(m.floorSlabs/m.sourceFloorSlabs,m.floorSlabs/m.sourceFloorSlabs);
 if(textures[3]){textures[3].wrapS=textures[3].wrapT=THREE.RepeatWrapping;textures[3].repeat.set(1,1);}
 return {textures:[...textures,...timber],woodWall:new THREE.MeshLambertMaterial({map:timber[0]}),woodCeiling:new THREE.MeshLambertMaterial({map:timber[1],color:0xaaa099}),groundImages:{grass:textures[3]?.image,dirt:textures[4]?.image,fringe:textures[5]?.image},grass:textures[3]?new THREE.MeshLambertMaterial({map:textures[3]}):null,wall:new THREE.MeshLambertMaterial({map:textures[0]}),floor:new THREE.MeshLambertMaterial({map:textures[1]}),wood:new THREE.MeshLambertMaterial({map:textures[2]}),ceiling:new THREE.MeshLambertMaterial({map:textures[0],color:0x777066})};
}
// This is a first-person presentation size, never authored/combat geometry.
export const explorationDoorWidth=door=>Math.abs((door.width??.375)-.375)<1e-8?.5625:door.width;
export function wallFrameGeometry(w,h,d,x=0,y=0,z=0){
 const g=new THREE.BoxGeometry(w,h,d),p=g.getAttribute('position'),n=g.getAttribute('normal'),uv=g.getAttribute('uv');
 for(let i=0;i<p.count;i++){const px=p.getX(i)+x,py=p.getY(i)+y,pz=p.getZ(i)+z;uv.setXY(i,Math.abs(n.getX(i))>.5?pz/CELL+.5:px/CELL+.5,Math.abs(n.getY(i))>.5?pz/CELL+.5:py/HEIGHT);}
 return g;
}
export function explorationDoor(wall,wood,open=false,options={}){
 const root=new THREE.Group();
 const box=(w,h,d,m,x,y,z,frame=false)=>{const mesh=new THREE.Mesh(frame?wallFrameGeometry(w,h,d,x,y,z):new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;};
 const d={...SCENE_STYLE.door,...options};
 const side=options.width?(CELL-d.width)/2:d.frameWidth,hingeSign=options.hinge==='end'?-1:1;
 for(const x of [-1,1].map(sign=>sign*(CELL/2-side/2)))box(side,HEIGHT,d.frameDepth,wall,x,HEIGHT/2,0,true);
 box(CELL,d.lintelHeight,d.frameDepth,wall,0,HEIGHT-d.lintelHeight/2,0,true);
 const hinge=new THREE.Group();hinge.position.set(options.width?-hingeSign*d.width/2:d.hingeX,0,0);hinge.userData.openAngle=-hingeSign*Math.PI/2;root.add(hinge);
 const leaf=box(d.width,d.height,d.depth,wood,hingeSign*d.width/2,d.height/2,0);root.remove(leaf);hinge.add(leaf);
 if(open)hinge.rotation.y=hinge.userData.openAngle;
 return {root,hinge};
}
