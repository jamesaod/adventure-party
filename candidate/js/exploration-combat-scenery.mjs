import * as THREE from '../assets/vendor/three/three.module.min.js';
import {CELL,HEIGHT,explorationMaterials,explorationDoor,SCENE_STYLE} from './exploration-materials.mjs?v=R238C232';

export function combatSceneryEntries(map,terrain,openDoors){
 const entries=[],b=terrain.bounds;
 for(let z=b.top;z<=b.bottom;z++)for(let x=b.left;x<=b.right;x++){
  if(map.grid[z]?.[x]!=='#')continue;
  const wallIds=[];
  for(const [dx,dz,side] of [[0,-1,'s'],[1,0,'w'],[0,1,'n'],[-1,0,'e']]){
   const nx=x+dx,nz=z+dz;
   if(nx>=b.left&&nx<=b.right&&nz>=b.top&&nz<=b.bottom&&'.D'.includes(map.grid[nz]?.[nx]||'#'))wallIds.push(`${side}-${nx}-${nz}`);
  }
  if(wallIds.length)entries.push({kind:'wall',x,z,wallIds,...terrain.project(x,z),mapX:x,mapZ:z});
 }
 for(const door of map.doors||[]){
  if(door.x<b.left||door.x>b.right||door.z<b.top||door.z>b.bottom)continue;
  entries.push({kind:'door',axis:door.axis,open:openDoors.has(`${door.x},${door.z}`),wallIds:[`door-${door.x}-${door.z}`],...terrain.project(door.x,door.z),mapX:door.x,mapZ:door.z});
 }
 return entries;
}

// Render actual exploration meshes once from the tactical camera. The existing
// combat depth queue composites these cached layers with its unit sprites.
export async function createCombatScenery(map,terrain,openDoors){
 const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});renderer.outputColorSpace=THREE.SRGBColorSpace;
 const materials=await explorationMaterials(renderer),scene=new THREE.Scene();
 const {ambient,lantern:lamp}=SCENE_STYLE;scene.add(new THREE.HemisphereLight(ambient.sky,ambient.ground,ambient.intensity));
 const scale=terrain.cellW/CELL,elevation=Math.asin(terrain.cellH/terrain.cellW);
 const width=Math.ceil(terrain.cellW*2.2),height=Math.ceil((HEIGHT*scale+terrain.cellH)*2.2);
 renderer.setSize(width*2,height*2,false);
 const camera=new THREE.OrthographicCamera(-width/scale/2,width/scale/2,height/scale/2,-height/scale/2,.1,200);
 camera.position.set(0,Math.sin(elevation)*100,Math.cos(elevation)*100);camera.lookAt(0,0,0);
 const lantern=new THREE.PointLight(lamp.color,lamp.intensity,lamp.range,lamp.decay);lantern.position.set(0,2,4);scene.add(lantern);
 const images=new Map(),entries=combatSceneryEntries(map,terrain,openDoors);
 try{
  for(const entry of entries){
   const key=entry.kind==='wall'?'wall':`door-${entry.axis}-${entry.open}`;
   if(!images.has(key)){
    const mesh=entry.kind==='wall'?new THREE.Mesh(new THREE.BoxGeometry(CELL,HEIGHT,CELL),materials.wall):explorationDoor(materials.wall,materials.wood,entry.open).root;
    if(entry.kind==='wall')mesh.position.y=HEIGHT/2;else if(entry.axis==='x')mesh.rotation.y=Math.PI/2;
    scene.add(mesh);renderer.render(scene,camera);
    const image=document.createElement('canvas');image.width=width*2;image.height=height*2;image.getContext('2d').drawImage(renderer.domElement,0,0);images.set(key,image);
    scene.remove(mesh);mesh.traverse(o=>o.geometry?.dispose());
   }
   entry.image=images.get(key);entry.width=width;entry.height=height;
   entry.sortY=entry.y+(entry.kind==='wall'?terrain.cellH/2:0);
  }
  return entries;
 }finally{Object.values(materials).forEach(m=>m?.dispose?.());materials.textures.forEach(t=>t.dispose());renderer.dispose();renderer.forceContextLoss();}
}
